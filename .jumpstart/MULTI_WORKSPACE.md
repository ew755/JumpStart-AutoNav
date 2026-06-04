# Multi-Workspace Support for Jump Start Framework

**Status:** Beta (v1.0.0)  
**Updated:** June 3, 2026

## Overview

Jump Start now supports **coordinated multi-project workflows** within a single workspace. Manage multiple AI builds sequentially or in parallel, share templates and agents, and track cross-project dependencies.

## Architecture

```
Workspace (root)
├── .jumpstart/
│   ├── config.yaml                 # (Legacy) Single-project config
│   ├── projects.json               # NEW: Project registry & workspace settings
│   ├── schemas/workspace.schema.json  # Schema for projects.json
│   ├── agents/                     # Shared across all projects
│   ├── templates/                  # Shared across all projects
│   ├── skills/                     # Shared across all projects
│   └── state/
│       ├── workspace-state.json    # NEW: Workspace-level settings
│       └── projects/
│           ├── proj-a/
│           │   ├── state.json      # Project state
│           │   ├── timeline.json
│           │   └── usage-log.json
│           └── proj-b/
│               ├── state.json
│               ├── timeline.json
│               └── usage-log.json
├── projects/
│   ├── proj-a/
│   │   ├── specs/
│   │   ├── src/
│   │   └── tests/
│   └── proj-b/
│       ├── specs/
│       ├── src/
│       └── tests/
```

## Key Files

### `.jumpstart/projects.json`

**Purpose:** Registry of all projects in the workspace, workspace settings, active project pointer.

**Example:**
```json
{
  "workspace": {
    "id": "dev-workspace-001",
    "enabled": true,
    "description": "Coordinated AI delivery workspace"
  },
  "projects": [
    {
      "id": "proj-token-usage",
      "name": "Token Usage Research",
      "path": "projects/token-usage",
      "type": "greenfield",
      "status": "phase-2",
      "config_path": "projects/token-usage/.jumpstart/config.yaml",
      "phase": 2,
      "approver": "Jane Smith",
      "locked": false
    },
    {
      "id": "proj-copilot-dashboard",
      "name": "Copilot Dashboard",
      "path": "projects/copilot-dashboard",
      "type": "greenfield",
      "status": "phase-0",
      "config_path": "projects/copilot-dashboard/.jumpstart/config.yaml",
      "phase": null,
      "approver": "John Doe",
      "locked": true,
      "lock_reason": "Challenger agent running"
    }
  ],
  "active_project": "proj-token-usage",
  "settings": {
    "enforce_sequential_phases": true,
    "allow_parallel_projects": false,
    "pit_crew_review_required": true,
    "cross_project_dependency_validation": true,
    "aggregate_cost_tracking": true
  },
  "version": "1.0.0",
  "last_updated": "2026-06-03T14:22:00Z"
}
```

### `.jumpstart/state/workspace-state.json`

**Purpose:** Workspace-level runtime state (active project, locks, cross-project metadata).

**Example:**
```json
{
  "version": "1.0.0",
  "active_project_id": "proj-token-usage",
  "workspace_resume_context": {
    "tldr": "Two projects running in parallel: Token Usage at Phase 2, Copilot Dashboard at Phase 0",
    "cross_project_dependencies": [
      {
        "from": "proj-copilot-dashboard",
        "to": "proj-token-usage",
        "type": "usage_log_aggregation",
        "reason": "Dashboard consumes token metrics from Token Usage project"
      }
    ],
    "workspace_token_budget": 250000,
    "workspace_tokens_used": 47300,
    "last_pit_crew_review": "2026-06-03T10:00:00Z"
  },
  "project_locks": {
    "proj-token-usage": {
      "locked_by": "Architect",
      "locked_at": "2026-06-03T14:15:00Z",
      "lock_ttl_seconds": 3600,
      "reason": "Phase 3: Architecture review in progress"
    }
  },
  "last_updated": "2026-06-03T14:22:00Z"
}
```

## Multi-Workspace CLI Commands

```bash
# List all projects and their phases
jumpstart-mode workspace status

# Show active project
jumpstart-mode workspace active

# Switch active project
jumpstart-mode workspace set-active proj-copilot-dashboard

# Validate cross-project dependencies
jumpstart-mode workspace validate-deps

# Generate workspace-level report (aggregate token usage, phases, blockers)
jumpstart-mode workspace report --format=markdown

# Archive a completed project
jumpstart-mode workspace archive proj-token-usage

# Create a new project in the workspace
jumpstart-mode workspace create-project \
  --id proj-new-agent \
  --name "New Agent Build" \
  --type greenfield

# Remove a project (soft-delete)
jumpstart-mode workspace remove-project proj-legacy-build

# Invoke Pit Crew for cross-project review
jumpstart-mode workspace pit-crew \
  --review-type cross-project-dependency \
  --projects proj-token-usage,proj-copilot-dashboard
```

## Migration Path

### From Single-Project to Multi-Workspace

1. **Initialize workspace mode:**
   ```bash
   jumpstart-mode workspace init
   ```
   - Creates `.jumpstart/projects.json`
   - Creates `.jumpstart/state/workspace-state.json`
   - Detects current project, registers as `proj-default`

2. **Restructure (optional):**
   ```bash
   mkdir -p projects/current-project
   mv specs src tests projects/current-project/
   ```

3. **Add new projects:**
   ```bash
   jumpstart-mode workspace create-project \
     --id proj-new-build \
     --name "New Project" \
     --type greenfield
   ```

4. **Set workspace settings:**
   ```bash
   jumpstart-mode workspace config \
     --allow-parallel-projects false \
     --pit-crew-review-required true
   ```

## Agent Behavior in Multi-Workspace

### At Agent Activation

1. **Read workspace config:**
   ```
   Load .jumpstart/projects.json
   If not found → default to single-project mode
   ```

2. **Determine active project:**
   ```
   If --project flag provided → use that project
   Else if projects.json has active_project → use it
   Else → ask user to select
   ```

3. **Load project context:**
   ```
   Load {project}.jumpstart/config.yaml
   Load {project}/.jumpstart/state/state.json
   ```

### Before Phase Gate Approval

**If cross-project dependencies detected:**

1. Invoke Pit Crew as subagent to review:
   - Are dependent projects ready?
   - Do architecture/security decisions align?
   - Are integration paths clear?

2. Pit Crew output:
   - ✅ **Approved** → Proceed with phase gate
   - ⚠️ **Conditional** → Require specific remediation
   - ❌ **Blocked** → Flag and escalate

## Shared vs. Isolated Assets

| Asset | Scope | Notes |
|-------|-------|-------|
| `.jumpstart/agents/` | **Workspace-level** | All projects use same agent personas |
| `.jumpstart/templates/` | **Workspace-level** | All projects use same spec templates |
| `.jumpstart/skills/` | **Workspace-level** | All projects access shared skills |
| `.jumpstart/schemas/` | **Workspace-level** | Schema validation applied to all projects |
| `specs/` | **Per-project** | Isolated, no cross-project linking |
| `src/`, `tests/` | **Per-project** | Separate codebases per project |
| `.jumpstart/state/` | **Per-project** | Each project tracks its own phase |
| `usage-log.json` | **Per-project + aggregated** | Project-level logs; workspace-level rollup |
| `timeline.json` | **Per-project + aggregated** | Project-level timeline; workspace-level summary |

## Cost Tracking Across Projects

### Per-Project Usage
```json
// projects/proj-a/.jumpstart/usage-log.json
{
  "project_id": "proj-a",
  "entries": [
    { "phase": "0", "estimated_tokens": 2450, "actual_tokens": 2412, "model": "claude-opus" }
  ],
  "total_tokens": 2412
}
```

### Workspace-Level Aggregation
```json
// .jumpstart/usage-log.json (workspace view)
{
  "aggregation": {
    "total_workspace_tokens": 52100,
    "by_project": {
      "proj-a": 2412,
      "proj-b": 49688
    },
    "by_phase": {
      "0": 8900,
      "1": 12300,
      "2": 15200,
      "3": 15700
    },
    "by_model": {
      "claude-opus": 45000,
      "claude-haiku": 7100
    }
  }
}
```

## Concurrency & Locking

### Project Lock Mechanism

```
.jumpstart/state/project-locks/
├── proj-a.lock
│   {
│     "locked_by": "Architect",
│     "started": "2026-06-03T14:22:00Z",
│     "ttl": 3600,
│     "reason": "Phase 3 architecture review"
│   }
└── proj-b.lock (free)
```

**Rules:**
- If `allow_parallel_projects: false` → Only active project can hold locks
- If `allow_parallel_projects: true` → Multiple projects can run, but Pit Crew mediates conflicts
- Lock TTL: Default 1 hour (prevents zombie locks)

## Limitations & Constraints

| Constraint | Rationale |
|-----------|-----------|
| **Sequential phases per project** | Jump Start design enforces phase gates; parallelizing within a project breaks traceability |
| **No cross-project artifact linking** | Prevents hidden scope creep; each project owns its specs |
| **Shared templates only** | Consistency across projects; customization per-project via `.jumpstart/config.yaml` overrides |
| **Pit Crew review required for cross-deps** | Manual checkpoint to validate integration before handoff |
| **Default: single active project** | Reduces accidental collisions; users must explicitly enable parallel mode |

## Backward Compatibility

**Old config** (single project):
```yaml
# .jumpstart/config.yaml
project:
  name: "My Project"
  approver: "John Doe"
```

**Still works!** Framework auto-detects single-project mode:
- Registers as `proj-default` in `projects.json`
- Loads config from `.jumpstart/config.yaml` (root)
- State stored in `.jumpstart/state/` (root)

**To migrate to multi-workspace:**
```bash
jumpstart-mode workspace upgrade
# Generates projects.json with proj-default entry
```

## Next Steps

1. **Test multi-project workflows** — Run two projects in sequence, capture token usage
2. **Implement Pit Crew cross-project review** — Add validation gates
3. **Add CLI commands** — `workspace` command suite (status, switch, validate, report)
4. **Document workspace ADRs** — Capture cross-project architecture decisions
5. **Cost governance** — Budget guardrails across workspace

## References

- [AGENTS.md](./AGENTS.md) — Agent personas (unchanged; still shared)
- [config.yaml](./config.yaml) — Project configuration (extended for workspace)
- [projects.json Schema](./schemas/workspace.schema.json) — Workspace registry schema
- [Pit Crew Role](./AGENTS.md#facilitator) — Multi-agent roundtable discussions
