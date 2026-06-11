/**
 * Tests for lib/workspace-context.js
 * Covers: detectWorkspaceMode, loadActiveProject, loadProjectConfig,
 *         loadProjectState, mergeConfigs, getWorkspaceContext, printContext
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTempDir(suffix = '') {
  const dir = join(tmpdir(), `jumpstart-wctx-test-${Date.now()}${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeProjects(dir, projects) {
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
  const projectStateDir = join(dir, 'projects', projectId, '.jumpstart', 'state');
  mkdirSync(projectStateDir, { recursive: true });
  writeFileSync(join(projectStateDir, 'state.json'), JSON.stringify(state, null, 2));
}

function writeProjectConfig(dir, projectId, content) {
  const configDir = join(dir, 'projects', projectId, '.jumpstart');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'config.yaml'), content);
}

function defaultProjectsJson(activeId = 'proj-a') {
  return {
    workspace: { id: 'ws-test', enabled: true, description: 'Test workspace' },
    projects: [
      {
        project_id: activeId,
        name: 'Project A',
        path: `projects/${activeId}`,
        type: 'greenfield',
        status: 'phase-1',
        approver: 'Alice',
      },
    ],
    active_project: activeId,
    settings: {},
    version: '1.0.0',
  };
}

function defaultWorkspaceState(activeId = 'proj-a') {
  return {
    version: '1.0.0',
    active_project_id: activeId,
    workspace_resume_context: {},
    project_locks: {},
    last_updated: null,
  };
}

// ─── Module imports ─────────────────────────────────────────────────────────
// Vitest handles CJS/ESM interop — module.exports keys become named exports
import {
  detectWorkspaceMode,
  loadActiveProject,
  loadProjectConfig,
  loadProjectState,
  mergeConfigs,
  getWorkspaceContext,
  printContext,
} from '../lib/workspace-context.js';

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

// ── detectWorkspaceMode ──────────────────────────────────────────────────────

describe('detectWorkspaceMode', () => {
  it('returns false when projects.json does not exist', () => {
    expect(detectWorkspaceMode(tmpDir)).toBe(false);
  });

  it('returns true when projects.json exists', () => {
    writeProjects(tmpDir, defaultProjectsJson());
    expect(detectWorkspaceMode(tmpDir)).toBe(true);
  });

  it('returns false for a directory with .jumpstart but no projects.json', () => {
    mkdirSync(join(tmpDir, '.jumpstart'), { recursive: true });
    expect(detectWorkspaceMode(tmpDir)).toBe(false);
  });
});

// ── loadActiveProject ────────────────────────────────────────────────────────

describe('loadActiveProject', () => {
  it('resolves from registry alone when workspace-state.json is missing', () => {
    writeProjects(tmpDir, defaultProjectsJson());
    // No workspace-state.json — registry is the single source of truth.
    const result = loadActiveProject(tmpDir);
    expect(result).not.toBeNull();
    expect(result.project_id).toBe('proj-a');
  });

  it('returns null when projects.json is missing', () => {
    writeWorkspaceState(tmpDir, defaultWorkspaceState());
    const result = loadActiveProject(tmpDir);
    expect(result).toBeNull();
  });

  it('returns active project metadata when both files exist', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));

    const result = loadActiveProject(tmpDir);
    expect(result).not.toBeNull();
    expect(result.project_id).toBe('proj-a');
    expect(result.name).toBe('Project A');
    expect(result.rootDir).toBe(tmpDir);
  });

  it('reconciles to registry when workspace-state active id is invalid', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-missing'));

    const result = loadActiveProject(tmpDir);
    expect(result).not.toBeNull();
    expect(result.project_id).toBe('proj-a');
  });

  it('uses the registry as single source of truth when legacy state diverges', () => {
    writeProjects(tmpDir, {
      ...defaultProjectsJson('proj-b'),
      active_project: 'proj-b',
      projects: [
        {
          project_id: 'proj-a',
          name: 'Project A',
          path: 'projects/proj-a',
          type: 'greenfield',
          status: 'phase-1',
          approver: 'Alice',
        },
        {
          project_id: 'proj-b',
          name: 'Project B',
          path: 'projects/proj-b',
          type: 'greenfield',
          status: 'phase-0',
          approver: 'Bob',
        },
      ],
    });
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));

    const result = loadActiveProject(tmpDir);
    expect(result.project_id).toBe('proj-b');

    // Registry wins; loading must not rewrite workspace-state.json.
    const stateOnDisk = JSON.parse(
      readFileSync(join(tmpDir, '.jumpstart', 'state', 'workspace-state.json'), 'utf8')
    );
    expect(stateOnDisk).toEqual(defaultWorkspaceState('proj-a'));
  });

  it('includes derived projectPath in returned object', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));

    const result = loadActiveProject(tmpDir);
    expect(result.projectPath).toBe(join(tmpDir, 'projects/proj-a'));
  });
});

// ── loadProjectState ─────────────────────────────────────────────────────────

describe('loadProjectState', () => {
  it('returns default empty state when state.json does not exist', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));
    const project = loadActiveProject(tmpDir);

    const state = loadProjectState(project, tmpDir);
    expect(state.current_phase).toBeNull();
    expect(state.approved_artifacts).toEqual([]);
  });

  it('loads existing project state correctly', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));
    writeProjectState(tmpDir, 'proj-a', {
      current_phase: 2,
      approved_artifacts: ['specs/challenger-brief.md'],
      resume_context: { tldr: 'Phase 2 in progress' },
    });

    const project = loadActiveProject(tmpDir);
    const state = loadProjectState(project, tmpDir);
    expect(state.current_phase).toBe(2);
    expect(state.approved_artifacts).toContain('specs/challenger-brief.md');
    expect(state.resume_context.tldr).toBe('Phase 2 in progress');
  });
});

// ── loadProjectConfig ────────────────────────────────────────────────────────

describe('loadProjectConfig', () => {
  it('returns null when config.yaml does not exist', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));
    const project = loadActiveProject(tmpDir);

    const config = loadProjectConfig(project, tmpDir);
    expect(config).toBeNull();
  });

  it('returns config object with path and project metadata', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));
    writeProjectConfig(tmpDir, 'proj-a', 'project:\n  name: Project A\n  approver: Alice\n');
    const project = loadActiveProject(tmpDir);

    const config = loadProjectConfig(project, tmpDir);
    expect(config).not.toBeNull();
    expect(config.project_id).toBe('proj-a');
    expect(config.project_name).toBe('Project A');
    expect(config.project_approver).toBe('Alice');
    expect(config.parsed).toBeDefined();
    expect(config.parsed.project.name).toBe('Project A');
    expect(config.workflow).toBeDefined();
  });
});

// ── mergeConfigs ─────────────────────────────────────────────────────────────

describe('mergeConfigs', () => {
  it('returns merged config with correct path structure', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));
    writeProjectConfig(tmpDir, 'proj-a', 'project:\n  name: proj-a\n');
    const project = loadActiveProject(tmpDir);

    const merged = mergeConfigs(project);
    expect(merged.active_project_id).toBe('proj-a');
    expect(merged.specs_path).toContain('specs');
    expect(merged.src_path).toContain('src');
    expect(merged.tests_path).toContain('tests');
    expect(merged.state_path).toContain('state');
  });
});

// ── getWorkspaceContext ───────────────────────────────────────────────────────

describe('getWorkspaceContext', () => {
  it('returns single-project mode when no projects.json', () => {
    const result = getWorkspaceContext(tmpDir);
    expect(result.mode).toBe('single-project');
    expect(result.workspace).toBe(false);
    expect(result.project).toBeNull();
  });

  it('returns workspace-no-active when registry has no active project', () => {
    writeProjects(tmpDir, { ...defaultProjectsJson('proj-a'), active_project: null });
    const result = getWorkspaceContext(tmpDir);
    expect(result.mode).toBe('workspace-no-active');
    expect(result.workspace).toBe(true);
    expect(result.project).toBeNull();
  });

  it('resolves active project from the registry even without workspace-state.json', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    // No workspace-state.json — registry alone is the source of truth.
    const result = getWorkspaceContext(tmpDir);
    expect(result.mode).toBe('multi-project');
    expect(result.project.project_id).toBe('proj-a');
  });

  it('returns multi-project mode with full context when all files present', () => {
    writeProjects(tmpDir, defaultProjectsJson('proj-a'));
    writeWorkspaceState(tmpDir, defaultWorkspaceState('proj-a'));
    writeProjectState(tmpDir, 'proj-a', { current_phase: 1, approved_artifacts: [] });

    const result = getWorkspaceContext(tmpDir);
    expect(result.mode).toBe('multi-project');
    expect(result.workspace).toBe(true);
    expect(result.project.project_id).toBe('proj-a');
    expect(result.state.current_phase).toBe(1);
    expect(result.config.specs_path).toBeTruthy();
  });
});

// ── printContext ─────────────────────────────────────────────────────────────

describe('printContext', () => {
  it('does not throw for single-project context', () => {
    expect(() => printContext({ mode: 'single-project' })).not.toThrow();
  });

  it('does not throw for workspace-no-active context', () => {
    expect(() => printContext({ mode: 'workspace-no-active' })).not.toThrow();
  });

  it('does not throw for multi-project context', () => {
    const fakeContext = {
      mode: 'multi-project',
      project: { project_id: 'proj-a', name: 'Project A' },
      state: { current_phase: 1 },
      config: { specs_path: '/fake/specs' },
    };
    expect(() => printContext(fakeContext)).not.toThrow();
  });
});
