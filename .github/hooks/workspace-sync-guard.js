#!/usr/bin/env node
/**
 * Hook #17 — SessionStart: Workspace sync guard
 *
 * When multi-project mode is active, detect drift between projects.json and
 * per-project state.json files and inject a warning into session context.
 */

const path = require('path');
const {
  runCli,
  loadHookState,
  saveHookState,
  ensureSessionRecord,
  extractSessionId,
} = require('./lib/common');
const { detectMigrationState } = require('../../lib/workspace-migration');
const { WorkspaceManager } = require('../../lib/workspace-manager');

function buildSyncGuardBlock(root) {
  if (detectMigrationState(root) === 'single-project') {
    return null;
  }

  let drifts;
  try {
    const manager = new WorkspaceManager(root);
    drifts = manager.validateSync();
  } catch {
    return null;
  }

  if (drifts.length === 0) {
    return [
      '[Jump Start Workspace Sync]',
      'Registry and project state files are in sync.',
    ].join('\n');
  }

  const errors = drifts.filter((d) => d.severity === 'error');
  const warnings = drifts.filter((d) => d.severity === 'warn');
  const lines = ['[Jump Start Workspace Sync]', `${drifts.length} drift(s) detected:`];

  drifts.forEach((drift) => {
    const icon = drift.severity === 'error' ? 'ERROR' : 'WARN';
    lines.push(`- [${icon}] ${drift.project_id}: ${drift.message}`);
  });

  if (errors.length > 0) {
    lines.push('Run: jumpstart-mode workspace sync --pull');
  } else if (warnings.length > 0) {
    lines.push('Review with: jumpstart-mode workspace sync --audit');
  }

  return lines.join('\n');
}

function handle(input, ctx) {
  const sid = extractSessionId(input) || 'default';
  const additionalContext = buildSyncGuardBlock(ctx.root);

  if (!additionalContext) {
    return { exitCode: 0, stdout: '{}\n' };
  }

  const hookState = loadHookState(ctx.root);
  const session = ensureSessionRecord(hookState, sid, ctx.now);
  session.startup_context.push({
    type: 'workspace-sync-guard',
    at: ctx.now.toISOString(),
    value: additionalContext,
  });
  saveHookState(ctx.root, hookState);

  return {
    exitCode: 0,
    stdout: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
      additionalContext,
    }) + '\n',
  };
}

module.exports = {
  handle,
  buildSyncGuardBlock,
};

if (require.main === module) {
  runCli(handle);
}
