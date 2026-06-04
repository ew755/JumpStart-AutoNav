#!/usr/bin/env node

/**
 * spec-loader.js
 * Loads spec artifacts with support for both single-project and multi-project modes
 * 
 * Usage:
 *   const loader = require('./spec-loader');
 *   const spec = loader.loadSpec(context, 'product-brief.md');
 *   const isApproved = loader.validatePhaseGate(spec);
 */

const fs = require('fs');
const path = require('path');

/**
 * Load a spec artifact from the active project
 * 
 * @param {Object} context - Workspace context from workspace-context.js
 * @param {string} specName - Name of the spec (e.g., 'product-brief.md')
 * @param {string} specDir - Subdirectory within specs/ (default: specs/)
 * @returns {Object} Spec content with metadata
 */
function loadSpec(context, specName, specDir = '') {
  let specPath;

  if (context.mode === 'single-project') {
    specPath = path.join(process.cwd(), 'specs', specDir, specName);
  } else if (context.mode === 'multi-project') {
    specPath = path.join(context.config.specs_path, specDir, specName);
  } else {
    throw new Error(`Invalid context mode: ${context.mode}`);
  }

  if (!fs.existsSync(specPath)) {
    throw new Error(`Spec not found: ${specPath}`);
  }

  const content = fs.readFileSync(specPath, 'utf8');
  
  return {
    name: specName,
    path: specPath,
    content,
    metadata: parseMetadata(content),
  };
}

/**
 * Parse YAML frontmatter from spec
 */
function parseMetadata(content) {
  // Simple parser for YAML-like frontmatter
  // Look for fields like: "Status: Approved", "Approved by: Eric", etc.
  
  const metadata = {
    status: null,
    approved_by: null,
    approval_date: null,
    phase_gate_complete: false,
  };

  // Look for Phase Gate section
  const gateMatch = content.match(/## Phase Gate Approval[\s\S]*?(?=##|$)/);
  if (!gateMatch) {
    return metadata;
  }

  const gateSection = gateMatch[0];

  // Check if all checkboxes are marked [x]
  const uncheckedBoxes = (gateSection.match(/\[ \]/g) || []).length;
  metadata.phase_gate_complete = uncheckedBoxes === 0;

  // Extract Status — handles both "Status: X" and "**Status:** X" (markdown bold)
  const statusMatch = gateSection.match(/Status[*:\s]+([^\n*]+)/i);
  if (statusMatch) {
    metadata.status = statusMatch[1].trim();
  }

  // Extract Approved by — handles both "Approved by: X" and "**Approved by:** X"
  const approvedByMatch = gateSection.match(/Approved by[*:\s]+([^\n*]+)/i);
  if (approvedByMatch) {
    metadata.approved_by = approvedByMatch[1].trim();
  }

  // Extract approval date — handles both "Approval date: X" and "**Approval date:** X"
  const dateMatch = gateSection.match(/Approval date[*:\s]+([^\n*]+)/i);
  if (dateMatch) {
    metadata.approval_date = dateMatch[1].trim();
  }

  return metadata;
}

/**
 * Validate that a spec has its phase gate fully approved
 */
function validatePhaseGate(spec) {
  const { metadata } = spec;
  
  return {
    valid: metadata.phase_gate_complete && 
           metadata.approved_by && 
           metadata.approved_by !== 'Pending',
    metadata,
    errors: [],
  };
}

/**
 * Load upstream artifact for a phase
 * For example, Analyst must read Challenger Brief from Phase 0
 */
function loadUpstreamArtifact(context, phase) {
  const upstreamMap = {
    1: { spec: 'challenger-brief.md', dir: '' },
    2: { spec: 'product-brief.md', dir: '' },
    3: { spec: 'prd.md', dir: '' },
    4: { spec: 'architecture.md', dir: '' },
  };

  const upstream = upstreamMap[phase];
  if (!upstream) {
    throw new Error(`No upstream artifact defined for phase ${phase}`);
  }

  try {
    const spec = loadSpec(context, upstream.spec, upstream.dir);
    const gateValidation = validatePhaseGate(spec);

    if (!gateValidation.valid) {
      return {
        loaded: false,
        error: `Upstream artifact not approved: ${upstream.spec}`,
        spec: null,
      };
    }

    return {
      loaded: true,
      error: null,
      spec,
    };
  } catch (error) {
    return {
      loaded: false,
      error: error.message,
      spec: null,
    };
  }
}

/**
 * Infer which project owns a spec file
 */
function inferOwnerProject(specPath, rootDir = process.cwd()) {
  // If spec is in projects/{id}/specs/: extract {id}
  const match = specPath.match(/projects\/([^/]+)\/specs\//);
  if (match) {
    return match[1];
  }

  // Otherwise it's in global specs/
  return 'proj-default';
}

module.exports = {
  loadSpec,
  parseMetadata,
  validatePhaseGate,
  loadUpstreamArtifact,
  inferOwnerProject,
};
