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

/**
 * Detect if running in multi-project workspace mode
 * Returns true if .jumpstart/projects.json exists
 */
function detectWorkspaceMode(rootDir = process.cwd()) {
  const projectsPath = path.join(rootDir, '.jumpstart', 'projects.json');
  return fs.existsSync(projectsPath);
}

/**
 * Load active project metadata from workspace-state.json
 */
function loadActiveProject(rootDir = process.cwd()) {
  try {
    const statePath = path.join(rootDir, '.jumpstart', 'state', 'workspace-state.json');
    const projectsPath = path.join(rootDir, '.jumpstart', 'projects.json');
    
    if (!fs.existsSync(statePath) || !fs.existsSync(projectsPath)) {
      return null;
    }

    const workspaceState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    
    const activeProjectId = workspaceState.active_project_id;
    const activeProject = projects.projects.find(p => (p.id || p.project_id) === activeProjectId);
    
    if (!activeProject) {
      throw new Error(`Active project ${activeProjectId} not found in projects.json`);
    }
    
    return {
      ...activeProject,
      project_id: activeProject.id || activeProject.project_id,
      rootDir,
      projectPath: path.join(rootDir, activeProject.path || `projects/${activeProjectId}`),
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

    // Note: In production, parse YAML properly. For now, return path.
    // Assumes agent runtime will parse YAML
    return {
      path: configPath,
      project_id: project.id || project.project_id,
      project_name: project.name,
      project_approver: project.approver,
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
  const isWorkspace = detectWorkspaceMode(rootDir);
  
  if (!isWorkspace) {
    return {
      mode: 'single-project',
      workspace: false,
      project: null,
      rootDir,
    };
  }

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

/**
 * Display workspace mode info
 */
function printContext(context) {
  if (context.mode === 'single-project') {
    console.log('ℹ️  Single-project mode (no projects.json)');
  } else if (context.mode === 'workspace-no-active') {
    console.log('⚠️  Workspace mode but no active project set');
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
  loadProjectConfig,
  loadProjectState,
  mergeConfigs,
  getWorkspaceContext,
  printContext,
};
