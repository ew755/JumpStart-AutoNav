#!/usr/bin/env node

/**
 * workspace-cost.js
 * Per-project and workspace-level token budget governance.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_PROJECT_BUDGET = 100000;
const DEFAULT_ALERT_PERCENT = 80;

function getProjectUsageLogPath(rootDir, project) {
  const projectPath = project.path || '.';
  if (projectPath === '.') {
    return path.join(rootDir, '.jumpstart', 'usage-log.json');
  }
  return path.join(rootDir, projectPath, '.jumpstart', 'usage-log.json');
}

function loadUsageLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return { entries: [], total_tokens: 0, total_cost_usd: 0 };
  }
  try {
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    return {
      entries: data.entries || [],
      total_tokens: data.total_tokens || 0,
      total_cost_usd: data.total_cost_usd || 0,
    };
  } catch {
    return { entries: [], total_tokens: 0, total_cost_usd: 0 };
  }
}

function getCostGovernance(project) {
  const gov = project.cost_governance || {};
  return {
    tokenBudget: gov.token_budget ?? DEFAULT_PROJECT_BUDGET,
    alertThresholdPercent: gov.alert_threshold_percent ?? DEFAULT_ALERT_PERCENT,
    owner: gov.owner || project.approver || null,
    costCenter: gov.cost_center || null,
  };
}

function checkProjectBudget(rootDir, project, options = {}) {
  const { failOnExceeded = false, estimatedTokens = 0 } = options;
  const gov = getCostGovernance(project);
  const logPath = getProjectUsageLogPath(rootDir, project);
  const usage = loadUsageLog(logPath);
  const projectId = project.id || project.project_id;

  const currentTokens = usage.total_tokens;
  const projected = currentTokens + estimatedTokens;
  const percentUsed = gov.tokenBudget > 0
    ? (currentTokens / gov.tokenBudget) * 100
    : 0;
  const projectedPercent = gov.tokenBudget > 0
    ? (projected / gov.tokenBudget) * 100
    : 0;

  const alerts = [];
  if (percentUsed >= gov.alertThresholdPercent) {
    alerts.push({
      level: 'warn',
      message: `Project ${projectId} at ${percentUsed.toFixed(1)}% of token budget (${currentTokens.toLocaleString()} / ${gov.tokenBudget.toLocaleString()})`,
    });
  }
  if (projected > gov.tokenBudget) {
    alerts.push({
      level: 'error',
      message: `Project ${projectId} would exceed budget (${projected.toLocaleString()} > ${gov.tokenBudget.toLocaleString()})`,
    });
  }

  const exceeded = currentTokens > gov.tokenBudget;
  const wouldExceed = projected > gov.tokenBudget;

  let allowed = true;
  let reason = null;
  if (exceeded || (failOnExceeded && wouldExceed)) {
    allowed = false;
    reason = `Budget exceeded for ${projectId}: ${currentTokens.toLocaleString()} / ${gov.tokenBudget.toLocaleString()} tokens`;
  }

  return {
    project_id: projectId,
    allowed,
    reason,
    usage: currentTokens,
    projected,
    budget: gov.tokenBudget,
    percent_used: percentUsed,
    projected_percent: projectedPercent,
    alerts,
    log_path: logPath,
    cost_governance: gov,
  };
}

function aggregateWorkspaceCosts(rootDir, config, workspaceState) {
  const projects = config.projects || [];
  const breakdown = projects.map((project) => checkProjectBudget(rootDir, project));
  const workspaceBudget = workspaceState?.workspace_resume_context?.workspace_token_budget || 500000;
  const workspaceUsed = breakdown.reduce((sum, row) => sum + row.usage, 0);

  return {
    workspace_budget: workspaceBudget,
    workspace_used: workspaceUsed,
    workspace_percent: workspaceBudget > 0 ? (workspaceUsed / workspaceBudget) * 100 : 0,
    aggregate_cost_tracking: config.settings?.aggregate_cost_tracking !== false,
    projects: breakdown,
  };
}

function formatCostReport(summary) {
  let out = '\n💰 Workspace Cost Breakdown\n\n';
  for (const row of summary.projects) {
    out += `  ${row.project_id}: ${row.usage.toLocaleString()} / ${row.budget.toLocaleString()} (${row.percent_used.toFixed(1)}%)\n`;
    for (const alert of row.alerts) {
      out += `    ${alert.level === 'error' ? '❌' : '⚠️ '} ${alert.message}\n`;
    }
  }
  out += `\n  Workspace total: ${summary.workspace_used.toLocaleString()} / ${summary.workspace_budget.toLocaleString()} (${summary.workspace_percent.toFixed(1)}%)\n\n`;
  return out;
}

function setProjectBudget(config, projectId, tokenBudget) {
  const project = config.projects.find((p) => (p.id || p.project_id) === projectId);
  if (!project) {
    return { success: false, error: `Project not found: ${projectId}` };
  }
  project.cost_governance = {
    ...(project.cost_governance || {}),
    token_budget: tokenBudget,
  };
  return { success: true, project_id: projectId, token_budget: tokenBudget };
}

module.exports = {
  DEFAULT_PROJECT_BUDGET,
  DEFAULT_ALERT_PERCENT,
  getProjectUsageLogPath,
  loadUsageLog,
  getCostGovernance,
  checkProjectBudget,
  aggregateWorkspaceCosts,
  formatCostReport,
  setProjectBudget,
};
