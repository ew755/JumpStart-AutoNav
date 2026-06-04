# ADR-009: Multi-Workspace Project Coordination

**Status:** Accepted (Phase 1 Complete)  
**Date:** 2026-06-03  
**Author:** Jump Start Framework  
**Context:** Supporting multiple AI projects in a single workspace  
**Phase 1 Complete:** 2026-06-03 — Registry, state, CLI, schema, docs all shipped  
**Phase 2 ADR:** ADR-011 (Agent Multi-Project Integration)  
**Sync ADR:** ADR-010 (Sync Mechanism)

## Problem

Jump Start was designed as **single-project per workspace**. Teams working on multiple AI initiatives need to:

1. Share agent personas, templates, and skills across projects
2. Coordinate dependencies between projects (e.g., Project B's dashboard depends on Project A's token metrics)
3. Track token usage and costs at both project and workspace levels
4. Maintain phase gate integrity while allowing sequenced project advancement
5. Invoke Pit Crew for cross-project architecture review

**Without multi-workspace support,** teams resort to:
- Separate workspace folders (loses shared context)
- Monolithic specs (loses project isolation)
- Manual dependency tracking (error-prone, not auditable)

## Decision

Implement **workspace-scoped multi-project coordination** with:

1. **Project Registry** (`.jumpstart/projects.json`)
   - List of all projects with metadata (id, name, path, phase, status, lock state)
   - Workspace-level settings (sequential enforcement, parallel mode, Pit Crew requirements)
   - Active project pointer

2. **Shared Assets** (workspace-level)
   - `.jumpstart/agents/` — all projects use same personas
   - `.jumpstart/templates/` — consistent spec structure
   - `.jumpstart/skills/` — shared domain knowledge
   - `.jumpstart/schemas/` — unified schema validation

3. **Isolated Assets** (per-project)
   - `specs/` — project-owned artifacts
   - `src/`, `tests/` — project code
   - `.jumpstart/state/` (per-project) — phase tracking

4. **Workspace State** (`.jumpstart/state/workspace-state.json`)
   - Active project tracking
   - Project locks (prevent concurrent agent execution)
   - Cross-project dependencies
   - Workspace resume context (for session resumption)

5. **CLI Commands** (`jumpstart-mode workspace ...`)
   - `status` — show all projects
   - `set-active` — switch active project
   - `validate-deps` — check cross-project integrity
   - `report` — aggregate cost/phase report
   - `archive`, `create-project` — project lifecycle (future)

## Consequences

### Positive

✅ **Shared learning** — agents, templates, skills reused across projects  
✅ **Unified cost tracking** — workspace-level budget visibility  
✅ **Dependency safety** — Pit Crew validates before phase gates  
✅ **Session recovery** — resume context survives project switches  
✅ **Backward compatible** — single-project workflows still work (proj-default)  

### Negative

⚠️ **Complexity** — adds config layer, lock management, CLI surface  
⚠️ **Lock contention** — if `allow_parallel_projects: false`, only one active project can advance  
⚠️ **Schema evolution** — future schema changes require migration  

### Mitigations

- Default to **sequential mode** (`allow_parallel_projects: false`) — simplest case
- Auto-detect single-project setup; no breaking changes
- Phase gates still enforced per-project (no shortcuts)
- Pit Crew review before cross-project approval gates
- Schema versioning in `projects.json` for migrations

## Alternatives Considered

### A1: Separate Workspace Folders (Rejected)

**Approach:** Each project in its own folder; no shared context  
**Why rejected:** Loses benefits of shared templates, skills, agents; requires manual dep tracking

### A2: Single Monolithic Spec (Rejected)

**Approach:** One large `specs/` folder; multiple projects as sections  
**Why rejected:** Violates spec isolation; makes phase gates ambiguous; hard to archive/move projects

### A3: Post-Delivery Reporting (Rejected)

**Approach:** Track dependencies only after projects are built  
**Why rejected:** Too late to catch integration issues; doesn't prevent scope creep

## Implementation Phases

### Phase 1: Registry & State ✅ COMPLETE (2026-06-03)
- ✅ Create `projects.json` (registry)
- ✅ Create `workspace-state.json` (runtime state)
- ✅ CLI: `workspace status`, `workspace set-active`, `workspace validate-deps`
- ✅ Schema validation, documentation, test suite
- ✅ 3-project scenario deployment

### Phase 2: Agent Integration & Sync (ADR-010, ADR-011) ⏳ IN PROGRESS
- Implement sync mechanism: `workspace sync` commands, drift detection, pre-command hook (ADR-010)
- Update agent activation to detect workspace mode (ADR-011)
- Load project-specific config based on active project
- Subagent invocation for Pit Crew on cross-project gates

### Phase 3: Lifecycle Commands (TBD)
- `workspace create-project` — add new projects
- `workspace archive` — soft-delete completed projects
- `workspace remove-project` — remove from registry

### Phase 4: Advanced Features (TBD)
- Parallel project mode (`allow_parallel_projects: true`)
- Cost governance per project
- ADR registry across projects
- Knowledge graph linking

## Testing

### Phase 1 Tests ✅ COMPLETE
- [x] Single-project → multi-workspace upgrade
- [x] Multi-project status reporting
- [x] Cross-project dependency validation
- [x] Lock contention handling
- [x] Token aggregation across projects
- [x] Session resumption with workspace context
- [x] Backward compatibility (no `projects.json` = single-project mode)
- [x] 3-project scenario validation (token-usage-research)

### Phase 2 Tests (Pending ADR-010, ADR-011)
- [ ] Sync command: pull, push, audit modes
- [ ] Drift detection and reporting
- [ ] Pre-command hook validation
- [ ] Agent workspace mode detection
- [ ] Dynamic config loading per project
- [ ] Pit Crew cross-project review invocation

## References

- `.jumpstart/MULTI_WORKSPACE.md` — User guide
- `.jumpstart/projects.json` — Project registry format
- `.jumpstart/schemas/workspace.schema.json` — Schema
- `bin/workspace.js` — CLI implementation
- `ADR-010` — Sync Mechanism (projects.json ↔ state.json)
- `ADR-011` — Agent Multi-Project Integration
- `tests/test-workspace-manager.test.js` — Phase 1 test suite
- `token-usage-research/.jumpstart/projects.json` — Live scenario
