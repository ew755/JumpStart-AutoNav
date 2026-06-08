#!/usr/bin/env node
/**
 * dogfood-workspace-pilot.mjs
 *
 * Live validation of multi-project workspace on proj-workspace-pilot.
 * Run from repo root: node scripts/dogfood-workspace-pilot.mjs
 */

import { createRequire } from 'module';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const root = process.cwd();

const { getWorkspaceContext } = require('../lib/workspace-context.js');
const { WorkspaceManager } = require('../lib/workspace-manager.js');
const { createToolBridge } = require('../bin/lib/tool-bridge.js');
const { buildPitCrewBlock } = require('../.github/hooks/workspace-pitcrew-guard.js');
const { loadSpec } = require('../lib/spec-loader.js');

const PILOT_SPECS = join(root, 'projects', 'proj-workspace-pilot', 'specs');
const ROOT_SPECS = join(root, 'specs');

function step(name, fn) {
  process.stdout.write(`\n▶ ${name}... `);
  try {
    const result = fn();
    console.log('OK');
    return result;
  } catch (err) {
    console.log('FAIL');
    throw err;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('🐕 Workspace Pilot Dogfood Pass\n');
console.log(`Root: ${root}`);

step('Active project is proj-workspace-pilot', () => {
  const manager = new WorkspaceManager(root);
  assert(manager.config.active_project === 'proj-workspace-pilot', 'active_project mismatch');
});

step('Challenger brief loads from pilot specs', () => {
  const context = getWorkspaceContext(root);
  const spec = loadSpec(context, 'challenger-brief.md');
  assert(spec.content.includes('Workspace Pilot'), 'brief content missing');
  assert(spec.path.includes('proj-workspace-pilot'), `wrong path: ${spec.path}`);
});

step('Project config YAML parses', () => {
  const context = getWorkspaceContext(root);
  assert(context.config.project.parsed?.project?.name === 'Workspace Pilot', 'YAML parse failed');
});

step('Pit Crew guard triggers for blocked dependency', () => {
  const block = buildPitCrewBlock(root);
  assert(block && block.includes('Pit Crew Review Required'), 'Pit Crew block missing');
  assert(block.includes('proj-workspace-pilot'), 'pilot not mentioned in Pit Crew block');
});

step('canAdvance blocked by Pit Crew (expected)', () => {
  const manager = new WorkspaceManager(root);
  const result = manager.canAdvanceProject('proj-workspace-pilot');
  assert(!result.allowed, 'expected Pit Crew to block advance');
  assert(result.pitCrewReview === true, 'expected pitCrewReview flag');
});

step('Tool bridge redirects specs write to pilot project', async () => {
  const context = getWorkspaceContext(root);
  const bridge = createToolBridge({
    workspaceDir: root,
    workspaceContext: context,
  });

  const productBriefPath = join(root, 'specs', 'product-brief.md');
  const toolCall = {
    id: 'dogfood-1',
    function: {
      name: 'create_file',
      arguments: JSON.stringify({
        filePath: productBriefPath,
        content: [
          '---',
          'id: product-brief-workspace-pilot',
          'phase: 1',
          'agent: Analyst',
          'status: Draft',
          'created: 2026-06-08',
          '---',
          '',
          '# Product Brief — Workspace Pilot',
          '',
          '## Problem Reference',
          '',
          '> Validate multi-project workspace Phase 0→1 on live pilot project.',
          '',
          '## Vision Statement',
          '',
          '> Teams run nested Jump Start projects with correct artifact scoping and cross-project gates.',
          '',
          '## Phase Gate Approval',
          '',
          '- [ ] Personas defined',
          '- [ ] MVP scope documented',
          '',
          '**Approved by:** Pending',
          '**Approval date:** Pending',
          '',
        ].join('\n'),
      }),
    },
  };

  const response = JSON.parse((await bridge.execute(toolCall)).content);
  assert(response.success, response.error || 'create_file failed');
  assert(response.redirected === true, 'expected path redirection');

  const pilotBrief = join(PILOT_SPECS, 'product-brief.md');
  assert(existsSync(pilotBrief), `pilot product brief missing: ${pilotBrief}`);
  assert(!existsSync(join(ROOT_SPECS, 'product-brief.md')), 'root specs should not receive product-brief');
});

step('workspace sync --audit (CLI)', () => {
  const result = spawnSync(process.execPath, ['bin/workspace.js', 'sync', '--audit'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert(result.status === 0, `sync audit failed: ${result.stderr}`);
});

step('Headless multi-workspace scenario (mock analyst setup)', () => {
  const result = spawnSync(
    process.execPath,
    [
      'bin/headless-runner.js',
      '--agent', 'analyst',
      '--scenario', 'multi-workspace',
      '--mock',
      '--max-turns', '3',
      '--output', 'tests/e2e/.tmp',
    ],
    { cwd: root, encoding: 'utf8', timeout: 120000 }
  );
  const out = `${result.stdout}\n${result.stderr}`;
  assert(out.includes('Multi-project workspace'), 'multi-project setup log missing');
  assert(out.includes('Workspace initialized'), 'headless workspace init missing');
});

console.log('\n✅ Dogfood pass complete.');
console.log('\nNext steps:');
console.log('  1. Review projects/proj-workspace-pilot/specs/product-brief.md');
console.log('  2. Run /jumpstart.analyze or approve Phase 1 when ready');
console.log('  3. Run /jumpstart.pitcrew before advancing while dependency is blocked');
