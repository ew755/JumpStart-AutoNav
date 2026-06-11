#!/usr/bin/env node

/**
 * workspace-context.js
 * Detects and manages multi-project workspace context
 * 
 * Usage:
 *   const ctx = require('./workspace-context');
 *   const isWorkspace = ctx.detectWorkspaceMode();
 *   if (isWorkspace) {
 *     const project = ctx.loadActiveProject();
 *     const config = ctx.mergeConfigs(project);
 *   }
 */

const fs = require('fs');
const path = require('path');
const {
  resolveProjectRoot,
  toPosixRelative,
} = require('./workspace-project-paths');
const { readHubLink, resolveHubRootFromLink, writeHubLink, writeSiblingIdeStubs } = require('./workspace-hub-link');
const yaml = require('yaml');

/**
 * Detect if running in multi-project workspace mode
 * Returns true if .jumpstart/projects.json exists
 */
function detectWorkspaceMode(rootDir = process.cwd()) {
  const projectsPath = path.join(rootDir, '.jumpstart', 'projects.json');
  return fs.existsSync(projectsPath);
}

function loadProjectFromRegistry(hubRoot, projectId, { linkedRoot = null } = {}) {
  const projectsPath = path.join(hubRoot, '.jumpstart', 'projects.json');
  const statePath = path.join(hubRoot, '.jumpstart', 'state', 'workspace-state.json');

  if (!fs.existsSync(projectsPath)) {
    return null;
  }

  const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const project = projects.projects.find((p) => (p.id || p.project_id) === projectId);

  if (!project) {
    return null;
  }

  const projectPath = linkedRoot || resolveProjectRoot(hubRoot, project, projectId);

  return {
    ...project,
    project_id: project.id || project.project_id,
    rootDir: hubRoot,
    hubRoot,
    linkedRoot,
    projectPath,
  };
}

/**
 * Load active project metadata. The registry (projects.json active_project)
 * is the single source of truth.
 */
function loadActiveProject(rootDir = process.cwd()) {
  try {
    const projectsPath = path.join(rootDir, '.jumpstart', 'projects.json');

    if (!fs.existsSync(projectsPath)) {
      return null;
    }

    const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

    const activeProjectId = projects.active_project;
    if (!activeProjectId) {
      return null;
    }

    const activeProject = projects.projects.find(p => (p.id || p.project_id) === activeProjectId);

    if (!activeProject) {
      throw new Error(`Active project ${activeProjectId} not found in projects.json`);
    }
    
    return {
      ...activeProject,
      project_id: activeProject.id || activeProject.project_id,
      rootDir,
      projectPath: resolveProjectRoot(rootDir, activeProject, activeProjectId),
    };
  } catch (error) {
    console.error('Error loading active project:', error.message);
    return null;
  }
}

/**
 * Load project-scoped configuration
 */
function loadProjectConfig(project, rootDir = process.cwd()) {
  try {
    const configPath = path.join(project.projectPath, '.jumpstart', 'config.yaml');
    
    if (!fs.existsSync(configPath)) {
      console.warn(`Project config not found: ${configPath}`);
      return null;
    }

    const parsed = yaml.parse(fs.readFileSync(configPath, 'utf8')) || {};

    return {
      path: configPath,
      project_id: project.id || project.project_id,
      project_name: parsed.project?.name || project.name,
      project_approver: parsed.project?.approver || project.approver,
      project_type: parsed.project?.type || project.type,
      domain: parsed.project?.domain || null,
      workflow: parsed.workflow || {},
      agents: parsed.agents || {},
      parsed,
    };
  } catch (error) {
    console.error('Error loading project config:', error.message);
    return null;
  }
}

/**
 * Load project-scoped state
 */
function loadProjectState(project, rootDir = process.cwd()) {
  try {
    const statePath = path.join(project.projectPath, '.jumpstart', 'state', 'state.json');
    
    if (!fs.existsSync(statePath)) {
      return {
        current_phase: null,
        approved_artifacts: [],
        resume_context: {},
      };
    }

    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    console.error('Error loading project state:', error.message);
    return null;
  }
}

/**
 * Merge project config with workspace defaults
 */
function mergeConfigs(project, workspaceConfig = {}) {
  const projectConfig = loadProjectConfig(project);
  
  return {
    workspace: workspaceConfig,
    project: projectConfig,
    active_project_id: project.id || project.project_id,
    specs_path: path.join(project.projectPath, 'specs'),
    src_path: path.join(project.projectPath, 'src'),
    tests_path: path.join(project.projectPath, 'tests'),
    state_path: path.join(project.projectPath, '.jumpstart', 'state'),
  };
}

/**
 * Get full workspace context
 */
function getWorkspaceContext(rootDir = process.cwd()) {
  if (detectWorkspaceMode(rootDir)) {
    const activeProject = loadActiveProject(rootDir);
    if (!activeProject) {
      return {
        mode: 'workspace-no-active',
        workspace: true,
        project: null,
        rootDir,
      };
    }

    const projectState = loadProjectState(activeProject, rootDir);
    const mergedConfig = mergeConfigs(activeProject);

    return {
      mode: 'multi-project',
      workspace: true,
      project: activeProject,
      state: projectState,
      config: mergedConfig,
      rootDir,
    };
  }

  const hubLink = readHubLink(rootDir);
  if (hubLink?.project_id && hubLink?.hub_root) {
    const hubRoot = resolveHubRootFromLink(rootDir, hubLink);
    if (!hubRoot || !detectWorkspaceMode(hubRoot)) {
      return {
        mode: 'sibling-broken-link',
        workspace: true,
        project: null,
        rootDir,
        linkedRoot: rootDir,
        hubRoot: hubRoot || null,
        hubRootRel: hubLink.hub_root,
        error: 'Hub registry not found. Check hub_root in .jumpstart/hub-link.json.',
      };
    }

    const project = loadProjectFromRegistry(hubRoot, hubLink.project_id, { linkedRoot: rootDir });
    if (!project) {
      return {
        mode: 'sibling-broken-link',
        workspace: true,
        project: null,
        rootDir,
        linkedRoot: rootDir,
        hubRoot,
        hubRootRel: hubLink.hub_root,
        error: `Project ${hubLink.project_id} not found in hub registry.`,
      };
    }

    const projectState = loadProjectState(project, hubRoot);
    const mergedConfig = mergeConfigs(project);

    return {
      mode: 'sibling-linked',
      workspace: true,
      hubRoot,
      hubRootRel: hubLink.hub_root,
      linkedRoot: rootDir,
      rootDir: hubRoot,
      project,
      state: projectState,
      config: mergedConfig,
    };
  }

  return {
    mode: 'single-project',
    workspace: false,
    project: null,
    rootDir,
  };
}

/**
 * Display workspace mode info
 */
function printContext(context) {
  if (context.mode === 'single-project') {
    console.log('ℹ️  Single-project mode (no projects.json)');
  } else   if (context.mode === 'workspace-no-active') {
    console.log('⚠️  Workspace mode but no active project set');
  } else if (context.mode === 'sibling-linked') {
    console.log('✓ Sibling-linked mode');
    console.log(`  Hub: ${context.hubRootRel}`);
    console.log(`  Project: ${context.project.project_id} (${context.project.name})`);
    console.log(`  Specs path: ${context.config.specs_path}`);
  } else if (context.mode === 'sibling-broken-link') {
    console.log(`⚠️  Broken hub link: ${context.error}`);
  } else {
    console.log(`✓ Workspace mode`);
    console.log(`  Active project: ${context.project.project_id} (${context.project.name})`);
    console.log(`  Current phase: ${context.state?.current_phase || 'null'}`);
    console.log(`  Specs path: ${context.config.specs_path}`);
  }
}

module.exports = {
  detectWorkspaceMode,
  loadActiveProject,
  loadProjectFromRegistry,
  loadProjectConfig,
  loadProjectState,
  mergeConfigs,
  getWorkspaceContext,
  printContext,
};
