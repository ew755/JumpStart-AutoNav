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
      if (result.valid) {
        result.dependencies.forEach((dep) => {
          console.log(`✅ ${dep.type}: ${dep.from} → ${dep.to}`);
        });
      } else {
        result.errors.forEach((error) => console.log(`❌ ${error}`));
      }
      console.log();
      break;
    }
    case 'report': {
      const formatArg = argv.find((arg) => arg.startsWith('--format='));
      const format = formatArg ? formatArg.split('=')[1] : 'markdown';
      manager.report(format);
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
  report [--format]   Generate workspace report (markdown, json)
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
};
