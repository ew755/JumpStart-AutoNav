#!/usr/bin/env node
/**
 * Hook #16 — SessionStart: Jump Start workspace context injector
 *
 * Hub: .jumpstart/projects.json
 * Sibling checkout: .jumpstart/hub-link.json → resolves hub registry
 */

const {
  runCli,
  loadHookState,
  saveHookState,
  ensureSessionRecord,
  extractSessionId,
} = require('./lib/common');
const { getWorkspaceContext } = require('../../lib/workspace-context');
const { formatWorkspaceContextBlock } = require('../../lib/workspace-context-format');

function buildWorkspaceContextBlock(root) {
  const context = getWorkspaceContext(root);
  const displayRoot = context.linkedRoot || root;
  return formatWorkspaceContextBlock(context, { displayRoot });
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
      hub_root: context.hubRootRel || context.hubRoot || null,
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
