#!/usr/bin/env node
/**
 * Hook #18 — SessionStart: Pit Crew cross-project review guard
 *
 * When blocked cross-project dependencies involve the active project,
 * inject guidance to run Pit Crew before phase advancement.
 */

const {
  runCli,
  loadHookState,
  saveHookState,
  ensureSessionRecord,
  extractSessionId,
} = require('./lib/common');
const { detectMigrationState } = require('../../lib/workspace-migration');
const { WorkspaceManager } = require('../../lib/workspace-manager');
const parallel = require('../../lib/workspace-parallel');

function buildPitCrewBlock(root) {
  if (detectMigrationState(root) === 'single-project') {
    return null;
  }

  let manager;
  try {
    manager = new WorkspaceManager(root);
  } catch {
    return null;
  }

  const activeId = manager.config.active_project;
  if (!activeId) {
    return null;
  }

  const review = parallel.needsPitCrewReview(manager.config, manager.state, activeId);
  if (!review.required) {
    return null;
  }

  const lines = [
    '[Jump Start Pit Crew Review Required]',
    review.reason,
    '',
    'Blocked cross-project dependencies:',
  ];

  review.blockedDependencies.forEach((dep) => {
    const condition = dep.unblock_condition ? ` (unblock: ${dep.unblock_condition})` : '';
    lines.push(`- ${dep.from} → ${dep.to} [${dep.type || 'dependency'}]${condition}`);
  });

  lines.push('');
  lines.push('Before advancing phases on this project, run: /jumpstart.pitcrew');
  lines.push('Or resolve dependencies in .jumpstart/state/workspace-state.json');

  return lines.join('\n');
}

function handle(input, ctx) {
  const sid = extractSessionId(input) || 'default';
  const additionalContext = buildPitCrewBlock(ctx.root);

  if (!additionalContext) {
    return { exitCode: 0, stdout: '{}\n' };
  }

  const hookState = loadHookState(ctx.root);
  const session = ensureSessionRecord(hookState, sid, ctx.now);
  session.startup_context.push({
    type: 'workspace-pitcrew-guard',
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
  buildPitCrewBlock,
};

if (require.main === module) {
  runCli(handle);
}
