#!/usr/bin/env node

/**
 * workspace-detect.js
 * Infer which registered project owns a file path (hub or sibling cwd).
 * Longest project-root prefix wins; ties are ambiguous.
 */

const path = require('path');
const {
  loadProjectsRegistry,
  resolveProjectRoot,
  getProjectRelativePath,
} = require('./workspace-project-paths');
const { readHubLink, resolveHubRootFromLink } = require('./workspace-hub-link');
const { detectWorkspaceMode } = require('./workspace-context');

function resolveWorkspaceRoots(cwd = process.cwd()) {
  if (detectWorkspaceMode(cwd)) {
    return { hubRoot: cwd, cwdMode: 'hub', siblingProjectId: null };
  }

  const link = readHubLink(cwd);
  if (link?.hub_root && link?.project_id) {
    const hubRoot = resolveHubRootFromLink(cwd, link);
    if (hubRoot && detectWorkspaceMode(hubRoot)) {
      return {
        hubRoot,
        cwdMode: 'sibling-linked',
        siblingProjectId: link.project_id,
      };
    }
  }

  return { hubRoot: null, cwdMode: 'single-project', siblingProjectId: null };
}

function normalizeAbsolutePath(baseDir, filePath) {
  if (!filePath) {
    return null;
  }
  return path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.normalize(path.join(baseDir, filePath));
}

/**
 * Find registered projects whose root contains the absolute file path.
 * @returns {{ matches: Array, ambiguous: boolean }}
 */
function findProjectsForFilePath(hubRoot, filePath, registry = null) {
  const reg = registry || loadProjectsRegistry(hubRoot);
  if (!reg?.projects?.length) {
    return { matches: [], ambiguous: false };
  }

  const absFile = normalizeAbsolutePath(hubRoot, filePath);
  const allMatches = [];

  for (const project of reg.projects) {
    const projectId = project.id || project.project_id;
    const root = path.normalize(resolveProjectRoot(hubRoot, project, projectId));
    const prefix = root + path.sep;

    if (absFile === root || absFile.startsWith(prefix)) {
      allMatches.push({
        project_id: projectId,
        name: project.name,
        path: getProjectRelativePath(project, projectId),
        root,
        match_depth: root.length,
      });
    }
  }

  if (allMatches.length === 0) {
    return { matches: [], ambiguous: false };
  }

  const maxDepth = Math.max(...allMatches.map((entry) => entry.match_depth));
  const top = allMatches.filter((entry) => entry.match_depth === maxDepth);

  return {
    matches: top,
    ambiguous: top.length > 1,
  };
}

/**
 * Detect project ownership and recommended active-project action.
 *
 * @returns {{
 *   file_path: string,
 *   hubRoot: string|null,
 *   cwdMode: string,
 *   active_project_id: string|null,
 *   detected_project_id: string|null,
 *   suggested_project_id: string|null,
 *   candidates: object[],
 *   ambiguous: boolean,
 *   action: 'single-project'|'sibling_linked'|'no_workspace'|'no_match'|'already_active'|'switch'|'ambiguous'|'force'
 * }}
 */
function detectProjectFromPath({ cwd = process.cwd(), filePath, activeProjectId = null } = {}) {
  const absFile = normalizeAbsolutePath(cwd, filePath);
  const { hubRoot, cwdMode, siblingProjectId } = resolveWorkspaceRoots(cwd);

  if (cwdMode === 'single-project') {
    return {
      file_path: absFile,
      hubRoot: null,
      cwdMode,
      active_project_id: null,
      detected_project_id: null,
      suggested_project_id: null,
      candidates: [],
      ambiguous: false,
      action: 'single-project',
    };
  }

  if (cwdMode === 'sibling-linked') {
    const registry = loadProjectsRegistry(hubRoot);
    return {
      file_path: absFile,
      hubRoot,
      cwdMode,
      active_project_id: registry?.active_project || null,
      detected_project_id: siblingProjectId,
      suggested_project_id: siblingProjectId,
      candidates: [{ project_id: siblingProjectId }],
      ambiguous: false,
      action: 'sibling_linked',
    };
  }

  const registry = loadProjectsRegistry(hubRoot);
  if (!registry) {
    return {
      file_path: absFile,
      hubRoot,
      cwdMode,
      active_project_id: null,
      detected_project_id: null,
      suggested_project_id: null,
      candidates: [],
      ambiguous: false,
      action: 'no_workspace',
    };
  }

  const active = activeProjectId ?? registry.active_project ?? null;
  const { matches, ambiguous } = findProjectsForFilePath(hubRoot, absFile, registry);

  if (matches.length === 0) {
    return {
      file_path: absFile,
      hubRoot,
      cwdMode,
      active_project_id: active,
      detected_project_id: null,
      suggested_project_id: null,
      candidates: [],
      ambiguous: false,
      action: 'no_match',
    };
  }

  if (ambiguous) {
    return {
      file_path: absFile,
      hubRoot,
      cwdMode,
      active_project_id: active,
      detected_project_id: null,
      suggested_project_id: null,
      candidates: matches,
      ambiguous: true,
      action: 'ambiguous',
    };
  }

  const detected = matches[0].project_id;
  if (detected === active) {
    return {
      file_path: absFile,
      hubRoot,
      cwdMode,
      active_project_id: active,
      detected_project_id: detected,
      suggested_project_id: detected,
      candidates: matches,
      ambiguous: false,
      action: 'already_active',
    };
  }

  return {
    file_path: absFile,
    hubRoot,
    cwdMode,
    active_project_id: active,
    detected_project_id: detected,
    suggested_project_id: detected,
    candidates: matches,
    ambiguous: false,
    action: 'switch',
  };
}

function formatDetectionResult(result) {
  const relFile = result.file_path || '(no path)';
  const lines = [
    '🔍 Workspace project detection',
    `   File: ${relFile}`,
    `   Mode: ${result.cwdMode}`,
  ];

  if (result.hubRoot) {
    lines.push(`   Hub: ${result.hubRoot}`);
  }

  if (result.active_project_id) {
    lines.push(`   Active: ${result.active_project_id}`);
  }

  switch (result.action) {
    case 'single-project':
      lines.push('   Result: single-project mode (no registry)');
      break;
    case 'sibling_linked':
      lines.push(`   Detected: ${result.detected_project_id} (sibling-linked checkout)`);
      break;
    case 'no_workspace':
      lines.push('   Result: hub registry not found');
      break;
    case 'no_match':
      lines.push('   Result: file is outside all registered project roots');
      break;
    case 'already_active':
      lines.push(`   Detected: ${result.detected_project_id} (already active)`);
      break;
    case 'switch':
      lines.push(`   Detected: ${result.detected_project_id}`);
      lines.push(`   Action: switch active project → ${result.suggested_project_id}`);
      lines.push('   Run with --auto to apply, or: jumpstart-mode workspace set-active ' + result.suggested_project_id);
      break;
    case 'ambiguous':
      lines.push('   Result: ambiguous — multiple projects match this path');
      result.candidates.forEach((candidate) => {
        lines.push(`     • ${candidate.project_id} (${candidate.name || candidate.path})`);
      });
      lines.push('   Choose one: jumpstart-mode workspace set-active <id>');
      lines.push('   Or force: jumpstart-mode workspace detect <path> --project-id=<id>');
      break;
    case 'force':
      lines.push(`   Forced active project: ${result.suggested_project_id}`);
      break;
    default:
      lines.push(`   Action: ${result.action}`);
  }

  return lines.join('\n');
}

/**
 * Whether a relative path is worth guarding for active-project alignment.
 */
function shouldGuardRelativePath(relativePath) {
  if (!relativePath) {
    return false;
  }
  const normalized = String(relativePath).replace(/\\/g, '/').replace(/^\.\//, '');
  return /^(specs|src|tests)(\/|$)/.test(normalized) || /^projects\/[^/]+\//.test(normalized);
}

module.exports = {
  resolveWorkspaceRoots,
  findProjectsForFilePath,
  detectProjectFromPath,
  formatDetectionResult,
  shouldGuardRelativePath,
  normalizeAbsolutePath,
};
