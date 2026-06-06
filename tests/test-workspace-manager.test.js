/**
 * Tests for lib/workspace-manager.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { WorkspaceManager } from '../lib/workspace-manager.js';

function createTempDir() {
  const dir = join(tmpdir(), `jumpstart-wsmgr-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeWorkspaceFiles(dir, config, state) {
  mkdirSync(join(dir, '.jumpstart', 'state'), { recursive: true });
  writeFileSync(join(dir, '.jumpstart', 'projects.json'), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, '.jumpstart', 'state', 'workspace-state.json'), JSON.stringify(state, null, 2));
}

describe('WorkspaceManager', () => {
  let tmpDir;
  let manager;

  beforeEach(() => {
    tmpDir = createTempDir();

    const config = {
      workspace: { id: 'test-ws', enabled: true },
      projects: [
        { id: 'proj-a', name: 'Project A', path: 'proj-a', status: 'phase-1', phase: 1, locked: false },
        { id: 'proj-b', name: 'Project B', path: 'proj-b', status: 'phase-0', phase: null, locked: false },
      ],
      active_project: 'proj-a',
      settings: { enforce_sequential_phases: true, allow_parallel_projects: false },
    };

    const state = {
      version: '1.0.0',
      active_project_id: 'proj-a',
      workspace_resume_context: {
        tldr: 'Test workspace',
        cross_project_dependencies: [
          { from: 'proj-a', to: 'proj-b', type: 'data_dependency' },
        ],
        workspace_tokens_used: 5000,
        workspace_token_budget: 100000,
      },
      project_locks: {},
    };

    writeWorkspaceFiles(tmpDir, config, state);
    manager = new WorkspaceManager(tmpDir);
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Project Selection', () => {
    it('gets active project', () => {
      const project = manager.getActiveProject();
      expect(project.id).toBe('proj-a');
      expect(project.phase).toBe(1);
    });

    it('switches active project', () => {
      manager.setActive('proj-b');
      expect(manager.config.active_project).toBe('proj-b');
      expect(manager.state.active_project_id).toBe('proj-b');
    });

    it('throws when switching to non-existent project', () => {
      expect(() => manager.setActive('proj-invalid')).toThrow('Project not found');
    });
  });

  describe('Dependency Validation', () => {
    it('validates valid cross-project dependencies', () => {
      const result = manager.validateDeps();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing projects in dependencies', () => {
      manager.state.workspace_resume_context.cross_project_dependencies.push({
        from: 'proj-invalid',
        to: 'proj-a',
        type: 'unknown_dependency',
      });

      const result = manager.validateDeps();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Token Tracking', () => {
    it('returns workspace token usage', () => {
      expect(manager.getTotalTokens()).toBe(5000);
    });

    it('tracks usage below budget', () => {
      expect(manager.getTotalTokens()).toBeLessThan(
        manager.state.workspace_resume_context.workspace_token_budget
      );
    });
  });

  describe('Phase Tracking', () => {
    it('gets project phase', () => {
      expect(manager.getProjectPhase('proj-a')).toBe(1);
      expect(manager.getProjectPhase('proj-b')).toBeNull();
    });

    it('returns null for non-existent project', () => {
      expect(manager.getProjectPhase('proj-invalid')).toBeNull();
    });
  });

  describe('Project Locking', () => {
    it('locks and unlocks a project', () => {
      manager.lockProject('proj-a', 'Architect');
      expect(manager.isProjectLocked('proj-a')).toBe(true);

      manager.unlockProject('proj-a');
      expect(manager.isProjectLocked('proj-a')).toBe(false);
    });

    it('allows multiple projects to be locked when parallel mode is enabled', () => {
      manager.config.settings.allow_parallel_projects = true;
      manager.lockProject('proj-a', 'Architect');
      manager.lockProject('proj-b', 'Developer');

      expect(manager.isProjectLocked('proj-a')).toBe(true);
      expect(manager.isProjectLocked('proj-b')).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('handles single-project workspace registered at root path', () => {
      manager.config.projects = [
        { id: 'proj-default', name: 'Default', path: '.', status: 'phase-0', phase: null },
      ];
      manager.config.active_project = 'proj-default';

      const project = manager.getActiveProject();
      expect(project.id).toBe('proj-default');
    });
  });
});
