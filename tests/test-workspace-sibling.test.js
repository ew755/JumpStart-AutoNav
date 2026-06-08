/**
 * Tests for lib/workspace-project-paths.js and link-sibling registration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  findProjectBySpecPath,
  inferOwnerProjectFromSpec,
  isSiblingPath,
  toPosixRelative,
} = require('../lib/workspace-project-paths.js');
const { WorkspaceManager } = require('../lib/workspace-manager.js');
const { inferOwnerProject } = require('../lib/spec-loader.js');

function createProgramDir() {
  const dir = join(tmpdir(), `jumpstart-sibling-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function scaffoldHub(hubRoot) {
  writeJson(join(hubRoot, '.jumpstart', 'projects.json'), {
    workspace: { id: 'hub', enabled: true },
    projects: [
      {
        id: 'proj-frontend',
        name: 'Frontend',
        path: '../frontend',
        status: 'phase-0',
        phase: 0,
        config_path: '../frontend/.jumpstart/config.yaml',
      },
    ],
    active_project: 'proj-frontend',
    settings: {},
    version: '1.0.0',
  });
  writeJson(join(hubRoot, '.jumpstart', 'state', 'workspace-state.json'), {
    version: '1.0.0',
    active_project_id: 'proj-frontend',
    workspace_resume_context: {},
  });
}

function scaffoldSibling(repoRoot, name) {
  mkdirSync(join(repoRoot, 'specs'), { recursive: true });
  mkdirSync(join(repoRoot, '.jumpstart', 'state'), { recursive: true });
  writeFileSync(
    join(repoRoot, '.jumpstart', 'config.yaml'),
    `project:\n  name: ${name}\n  type: greenfield\n`,
    'utf8'
  );
  writeJson(join(repoRoot, '.jumpstart', 'state', 'state.json'), { current_phase: 0 });
  writeFileSync(join(repoRoot, 'specs', 'prd.md'), '# PRD\n', 'utf8');
}

let programDir;

beforeEach(() => {
  programDir = createProgramDir();
});

afterEach(() => {
  if (programDir && existsSync(programDir)) {
    rmSync(programDir, { recursive: true, force: true });
  }
});

describe('workspace-project-paths', () => {
  it('detects sibling relative paths', () => {
    expect(isSiblingPath('../frontend')).toBe(true);
    expect(isSiblingPath('projects/proj-a')).toBe(false);
  });

  it('findProjectBySpecPath resolves sibling repo specs', () => {
    const hub = join(programDir, 'hub');
    const frontend = join(programDir, 'frontend');
    mkdirSync(hub, { recursive: true });
    scaffoldHub(hub);
    scaffoldSibling(frontend, 'Frontend');

    const specPath = join(frontend, 'specs', 'prd.md');
    expect(findProjectBySpecPath(hub, specPath)).toBe('proj-frontend');
    expect(inferOwnerProjectFromSpec(specPath, hub)).toBe('proj-frontend');
    expect(inferOwnerProject(specPath, hub)).toBe('proj-frontend');
  });

  it('toPosixRelative produces stable registry paths', () => {
    const hub = join(programDir, 'hub');
    const sibling = join(programDir, 'frontend');
    mkdirSync(hub, { recursive: true });
    mkdirSync(sibling, { recursive: true });
    const rel = toPosixRelative(hub, sibling);
    expect(rel).toBe('../frontend');
  });
});

describe('WorkspaceManager.linkSiblingProject', () => {
  it('registers sibling with --init, IDE stubs, and sets active', () => {
    const hub = join(programDir, 'hub');
    const frontend = join(programDir, 'frontend');
    mkdirSync(hub, { recursive: true });
    mkdirSync(frontend, { recursive: true });

    writeJson(join(hub, '.jumpstart', 'projects.json'), {
      workspace: { id: 'hub', enabled: true },
      projects: [],
      active_project: null,
      settings: {},
      version: '1.0.0',
    });
    writeJson(join(hub, '.jumpstart', 'state', 'workspace-state.json'), {
      version: '1.0.0',
      active_project_id: null,
      workspace_resume_context: {},
    });

    const manager = new WorkspaceManager(hub);
    const result = manager.linkSiblingProject([
      '--id=proj-frontend',
      '--name=Frontend',
      '--path=../frontend',
      '--init',
      '--set-active',
    ]);

    expect(result.success).toBe(true);
    expect(result.external).toBe(true);
    expect(result.ide_files?.length).toBeGreaterThan(0);
    expect(existsSync(join(frontend, 'specs'))).toBe(true);
    expect(existsSync(join(frontend, '.jumpstart', 'config.yaml'))).toBe(true);
    expect(existsSync(join(frontend, '.jumpstart', 'hub-link.json'))).toBe(true);
    expect(existsSync(join(frontend, '.jumpstart', 'SIBLING-WORKSPACE.md'))).toBe(true);
    expect(existsSync(join(frontend, '.cursor', 'rules', 'jumpstart-sibling.mdc'))).toBe(true);
    expect(existsSync(join(hub, '.cursor', 'rules', 'jumpstart-workspace.mdc'))).toBe(true);
    expect(manager.config.active_project).toBe('proj-frontend');

    const { getWorkspaceContext } = require('../lib/workspace-context.js');
    const siblingCtx = getWorkspaceContext(frontend);
    expect(siblingCtx.mode).toBe('sibling-linked');
    expect(siblingCtx.project.project_id).toBe('proj-frontend');
  });

  it('rejects missing sibling directory', () => {
    const hub = join(programDir, 'hub');
    mkdirSync(hub, { recursive: true });
    writeJson(join(hub, '.jumpstart', 'projects.json'), {
      workspace: { id: 'hub', enabled: true },
      projects: [],
      active_project: null,
      settings: {},
      version: '1.0.0',
    });
    writeJson(join(hub, '.jumpstart', 'state', 'workspace-state.json'), {
      version: '1.0.0',
      workspace_resume_context: {},
    });

    const manager = new WorkspaceManager(hub);
    const result = manager.linkSiblingProject([
      '--id=proj-missing',
      '--name=Missing',
      '--path=../does-not-exist',
    ]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});
