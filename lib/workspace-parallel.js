#!/usr/bin/env node

/**
 * workspace-parallel.js
 * Parallel project mode: capacity checks, pause/resume, projects-in-flight.
 */

const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_LOCK_TTL_SECONDS = 3600;

/**
 * A lock past its TTL is treated as free (prevents zombie locks from
 * crashed agent sessions). Locks without a parseable locked_at never expire.
 */
function isLockExpired(lock, nowMs = Date.now()) {
  if (!lock?.locked_at) {
    return false;
  }
  const lockedAt = Date.parse(lock.locked_at);
  if (Number.isNaN(lockedAt)) {
    return false;
  }
  const ttlSeconds = lock.ttl_seconds ?? DEFAULT_LOCK_TTL_SECONDS;
  return nowMs - lockedAt > ttlSeconds * 1000;
}

function getParallelSettings(config) {
  const settings = config?.settings || {};
  return {
    allowParallel: settings.allow_parallel_projects === true,
    maxConcurrent: settings.max_concurrent_projects ?? DEFAULT_MAX_CONCURRENT,
    pitCrewRequired: settings.pit_crew_review_required !== false,
  };
}

function getPausedProjects(state) {
  return state?.paused_projects || [];
}

function isProjectPaused(state, projectId) {
  return getPausedProjects(state).includes(projectId);
}

/**
 * Projects currently holding an agent lock (in-flight work).
 * @param {object} state workspace-state.json
 * @returns {string[]}
 */
function getProjectsInFlight(state, nowMs = Date.now()) {
  const locks = state?.project_locks || {};
  return Object.entries(locks)
    .filter(([, lock]) => lock?.locked_by != null && !isLockExpired(lock, nowMs))
    .map(([projectId]) => projectId);
}

/**
 * Active advancing projects: locked and not paused.
 */
function getActiveInFlight(state) {
  const paused = new Set(getPausedProjects(state));
  return getProjectsInFlight(state).filter((id) => !paused.has(id));
}

function canAdvanceProject(config, state, projectId) {
  const { allowParallel, maxConcurrent, pitCrewRequired } = getParallelSettings(config);

  if (isProjectPaused(state, projectId)) {
    return {
      allowed: false,
      reason: `Project ${projectId} is paused. Run: workspace resume ${projectId}`,
    };
  }

  const inFlight = getActiveInFlight(state);
  const alreadyInFlight = inFlight.includes(projectId);

  if (!allowParallel) {
    const activeProject = config.active_project;
    if (activeProject && activeProject !== projectId) {
      return {
        allowed: false,
        reason: `Sequential mode: only active project (${activeProject}) can advance. Run: workspace set-active ${projectId}`,
      };
    }
    if (inFlight.length > 0 && !alreadyInFlight) {
      const other = inFlight.find((id) => id !== projectId);
      return {
        allowed: false,
        reason: `Sequential mode: ${other} has an active agent lock. Wait or unlock first.`,
      };
    }
  } else if (!alreadyInFlight && inFlight.length >= maxConcurrent) {
    return {
      allowed: false,
      reason: `Parallel capacity exceeded (${inFlight.length}/${maxConcurrent}). Pause or complete a project: workspace pause <id>`,
      inFlight,
      maxConcurrent,
    };
  }

  if (pitCrewRequired) {
    const review = needsPitCrewReview(config, state, projectId);
    if (review.required) {
      return {
        allowed: false,
        reason: review.reason,
        pitCrewReview: true,
        blockedDependencies: review.blockedDependencies,
      };
    }
  }

  return { allowed: true, inFlight, maxConcurrent: allowParallel ? maxConcurrent : 1 };
}

/**
 * Pit Crew gate: blocked cross-project dependencies involving this project.
 */
function needsPitCrewReview(config, state, projectId) {
  const deps = state?.workspace_resume_context?.cross_project_dependencies || [];
  const blocked = deps.filter(
    (dep) => dep.blocked && (dep.from === projectId || dep.to === projectId)
  );

  if (blocked.length === 0) {
    return { required: false, blockedDependencies: [] };
  }

  return {
    required: true,
    blockedDependencies: blocked,
    reason: `Pit Crew review required: ${blocked.length} blocked cross-project dependency(ies) involve ${projectId}`,
  };
}

function pauseProject(state, projectId) {
  const paused = new Set(getPausedProjects(state));
  paused.add(projectId);
  state.paused_projects = [...paused];
  return state;
}

function resumeProject(state, projectId) {
  state.paused_projects = getPausedProjects(state).filter((id) => id !== projectId);
  return state;
}

function formatProjectsInFlight(config, state) {
  const inFlight = getProjectsInFlight(state);
  const paused = new Set(getPausedProjects(state));

  return config.projects.map((project) => {
    const id = project.id || project.project_id;
    const lock = state.project_locks?.[id];
    const expired = isLockExpired(lock);
    return {
      project_id: id,
      name: project.name,
      status: project.status,
      phase: project.phase,
      in_flight: inFlight.includes(id),
      paused: paused.has(id),
      locked_by: expired ? null : lock?.locked_by || null,
      locked_at: expired ? null : lock?.locked_at || null,
      lock_expired: expired,
    };
  });
}

module.exports = {
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_LOCK_TTL_SECONDS,
  isLockExpired,
  getParallelSettings,
  getProjectsInFlight,
  getActiveInFlight,
  isProjectPaused,
  canAdvanceProject,
  needsPitCrewReview,
  pauseProject,
  resumeProject,
  formatProjectsInFlight,
};
