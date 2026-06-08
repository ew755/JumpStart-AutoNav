/**
 * Tests for headless multi-project workspace scenario setup.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  isMultiWorkspaceScenario,
  setupMultiWorkspaceScenario,
  copyPhaseArtifacts,
  getWorkspacePromptSuffix,
} = require('../lib/headless-workspace.js');
const { getWorkspaceContext } = require('../lib/workspace-context.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIO_DIR = join(__dirname, 'e2e', 'scenarios', 'multi-workspace');

let tmpDir;

beforeEach(() => {
  tmpDir = join(tmpdir(), `jumpstart-headless-ws-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('headless-workspace', () => {
  it('detects multi-workspace scenario via manifest', () => {
    expect(isMultiWorkspaceScenario(SCENARIO_DIR)).toBe(true);
    expect(isMultiWorkspaceScenario(join(__dirname, 'e2e', 'scenarios', 'baseline'))).toBe(false);
  });

  it('copies fixture registry and nested projects into run directory', () => {
    const context = setupMultiWorkspaceScenario(SCENARIO_DIR, tmpDir);

    expect(existsSync(join(tmpDir, '.jumpstart', 'projects.json'))).toBe(true);
    expect(existsSync(join(tmpDir, 'projects', 'proj-alpha', '.jumpstart', 'config.yaml'))).toBe(true);
    expect(existsSync(join(tmpDir, 'projects', 'proj-beta', '.jumpstart', 'config.yaml'))).toBe(true);

    expect(context.mode).toBe('multi-project');
    expect(context.project.project_id).toBe('proj-alpha');

    const registry = JSON.parse(readFileSync(join(tmpDir, '.jumpstart', 'projects.json'), 'utf8'));
    expect(registry.active_project).toBe('proj-alpha');
    expect(registry.projects).toHaveLength(2);
  });

  it('copies phase artifacts into active project specs/', () => {
    setupMultiWorkspaceScenario(SCENARIO_DIR, tmpDir);
    copyPhaseArtifacts(SCENARIO_DIR, tmpDir);

    const briefPath = join(tmpDir, 'projects', 'proj-alpha', 'specs', 'challenger-brief.md');
    expect(existsSync(briefPath)).toBe(true);
    expect(readFileSync(briefPath, 'utf8')).toContain('Multi-Workspace Test');

    const rootBrief = join(tmpDir, 'specs', 'challenger-brief.md');
    expect(existsSync(rootBrief)).toBe(false);
  });

  it('loadSpec resolves active project specs after setup', () => {
    setupMultiWorkspaceScenario(SCENARIO_DIR, tmpDir);
    copyPhaseArtifacts(SCENARIO_DIR, tmpDir);

    const context = getWorkspaceContext(tmpDir);
    const { loadSpec } = require('../lib/spec-loader.js');
    const spec = loadSpec(context, 'challenger-brief.md');
    expect(spec.content).toContain('Multi-Workspace Test');
  });

  it('builds workspace prompt suffix with relative paths', () => {
    setupMultiWorkspaceScenario(SCENARIO_DIR, tmpDir);
    const suffix = getWorkspacePromptSuffix(tmpDir);

    expect(suffix).toContain('proj-alpha');
    expect(suffix).toContain('projects/proj-alpha/specs/');
    expect(suffix).toContain('Write phase artifacts');
  });
});
