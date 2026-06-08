/**
 * P2 workspace feature tests: parallel mode, cost governance, ADR registry, knowledge graph.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

import { WorkspaceManager } from '../lib/workspace-manager.js';

const require = createRequire(import.meta.url);
const parallel = require('../lib/workspace-parallel.js');
const cost = require('../lib/workspace-cost.js');
const adrRegistry = require('../lib/workspace-adr-registry.js');
const knowledgeGraph = require('../lib/workspace-knowledge-graph.js');

function createTempDir() {
  const dir = join(tmpdir(), `jumpstart-p2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeWorkspace(dir, config, state) {
  mkdirSync(join(dir, '.jumpstart', 'state'), { recursive: true });
  writeFileSync(join(dir, '.jumpstart', 'projects.json'), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, '.jumpstart', 'state', 'workspace-state.json'), JSON.stringify(state, null, 2));
}

const baseConfig = {
  workspace: { id: 'p2-ws', enabled: true },
  projects: [
    { id: 'proj-alpha', name: 'Alpha', path: 'projects/proj-alpha', status: 'phase-1', phase: 1 },
    { id: 'proj-beta', name: 'Beta', path: 'projects/proj-beta', status: 'phase-0', phase: 0 },
  ],
  active_project: 'proj-alpha',
  settings: {
    enforce_sequential_phases: true,
    allow_parallel_projects: false,
    pit_crew_review_required: true,
    cross_project_dependency_validation: true,
    aggregate_cost_tracking: true,
    max_concurrent_projects: 2,
  },
};

const baseState = {
  version: '1.0.0',
  active_project_id: 'proj-alpha',
  project_locks: {},
  paused_projects: [],
  workspace_resume_context: {
    cross_project_dependencies: [
      {
        from: 'proj-beta',
        to: 'proj-alpha',
        type: 'phase_dependency',
        blocked: true,
        unblock_condition: 'Phase 3',
      },
    ],
    workspace_token_budget: 500000,
    workspace_tokens_used: 0,
  },
};

let tmpDir;

beforeEach(() => {
  tmpDir = createTempDir();
  writeWorkspace(tmpDir, baseConfig, baseState);
  mkdirSync(join(tmpDir, 'projects', 'proj-alpha', 'specs', 'decisions'), { recursive: true });
  mkdirSync(join(tmpDir, 'projects', 'proj-beta', '.jumpstart'), { recursive: true });
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('workspace-parallel', () => {
  it('blocks non-active project in sequential mode', () => {
    const result = parallel.canAdvanceProject(baseConfig, baseState, 'proj-beta');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Sequential mode');
  });

  it('allows parallel locks up to max_concurrent_projects', () => {
    const config = {
      ...baseConfig,
      settings: {
        ...baseConfig.settings,
        allow_parallel_projects: true,
        max_concurrent_projects: 2,
        pit_crew_review_required: false,
      },
    };
    const state = {
      ...baseState,
      project_locks: {
        'proj-alpha': { locked_by: 'Architect', locked_at: new Date().toISOString() },
      },
    };
    expect(parallel.canAdvanceProject(config, state, 'proj-beta').allowed).toBe(true);

    state.project_locks['proj-beta'] = { locked_by: 'Analyst', locked_at: new Date().toISOString() };
    const third = parallel.canAdvanceProject(config, state, 'proj-gamma');
    expect(third.allowed).toBe(false);
    expect(third.reason).toContain('Parallel capacity exceeded');
  });

  it('requires Pit Crew review when blocked dependencies exist', () => {
    const review = parallel.needsPitCrewReview(baseConfig, baseState, 'proj-beta');
    expect(review.required).toBe(true);
    expect(review.blockedDependencies).toHaveLength(1);
  });

  it('pause and resume update state', () => {
    const state = { ...baseState, paused_projects: [] };
    parallel.pauseProject(state, 'proj-alpha');
    expect(state.paused_projects).toContain('proj-alpha');
    parallel.resumeProject(state, 'proj-alpha');
    expect(state.paused_projects).not.toContain('proj-alpha');
  });
});

describe('workspace-cost', () => {
  it('warns at alert threshold and fails when exceeded', () => {
    const project = {
      id: 'proj-alpha',
      path: 'projects/proj-alpha',
      cost_governance: { token_budget: 1000, alert_threshold_percent: 80 },
    };
    mkdirSync(join(tmpDir, 'projects', 'proj-alpha', '.jumpstart'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'projects', 'proj-alpha', '.jumpstart', 'usage-log.json'),
      JSON.stringify({ entries: [], total_tokens: 850, total_cost_usd: 0 })
    );

    const warn = cost.checkProjectBudget(tmpDir, project);
    expect(warn.alerts.some((a) => a.level === 'warn')).toBe(true);
    expect(warn.allowed).toBe(true);

    writeFileSync(
      join(tmpDir, 'projects', 'proj-alpha', '.jumpstart', 'usage-log.json'),
      JSON.stringify({ entries: [], total_tokens: 1100, total_cost_usd: 0 })
    );
    const fail = cost.checkProjectBudget(tmpDir, project, { failOnExceeded: true });
    expect(fail.allowed).toBe(false);
  });

  it('aggregates workspace cost breakdown', () => {
    const manager = new WorkspaceManager(tmpDir);
    const summary = manager.costBreakdown();
    expect(summary.projects).toHaveLength(2);
    expect(summary.workspace_budget).toBe(500000);
  });
});

describe('workspace-adr-registry', () => {
  it('parses ADR markdown and registers impacts', () => {
    writeFileSync(
      join(tmpDir, 'projects', 'proj-alpha', 'specs', 'decisions', 'ADR-001-grail.md'),
      `# ADR-001: Use Grail as primary data source

**Status:** Accepted
**Date:** 2026-06-01

## Impacts

- **proj-beta**: Dashboard queries must meet Grail SLA
`
    );

    const manager = new WorkspaceManager(tmpDir);
    const result = manager.scanADRs();
    expect(result.count).toBe(1);
    expect(result.registry.adr_index[0].id).toBe('ADR-001');

    const impacts = manager.adrImpacts('ADR-001');
    expect(impacts.found).toBe(true);
    expect(impacts.affected_projects).toContain('proj-beta');
  });

  it('auditADRAwareness lists upstream ADRs for a project', () => {
    writeFileSync(
      join(tmpDir, 'projects', 'proj-alpha', 'specs', 'decisions', 'ADR-002-api.md'),
      `# ADR-002: Shared API contract

**Status:** Accepted

## Impacts

- **proj-beta**: Must consume stable API version
`
    );
    const manager = new WorkspaceManager(tmpDir);
    manager.scanADRs();
    const audit = manager.auditADRAwareness('proj-beta');
    expect(audit.count).toBeGreaterThan(0);
    expect(audit.upstream_adrs[0].source_project).toBe('proj-alpha');
  });
});

describe('workspace-knowledge-graph', () => {
  it('builds graph with project nodes and dependency edges', () => {
    const manager = new WorkspaceManager(tmpDir);
    const graph = manager.buildKnowledgeGraph();
    expect(graph.nodes.some((n) => n.id === 'proj-alpha' && n.type === 'project')).toBe(true);
    expect(graph.edges.some((e) => e.from === 'proj-beta' && e.to === 'proj-alpha')).toBe(true);
    expect(existsSync(join(tmpDir, '.jumpstart', 'knowledge-graph.json'))).toBe(true);
  });

  it('queries downstream projects', () => {
    const manager = new WorkspaceManager(tmpDir);
    const result = manager.queryGraph('downstream-of proj-beta');
    expect(result.results).toContain('proj-alpha');
  });

  it('exports graphviz format', () => {
    const manager = new WorkspaceManager(tmpDir);
    const dot = manager.exportGraph('graphviz');
    expect(dot).toContain('digraph workspace');
    expect(dot).toContain('proj-alpha');
  });
});

describe('WorkspaceManager P2 integration', () => {
  it('lockProject enforces canAdvance in sequential mode', () => {
    const manager = new WorkspaceManager(tmpDir);
    manager.config.settings.pit_crew_review_required = false;
    expect(() => manager.lockProject('proj-beta', 'Analyst')).toThrow(/Sequential mode/);
    manager.lockProject('proj-alpha', 'Analyst');
    expect(manager.isProjectLocked('proj-alpha')).toBe(true);
  });

  it('lockProject allows multiple locks in parallel mode', () => {
    const manager = new WorkspaceManager(tmpDir);
    manager.config.settings.allow_parallel_projects = true;
    manager.config.settings.pit_crew_review_required = false;
    manager.lockProject('proj-alpha', 'Architect');
    manager.lockProject('proj-beta', 'Analyst');
    expect(manager.isProjectLocked('proj-alpha')).toBe(true);
    expect(manager.isProjectLocked('proj-beta')).toBe(true);
  });

  it('adjustBudget persists to projects.json', () => {
    const manager = new WorkspaceManager(tmpDir);
    manager.adjustBudget('proj-alpha', 250000);
    const saved = JSON.parse(readFileSync(join(tmpDir, '.jumpstart', 'projects.json'), 'utf8'));
    const alpha = saved.projects.find((p) => p.id === 'proj-alpha');
    expect(alpha.cost_governance.token_budget).toBe(250000);
  });
});
