#!/usr/bin/env node

/**
 * headless-workspace.js
 * Multi-project workspace setup for headless agent emulation scenarios.
 */

const fs = require('fs');
const path = require('path');
const { getWorkspaceContext } = require('./workspace-context');

const AGENT_PHASES = ['challenger', 'analyst', 'pm', 'architect', 'developer'];
const FIXTURES_ROOT = path.join(__dirname, '..', 'tests', 'fixtures', 'workspace');

function readWorkspaceFixtureManifest(scenarioDir) {
  const manifestPath = path.join(scenarioDir, 'workspace-fixture.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function isMultiWorkspaceScenario(scenarioDir) {
  if (readWorkspaceFixtureManifest(scenarioDir)) {
    return true;
  }
  return fs.existsSync(path.join(scenarioDir, '.jumpstart', 'projects.json'));
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function resolveWorkspaceSeed(scenarioDir) {
  const manifest = readWorkspaceFixtureManifest(scenarioDir);
  if (manifest?.fixture) {
    return path.join(FIXTURES_ROOT, manifest.fixture);
  }
  if (fs.existsSync(path.join(scenarioDir, '.jumpstart', 'projects.json'))) {
    return scenarioDir;
  }
  return null;
}

/**
 * Copy workspace registry and nested project trees into a headless run directory.
 * @param {string} scenarioDir
 * @param {string} workspaceDir
 * @returns {object} getWorkspaceContext() result
 */
function setupMultiWorkspaceScenario(scenarioDir, workspaceDir) {
  const seedDir = resolveWorkspaceSeed(scenarioDir);
  if (!seedDir) {
    throw new Error(`Not a multi-workspace scenario: ${scenarioDir}`);
  }

  const jumpstartSrc = path.join(seedDir, '.jumpstart');
  if (fs.existsSync(jumpstartSrc)) {
    copyDirRecursive(jumpstartSrc, path.join(workspaceDir, '.jumpstart'));
  }

  const projectsSrc = path.join(seedDir, 'projects');
  if (fs.existsSync(projectsSrc)) {
    copyDirRecursive(projectsSrc, path.join(workspaceDir, 'projects'));
  }

  const manifest = readWorkspaceFixtureManifest(scenarioDir);
  if (manifest?.active_project) {
    const registryPath = path.join(workspaceDir, '.jumpstart', 'projects.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    registry.active_project = manifest.active_project;
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const statePath = path.join(workspaceDir, '.jumpstart', 'state', 'workspace-state.json');
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.active_project_id = manifest.active_project;
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    }
  }

  const scenarioConfig = path.join(scenarioDir, 'config.yaml');
  if (fs.existsSync(scenarioConfig)) {
    fs.copyFileSync(scenarioConfig, path.join(workspaceDir, '.jumpstart', 'config.yaml'));
  }

  return getWorkspaceContext(workspaceDir);
}

/**
 * Copy phase artifact markdown files into the active project's specs directory.
 * @param {string} scenarioDir
 * @param {string} workspaceDir
 * @param {string[]} [agentPhases]
 */
function copyPhaseArtifacts(scenarioDir, workspaceDir, agentPhases = AGENT_PHASES) {
  const context = getWorkspaceContext(workspaceDir);
  const specsDir = context.config?.specs_path
    ? context.config.specs_path
    : path.join(workspaceDir, 'specs');
  const insightsDir = path.join(specsDir, 'insights');

  fs.mkdirSync(specsDir, { recursive: true });
  fs.mkdirSync(insightsDir, { recursive: true });

  for (const phase of agentPhases) {
    const phaseIndex = agentPhases.indexOf(phase) + 1;
    const phaseDir = path.join(scenarioDir, `0${phaseIndex}-${phase}`);
    if (!fs.existsSync(phaseDir)) {
      continue;
    }

    for (const file of fs.readdirSync(phaseDir)) {
      if (!file.endsWith('.md')) {
        continue;
      }
      const src = path.join(phaseDir, file);
      const dest = file.includes('insights')
        ? path.join(insightsDir, file)
        : path.join(specsDir, file);
      fs.copyFileSync(src, dest);
    }
  }
}

/**
 * Prompt suffix instructing agents where to write artifacts in multi-project mode.
 * @param {string} workspaceDir
 * @returns {string}
 */
function getWorkspacePromptSuffix(workspaceDir) {
  const context = getWorkspaceContext(workspaceDir);
  if (!context.workspace || !context.project) {
    return '';
  }

  const relSpecs = path.relative(workspaceDir, context.config.specs_path).replace(/\\/g, '/');
  const relProject = path.relative(workspaceDir, context.project.projectPath).replace(/\\/g, '/');

  return `

## Workspace Context (Multi-Project)

- Workspace mode: **${context.mode}**
- Active project: **${context.project.project_id}** (${context.project.name})
- Project root: \`${relProject}/\`
- Specs path: \`${relSpecs}/\`
- Write phase artifacts under \`${relSpecs}/\`, not the workspace root \`specs/\`.
`;
}

module.exports = {
  AGENT_PHASES,
  isMultiWorkspaceScenario,
  resolveWorkspaceSeed,
  setupMultiWorkspaceScenario,
  copyPhaseArtifacts,
  getWorkspacePromptSuffix,
};
