# Multi-Workspace Setup Guide

**For Teams:** Managing 2+ AI projects in one workspace  
**Updated:** June 3, 2026

## Quick Start (5 minutes)

### Step 1: Initialize Workspace Mode

```bash
cd /your/workspace
jumpstart-mode workspace status
```

**Output:**
```
📊 Workspace Status

Workspace ID: dev-workspace-001
Total Projects: 1
Active Project: proj-default

Projects:
▶️   [initializing] proj-default — Your Project
     Path: .
```

If you see this, workspace mode is ready! Your existing project is now `proj-default`.

### Step 2: Create a New Project (Optional)

```bash
jumpstart-mode workspace create-project \
  --id proj-dashboard \
  --name "Copilot Dashboard" \
  --type greenfield
```

### Step 3: Switch Between Projects

```bash
# See active project
jumpstart-mode workspace active

# Switch to a project
jumpstart-mode workspace set-active proj-dashboard

# Verify switch
jumpstart-mode workspace active
```

### Step 4: Run Agents (Same as Before)

```bash
# Agents auto-detect workspace mode and load the active project
jumpstart-mode challenge "Build a token usage aggregator"

# Behind the scenes:
# - Loads .jumpstart/projects.json
# - Finds active_project: "proj-dashboard"
# - Loads projects/dashboard/.jumpstart/config.yaml
# - Proceeds with Phase 0
```

## Detailed Setup

### Directory Structure (Multi-Project)

```
workspace-root/
├── .jumpstart/
│   ├── config.yaml              # (Legacy, can be ignored)
│   ├── projects.json            # NEW: Project registry
│   ├── state/
│   │   ├── workspace-state.json # NEW: Workspace state
│   │   ├── projects/
│   │   │   ├── proj-a/
│   │   │   │   ├── state.json
│   │   │   │   ├── timeline.json
│   │   │   │   └── usage-log.json
│   │   │   └── proj-b/
│   │   │       ├── state.json
│   │   │       ├── timeline.json
│   │   │       └── usage-log.json
│   ├── agents/                  # (Shared)
│   ├── templates/               # (Shared)
│   └── skills/                  # (Shared)
│
├── projects/
│   ├── proj-a/
│   │   ├── .jumpstart/
│   │   │   └── config.yaml      # Project-specific config
│   │   ├── specs/
│   │   ├── src/
│   │   └── tests/
│   └── proj-b/
│       ├── .jumpstart/
│       │   └── config.yaml
│       ├── specs/
│       ├── src/
│       └── tests/
│
└── specs/                       # (Legacy single-project root, optional)
    ├── prd.md
    └── architecture.md
```

### Setup for Existing Project

**If you have a single project already:**

1. **Current state:**
   ```
   workspace-root/
   ├── specs/
   ├── src/
   ├── tests/
   └── .jumpstart/config.yaml
   ```

2. **Migrate to workspace mode:**

   Option A (Minimal — keep in place):
   ```bash
   # No restructuring needed!
   # .jumpstart/projects.json auto-registers as "proj-default"
   # Specs/src/tests stay in root
   jumpstart-mode workspace status
   ```

   Option B (Recommended — organize into projects/ folder):
   ```bash
   mkdir -p projects/my-project
   mv specs src tests .jumpstart/config.yaml projects/my-project/
   
   # Create project-specific config
   cp .jumpstart/config.yaml projects/my-project/.jumpstart/config.yaml
   
   # Update projects.json
   # (Modify .jumpstart/projects.json to point path: "projects/my-project")
   
   jumpstart-mode workspace status
   ```

### Setup for New Multi-Project Workspace

```bash
# Start with fresh workspace structure
mkdir -p workspace-root/{projects,specs}
cd workspace-root

# Initialize Jump Start (this creates .jumpstart/ and projects.json)
npm init -y
npm install jumpstart-mode

# Create first project
jumpstart-mode workspace create-project \
  --id proj-token-usage \
  --name "Token Usage Research" \
  --type greenfield

# Create second project
jumpstart-mode workspace create-project \
  --id proj-copilot-ui \
  --name "Copilot Dashboard UI" \
  --type greenfield

# Verify
jumpstart-mode workspace status

# Start working on first project
jumpstart-mode workspace set-active proj-token-usage
jumpstart-mode challenge "Analyze GitHub Copilot token usage patterns"
```

## Configuration Per Project

Each project has its own `.jumpstart/config.yaml`:

```yaml
# projects/proj-token-usage/.jumpstart/config.yaml
project:
  name: "Token Usage Research"
  approver: "Jane Smith"
  type: greenfield
  domain: process_control

# projects/proj-copilot-ui/.jumpstart/config.yaml
project:
  name: "Copilot Dashboard"
  approver: "John Doe"
  type: greenfield
  domain: general
```

**Workspace settings** are in `.jumpstart/projects.json`:

```json
{
  "settings": {
    "enforce_sequential_phases": true,
    "allow_parallel_projects": false,
    "pit_crew_review_required": true
  }
}
```

## Cost Tracking

### Per-Project Costs

Each project tracks tokens independently:

```bash
# Project-level usage log
cat projects/proj-token-usage/.jumpstart/usage-log.json

# Output:
{
  "project_id": "proj-token-usage",
  "entries": [
    { "phase": 0, "tokens": 2412, "model": "claude-opus" },
    { "phase": 1, "tokens": 3100, "model": "claude-opus" }
  ],
  "total": 5512
}
```

### Workspace-Level Aggregate

```bash
# Workspace summary
jumpstart-mode workspace report --format=json

# Output includes:
{
  "workspace_tokens_used": 52100,
  "by_project": {
    "proj-token-usage": 5512,
    "proj-copilot-ui": 46588
  },
  "by_phase": {
    "0": 8900,
    "1": 12300,
    "2": 15200,
    "3": 15700
  }
}
```

### Set Workspace Budget

Edit `.jumpstart/state/workspace-state.json`:

```json
{
  "workspace_resume_context": {
    "workspace_token_budget": 500000,
    "workspace_tokens_used": 52100
  }
}
```

Agents will warn when approaching limits.

## Cross-Project Dependencies

**Example:** Project B (Copilot Dashboard) depends on Project A's (Token Usage) metrics.

### Declare Dependency

Edit `.jumpstart/state/workspace-state.json`:

```json
{
  "workspace_resume_context": {
    "cross_project_dependencies": [
      {
        "from": "proj-token-usage",
        "to": "proj-copilot-ui",
        "type": "data_dependency",
        "reason": "Dashboard consumes token metrics API"
      }
    ]
  }
}
```

### Validate Before Phase Gate

```bash
# Before approving Phase 3 in proj-copilot-ui:
jumpstart-mode workspace validate-deps

# Output:
✅ Aggregation: Token Usage Research → Copilot Dashboard

# If dependency is unmet:
❌ Invalid dependency: proj-invalid → proj-copilot-ui
```

**If validation fails:** Phase gate blocks until dependency is satisfied.

## Pit Crew Review for Cross-Project Integration

When two projects have dependencies, invoke Pit Crew before approving:

```bash
# During Phase 3 (Architect) for proj-copilot-ui, record the review outcome:
jumpstart-mode workspace pitcrew-record \
  --topic="Cross-project dependency review" \
  --outcome="Approved" \
  --from=proj-copilot-ui \
  --to=proj-token-usage
```

**Pit Crew reviews:**
- ✅ Are APIs stable and documented?
- ✅ Can integration be tested independently?
- ✅ Are security/auth aligned?
- ✅ Can we roll back one project without breaking the other?

**Result:** Approve or flag for remediation before handoff.

## Session Recovery Across Projects

Jump Start persists session state in `workspace-state.json`.

**Scenario:** You're working on proj-token-usage, and you close your IDE.

```bash
# Reopen, workspace remembers everything:
jumpstart-mode workspace active

# Output:
✅ Active Project: proj-token-usage
   Path: projects/token-usage
   Status: phase-2

# Continue where you left off
jumpstart-mode resume
```

## Running Phase Agents

All phase agents auto-detect workspace mode:

```bash
# Works the same — agents read projects.json and pick up active project
jumpstart-mode challenge "User story: ..."
jumpstart-mode analyze
jumpstart-mode plan
jumpstart-mode architect
jumpstart-mode build
```

**Behind the scenes:**
1. Agent loads `.jumpstart/projects.json`
2. Reads `active_project: proj-token-usage`
3. Loads `projects/proj-token-usage/.jumpstart/config.yaml`
4. Loads `projects/proj-token-usage/.jumpstart/state/state.json`
5. Proceeds with phase

## Monitoring & Reporting

### Workspace Status

```bash
jumpstart-mode workspace status
```

### Generate Report

```bash
# Markdown report
jumpstart-mode workspace report --format=markdown

# JSON report (for automation)
jumpstart-mode workspace report --format=json
```

### Validate Dependencies

```bash
jumpstart-mode workspace validate-deps
```

## Common Workflows

### Workflow 1: Sequential Projects (Default)

**Setup:**
```
proj-a: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
proj-b: waiting...
proj-c: waiting...
```

**Process:**
```bash
# Complete proj-a
jumpstart-mode workspace set-active proj-a
jumpstart-mode challenge "..."
# ... phases 0-4 ...

# Move to proj-b
jumpstart-mode workspace set-active proj-b
jumpstart-mode challenge "..."
# ... phases 0-4 ...
```

### Workflow 2: Parallel Projects (Advanced)

**Setup:** Enable in projects.json:
```json
{
  "settings": {
    "allow_parallel_projects": true
  }
}
```

**Process:**
```bash
# Team A works on proj-a
jumpstart-mode workspace set-active proj-a
# Team B works on proj-b in parallel
jumpstart-mode workspace set-active proj-b

# Before integrating, record the Pit Crew review:
jumpstart-mode workspace pitcrew-record --topic="Integration review" --outcome="Approved"
```

### Workflow 3: Shared Agent Personas / Skills

All projects use `.jumpstart/agents/` and `.jumpstart/skills/` (workspace-level, shared).

**Benefit:** Consistent phase protocols across projects; shared domain knowledge.

**No action needed** — agents auto-discover shared assets.

## Troubleshooting

### "Project not found"

```bash
# Check projects.json
cat .jumpstart/projects.json

# Make sure active_project matches a project id
```

### "Cross-project dependencies validation failed"

```bash
# Check that dependency projects exist
jumpstart-mode workspace validate-deps

# Review .jumpstart/state/workspace-state.json
cat .jumpstart/state/workspace-state.json | jq .workspace_resume_context.cross_project_dependencies
```

### "Locked by another agent"

Project is locked during agent execution. Wait for agent to complete, or:

```bash
# Check locks
cat .jumpstart/state/workspace-state.json | jq .project_locks

# If stuck, manually remove lock (use with care):
# Edit .jumpstart/state/workspace-state.json and delete the lock entry
```

### Reverting to Single-Project Mode

```bash
# Rename projects.json
mv .jumpstart/projects.json .jumpstart/projects.json.bak

# Jump Start will fall back to single-project config.yaml
jumpstart-mode status
```

## Migration Checklist

- [ ] Review `.jumpstart/projects.json`
- [ ] Verify `active_project` points to intended project
- [ ] Run `jumpstart-mode workspace validate-deps` — should show no errors
- [ ] Check token budgets in `workspace-state.json`
- [ ] Run a test phase on each project
- [ ] Document cross-project dependencies in `workspace-state.json`
- [ ] Brief team on new `jumpstart-mode workspace` commands
- [ ] Set up CI/CD to run `workspace validate-deps` before deployments

## FAQ

**Q: Can I have 10+ projects in one workspace?**  
A: Yes, but phases must run sequentially per project (unless `allow_parallel_projects: true`). Workspace scales linearly.

**Q: What if a project is archived?**  
A: Soft-delete via `jumpstart-mode workspace archive proj-id`. Project stays in registry but marked as archived.

**Q: Do shared templates auto-update across projects?**  
A: No — each project inherits templates at creation time. Template changes don't propagate (by design). Edit per-project `.jumpstart/config.yaml` to override.

**Q: Can projects have different approvers?**  
A: Yes! Each project has `approver` in projects.json.

**Q: How do I track cross-project decisions?**  
A: Store in each project's `specs/decisions/` (ADRs). Reference cross-project ADRs as `[../proj-b/specs/decisions/ADR-012.md]`.

---

**Next:** [Multi-Workspace Concepts](./MULTI_WORKSPACE.md) | [Architecture Decision Record](./decisions/ADR-009-multi-workspace.md)
