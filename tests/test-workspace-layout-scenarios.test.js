/**
 * Layout scenario tests: monorepo-in-one-git-repo vs multi-repo hub with sibling checkouts.
 *
 * Scenario A — monorepo: hub root contains projects/{id}/ (idiomatic 1.2.0 dogfood layout)
 * Scenario B — multi-repo hub: hub repo registers sibling paths like ../frontend
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, 'fixtures', 'workspace');

const { getWorkspaceContext } = require('../lib/workspace-context.js');
const { loadSpec } = require('../lib/spec-loader.js');
const { createWorkspacePathResolver } = require('../lib/workspace-path-resolver.js');
const { WorkspaceManager } = require('../lib/workspace-manager.js');
const { approvePhase } = require('../lib/phase-gate-updater.js');
const { buildPitCrewBlock } = require('../.github/hooks/workspace-pitcrew-guard.js');
const multiRepo = require('../bin/lib/multi-repo.js');

function createProgramDir() {
  const dir = join(tmpdir(), `jumpstart-layout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function writeYaml(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function writeApprovedSpec(specPath, title, phaseLabel) {
  mkdirSync(dirname(specPath), { recursive: true });
  writeFileSync(
    specPath,
    `# ${title}

## Phase Gate Approval

- [x] Complete
- [x] Reviewed

**Approved by:** Eric
**Approval date:** 2026-06-08
**Phase:** ${phaseLabel}
`,
    'utf8'
  );
}

function scaffoldSiblingRepo(repoRoot, { name, phase = 1 }) {
  writeYaml(
    join(repoRoot, '.jumpstart', 'config.yaml'),
    `project:
  name: "${name}"
  type: greenfield
  approver: Eric
`
  );
  writeJson(join(repoRoot, '.jumpstart', 'state', 'state.json'), {
    version: '1.0.0',
    current_phase: phase,
    approved_artifacts: [],
    resume_context: {},
  });
  writeApprovedSpec(
    join(repoRoot, 'specs', 'challenger-brief.md'),
    `${name} Challenger Brief`,
    '0'
  );
  mkdirSync(join(repoRoot, 'src'), { recursive: true });
  mkdirSync(join(repoRoot, 'tests'), { recursive: true });
}

function scaffoldHubRegistry(hubRoot, projects, workspaceState = {}) {
  writeJson(join(hubRoot, '.jumpstart', 'projects.json'), {
    workspace: { id: 'layout-test', enabled: true, description: 'Layout scenario test' },
    projects,
    active_project: projects[0].id,
    settings: {
      enforce_sequential_phases: true,
      allow_parallel_projects: false,
      pit_crew_review_required: true,
      cross_project_dependency_validation: true,
    },
    version: '1.0.0',
  });

  writeJson(join(hubRoot, '.jumpstart', 'state', 'workspace-state.json'), {
    version: '1.0.0',
    active_project_id: projects[0].id,
    workspace_resume_context: {
      cross_project_dependencies: workspaceState.cross_project_dependencies || [],
      ...workspaceState,
    },
    project_locks: {},
    last_updated: new Date().toISOString(),
  });

  mkdirSync(join(hubRoot, '.jumpstart', 'agents'), { recursive: true });
  mkdirSync(join(hubRoot, 'specs'), { recursive: true });
}

/** Scenario B: parent/program dir with hub + sibling repos */
function setupMultiRepoHub(programDir) {
  const hubRoot = join(programDir, 'jumpstart-hub');
  const frontendRoot = join(programDir, 'frontend');
  const backendRoot = join(programDir, 'backend');

  mkdirSync(hubRoot, { recursive: true });
  scaffoldSiblingRepo(frontendRoot, { name: 'Frontend App', phase: 0 });
  scaffoldSiblingRepo(backendRoot, { name: 'Backend API', phase: 0 });

  scaffoldHubRegistry(
    hubRoot,
    [
      {
        id: 'proj-frontend',
        name: 'Frontend App',
        path: '../frontend',
        type: 'greenfield',
        status: 'phase-0',
        phase: 0,
        config_path: '../frontend/.jumpstart/config.yaml',
      },
      {
        id: 'proj-backend',
        name: 'Backend API',
        path: '../backend',
        type: 'greenfield',
        status: 'phase-0',
        phase: 0,
        config_path: '../backend/.jumpstart/config.yaml',
      },
    ],
    {
      cross_project_dependencies: [
        {
          from: 'proj-backend',
          to: 'proj-frontend',
          type: 'phase_dependency',
          blocked: true,
          unblock_condition: 'Phase 2',
        },
      ],
    }
  );

  return { hubRoot, frontendRoot, backendRoot };
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

describe('Scenario A — monorepo (projects/ inside hub git repo)', () => {
  let hubRoot;

  beforeEach(() => {
    cpSync(join(FIXTURES_ROOT, 'multi-project'), programDir, { recursive: true });
    hubRoot = programDir;
  });

  it('loads specs from projects/{id}/specs for active project', () => {
    const context = getWorkspaceContext(hubRoot);
    expect(context.mode).toBe('multi-project');
    expect(context.project.project_id).toBe('proj-alpha');

    const spec = loadSpec(context, 'prd.md');
    expect(spec.path).toBe(join(hubRoot, 'projects', 'proj-alpha', 'specs', 'prd.md'));
  });

  it('redirects hub specs/ writes to active monorepo project', () => {
    const context = getWorkspaceContext(hubRoot);
    const resolver = createWorkspacePathResolver(hubRoot, context);
    const redirected = resolver.resolvePath(join(hubRoot, 'specs', 'product-brief.md'));

    expect(redirected).toBe(join(hubRoot, 'projects', 'proj-alpha', 'specs', 'product-brief.md'));
  });

  it('switches active project and resolves nested paths', () => {
    const manager = new WorkspaceManager(hubRoot);
    manager.setActive('proj-beta');

    const context = getWorkspaceContext(hubRoot);
    expect(context.project.project_id).toBe('proj-beta');
    expect(context.config.specs_path).toBe(join(hubRoot, 'projects', 'proj-beta', 'specs'));
  });

  it('sync pull reads phase from nested project state', () => {
    const manager = new WorkspaceManager(hubRoot);
    const nestedStatePath = join(hubRoot, 'projects', 'proj-alpha', '.jumpstart', 'state', 'state.json');
    const nestedState = JSON.parse(readFileSync(nestedStatePath, 'utf8'));
    nestedState.current_phase = 3;
    writeJson(nestedStatePath, nestedState);

    manager.syncPull(false);
    const alpha = manager.config.projects.find((p) => p.id === 'proj-alpha');
    expect(alpha.phase).toBe(3);
  });
});

describe('Scenario B — multi-repo hub (sibling repos via ../ paths)', () => {
  let hubRoot;
  let frontendRoot;
  let backendRoot;

  beforeEach(() => {
    ({ hubRoot, frontendRoot, backendRoot } = setupMultiRepoHub(programDir));
  });

  it('resolves active project outside hub root via relative path', () => {
    const context = getWorkspaceContext(hubRoot);
    expect(context.mode).toBe('multi-project');
    expect(context.project.project_id).toBe('proj-frontend');
    expect(context.project.projectPath).toBe(frontendRoot);
    expect(context.config.specs_path).toBe(join(frontendRoot, 'specs'));
  });

  it('loads specs from sibling repo, not hub specs/', () => {
    const context = getWorkspaceContext(hubRoot);
    const spec = loadSpec(context, 'challenger-brief.md');

    expect(spec.path).toBe(join(frontendRoot, 'specs', 'challenger-brief.md'));
    expect(spec.content).toMatch(/Frontend App Challenger Brief/);
    expect(spec.path).not.toContain('jumpstart-hub');
  });

  it('redirects hub-root specs/ path to sibling project specs/', () => {
    const context = getWorkspaceContext(hubRoot);
    const resolver = createWorkspacePathResolver(hubRoot, context);
    const redirected = resolver.resolvePath(join(hubRoot, 'specs', 'challenger-brief.md'));

    expect(redirected).toBe(join(frontendRoot, 'specs', 'challenger-brief.md'));
  });

  it('validate-deps surfaces blocked cross-repo dependency', () => {
    const manager = new WorkspaceManager(hubRoot);
    manager.setActive('proj-backend');

    const result = manager.validateDeps();
    expect(result.valid).toBe(true);
    expect(result.blocked_count).toBe(1);
    expect(result.blocked[0].from).toBe('proj-backend');
    expect(result.blocked[0].to).toBe('proj-frontend');
  });

  it('Pit Crew guard blocks backend when dependency unsatisfied', () => {
    const manager = new WorkspaceManager(hubRoot);
    manager.setActive('proj-backend');

    const block = buildPitCrewBlock(hubRoot);
    expect(block).toMatch(/Pit Crew Review Required/);
    expect(block).toMatch(/proj-backend/);
    expect(block).toMatch(/proj-frontend/);
  });

  it('sync pull updates registry from sibling repo state files', () => {
    const manager = new WorkspaceManager(hubRoot);
    writeJson(join(frontendRoot, '.jumpstart', 'state', 'state.json'), {
      version: '1.0.0',
      current_phase: 2,
      approved_artifacts: [],
    });

    manager.syncPull(false);
    const frontend = manager.config.projects.find((p) => p.id === 'proj-frontend');
    expect(frontend.phase).toBe(2);
  });

  it('approvePhase writes state to sibling repo (not hub)', () => {
    writeApprovedSpec(join(frontendRoot, 'specs', 'product-brief.md'), 'Frontend Product Brief', '1');

    const context = getWorkspaceContext(hubRoot);
    const result = approvePhase(context, join(frontendRoot, 'specs', 'product-brief.md'), 'Eric');

    expect(result.success).toBe(true);
    expect(result.project_id).toBe('proj-frontend');

    const state = JSON.parse(readFileSync(join(frontendRoot, '.jumpstart', 'state', 'state.json'), 'utf8'));
    expect(state.current_phase).toBe(1);
    expect(state.approved_by).toBe('Eric');

    const hubStatePath = join(hubRoot, '.jumpstart', 'state', 'state.json');
    expect(existsSync(hubStatePath)).toBe(false);
  });

  it('switches active project to second sibling repo', () => {
    const manager = new WorkspaceManager(hubRoot);
    manager.setActive('proj-backend');

    const context = getWorkspaceContext(hubRoot);
    expect(context.project.projectPath).toBe(backendRoot);

    const spec = loadSpec(context, 'challenger-brief.md');
    expect(spec.path).toBe(join(backendRoot, 'specs', 'challenger-brief.md'));
  });
});

describe('multi-repo program CLI (Scenario B companion)', () => {
  it('links sibling repo paths in multi-repo.json from hub cwd', () => {
    const { hubRoot, frontendRoot, backendRoot } = setupMultiRepoHub(programDir);
    const stateFile = join(hubRoot, '.jumpstart', 'state', 'multi-repo.json');

    const init = multiRepo.initProgram('Layout Test Program', { stateFile });
    expect(init.success).toBe(true);

    const linkFront = multiRepo.linkRepo(frontendRoot, 'frontend', { stateFile });
    const linkBack = multiRepo.linkRepo(backendRoot, 'backend', { stateFile });
    expect(linkFront.success).toBe(true);
    expect(linkBack.success).toBe(true);

    const status = multiRepo.getProgramStatus({ stateFile });
    expect(status.repo_count).toBe(2);
    expect(status.role_breakdown.frontend).toBe(1);
    expect(status.role_breakdown.backend).toBe(1);
  });

  it('link-sibling CLI registers sibling without manual projects.json edit', () => {
    const hubRoot = join(programDir, 'hub-link');
    const siblingRoot = join(programDir, 'api-repo');
    mkdirSync(hubRoot, { recursive: true });
    mkdirSync(siblingRoot, { recursive: true });

    writeJson(join(hubRoot, '.jumpstart', 'projects.json'), {
      workspace: { id: 'hub', enabled: true },
      projects: [],
      active_project: null,
      settings: {},
      version: '1.0.0',
    });
    writeJson(join(hubRoot, '.jumpstart', 'state', 'workspace-state.json'), {
      version: '1.0.0',
      workspace_resume_context: {},
    });

    const manager = new WorkspaceManager(hubRoot);
    const linked = manager.linkSiblingProject([
      '--id=proj-api',
      '--name=API Service',
      '--path=../api-repo',
      '--init',
    ]);
    expect(linked.success).toBe(true);
    expect(linked.projectPath).toBe('../api-repo');
    expect(existsSync(join(siblingRoot, 'specs'))).toBe(true);
  });
});
