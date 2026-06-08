# ADR-012: Advanced Multi-Project Features

**Status:** Accepted  
**Date:** 2026-06-03  
**Author:** Jump Start Framework  
**Related:** ADR-009 (Multi-Workspace), ADR-010 (Sync), ADR-011 (Agent Integration)  
**Context:** Advanced capabilities for multi-project coordination at scale

## Problem

Phase 1-3 enabled basic multi-project support (registry, sync, lifecycle). But teams need:

1. **Parallel Project Mode** — Run multiple projects concurrently (not just sequential)
   - Current: Only one active project at a time (enforce_sequential_phases: true)
   - Need: Teams working on Project A (Phase 3) while Project B (Phase 1) in parallel

2. **Per-Project Cost Governance** — Budget limits, allocation, alerts
   - Current: Workspace-level token budget only
   - Need: Project-level budgets, cost guardrails, spending alerts

3. **Cross-Project ADR Registry** — Centralized decision tracking
   - Current: ADRs per project in `specs/decisions/ADR-NNN.md`
   - Need: Workspace-level ADR index, linked decisions, dependency tracking

4. **Knowledge Graph** — Link related projects, decisions, risks
   - Current: No relationship visibility between projects
   - Need: "Project A data model impacts Project C API design" graph

## Decision

Implement four advanced features with backward compatibility to sequential mode:

### 1. Parallel Project Mode

**Configuration:**
```yaml
# .jumpstart/config.yaml
workspace:
  enforcement_mode: sequential | parallel  # default: sequential
  parallel_settings:
    max_concurrent_projects: 3
    allow_phases: [0, 1, 2, 3, 4]
    blocked_phase_combinations: []  # e.g., ["proj-a:3", "proj-b:2"] (can't run simultaneously)
    conflict_resolution: first-come | priority_queue  # How to handle resource contention
```

**Behavior:**
- **Sequential Mode (current):**
  - Only one active project
  - Each project must complete phases 0→1→2→3→4 before next project starts
  - Simple, safe, linear

- **Parallel Mode (new):**
  - Up to N projects can have active agents running
  - Pre-command hook checks: are we at capacity?
  - Project locks remain per-project (prevent concurrent edits to same project)
  - New command: `workspace projects-in-flight` (show which projects are currently active)

**Implementation Plan:**
```javascript
// workspace.js new method
canAdvanceProject(projectId) {
  IF enforcement_mode === 'sequential':
    RETURN only_one_project_advancing()
  ELSE IF enforcement_mode === 'parallel':
    RETURN concurrent_projects_count() < max_concurrent_projects
}

// Pre-command hook
IF NOT canAdvanceProject(activeProjectId):
  FAIL with: "Parallel capacity exceeded. Max: 3 concurrent projects."
  SUGGEST: "Complete a project or pause work: workspace pause proj-X"
```

**New Commands:**
- `workspace projects-in-flight` — Show which projects have agents running
- `workspace pause <project-id>` — Mark project as not advancing (frees concurrent slot)
- `workspace resume <project-id>` — Mark project as advancing again

---

### 2. Per-Project Cost Governance

**Configuration:**
```yaml
# projects.json per project
{
  "project_id": "proj-token-analytics",
  "cost_governance": {
    "token_budget": 100000,
    "token_used": 12400,
    "alert_threshold_percent": 80,
    "alert_threshold_absolute": 80000,
    "owner": "eric@company.com",
    "cost_center": "AI-PLATFORM-001",
    "monthly_budget": 500000
  }
}
```

**Behavior:**
- Track per-project token usage in `usage-log.json` (already implemented)
- Check budget before agent runs:
  ```javascript
  IF tokens_used + estimated_phase_cost > token_budget:
    WARN: "Project approaching budget: 78% used"
    OR FAIL: "Budget exceeded. Cannot advance without approval."
  ```
- Report budget status:
  ```bash
  workspace report --cost-breakdown
  # Output:
  # proj-token-analytics: 12,400 / 100,000 (12%)
  # proj-cost-dashboard:  8,100 / 75,000  (11%)
  # proj-optimization-engine: 0 / 50,000 (0%)
  # ---
  # Workspace total: 20,500 / 1,000,000 (2%)
  ```

**Implementation Plan:**
```javascript
// workspace.js new method
checkProjectBudget(projectId) {
  const project = this.config.projects.find(p => p.project_id === projectId);
  const usage = loadProjectUsageLog(projectId);
  
  const pct = (usage.total_tokens / project.cost_governance.token_budget) * 100;
  
  IF pct > project.cost_governance.alert_threshold_percent:
    WARN: `Project ${projectId} is ${pct}% through budget`
  IF usage.total_tokens > project.cost_governance.token_budget:
    FAIL with: "Budget exceeded"
}

// Pre-command hook
checkProjectBudget(activeProjectId)
```

**New Commands:**
- `workspace budget --project=<id>` — Show budget status for project
- `workspace adjust-budget --project=<id> --new-limit=<tokens>` — Update project budget
- `workspace allocate-budget --method=equal|priority|custom` — Redistribute workspace budget across projects

---

### 3. Cross-Project ADR Registry

**Structure:**
```
.jumpstart/adr-registry.json
├─ adr_index: [
│    {
│      id: "ADR-001",
│      title: "Use Dynatrace Grail as primary data source",
│      project_id: "proj-token-analytics",
│      phase: 3,
│      status: "Accepted",
│      decision_date: "2026-06-01",
│      impacts: [
│        { project_id: "proj-cost-dashboard", reason: "Grail queries must meet SLA", decision_id: "ADR-005" },
│        { project_id: "proj-optimization-engine", reason: "Optimization rules depend on Grail API stability" }
│      ],
│      tags: ["architecture", "data-model"],
│      linked_adrs: ["ADR-002", "ADR-003"]
│    }
│  ]
└─ dependency_graph: [
     { from_adr: "ADR-001", to_adr: "ADR-005", reason: "ADR-001 enables ADR-005 decision" }
   ]
```

**Behavior:**
- On phase gate approval, scan for new ADRs in `specs/decisions/ADR-NNN.md`
- Extract title, status, and impacts
- Auto-register in workspace ADR registry
- Validate: Are downstream projects aware of upstream ADR changes?

**Implementation Plan:**
```javascript
// On phase gate approval hook:
scanForNewADRs(projectId) {
  const adrDir = path.join(projectPath, 'specs', 'decisions');
  const newAdrs = fs.readdirSync(adrDir)
    .filter(f => f.match(/ADR-\d+\.md/))
    .map(f => parseADR(f));
  
  newAdrs.forEach(adr => {
    this.registerADR(projectId, adr);
    if (adr.impacts.length > 0) {
      notifyAffectedProjects(adr.impacts);
    }
  });
}

registerADR(projectId, adrData) {
  const registry = loadADRRegistry();
  registry.adr_index.push({
    id: adrData.id,
    project_id: projectId,
    ...adrData
  });
  saveADRRegistry(registry);
}
```

**New Commands:**
- `workspace adr-index` — List all ADRs across all projects
- `workspace adr-impacts <adr-id>` — Show which projects are impacted by an ADR
- `workspace adr-links <adr-id>` — Show related ADRs
- `workspace audit-adr-awareness <project-id>` — Check if project knows about upstream ADRs

---

### 4. Knowledge Graph (Cross-Project Relationships)

**Structure:**
```
.jumpstart/knowledge-graph.json
├─ nodes: [
│    { id: "proj-token-analytics", type: "project", label: "Token Analytics", status: "phase-1" },
│    { id: "decision-grail-primary", type: "decision", label: "Grail is primary", project: "proj-token-analytics" },
│    { id: "risk-grail-sla", type: "risk", label: "Grail API SLA risk", project: "proj-token-analytics" },
│    { id: "persona-finance-analyst", type: "persona", label: "Finance Analyst", project: "proj-token-analytics" }
│  ]
├─ edges: [
│    { from: "proj-token-analytics", to: "proj-cost-dashboard", relation: "api_dependency", impact: "high" },
│    { from: "decision-grail-primary", to: "risk-grail-sla", relation: "creates_risk" },
│    { from: "persona-finance-analyst", to: "proj-cost-dashboard", relation: "uses_output_of" }
│  ]
└─ queries: [
     { name: "downstream-projects", query: "MATCH (p:project)-[:DEPENDS_ON]->(upstream)" },
     { name: "risky-decisions", query: "MATCH (d:decision)-[:CREATES_RISK]->(r:risk)" }
   ]
```

**Behavior:**
- Extract nodes from all project specs (personas, decisions, risks, acceptance criteria)
- Build edges from cross-project dependencies
- Enable queries like: "What projects depend on Token Analytics API stability?"
- Warn on breaking changes: "Changing ADR-001 may impact 2 downstream projects"

**Implementation Plan:**
```javascript
// Build knowledge graph on workspace report
buildKnowledgeGraph() {
  const graph = { nodes: [], edges: [] };
  
  // Add project nodes
  this.config.projects.forEach(proj => {
    graph.nodes.push({
      id: proj.project_id,
      type: "project",
      label: proj.name,
      status: proj.status
    });
  });
  
  // Add decision nodes (from ADR registry)
  this.getADRRegistry().forEach(adr => {
    graph.nodes.push({
      id: `decision-${adr.id}`,
      type: "decision",
      label: adr.title,
      project: adr.project_id
    });
  });
  
  // Add edges (dependencies, impacts)
  this.config.dependencies.forEach(dep => {
    graph.edges.push({
      from: dep.from,
      to: dep.to,
      relation: dep.type,
      impact: "high"
    });
  });
  
  return graph;
}

// Query the graph
queryKnowledgeGraph(query) {
  // query: "MATCH (p:project)-[:api_dependency]->(upstream:project) WHERE p.id='proj-cost-dashboard'"
  // Returns: [proj-token-analytics]
  
  // Simple path-finding for MVP:
  // - "downstream-of <project-id>"
  // - "impacts-of <decision-id>"
  // - "blocks <project-id>"
}
```

**New Commands:**
- `workspace knowledge-graph --format=graphviz` — Export graph as visualization
- `workspace query-graph "downstream-of proj-token-analytics"` — Query knowledge graph
- `workspace impact-analysis --change=ADR-001` — Show impact of changing a decision
- `workspace dependency-path proj-optimization-engine proj-token-analytics` — Show dependency chain

---

## Consequences

### Positive

✅ **Parallel mode** — Teams can work on multiple projects simultaneously  
✅ **Cost governance** — Budget visibility and guardrails prevent runaway spending  
✅ **ADR registry** — Decisions discoverable across projects, impacts visible  
✅ **Knowledge graph** — Relationship visibility prevents surprise dependencies  
✅ **Backward compatible** — Sequential mode remains default, opt-in to parallel  

### Negative

⚠️ **Complexity** — Adds parallel locks, cost tracking, graph querying  
⚠️ **Lock contention** — May need retry logic when multiple projects compete  
⚠️ **Graph maintenance** — Knowledge graph can become stale if not updated  
⚠️ **Query performance** — Large knowledge graphs may need optimization  

### Mitigations

- Default to **sequential mode** (safest)
- Cost governance is optional per project
- ADR registry is auto-populated (no manual entry)
- Knowledge graph uses simple path-finding MVP (not full Neo4j)

## Implementation Roadmap

### Phase 4.1: Parallel Project Mode (2-3 hours)
- [ ] Add enforcement_mode config setting
- [ ] Implement canAdvanceProject() check
- [ ] Add `projects-in-flight` command
- [ ] Test concurrent project advancement

### Phase 4.2: Cost Governance (2-3 hours)
- [ ] Add per-project token_budget to projects.json
- [ ] Implement checkProjectBudget() hook
- [ ] Add `budget` and `allocate-budget` commands
- [ ] Test budget alerting

### Phase 4.3: ADR Registry (3-4 hours)
- [ ] Create adr-registry.json schema
- [ ] Implement scanForNewADRs() hook
- [ ] Add `adr-index` and `adr-impacts` commands
- [ ] Test ADR discovery on phase gate

### Phase 4.4: Knowledge Graph (4-5 hours)
- [ ] Design graph schema (nodes, edges, queries)
- [ ] Implement buildKnowledgeGraph() method
- [ ] Add basic query support
- [ ] Export to GraphViz for visualization

---

## Testing

- [ ] Parallel mode: 3 projects advancing simultaneously
- [ ] Cost governance: Budget alerts trigger at 80%, fail at 100%
- [ ] ADR registry: New ADRs auto-discovered on phase gate
- [ ] Knowledge graph: Queries return correct downstream projects
- [ ] Backward compatibility: Sequential mode still works
- [ ] Performance: Knowledge graph queries < 100ms for 20 projects

## References

- ADR-009 — Multi-Workspace (Phase 1)
- ADR-010 — Sync Mechanism (Phase 2)
- ADR-011 — Agent Integration (Phase 2)
- `.jumpstart/PHASE-2-IMPLEMENTATION.md` — Implementation summary
- `bin/workspace.js` — CLI implementation
