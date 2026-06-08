#!/usr/bin/env node
/**
 * Hook #16 — SessionStart: Jump Start workspace context injector
 *
 * When .jumpstart/projects.json exists, inject active project metadata and
 * scoped artifact paths so agents load specs from the correct project root.
 */

const path = require('path');
const {
  runCli,
  loadHookState,
  saveHookState,
  ensureSessionRecord,
  extractSessionId,
} = require('./lib/common');
const { getWorkspaceContext } = require('../../lib/workspace-context');

function relativeFromRoot(root, absolutePath) {
  if (!absolutePath) return null;
  return path.relative(root, absolutePath).replace(/\\/g, '/');
}

function buildWorkspaceContextBlock(root) {
  const context = getWorkspaceContext(root);

  if (context.mode === 'single-project') {
    return [
      '[Jump Start Workspace Context]',
      'Mode: single-project',
      'Specs: specs/',
      'Use root-level specs/, src/, and tests/ for this project.',
    ].join('\n');
  }

  if (context.mode === 'workspace-no-active') {
    return [
      '[Jump Start Workspace Context]',
      'Mode: workspace (no active project)',
      'Run: jumpstart-mode workspace set-active <project-id>',
    ].join('\n');
  }

  const project = context.project;
  const specsRel = relativeFromRoot(root, context.config?.specs_path) || 'specs';
  const srcRel = relativeFromRoot(root, context.config?.src_path) || 'src';
  const testsRel = relativeFromRoot(root, context.config?.tests_path) || 'tests';
  const phase = context.state?.current_phase;

  return [
    '[Jump Start Workspace Context]',
    `Mode: ${context.mode}`,
    `Active project: ${project.project_id} (${project.name})`,
    `Project path: ${project.path || '.'}`,
    `Current phase: ${phase ?? 'not started'}`,
    `Specs: ${specsRel}/`,
    `Source: ${srcRel}/`,
    `Tests: ${testsRel}/`,
    'Load artifacts from the paths above — not the global specs/ root unless active project path is ".".',
  ].join('\n');
}

function handle(input, ctx) {
  const sid = extractSessionId(input) || 'default';
  const context = getWorkspaceContext(ctx.root);
  const additionalContext = buildWorkspaceContextBlock(ctx.root);

  const hookState = loadHookState(ctx.root);
  const session = ensureSessionRecord(hookState, sid, ctx.now);
  session.workspace = {
    ...session.workspace,
    jumpstart: {
      mode: context.mode,
      active_project_id: context.project?.project_id || null,
      specs_path: context.config?.specs_path || null,
      current_phase: context.state?.current_phase ?? null,
    },
  };
  session.startup_context.push({
    type: 'jumpstart-workspace-context',
    at: ctx.now.toISOString(),
    value: session.workspace.jumpstart,
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
  buildWorkspaceContextBlock,
};

if (require.main === module) {
  runCli(handle);
}
