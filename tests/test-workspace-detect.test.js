/**
 * Path-based workspace project detection and active-project switching.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  detectProjectFromPath,
  findProjectsForFilePath,
  shouldGuardRelativePath,
} = require('../lib/workspace-detect.js');
const { WorkspaceManager } = require('../lib/workspace-manager.js');
const { runWorkspaceCli } = require('../bin/workspace.js');

function createTempDir() {
  const dir = join(tmpdir(), `jumpstart-detect-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function scaffoldHub(hubRoot, { activeProject = 'proj-pilot', projects = null } = {}) {
  const defaultProjects = projects || [
    { id: 'proj-default', name: 'Hub Default', path: '.', status: 'phase-2' },
    {
      id: 'proj-pilot',
      name: 'Pilot',
      path: 'projects/pilot',
      status: 'phase-1',
    },
  ];

  writeJson(join(hubRoot, '.jumpstart', 'projects.json'), {
    workspace: { id: 'detect-test', enabled: true },
    projects: defaultProjects,
    active_project: activeProject,
    settings: {},
    version: '1.0.0',
  });

  writeJson(join(hubRoot, '.jumpstart', 'state', 'workspace-state.json'), {
    active_project_id: activeProject,
    workspace_resume_context: {},
  });

  mkdirSync(join(hubRoot, 'specs'), { recursive: true });
  mkdirSync(join(hubRoot, 'projects', 'pilot', 'specs'), { recursive: true });
  mkdirSync(join(hubRoot, 'projects', 'pilot', 'src'), { recursive: true });
}

describe('workspace-detect', () => {
  let hubRoot;

  beforeEach(() => {
    hubRoot = createTempDir();
    scaffoldHub(hubRoot);
  });

  afterEach(() => {
    rmSync(hubRoot, { recursive: true, force: true });
  });

  it('detects hub-root specs as proj-default when pilot is active', () => {
    const result = detectProjectFromPath({
      cwd: hubRoot,
      filePath: join(hubRoot, 'specs', 'prd.md'),
    });

    expect(result.action).toBe('switch');
    expect(result.active_project_id).toBe('proj-pilot');
    expect(result.suggested_project_id).toBe('proj-default');
    expect(result.ambiguous).toBe(false);
  });

  it('detects nested monorepo project with longest-prefix wins', () => {
    const result = detectProjectFromPath({
      cwd: hubRoot,
      filePath: join(hubRoot, 'projects', 'pilot', 'specs', 'prd.md'),
    });

    expect(result.action).toBe('already_active');
    expect(result.detected_project_id).toBe('proj-pilot');
  });

  it('prefers deeper project root over proj-default hub root', () => {
    const { matches, ambiguous } = findProjectsForFilePath(
      hubRoot,
      join(hubRoot, 'projects', 'pilot', 'src', 'index.js')
    );

    expect(ambiguous).toBe(false);
    expect(matches).toHaveLength(1);
    expect(matches[0].project_id).toBe('proj-pilot');
  });

  it('reports sibling-linked mode without requiring hub cwd', () => {
    const parent = createTempDir();
    const hub = join(parent, 'hub');
    const sibling = join(parent, 'frontend');
    mkdirSync(hub, { recursive: true });
    mkdirSync(join(sibling, 'specs'), { recursive: true });

    writeJson(join(hub, '.jumpstart', 'projects.json'), {
      workspace: { id: 'detect-test', enabled: true },
      projects: [{ id: 'proj-frontend', name: 'Frontend', path: '../frontend' }],
      active_project: 'proj-frontend',
      settings: {},
    });
    writeJson(join(hub, '.jumpstart', 'state', 'workspace-state.json'), {
      active_project_id: 'proj-frontend',
      workspace_resume_context: {},
    });
    writeJson(join(sibling, '.jumpstart', 'hub-link.json'), {
      version: '1.0.0',
      hub_root: '../hub',
      project_id: 'proj-frontend',
      project_name: 'Frontend',
    });

    const result = detectProjectFromPath({
      cwd: sibling,
      filePath: join(sibling, 'specs', 'prd.md'),
    });

    expect(result.action).toBe('sibling_linked');
    expect(result.detected_project_id).toBe('proj-frontend');

    rmSync(parent, { recursive: true, force: true });
  });

  it('flags ambiguous when two projects share the same root depth', () => {
    writeJson(join(hubRoot, '.jumpstart', 'projects.json'), {
      workspace: { id: 'detect-test', enabled: true },
      projects: [
        { id: 'proj-a', name: 'A', path: 'projects/shared' },
        { id: 'proj-b', name: 'B', path: 'projects/shared' },
      ],
      active_project: 'proj-a',
      settings: {},
    });

    const result = detectProjectFromPath({
      cwd: hubRoot,
      filePath: join(hubRoot, 'projects', 'shared', 'specs', 'x.md'),
    });

    expect(result.action).toBe('ambiguous');
    expect(result.candidates).toHaveLength(2);
  });

  it('shouldGuardRelativePath matches project-scoped trees only', () => {
    expect(shouldGuardRelativePath('specs/prd.md')).toBe(true);
    expect(shouldGuardRelativePath('projects/pilot/src/foo.js')).toBe(true);
    expect(shouldGuardRelativePath('README.md')).toBe(false);
    expect(shouldGuardRelativePath('.github/hooks/foo.js')).toBe(false);
  });

  it('CLI detect --auto switches active project', () => {
    const logs = [];
    const errors = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalExit = process.exit;

    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => errors.push(args.join(' '));
    process.exit = () => {};

    const prevCwd = process.cwd();
    process.chdir(hubRoot);

    try {
      runWorkspaceCli(['detect', 'specs/prd.md', '--auto']);
      const manager = new WorkspaceManager(hubRoot);
      expect(manager.config.active_project).toBe('proj-default');
    } finally {
      process.chdir(prevCwd);
      console.log = originalLog;
      console.error = originalError;
      process.exit = originalExit;
    }

    expect(logs.some((line) => line.includes('proj-default'))).toBe(true);
  });
});
