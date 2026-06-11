/**
 * Tests for workspace sync validation, push backup, and remove-project.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { WorkspaceManager } from '../lib/workspace-manager.js';

function createTempDir() {
  const dir = join(tmpdir(), `jumpstart-wssync-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeRegistry(dir, config, state) {
  mkdirSync(join(dir, '.jumpstart', 'state'), { recursive: true });
  writeFileSync(join(dir, '.jumpstart', 'projects.json'), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, '.jumpstart', 'state', 'workspace-state.json'), JSON.stringify(state, null, 2));
}

function writeProjectState(dir, projectId, state, projectPath = `projects/${projectId}`) {
  const stateDir = join(dir, projectPath, '.jumpstart', 'state');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, 'state.json'), JSON.stringify(state, null, 2));
}

let tmpDir;

beforeEach(() => {
  tmpDir = createTempDir();
  writeRegistry(
    tmpDir,
    {
      workspace: { id: 'ws-test', enabled: true },
      projects: [
        {
          id: 'proj-a',
          name: 'A',
          path: 'projects/proj-a',
          status: 'phase-2',
          phase: 2,
        },
        {
          id: 'proj-b',
          name: 'B',
          path: 'projects/proj-b',
          status: 'phase-0',
          phase: 0,
        },
      ],
      active_project: 'proj-a',
      settings: {},
    },
    {
      active_project_id: 'proj-a',
      workspace_resume_context: { cross_project_dependencies: [] },
      project_locks: {},
    }
  );
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('validateSync', () => {
  it('returns no drift when registry and state match', () => {
    writeProjectState(tmpDir, 'proj-a', { current_phase: 2 });
    writeProjectState(tmpDir, 'proj-b', { current_phase: 0 });

    const manager = new WorkspaceManager(tmpDir);
    expect(manager.validateSync()).toHaveLength(0);
  });

  it('detects registry_ahead drift', () => {
    writeProjectState(tmpDir, 'proj-a', { current_phase: 1 });

    const manager = new WorkspaceManager(tmpDir);
    const drifts = manager.validateSync('proj-a');
    expect(drifts.some((d) => d.type === 'registry_ahead')).toBe(true);
    expect(drifts[0].severity).toBe('error');
  });

  it('detects state_ahead drift', () => {
    writeProjectState(tmpDir, 'proj-a', { current_phase: 3 });

    const manager = new WorkspaceManager(tmpDir);
    const drifts = manager.validateSync('proj-a');
    expect(drifts.some((d) => d.type === 'state_ahead')).toBe(true);
  });

  it('detects missing_state', () => {
    const manager = new WorkspaceManager(tmpDir);
    const drifts = manager.validateSync('proj-a');
    expect(drifts.some((d) => d.type === 'missing_state')).toBe(true);
    expect(drifts.find((d) => d.type === 'missing_state').severity).toBe('warn');
  });

  it('flags premature_phase when the Phase Gate Approval section is not approved', () => {
    writeProjectState(tmpDir, 'proj-a', { current_phase: 2, status: 'phase-2' });
    const specsDir = join(tmpDir, 'projects/proj-a/specs');
    mkdirSync(specsDir, { recursive: true });
    // Checked box and "Approved by:" outside the gate section must NOT count.
    writeFileSync(
      join(specsDir, 'prd.md'),
      [
        '# PRD',
        '- [x] some unrelated done item',
        'Approved by: mentioned in prose',
        '',
        '## Phase Gate Approval',
        '- [ ] Requirements reviewed',
        '**Approved by:** Pending',
        '**Approval date:** Pending',
      ].join('\n')
    );

    const manager = new WorkspaceManager(tmpDir);
    const drifts = manager.validateSync('proj-a');
    expect(drifts.some((d) => d.type === 'premature_phase')).toBe(true);
  });

  it('accepts a properly approved Phase Gate Approval section', () => {
    writeProjectState(tmpDir, 'proj-a', { current_phase: 2, status: 'phase-2' });
    const specsDir = join(tmpDir, 'projects/proj-a/specs');
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(
      join(specsDir, 'prd.md'),
      [
        '# PRD',
        '',
        '## Phase Gate Approval',
        '- [x] Requirements reviewed',
        '- [x] Scope agreed',
        '**Approved by:** Jane Smith',
        '**Approval date:** 2026-06-10',
      ].join('\n')
    );

    const manager = new WorkspaceManager(tmpDir);
    const drifts = manager.validateSync('proj-a');
    expect(drifts.some((d) => d.type === 'premature_phase')).toBe(false);
  });
});

describe('syncPush backup', () => {
  it('backs up existing state before push and preserves resume_context', () => {
    writeProjectState(tmpDir, 'proj-a', {
      current_phase: 1,
      approved_artifacts: [{ artifact: 'challenger-brief.md', phase: 0 }],
      resume_context: { tldr: 'keep me' },
    });

    const manager = new WorkspaceManager(tmpDir);
    manager.config.projects.find((p) => p.id === 'proj-a').phase = 2;
    manager.config.projects.find((p) => p.id === 'proj-a').status = 'phase-2';

    const result = manager.syncPush('proj-a', true);
    expect(result.updated).toBe(1);
    expect(result.backups).toHaveLength(1);
    expect(existsSync(result.backups[0].backup)).toBe(true);

    const pushed = JSON.parse(
      readFileSync(join(tmpDir, 'projects/proj-a/.jumpstart/state/state.json'), 'utf8')
    );
    expect(pushed.current_phase).toBe(2);
    expect(pushed.resume_context.tldr).toBe('keep me');
    expect(pushed.approved_artifacts).toHaveLength(1);
  });
});

describe('removeProject', () => {
  beforeEach(() => {
    writeProjectState(tmpDir, 'proj-a', { current_phase: 1 });
    writeProjectState(tmpDir, 'proj-b', { current_phase: 0 });
    mkdirSync(join(tmpDir, 'projects/proj-b/src'), { recursive: true });
  });

  it('requires --confirm', () => {
    const manager = new WorkspaceManager(tmpDir);
    const result = manager.removeProject('proj-b', { confirm: false });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/confirm/i);
  });

  it('removes project from registry and keeps files by default', () => {
    const manager = new WorkspaceManager(tmpDir);
    const result = manager.removeProject('proj-b', { confirm: true });
    expect(result.success).toBe(true);
    expect(manager.config.projects).toHaveLength(1);
    expect(existsSync(join(tmpDir, 'projects/proj-b'))).toBe(true);
  });

  it('deletes project files when deleteFiles is set', () => {
    const manager = new WorkspaceManager(tmpDir);
    const result = manager.removeProject('proj-b', { confirm: true, deleteFiles: true });
    expect(result.success).toBe(true);
    expect(result.deletedPath).toBe('projects/proj-b');
    expect(existsSync(join(tmpDir, 'projects/proj-b'))).toBe(false);
  });

  it('blocks removal of active project when other projects exist', () => {
    const manager = new WorkspaceManager(tmpDir);
    const result = manager.removeProject('proj-a', { confirm: true });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/active project/i);
  });
});
