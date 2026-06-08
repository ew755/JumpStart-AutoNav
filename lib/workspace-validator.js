#!/usr/bin/env node

/**
 * workspace-validator.js
 * Schema validation for .jumpstart/projects.json workspace registry.
 */

const path = require('path');
const { loadSchema, validate } = require('../bin/lib/validator');

const SCHEMA_NAME = 'workspace.schema.json';
const SCHEMAS_DIR = path.join(__dirname, '..', '.jumpstart', 'schemas');

function getWorkspaceSchema() {
  return loadSchema(SCHEMA_NAME, SCHEMAS_DIR);
}

/**
 * Normalize legacy registry fields before validation or persistence.
 * @param {object} registry
 * @returns {object}
 */
function normalizeRegistry(registry) {
  const normalized = { ...registry };

  if (!normalized.settings) {
    normalized.settings = {
      enforce_sequential_phases: true,
      allow_parallel_projects: false,
      pit_crew_review_required: true,
      cross_project_dependency_validation: true,
      aggregate_cost_tracking: true,
    };
  }

  if (Array.isArray(normalized.projects)) {
    normalized.projects = normalized.projects.map((entry) => {
      const project = { ...entry };
      if (!project.id && project.project_id) {
        project.id = project.project_id;
      }
      if (!project.config_path) {
        project.config_path = project.path === '.'
          ? '.jumpstart/config.yaml'
          : `${project.path}/.jumpstart/config.yaml`;
      }
      if (project.created_date && !project.created_at) {
        project.created_at = project.created_date.includes('T')
          ? project.created_date
          : `${project.created_date}T00:00:00Z`;
        delete project.created_date;
      }
      return project;
    });
  }

  if (normalized.active_project && Array.isArray(normalized.projects)) {
    const ids = normalized.projects.map((p) => p.id || p.project_id);
    if (!ids.includes(normalized.active_project) && ids.length > 0) {
      normalized.active_project = ids[0];
    }
  }

  return normalized;
}

/**
 * Validate a projects.json registry object.
 * @param {object} registry
 * @param {{ normalize?: boolean }} [options]
 * @returns {{ valid: boolean, errors: string[], registry: object }}
 */
function validateProjectsRegistry(registry, options = {}) {
  const data = options.normalize ? normalizeRegistry(registry) : registry;
  const schema = getWorkspaceSchema();
  const result = validate(data, schema, SCHEMAS_DIR);
  return { ...result, registry: data };
}

/**
 * Validate and throw on failure. Returns normalized registry when normalize=true.
 * @param {object} registry
 * @param {{ normalize?: boolean }} [options]
 * @returns {object}
 */
function assertValidProjectsRegistry(registry, options = {}) {
  const { valid, errors, registry: data } = validateProjectsRegistry(registry, options);
  if (!valid) {
    throw new Error(`Invalid workspace registry (projects.json): ${errors.join('; ')}`);
  }
  return options.normalize ? data : registry;
}

module.exports = {
  getWorkspaceSchema,
  normalizeRegistry,
  validateProjectsRegistry,
  assertValidProjectsRegistry,
};
