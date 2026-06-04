# Jump Start Workspace: Quick Reference

## Essential Commands

### Project Management
```bash
# Show all projects
npx jumpstart-mode workspace status

# View active project
npx jumpstart-mode workspace active

# Switch projects
npx jumpstart-mode workspace set-active proj-token-analytics

# Create new project
npx jumpstart-mode workspace create-project \
  --id=proj-newf \
  --name="New Feature" \
  --type=greenfield \
  --approver=Sarah

# Archive completed project
npx jumpstart-mode workspace archive proj-completed

# Restore archived project
npx jumpstart-mode workspace unarchive proj-completed
```

### Dependency Management
```bash
# Validate cross-project dependencies
npx jumpstart-mode workspace validate-deps

# Generate workspace report
npx jumpstart-mode workspace report
npx jumpstart-mode workspace report --format=json
```

### Sync & State Management
```bash
# Detect drift between projects.json and state files
npx jumpstart-mode workspace sync --audit

# Update projects.json from actual state files
npx jumpstart-mode workspace sync --pull

# Update state files from projects.json (destructive)
npx jumpstart-mode workspace sync --push --force

# Sync specific project only
npx jumpstart-mode workspace sync --audit --project-id=proj-token-analytics
```

---

## Workflow: New Multi-Project Setup

### 1. Initialize Workspace
```bash
cd /path/to/workspace

# Create first project
npx jumpstart-mode workspace create-project \
  --id=proj-token-analytics \
  --name="Token Analytics" \
  --type=greenfield \
  --approver=Eric

# Create second project  
npx jumpstart-mode workspace create-project \
  --id=proj-cost-dashboard \
  --name="Cost Dashboard" \
  --type=greenfield \
  --approver=Sarah

# View all projects
npx jumpstart-mode workspace status
```

### 2. Set Active Project & Start Phase 0
```bash
# Activate Token Analytics
npx jumpstart-mode workspace set-active proj-token-analytics

# Check what's next
npx jumpstart-mode workspace active

# Start Phase 0 (Challenger)
/jumpstart.challenge "Build a token cost aggregation API"
```

### 3. Phase 0 → Phase 1 Progression
```bash
# After Phase 0 approved, activate Phase 1 (Analyst)
/jumpstart.analyze

# Phase 1 creates product-brief.md

# When Phase 1 approved, check if downstream can unblock
npx jumpstart-mode workspace validate-deps
```

### 4. Activate Dependent Project (when unblocked)
```bash
# Switch to Cost Dashboard
npx jumpstart-mode workspace set-active proj-cost-dashboard

# Cost Dashboard was blocked waiting for Token Analytics Phase 3
# Once unblocked, it can start Phase 0
/jumpstart.challenge "Build cost allocation dashboard"
```

### 5. Monitor Workspace Progress
```bash
# Regular status checks
npx jumpstart-mode workspace status

# Before starting new phase, check sync
npx jumpstart-mode workspace sync --audit

# Generate full report
npx jumpstart-mode workspace report > /tmp/status.md
```

---

## Common Patterns

### Pattern A: Sequential Delivery (One Project, Then Next)
```bash
# Phase 0-4 complete for Project A
npx jumpstart-mode workspace archive proj-a

# Now start Project B
npx jumpstart-mode workspace set-active proj-b
/jumpstart.challenge
```

### Pattern B: Dependent Projects
```bash
# Project B depends on Project A Phase 3
# → Project B blocked until A Phase 3 approved
# → Check periodically with validate-deps
npx jumpstart-mode workspace validate-deps
# When unblocked: can start Project B Phase 0
```

### Pattern C: Parallel Development (Phase 4 Only)
```bash
# Requires: enforcement_mode: parallel in config
# Team A works on Project A (Phase 2)
# Team B works on Project B (Phase 1)
# Resources permitting, both advance simultaneously

npx jumpstart-mode workspace projects-in-flight
# [proj-a] Phase 2 active (architect)
# [proj-b] Phase 1 active (analyst)
```

### Pattern D: Emergency Pause & Sync
```bash
# Something went wrong, need to check state
npx jumpstart-mode workspace sync --audit

# If drift detected, pull state into registry
npx jumpstart-mode workspace sync --pull

# Then continue
npx jumpstart-mode workspace set-active proj-x
```

---

## Configuration

### Single-Project Mode (Default)
```
No .jumpstart/projects.json
→ Uses global .jumpstart/config.yaml
→ Loads specs from specs/
→ Existing behavior unchanged
```

### Multi-Project Mode (New)
```
.jumpstart/projects.json exists
→ Workspace mode activated
→ Loads active project config
→ Loads specs from projects/{id}/specs/
```

### Example: projects.json
```json
{
  "workspace": {
    "id": "workspace-copilot-platform",
    "enabled": true,
    "description": "Copilot Insights Platform (multi-project)"
  },
  "projects": [
    {
      "project_id": "proj-token-analytics",
      "name": "Token Analytics",
      "path": "projects/proj-token-analytics",
      "current_phase": 1,
      "status": "phase-1",
      "approver": "Eric",
      "type": "greenfield"
    },
    {
      "project_id": "proj-cost-dashboard",
      "name": "Cost Dashboard",
      "path": "projects/proj-cost-dashboard",
      "current_phase": null,
      "status": "initializing",
      "approver": "Sarah",
      "type": "greenfield"
    }
  ],
  "active_project": "proj-token-analytics",
  "settings": {
    "enforce_sequential_phases": true,
    "allow_parallel_projects": false
  }
}
```

---

## Troubleshooting

### Problem: "Project not found"
```bash
# Project doesn't exist in projects.json
# Solution: Create it first
npx jumpstart-mode workspace create-project --id=proj-X --name="X" --type=greenfield
```

### Problem: "Sync mismatch detected"
```bash
# projects.json and state.json are out of sync
# Solution: Pull actual state into registry
npx jumpstart-mode workspace sync --pull
```

### Problem: "Cannot advance project"
```bash
# Phase gate not approved, or blocked by dependency
# Solutions:
# 1. Check if Phase Gate is approved: specs/artifact.md must have [x] all
# 2. Check dependencies: workspace validate-deps
# 3. Sync state: workspace sync --audit
```

### Problem: "Dependency unblocked but project still blocked"
```bash
# dependencies in workspace-state.json may need manual update
# OR sync state from projects.json
npx jumpstart-mode workspace sync --pull
# Then re-check
npx jumpstart-mode workspace validate-deps
```

---

## File Locations Reference

```
.jumpstart/
├── projects.json                    # Central registry
├── state/
│   └── workspace-state.json         # Workspace state
├── agents/                          # Shared agent templates
├── templates/                       # Shared spec templates
├── schemas/
│   └── workspace.schema.json        # Validation schema
└── decisions/
    ├── ADR-009-multi-workspace.md
    ├── ADR-010-workspace-sync.md
    ├── ADR-011-agent-integration.md
    └── ADR-012-advanced-features.md

projects/proj-X/
├── .jumpstart/
│   ├── config.yaml                  # Project config
│   └── state/
│       └── state.json               # Project state
├── specs/
│   ├── challenger-brief.md
│   ├── product-brief.md
│   ├── prd.md
│   ├── architecture.md
│   └── implementation-plan.md
├── src/                             # Project code
└── tests/                           # Project tests

lib/
├── workspace-context.js             # Workspace detection
├── spec-loader.js                   # Project-aware spec loading
└── phase-gate-updater.js            # State update on approval

bin/
└── workspace.js                     # CLI tool
```

---

## Phase 4 Commands (Future)

```bash
# Show which projects are currently advancing
npx jumpstart-mode workspace projects-in-flight

# Pause a project (free concurrent slot)
npx jumpstart-mode workspace pause proj-X

# Resume a project
npx jumpstart-mode workspace resume proj-X

# Check project budget
npx jumpstart-mode workspace budget --project=proj-token-analytics

# List all ADRs
npx jumpstart-mode workspace adr-index

# Show which projects are impacted by an ADR
npx jumpstart-mode workspace adr-impacts ADR-001

# Query knowledge graph
npx jumpstart-mode workspace query-graph "downstream-of proj-token-analytics"
```

---

## Help & Documentation

```bash
# Show CLI help
npx jumpstart-mode workspace

# Read detailed guides
cat .jumpstart/MULTI_WORKSPACE.md          # User guide
cat .jumpstart/MULTI_WORKSPACE_SETUP.md    # Setup guide
cat .jumpstart/AGENT-WORKSPACE-TEMPLATE.md # Agent integration

# View implementation details
cat .jumpstart/PHASE-2-IMPLEMENTATION.md
cat .jumpstart/PHASE-3-IMPLEMENTATION.md
cat .jumpstart/IMPLEMENTATION-COMPLETE.md
```

---

**Last Updated:** 2026-06-03  
**Version:** 3.0 (Phases 1-3 Complete, Phase 4 Designed)
