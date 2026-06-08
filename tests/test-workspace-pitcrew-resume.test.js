/**
 * Tests for lib/workspace-pitcrew-resume.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { recordPitCrewReview, MAX_OUTCOMES } = require('../lib/workspace-pitcrew-resume.js');

let tmpDir;

function writeState(dir, state) {
  mkdirSync(join(dir, '.jumpstart', 'state'), { recursive: true });
  writeFileSync(
    join(dir, '.jumpstart', 'state', 'workspace-state.json'),
    JSON.stringify(state, null, 2)
  );
}

beforeEach(() => {
  tmpDir = join(tmpdir(), `jumpstart-pitcrew-resume-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  writeState(tmpDir, {
    version: '1.0.0',
    active_project_id: 'proj-workspace-pilot',
    workspace_resume_context: {
      tldr: 'Before review',
      cross_project_dependencies: [],
    },
  });
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('recordPitCrewReview', () => {
  it('creates pit_crew_outcomes array when missing', () => {
    const result = recordPitCrewReview(tmpDir, {
      topic: 'Blocked dependency review',
      outcome: 'Acknowledged expected block',
    });

    expect(result.success).toBe(true);
    const state = JSON.parse(
      readFileSync(join(tmpDir, '.jumpstart', 'state', 'workspace-state.json'), 'utf8')
    );
    expect(Array.isArray(state.workspace_resume_context.pit_crew_outcomes)).toBe(true);
    expect(state.workspace_resume_context.pit_crew_outcomes).toHaveLength(1);
    expect(state.workspace_resume_context.pit_crew_outcomes[0].topic).toBe('Blocked dependency review');
  });

  it('sets last_pit_crew_review ISO timestamp', () => {
    recordPitCrewReview(tmpDir, {
      topic: 'Review',
      outcome: 'Documented',
    });

    const state = JSON.parse(
      readFileSync(join(tmpDir, '.jumpstart', 'state', 'workspace-state.json'), 'utf8')
    );
    expect(state.workspace_resume_context.last_pit_crew_review).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws on missing topic or outcome', () => {
    expect(() => recordPitCrewReview(tmpDir, { topic: 'Only topic' })).toThrow(
      'INVALID_PAYLOAD'
    );
    expect(() => recordPitCrewReview(tmpDir, { outcome: 'Only outcome' })).toThrow(
      'INVALID_PAYLOAD'
    );
  });

  it('caps outcomes array at MAX_OUTCOMES', () => {
    for (let i = 0; i < MAX_OUTCOMES + 3; i++) {
      recordPitCrewReview(tmpDir, {
        topic: `Topic ${i}`,
        outcome: `Outcome ${i}`,
      });
    }

    const state = JSON.parse(
      readFileSync(join(tmpDir, '.jumpstart', 'state', 'workspace-state.json'), 'utf8')
    );
    expect(state.workspace_resume_context.pit_crew_outcomes).toHaveLength(MAX_OUTCOMES);
    expect(state.workspace_resume_context.pit_crew_outcomes[0].topic).toBe('Topic 3');
  });
});
