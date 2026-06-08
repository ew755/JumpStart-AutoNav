#!/usr/bin/env node
/**
 * Manual smoke test for monorepo vs multi-repo hub layouts.
 * Creates temp directories, runs CLI checks, prints a comparison report.
 *
 * Usage: node scripts/smoke-workspace-layout-scenarios.mjs
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const FIXTURES = join(repoRoot, 'tests', 'fixtures', 'workspace');

function step(name, fn) {
  process.stdout.write(`\n▶ ${name}... `);
  try {
    fn();
    console.log('OK');
  } catch (err) {
    console.log('FAIL');
    throw err;
  }
}

function runCli(args, { cwd = repoRoot } = {}) {
  const result = spawnSync(process.execPath, [join(repoRoot, 'bin/cli.js'), ...args], {
    cwd,
    encoding: 'utf8',
  });
  return { ...result, out: `${result.stdout}\n${result.stderr}` };
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function setupMultiRepoHub(programDir) {
  const hubRoot = join(programDir, 'jumpstart-hub');
  const frontendRoot = join(programDir, 'frontend');

  mkdirSync(hubRoot, { recursive: true });
  mkdirSync(join(frontendRoot, 'specs'), { recursive: true });
  mkdirSync(join(frontendRoot, '.jumpstart', 'state'), { recursive: true });

  writeFileSync(
    join(frontendRoot, '.jumpstart', 'config.yaml'),
    'project:\n  name: Frontend\n  type: greenfield\n',
    'utf8'
  );
  writeJson(join(frontendRoot, '.jumpstart', 'state', 'state.json'), {
    current_phase: 0,
    approved_artifacts: [],
  });
  writeFileSync(join(frontendRoot, 'specs', 'challenger-brief.md'), '# Frontend brief\n', 'utf8');

  writeJson(join(hubRoot, '.jumpstart', 'projects.json'), {
    workspace: { id: 'smoke', enabled: true },
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
    settings: { pit_crew_review_required: false },
    version: '1.0.0',
  });

  writeJson(join(hubRoot, '.jumpstart', 'state', 'workspace-state.json'), {
    version: '1.0.0',
    active_project_id: 'proj-frontend',
    workspace_resume_context: { cross_project_dependencies: [] },
  });

  return { hubRoot, frontendRoot };
}

const programDir = join(tmpdir(), `jumpstart-smoke-layout-${Date.now()}`);
mkdirSync(programDir, { recursive: true });

console.log('🧪 Workspace layout smoke test\n');
console.log(`Temp program dir: ${programDir}`);

try {
  const monorepoDir = join(programDir, 'monorepo');
  cpSync(join(FIXTURES, 'multi-project'), monorepoDir, { recursive: true });

  step('Scenario A — monorepo workspace status', () => {
    const r = runCli(['workspace', 'status'], { cwd: monorepoDir });
    if (r.status !== 0) throw new Error(r.out);
    if (!r.out.includes('proj-alpha')) throw new Error('missing proj-alpha');
  });

  step('Scenario A — monorepo set-active proj-beta', () => {
    const r = runCli(['workspace', 'set-active', 'proj-beta'], { cwd: monorepoDir });
    if (r.status !== 0) throw new Error(r.out);
  });

  step('Scenario A — monorepo validate-deps', () => {
    const r = runCli(['workspace', 'validate-deps'], { cwd: monorepoDir });
    if (r.status !== 0) throw new Error(r.out);
  });

  const { hubRoot } = setupMultiRepoHub(programDir);

  step('Scenario B — sibling hub workspace status', () => {
    const r = runCli(['workspace', 'status'], { cwd: hubRoot });
    if (r.status !== 0) throw new Error(r.out);
    if (!r.out.includes('proj-frontend')) throw new Error('missing proj-frontend');
  });

  step('Scenario B — sibling hub validate-deps', () => {
    const r = runCli(['workspace', 'validate-deps'], { cwd: hubRoot });
    if (r.status !== 0) throw new Error(r.out);
  });

  step('Scenario B — sibling hub sync audit', () => {
    const r = runCli(['workspace', 'sync', '--audit'], { cwd: hubRoot });
    if (r.status !== 0) throw new Error(r.out);
  });

  step('Scenario B — link-sibling registers new clone', () => {
    const extraHub = join(programDir, 'hub-link-smoke');
    const extraRepo = join(programDir, 'service-b');
    mkdirSync(extraHub, { recursive: true });
    mkdirSync(extraRepo, { recursive: true });
    writeJson(join(extraHub, '.jumpstart', 'projects.json'), {
      workspace: { id: 'smoke-link', enabled: true },
      projects: [
        {
          id: 'proj-default',
          name: 'Hub',
          path: '.',
          status: 'phase-0',
          phase: 0,
          config_path: '.jumpstart/config.yaml',
        },
      ],
      active_project: 'proj-default',
      settings: {},
      version: '1.0.0',
    });
    writeJson(join(extraHub, '.jumpstart', 'state', 'workspace-state.json'), {
      version: '1.0.0',
      active_project_id: 'proj-placeholder',
      workspace_resume_context: {},
    });

    const r = runCli(
      [
        'workspace',
        'link-sibling',
        '--id=proj-service-b',
        '--name=Service B',
        '--path=../service-b',
        '--init',
      ],
      { cwd: extraHub }
    );
    if (r.status !== 0) throw new Error(r.out);
    if (!r.out.includes('Sibling repo linked')) throw new Error('link-sibling output missing');
  });

  console.log('\n✅ Both layout scenarios passed CLI smoke checks.');
  console.log('\nAutomated coverage: npx vitest run tests/test-workspace-layout-scenarios.test.js');
} finally {
  if (existsSync(programDir)) {
    rmSync(programDir, { recursive: true, force: true });
  }
}
