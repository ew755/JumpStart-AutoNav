#!/usr/bin/env node
/**
 * Hook #15 — SessionStart: Phase-gate status injector
 *
 * Summarises which upstream artifacts are approved, pending, or missing so the
 * agent sees workflow readiness immediately on session start.
 */

const fs = require('fs');
const path = require('path');
const {
  runCli,
  loadHookState,
  saveHookState,
  ensureSessionRecord,
  extractSessionId,
  getPhaseGateApproval,
} = require('./lib/common');
const { getWorkspaceContext } = require('../../lib/workspace-context');

const PHASE_ARTIFACTS = [
  { phase: 'Scout', path: 'specs/codebase-context.md' },
  { phase: 'Challenger', path: 'specs/challenger-brief.md' },
  { phase: 'Analyst', path: 'specs/product-brief.md' },
  { phase: 'PM', path: 'specs/prd.md' },
  { phase: 'Architect', path: 'specs/architecture.md' },
  { phase: 'Architect', path: 'specs/implementation-plan.md' },
];

function resolveArtifactPaths(root) {
  const context = getWorkspaceContext(root);
  if (context.mode === 'multi-project' && context.config?.specs_path) {
    const specsRoot = context.config.specs_path;
    return PHASE_ARTIFACTS.map((item) => ({
      ...item,
      path: path.join(specsRoot, path.basename(item.path)).replace(/\\/g, '/'),
    }));
  }
  return PHASE_ARTIFACTS;
}

function readApprovalStatus(root, relPath) {
  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
  const displayPath = path.relative(root, fullPath).replace(/\\/g, '/');
  if (!fs.existsSync(fullPath)) return { state: 'missing', path: displayPath };
  const content = fs.readFileSync(fullPath, 'utf8');
  const approval = getPhaseGateApproval(content);
  if (approval.approved) {
    return { state: 'approved', path: displayPath };
  }
  return { state: 'pending', path: displayPath };
}

function collectPhaseGateStatuses(root) {
  return resolveArtifactPaths(root).map(item => ({
    ...item,
    ...readApprovalStatus(root, item.path),
  }));
}

function handle(input, ctx) {
  const sid = extractSessionId(input) || 'default';
  const statuses = collectPhaseGateStatuses(ctx.root);
  const approved = statuses.filter(s => s.state === 'approved');
  const pending = statuses.filter(s => s.state === 'pending');
  const missing = statuses.filter(s => s.state === 'missing');

  const hookState = loadHookState(ctx.root);
  const session = ensureSessionRecord(hookState, sid, ctx.now);
  session.startup_context.push({
    type: 'phase-gate-status',
    at: ctx.now.toISOString(),
    value: statuses,
  });
  saveHookState(ctx.root, hookState);

  const additionalContext = [
    '[AutoNav Phase Gate Status]',
    `Approved artifacts (${approved.length}): ${approved.length ? approved.map(a => a.path).join(', ') : 'none'}`,
    `Pending artifacts (${pending.length}): ${pending.length ? pending.map(a => a.path).join(', ') : 'none'}`,
    `Missing artifacts (${missing.length}): ${missing.length ? missing.map(a => a.path).join(', ') : 'none'}`,
  ].join('\n');

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
  collectPhaseGateStatuses,
  readApprovalStatus,
  PHASE_ARTIFACTS,
};

if (require.main === module) {
  runCli(handle);
}
