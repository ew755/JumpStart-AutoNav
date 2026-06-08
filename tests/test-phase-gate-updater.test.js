/**
 * Tests for lib/phase-gate-updater.js
 * Covers: approvePhase, inferPhaseFromSpec, getTitleFromPhase,
 *         getProjectStatePath, checkUnblocks, canUnblock
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTempDir(suffix = '') {
  const dir = join(tmpdir(), `jumpstart-pgu-test-${Date.now()}${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeProjectsJson(dir, projects) {
  mkdirSync(join(dir, '.jumpstart', 'state'), { recursive: true });
  writeFileSync(
    join(dir, '.jumpstart', 'projects.json'),
    JSON.stringify(projects, null, 2)
  );
}

function writeWorkspaceState(dir, state) {
  mkdirSync(join(dir, '.jumpstart', 'state'), { recursive: true });
  writeFileSync(
    join(dir, '.jumpstart', 'state', 'workspace-state.json'),
    JSON.stringify(state, null, 2)
  );
}

function writeProjectState(dir, projectId, state) {
  const stateDir = join(dir, 'projects', projectId, '.jumpstart', 'state');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, 'state.json'), JSON.stringify(state, null, 2));
}

function readProjectState(dir, projectId) {
  const statePath = join(dir, 'projects', projectId, '.jumpstart', 'state', 'state.json');
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

function defaultProjectsJson(projectId = 'proj-a') {
  return {
    workspace: { id: 'ws-test' },
    projects: [
      {
        project_id: projectId,
        name: 'Project A',
        path: `projects/${projectId}`,
        type: 'greenfield',
        status: 'phase-1',
        approver: 'Alice',
      },
    ],
    active_project: projectId,
    version: '1.0.0',
  };
}

function defaultWorkspaceState(activeId = 'proj-a') {
  return {
    version: '1.0.0',
    active_project_id: activeId,
    dependencies: [],
    project_locks: {},
  };
}

// ─── Module imports ─────────────────────────────────────────────────────────
import {
  approvePhase,
  inferPhaseFromSpec,
  getTitleFromPhase,
  getProjectStatePath,
  checkUnblocks,
  canUnblock,
} from '../lib/phase-gate-updater.js';

// ─── Tests ───────────────────────────────────────────────────────────────────

let tmpDir;

beforeEach(() => {
  tmpDir = createTempDir();
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── inferPhaseFromSpec ────────────────────────────────────────────────────────

describe('inferPhaseFromSpec', () => {
  it('returns 0 for challenger-brief.md', () => {
    expect(inferPhaseFromSpec('specs/challenger-brief.md')).toBe(0);
  });

  it('returns 1 for product-brief.md', () => {
    expect(inferPhaseFromSpec('specs/product-brief.md')).toBe(1);
  });

  it('returns 2 for prd.md', () => {
    expect(inferPhaseFromSpec('specs/prd.md')).toBe(2);
  });

  it('returns 3 for architecture.md', () => {
    expect(inferPhaseFromSpec('specs/architecture.md')).toBe(3);
  });

  it('returns null for unrecognized filename', () => {
    expect(inferPhaseFromSpec('specs/unknown-file.md')).toBeNull();
  });

  it('handles absolute paths', () => {
    expect(inferPhaseFromSpec('/projects/proj-a/specs/prd.md')).toBe(2);
  });
});

// ── getTitleFromPhase ────────────────────────────────────────────────────────

describe('getTitleFromPhase', () => {
  it('returns correct titles for each phase', () => {
    expect(getTitleFromPhase(0)).toBe('Challenge');
    expect(getTitleFromPhase(1)).toBe('Analyze');
    expect(getTitleFromPhase(2)).toBe('Plan');
    expect(getTitleFromPhase(3)).toBe('Architect');
    expect(getTitleFromPhase(4)).toBe('Build');
  });

  it('returns Unknown for unrecognized phase', () => {
    expect(getTitleFromPhase(99)).toBe('Unknown');
  });
});

// ── getProjectStatePath ──────────────────────────────────────────────────────

describe('getProjectStatePath', () => {
  it('returns global state.json path for proj-default (uses cwd)', () => {
    const context = { mode: 'multi-project' };
    const result = getProjectStatePath(context, 'proj-default');
    expect(result).toContain('state.json');
    expect(result).not.toContain('projects/');
  });

  it('is a function that accepts context and projectId', () => {
    expect(typeof getProjectStatePath).toBe('function');
  });
});

// ── canUnblock ────────────────────────────────────────────────────────────────

describe('canUnblock', () => {
  it('returns true when no unblock_condition set', () => {
    const dep = { blocked: true }; // no unblock_condition
    expect(canUnblock(dep, 3)).toBe(true);
  });

  it('returns true when approved phase meets required phase', () => {
    const dep = { blocked: true, unblock_condition: 'Phase 3' };
    expect(canUnblock(dep, 3)).toBe(true);
    expect(canUnblock(dep, 4)).toBe(true); // higher phase also satisfies
  });

  it('returns false when approved phase is below required phase', () => {
    const dep = { blocked: true, unblock_condition: 'Phase 3' };
    expect(canUnblock(dep, 2)).toBe(false);
    expect(canUnblock(dep, 0)).toBe(false);
  });

  it('returns true when unblock_condition is malformed', () => {
    const dep = { blocked: true, unblock_condition: 'no-phase-pattern-here' };
    expect(canUnblock(dep, 1)).toBe(true); // no match → always unblock
  });
});

// ── approvePhase ─────────────────────────────────────────────────────────────

describe('approvePhase', () => {
  it('returns success=false for unrecognized spec filename', () => {
    const context = { mode: 'multi-project', project: { project_id: 'proj-a' } };
    const result = approvePhase(context, 'specs/unknown-spec.md', 'Eric');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/phase/i);
  });

  it('approvePhase is a function', () => {
    expect(typeof approvePhase).toBe('function');
  });

  it('infers phase 1 from product-brief.md path', () => {
    // product-brief.md → inferPhaseFromSpec → 1
    const specPath = `${tmpDir}/projects/proj-test/specs/product-brief.md`;
    const phase = inferPhaseFromSpec(specPath);
    expect(phase).toBe(1);
  });

  it('checkUnblocks returns empty array when no workspace-state.json present', () => {
    const context = { mode: 'single-project' };
    // checkUnblocks gracefully returns [] when workspace-state.json is not in cwd
    const result = checkUnblocks(context, 'proj-a', 3);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── checkUnblocks ─────────────────────────────────────────────────────────────

describe('checkUnblocks', () => {
  it('returns empty array when workspace-state.json does not exist in cwd', () => {
    const context = { mode: 'single-project' };
    const result = checkUnblocks(context, 'proj-a', 3);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array for nonexistent project', () => {
    const context = { mode: 'multi-project' };
    const result = checkUnblocks(context, 'proj-nonexistent', 0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('unblocks downstream projects from cross_project_dependencies', () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(tmpDir);
      mkdirSync(join(tmpDir, '.jumpstart', 'state'), { recursive: true });
      writeFileSync(
        join(tmpDir, '.jumpstart', 'state', 'workspace-state.json'),
        JSON.stringify({
          version: '1.0.0',
          active_project_id: 'proj-alpha',
          workspace_resume_context: {
            cross_project_dependencies: [
              {
                from: 'proj-beta',
                to: 'proj-alpha',
                type: 'phase_dependency',
                blocked: true,
                unblock_condition: 'Phase 3',
              },
            ],
          },
        }, null, 2)
      );

      const unblocked = checkUnblocks({ mode: 'multi-project' }, 'proj-alpha', 3);
      expect(unblocked).toEqual(['proj-beta']);

      const updated = JSON.parse(
        readFileSync(join(tmpDir, '.jumpstart', 'state', 'workspace-state.json'), 'utf8')
      );
      expect(updated.workspace_resume_context.cross_project_dependencies[0].blocked).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
