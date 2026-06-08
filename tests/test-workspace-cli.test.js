/**
 * CLI integration tests for bin/workspace.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runWorkspaceCli } from '../bin/workspace.js';

function createTempDir() {
  const dir = join(tmpdir(), `jumpstart-wscli-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function stubSingleProject(dir) {
  mkdirSync(join(dir, '.jumpstart', 'state'), { recursive: true });
  writeFileSync(
    join(dir, '.jumpstart', 'config.yaml'),
    'project:\n  name: Test\n  type: greenfield\n'
  );
}

let tmpDir;
let originalCwd;
let exitSpy;

beforeEach(() => {
  tmpDir = createTempDir();
  stubSingleProject(tmpDir);
  originalCwd = process.cwd();
  process.chdir(tmpDir);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(originalCwd);
  exitSpy.mockRestore();
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('runWorkspaceCli', () => {
  it('upgrade creates projects.json from single-project layout', () => {
    runWorkspaceCli(['upgrade']);
    expect(existsSync(join(tmpDir, '.jumpstart', 'projects.json'))).toBe(true);
    const registry = JSON.parse(readFileSync(join(tmpDir, '.jumpstart', 'projects.json'), 'utf8'));
    expect(registry.active_project).toBe('proj-default');
  });

  it('status auto-initializes workspace when projects.json is missing', () => {
    runWorkspaceCli(['status']);
    expect(existsSync(join(tmpDir, '.jumpstart', 'projects.json'))).toBe(true);
  });

  it('set-active switches active project', () => {
    runWorkspaceCli(['upgrade']);
    mkdirSync(join(tmpDir, 'projects/proj-x/.jumpstart/state'), { recursive: true });
    writeFileSync(join(tmpDir, 'projects/proj-x/.jumpstart/state/state.json'), '{}');

    const registry = JSON.parse(readFileSync(join(tmpDir, '.jumpstart', 'projects.json'), 'utf8'));
    registry.projects.push({
      id: 'proj-x',
      name: 'X',
      path: 'projects/proj-x',
      status: 'initializing',
      phase: null,
    });
    writeFileSync(join(tmpDir, '.jumpstart', 'projects.json'), JSON.stringify(registry, null, 2));

    runWorkspaceCli(['set-active', 'proj-x']);
    const updated = JSON.parse(readFileSync(join(tmpDir, '.jumpstart', 'projects.json'), 'utf8'));
    expect(updated.active_project).toBe('proj-x');
  });

  it('exits when workspace not initialized for set-active on single-project without upgrade', () => {
    runWorkspaceCli(['set-active', 'proj-x']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('parseFormatArg', () => {
  it('parses --format=json', async () => {
    const { parseFormatArg } = await import('../bin/workspace.js');
    expect(parseFormatArg(['report', '--format=json'])).toBe('json');
  });

  it('parses --format json with space', async () => {
    const { parseFormatArg } = await import('../bin/workspace.js');
    expect(parseFormatArg(['report', '--format', 'json'])).toBe('json');
  });

  it('defaults to markdown', async () => {
    const { parseFormatArg } = await import('../bin/workspace.js');
    expect(parseFormatArg(['report'])).toBe('markdown');
  });
});
