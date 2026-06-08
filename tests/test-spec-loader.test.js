/**
 * Tests for lib/spec-loader.js
 * Covers: loadSpec, parseMetadata, validatePhaseGate,
 *         loadUpstreamArtifact, inferOwnerProject
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTempDir(suffix = '') {
  const dir = join(tmpdir(), `jumpstart-specloader-test-${Date.now()}${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSpec(dir, relPath, content) {
  const fullPath = join(dir, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

// Pre-built spec content fixtures
const APPROVED_SPEC = `---
id: challenger-brief
phase: 0
status: Approved
approved_by: Eric
approval_date: "2026-06-01"
---

# Challenger Brief

## Some Section

Content here.

## Phase Gate Approval

- [x] Human has reviewed this artifact
- [x] All required sections are populated
- [x] Content traces to upstream artifacts

**Approved by:** Eric
**Approval date:** 2026-06-01
**Status:** Approved
`;

const DRAFT_SPEC = `---
id: challenger-brief
phase: 0
status: Draft
---

# Challenger Brief

## Phase Gate Approval

- [ ] Human has reviewed this artifact
- [ ] All required sections are populated

**Approved by:** Pending
**Approval date:** Pending
**Status:** Draft
`;

const PARTIAL_APPROVAL_SPEC = `---
id: challenger-brief
phase: 0
---

# Challenger Brief

## Phase Gate Approval

- [x] Human has reviewed this artifact
- [ ] All required sections are populated

**Approved by:** Eric
**Approval date:** 2026-06-01
**Status:** Draft
`;

const NO_GATE_SPEC = `# Challenger Brief

Just some content with no phase gate section.
`;

// ─── Module imports ─────────────────────────────────────────────────────────
// Vitest handles CJS/ESM interop — module.exports keys become named exports
import {
  loadSpec,
  parseMetadata,
  validatePhaseGate,
  loadUpstreamArtifact,
  inferOwnerProject,
} from '../lib/spec-loader.js';

// ─── Tests ───────────────────────────────────────────────────────────────────

let tmpDir;

beforeEach(() => {
  tmpDir = createTempDir();
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── loadSpec ─────────────────────────────────────────────────────────────────

describe('loadSpec', () => {
  it('loads a spec from project specs/ in multi-project mode', () => {
    writeSpec(tmpDir, 'projects/proj-a/specs/challenger-brief.md', APPROVED_SPEC);

    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };

    const spec = loadSpec(context, 'challenger-brief.md');
    expect(spec.name).toBe('challenger-brief.md');
    expect(spec.content).toContain('Challenger Brief');
    expect(spec.path).toContain('challenger-brief.md');
  });

  it('throws when spec file does not exist', () => {
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };

    expect(() => loadSpec(context, 'missing-spec.md')).toThrow(/not found/i);
  });

  it('throws for an invalid context mode', () => {
    const context = { mode: 'invalid-mode' };
    expect(() => loadSpec(context, 'any-spec.md')).toThrow(/invalid context mode/i);
  });

  it('loads spec from a subdirectory', () => {
    writeSpec(tmpDir, 'projects/proj-a/specs/decisions/ADR-001.md', '# ADR-001\n## Phase Gate Approval\n**Approved by:** Pending\n**Status:** Draft');

    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };

    const spec = loadSpec(context, 'ADR-001.md', 'decisions');
    expect(spec.name).toBe('ADR-001.md');
    expect(spec.content).toContain('ADR-001');
  });

  it('includes metadata in loaded spec', () => {
    writeSpec(tmpDir, 'projects/proj-a/specs/challenger-brief.md', APPROVED_SPEC);
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };
    const spec = loadSpec(context, 'challenger-brief.md');
    expect(spec.metadata).toBeDefined();
    expect(spec.metadata.phase_gate_complete).toBe(true);
  });
});

// ── parseMetadata ────────────────────────────────────────────────────────────

describe('parseMetadata', () => {
  it('detects fully approved spec (all checkboxes checked)', () => {
    const meta = parseMetadata(APPROVED_SPEC);
    expect(meta.phase_gate_complete).toBe(true);
    expect(meta.approved_by).toBe('Eric');
    expect(meta.approval_date).toBe('2026-06-01');
    expect(meta.status).toBe('Approved');
  });

  it('detects draft spec (unchecked boxes)', () => {
    const meta = parseMetadata(DRAFT_SPEC);
    expect(meta.phase_gate_complete).toBe(false);
    expect(meta.approved_by).toBe('Pending');
    expect(meta.status).toBe('Draft');
  });

  it('detects partial approval (some boxes unchecked)', () => {
    const meta = parseMetadata(PARTIAL_APPROVAL_SPEC);
    expect(meta.phase_gate_complete).toBe(false);
  });

  it('returns null status when no Phase Gate section exists', () => {
    const meta = parseMetadata(NO_GATE_SPEC);
    expect(meta.status).toBeNull();
    expect(meta.approved_by).toBeNull();
    expect(meta.phase_gate_complete).toBe(false);
  });
});

// ── validatePhaseGate ────────────────────────────────────────────────────────

describe('validatePhaseGate', () => {
  it('returns valid=true for fully approved spec', () => {
    writeSpec(tmpDir, 'projects/proj-a/specs/challenger-brief.md', APPROVED_SPEC);
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };
    const spec = loadSpec(context, 'challenger-brief.md');
    const result = validatePhaseGate(spec);
    expect(result.valid).toBe(true);
    expect(result.metadata.approved_by).toBe('Eric');
  });

  it('returns valid=false for draft spec', () => {
    writeSpec(tmpDir, 'projects/proj-a/specs/challenger-brief.md', DRAFT_SPEC);
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };
    const spec = loadSpec(context, 'challenger-brief.md');
    const result = validatePhaseGate(spec);
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when approved_by is Pending', () => {
    const specContent = APPROVED_SPEC.replace('**Approved by:** Eric', '**Approved by:** Pending');
    writeSpec(tmpDir, 'projects/proj-a/specs/challenger-brief.md', specContent);
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };
    const spec = loadSpec(context, 'challenger-brief.md');
    const result = validatePhaseGate(spec);
    expect(result.valid).toBe(false);
  });
});

// ── loadUpstreamArtifact ─────────────────────────────────────────────────────

describe('loadUpstreamArtifact', () => {
  it('loads approved upstream artifact for phase 1 (challenger-brief)', () => {
    writeSpec(tmpDir, 'projects/proj-a/specs/challenger-brief.md', APPROVED_SPEC);
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };

    const result = loadUpstreamArtifact(context, 1);
    expect(result.loaded).toBe(true);
    expect(result.error).toBeNull();
    expect(result.spec.name).toBe('challenger-brief.md');
  });

  it('returns loaded=false when upstream spec does not exist', () => {
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };

    const result = loadUpstreamArtifact(context, 1);
    expect(result.loaded).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns loaded=false when upstream spec exists but is not approved', () => {
    writeSpec(tmpDir, 'projects/proj-a/specs/challenger-brief.md', DRAFT_SPEC);
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };

    const result = loadUpstreamArtifact(context, 1);
    expect(result.loaded).toBe(false);
    expect(result.error).toMatch(/not approved/i);
  });

  it('loads correct upstream spec for each phase', () => {
    const specs = {
      1: 'challenger-brief.md',
      2: 'product-brief.md',
      3: 'prd.md',
      4: 'architecture.md',
    };

    for (const [phase, specName] of Object.entries(specs)) {
      writeSpec(tmpDir, `projects/proj-a/specs/${specName}`, APPROVED_SPEC);
      const context = {
        mode: 'multi-project',
        config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
      };
      const result = loadUpstreamArtifact(context, Number(phase));
      expect(result.loaded).toBe(true);
      expect(result.spec.name).toBe(specName);
    }
  });

  it('throws for unknown phase number', () => {
    const context = {
      mode: 'multi-project',
      config: { specs_path: join(tmpDir, 'projects/proj-a/specs') },
    };

    expect(() => loadUpstreamArtifact(context, 99)).toThrow(/no upstream artifact/i);
  });
});

// ── inferOwnerProject ────────────────────────────────────────────────────────

describe('inferOwnerProject', () => {
  it('extracts project id from projects/{id}/specs/ path', () => {
    const specPath = 'projects/proj-token-analytics/specs/product-brief.md';
    expect(inferOwnerProject(specPath)).toBe('proj-token-analytics');
  });

  it('returns proj-default for global specs/ path', () => {
    const specPath = 'specs/product-brief.md';
    expect(inferOwnerProject(specPath)).toBe('proj-default');
  });

  it('returns proj-default for absolute path outside projects/', () => {
    const specPath = '/some/random/path/product-brief.md';
    expect(inferOwnerProject(specPath)).toBe('proj-default');
  });

  it('handles deeply nested project paths', () => {
    const specPath = 'projects/proj-cx-consumer-api/specs/decisions/ADR-001.md';
    expect(inferOwnerProject(specPath)).toBe('proj-cx-consumer-api');
  });

  it('resolves sibling repo specs via registry when rootDir provided', () => {
    const hub = join(tmpDir, 'hub');
    const sibling = join(tmpDir, 'frontend');
    mkdirSync(join(hub, '.jumpstart', 'state'), { recursive: true });
    writeFileSync(
      join(hub, '.jumpstart', 'projects.json'),
      JSON.stringify({
        workspace: { id: 'w', enabled: true },
        projects: [
          {
            id: 'proj-frontend',
            name: 'Frontend',
            path: '../frontend',
            status: 'phase-0',
            config_path: '../frontend/.jumpstart/config.yaml',
          },
        ],
        active_project: 'proj-frontend',
        settings: {},
      })
    );
    mkdirSync(join(sibling, 'specs'), { recursive: true });
    const specPath = join(sibling, 'specs', 'prd.md');
    expect(inferOwnerProject(specPath, hub)).toBe('proj-frontend');
  });
});
