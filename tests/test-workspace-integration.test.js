/**
 * Integration tests for workspace migration and backwards compatibility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

import {
  detectMigrationState,
  upgradeToWorkspace,
  getProjectsPath,
} from '../lib/workspace-migration.js';
import { WorkspaceManager } from '../lib/workspace-manager.js';
import { getWorkspaceContext } from '../lib/workspace-context.js';
import { loadSpec } from '../lib/spec-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, 'fixtures', 'workspace');

function createTempDir(suffix = '') {
  const dir = join(tmpdir(), `jumpstart-ws-int-${Date.now()}${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function copyFixture(name, targetDir) {
  cpSync(join(FIXTURES_ROOT, name), targetDir, { recursive: true });
}

function writeJson(dir, relativePath, data) {
  const fullPath = join(dir, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

let tmpDir;

beforeEach(() => {
  tmpDir = createTempDir();
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('workspace migration', () => {
  it('detects single-project mode when projects.json is missing', () => {
    copyFixture('single-project', tmpDir);
    expect(detectMigrationState(tmpDir)).toBe('single-project');
  });

  it('upgrades single-project workspace and preserves root layout', () => {
    copyFixture('single-project', tmpDir);

    const result = upgradeToWorkspace(tmpDir, { workspaceId: 'test-workspace' });
    expect(result.success).toBe(true);
    expect(result.alreadyMigrated).toBe(false);
    expect(result.mode).toBe('migrated-root');
    expect(existsSync(getProjectsPath(tmpDir))).toBe(true);

    const registry = JSON.parse(readFileSync(getProjectsPath(tmpDir), 'utf8'));
    expect(registry.active_project).toBe('proj-default');
    expect(registry.projects[0].path).toBe('.');
    expect(registry.projects[0].name).toBe('Acme Portal');
    expect(registry.projects[0].phase).toBe(1);

    expect(detectMigrationState(tmpDir)).toBe('migrated-root');
  });

  it('is idempotent when upgrade runs twice', () => {
    copyFixture('single-project', tmpDir);

    const first = upgradeToWorkspace(tmpDir);
    const second = upgradeToWorkspace(tmpDir);

    expect(first.alreadyMigrated).toBe(false);
    expect(second.alreadyMigrated).toBe(true);
    expect(second.activeProject).toBe('proj-default');
  });

  it('detects multi-project layout from fixtures', () => {
    copyFixture('multi-project', tmpDir);
    expect(detectMigrationState(tmpDir)).toBe('multi-project');
  });
});

describe('backwards compatibility', () => {
  it('single-project mode loads specs from root specs/', () => {
    copyFixture('single-project', tmpDir);

    const context = getWorkspaceContext(tmpDir);
    expect(context.mode).toBe('single-project');
    expect(context.workspace).toBe(false);

    const spec = loadSpec(context, 'challenger-brief.md');
    expect(spec.path).toContain(join('specs', 'challenger-brief.md'));
    expect(spec.content).toMatch(/Challenger Brief/);
  });

  it('migrated root workspace resolves active project at repository root', () => {
    copyFixture('migrated-root', tmpDir);

    const context = getWorkspaceContext(tmpDir);
    expect(context.mode).toBe('multi-project');
    expect(context.project.project_id).toBe('proj-default');
    expect(context.project.projectPath).toBe(tmpDir);
    expect(context.config.specs_path).toBe(join(tmpDir, 'specs'));
    expect(context.state.current_phase).toBe(1);

    const spec = loadSpec(context, 'challenger-brief.md');
    expect(spec.path).toBe(join(tmpDir, 'specs', 'challenger-brief.md'));
  });

  it('multi-project workspace loads specs from active project path', () => {
    copyFixture('multi-project', tmpDir);

    const context = getWorkspaceContext(tmpDir);
    expect(context.mode).toBe('multi-project');
    expect(context.project.project_id).toBe('proj-alpha');

    const spec = loadSpec(context, 'prd.md');
    expect(spec.path).toBe(join(tmpDir, 'projects', 'proj-alpha', 'specs', 'prd.md'));
  });
});

describe('WorkspaceManager integration', () => {
  it('switches active project in multi-project workspace', () => {
    copyFixture('multi-project', tmpDir);

    const manager = new WorkspaceManager(tmpDir);
    expect(manager.getActiveProject().name).toBe('Alpha Feature');

    manager.setActive('proj-beta');
    expect(manager.config.active_project).toBe('proj-beta');

    const context = getWorkspaceContext(tmpDir);
    expect(context.project.project_id).toBe('proj-beta');
  });

  it('validates cross-project dependencies from workspace state', () => {
    copyFixture('multi-project', tmpDir);

    const manager = new WorkspaceManager(tmpDir);
    const result = manager.validateDeps();
    expect(result.valid).toBe(true);
    expect(result.dependencies).toHaveLength(1);
  });

  it('creates a nested project without breaking existing projects', () => {
    copyFixture('migrated-root', tmpDir);

    const manager = new WorkspaceManager(tmpDir);
    const result = manager.createProject({
      id: 'proj-sidecar',
      name: 'Sidecar Service',
      type: 'greenfield',
      approver: 'Casey',
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(tmpDir, 'projects', 'proj-sidecar', 'specs'))).toBe(true);
    expect(manager.config.projects).toHaveLength(2);
  });

  it('sync pull updates registry phase from project state', () => {
    copyFixture('migrated-root', tmpDir);
    writeJson(tmpDir, '.jumpstart/state/state.json', {
      current_phase: 2,
      approved_artifacts: [],
      resume_context: {},
    });

    const manager = new WorkspaceManager(tmpDir);
    manager.syncPull();

    const project = manager.config.projects.find((entry) => entry.id === 'proj-default');
    expect(project.phase).toBe(2);
    expect(project.status).toBe('phase-2');
  });
});
