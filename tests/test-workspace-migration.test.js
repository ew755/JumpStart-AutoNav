/**
 * Tests for lib/workspace-migration.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

import {
  detectMigrationState,
  upgradeToWorkspace,
  readProjectMetadata,
  getProjectsPath,
  getWorkspaceStatePath,
} from '../lib/workspace-migration.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, 'fixtures', 'workspace');

function createTempDir() {
  const dir = join(tmpdir(), `jumpstart-wsmig-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
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

describe('readProjectMetadata', () => {
  it('reads project name and phase from existing files', () => {
    cpSync(join(FIXTURES_ROOT, 'single-project'), tmpDir, { recursive: true });

    const meta = readProjectMetadata(tmpDir);
    expect(meta.name).toBe('Acme Portal');
    expect(meta.type).toBe('greenfield');
    expect(meta.approver).toBe('Taylor');
    expect(meta.phase).toBe(1);
    expect(meta.status).toBe('phase-1');
  });
});

describe('upgradeToWorkspace', () => {
  it('fails when .jumpstart is missing', () => {
    const result = upgradeToWorkspace(tmpDir);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Not a Jump Start project/);
  });

  it('creates registry and workspace state files', () => {
    cpSync(join(FIXTURES_ROOT, 'single-project'), tmpDir, { recursive: true });

    const result = upgradeToWorkspace(tmpDir, { workspaceId: 'ws-test-001' });
    expect(result.success).toBe(true);
    expect(existsSync(getProjectsPath(tmpDir))).toBe(true);
    expect(existsSync(getWorkspaceStatePath(tmpDir))).toBe(true);

    const registry = JSON.parse(readFileSync(getProjectsPath(tmpDir), 'utf8'));
    expect(registry.workspace.id).toBe('ws-test-001');
    expect(registry.projects[0].config_path).toBe('.jumpstart/config.yaml');
  });
});

describe('detectMigrationState', () => {
  it('returns expected states for fixture layouts', () => {
    cpSync(join(FIXTURES_ROOT, 'single-project'), join(tmpDir, 'single'), { recursive: true });
    cpSync(join(FIXTURES_ROOT, 'migrated-root'), join(tmpDir, 'migrated'), { recursive: true });
    cpSync(join(FIXTURES_ROOT, 'multi-project'), join(tmpDir, 'multi'), { recursive: true });

    expect(detectMigrationState(join(tmpDir, 'single'))).toBe('single-project');
    expect(detectMigrationState(join(tmpDir, 'migrated'))).toBe('migrated-root');
    expect(detectMigrationState(join(tmpDir, 'multi'))).toBe('multi-project');
  });
});
