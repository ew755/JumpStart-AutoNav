/**
 * CI-friendly dogfood checks for proj-workspace-pilot layout.
 * Uses repo paths when present; skips gracefully in sparse checkouts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const root = join(__dirname, '..');
const pilotRoot = join(root, 'projects', 'proj-workspace-pilot');
const PILOT_ID = 'proj-workspace-pilot';

const hasPilot = existsSync(join(pilotRoot, 'specs', 'challenger-brief.md'));

describe.skipIf(!hasPilot)('dogfood: proj-workspace-pilot (live repo)', () => {
  let previousActive;

  beforeAll(() => {
    const { WorkspaceManager } = require('../lib/workspace-manager.js');
    const manager = new WorkspaceManager(root);
    previousActive = manager.config.active_project;
    if (previousActive !== PILOT_ID) {
      manager.setActive(PILOT_ID);
    }
  });

  afterAll(() => {
    if (previousActive && previousActive !== PILOT_ID) {
      const { WorkspaceManager } = require('../lib/workspace-manager.js');
      new WorkspaceManager(root).setActive(previousActive);
    }
  });

  it('registry points active project at pilot with phase 4', () => {
    const registry = require(join(root, '.jumpstart/projects.json'));
    expect(registry.active_project).toBe(PILOT_ID);
    const pilot = registry.projects.find((p) => p.id === PILOT_ID);
    expect(pilot.phase).toBe(4);
    expect(pilot.status).toBe('phase-4');
  });

  it('challenger brief is approved in pilot specs', () => {
    const { getWorkspaceContext } = require('../lib/workspace-context.js');
    const { loadSpec, validatePhaseGate } = require('../lib/spec-loader.js');
    const context = getWorkspaceContext(root);
    const spec = loadSpec(context, 'challenger-brief.md');
    expect(spec.path).toContain(PILOT_ID);
    const gate = validatePhaseGate(spec);
    expect(gate.valid).toBe(true);
  });

  it('cross-project dependency satisfied after proj-default Phase 3', () => {
    const { WorkspaceManager } = require('../lib/workspace-manager.js');
    const manager = new WorkspaceManager(root);
    expect(manager.config.active_project).toBe(PILOT_ID);
    const result = manager.canAdvanceProject(PILOT_ID);
    expect(result.allowed).toBe(true);
    expect(result.pitCrewReview).not.toBe(true);
  });

  it('validate-deps reports zero blocked dependencies', () => {
    const { WorkspaceManager } = require('../lib/workspace-manager.js');
    const manager = new WorkspaceManager(root);
    const result = manager.validateDeps();
    expect(result.blocked_count).toBe(0);
    expect(result.dependencies.length).toBeGreaterThan(0);
    expect(result.dependencies[0].blocked).toBe(false);
    expect(result.dependencies[0].unblock_date).toBeTruthy();
  });
});
