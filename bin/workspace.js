#!/usr/bin/env node
/**
 * Jump Start Workspace CLI
 * 
 * Commands for managing multi-project workflows:
 * - jumpstart-mode workspace status
 * - jumpstart-mode workspace active
 * - jumpstart-mode workspace set-active <project-id>
 * - jumpstart-mode workspace validate-deps
 * - jumpstart-mode workspace report [--format markdown|json]
 * - jumpstart-mode workspace archive <project-id>
 * - jumpstart-mode workspace create-project --id <id> --name <name> --type <greenfield|brownfield>
 * - jumpstart-mode workspace remove-project <project-id>
 * - jumpstart-mode workspace pit-crew --review-type <type> --projects <ids>
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_CONFIG_PATH = path.resolve(process.cwd(), '.jumpstart', 'projects.json');
const WORKSPACE_STATE_PATH = path.resolve(process.cwd(), '.jumpstart', 'state', 'workspace-state.json');

class WorkspaceManager {
  constructor() {
    this.config = this.loadConfig();
    this.state = this.loadState();
  }

  loadConfig() {
    try {
      return JSON.parse(fs.readFileSync(WORKSPACE_CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.error('❌ Error loading projects.json:', e.message);
      process.exit(1);
    }
  }

  loadState() {
    try {
      return JSON.parse(fs.readFileSync(WORKSPACE_STATE_PATH, 'utf8'));
    } catch (e) {
      return { version: '1.0.0', active_project_id: 'proj-default', project_locks: {} };
    }
  }

  saveConfig() {
    fs.writeFileSync(WORKSPACE_CONFIG_PATH, JSON.stringify(this.config, null, 2));
  }

  saveState() {
    fs.writeFileSync(WORKSPACE_STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  status() {
    console.log('\n📊 Workspace Status\n');
    console.log(`Workspace ID: ${this.config.workspace.id}`);
    console.log(`Total Projects: ${this.config.projects.length}`);
    console.log(`Active Project: ${this.config.active_project}\n`);
    
    console.log('Projects:');
    this.config.projects.forEach(p => {
      const icon = p.id === this.config.active_project ? '▶️' : '  ';
      const locked = p.locked ? '🔒' : '  ';
      console.log(`${icon} ${locked} [${p.status}] ${p.id} — ${p.name}`);
      console.log(`     Path: ${p.path}`);
      if (p.locked) console.log(`     Locked: ${p.lock_reason}`);
    });
    console.log();
  }

  active() {
    const proj = this.config.projects.find(p => p.id === this.config.active_project);
    if (proj) {
      console.log(`\n✅ Active Project: ${proj.id}`);
      console.log(`   Name: ${proj.name}`);
      console.log(`   Path: ${proj.path}`);
      console.log(`   Status: ${proj.status}\n`);
    }
  }

  setActive(projectId) {
    const proj = this.config.projects.find(p => p.id === projectId);
    if (!proj) {
      console.error(`❌ Project not found: ${projectId}`);
      process.exit(1);
    }
    this.config.active_project = projectId;
    this.state.active_project_id = projectId;
    this.saveConfig();
    this.saveState();
    console.log(`✅ Active project set to: ${projectId}`);
  }

  validateDeps() {
    console.log('\n🔗 Validating Cross-Project Dependencies\n');
    const deps = this.state.workspace_resume_context?.cross_project_dependencies || [];
    
    if (deps.length === 0) {
      console.log('✅ No cross-project dependencies configured.\n');
      return;
    }

    deps.forEach(dep => {
      const fromProj = this.config.projects.find(p => p.id === dep.from);
      const toProj = this.config.projects.find(p => p.id === dep.to);
      
      if (!fromProj || !toProj) {
        console.log(`❌ Invalid dependency: ${dep.from} → ${dep.to} (project not found)`);
        return;
      }

      if (dep.type === 'usage_log_aggregation') {
        console.log(`✅ Aggregation: ${fromProj.name} ← ${toProj.name}`);
      } else {
        console.log(`ℹ️  ${dep.type}: ${fromProj.name} → ${toProj.name}`);
      }
    });
    console.log();
  }

  report(format = 'markdown') {
    const totalTokens = this.state.workspace_resume_context?.workspace_tokens_used || 0;
    const budget = this.state.workspace_resume_context?.workspace_token_budget || 500000;
    const percentUsed = ((totalTokens / budget) * 100).toFixed(2);

    if (format === 'markdown') {
      console.log(`
# Jump Start Workspace Report

**Workspace:** ${this.config.workspace.id}  
**Generated:** ${new Date().toISOString()}

## Token Usage

- **Total Tokens Used:** ${totalTokens.toLocaleString()}
- **Budget:** ${budget.toLocaleString()}
- **% Used:** ${percentUsed}%

## Projects

| Project | Status | Phase | Approver |
|---------|--------|-------|----------|
${this.config.projects.map(p => `| ${p.name} | ${p.status} | ${p.phase ?? 'N/A'} | ${p.approver || 'TBD'} |`).join('\n')}

## Cross-Project Dependencies

${(this.state.workspace_resume_context?.cross_project_dependencies || []).length === 0 
  ? 'None configured.' 
  : this.state.workspace_resume_context.cross_project_dependencies
      .map(d => `- ${d.from} → ${d.to} (${d.type})`).join('\n')}
      `);
    } else if (format === 'json') {
      console.log(JSON.stringify({
        workspace: this.config.workspace,
        projects: this.config.projects,
        token_usage: totalTokens,
        token_budget: budget,
        percent_used: percentUsed
      }, null, 2));
    }
  }

  /**
   * Validate sync between projects.json and actual state.json files
   * Returns array of drift reports
   */
  validateSync(projectId = null) {
    const projects = projectId 
      ? this.config.projects.filter(p => (p.id || p.project_id) === projectId)
      : this.config.projects;

    const drifts = [];

    projects.forEach(proj => {
      const projId = proj.id || proj.project_id;
      const projectPath = path.join(process.cwd(), proj.path || `projects/${projId}`);
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
      const registryPhase = proj.phase ?? proj.current_phase ?? 0;
      const actualPhase = actualState.current_phase ?? 0;

      // Check for phase drift
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

      // Check if phase gate is actually approved
      if (actualPhase >= 0) {
        const specsPath = path.join(projectPath, 'specs');
        const phaseArtifacts = this.getExpectedArtifacts(actualPhase);
        
        phaseArtifacts.forEach(artifact => {
          const specPath = path.join(specsPath, artifact);
          if (fs.existsSync(specPath)) {
            const content = fs.readFileSync(specPath, 'utf8');
            const isApproved = content.includes('[x]') && content.includes('Approved by:');
            
            if (!isApproved && actualState.status === 'phase-' + actualPhase) {
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

  /**
   * Sync --audit: Report drift without changing anything
   */
  syncAudit(projectId = null) {
    console.log('\n🔍 Sync Audit\n');
    
    const drifts = this.validateSync(projectId);
    
    if (drifts.length === 0) {
      console.log('✅ No drift detected. Registry and state files are in sync.\n');
      return;
    }

    console.log(`⚠️  ${drifts.length} drift(s) detected:\n`);
    
    drifts.forEach(drift => {
      const icon = drift.severity === 'error' ? '❌' : '⚠️ ';
      console.log(`${icon} [${drift.project_id}] ${drift.message}`);
      if (drift.registry_phase !== undefined) {
        console.log(`   Registry Phase: ${drift.registry_phase}`);
        console.log(`   Actual Phase: ${drift.actual_phase}`);
      }
    });

    console.log('\nRecommendations:');
    drifts.forEach(drift => {
      if (drift.type === 'registry_ahead') {
        console.log(`  - Run: workspace sync --pull  (to update registry to actual state)`);
      } else if (drift.type === 'state_ahead') {
        console.log(`  - Review: ${drift.project_id} state files may have been auto-updated`);
      }
    });
    console.log();
  }

  /**
   * Sync --pull: Update projects.json from actual state files
   */
  syncPull(projectId = null) {
    console.log('\n⬇️  Pulling state into registry\n');

    const projects = projectId
      ? this.config.projects.filter(p => (p.id || p.project_id) === projectId)
      : this.config.projects;

    let updated = 0;
    const errors = [];

    projects.forEach(proj => {
      const projId = proj.id || proj.project_id;
      const projectPath = path.join(process.cwd(), proj.path || `projects/${projId}`);
      const statePath = path.join(projectPath, '.jumpstart', 'state', 'state.json');
      
      if (!fs.existsSync(statePath)) {
        console.log(`⏭️  Skipping ${projId} (no state.json)`);
        return;
      }

      try {
        const actualState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        
        proj.phase = actualState.current_phase || 0;
        proj.current_phase = actualState.current_phase || 0;
        proj.status = `phase-${actualState.current_phase || 0}`;
        proj.last_phase_approved = actualState.last_phase_approved;
        proj.approved_by = actualState.approved_by;
        
        console.log(`✅ Updated ${projId}: Phase ${proj.current_phase}`);
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
  }

  /**
   * Sync --push: Update state files from projects.json
   */
  syncPush(projectId = null, force = false) {
    if (!force) {
      console.log('❌ --push requires --force flag (destructive operation)\n');
      console.log('Usage: workspace sync --push [--project-id proj-name] --force\n');
      return;
    }

    console.log('\n⬆️  Pushing registry into state files\n');

    const projects = projectId
      ? this.config.projects.filter(p => (p.id || p.project_id) === projectId)
      : this.config.projects;

    let updated = 0;
    const errors = [];

    projects.forEach(proj => {
      const projId = proj.id || proj.project_id;
      const projectPath = path.join(process.cwd(), proj.path || `projects/${projId}`);
      const statePath = path.join(projectPath, '.jumpstart', 'state', 'state.json');
      const stateDir = path.dirname(statePath);

      try {
        // Ensure directory exists
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }

        const newState = {
          current_phase: proj.phase || proj.current_phase || 0,
          status: proj.status,
          last_phase_approved: proj.last_phase_approved,
          approved_by: proj.approved_by,
          approved_artifacts: [],
          resume_context: {},
        };

        fs.writeFileSync(statePath, JSON.stringify(newState, null, 2), 'utf8');
        console.log(`✅ Updated ${projId}: Phase ${proj.current_phase || proj.phase}`);
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
  }

  /**
   * Get expected artifact filenames for a phase
   */
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

  /**
   * Create a new project in the workspace
   */
  createProject(opts) {
    const args = opts.reduce((acc, arg) => {
      if (arg.startsWith('--id=')) acc.id = arg.split('=')[1];
      if (arg.startsWith('--name=')) acc.name = arg.split('=')[1];
      if (arg.startsWith('--type=')) acc.type = arg.split('=')[1];
      if (arg.startsWith('--approver=')) acc.approver = arg.split('=')[1];
      return acc;
    }, {});

    if (!args.id || !args.name || !args.type) {
      console.log(`
Usage: workspace create-project --id=<id> --name=<name> --type=<greenfield|brownfield> [--approver=<name>]

Options:
  --id=<id>           Project ID (e.g., proj-new-feature)
  --name=<name>       Human-readable project name
  --type=<type>       greenfield or brownfield
  --approver=<name>   Project approver name (optional)

Examples:
  workspace create-project --id=proj-newfeature --name="New Feature" --type=greenfield --approver=Sarah
      `);
      return;
    }

    try {
      // Validate project ID format
      if (!/^proj-[a-z0-9-]+$/.test(args.id)) {
        console.error(`❌ Invalid project ID. Must match: ^proj-[a-z0-9-]+$`);
        return;
      }

      // Check if project already exists
      if (this.config.projects.find(p => (p.id || p.project_id) === args.id)) {
        console.error(`❌ Project already exists: ${args.id}`);
        return;
      }

      // Create project path
      const projectPath = `projects/${args.id}`;
      const projectFullPath = path.join(process.cwd(), projectPath);

      // Create project directories
      const dirs = [
        path.join(projectFullPath, '.jumpstart', 'state'),
        path.join(projectFullPath, 'specs', 'decisions'),
        path.join(projectFullPath, 'specs', 'insights'),
        path.join(projectFullPath, 'src'),
        path.join(projectFullPath, 'tests'),
      ];

      dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Create initial state.json
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

      // Create initial config.yaml (as JSON placeholder, would be YAML in production)
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
        JSON.stringify(configJson, null, 2)  // Would be YAML in production
      );

      // Add to projects registry
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
      });

      this.saveConfig();

      console.log(`
✅ Project created: ${args.id}

Created:
  - Project path: ${projectPath}
  - Initial state: ${projectPath}/.jumpstart/state/state.json
  - Config: ${projectPath}/.jumpstart/config.yaml
  - Directories: specs/, src/, tests/

Next steps:
  1. Run: workspace set-active ${args.id}
  2. Run: /jumpstart.challenge (start Phase 0)
      `);
    } catch (error) {
      console.error(`❌ Failed to create project: ${error.message}`);
    }
  }

  /**
   * Archive a completed project (soft-delete)
   */
  archive(projectId) {
    try {
      const proj = this.config.projects.find(p => (p.id || p.project_id) === projectId);
      if (!proj) {
        console.error(`❌ Project not found: ${projectId}`);
        return;
      }

      if (proj.status === 'archived') {
        console.log(`ℹ️  Project already archived: ${projectId}`);
        return;
      }

      // Update project status
      proj.status = 'archived';
      proj.archived_date = new Date().toISOString().split('T')[0];

      this.saveConfig();

      console.log(`
✅ Project archived: ${projectId}

Archived projects:
  - Still in projects.json (not deleted)
  - Can be unarchived: workspace unarchive ${projectId}
  - Won't appear in 'workspace status' default view
  - Dependency validation skips archived projects

To restore:
  - Update status back to 'phase-N' or 'initializing'
  - Or run: workspace unarchive ${projectId}
      `);
    } catch (error) {
      console.error(`❌ Failed to archive project: ${error.message}`);
    }
  }

  /**
   * Remove a project completely
   */
  removeProject(projectId) {
    console.log(`
⚠️  WARNING: This will permanently remove ${projectId} from projects.json

Before removing, consider:
  - Is this project archived? (archive instead of remove)
  - Are there dependencies on this project? (check: workspace validate-deps)
  - Do you have a backup of projects.json?

Usage: workspace remove-project ${projectId} --confirm

Options:
  --confirm   Required to proceed with removal
    `);
  }

  /**
   * Unarchive a previously archived project
   */
  unarchive(projectId) {
    try {
      const proj = this.config.projects.find(p => (p.id || p.project_id) === projectId);
      if (!proj) {
        console.error(`❌ Project not found: ${projectId}`);
        return;
      }

      if (proj.status !== 'archived') {
        console.log(`ℹ️  Project is not archived: ${projectId}`);
        return;
      }

      // Restore to initializing status
      proj.status = 'initializing';
      delete proj.archived_date;

      this.saveConfig();

      console.log(`✅ Project unarchived: ${projectId}`);
    } catch (error) {
      console.error(`❌ Failed to unarchive project: ${error.message}`);
    }
  }

  pitCrew(opts) {
    console.log(`⏳ Pit Crew integration coming in v1.2\n`);
  }
}

// Main CLI
const command = process.argv[2];
const subcommand = process.argv[3];
const manager = new WorkspaceManager();

// Parse flags for sync commands
const hasForce = process.argv.includes('--force');
const projectIdArg = process.argv.find(arg => arg.startsWith('--project-id='));
const projectIdValue = projectIdArg ? projectIdArg.split('=')[1] : null;

switch (command) {
  case 'status':
    manager.status();
    break;
  case 'active':
    manager.active();
    break;
  case 'set-active':
    manager.setActive(subcommand);
    break;
  case 'validate-deps':
    manager.validateDeps();
    break;
  case 'report':
    const format = process.argv[4]?.replace('--format=', '') || 'markdown';
    manager.report(format);
    break;
  case 'sync':
    if (subcommand === '--audit') {
      manager.syncAudit(projectIdValue);
    } else if (subcommand === '--pull') {
      manager.syncPull(projectIdValue);
    } else if (subcommand === '--push') {
      manager.syncPush(projectIdValue, hasForce);
    } else {
      console.log(`
Jump Start Workspace Sync Commands

Usage: jumpstart-mode workspace sync <mode> [options]

Modes:
  --audit             Detect drift between registry and state (report-only)
  --pull              Update registry from actual state files
  --push              Update state files from registry (requires --force)

Options:
  --project-id=<id>   Sync only this project (default: all projects)
  --force             Required for destructive operations (--push)

Examples:
  jumpstart-mode workspace sync --audit
  jumpstart-mode workspace sync --pull
  jumpstart-mode workspace sync --push --project-id=proj-token-analytics --force
      `);
    }
    break;
  case 'archive':
    manager.archive(subcommand);
    break;
  case 'unarchive':
    manager.unarchive(subcommand);
    break;
  case 'create-project':
    manager.createProject(process.argv.slice(3));
    break;
  case 'remove-project':
    manager.removeProject(subcommand);
    break;
  case 'pit-crew':
    manager.pitCrew(process.argv.slice(3));
    break;
  default:
    console.log(`
Jump Start Workspace Commands

Usage: jumpstart-mode workspace <command> [options]

Commands:
  status              Show all projects and their phases
  active              Show the currently active project
  set-active <id>     Switch to a different project
  validate-deps       Validate cross-project dependencies
  report [--format]   Generate workspace report (markdown, json)
  sync                Sync projects.json with state files (--audit, --pull, --push)
  create-project      Create a new project (Phase 3)
  archive <id>        Archive a completed project (Phase 3)
  unarchive <id>      Restore an archived project (Phase 3)
  remove-project <id> Remove a project (Phase 3 planned)
  pit-crew            Invoke Pit Crew for cross-project review (v1.2+)

Examples:
  jumpstart-mode workspace status
  jumpstart-mode workspace set-active proj-copilot-dashboard
  jumpstart-mode workspace report --format=json
  jumpstart-mode workspace sync --audit
  jumpstart-mode workspace sync --pull
  jumpstart-mode workspace create-project --id=proj-newf --name="New Feature" --type=greenfield
  jumpstart-mode workspace archive proj-completed
    `);
}
