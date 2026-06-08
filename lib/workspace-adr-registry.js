#!/usr/bin/env node

/**
 * workspace-adr-registry.js
 * Cross-project ADR index and impact tracking.
 */

const fs = require('fs');
const path = require('path');
const { resolveProjectRoot } = require('./workspace-project-paths');

function getRegistryPath(rootDir) {
  return path.join(rootDir, '.jumpstart', 'adr-registry.json');
}

function defaultRegistry() {
  return {
    version: '1.0.0',
    adr_index: [],
    dependency_graph: [],
    last_updated: null,
  };
}

function loadADRRegistry(rootDir) {
  const registryPath = getRegistryPath(rootDir);
  if (!fs.existsSync(registryPath)) {
    return defaultRegistry();
  }
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch {
    return defaultRegistry();
  }
}

function saveADRRegistry(rootDir, registry) {
  const registryPath = getRegistryPath(rootDir);
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  registry.last_updated = new Date().toISOString();
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  return registry;
}

function parseADRMarkdown(content, filename) {
  const idFromFile = filename.match(/^(ADR-\d+)/i)?.[1];
  const idFromContent = content.match(/^#\s+(ADR-\d+)/im)?.[1];
  const id = (idFromFile || idFromContent || filename.replace(/\.md$/i, '')).toUpperCase();

  const titleMatch =
    content.match(/^#\s+ADR-\d+[:\s—-]+(.+)/im) ||
    content.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : id;

  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
  const status = statusMatch ? statusMatch[1].trim() : 'Unknown';

  const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/i);
  const decisionDate = dateMatch ? dateMatch[1].trim() : null;

  const impacts = [];
  const impactsSection = content.match(/##\s+Impacts[\s\S]*?(?=##|$)/i);
  if (impactsSection) {
    const lines = impactsSection[0].split('\n');
    for (const line of lines) {
      const bullet = line.match(/^[-*]\s+\*\*(.+?)\*\*[:\s—-]*(.*)/);
      if (bullet) {
        impacts.push({ project_id: bullet[1].trim(), reason: bullet[2].trim() || null });
        continue;
      }
      const projMatch = line.match(/proj-[a-z0-9-]+/i);
      if (projMatch) {
        impacts.push({ project_id: projMatch[0], reason: line.replace(/^[-*]\s+/, '').trim() });
      }
    }
  }

  const linked = [];
  const linkMatches = content.matchAll(/\b(ADR-\d+)\b/gi);
  for (const match of linkMatches) {
    const linkedId = match[1].toUpperCase();
    if (linkedId !== id && !linked.includes(linkedId)) {
      linked.push(linkedId);
    }
  }

  const tags = [];
  const tagsMatch = content.match(/\*\*Tags:\*\*\s*(.+)/i);
  if (tagsMatch) {
    tags.push(...tagsMatch[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean));
  }

  return { id, title, status, decision_date: decisionDate, impacts, linked_adrs: linked, tags };
}

function scanProjectADRs(rootDir, project) {
  const projectId = project.id || project.project_id;
  const projectPath = resolveProjectRoot(rootDir, project, projectId);
  const adrDir = path.join(projectPath, 'specs', 'decisions');

  if (!fs.existsSync(adrDir)) {
    return [];
  }

  return fs.readdirSync(adrDir)
    .filter((file) => /^ADR-\d+.*\.md$/i.test(file))
    .map((file) => {
      const content = fs.readFileSync(path.join(adrDir, file), 'utf8');
      const parsed = parseADRMarkdown(content, file);
      return {
        ...parsed,
        project_id: projectId,
        source_file: path.relative(rootDir, path.join(adrDir, file)).replace(/\\/g, '/'),
      };
    });
}

function registerADR(registry, entry) {
  const existingIdx = registry.adr_index.findIndex((a) => a.id === entry.id);
  const record = {
    ...entry,
    registered_at: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    registry.adr_index[existingIdx] = { ...registry.adr_index[existingIdx], ...record };
  } else {
    registry.adr_index.push(record);
  }

  for (const linkedId of entry.linked_adrs || []) {
    const exists = registry.dependency_graph.some(
      (edge) => edge.from_adr === entry.id && edge.to_adr === linkedId
    );
    if (!exists) {
      registry.dependency_graph.push({
        from_adr: entry.id,
        to_adr: linkedId,
        reason: 'linked_in_adr',
      });
    }
  }

  for (const impact of entry.impacts || []) {
    if (impact.project_id) {
      const exists = registry.dependency_graph.some(
        (edge) =>
          edge.from_adr === entry.id &&
          edge.to_project === impact.project_id
      );
      if (!exists) {
        registry.dependency_graph.push({
          from_adr: entry.id,
          to_project: impact.project_id,
          reason: impact.reason || 'impact',
        });
      }
    }
  }

  return registry;
}

function scanAndRegisterAll(rootDir, config) {
  const registry = loadADRRegistry(rootDir);
  const discovered = [];

  for (const project of config.projects || []) {
    const adrs = scanProjectADRs(rootDir, project);
    for (const adr of adrs) {
      registerADR(registry, adr);
      discovered.push(adr);
    }
  }

  saveADRRegistry(rootDir, registry);
  return { registry, discovered, count: discovered.length };
}

function getADRImpacts(registry, adrId) {
  const normalized = adrId.toUpperCase();
  const entry = registry.adr_index.find((a) => a.id === normalized);
  if (!entry) {
    return { found: false, adr_id: normalized, impacts: [], affected_projects: [] };
  }

  const graphImpacts = registry.dependency_graph
    .filter((edge) => edge.from_adr === normalized && edge.to_project)
    .map((edge) => ({ project_id: edge.to_project, reason: edge.reason }));

  const allImpacts = [...(entry.impacts || []), ...graphImpacts];
  const affected = [...new Set(allImpacts.map((i) => i.project_id).filter(Boolean))];

  return {
    found: true,
    adr_id: normalized,
    title: entry.title,
    project_id: entry.project_id,
    impacts: allImpacts,
    affected_projects: affected,
  };
}

function auditADRAwareness(rootDir, config, targetProjectId) {
  const registry = loadADRRegistry(rootDir);
  const upstreamAdrs = registry.adr_index.filter((adr) => {
    const impactsTarget = (adr.impacts || []).some((i) => i.project_id === targetProjectId);
    const graphTargets = registry.dependency_graph.some(
      (e) => e.from_adr === adr.id && e.to_project === targetProjectId
    );
    return adr.project_id !== targetProjectId && (impactsTarget || graphTargets);
  });

  return {
    project_id: targetProjectId,
    upstream_adrs: upstreamAdrs.map((a) => ({
      id: a.id,
      title: a.title,
      source_project: a.project_id,
      status: a.status,
    })),
    count: upstreamAdrs.length,
  };
}

module.exports = {
  getRegistryPath,
  loadADRRegistry,
  saveADRRegistry,
  parseADRMarkdown,
  scanProjectADRs,
  registerADR,
  scanAndRegisterAll,
  getADRImpacts,
  auditADRAwareness,
};
