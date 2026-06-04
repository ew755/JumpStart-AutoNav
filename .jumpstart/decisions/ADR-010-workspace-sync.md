# ADR-010: Workspace Sync Mechanism

**Status:** Proposed  
**Date:** 2026-06-03  
**Author:** Jump Start Framework  
**Related:** ADR-009 (Multi-Workspace), ADR-011 (Agent Integration)  
**Context:** Keeping projects.json in sync with actual workspace state

## Problem

Multi-workspace support introduced **drift risk** between:
- **projects.json** (manual registry of projects, metadata)
- **Actual state** (`.jumpstart/state/state.json` files per project, auto-updated by phase gates)

**Example drift scenario:**
```
projects.json says:
  current_phase: 1
  status: "phase-1"
  approved_artifacts: ["specs/product-brief.md"]

But actual state says:
  current_phase: 1
  product-brief.md NOT YET APPROVED
  last_completed_step: "Q8 answered"

Result: projects.json claims Phase 1 approval, but specs don't show it
```

This breaks:
- Phase gate integrity (commands think phase is approved when it isn't)
- Dependency validation (blocked projects unblock prematurely)
- Session recovery (resume context becomes stale)

## Decision

Implement **three-mode sync mechanism**:

### 1. **AUDIT Mode** (Passive, Report-Only)
Detect drift without changing anything.
```bash
workspace sync --audit
# Output:
# ⚠️  proj-token-analytics: DRIFT DETECTED
#    projects.json says: Phase 1 approved
#    Actual state says: Phase 1 in progress (product-brief NOT approved)
#    Recommendation: sync --pull (or manually approve product-brief.md)
```

### 2. **PULL Mode** (State → Registry)
Update projects.json to match actual state. **Safer for data loss.**
```bash
workspace sync --pull
# Reads all .jumpstart/state/*.json files
# Updates projects.json[].current_phase based on approved artifacts
# Use case: Recover from manual edit of projects.json
```

### 3. **PUSH Mode** (Registry → State)
Update state files to match projects.json. **Use when registry is source of truth.**
```bash
workspace sync --push
# Updates each project's state.json to match projects.json
# Validates phase gates match registry entries
# Use case: Enforce projects.json as golden config
```

### 4. **Pre-Command Hook** (Enforcement)
Every phase agent command validates sync before proceeding.

```yaml
# In .jumpstart/config.yaml:
hooks:
  pre_phase_command:
    - action: validate_sync
      mode: strict  # or 'warn'
      auto_fix: false
      
# When user runs: /jumpstart.analyze
# → Pre-hook: validateSync() → check projects.json vs state.json
#   If drift < 1 phase: warn, allow
#   If drift >= 1 phase: fail with "workspace sync --pull" suggestion
```

## Sync Algorithm

### validateSync(projectId)
```
1. Read projects.json[projectId]
   current_phase_registry = projects.json[projectId].current_phase

2. Read .jumpstart/state/state.json
   current_phase_actual = state.json.current_phase

3. Read specs/*.md (check which are approved)
   approved_artifacts = specs that have Phase Gate [x] all + Approved by set

4. Infer actual phase:
   IF current_phase_actual > current_phase_registry:
      DRIFT.severity = error (state advanced, registry didn't)
      DRIFT.direction = "state ahead"
   ELSE IF current_phase_actual == current_phase_registry:
      AND NOT ALL expected artifacts approved:
      DRIFT.severity = warn (phase marked as complete, but gate not fully approved)
      DRIFT.direction = "premature completion"
   ELSE IF current_phase_actual < current_phase_registry:
      DRIFT.severity = error (registry thinks we're further than we are)
      DRIFT.direction = "registry ahead"

5. Return: { synced: bool, drift: DRIFT | null }
```

### sync --pull
```
FOR EACH project IN projects.json:
  1. Infer actual phase from state.json + approved artifacts
  2. Update projects[].current_phase = actual_phase
  3. Update projects[].last_phase_approved = approved_by_date
  4. Update projects[].approved_by = from approved spec's "Approved by" field
  5. Update projects[].status based on phase (e.g., "phase-2" for phase 2)

SAVE projects.json
RETURN: { updated: count, errors: [] }
```

### sync --push
```
FOR EACH project IN projects.json:
  1. Load project/.jumpstart/state/state.json
  2. Update state.json.current_phase = projects[].current_phase
  3. Validate: all specs for current_phase must exist and be approved
     IF NOT: error and skip this project
  4. Save project/.jumpstart/state/state.json

RETURN: { updated: count, errors: [] }
```

## Consequences

### Positive

✅ **Drift detection** — `workspace sync --audit` catches phase gate violations  
✅ **Auto-recovery** — `sync --pull` recovers from manual edits  
✅ **Enforcement hook** — pre-command validation prevents bad state  
✅ **Flexible modes** — teams can choose audit-only or auto-push based on risk appetite  
✅ **Backward compatible** — single-project mode works unchanged  

### Negative

⚠️ **Additional complexity** — three sync modes, pre-command hooks, validation logic  
⚠️ **Potential data loss** — `sync --push` overwrites state.json without backup  
⚠️ **Edge case drift** — timestamp mismatches, partial approvals could still drift  

### Mitigations

- Default to **AUDIT mode** (report-only, no changes)
- Require explicit `--force` flag for destructive operations (`--push`)
- Create backup of projects.json before any sync
- Log all sync operations to `.jumpstart/state/sync-log.json` (audit trail)
- Pre-command hook default is "warn" (allow, but warn)

## Implementation Plan

### Phase 1: AUDIT Mode (2-3 hours)
- Implement validateSync() algorithm
- Implement `workspace sync --audit` command
- Add tests for drift detection

### Phase 2: PULL Mode (1-2 hours)
- Implement sync --pull logic
- Test recovery from projects.json edit
- Create backup mechanism

### Phase 3: PUSH Mode (1-2 hours)
- Implement sync --push logic
- Add --force flag requirement
- Test state.json overwrite cases

### Phase 4: Pre-Command Hook (1-2 hours)
- Integrate validateSync() into pre-phase-command hook
- Add config: hooks.pre_phase_command.validate_sync (mode: strict|warn)
- Test hook firing for /jumpstart.analyze, /jumpstart.plan, etc.

## Alternatives Considered

### A1: Automatic Sync on Every Change (Rejected)

**Approach:** Automatically sync on every projects.json or state.json change  
**Why rejected:** Too much overhead; hidden side effects; can't debug changes

### A2: Projects.json as Source of Truth Only (Rejected)

**Approach:** Never use state.json; all state in projects.json  
**Why rejected:** Violates isolation principle; state.json is per-project (shouldn't be workspace global)

### A3: No Sync (Accept Drift) (Rejected)

**Approach:** Don't sync; document that users must manually keep in sync  
**Why rejected:** Brittleness; phase gates become untrustworthy; blocks scaling

## Testing

- [x] validateSync() detects drift correctly (all 3 directions)
- [x] sync --audit reports drift without changing anything
- [x] sync --pull updates projects.json correctly
- [x] sync --push updates state.json with --force requirement
- [x] Pre-command hook validates before /jumpstart.* commands
- [x] Backup mechanism prevents data loss in --push
- [x] Sync log audit trail captured

## References

- ADR-009 — Multi-Workspace (Phase 1)
- ADR-011 — Agent Multi-Project Integration (uses sync pre-command hook)
- `.jumpstart/MULTI_WORKSPACE.md` — User guide (will document sync commands)
- `bin/workspace.js` — CLI implementation
- `.jumpstart/state/sync-log.json` — Audit trail of sync operations
