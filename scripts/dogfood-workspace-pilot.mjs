#!/usr/bin/env node
/**
 * dogfood-workspace-pilot.mjs
 *
 * Live validation of multi-project workspace on proj-workspace-pilot.
 * Run from repo root: node scripts/dogfood-workspace-pilot.mjs
 *
 * Temporarily sets active project to proj-workspace-pilot for the duration of
 * the run, then restores the prior active project (supports root track on proj-default).
 */

import { createRequire } from 'module';
import { existsSync, readFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const root = process.cwd();

const { getWorkspaceContext } = require('../lib/workspace-context.js');
const { WorkspaceManager } = require('../lib/workspace-manager.js');
const { createToolBridge } = require('../bin/lib/tool-bridge.js');
const { buildPitCrewBlock } = require('../.github/hooks/workspace-pitcrew-guard.js');
const { loadSpec, validatePhaseGate } = require('../lib/spec-loader.js');

const PILOT_PROJECT_ID = 'proj-workspace-pilot';
const PILOT_SPECS = join(root, 'projects', PILOT_PROJECT_ID, 'specs');

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

async function runDogfood() {
  const manager = new WorkspaceManager(root);
  const previousActive = manager.config.active_project;

  if (previousActive !== PILOT_PROJECT_ID) {
    process.stdout.write(`\n▶ Temporarily set active project to ${PILOT_PROJECT_ID} (was ${previousActive})... `);
    manager.setActive(PILOT_PROJECT_ID);
    console.log('OK');
  }

  try {
  step('Active project is proj-workspace-pilot', () => {
    const current = new WorkspaceManager(root);
    assert(current.config.active_project === PILOT_PROJECT_ID, 'active_project mismatch');
  });

  step('Challenger brief loads from pilot specs', () => {
    const context = getWorkspaceContext(root);
    const spec = loadSpec(context, 'challenger-brief.md');
    assert(spec.content.includes('Workspace Pilot'), 'brief content missing');
    assert(spec.path.includes(PILOT_PROJECT_ID), `wrong path: ${spec.path}`);
  });

  step('Project config YAML parses', () => {
    const context = getWorkspaceContext(root);
    assert(context.config.project.parsed?.project?.name === 'Workspace Pilot', 'YAML parse failed');
  });

  step('Pit Crew guard clear when dependency satisfied', () => {
    const block = buildPitCrewBlock(root);
    assert(!block, 'Pit Crew block should be absent after Phase 3 approval');
  });

  step('canAdvance allowed when cross-project dependency unblocked', () => {
    const current = new WorkspaceManager(root);
    const result = current.canAdvanceProject(PILOT_PROJECT_ID);
    assert(result.allowed, `expected advance allowed: ${result.reason || 'unknown'}`);
    assert(result.pitCrewReview !== true, 'pitCrewReview should not be set');
  });

  step('Approved product brief still valid (not clobbered)', () => {
    const context = getWorkspaceContext(root);
    const spec = loadSpec(context, 'product-brief.md');
    const gate = validatePhaseGate(spec);
    assert(gate.valid, `product-brief gate invalid: ${gate.errors?.join(', ') || 'unknown'}`);
    assert(spec.content.includes('Approved by:** Eric'), 'approved product brief was overwritten');
  });

  await step('Tool bridge redirects specs write to pilot project', async () => {
    const context = getWorkspaceContext(root);
    const bridge = createToolBridge({
      workspaceDir: root,
      workspaceContext: context,
    });

    const probeName = 'dogfood-redirect-probe.md';
    const probeRootPath = join(root, 'specs', probeName);
    const probePilotPath = join(PILOT_SPECS, probeName);

    if (existsSync(probePilotPath)) {
      unlinkSync(probePilotPath);
    }

    const toolCall = {
      id: 'dogfood-1',
      function: {
        name: 'create_file',
        arguments: JSON.stringify({
          filePath: probeRootPath,
          content: '# Dogfood redirect probe\n\nTemporary file for path redirection test.\n',
        }),
      },
    };

    const response = JSON.parse((await bridge.execute(toolCall)).content);
    assert(response.success, response.error || 'create_file failed');
    assert(response.redirected === true, 'expected path redirection');

    assert(existsSync(probePilotPath), `pilot probe missing: ${probePilotPath}`);
    assert(!existsSync(probeRootPath), 'root specs should not receive probe file');

    unlinkSync(probePilotPath);
  });

  step('workspace sync --audit (CLI)', () => {
    const result = spawnSync(process.execPath, ['bin/workspace.js', 'sync', '--audit'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert(result.status === 0, `sync audit failed: ${result.stderr}`);
  });

  step('validate-deps shows satisfied cross-project dependency', () => {
    const result = spawnSync(process.execPath, ['bin/workspace.js', 'validate-deps'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert(result.status === 0, `validate-deps failed: ${result.stderr}`);
    const out = `${result.stdout}\n${result.stderr}`;
    assert(out.includes('proj-workspace-pilot'), 'pilot dependency missing from validate-deps');
    assert(out.includes('proj-default'), 'default dependency target missing');
    assert(!out.includes('BLOCKED'), 'expected no BLOCKED deps after Phase 3 approval');
    assert(out.includes('✅'), 'expected satisfied dependency marker');
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
  console.log('\nPilot status: Phase 0–4 complete (proj-workspace-pilot).');
  console.log('Optional next: set-active proj-default for AutoNav product track.');
  } finally {
    if (previousActive !== PILOT_PROJECT_ID) {
      process.stdout.write(`\n▶ Restore active project to ${previousActive}... `);
      new WorkspaceManager(root).setActive(previousActive);
      console.log('OK');
    }
  }
}

runDogfood().catch((err) => {
  console.error(err);
  process.exit(1);
});
