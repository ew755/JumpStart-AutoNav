/**
 * CI-friendly dogfood checks for proj-workspace-pilot layout.
 * Uses repo paths when present; skips gracefully in sparse checkouts.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const root = join(__dirname, '..');
const pilotRoot = join(root, 'projects', 'proj-workspace-pilot');

const hasPilot = existsSync(join(pilotRoot, 'specs', 'challenger-brief.md'));

describe.skipIf(!hasPilot)('dogfood: proj-workspace-pilot (live repo)', () => {
  it('registry points active project at pilot with phase 0', () => {
    const registry = require(join(root, '.jumpstart/projects.json'));
    expect(registry.active_project).toBe('proj-workspace-pilot');
    const pilot = registry.projects.find((p) => p.id === 'proj-workspace-pilot');
    expect(pilot.phase).toBe(0);
    expect(pilot.status).toBe('phase-0');
  });

  it('challenger brief is approved in pilot specs', () => {
    const { getWorkspaceContext } = require('../lib/workspace-context.js');
    const { loadSpec, validatePhaseGate } = require('../lib/spec-loader.js');
    const context = getWorkspaceContext(root);
    const spec = loadSpec(context, 'challenger-brief.md');
    expect(spec.path).toContain('proj-workspace-pilot');
    const gate = validatePhaseGate(spec);
    expect(gate.valid).toBe(true);
  });

  it('cross-project dependency blocks Pit Crew review', () => {
    const { WorkspaceManager } = require('../lib/workspace-manager.js');
    const manager = new WorkspaceManager(root);
    const result = manager.canAdvanceProject('proj-workspace-pilot');
    expect(result.allowed).toBe(false);
    expect(result.pitCrewReview).toBe(true);
  });
});
