# Legacy Service Refactoring Scenario — Setup Guide

**Scenario Type:** Complex Enterprise Refactoring (4 Projects, 11-week timeline)  
**Jump Start Phases:** Scout + All 5 phases across 4 projects  
**Use Case:** Tests multi-project workspace, brownfield analysis, phased dependencies  
**Complexity Level:** Advanced (for teams familiar with Jump Start)

---

## Quick Start

### 1. Copy Scenario to Workspace

```bash
# If you're running this in a new workspace
cd /path/to/your/workspace

# Scenario files already exist at:
# .jumpstart/scenarios/salesforce-service-refactor/
#   ├── SCENARIO.md (this file)
#   ├── MIGRATION-RUNBOOK.md (Phase 2 PM + Phase 3 Architect deliverables)
#   └── projects.json (configuration template)
```

### 2. Initialize Projects

Use the Jump Start workspace CLI to create all 4 projects:

```bash
# Project 1: Legacy Analysis (Scout only)
npx jumpstart-mode workspace create-project \
  --id=proj-legacy-sfs-analysis \
  --name="Legacy SFS Analysis" \
  --type=brownfield \
  --approver="PlatformLead"

# Project 2: CX Consumer API
npx jumpstart-mode workspace create-project \
  --id=proj-cx-consumer-api \
  --name="Facade API" \
  --type=greenfield \
  --approver="APIOwner"

# Project 3: CX Life API
npx jumpstart-mode workspace create-project \
  --id=proj-cx-life-api \
  --name="Resource API" \
  --type=greenfield \
  --approver="BackendOwner"

# Project 4: Integration Layer
npx jumpstart-mode workspace create-project \
  --id=proj-sfs-integration \
  --name="Salesforce Integration Layer" \
  --type=greenfield \
  --approver="IntegrationOwner"
```

### 3. Update projects.json with Dependencies

Edit `.jumpstart/projects.json` and add the dependency declarations:

```json
{
  "workspace": {
    "id": "salesforce-service-refactor",
    "enabled": true,
    "description": "Refactor legacy SfS call chain into distributed APIs"
  },
  "projects": [
    {
      "id": "proj-legacy-sfs-analysis",
      "name": "Legacy SFS Analysis",
      "type": "brownfield",
      "status": "initializing",
      "phase": null,
      "approver": "PlatformLead",
      "dependencies": [],
      "blocked_by": [],
      "description": "Scout phase only — analyze existing Query Service → Transformation Service call chain"
    },
    {
      "id": "proj-cx-consumer-api",
      "name": "Facade API",
      "type": "greenfield",
      "status": "phase-0",
      "phase": 0,
      "approver": "APIOwner",
      "dependencies": [],
      "blocked_by": ["proj-legacy-sfs-analysis"],
      "description": "New GraphQL API for consumer policy queries"
    },
    {
      "id": "proj-cx-life-api",
      "name": "Resource API",
      "type": "greenfield",
      "status": "blocked",
      "phase": null,
      "approver": "BackendOwner",
      "dependencies": [],
      "blocked_by": ["proj-cx-consumer-api:phase-3"],
      "description": "REST API for life policy data, refactored from legacy"
    },
    {
      "id": "proj-sfs-integration",
      "name": "Salesforce Integration Layer",
      "type": "greenfield",
      "status": "blocked",
      "phase": null,
      "approver": "IntegrationOwner",
      "dependencies": [],
      "blocked_by": ["proj-cx-consumer-api:phase-4", "proj-cx-life-api:phase-4"],
      "description": "Adapter routing SfS requests to new APIs with dual-write validation"
    }
  ],
  "active_project": "proj-legacy-sfs-analysis",
  "settings": {
    "enforce_sequential_phases": true,
    "allow_parallel_projects": true,
    "pit_crew_review_required": true
  }
}
```

### 4. Start Scout Phase (Legacy Analysis)

```bash
# Set active project
npx jumpstart-mode workspace set-active proj-legacy-sfs-analysis

# Start Scout phase
/jumpstart.scout
```

**Expected Output:**
- Scout agent analyzes existing codebase
- Generates `specs/codebase-context.md` (C4 diagrams, code flow, pain points)
- Phase completes when approver signs off

---

## What This Scenario Tests

### ✅ Multi-Project Workspace Management

```bash
# View all 4 projects and their status
npx jumpstart-mode workspace status

# Output:
# 1. proj-legacy-sfs-analysis     [Scout: In Progress]      🟠
# 2. proj-cx-consumer-api         [Phase 0: Blocked]        🔴
# 3. proj-cx-life-api             [Phase 0: Blocked]        🔴
# 4. proj-sfs-integration         [Phase 0: Blocked]        🔴
```

### ✅ Dependency Tracking

```bash
# Validate dependencies (which projects can advance?)
npx jumpstart-mode workspace validate-deps

# Output:
# ✓ proj-legacy-sfs-analysis: Ready
# ✗ proj-cx-consumer-api: Blocked by proj-legacy-sfs-analysis (Scout phase)
# ✗ proj-cx-life-api: Blocked by proj-cx-consumer-api (Phase 3)
# ✗ proj-sfs-integration: Blocked by both cx-*-api (Phase 4)
```

### ✅ Progressive Unblocking

**After Scout Completes (Week 2):**
```bash
# Analyst approves Phase 0 in proj-legacy-sfs-analysis
/jumpstart.analyze  # For legacy analysis project

# System auto-unblocks proj-cx-consumer-api
npx jumpstart-mode workspace validate-deps

# Output:
# ✓ proj-cx-consumer-api: Ready (proj-legacy-sfs-analysis complete)
```

**After CX Consumer Phase 3 (Week 6):**
```bash
# Architect approves Phase 3 in proj-cx-consumer-api
# System auto-unblocks proj-cx-life-api

# Check dependencies
npx jumpstart-mode workspace validate-deps

# Output:
# ✓ proj-cx-consumer-api: Phase 4 in progress
# ✓ proj-cx-life-api: Ready (proj-cx-consumer-api Phase 3 complete)
```

### ✅ Brownfield + Greenfield Mix

- **Project 1** uses Scout (brownfield: analyze existing code)
- **Projects 2-4** use full Phase 0-4 (greenfield: build new systems)

This tests Jump Start's ability to handle mixed project types in one workspace.

### ✅ Complex Dependencies

- Hard blocks: Soft blocks (can both start Phase 0 independently):
  - CX Consumer & CX Life can both start Phase 0 (separate discovery)
  - But CX Life blocked at Phase 3 until Consumer Phase 3 done

- Hard blocks: Sequential:
  - Integration Layer can't even start Phase 0 until both APIs are Phase 4

---

## Week-by-Week Execution

### Week 1-2: Scout Phase (Legacy Analysis)

```bash
# Active: proj-legacy-sfs-analysis (Scout)
npx jumpstart-mode workspace set-active proj-legacy-sfs-analysis
/jumpstart.scout

# Check codebase-context.md output
# → Documents old "Query Service" → "Transformation Service" call chain
```

**Deliverable:**
- `projects/legacy-sfs-analysis/specs/codebase-context.md`
- Phase Gate approved by PlatformLead

**Validation:**
- All consumers of old API identified
- Performance baseline captured
- Edge cases documented

---

### Week 3-7: Parallel CX API Development

Once Scout completes, both CX APIs can begin (independently).

```bash
# Switch to CX Consumer API
npx jumpstart-mode workspace set-active proj-cx-consumer-api

# Run Phase 0 through Phase 4
/jumpstart.challenge          # Phase 0
/jumpstart.analyze            # Phase 1
/jumpstart.plan               # Phase 2
/jumpstart.architect          # Phase 3
/jumpstart.build              # Phase 4

# Meanwhile, CX Life API can also start Phase 0
# (runs in parallel, but blocked at Phase 3 until Consumer Phase 3 done)
```

**CX Consumer Timeline (Weeks 3-7):**
- Week 3: Phase 0 (Challenger) → Phase 1 (Analyst)
- Week 4: Phase 1 → Phase 2 (PM)
- Week 5: Phase 2 → Phase 3 (Architect)
- Week 6: Phase 3 approved ✅ → **Unblocks CX Life Phase 0**
- Week 7: Phase 4 (Developer) → **Unblocks Integration Layer Phase 3**

**CX Life Timeline (Weeks 4-8):**
- Week 4: Phase 0 (Challenger) → Phase 1 (Analyst) — starts immediately after Consumer Phase 3 approval
- Week 5: Phase 1 → Phase 2 (PM)
- Week 6: Phase 2 → Phase 3 (Architect)
- Week 7: Phase 3 → Phase 4 (Developer)
- Week 8: Phase 4 approved ✅ → **Unblocks Integration Layer Phase 4**

**Integration Layer Timeline (Weeks 4-10):**
- Week 4: Phase 0 (Challenger) → Phase 1 (Analyst) — early planning
- Week 5: Phase 1 → Phase 2 (PM)
- Week 6: Phase 2 → Phase 3 (Architect)
- Week 7: Phase 3 → Phase 4 (Developer) — design in parallel
- Week 8: Phase 3 approved, but Phase 4 can't fully build until both APIs Phase 4
- Week 9: Phase 4 active (build adapter, test in staging)
- Week 10: Phase 4 approved → Ready for cutover

---

### Week 8-11: Cutover & Validation

This is where the Migration Runbook (`.jumpstart/scenarios/salesforce-service-refactor/MIGRATION-RUNBOOK.md`) executes:

- **Week 8, Days 1-5:** Shadow reads (new API runs parallel, results logged)
- **Week 8, Days 6-7:** Canary deployment (10% traffic → new)
- **Week 9:** Ramp-up (50% → new)
- **Week 10:** Full cutover (100% → new)
- **Week 11:** Monitoring window (100% new, old API kept as emergency rollback)
- **Week 12:** Decommission old API

---

## Validation Checkpoints

### Checkpoint 1: Scout Phase Approval (Week 2)

```bash
# Verify codebase-context.md is approved
npx jumpstart-mode workspace validate-deps

# Output should show:
# ✓ proj-legacy-sfs-analysis: Complete (Scout approved)
# ✓ proj-cx-consumer-api: Unblocked (ready for Phase 0)
```

**Validator:** Verify that approval unblocks the next project automatically

### Checkpoint 2: CX Consumer Phase 3 Approval (Week 6)

```bash
# Verify Phase 3 approval unblocks CX Life
npx jumpstart-mode workspace validate-deps

# Output should show:
# ✓ proj-cx-consumer-api: Phase 3 approved
# ✓ proj-cx-life-api: Unblocked (ready for Phase 0)
```

**Validator:** CX Life should auto-detect the unblock signal

### Checkpoint 3: Both CX APIs Phase 4 Approved (Week 8-9)

```bash
# Verify both APIs live in staging (Phase 4 complete)
npx jumpstart-mode workspace validate-deps

# Output should show:
# ✓ proj-cx-consumer-api: Phase 4 approved
# ✓ proj-cx-life-api: Phase 4 approved
# ✓ proj-sfs-integration: Unblocked (ready for Phase 3-4)
```

**Validator:** Integration Layer can now proceed with Phase 3 detailed design

### Checkpoint 4: Integration Layer Phase 4 Approved (Week 10)

```bash
# Final approval gates cutover to production
npx jumpstart-mode workspace validate-deps

# Output should show:
# ✓ All projects: Phase 4 approved
# → Ready for controlled cutover
```

**Validator:** Run `/jumpstart.pitcrew` with all teams to discuss cutover readiness

---

## Expected Artifacts

### After Scout Phase
```
projects/legacy-sfs-analysis/specs/
├── codebase-context.md          # C4 diagrams, code flow, pain points
└── insights/
    └── scout-insights.md         # Discovery process notes
```

### After CX Consumer Phase 4
```
projects/cx-consumer-api/specs/
├── challenger-brief.md           # Problem: "Current query patterns are slow"
├── product-brief.md              # Personas: SfS devs, Salesforce team
├── prd.md                         # User stories: GraphQL endpoints, auth, errors
├── architecture.md               # Tech stack: Apollo Server, Node.js
├── implementation-plan.md        # Tasks: Schema, resolvers, tests
└── decisions/
    ├── ADR-001-graphql-vs-rest.md
    └── ADR-002-caching-strategy.md
```

### After CX Life Phase 4
```
projects/cx-life-api/specs/
├── challenger-brief.md           # Problem: "Backend System is slow + brittle"
├── product-brief.md              # Personas: Product engineers, ops
├── prd.md                         # User stories: REST endpoints, SLAs
├── architecture.md               # Tech stack: Express.js, PostgreSQL, Redis
├── implementation-plan.md        # Tasks: CRUD endpoints, caching, circuit breaker
└── decisions/
    ├── ADR-001-rest-vs-graphql.md
    └── ADR-002-cache-ttl.md
```

### After Integration Layer Phase 4
```
projects/sfs-integration/specs/
├── challenger-brief.md           # Problem: "SfS is monolithic, hard to migrate"
├── product-brief.md              # Personas: SfS ops, migration team
├── prd.md                         # User stories: Adapter, feature flags, dual-write
├── architecture.md               # Dual-write pattern, canary deployment
├── implementation-plan.md        # Tasks: Routing, validation, rollback
└── decisions/
    ├── ADR-001-migration-strategy.md
    └── ADR-002-feature-flags.md
```

---

## Testing Jump Start Multi-Workspace

This scenario validates:

✅ **Workspace CLI:**
- `workspace create-project` (creates 4 projects)
- `workspace status` (shows all projects + status)
- `workspace validate-deps` (detects blocks + unblocks)
- `workspace sync` (keeps projects.json in sync)

✅ **Agent Integration:**
- Agents load project-scoped configs
- Specs loaded from correct project directory
- Phase gates auto-update project state
- Downstream projects auto-detect unblocks

✅ **Dependency Coordination:**
- Hard blocks: Projects can't advance until dependencies met
- Soft blocks: Projects can run in parallel until late phases
- Automatic unblocking: When upstream Phase N completes, downstream unblocks

✅ **Brownfield + Greenfield:**
- Scout phase for legacy analysis
- Full Phase 0-4 for new services

✅ **Complex Workflows:**
- Multi-team coordination (4 different approvers)
- Phased migration strategy (documented in PRD)
- Risk management (rollback procedures in runbook)

---

## Next Steps

1. **Initialize projects** using the `create-project` commands above
2. **Update projects.json** with dependency declarations
3. **Start Scout phase** on legacy analysis project
4. **Track unblocking** as each phase completes
5. **Use Pit Crew** to discuss cross-project impacts before each major phase
6. **Execute Migration Runbook** during cutover phase (Week 8-11)

---

**Status:** Ready for Deployment  
**Last Updated:** 2026-06-03  
**Questions:** Refer to `SCENARIO.md` for detailed breakdown, `MIGRATION-RUNBOOK.md` for cutover procedures
