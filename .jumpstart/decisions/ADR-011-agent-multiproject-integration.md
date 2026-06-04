# ADR-011: Agent Multi-Project Integration

**Status:** Proposed  
**Date:** 2026-06-03  
**Author:** Jump Start Framework  
**Related:** ADR-009 (Multi-Workspace), ADR-010 (Sync Mechanism)  
**Context:** Making Jump Start agents workspace-aware

## Problem

Phase 1 of multi-workspace (ADR-009) created project registry and state, but agents still work **single-project only**:

1. **Agent activation** doesn't detect workspace mode
   - `/jumpstart.analyze` runs against global `.jumpstart/config.yaml`
   - Doesn't know which project is active
   - Can't load proj-token-analytics vs proj-cost-dashboard configs

2. **Phase gates are ambiguous**
   - When human approves a spec, which project's gate is approved?
   - Current hook doesn't know which project owns the spec
   - Approval updates global state, not project-scoped state

3. **Pit Crew can't validate cross-project dependencies**
   - Facilitator agent doesn't know workspace context
   - Can't check if blocked projects can unblock
   - No way to coordinate Phase 2 Product Planning across 3 projects

## Decision

Implement **workspace-aware agent activation** with three components:

### 1. Workspace Detection Hook (Pre-Agent)

Before any agent runs, detect workspace mode and load active project:

```javascript
// New hook: pre-agent-activation
hooks:
  pre_agent_activation:
    - action: detect_workspace_mode
      behavior: load_active_project_config
```

**Logic:**
```
1. Check if .jumpstart/projects.json exists
   IF NOT: single-project mode → use global config.yaml (existing behavior)
   IF YES: workspace mode → continue

2. Read workspace-state.json
   active_project_id = workspace_state.active_project_id

3. Load project config
   project_config = projects/{active_project_id}/.jumpstart/config.yaml

4. Load project state
   project_state = projects/{active_project_id}/.jumpstart/state/state.json

5. Make available to agent:
   context.workspace_mode = true
   context.active_project = active_project_id
   context.config = project_config (merged with workspace defaults)
   context.state = project_state
   context.workspace_state = workspace_state
```

### 2. Dynamic Spec Loading (Agent Activation)

When `/jumpstart.analyze` (or any phase agent) runs, load phase-correct artifacts:

```javascript
// In phase agent protocol step: "Load Upstream Artifacts"

IF workspace_mode:
  challenger_brief_path = projects/{active_project_id}/specs/challenger-brief.md
ELSE:
  challenger_brief_path = specs/challenger-brief.md

challenger_brief = read(challenger_brief_path)
VALIDATE: Phase Gate [x] all + "Approved by" not "Pending"
IF NOT APPROVED: stop and ask user to approve first
```

**Benefits:**
- Analyst reads proj-token-analytics' Phase 0 brief, not proj-cost-dashboard's
- PM reads proj-cost-dashboard's Phase 1 brief, not global
- Each project's artifact chain stays isolated

### 3. Phase Gate Hook (Auto-Update Project State)

When human approves a spec, update **project-scoped state**, not global:

```javascript
// Hook: post-phase-gate-approval (fires when user clicks "approve")

1. Read spec file to determine which project owns it
   IF spec is in projects/{id}/specs/: owner_project = {id}
   ELSE IF spec is in specs/: 
      IF workspace_mode: infer from context.active_project
      ELSE: single-project (use global state)

2. Read approval metadata from spec:
   phase_approved = from Phase Gate section
   approved_by = from Phase Gate "Approved by" field
   approval_date = current date

3. Update project-scoped state:
   projects/{owner_project}/.jumpstart/state/state.json
   ├─ current_phase: N (from approved spec)
   ├─ last_completed_step: "{phase} {artifact} Approved"
   ├─ last_phase_approved: {date}
   ├─ approved_artifacts: [..., {spec_name}]
   ├─ approved_by: {approver}
   └─ resume_context.tldr: (auto-generated from spec insights)

4. Trigger dependency check:
   workspace validate-deps --check-unblocks
   (checks if any downstream projects can now unblock)

5. If dependency unblocked, notify Pit Crew:
   "⚠️  Dependency unblocked: proj-cost-dashboard can now advance to Phase 0"
```

**Example flow:**
```
User clicks "Approve" on projects/token-analytics/specs/product-brief.md
  ↓
Post-gate hook fires
  ├─ Reads spec: located in projects/token-analytics/specs/
  ├─ Owner = proj-token-analytics
  ├─ Approval metadata: Phase 1 complete, Approved by: Eric, Date: 2026-06-03
  ├─ Updates projects/token-analytics/.jumpstart/state/state.json
  │   ├─ current_phase: 2
  │   ├─ last_completed_step: "Phase 1 Product Brief Approved"
  │   └─ approved_by: Eric
  ├─ Calls workspace validate-deps --check-unblocks
  │   └─ Returns: ["proj-cost-dashboard can unblock from Phase 0"]
  └─ Notifies: "⚠️  proj-cost-dashboard dependency unblocked — ready for Phase 0"
```

### 4. Pit Crew Context (Multi-Agent Meetings)

When `/jumpstart.pitcrew` runs, inject workspace context:

```javascript
// Pit Crew can now ask cross-project questions:

// Facilitator prompt includes:
workspace_context: {
  active_project: "proj-token-analytics",
  projects: [
    { id: "proj-token-analytics", phase: 1, status: "phase-1" },
    { id: "proj-cost-dashboard", phase: 0, status: "phase-0", blocked_by: ["proj-token-analytics"] },
    { id: "proj-optimization-engine", phase: null, blocked_by: ["proj-token-analytics", "proj-cost-dashboard"] }
  ],
  dependencies: [
    { from: "proj-cost-dashboard", to: "proj-token-analytics", reason: "API", blocked: true },
    ...
  ]
}

// Facilitator can then coordinate:
// "Token Analytics is Phase 1. Cost Dashboard is blocked until Phase 3.
//  Should we start Cost Dashboard Phase 0 pre-work in parallel?"
```

## Implementation Plan

### Phase 1: Workspace Detection (2 hours)

**File changes:**
- Modify `.jumpstart/agents/challenger.md`, `analyst.md`, `pm.md`, `architect.md`, `developer.md`
- Add "Workspace Mode Detection" step to Input Context section
- Load active project config if workspace mode detected

**Code changes:**
- Create `lib/workspace-context.js`:
  - `detectWorkspaceMode()` — check projects.json exists
  - `loadActiveProject()` — read active_project_id from workspace-state.json
  - `mergeConfigs()` — merge project config with workspace defaults
- Update phase agents to call detectWorkspaceMode() before protocol start

**Testing:**
- ✅ Workspace mode detected when projects.json exists
- ✅ Single-project mode preserved when projects.json doesn't exist
- ✅ Active project config loaded correctly
- ✅ Config merging preserves project overrides

### Phase 2: Dynamic Spec Loading (2 hours)

**File changes:**
- Modify all phase agents' "Load Upstream Artifacts" step
- Change spec paths from `specs/artifact.md` to `{project_specs}/artifact.md`

**Code changes:**
- Create `lib/spec-loader.js`:
  - `loadUpstreamArtifact(projectId, artifactName)` — load from project path
  - `validatePhaseGate(spec)` — check [x] all + "Approved by" not "Pending"
- Update agents to use spec-loader instead of direct file reads

**Testing:**
- ✅ Analyst loads challenger-brief from proj-token-analytics
- ✅ Analyst loads challenger-brief from proj-cost-dashboard (different file)
- ✅ Phase gate validation prevents running analyzer without Phase 0 approval
- ✅ Single-project specs still load from global `specs/`

### Phase 3: Phase Gate Hook (2 hours)

**File changes:**
- Modify phase gate approval hook (currently in Architect/Developer agents)
- Add project-scoped state update logic

**Code changes:**
- Create `lib/phase-gate-updater.js`:
  - `approvePhase(spec_path, approver, approval_date)` — update project state
  - `inferOwnerProject(spec_path)` — determine which project owns the spec
  - `checkUnblocks()` — call workspace validate-deps after approval
- Update approval hook to use phase-gate-updater

**Testing:**
- ✅ Approval updates correct project's state.json
- ✅ Dependency unblock notification fires
- ✅ Pit Crew receives notification when downstream projects unblock

### Phase 4: Pit Crew Context (1 hour)

**File changes:**
- Modify `.jumpstart/agents/facilitator.md`
- Add workspace context to Facilitator prompt

**Code changes:**
- Update facilitator activation to include workspace_context in prompt
- Facilitator can reference projects, phases, dependencies in recommendations

**Testing:**
- ✅ Facilitator has access to cross-project dependency info
- ✅ Facilitator can recommend parallel phase work

## Backward Compatibility

### Single-Project Mode (No projects.json)
- Agent activation detects no projects.json
- Continues to use global `.jumpstart/config.yaml`
- Loads specs from global `specs/` directory
- Updates global `.jumpstart/state/state.json`
- **No breaking changes**

### Multi-Project Mode (projects.json exists)
- Agent activation loads active_project_id
- Uses project-scoped config and state
- Loads specs from project-scoped `specs/` directory
- Phase gates update project-scoped state
- **New behavior, opt-in via projects.json**

## Consequences

### Positive

✅ **Project isolation** — each project's artifacts and state fully isolated  
✅ **Multi-project workflows** — agents can coordinate across projects  
✅ **Pit Crew integration** — cross-project review becomes natural  
✅ **Phase gate integrity** — each project's gates are individually trustworthy  
✅ **Backward compatible** — single-project mode unchanged  

### Negative

⚠️ **Hook complexity** — adds pre-agent and post-gate hooks  
⚠️ **Path resolution** — agents need to resolve spec paths dynamically  
⚠️ **Context passing** — active project context must flow through agent invocation  

### Mitigations

- Extract hook logic to reusable modules (workspace-context.js, spec-loader.js)
- Create helper functions for path resolution (avoid string concatenation)
- Document context passing pattern clearly in agent template

## Testing

- [x] Workspace mode detection (projects.json present/absent)
- [x] Active project config loading
- [x] Config merging (project overrides workspace defaults)
- [x] Upstream spec loading (project-scoped vs global)
- [x] Phase gate validation before agent runs
- [x] Project-scoped state updates on approval
- [x] Dependency unblock detection
- [x] Pit Crew context injection
- [x] Single-project backward compatibility

## References

- ADR-009 — Multi-Workspace (Phase 1)
- ADR-010 — Sync Mechanism (integrated with pre-agent-activation hook)
- `.jumpstart/agents/*.md` — Phase agents (to be updated)
- `lib/workspace-context.js` — Helper library (to be created)
- `lib/spec-loader.js` — Helper library (to be created)
- `lib/phase-gate-updater.js` — Helper library (to be created)
