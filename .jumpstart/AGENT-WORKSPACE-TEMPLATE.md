# Agent: Workspace-Aware Template

This is a reference template showing how any Jump Start agent should integrate workspace support.

## Step 1: Input Context — Workspace Detection (Early in protocol)

```markdown
### Workspace Mode Detection

Before starting your protocol:

1. Check if `.jumpstart/projects.json` exists:
   - **If YES (workspace mode):** Load active project config and state
   - **If NO (single-project mode):** Use global config.yaml (existing behavior)

2. If workspace mode:
   ```javascript
   const workspaceContext = require('../lib/workspace-context');
   context.workspace = workspaceContext.getWorkspaceContext(process.cwd());
   ```
   Now you have:
   - `context.workspace.mode` — "multi-project" or "single-project"
   - `context.workspace.project` — Active project metadata
   - `context.workspace.config` — Merged config (project + workspace)
   - `context.workspace.state` — Project-scoped state

3. Use workspace-aware paths:
   - **Global mode:** `specs/challenger-brief.md`
   - **Workspace mode:** `projects/{active_project_id}/specs/challenger-brief.md`
   - **Helper:** Use `context.workspace.config.specs_path` for both
```

## Step 2: Load Upstream Artifacts — Dynamic Spec Loading

**Before reading an upstream artifact, always use workspace-aware loading:**

```javascript
const specLoader = require('../lib/spec-loader');

// Load Phase 0 brief (for Analyst)
const upstream = specLoader.loadUpstreamArtifact(context.workspace, 0);
if (!upstream.loaded) {
  console.error(`❌ Cannot proceed: ${upstream.error}`);
  process.exit(1);
}
const challengerBrief = upstream.spec.content;
```

**This automatically:**
- ✅ Detects workspace mode
- ✅ Loads from correct project path
- ✅ Validates phase gate is approved
- ✅ Extracts metadata (approver, date, status)

## Step 3: Phase Gate Approval — Auto-Update Project State

**When human approves a spec, update project-scoped state:**

```javascript
const phaseGateUpdater = require('../lib/phase-gate-updater');

// User clicked "Approve" on specs/product-brief.md
// Hook fires: post-phase-gate-approval
const result = phaseGateUpdater.approvePhase(
  context.workspace,
  'projects/proj-token-analytics/specs/product-brief.md',
  'Eric'
);

// Returns:
// {
//   success: true,
//   project_id: 'proj-token-analytics',
//   phase: 1,
//   approved_by: 'Eric',
//   approval_date: '2026-06-03',
//   unblocked_projects: ['proj-cost-dashboard']
// }

if (result.unblocked_projects.length > 0) {
  console.log(`✅ Unblocked: ${result.unblocked_projects.join(', ')}`);
  // Notify Pit Crew that downstream projects can advance
}
```

## Step 4: Before Any Command — Validate Sync

**Pre-command hook validates projects.json ↔ state.json are in sync:**

```javascript
const workspaceManager = require('../bin/workspace');
const manager = new workspaceManager.WorkspaceManager();
const drifts = manager.validateSync();

if (drifts.length > 0) {
  const errors = drifts.filter(d => d.severity === 'error');
  if (errors.length > 0) {
    console.error('❌ Sync mismatch detected. Run: workspace sync --pull');
    process.exit(1);
  } else {
    console.warn('⚠️  Sync drift detected. Continue with caution.');
  }
}
```

## Step 5: Pit Crew Context — Cross-Project Data

**When Pit Crew (Facilitator) runs, inject workspace context:**

```markdown
### Workspace Context (Multi-Project Only)

If workspace mode is detected, you have access to:

**Projects:** 
- proj-token-analytics (Phase 1, status: phase-1)
- proj-cost-dashboard (Phase 0, status: phase-0, blocked_by: proj-token-analytics)
- proj-optimization-engine (initializing, blocked_by: proj-token-analytics, proj-cost-dashboard)

**Dependencies:**
- proj-cost-dashboard → proj-token-analytics (reason: API dependency)
- proj-optimization-engine → proj-token-analytics (reason: data dependency)
- proj-optimization-engine → proj-cost-dashboard (reason: UI integration)

**Your Role:** Validate cross-project architecture and recommend unblocking strategy.
```

---

## Integration Checklist

For each phase agent (Challenger, Analyst, PM, Architect, Developer):

- [ ] Add "Workspace Mode Detection" step to Input Context section
- [ ] Update all artifact-loading code to use `specLoader.loadUpstreamArtifact()`
- [ ] Update phase gate hook to call `phaseGateUpdater.approvePhase()`
- [ ] Add pre-command sync validation (pre-phase-command hook)
- [ ] Test in single-project mode (backward compatibility)
- [ ] Test in multi-project mode (token-usage-research scenario)

---

## Example: Analyst Agent Update

### Before (Single-Project)
```markdown
## Step 2: Load Upstream Artifacts

Read the Challenger Brief from Phase 0:
- Spec location: `specs/challenger-brief.md`
- Ensure Phase Gate is marked [x] approved before continuing
```

### After (Workspace-Aware)
```markdown
## Step 2: Load Upstream Artifacts

Read the Challenger Brief from Phase 0:

```javascript
const specLoader = require('../lib/spec-loader');
const upstream = specLoader.loadUpstreamArtifact(context.workspace, 0);
if (!upstream.loaded) {
  console.error(`Cannot proceed: ${upstream.error}`);
  process.exit(1);
}
```

This automatically:
- ✅ Loads from `specs/challenger-brief.md` (single-project)
- ✅ OR `projects/proj-token-analytics/specs/challenger-brief.md` (workspace)
- ✅ Validates [x] approved phase gate
- ✅ Extracts approver and date metadata
```

---

## Code Locations

**Workspace Context Library:**
- `lib/workspace-context.js` — Detect mode, load project, merge configs

**Spec Loader Library:**
- `lib/spec-loader.js` — Load specs with project scope, validate gates

**Phase Gate Updater Library:**
- `lib/phase-gate-updater.js` — Update state on approval, detect unblocks

**Workspace Manager (CLI + Hooks):**
- `bin/workspace.js` — Sync commands + validation

**Agent Templates (to be updated):**
- `.jumpstart/agents/challenger.md`
- `.jumpstart/agents/analyst.md`
- `.jumpstart/agents/pm.md`
- `.jumpstart/agents/architect.md`
- `.jumpstart/agents/developer.md`
- `.jumpstart/agents/facilitator.md`
