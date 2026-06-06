/**
 * Stub fixtures for workspace mode testing.
 *
 * Layout:
 *   single-project/   — classic Jump Start project without projects.json
 *   migrated-root/    — single project registered at root path "."
 *   multi-project/    — two projects under projects/
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = __dirname;

function writeJson(relativePath, data) {
  const fullPath = join(FIXTURES_ROOT, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

function writeText(relativePath, content) {
  const fullPath = join(FIXTURES_ROOT, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
}

// ── single-project ────────────────────────────────────────────────────────────
// Ensure no workspace registry files (classic single-project mode)
for (const stale of [
  'single-project/.jumpstart/projects.json',
  'single-project/.jumpstart/state/workspace-state.json',
]) {
  const stalePath = join(FIXTURES_ROOT, stale);
  if (existsSync(stalePath)) rmSync(stalePath);
}

writeText('single-project/.jumpstart/config.yaml', `project:
  name: "Acme Portal"
  type: greenfield
  approver: "Taylor"
`);

writeJson('single-project/.jumpstart/state/state.json', {
  current_phase: 1,
  approved_artifacts: ['specs/challenger-brief.md'],
  resume_context: { tldr: 'Phase 1 in progress' },
});

writeText('single-project/specs/challenger-brief.md', '# Challenger Brief\n\nStub artifact for single-project mode.\n');

// ── migrated-root ─────────────────────────────────────────────────────────────
writeText('migrated-root/.jumpstart/config.yaml', `project:
  name: "Acme Portal"
  type: greenfield
  approver: "Taylor"
`);

writeJson('migrated-root/.jumpstart/state/state.json', {
  current_phase: 1,
  approved_artifacts: ['specs/challenger-brief.md'],
  resume_context: { tldr: 'Migrated workspace at root' },
});

writeJson('migrated-root/.jumpstart/projects.json', {
  workspace: {
    id: 'fixture-workspace-root',
    enabled: true,
    description: 'Migrated single project at repository root',
  },
  projects: [
    {
      id: 'proj-default',
      name: 'Acme Portal',
      path: '.',
      type: 'greenfield',
      status: 'phase-1',
      created_at: '2026-06-01T00:00:00Z',
      config_path: '.jumpstart/config.yaml',
      phase: 1,
      approver: 'Taylor',
      locked: false,
      lock_reason: null,
    },
  ],
  active_project: 'proj-default',
  settings: {
    enforce_sequential_phases: true,
    allow_parallel_projects: false,
    pit_crew_review_required: true,
    cross_project_dependency_validation: true,
    aggregate_cost_tracking: true,
  },
  version: '1.0.0',
  last_updated: '2026-06-01T00:00:00Z',
});

writeJson('migrated-root/.jumpstart/state/workspace-state.json', {
  version: '1.0.0',
  active_project_id: 'proj-default',
  workspace_resume_context: {
    tldr: 'Migrated from single-project workspace',
    cross_project_dependencies: [],
    workspace_token_budget: 500000,
    workspace_tokens_used: 1200,
    project_count: 1,
    projects_in_progress: ['proj-default'],
  },
  project_locks: {},
  last_updated: null,
});

writeText('migrated-root/specs/challenger-brief.md', '# Challenger Brief\n\nStub artifact for migrated root workspace.\n');

// ── multi-project ─────────────────────────────────────────────────────────────
writeText('multi-project/.jumpstart/config.yaml', `project:
  name: "Workspace Shell"
  type: greenfield
  approver: "Ops Team"
`);

writeJson('multi-project/.jumpstart/projects.json', {
  workspace: {
    id: 'fixture-workspace-multi',
    enabled: true,
    description: 'Two-project workspace example',
  },
  projects: [
    {
      id: 'proj-alpha',
      name: 'Alpha Feature',
      path: 'projects/proj-alpha',
      type: 'greenfield',
      status: 'phase-2',
      config_path: 'projects/proj-alpha/.jumpstart/config.yaml',
      phase: 2,
      approver: 'Alice',
      locked: false,
    },
    {
      id: 'proj-beta',
      name: 'Beta Dashboard',
      path: 'projects/proj-beta',
      type: 'greenfield',
      status: 'phase-0',
      config_path: 'projects/proj-beta/.jumpstart/config.yaml',
      phase: 0,
      approver: 'Bob',
      locked: false,
    },
  ],
  active_project: 'proj-alpha',
  settings: {
    enforce_sequential_phases: true,
    allow_parallel_projects: false,
    cross_project_dependency_validation: true,
    aggregate_cost_tracking: true,
  },
  version: '1.0.0',
});

writeJson('multi-project/.jumpstart/state/workspace-state.json', {
  version: '1.0.0',
  active_project_id: 'proj-alpha',
  workspace_resume_context: {
    tldr: 'Alpha in Phase 2, Beta blocked on Alpha Phase 3',
    cross_project_dependencies: [
      { from: 'proj-beta', to: 'proj-alpha', type: 'phase_dependency', blocked: true, unblock_condition: 'Phase 3' },
    ],
    workspace_token_budget: 1000000,
    workspace_tokens_used: 12400,
  },
  project_locks: {},
});

writeText('multi-project/projects/proj-alpha/.jumpstart/config.yaml', `project:
  name: "Alpha Feature"
  type: greenfield
  approver: "Alice"
`);

writeJson('multi-project/projects/proj-alpha/.jumpstart/state/state.json', {
  current_phase: 2,
  approved_artifacts: ['specs/challenger-brief.md', 'specs/product-brief.md'],
});

writeText('multi-project/projects/proj-alpha/specs/prd.md', '# PRD\n\nAlpha project stub PRD.\n');

writeText('multi-project/projects/proj-beta/.jumpstart/config.yaml', `project:
  name: "Beta Dashboard"
  type: greenfield
  approver: "Bob"
`);

writeJson('multi-project/projects/proj-beta/.jumpstart/state/state.json', {
  current_phase: 0,
  approved_artifacts: [],
});

console.log(`Workspace fixtures written to ${FIXTURES_ROOT}`);
