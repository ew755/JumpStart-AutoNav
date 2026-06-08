#!/usr/bin/env node

/**
 * workspace-context-format.js
 * Shared SessionStart / IDE context blocks for hub and sibling-linked repos.
 */

const path = require('path');
const { isSiblingPath } = require('./workspace-project-paths');

function relativeFromRoot(root, absolutePath) {
  if (!absolutePath || !root) return null;
  return path.relative(root, absolutePath).replace(/\\/g, '/');
}

/**
 * @param {object} context - from getWorkspaceContext()
 * @param {{ displayRoot?: string }} [options] - cwd shown to the agent (defaults to context.rootDir)
 */
function formatWorkspaceContextBlock(context, options = {}) {
  const displayRoot = options.displayRoot || context.linkedRoot || context.rootDir;

  if (context.mode === 'single-project') {
    return [
      '[Jump Start Workspace Context]',
      'Mode: single-project',
      'Specs: specs/',
      'Use root-level specs/, src/, and tests/ for this project.',
    ].join('\n');
  }

  if (context.mode === 'workspace-no-active') {
    return [
      '[Jump Start Workspace Context]',
      'Mode: workspace (no active project)',
      'Run: jumpstart-mode workspace set-active <project-id>',
    ].join('\n');
  }

  if (context.mode === 'sibling-broken-link') {
    return [
      '[Jump Start Workspace Context]',
      'Mode: sibling-broken-link',
      `Error: ${context.error || 'hub-link.json is invalid or hub registry missing'}`,
      'Re-run: jumpstart-mode workspace link-sibling from the hub.',
    ].join('\n');
  }

  const project = context.project;
  const specsRel = relativeFromRoot(displayRoot, context.config?.specs_path) || 'specs';
  const srcRel = relativeFromRoot(displayRoot, context.config?.src_path) || 'src';
  const testsRel = relativeFromRoot(displayRoot, context.config?.tests_path) || 'tests';
  const phase = context.state?.current_phase;

  const lines = [
    '[Jump Start Workspace Context]',
    `Mode: ${context.mode}`,
  ];

  if (context.mode === 'sibling-linked') {
    lines.push(`Hub root: ${context.hubRootRel || context.hubRoot}`);
    lines.push(`Linked repo: ${displayRoot}`);
    lines.push(
      'Run jumpstart-mode workspace / approve from hub cwd; specs and code edits stay in this linked repo.'
    );
  }

  lines.push(
    `Active project: ${project.project_id} (${project.name})`,
    `Project registry path: ${project.path || '.'}`,
    `Current phase: ${phase ?? 'not started'}`,
    `Specs: ${specsRel}/`,
    `Source: ${srcRel}/`,
    `Tests: ${testsRel}/`,
    'Load artifacts from the paths above — not the global specs/ root unless active project path is ".".'
  );

  if (context.mode === 'multi-project' && isSiblingPath(project.path || '')) {
    lines.push(
      'Sibling repo: prefer opening the linked checkout; hub-link.json in sibling enables IDE injection when opened alone.'
    );
  }

  if (context.mode === 'sibling-linked') {
    lines.push('Read .jumpstart/SIBLING-WORKSPACE.md in this repo for full sibling rules.');
  }

  return lines.join('\n');
}

module.exports = {
  formatWorkspaceContextBlock,
  relativeFromRoot,
};
