#!/usr/bin/env node

/**
 * workspace-knowledge-graph.js
 * Cross-project relationship graph built from registry, deps, and ADR index.
 */

const fs = require('fs');
const path = require('path');
const { loadADRRegistry } = require('./workspace-adr-registry');

function getGraphPath(rootDir) {
  return path.join(rootDir, '.jumpstart', 'knowledge-graph.json');
}

function defaultGraph() {
  return {
    version: '1.0.0',
    nodes: [],
    edges: [],
    last_updated: null,
  };
}

function loadKnowledgeGraph(rootDir) {
  const graphPath = getGraphPath(rootDir);
  if (!fs.existsSync(graphPath)) {
    return defaultGraph();
  }
  try {
    return JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  } catch {
    return defaultGraph();
  }
}

function saveKnowledgeGraph(rootDir, graph) {
  const graphPath = getGraphPath(rootDir);
  fs.mkdirSync(path.dirname(graphPath), { recursive: true });
  graph.last_updated = new Date().toISOString();
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  return graph;
}

function upsertNode(nodes, node) {
  const idx = nodes.findIndex((n) => n.id === node.id);
  if (idx >= 0) {
    nodes[idx] = { ...nodes[idx], ...node };
  } else {
    nodes.push(node);
  }
}

function upsertEdge(edges, edge) {
  const key = `${edge.from}|${edge.to}|${edge.relation}`;
  const exists = edges.some(
    (e) => `${e.from}|${e.to}|${e.relation}` === key
  );
  if (!exists) {
    edges.push(edge);
  }
}

function buildKnowledgeGraph(rootDir, config, workspaceState) {
  const graph = defaultGraph();
  const adrRegistry = loadADRRegistry(rootDir);

  for (const project of config.projects || []) {
    const id = project.id || project.project_id;
    upsertNode(graph.nodes, {
      id,
      type: 'project',
      label: project.name,
      status: project.status,
      phase: project.phase,
    });
  }

  const deps = workspaceState?.workspace_resume_context?.cross_project_dependencies || [];
  for (const dep of deps) {
    upsertEdge(graph.edges, {
      from: dep.from,
      to: dep.to,
      relation: dep.type || 'dependency',
      impact: dep.blocked ? 'blocked' : 'active',
      unblock_condition: dep.unblock_condition || null,
    });
  }

  for (const adr of adrRegistry.adr_index || []) {
    upsertNode(graph.nodes, {
      id: `decision-${adr.id}`,
      type: 'decision',
      label: adr.title,
      project: adr.project_id,
      status: adr.status,
    });
    upsertEdge(graph.edges, {
      from: adr.project_id,
      to: `decision-${adr.id}`,
      relation: 'decided',
    });
    for (const impact of adr.impacts || []) {
      if (impact.project_id) {
        upsertEdge(graph.edges, {
          from: `decision-${adr.id}`,
          to: impact.project_id,
          relation: 'impacts',
          impact: 'high',
          reason: impact.reason || null,
        });
      }
    }
  }

  saveKnowledgeGraph(rootDir, graph);
  return graph;
}

function queryDownstreamOf(graph, projectId) {
  const direct = graph.edges
    .filter((e) => e.from === projectId && graph.nodes.some((n) => n.id === e.to && n.type === 'project'))
    .map((e) => e.to);

  const viaDecision = graph.edges
    .filter((e) => e.from === projectId && e.relation === 'decided')
    .flatMap((decEdge) =>
      graph.edges
        .filter((e) => e.from === decEdge.to && e.relation === 'impacts')
        .map((e) => e.to)
    );

  return [...new Set([...direct, ...viaDecision])];
}

function queryBlocks(graph, projectId) {
  return graph.edges
    .filter((e) => e.to === projectId && e.impact === 'blocked')
    .map((e) => ({ from: e.from, relation: e.relation, unblock_condition: e.unblock_condition }));
}

function queryImpactAnalysis(graph, adrId) {
  const nodeId = adrId.startsWith('decision-') ? adrId : `decision-${adrId.toUpperCase()}`;
  const impacted = graph.edges
    .filter((e) => e.from === nodeId && e.relation === 'impacts')
    .map((e) => ({ project_id: e.to, reason: e.reason }));

  return {
    adr_id: adrId.toUpperCase(),
    impacted_projects: impacted,
    count: impacted.length,
  };
}

function toGraphviz(graph) {
  const lines = ['digraph workspace {', '  rankdir=LR;'];
  for (const node of graph.nodes) {
    const shape = node.type === 'decision' ? 'box' : 'ellipse';
    lines.push(`  "${node.id}" [label="${node.label || node.id}" shape=${shape}];`);
  }
  for (const edge of graph.edges) {
    lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.relation}"];`);
  }
  lines.push('}');
  return lines.join('\n');
}

function runGraphQuery(graph, queryString) {
  const trimmed = (queryString || '').trim();
  const downstreamMatch = trimmed.match(/^downstream-of\s+(proj-[a-z0-9-]+)$/i);
  if (downstreamMatch) {
    return { query: trimmed, results: queryDownstreamOf(graph, downstreamMatch[1]) };
  }

  const blocksMatch = trimmed.match(/^blocks\s+(proj-[a-z0-9-]+)$/i);
  if (blocksMatch) {
    return { query: trimmed, results: queryBlocks(graph, blocksMatch[1]) };
  }

  const impactMatch = trimmed.match(/^impact-of\s+(ADR-\d+)$/i);
  if (impactMatch) {
    return { query: trimmed, results: queryImpactAnalysis(graph, impactMatch[1]) };
  }

  return {
    query: trimmed,
    error: 'Unsupported query. Try: downstream-of proj-alpha | blocks proj-beta | impact-of ADR-001',
    results: [],
  };
}

module.exports = {
  getGraphPath,
  loadKnowledgeGraph,
  saveKnowledgeGraph,
  buildKnowledgeGraph,
  queryDownstreamOf,
  queryBlocks,
  queryImpactAnalysis,
  runGraphQuery,
  toGraphviz,
};
