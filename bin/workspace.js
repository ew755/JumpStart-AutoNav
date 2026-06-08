#!/usr/bin/env node
/**
 * Jump Start Workspace CLI
 *
 * Commands for managing multi-project workflows:
 * - jumpstart-mode workspace status
 * - jumpstart-mode workspace upgrade
 * - jumpstart-mode workspace active
 * - jumpstart-mode workspace set-active <project-id>
 * - jumpstart-mode workspace validate-deps
 * - jumpstart-mode workspace report [--format markdown|json]
 * - jumpstart-mode workspace sync (--audit|--pull|--push)
 * - jumpstart-mode workspace create-project --id=<id> --name=<name> --type=<type>
 */

const path = require('path');
const { WorkspaceManager } = require('../lib/workspace-manager');
const { upgradeToWorkspace, detectMigrationState } = require('../lib/workspace-migration');
const { recordPitCrewReview } = require('../lib/workspace-pitcrew-resume');

const PILOT_PROJECT_ID = 'proj-workspace-pilot';

/**
 * Parse --format=json or --format json from argv.
 */
function parseFormatArg(argv, defaultFormat = 'markdown') {
  const eqArg = argv.find((arg) => arg.startsWith('--format='));
  if (eqArg) {
    return eqArg.split('=')[1];
  }
  const idx = argv.indexOf('--format');
  if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) {
    return argv[idx + 1];
  }
  return defaultFormat;
}

function ensureWorkspaceInitialized(rootDir, { autoInit = false } = {}) {
  const state = detectMigrationState(rootDir);
  if (state !== 'single-project') {
    return { initialized: true, state };
  }

  if (!autoInit) {
    return { initialized: false, state };
  }

  const result = upgradeToWorkspace(rootDir);
  return { initialized: result.success, state: result.mode, result };
}

function runWorkspaceCli(argv = process.argv.slice(2)) {
  const command = argv[0];
  const subcommand = argv[1];
  const rootDir = process.cwd();
  const hasForce = argv.includes('--force');
  const projectIdArg = argv.find((arg) => arg.startsWith('--project-id='));
  const projectIdValue = projectIdArg ? projectIdArg.split('=')[1] : null;

  if (command === 'upgrade') {
    const result = upgradeToWorkspace(rootDir);
    if (!result.success) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
      return;
    }

    if (result.alreadyMigrated) {
      console.log(`ℹ️  Workspace already initialized (${result.mode})`);
      console.log(`   Active project: ${result.activeProject}`);
    } else {
      console.log('✅ Workspace upgraded from single-project mode');
      console.log(`   Registry: ${path.relative(rootDir, result.projectsPath)}`);
      console.log(`   Active project: ${result.activeProject} (${result.projectName})`);
    }
    console.log();
    return;
  }

  if (command === 'status') {
    const init = ensureWorkspaceInitialized(rootDir, { autoInit: true });
    if (!init.initialized) {
      console.error('❌ Workspace not initialized. Run: jumpstart-mode workspace upgrade');
      process.exit(1);
      return;
    }
    if (init.result && !init.result.alreadyMigrated) {
      console.log('ℹ️  Auto-initialized workspace from single-project mode\n');
    }
  } else if (command && command !== 'help' && detectMigrationState(rootDir) === 'single-project') {
    console.error('❌ Workspace not initialized. Run: jumpstart-mode workspace upgrade');
    process.exit(1);
    return;
  }

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  let manager;
  try {
    manager = new WorkspaceManager(rootDir);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
    return;
  }

  switch (command) {
    case 'status':
      manager.status();
      break;
    case 'active':
      manager.active();
      break;
    case 'set-active':
      try {
        manager.setActive(subcommand);
        console.log(`✅ Active project set to: ${subcommand}`);
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      return;
      }
      break;
    case 'validate-deps': {
      const result = manager.validateDeps();
      console.log('\n🔗 Validating Cross-Project Dependencies\n');
      if (result.dependencies.length === 0) {
        console.log('✅ No cross-project dependencies configured.\n');
        break;
      }
      if (!result.valid) {
        result.errors.forEach((error) => console.log(`❌ ${error}`));
      }
      result.dependencies.forEach((dep) => {
        if (dep.blocked) {
          const unblock = dep.unblock_condition ? ` (unblock: ${dep.unblock_condition})` : '';
          console.log(`⚠️  BLOCKED ${dep.type}: ${dep.from} → ${dep.to}${unblock}`);
        } else {
          console.log(`✅ ${dep.type}: ${dep.from} → ${dep.to}`);
        }
      });
      if (result.blocked_count > 0) {
        console.log(`\nℹ️  ${result.blocked_count} blocked dependency(ies). Run /jumpstart.pitcrew or workspace can-advance for details.\n`);
      } else {
        console.log();
      }
      if (!result.valid) {
        process.exit(1);
      }
      break;
    }
    case 'report': {
      const format = parseFormatArg(argv, 'markdown');
      if (argv.includes('--cost-breakdown')) {
        const summary = manager.costBreakdown();
        console.log(require('../lib/workspace-cost').formatCostReport(summary));
        break;
      }
      manager.report(format);
      break;
    }
    case 'projects-in-flight': {
      const rows = manager.projectsInFlight();
      console.log('\n🚀 Projects In Flight\n');
      const active = rows.filter((r) => r.in_flight);
      if (active.length === 0) {
        console.log('  No projects currently locked.\n');
      } else {
        active.forEach((row) => {
          const paused = row.paused ? ' (paused)' : '';
          console.log(`  ▶ ${row.project_id} — locked by ${row.locked_by}${paused}`);
        });
        console.log();
      }
      break;
    }
    case 'pause':
      try {
        manager.pauseProject(subcommand);
        console.log(`⏸️  Paused project: ${subcommand}`);
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      return;
      }
      break;
    case 'resume':
      try {
        manager.resumeProject(subcommand);
        console.log(`▶️  Resumed project: ${subcommand}`);
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      return;
      }
      break;
    case 'can-advance': {
      const targetId = subcommand || manager.config.active_project;
      const result = manager.canAdvanceProject(targetId);
      if (result.allowed) {
        console.log(`✅ ${targetId} can advance`);
      } else {
        console.log(`❌ ${targetId} cannot advance: ${result.reason}`);
        process.exit(1);
      return;
      }
      break;
    }
    case 'budget': {
      const projectArg = argv.find((arg) => arg.startsWith('--project='));
      const projectId = projectArg ? projectArg.split('=')[1] : manager.config.active_project;
      try {
        const result = manager.checkBudget(projectId);
        console.log(`\n💰 Budget: ${projectId}\n`);
        console.log(`  Used: ${result.usage.toLocaleString()} / ${result.budget.toLocaleString()} (${result.percent_used.toFixed(1)}%)`);
        result.alerts.forEach((a) => console.log(`  ${a.level === 'error' ? '❌' : '⚠️ '} ${a.message}`));
        console.log();
        if (!result.allowed) process.exit(1);
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      return;
      }
      break;
    }
    case 'adjust-budget': {
      const projectArg = argv.find((arg) => arg.startsWith('--project='));
      const limitArg = argv.find((arg) => arg.startsWith('--new-limit='));
      if (!projectArg || !limitArg) {
        console.error('Usage: workspace adjust-budget --project=<id> --new-limit=<tokens>');
        process.exit(1);
      return;
      }
      const result = manager.adjustBudget(
        projectArg.split('=')[1],
        parseInt(limitArg.split('=')[1], 10)
      );
      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      return;
      }
      console.log(`✅ Updated ${result.project_id} budget to ${result.token_budget.toLocaleString()} tokens`);
      break;
    }
    case 'adr-index': {
      const registry = manager.adrIndex();
      console.log('\n📋 Workspace ADR Index\n');
      if (registry.adr_index.length === 0) {
        console.log('  No ADRs registered. Run: workspace scan-adrs\n');
      } else {
        registry.adr_index.forEach((adr) => {
          console.log(`  ${adr.id} [${adr.status}] ${adr.title} (${adr.project_id})`);
        });
        console.log();
      }
      break;
    }
    case 'scan-adrs': {
      const result = manager.scanADRs();
      console.log(`✅ Registered ${result.count} ADR(s) from project specs/decisions/`);
      break;
    }
    case 'adr-impacts': {
      const impacts = manager.adrImpacts(subcommand);
      if (!impacts.found) {
        console.error(`❌ ADR not found: ${subcommand}`);
        process.exit(1);
      return;
      }
      console.log(`\n🔗 Impacts of ${impacts.adr_id}: ${impacts.title}\n`);
      if (impacts.affected_projects.length === 0) {
        console.log('  No downstream projects impacted.\n');
      } else {
        impacts.affected_projects.forEach((id) => console.log(`  → ${id}`));
        console.log();
      }
      break;
    }
    case 'audit-adr-awareness': {
      const audit = manager.auditADRAwareness(subcommand);
      console.log(`\n🔍 Upstream ADRs for ${audit.project_id}: ${audit.count}\n`);
      audit.upstream_adrs.forEach((adr) => {
        console.log(`  ${adr.id} [${adr.status}] from ${adr.source_project} — ${adr.title}`);
      });
      console.log();
      break;
    }
    case 'knowledge-graph': {
      const formatArg = argv.find((arg) => arg.startsWith('--format='));
      const format = formatArg ? formatArg.split('=')[1] : 'json';
      const output = manager.exportGraph(format);
      if (format === 'graphviz') {
        console.log(output);
      } else {
        console.log(JSON.stringify(output, null, 2));
      }
      break;
    }
    case 'query-graph': {
      const queryParts = argv.slice(1).filter((a) => !a.startsWith('--'));
      const queryString = queryParts.join(' ');
      const result = manager.queryGraph(queryString);
      if (result.error) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      return;
      }
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'pitcrew-record': {
      const topicArg = argv.find((arg) => arg.startsWith('--topic='));
      const outcomeArg = argv.find((arg) => arg.startsWith('--outcome='));
      const nextStepsArg = argv.find((arg) => arg.startsWith('--next-steps='));
      const fromArg = argv.find((arg) => arg.startsWith('--from='));
      const toArg = argv.find((arg) => arg.startsWith('--to='));

      const topic = topicArg ? topicArg.split('=').slice(1).join('=') : null;
      const outcome = outcomeArg ? outcomeArg.split('=').slice(1).join('=') : null;

      if (!topic || !outcome) {
        console.error('❌ Usage: workspace pitcrew-record --topic="..." --outcome="..." [--next-steps="..."] [--from=proj-a] [--to=proj-b]');
        process.exit(1);
        return;
      }

      try {
        const result = recordPitCrewReview(rootDir, {
          topic,
          outcome,
          nextSteps: nextStepsArg ? nextStepsArg.split('=').slice(1).join('=') : undefined,
          dependencyRef: fromArg || toArg
            ? {
                from: fromArg ? fromArg.split('=')[1] : undefined,
                to: toArg ? toArg.split('=')[1] : undefined,
                type: 'phase_dependency',
              }
            : undefined,
        });
        console.log('✅ Pit Crew outcome recorded');
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      }
      break;
    }
    case 'sync':
      if (subcommand === '--audit') {
        manager.syncAudit(projectIdValue);
      } else if (subcommand === '--pull') {
        manager.syncPull(projectIdValue);
      } else if (subcommand === '--push') {
        manager.syncPush(projectIdValue, hasForce);
      } else {
        printSyncHelp();
      }
      break;
    case 'archive':
      try {
        const result = manager.archive(subcommand);
        if (result.alreadyArchived) {
          console.log(`ℹ️  Project already archived: ${subcommand}`);
        } else {
          console.log(`✅ Project archived: ${subcommand}`);
        }
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      return;
      }
      break;
    case 'unarchive':
      try {
        const result = manager.unarchive(subcommand);
        if (result.alreadyActive) {
          console.log(`ℹ️  Project is not archived: ${subcommand}`);
        } else {
          console.log(`✅ Project unarchived: ${subcommand}`);
        }
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      return;
      }
      break;
    case 'create-project': {
      const result = manager.createProject(argv.slice(1));
      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      return;
      }
      console.log(`✅ Project created: ${result.projectId}`);
      console.log(`   Path: ${result.projectPath}`);
      console.log(`   Next: jumpstart-mode workspace set-active ${result.projectId}`);
      break;
    }
    case 'remove-project': {
      const confirm = argv.includes('--confirm');
      const deleteFiles = argv.includes('--delete-files');
      const result = manager.removeProject(subcommand, { confirm, deleteFiles });
      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      return;
      }
      console.log(`✅ Removed ${result.projectId} from registry`);
      if (result.deletedPath) {
        console.log(`   Deleted files: ${result.deletedPath}`);
      } else {
        console.log('   Project files on disk were kept (use --delete-files to remove)');
      }
      if (result.activeProject) {
        console.log(`   Active project: ${result.activeProject}`);
      }
      break;
    }
    default:
      printHelp();
  }
}

function printSyncHelp() {
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
  `);
}

function printHelp() {
  console.log(`
Jump Start Workspace Commands

Usage: jumpstart-mode workspace <command> [options]

Commands:
  status              Show all projects (auto-initializes from single-project mode)
  upgrade             Migrate single-project workspace to multi-project registry
  active              Show the currently active project
  set-active <id>     Switch to a different project
  validate-deps       Validate cross-project dependencies
  report [--format]   Generate workspace report (markdown, json, --cost-breakdown)
  projects-in-flight Show projects with active agent locks
  pause <id>          Pause a project (frees parallel capacity)
  resume <id>         Resume a paused project
  can-advance [id]    Check if project can advance (parallel/Pit Crew gates)
  budget [--project=] Show per-project token budget status
  adjust-budget       Update project token budget (--project=, --new-limit=)
  scan-adrs           Scan all projects and register ADRs
  adr-index           List cross-project ADR registry
  adr-impacts <id>    Show projects impacted by an ADR
  audit-adr-awareness <id>  List upstream ADRs affecting a project
  knowledge-graph     Build/export graph (--format=json|graphviz)
  query-graph <query> Query graph (downstream-of, blocks, impact-of)
  pitcrew-record      Record Pit Crew outcome (--topic=, --outcome=, optional --next-steps=, --from=, --to=)
  sync                Sync projects.json with state files (--audit, --pull, --push)
  create-project      Create a new project
  archive <id>        Archive a completed project
  unarchive <id>      Restore an archived project
  remove-project <id> Remove from registry (--confirm, optional --delete-files)

Examples:
  jumpstart-mode workspace upgrade
  jumpstart-mode workspace status
  jumpstart-mode workspace set-active proj-example
  jumpstart-mode workspace report --format=json
  jumpstart-mode workspace create-project --id=proj-example --name="Example" --type=greenfield
  `);
}

if (require.main === module) {
  runWorkspaceCli(process.argv.slice(2));
}

module.exports = {
  runWorkspaceCli,
  parseFormatArg,
};
