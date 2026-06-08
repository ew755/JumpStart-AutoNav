/**
 * Integration test: mock headless analyst completes product-brief in multi-workspace scenario.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('headless analyst multi-workspace (mock)', () => {
  let tmpOut;

  beforeEach(() => {
    tmpOut = join(tmpdir(), `jumpstart-headless-analyst-${Date.now()}`);
    mkdirSync(tmpOut, { recursive: true });
  });

  afterEach(() => {
    if (tmpOut && existsSync(tmpOut)) {
      rmSync(tmpOut, { recursive: true, force: true });
    }
  });

  it('writes product-brief.md under active project specs within turn budget', () => {
    const result = spawnSync(
      process.execPath,
      [
        'bin/headless-runner.js',
        '--agent', 'analyst',
        '--scenario', 'multi-workspace',
        '--mock',
        '--max-turns', '8',
        '--output', tmpOut,
      ],
      { cwd: root, encoding: 'utf8', timeout: 120000 }
    );

    const out = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(0, out);

    const workspaceDir = join(tmpOut, 'multi-workspace');
    const briefPath = join(workspaceDir, 'projects', 'proj-alpha', 'specs', 'product-brief.md');
    expect(existsSync(briefPath)).toBe(true);
    expect(readFileSync(briefPath, 'utf8')).toContain('Multi-Workspace Test');

    const rootBrief = join(workspaceDir, 'specs', 'product-brief.md');
    expect(existsSync(rootBrief)).toBe(false);

    expect(out).not.toContain('Max turns reached');
  }, 120000);
});
