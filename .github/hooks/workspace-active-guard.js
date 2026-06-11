#!/usr/bin/env node
/**
 * Hook — PreToolUse: Workspace active-project guard
 *
 * When editing project-scoped paths (specs/, src/, tests/, projects/{id}/) in a
 * multi-project hub, auto-switch active project on unambiguous path match.
 * Blocks on ambiguity so the human or agent must choose explicitly.
 *
 * Env: JUMPSTART_WORKSPACE_AUTO_DETECT=advise (default: auto)
 */

const path = require('path');
const {
  runCli,
  extractTargetPath,
  extractSessionId,
  loadHookState,
  saveHookState,
  ensureSessionRecord,
  recordToolObservation,
} = require('./lib/common');
const {
  detectProjectFromPath,
  shouldGuardRelativePath,
} = require('../../lib/workspace-detect');
const { WorkspaceManager } = require('../../lib/workspace-manager');

function autoDetectMode() {
  const value = String(process.env.JUMPSTART_WORKSPACE_AUTO_DETECT || 'auto').toLowerCase();
  return value === 'advise' ? 'advise' : 'auto';
}

function handle(input, ctx) {
  const target = extractTargetPath(input.tool_input);
  const sid = extractSessionId(input) || 'default';
  const hookState = loadHookState(ctx.root);
  const session = ensureSessionRecord(hookState, sid, ctx.now);
  recordToolObservation(session, input, ctx.now);

  if (!target) {
    saveHookState(ctx.root, hookState);
    return { exitCode: 0 };
  }

  const absTarget = path.isAbsolute(target) ? target : path.join(ctx.root, target);
  let relativePath;
  try {
    relativePath = path.relative(ctx.root, absTarget).replace(/\\/g, '/');
  } catch {
    saveHookState(ctx.root, hookState);
    return { exitCode: 0 };
  }

  if (!shouldGuardRelativePath(relativePath)) {
    saveHookState(ctx.root, hookState);
    return { exitCode: 0 };
  }

  const detection = detectProjectFromPath({ cwd: ctx.root, filePath: absTarget });

  if (
    detection.action === 'single-project' ||
    detection.action === 'sibling_linked' ||
    detection.action === 'already_active' ||
    detection.action === 'no_match' ||
    detection.action === 'no_workspace'
  ) {
    saveHookState(ctx.root, hookState);
    return { exitCode: 0 };
  }

  if (detection.action === 'ambiguous') {
    const candidateList = detection.candidates
      .map((entry) => `${entry.project_id} (${entry.name || entry.path})`)
      .join(', ');
    const reason =
      `[AutoNav PreToolUse] Ambiguous workspace project for \`${relativePath}\`. ` +
      `Candidates: ${candidateList}. ` +
      'Run: jumpstart-mode workspace set-active <project-id> or workspace detect <path> --project-id=<id>';

    session.blocked_actions = session.blocked_actions || [];
    session.blocked_actions.push({
      at: ctx.now.toISOString(),
      tool: input.tool_name || input.toolName,
      target: relativePath,
      reason: 'ambiguous_workspace_project',
      candidates: detection.candidates.map((entry) => entry.project_id),
    });
    saveHookState(ctx.root, hookState);

    return {
      exitCode: 2,
      stdout: JSON.stringify({
        decision: 'block',
        reason,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
          additionalContext: reason,
        },
      }) + '\n',
      stderr: reason + '\n',
    };
  }

  if (detection.action === 'switch') {
    const fromId = detection.active_project_id;
    const toId = detection.suggested_project_id;
    const mode = autoDetectMode();

    if (mode === 'advise') {
      const additionalContext =
        `[AutoNav PreToolUse] Path \`${relativePath}\` belongs to ${toId} ` +
        `(active: ${fromId}). Run: jumpstart-mode workspace detect ${relativePath} --auto`;

      saveHookState(ctx.root, hookState);
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext,
          },
        }) + '\n',
      };
    }

    try {
      const manager = new WorkspaceManager(detection.hubRoot);
      manager.setActive(toId);
    } catch (error) {
      const reason = `[AutoNav PreToolUse] Failed to switch active project to ${toId}: ${error.message}`;
      saveHookState(ctx.root, hookState);
      return { exitCode: 1, stderr: reason + '\n' };
    }

    session.workspace_auto_switches = session.workspace_auto_switches || [];
    session.workspace_auto_switches.push({
      at: ctx.now.toISOString(),
      path: relativePath,
      from: fromId,
      to: toId,
    });
    saveHookState(ctx.root, hookState);

    const additionalContext =
      `[AutoNav PreToolUse] Auto-switched active project ${fromId} → ${toId} ` +
      `based on path \`${relativePath}\`.`;

    return {
      exitCode: 0,
      stdout: JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext,
        },
      }) + '\n',
    };
  }

  saveHookState(ctx.root, hookState);
  return { exitCode: 0 };
}

if (require.main === module) {
  runCli(handle);
}

module.exports = { handle, autoDetectMode };
