/**
 * Tests for workspace path resolver and headless tool-bridge scoping.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const { createWorkspacePathResolver } = require('../lib/workspace-path-resolver.js');
const { createToolBridge } = require('../bin/lib/tool-bridge.js');
const { getWorkspaceContext } = require('../lib/workspace-context.js');
const {
  setupMultiWorkspaceScenario,
} = require('../lib/headless-workspace.js');

const SCENARIO_DIR = join(__dirname, 'e2e', 'scenarios', 'multi-workspace');

let tmpDir;

beforeEach(() => {
  tmpDir = join(tmpdir(), `jumpstart-path-resolver-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('workspace-path-resolver', () => {
  it('redirects root specs/ writes to active project specs/', () => {
    setupMultiWorkspaceScenario(SCENARIO_DIR, tmpDir);
    const context = getWorkspaceContext(tmpDir);
    const resolver = createWorkspacePathResolver(tmpDir, context);

    expect(resolver.enabled).toBe(true);
    const redirected = resolver.resolvePath(join(tmpDir, 'specs', 'product-brief.md'));
    expect(redirected).toBe(join(tmpDir, 'projects', 'proj-alpha', 'specs', 'product-brief.md'));
  });

  it('leaves paths unchanged in single-project mode', () => {
    mkdirSync(join(tmpDir, 'specs'), { recursive: true });
    const resolver = createWorkspacePathResolver(tmpDir);
    const target = join(tmpDir, 'specs', 'prd.md');
    expect(resolver.resolvePath(target)).toBe(target);
    expect(resolver.enabled).toBe(false);
  });
});

describe('tool-bridge workspace scoping', () => {
  it('create_file redirects specs writes to active project', async () => {
    setupMultiWorkspaceScenario(SCENARIO_DIR, tmpDir);
    const context = getWorkspaceContext(tmpDir);
    const bridge = createToolBridge({
      workspaceDir: tmpDir,
      workspaceContext: context,
    });

    const toolCall = {
      id: 'call-1',
      function: {
        name: 'create_file',
        arguments: JSON.stringify({
          filePath: join(tmpDir, 'specs', 'product-brief.md'),
          content: '# Product Brief\n',
        }),
      },
    };

    const result = JSON.parse((await bridge.execute(toolCall)).content);
    expect(result.success).toBe(true);
    expect(result.redirected).toBe(true);

    const projectBrief = join(tmpDir, 'projects', 'proj-alpha', 'specs', 'product-brief.md');
    expect(existsSync(projectBrief)).toBe(true);
    expect(readFileSync(projectBrief, 'utf8')).toContain('# Product Brief');

    const rootBrief = join(tmpDir, 'specs', 'product-brief.md');
    expect(existsSync(rootBrief)).toBe(false);
  });
});
