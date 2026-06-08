/**
 * Tests for workspace registry schema validation (projects.json).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  normalizeRegistry,
  validateProjectsRegistry,
  assertValidProjectsRegistry,
} = require('../lib/workspace-validator.js');

const VALID_REGISTRY = {
  workspace: { id: 'test-ws', enabled: true },
  projects: [
    {
      id: 'proj-alpha',
      name: 'Alpha',
      path: 'projects/proj-alpha',
      type: 'greenfield',
      status: 'phase-0',
      config_path: 'projects/proj-alpha/.jumpstart/config.yaml',
    },
  ],
  active_project: 'proj-alpha',
  settings: {
    enforce_sequential_phases: true,
    allow_parallel_projects: false,
    pit_crew_review_required: true,
    cross_project_dependency_validation: true,
    aggregate_cost_tracking: true,
  },
};

describe('workspace-validator', () => {
  it('accepts a valid registry', () => {
    const result = validateProjectsRegistry(VALID_REGISTRY);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects registry missing required top-level fields', () => {
    const result = validateProjectsRegistry({ workspace: { id: 'x', enabled: true } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('projects'))).toBe(true);
  });

  it('rejects invalid project id pattern', () => {
    const bad = {
      ...VALID_REGISTRY,
      projects: [{ ...VALID_REGISTRY.projects[0], id: 'invalid-id' }],
      active_project: 'invalid-id',
    };
    const result = validateProjectsRegistry(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('pattern'))).toBe(true);
  });

  it('normalizes legacy created_date and missing config_path', () => {
    const legacy = {
      ...VALID_REGISTRY,
      projects: [
        {
          id: 'proj-beta',
          name: 'Beta',
          path: 'projects/proj-beta',
          status: 'initializing',
          created_date: '2026-06-06',
        },
      ],
      active_project: 'proj-beta',
    };
    const normalized = normalizeRegistry(legacy);
    expect(normalized.projects[0].config_path).toBe('projects/proj-beta/.jumpstart/config.yaml');
    expect(normalized.projects[0].created_at).toBe('2026-06-06T00:00:00Z');
    expect(normalized.projects[0].created_date).toBeUndefined();

    const result = validateProjectsRegistry(normalized);
    expect(result.valid).toBe(true);
  });

  it('assertValidProjectsRegistry throws with descriptive error', () => {
    expect(() => assertValidProjectsRegistry({})).toThrow(/Invalid workspace registry/);
  });
});
