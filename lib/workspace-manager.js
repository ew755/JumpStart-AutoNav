#!/usr/bin/env node

/**
 * workspace-manager.js
 * Core workspace registry operations for multi-project Jump Start workspaces.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { assertValidProjectsRegistry, normalizeRegistry } = require('./workspace-validator');
const parallel = require('./workspace-parallel');
const cost = require('./workspace-cost');
const adrRegistry = require('./workspace-adr-registry');
const knowledgeGraph = require('./workspace-knowledge-graph');

class WorkspaceManager {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.configPath = path.join(rootDir, '.jumpstart', 'projects.json');
    this.statePath = path.join(rootDir, '.jumpstart', 'state', 'workspace-state.json');
    this.config = this.loadConfig();
    this.state = this.loadState();
  }

  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error('projects.json not found. Run: jumpstart-mode workspace upgrade');
    }
    return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
  }

  loadState() {
    try {
      if (!fs.existsSync(this.statePath)) {
        return {
          version: '1.0.0',
          active_project_id: this.config?.active_project || 'proj-default',
          project_locks: {},
        };
      }
      return JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
    } catch {
      return {
        version: '1.0.0',
        active_project_id: this.config?.active_project || 'proj-default',
        project_locks: {},
      };
    }
  }

  saveConfig() {
    this.config = normalizeRegistry(this.config);
    this.config.last_updated = new Date().toISOString();
    assertValidProjectsRegistry(this.config);
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  saveState() {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  getProjectId(project) {
    return project.id || project.project_id;
  }

  getActiveProject() {
    return this.config.projects.find((project) => this.getProjectId(project) === this.config.active_project);
  }

  status() {
    console.log('\n📊 Workspace Status\n');
    console.log(`Workspace ID: ${this.config.workspace.id}`);
    console.log(`Total Projects: ${this.config.projects.length}`);
    console.log(`Active Project: ${this.config.active_project}\n`);

    console.log('Projects:');
    this.config.projects.forEach((project) => {
      const projectId = this.getProjectId(project);
      const icon = projectId === this.config.active_project ? '▶️' : '  ';
      const locked = project.locked ? '🔒' : '  ';
      console.log(`${icon} ${locked} [${project.status}] ${projectId} — ${project.name}`);
      console.log(`     Path: ${project.path}`);
      if (project.locked) console.log(`     Locked: ${project.lock_reason}`);
    });
    console.log();
  }

  active() {
    const project = this.getActiveProject();
    if (project) {
      const projectId = this.getProjectId(project);
      console.log(`\n✅ Active Project: ${projectId}`);
      console.log(`   Name: ${project.name}`);
      console.log(`   Path: ${project.path}`);
      console.log(`   Status: ${project.status}\n`);
    }
  }

  setActive(projectId) {
    const project = this.config.projects.find((entry) => this.getProjectId(entry) === projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    this.config.active_project = projectId;
    this.state.active_project_id = projectId;
    this.saveConfig();
    this.saveState();
    return project;
  }

  validateDeps() {
    const deps = this.state.workspace_resume_context?.cross_project_dependencies || [];
    const errors = [];

    deps.forEach((dep) => {
      const from = this.config.projects.find((project) => this.getProjectId(project) === dep.from);
      const to = this.config.projects.find((project) => this.getProjectId(project) === dep.to);

      if (!from) errors.push(`Source project not found: ${dep.from}`);
      if (!to) errors.push(`Target project not found: ${dep.to}`);
      if (dep.from === dep.to) errors.push(`Circular dependency: ${dep.from}`);
    });

    return { valid: errors.length === 0, errors, dependencies: deps };
  }

  getTotalTokens() {
    return this.state.workspace_resume_context?.workspace_tokens_used || 0;
  }

  getProjectPhase(projectId) {
    const project = this.config.projects.find((entry) => this.getProjectId(entry) === projectId);
    return project?.phase ?? null;
  }

  isProjectLocked(projectId) {
    return this.state.project_locks?.[projectId]?.locked_by != null;
  }

  lockProject(projectId, agent, ttl = 3600) {
    const advance = this.canAdvanceProject(projectId);
    if (!advance.allowed) {
      throw new Error(advance.reason);
    }

    this.state.project_locks = this.state.project_locks || {};
    this.state.project_locks[projectId] = {
      locked_by: agent,
      locked_at: new Date().toISOString(),
      ttl_seconds: ttl,
    };
    this.saveState();
  }

  unlockProject(projectId) {
    if (this.state.project_locks) {
      delete this.state.project_locks[projectId];
      this.saveState();
    }
  }

  report(format = 'markdown') {
    const totalTokens = this.getTotalTokens();
    const budget = this.state.workspace_resume_context?.workspace_token_budget || 500000;
    const percentUsed = ((totalTokens / budget) * 100).toFixed(2);
    const costSummary = cost.aggregateWorkspaceCosts(this.rootDir, this.config, this.state);

    if (format === 'markdown') {
      console.log(`
# Jump Start Workspace Report

**Workspace:** ${this.config.workspace.id}  
**Generated:** ${new Date().toISOString()}

## Token Usage

- **Total Tokens Used:** ${totalTokens.toLocaleString()}
- **Budget:** ${budget.toLocaleString()}
- **% Used:** ${percentUsed}%

## Per-Project Cost Breakdown

${costSummary.projects.map((row) => `- **${row.project_id}:** ${row.usage.toLocaleString()} / ${row.budget.toLocaleString()} (${row.percent_used.toFixed(1)}%)`).join('\n')}

## Projects

| Project | Status | Phase | Approver |
|---------|--------|-------|----------|
${this.config.projects.map((project) => `| ${project.name} | ${project.status} | ${project.phase ?? 'N/A'} | ${project.approver || 'TBD'} |`).join('\n')}

## Cross-Project Dependencies

${(this.state.workspace_resume_context?.cross_project_dependencies || []).length === 0
  ? 'None configured.'
  : this.state.workspace_resume_context.cross_project_dependencies
      .map((dep) => `- ${dep.from} → ${dep.to} (${dep.type})`).join('\n')}
      `);
      return;
    }

    if (format === 'json') {
      console.log(JSON.stringify({
        workspace: this.config.workspace,
        projects: this.config.projects,
        token_usage: totalTokens,
        token_budget: budget,
        percent_used: percentUsed,
        cost_breakdown: costSummary,
      }, null, 2));
    }
  }

  canAdvanceProject(projectId) {
    return parallel.canAdvanceProject(this.config, this.state, projectId);
  }

  projectsInFlight() {
    return parallel.formatProjectsInFlight(this.config, this.state);
  }

  pauseProject(projectId) {
    const project = this.config.projects.find((entry) => this.getProjectId(entry) === projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    parallel.pauseProject(this.state, projectId);
    this.saveState();
    return { projectId, paused: true };
  }

  resumeProject(projectId) {
    const project = this.config.projects.find((entry) => this.getProjectId(entry) === projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    parallel.resumeProject(this.state, projectId);
    this.saveState();
    return { projectId, paused: false };
  }

  checkBudget(projectId, options = {}) {
    const project = this.config.projects.find((entry) => this.getProjectId(entry) === projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return cost.checkProjectBudget(this.rootDir, project, options);
  }

  costBreakdown() {
    return cost.aggregateWorkspaceCosts(this.rootDir, this.config, this.state);
  }

  adjustBudget(projectId, tokenBudget) {
    const result = cost.setProjectBudget(this.config, projectId, tokenBudget);
    if (!result.success) {
      return result;
    }
    this.saveConfig();
    return result;
  }

  scanADRs() {
    return adrRegistry.scanAndRegisterAll(this.rootDir, this.config);
  }

  adrIndex() {
    return adrRegistry.loadADRRegistry(this.rootDir);
  }

  adrImpacts(adrId) {
    return adrRegistry.getADRImpacts(this.adrIndex(), adrId);
  }

  auditADRAwareness(projectId) {
    return adrRegistry.auditADRAwareness(this.rootDir, this.config, projectId);
  }

  buildKnowledgeGraph() {
    return knowledgeGraph.buildKnowledgeGraph(this.rootDir, this.config, this.state);
  }

  queryGraph(queryString) {
    const graph = this.buildKnowledgeGraph();
    return knowledgeGraph.runGraphQuery(graph, queryString);
  }

  exportGraph(format = 'json') {
    const graph = this.buildKnowledgeGraph();
    if (format === 'graphviz') {
      return knowledgeGraph.toGraphviz(graph);
    }
    return graph;
  }

  validateSync(projectId = null) {
    const projects = projectId
      ? this.config.projects.filter((project) => this.getProjectId(project) === projectId)
      : this.config.projects;

    const drifts = [];

    projects.forEach((project) => {
      const projId = this.getProjectId(project);
      const projectPath = path.join(this.rootDir, project.path || `projects/${projId}`);
      const statePath = path.join(projectPath, '.jumpstart', 'state', 'state.json');

      if (!fs.existsSync(statePath)) {
        drifts.push({
          project_id: projId,
          type: 'missing_state',
          severity: 'warn',
          message: 'No state.json found for project',
        });
        return;
      }

      const actualState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const registryPhase = project.phase ?? project.current_phase ?? 0;
      const actualPhase = actualState.current_phase ?? 0;

      if (registryPhase > actualPhase) {
        drifts.push({
          project_id: projId,
          type: 'registry_ahead',
          severity: 'error',
          registry_phase: registryPhase,
          actual_phase: actualPhase,
          message: `Registry says Phase ${registryPhase}, but actual state is Phase ${actualPhase}`,
        });
      } else if (actualPhase > registryPhase) {
        drifts.push({
          project_id: projId,
          type: 'state_ahead',
          severity: 'error',
          registry_phase: registryPhase,
          actual_phase: actualPhase,
          message: `Actual state is Phase ${actualPhase}, but registry says Phase ${registryPhase}`,
        });
      }

      if (actualPhase >= 0) {
        const specsPath = path.join(projectPath, 'specs');
        const phaseArtifacts = this.getExpectedArtifacts(actualPhase);

        phaseArtifacts.forEach((artifact) => {
          const specPath = path.join(specsPath, artifact);
          if (fs.existsSync(specPath)) {
            const content = fs.readFileSync(specPath, 'utf8');
            const isApproved = content.includes('[x]') && content.includes('Approved by:');

            if (!isApproved && actualState.status === `phase-${actualPhase}`) {
              drifts.push({
                project_id: projId,
                type: 'premature_phase',
                severity: 'warn',
                message: `Phase ${actualPhase} marked as complete, but ${artifact} is not approved`,
              });
            }
          }
        });
      }
    });

    return drifts;
  }

  syncAudit(projectId = null) {
    console.log('\n🔍 Sync Audit\n');

    const drifts = this.validateSync(projectId);

    if (drifts.length === 0) {
      console.log('✅ No drift detected. Registry and state files are in sync.\n');
      return drifts;
    }

    console.log(`⚠️  ${drifts.length} drift(s) detected:\n`);

    drifts.forEach((drift) => {
      const icon = drift.severity === 'error' ? '❌' : '⚠️ ';
      console.log(`${icon} [${drift.project_id}] ${drift.message}`);
      if (drift.registry_phase !== undefined) {
        console.log(`   Registry Phase: ${drift.registry_phase}`);
        console.log(`   Actual Phase: ${drift.actual_phase}`);
      }
    });

    console.log('\nRecommendations:');
    drifts.forEach((drift) => {
      if (drift.type === 'registry_ahead') {
        console.log('  - Run: workspace sync --pull  (to update registry to actual state)');
      } else if (drift.type === 'state_ahead') {
        console.log(`  - Review: ${drift.project_id} state files may have been auto-updated`);
      }
    });
    console.log();
    return drifts;
  }

  syncPull(projectId = null) {
    console.log('\n⬇️  Pulling state into registry\n');

    const projects = projectId
      ? this.config.projects.filter((project) => this.getProjectId(project) === projectId)
      : this.config.projects;

    let updated = 0;
    const errors = [];

    projects.forEach((project) => {
      const projId = this.getProjectId(project);
      const projectPath = path.join(this.rootDir, project.path || `projects/${projId}`);
      const statePath = path.join(projectPath, '.jumpstart', 'state', 'state.json');

      if (!fs.existsSync(statePath)) {
        console.log(`⏭️  Skipping ${projId} (no state.json)`);
        return;
      }

      try {
        const actualState = JSON.parse(fs.readFileSync(statePath, 'utf8'));

        project.phase = actualState.current_phase || 0;
        project.current_phase = actualState.current_phase || 0;
        project.status = `phase-${actualState.current_phase || 0}`;
        project.last_phase_approved = actualState.last_phase_approved;
        project.approved_by = actualState.approved_by;

        console.log(`✅ Updated ${projId}: Phase ${project.current_phase}`);
        updated++;
      } catch (error) {
        errors.push({
          project_id: projId,
          error: error.message,
        });
        console.log(`❌ Failed to update ${projId}: ${error.message}`);
      }
    });

    this.saveConfig();
    console.log(`\n✅ Synced ${updated} project(s).\n`);

    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} error(s) during sync.\n`);
    }

    return { updated, errors };
  }

  syncPush(projectId = null, force = false) {
    if (!force) {
      console.log('❌ --push requires --force flag (destructive operation)\n');
      console.log('Usage: workspace sync --push [--project-id proj-name] --force\n');
      return { updated: 0, errors: [], backups: [] };
    }

    console.log('\n⬆️  Pushing registry into state files\n');

    const projects = projectId
      ? this.config.projects.filter((project) => this.getProjectId(project) === projectId)
      : this.config.projects;

    let updated = 0;
    const errors = [];
    const backups = [];

    projects.forEach((project) => {
      const projId = this.getProjectId(project);
      const projectPath = path.join(this.rootDir, project.path || `projects/${projId}`);
      const statePath = path.join(projectPath, '.jumpstart', 'state', 'state.json');
      const stateDir = path.dirname(statePath);

      try {
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }

        if (fs.existsSync(statePath)) {
          const backupPath = this.backupStateFile(statePath, projId);
          backups.push({ project_id: projId, backup: backupPath });
          console.log(`📦 Backed up ${projId} state → ${path.relative(this.rootDir, backupPath)}`);
        }

        const existingState = fs.existsSync(statePath)
          ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
          : {};

        const newState = {
          ...existingState,
          current_phase: project.phase ?? project.current_phase ?? 0,
          status: project.status,
          last_phase_approved: project.last_phase_approved,
          approved_by: project.approved_by,
        };

        fs.writeFileSync(statePath, JSON.stringify(newState, null, 2), 'utf8');
        console.log(`✅ Updated ${projId}: Phase ${project.current_phase ?? project.phase}`);
        updated++;
      } catch (error) {
        errors.push({
          project_id: projId,
          error: error.message,
        });
        console.log(`❌ Failed to update ${projId}: ${error.message}`);
      }
    });

    console.log(`\n✅ Synced ${updated} project(s).\n`);

    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} error(s) during sync.\n`);
    }

    return { updated, errors, backups };
  }

  backupStateFile(statePath, projectId) {
    const archiveDir = path.join(this.rootDir, '.jumpstart', 'archive', 'workspace-sync');
    fs.mkdirSync(archiveDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(archiveDir, `${projectId}-state-${timestamp}.json`);
    fs.copyFileSync(statePath, backupPath);
    return backupPath;
  }

  getExpectedArtifacts(phase) {
    const phaseArtifacts = {
      0: ['challenger-brief.md'],
      1: ['product-brief.md'],
      2: ['prd.md'],
      3: ['architecture.md', 'implementation-plan.md'],
      4: [],
    };
    return phaseArtifacts[phase] || [];
  }

  createProject(opts) {
    const args = opts.reduce((acc, arg) => {
      if (arg.startsWith('--id=')) acc.id = arg.split('=')[1];
      if (arg.startsWith('--name=')) acc.name = arg.split('=')[1];
      if (arg.startsWith('--type=')) acc.type = arg.split('=')[1];
      if (arg.startsWith('--approver=')) acc.approver = arg.split('=')[1];
      return acc;
    }, {});

    if (!args.id || !args.name || !args.type) {
      return {
        success: false,
        error: 'Missing required arguments: --id, --name, --type',
      };
    }

    if (!/^proj-[a-z0-9-]+$/.test(args.id)) {
      return {
        success: false,
        error: 'Invalid project ID. Must match: ^proj-[a-z0-9-]+$',
      };
    }

    if (this.config.projects.find((project) => this.getProjectId(project) === args.id)) {
      return {
        success: false,
        error: `Project already exists: ${args.id}`,
      };
    }

    const projectPath = `projects/${args.id}`;
    const projectFullPath = path.join(this.rootDir, projectPath);

    const dirs = [
      path.join(projectFullPath, '.jumpstart', 'state'),
      path.join(projectFullPath, 'specs', 'decisions'),
      path.join(projectFullPath, 'specs', 'insights'),
      path.join(projectFullPath, 'src'),
      path.join(projectFullPath, 'tests'),
    ];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    const stateJson = {
      version: '1.0.0',
      current_phase: null,
      approved_artifacts: [],
      resume_context: {
        tldr: null,
        last_action: null,
        next_action: null,
        next_command: null,
        open_questions: [],
        key_insights: [],
        last_agent: null,
        last_phase: null,
        last_step: null,
      },
    };

    fs.writeFileSync(
      path.join(projectFullPath, '.jumpstart', 'state', 'state.json'),
      JSON.stringify(stateJson, null, 2)
    );

    const configJson = {
      project: {
        id: args.id,
        name: args.name,
        type: args.type,
        approver: args.approver || 'TBD',
        domain: null,
        description: null,
      },
      workflow: {
        enforce_sequential_phases: true,
        qa_log: true,
      },
      agents: {
        challenger: { enabled: true },
        analyst: { enabled: true },
        pm: { enabled: true },
        architect: { enabled: true },
        developer: { enabled: true },
      },
    };

    fs.writeFileSync(
      path.join(projectFullPath, '.jumpstart', 'config.yaml'),
      yaml.stringify(configJson)
    );

    this.config.projects.push({
      id: args.id,
      name: args.name,
      path: projectPath,
      status: 'initializing',
      phase: null,
      type: args.type,
      approver: args.approver || 'TBD',
      locked: false,
      created_date: new Date().toISOString().split('T')[0],
      config_path: `${projectPath}/.jumpstart/config.yaml`,
    });

    this.saveConfig();

    return {
      success: true,
      projectId: args.id,
      projectPath,
    };
  }

  archive(projectId) {
    const project = this.config.projects.find((entry) => this.getProjectId(entry) === projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (project.status === 'archived') {
      return { success: true, alreadyArchived: true, projectId };
    }

    project.status = 'archived';
    project.archived_date = new Date().toISOString().split('T')[0];
    this.saveConfig();

    return { success: true, alreadyArchived: false, projectId };
  }

  unarchive(projectId) {
    const project = this.config.projects.find((entry) => this.getProjectId(entry) === projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (project.status !== 'archived') {
      return { success: true, alreadyActive: true, projectId };
    }

    project.status = 'initializing';
    delete project.archived_date;
    this.saveConfig();

    return { success: true, alreadyActive: false, projectId };
  }

  removeProject(projectId, options = {}) {
    const { confirm = false, deleteFiles = false } = options;

    if (!confirm) {
      return {
        success: false,
        error: 'Removal requires --confirm flag. Use: workspace remove-project <id> --confirm',
      };
    }

    const project = this.config.projects.find((entry) => this.getProjectId(entry) === projectId);
    if (!project) {
      return { success: false, error: `Project not found: ${projectId}` };
    }

    if (this.getProjectId(this.getActiveProject() || {}) === projectId && this.config.projects.length > 1) {
      return {
        success: false,
        error: `Cannot remove active project. Run: workspace set-active <other-id> first`,
      };
    }

    const deps = this.state.workspace_resume_context?.cross_project_dependencies || [];
    const blockingDeps = deps.filter(
      (dep) => dep.from === projectId || dep.to === projectId
    );
    if (blockingDeps.length > 0) {
      return {
        success: false,
        error: `Project has ${blockingDeps.length} cross-project dependency reference(s). Update workspace-state.json first.`,
      };
    }

    const projectPath = project.path || `projects/${projectId}`;
    this.config.projects = this.config.projects.filter(
      (entry) => this.getProjectId(entry) !== projectId
    );

    if (this.config.active_project === projectId) {
      const fallback = this.config.projects[0];
      this.config.active_project = fallback ? this.getProjectId(fallback) : null;
      this.state.active_project_id = this.config.active_project;
    }

    this.saveConfig();
    this.saveState();

    let deletedPath = null;
    if (deleteFiles && projectPath !== '.' && projectPath.startsWith('projects/')) {
      const fullPath = path.join(this.rootDir, projectPath);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        deletedPath = projectPath;
      }
    }

    return {
      success: true,
      projectId,
      removedFromRegistry: true,
      deletedPath,
      activeProject: this.config.active_project,
    };
  }
}

module.exports = {
  WorkspaceManager,
};
