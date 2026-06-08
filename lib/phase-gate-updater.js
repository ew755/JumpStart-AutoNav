#!/usr/bin/env node

/**
 * phase-gate-updater.js
 * Handles phase gate approvals and project state updates
 * 
 * Usage:
 *   const updater = require('./phase-gate-updater');
 *   const result = updater.approvePhase(context, 'product-brief.md', 'Eric');
 *   console.log(result);
 */

const fs = require('fs');
const path = require('path');
const specLoader = require('./spec-loader');
const workspaceContext = require('./workspace-context');
const { resolveProjectRoot } = require('./workspace-project-paths');

/**
 * Approve a phase and update project state
 * 
 * @param {Object} context - Workspace context
 * @param {string} specPath - Path to the approved spec file
 * @param {string} approverName - Name of approver (e.g., 'Eric')
 * @returns {Object} Update result with status and any errors
 */
function approvePhase(context, specPath, approverName) {
  try {
    // 1. Infer owner project — use context.projectPath directly in multi-project mode
    let ownerProjectId;
    if (context.mode === 'multi-project' && context.project) {
      ownerProjectId = context.project.project_id || context.project.id;
      if (!ownerProjectId) {
        ownerProjectId = specLoader.inferOwnerProject(specPath, context.rootDir || process.cwd());
      }
    } else {
      ownerProjectId = specLoader.inferOwnerProject(specPath, context.rootDir || process.cwd());
    }
    
    // 2. Determine which phase is being approved
    const phase = inferPhaseFromSpec(specPath);
    if (phase === null || phase === undefined) {
      return {
        success: false,
        error: 'Could not determine phase from spec filename',
      };
    }

    // 3. Load the project's current state
    let projectState = {};
    const statePath = getProjectStatePath(context, ownerProjectId);
    
    if (fs.existsSync(statePath)) {
      projectState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }

    // 4. Update state
    const approvalDate = new Date().toISOString().split('T')[0];
    
    projectState.current_phase = phase;
    projectState.last_completed_step = `Phase ${phase} ${getTitleFromPhase(phase)} Approved`;
    projectState.last_phase_approved = approvalDate;
    projectState.approved_by = approverName;
    
    if (!projectState.approved_artifacts) {
      projectState.approved_artifacts = [];
    }
    projectState.approved_artifacts.push({
      artifact: path.basename(specPath),
      phase,
      approved_by: approverName,
      approval_date: approvalDate,
    });

    // 5. Save updated state
    ensureDir(path.dirname(statePath));
    fs.writeFileSync(statePath, JSON.stringify(projectState, null, 2), 'utf8');

    // 6. Check for unblocked dependencies
    const unblocks = checkUnblocks(context, ownerProjectId, phase);

    // 7. Register ADRs after architect phase approval (Phase 3)
    let adrScan = null;
    if (phase === 3 && context.mode === 'multi-project') {
      try {
        const { WorkspaceManager } = require('./workspace-manager');
        const rootDir = context.rootDir || process.cwd();
        const manager = new WorkspaceManager(rootDir);
        adrScan = manager.scanADRs();
      } catch (err) {
        adrScan = { error: err.message };
      }
    }

    return {
      success: true,
      project_id: ownerProjectId,
      phase: phase,
      approved_by: approverName,
      approval_date: approvalDate,
      state_file: statePath,
      unblocked_projects: unblocks,
      adr_scan: adrScan,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Infer phase number from spec filename
 */
function inferPhaseFromSpec(specPath) {
  const filename = path.basename(specPath).toLowerCase();
  
  if (filename.includes('challenger-brief')) return 0;
  if (filename.includes('product-brief')) return 1;
  if (filename.includes('prd')) return 2;
  if (filename.includes('architecture')) return 3;
  if (filename.includes('src') || filename.includes('code')) return 4;
  
  return null;
}

/**
 * Get title for phase
 */
function getTitleFromPhase(phase) {
  const titles = {
    0: 'Challenge',
    1: 'Analyze',
    2: 'Plan',
    3: 'Architect',
    4: 'Build',
  };
  return titles[phase] || 'Unknown';
}

/**
 * Get project state file path
 */
function getProjectStatePath(context, projectId) {
  const rootDir = context.rootDir || process.cwd();

  if (projectId === 'proj-default') {
    return path.join(rootDir, '.jumpstart', 'state', 'state.json');
  }

  const projectsPath = path.join(rootDir, '.jumpstart', 'projects.json');
  const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const project = projects.projects.find(p => (p.id || p.project_id) === projectId);
  
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const projectPath = resolveProjectRoot(rootDir, project, projectId);
  return path.join(projectPath, '.jumpstart', 'state', 'state.json');
}

/**
 * Check if any dependencies can now unblock
 */
function checkUnblocks(context, justApprovedProject, justApprovedPhase) {
  try {
    const workspaceStatePath = path.join(context.rootDir || process.cwd(), '.jumpstart', 'state', 'workspace-state.json');
    
    if (!fs.existsSync(workspaceStatePath)) {
      return [];
    }

    const workspaceState = JSON.parse(fs.readFileSync(workspaceStatePath, 'utf8'));
    const dependencies =
      workspaceState.workspace_resume_context?.cross_project_dependencies ||
      workspaceState.dependencies ||
      [];

    // Find dependencies that depend on the just-approved project
    const unblocked = dependencies.filter(dep => {
      return dep.to === justApprovedProject && 
             dep.blocked && 
             canUnblock(dep, justApprovedPhase);
    });

    // Unblock them
    unblocked.forEach(dep => {
      dep.blocked = false;
      dep.unblock_date = new Date().toISOString().split('T')[0];
    });

    // Save updated workspace state
    fs.writeFileSync(workspaceStatePath, JSON.stringify(workspaceState, null, 2), 'utf8');

    return unblocked.map(dep => dep.from);
  } catch (error) {
    console.warn('Error checking unblocks:', error.message);
    return [];
  }
}

/**
 * Check if a dependency can unblock based on phase requirement
 */
function canUnblock(dependency, approvedPhase) {
  // Parse unblock condition like "Phase 3" or "Phase 4"
  if (!dependency.unblock_condition) {
    return true; // No condition = always unblock
  }

  const match = dependency.unblock_condition.match(/Phase (\d+)/);
  if (!match) {
    return true;
  }

  const requiredPhase = parseInt(match[1], 10);
  return approvedPhase >= requiredPhase;
}

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  approvePhase,
  inferPhaseFromSpec,
  getTitleFromPhase,
  getProjectStatePath,
  checkUnblocks,
  canUnblock,
};
