#!/usr/bin/env node

/**
 * workspace-migration.js
 * Upgrade a single-project Jump Start workspace to multi-project mode.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { assertValidProjectsRegistry, normalizeRegistry } = require('./workspace-validator');

const DEFAULT_PROJECT_ID = 'proj-default';

function getProjectsPath(rootDir) {
  return path.join(rootDir, '.jumpstart', 'projects.json');
}

function getWorkspaceStatePath(rootDir) {
  return path.join(rootDir, '.jumpstart', 'state', 'workspace-state.json');
}

function readProjectMetadata(rootDir) {
  const defaults = {
    name: 'Default Project',
    type: 'greenfield',
    approver: null,
    phase: null,
    status: 'initializing',
  };

  const configPath = path.join(rootDir, '.jumpstart', 'config.yaml');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = yaml.parse(fs.readFileSync(configPath, 'utf8')) || {};
      defaults.name = parsed.project?.name || defaults.name;
      defaults.type = parsed.project?.type || defaults.type;
      defaults.approver = parsed.project?.approver || defaults.approver;
    } catch {
      // Keep defaults when config is empty or invalid YAML
    }
  }

  const statePath = path.join(rootDir, '.jumpstart', 'state', 'state.json');
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state.current_phase !== null && state.current_phase !== undefined) {
        defaults.phase = state.current_phase;
        defaults.status = `phase-${state.current_phase}`;
      }
    } catch {
      // Keep defaults when state is unreadable
    }
  }

  return defaults;
}

/**
 * Detect current workspace layout.
 * @returns {'single-project'|'migrated-root'|'multi-project'}
 */
function detectMigrationState(rootDir) {
  const projectsPath = getProjectsPath(rootDir);
  if (!fs.existsSync(projectsPath)) {
    return 'single-project';
  }

  const registry = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const projects = registry.projects || [];
  const hasNestedProjects = projects.some((project) => {
    const projectPath = project.path || '';
    return projectPath !== '.' && projectPath.startsWith('projects/');
  });

  if (hasNestedProjects || projects.length > 1) {
    return 'multi-project';
  }

  return 'migrated-root';
}

/**
 * Create projects.json and workspace-state.json for a single-project workspace.
 * Idempotent: returns alreadyMigrated when registry already exists.
 */
function upgradeToWorkspace(rootDir, options = {}) {
  const jumpstartDir = path.join(rootDir, '.jumpstart');
  if (!fs.existsSync(jumpstartDir)) {
    return {
      success: false,
      error: 'Not a Jump Start project (.jumpstart/ not found)',
    };
  }

  const projectsPath = getProjectsPath(rootDir);
  if (fs.existsSync(projectsPath)) {
    const existing = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    return {
      success: true,
      alreadyMigrated: true,
      mode: detectMigrationState(rootDir),
      projectsPath,
      workspaceStatePath: getWorkspaceStatePath(rootDir),
      activeProject: existing.active_project || DEFAULT_PROJECT_ID,
    };
  }

  const meta = readProjectMetadata(rootDir);
  const now = new Date().toISOString();
  const workspaceId = options.workspaceId || 'dev-workspace-001';

  const projectsJson = {
    workspace: {
      id: workspaceId,
      enabled: true,
      description: options.description || 'Multi-project workspace for coordinated AI delivery',
    },
    projects: [
      {
        id: DEFAULT_PROJECT_ID,
        name: meta.name || 'Default Project',
        path: '.',
        type: meta.type || 'greenfield',
        status: meta.status,
        created_at: now,
        config_path: '.jumpstart/config.yaml',
        phase: meta.phase,
        approver: meta.approver,
        locked: false,
        lock_reason: null,
      },
    ],
    active_project: DEFAULT_PROJECT_ID,
    settings: {
      enforce_sequential_phases: true,
      allow_parallel_projects: false,
      pit_crew_review_required: true,
      cross_project_dependency_validation: true,
      aggregate_cost_tracking: true,
    },
    version: '1.0.0',
    last_updated: now,
  };

  const workspaceState = {
    version: '1.0.0',
    active_project_id: DEFAULT_PROJECT_ID,
    workspace_resume_context: {
      tldr: options.tldr || 'Migrated from single-project workspace',
      cross_project_dependencies: [],
      workspace_token_budget: options.tokenBudget || 500000,
      workspace_tokens_used: 0,
      last_pit_crew_review: null,
      project_count: 1,
      projects_in_progress: [],
    },
    project_locks: {},
    last_updated: null,
  };

  fs.mkdirSync(path.join(rootDir, '.jumpstart', 'state'), { recursive: true });
  const normalizedRegistry = normalizeRegistry(projectsJson);
  assertValidProjectsRegistry(normalizedRegistry);
  fs.writeFileSync(projectsPath, JSON.stringify(normalizedRegistry, null, 2), 'utf8');
  fs.writeFileSync(getWorkspaceStatePath(rootDir), JSON.stringify(workspaceState, null, 2), 'utf8');

  return {
    success: true,
    alreadyMigrated: false,
    mode: 'migrated-root',
    projectsPath,
    workspaceStatePath: getWorkspaceStatePath(rootDir),
    activeProject: DEFAULT_PROJECT_ID,
    projectName: meta.name,
  };
}

module.exports = {
  DEFAULT_PROJECT_ID,
  detectMigrationState,
  getProjectsPath,
  getWorkspaceStatePath,
  readProjectMetadata,
  upgradeToWorkspace,
};
