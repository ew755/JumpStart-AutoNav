#!/usr/bin/env node

/**
 * workspace-pitcrew-resume.js
 * Persist Pit Crew session outcomes into workspace resume context.
 */

const fs = require('fs');
const path = require('path');

const MAX_OUTCOMES = 20;

function getWorkspaceStatePath(rootDir) {
  return path.join(rootDir, '.jumpstart', 'state', 'workspace-state.json');
}

/**
 * @param {string} rootDir
 * @param {{
 *   topic: string,
 *   outcome: string,
 *   nextSteps?: string,
 *   dependencyRef?: { from?: string, to?: string, type?: string }
 * }} payload
 */
function recordPitCrewReview(rootDir, payload) {
  if (!payload?.topic || !payload?.outcome) {
    throw new Error('INVALID_PAYLOAD: topic and outcome required');
  }

  const statePath = getWorkspaceStatePath(rootDir);
  if (!fs.existsSync(statePath)) {
    throw new Error('WORKSPACE_STATE_MISSING');
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (!state.workspace_resume_context) {
    state.workspace_resume_context = {};
  }

  const ctx = state.workspace_resume_context;
  const now = new Date().toISOString();

  ctx.last_pit_crew_review = now;
  if (!Array.isArray(ctx.pit_crew_outcomes)) {
    ctx.pit_crew_outcomes = [];
  }

  ctx.pit_crew_outcomes.push({
    date: now,
    topic: payload.topic,
    outcome: payload.outcome,
    next_steps: payload.nextSteps || null,
    dependency_ref: payload.dependencyRef || null,
  });

  while (ctx.pit_crew_outcomes.length > MAX_OUTCOMES) {
    ctx.pit_crew_outcomes.shift();
  }

  const summary = payload.outcome.length > 120
    ? `${payload.outcome.slice(0, 117)}...`
    : payload.outcome;
  ctx.tldr = `Pit Crew (${now.split('T')[0]}): ${summary}`;

  state.last_updated = now;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  return {
    success: true,
    path: statePath,
    last_pit_crew_review: now,
  };
}

module.exports = {
  MAX_OUTCOMES,
  getWorkspaceStatePath,
  recordPitCrewReview,
};
