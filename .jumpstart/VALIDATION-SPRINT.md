# Multi-Workspace Jump Start — Comprehensive Validation Sprint

**Date:** 2026-06-03  
**Scope:** Test all 4 workspace features end-to-end  
**Duration:** 4-6 hours  
**Outcome:** Production readiness verification  

---

## Master Validation Checklist

```
Phase 1: Agent Integration Testing (30 min)
├─ Option A1: Token Analytics Phase 1 Analyst activation
├─ Option A2: Verify spec-loader finds project-scoped specs
├─ Option A3: Verify phase-gate-updater auto-updates state
└─ ✅ Success: Phase 1 continues without errors

Phase 2: Sync Mechanism Testing (1 hour)
├─ Option B1: Audit sync (detect drift)
├─ Option B2: Pull sync (update registry from state)
├─ Option B3: Push sync (update state from registry)
└─ ✅ Success: No data corruption, drift resolved

Phase 3: Salesforce Scenario Initialization (2 hours)
├─ Option C1: Create 4 projects
├─ Option C2: Check dependencies
├─ Option C3: Start Scout phase
├─ Option C4: Verify unblocking signals
└─ ✅ Success: 4-project scenario ready to use

Phase 4: Deep Integration Testing (1-2 hours)
├─ Option D1: Test Pit Crew cross-project visibility
├─ Option D2: Test partial phase gate (downstream impact)
├─ Option D3: Stress test with manual workspace edits
└─ ✅ Success: All edge cases handled
```

---

## ⏱️ Timeline

| Time | Activity | Expected Duration |
|------|----------|------------------|
| **T+0:00** | Start Option A1 | 5 min |
| **T+0:05** | Verify spec-loader works | 10 min |
| **T+0:15** | Start Option B1 (audit sync) | 10 min |
| **T+0:25** | Start Option B2-B3 (pull/push) | 20 min |
| **T+0:45** | Start Option C1 (create 4 projects) | 15 min |
| **T+1:00** | Start Option C2-C3 (Scout phase) | 30 min |
| **T+1:30** | Start Option D1 (Pit Crew test) | 20 min |
| **T+1:50** | Start Option D2-D3 (stress tests) | 40 min |
| **T+2:30** | Complete & summarize | 15 min |
| **T+2:45** | DONE | — |

---

## Phase 1: Agent Integration Testing (Option A)

### A1: Token Analytics Phase 1 Activation

**Objective:** Verify agents detect workspace mode and load project-scoped specs

**Steps:**
```bash
# 1. Navigate to workspace
cd c:\projects\token-usage-research

# 2. Verify workspace mode
ls -la .jumpstart/projects.json
# Expected: File exists (workspace mode activated)

# 3. Check active project
npx jumpstart-mode workspace active
# Expected: proj-token-analytics

# 4. Set active project explicitly
npx jumpstart-mode workspace set-active proj-token-analytics

# 5. Verify project state
cat projects/token-analytics/.jumpstart/state/state.json | grep current_phase
# Expected: "current_phase": 1

# 6. Start Phase 1 Analyst
/jumpstart.analyze
```

**Expected Behavior:**

The Analyst agent should:
1. ✅ Detect workspace mode (check for `.jumpstart/projects.json`)
2. ✅ Load workspace context (get active project = `proj-token-analytics`)
3. ✅ Load challenger-brief.md from `projects/token-analytics/specs/`
4. ✅ Validate Phase 0 gate is approved
5. ✅ See resume_context showing Phase 1 progress (3 requirement batches done)
6. ✅ Continue from Step 2: Context Elicitation

**Validation Markers:**
```
✓ Workspace mode detected
✓ Active project: proj-token-analytics
✓ Challenger Brief loaded from: projects/token-analytics/specs/challenger-brief.md
✓ Phase 0 gate approved by: Eric
✓ Resume context: Phase 1 (Step 1.5 complete)
✓ Phase 1 protocol continues...
```

**Success Criteria:**
- Phase 1 Analyst starts without errors
- Specs load from correct project directory
- No fallback to workspace-level specs
- Agent references Phase 0 insights correctly

**Failure Scenarios (Test These Too):**

**If agents fall back to workspace-level specs:**
```bash
# Wrong: Load from /specs/challenger-brief.md (workspace level)
# Right: Load from /projects/token-analytics/specs/challenger-brief.md (project level)
```

**Mitigation:** Verify `spec-loader.js` is being used correctly

---

### A2: Verify spec-loader.js Works

**Objective:** Test the spec-loader helper library directly

**Steps:**
```bash
# 1. Check spec-loader exists
ls -la lib/spec-loader.js
# Expected: File exists

# 2. Test spec-loader with Node
node -e "
const specLoader = require('./lib/spec-loader');
const ctx = require('./lib/workspace-context').getWorkspaceContext(process.cwd());
const upstream = specLoader.loadUpstreamArtifact(ctx.workspace, 0);
console.log('Loaded:', upstream.spec.path);
console.log('Gate approved:', upstream.gateApproved);
"

# Expected output:
# Loaded: projects/token-analytics/specs/challenger-brief.md
# Gate approved: true
```

**Success Criteria:**
- ✅ spec-loader loads from correct project directory
- ✅ Phase gate approval detected correctly
- ✅ No errors or fallbacks

---

### A3: Verify phase-gate-updater.js Works

**Objective:** Test the phase-gate-updater helper (used by phase-gate approval hooks)

**Steps:**
```bash
# 1. Check phase-gate-updater exists
ls -la lib/phase-gate-updater.js

# 2. Simulate phase approval (when Phase 1 completes)
# The Analyst will call this when approving product-brief.md
node -e "
const pgUpdater = require('./lib/phase-gate-updater');
const ctx = require('./lib/workspace-context').getWorkspaceContext(process.cwd());

// Simulate Phase 1 approval
const result = pgUpdater.approvePhase(
  ctx.workspace,
  'projects/token-analytics/specs/product-brief.md',
  'Eric'
);

console.log('Phase approved:', result.phase);
console.log('Unblocked projects:', result.unblocked_projects);
"

# Expected output:
# Phase approved: 1
# Unblocked projects: [] (no downstream projects in token-analytics-only scenario)
```

**Success Criteria:**
- ✅ Phase state updated correctly
- ✅ Project state file modified (timestamp updated)
- ✅ Unblocking detected (even if no downstream projects)

---

## Phase 2: Sync Mechanism Testing (Option B)

### B1: Audit Sync (Detect Drift)

**Objective:** Verify sync audit finds discrepancies between projects.json and state files

**Steps:**
```bash
# 1. Check current sync status
npx jumpstart-mode workspace sync --audit

# Expected output (if no drift):
# ✓ No drift detected
# All projects.json entries match state files
# All state files match projects.json
```

**Intentionally Create Drift (to test audit):**

```bash
# 2. Edit projects.json manually (simulate drift)
# Change proj-token-analytics phase from 1 → 0
nano .jumpstart/projects.json
# Find: "phase": 1 → Change to: "phase": 0

# 3. Run audit again (should detect drift)
npx jumpstart-mode workspace sync --audit

# Expected output (drift detected):
# ⚠️  Drift detected:
# • proj-token-analytics: projects.json says phase=0, state.json says phase=1
# Run: workspace sync --pull (to update projects.json)
# Or: workspace sync --push --force (to update state files)
```

**Success Criteria:**
- ✅ Audit detects drift correctly
- ✅ Reports which project has drift
- ✅ Suggests pull vs push action

---

### B2: Pull Sync (Update Registry from State)

**Objective:** Verify pull sync recovers registry from state files

**Steps:**
```bash
# 1. With drift still present, run pull
npx jumpstart-mode workspace sync --pull

# Expected output:
# Pulling from state files...
# Updated: proj-token-analytics (phase: 1)
# Sync complete

# 2. Verify drift is resolved
npx jumpstart-mode workspace sync --audit

# Expected output:
# ✓ No drift detected
```

**Verify Changes:**

```bash
# 3. Check projects.json was updated
cat .jumpstart/projects.json | grep -A2 'proj-token-analytics'
# Should show: "phase": 1 (corrected)
```

**Success Criteria:**
- ✅ Pull syncs state files back to projects.json
- ✅ Drift resolved
- ✅ No data loss

---

### B3: Push Sync (Update State from Registry)

**Objective:** Verify push sync enforces registry as source of truth

**Steps:**
```bash
# 1. Edit projects.json (change phase again)
nano .jumpstart/projects.json
# Change proj-token-analytics phase: 1 → 2

# 2. Run push sync (destructive, updates state files)
npx jumpstart-mode workspace sync --push --force

# Expected output:
# ⚠️  DESTRUCTIVE: Updating state files from projects.json
# Updated: projects/token-analytics/.jumpstart/state/state.json
# Sync complete

# 3. Verify state files were updated
cat projects/token-analytics/.jumpstart/state/state.json | grep current_phase
# Should show: "current_phase": 2
```

**Caution:** Push is destructive (overwrites state files). Test with --force flag.

**Success Criteria:**
- ✅ Push updates state files from registry
- ✅ Requires --force flag (prevents accidents)
- ✅ State files now match registry

---

## Phase 3: Salesforce Scenario Initialization (Option C)

### C1: Create 4 Projects

**Objective:** Initialize all 4 projects from the Salesforce refactoring scenario

**Setup:**
```bash
# Create new workspace for this scenario (or use existing)
cd /path/to/workspace

# Or use token-usage-research and create alongside existing projects
cd c:\projects\token-usage-research
```

**Create Projects:**

```bash
# 1. Project 1: Legacy Analysis (Brownfield)
npx jumpstart-mode workspace create-project \
  --id=proj-legacy-sfs-analysis \
  --name="Legacy SFS Analysis" \
  --type=brownfield \
  --approver="PlatformLead"

# Expected: Project created at projects/legacy-sfs-analysis/

# 2. Project 2: CX Consumer API (Greenfield)
npx jumpstart-mode workspace create-project \
  --id=proj-cx-consumer-api \
  --name="Facade API" \
  --type=greenfield \
  --approver="APIOwner"

# 3. Project 3: CX Life API (Greenfield)
npx jumpstart-mode workspace create-project \
  --id=proj-cx-life-api \
  --name="Resource API" \
  --type=greenfield \
  --approver="BackendOwner"

# 4. Project 4: Integration Layer (Greenfield)
npx jumpstart-mode workspace create-project \
  --id=proj-sfs-integration \
  --name="Salesforce Integration Layer" \
  --type=greenfield \
  --approver="IntegrationOwner"
```

**Verify All Created:**

```bash
# Check workspace status
npx jumpstart-mode workspace status

# Expected output:
# 1. proj-legacy-sfs-analysis       [Initializing]
# 2. proj-cx-consumer-api           [Phase 0]
# 3. proj-cx-life-api               [Initializing]
# 4. proj-sfs-integration           [Initializing]
```

**Success Criteria:**
- ✅ All 4 projects created
- ✅ Project directories exist with specs/, src/, tests/
- ✅ config.yaml + state.json created for each
- ✅ All registered in projects.json

---

### C2: Check Dependencies

**Objective:** Verify dependency declarations work correctly

**Steps:**
```bash
# 1. Validate dependencies
npx jumpstart-mode workspace validate-deps

# Expected output:
# Validating dependencies...
# ✓ proj-legacy-sfs-analysis: Ready (no blockers)
# ✗ proj-cx-consumer-api: Blocked by proj-legacy-sfs-analysis (Scout phase)
# ✗ proj-cx-life-api: Blocked by proj-cx-consumer-api (Phase 3)
# ✗ proj-sfs-integration: Blocked by proj-cx-consumer-api, proj-cx-life-api (Phase 4)
```

**Check Dependency Graph:**

```bash
# 2. View detailed dependency report
npx jumpstart-mode workspace report --format=json | jq '.dependencies'

# Expected: Full dependency graph showing:
# - legacy-sfs-analysis → cx-consumer-api (hard block)
# - cx-consumer-api Phase 3 → cx-life-api (hard block at specific phase)
# - cx-consumer-api Phase 4 + cx-life-api Phase 4 → sfs-integration (dual block)
```

**Success Criteria:**
- ✅ Dependency declarations respected
- ✅ validate-deps detects all blocks correctly
- ✅ Block reasons clear (which project + which phase)

---

### C3: Start Scout Phase

**Objective:** Initialize Scout phase for legacy analysis

**Steps:**
```bash
# 1. Set active project
npx jumpstart-mode workspace set-active proj-legacy-sfs-analysis

# 2. Verify it's set
npx jumpstart-mode workspace active
# Expected: proj-legacy-sfs-analysis

# 3. Create mock codebase context (Scout output)
# In a real scenario, Scout analyzes the code
# For this test, we'll create a minimal codebase-context.md

cat > projects/legacy-sfs-analysis/specs/codebase-context.md << 'EOF'
---
id: codebase-context
phase: scout
agent: Scout
status: Draft
---

# Codebase Context: Legacy SFS Integration

## Current Architecture

```
Legacy Service Platform
    ↓ (HTTP REST)
Query Service
    ↓ (Internal RPC)
Whatever Service (unclear name, poor error handling)
    ↓
Backend System APIs
```

## Pain Points Identified
1. No clear naming (what does "Whatever" do?)
2. Monolithic call chain (can't route independently)
3. Hard to migrate customers gradually (all-or-nothing)
4. Error handling is implicit (missing cases)
5. Performance bottleneck: Whatever service is single-threaded

## Consumers
- Salesforce (primary)
- 3 internal tools (legacy integrations)
- Mobile app (deprecated, but still calling)

## Conclusion
This system needs refactoring into distributed APIs with clear contracts.
EOF

# 4. Verify Scout artifact created
ls -la projects/legacy-sfs-analysis/specs/
# Expected: codebase-context.md

# 5. Simulate Scout approval (move to Phase gate done)
echo "✓ Scout phase complete — codebase context created"
```

**Success Criteria:**
- ✅ Scout artifact (codebase-context.md) created
- ✅ Project structure reflects Scout completion
- ✅ No errors moving from Scout to next phase

---

### C4: Verify Unblocking Signals

**Objective:** Test that CX Consumer API unblocks when Scout completes

**Steps:**
```bash
# 1. Mark legacy analysis Scout as approved
# Edit projects.json: change legacy-sfs-analysis status from initializing → scout-approved

nano .jumpstart/projects.json
# Find legacy project, change:
#   "status": "initializing"
# To:
#   "status": "scout-approved"

# 2. Re-validate dependencies
npx jumpstart-mode workspace validate-deps

# Expected output:
# ✓ proj-legacy-sfs-analysis: Scout approved
# ✓ proj-cx-consumer-api: Ready ← NOW UNBLOCKED!
# ✗ proj-cx-life-api: Blocked by cx-consumer-api (Phase 3)
# ✗ proj-sfs-integration: Blocked by both APIs (Phase 4)
```

**Check Unblocking Details:**

```bash
# 3. Verify CX Consumer is actually unblocked
npx jumpstart-mode workspace active --can-advance proj-cx-consumer-api
# Expected: true

# 4. Try to activate it
npx jumpstart-mode workspace set-active proj-cx-consumer-api

# 5. Start Phase 0 Challenger
/jumpstart.challenge
```

**Success Criteria:**
- ✅ Dependency validation detects Scout completion
- ✅ CX Consumer API auto-unblocks
- ✅ Can activate unblocked project
- ✅ Phase 0 Challenger starts

---

## Phase 4: Deep Integration Testing (Option D)

### D1: Pit Crew Cross-Project Visibility

**Objective:** Verify Pit Crew can access cross-project context

**Steps:**
```bash
# 1. With 4-project Salesforce scenario set up, launch Pit Crew
/jumpstart.pitcrew "Should we start CX Life API Phase 0 while Consumer Phase 2 is in progress?"

# Expected Pit Crew behavior:
# 1. Loads all 4 projects from workspace context
# 2. Shows dependency relationships
# 3. Facilitates discussion across projects
# 4. Recommends unblocking strategy
```

**Verify Pit Crew Output:**

Look for:
```
Pit Crew Cross-Project Context
├─ proj-legacy-sfs-analysis (Scout approved)
├─ proj-cx-consumer-api (Phase 2: PM in progress)
├─ proj-cx-life-api (Blocked: waiting for Phase 3)
└─ proj-sfs-integration (Blocked: waiting for both APIs Phase 4)

Discussion Topic:
Can CX Life start Phase 0 while Consumer Phase 2 running?

Recommendation:
✓ YES — Discovery is independent
✗ NO — Data model not yet defined in Consumer
```

**Success Criteria:**
- ✅ Pit Crew loads multi-project context
- ✅ Shows dependency graph clearly
- ✅ Facilitates informed cross-project decisions

---

### D2: Partial Phase Gate Impact

**Objective:** Test what happens when upstream project approves Phase N (before Phase N+1)

**Setup:**
```bash
# 1. Simulate: CX Consumer Phase 2 approved (PM done)
# Edit projects.json: change phase 0 → 2

# 2. CX Life should still be blocked (waiting for Phase 3, not Phase 2)
npx jumpstart-mode workspace validate-deps

# Expected: CX Life still blocked
# ✗ proj-cx-life-api: Blocked by cx-consumer-api (Phase 3 required, current is Phase 2)
```

**Test Correct Phase Blocking:**

```bash
# 3. Advance Consumer to Phase 3 (Architect approved)
# Edit projects.json: change phase 2 → 3

# 4. Now CX Life should unblock
npx jumpstart-mode workspace validate-deps

# Expected: CX Life unblocked!
# ✓ proj-cx-life-api: Ready (cx-consumer-api Phase 3 approved)
```

**Success Criteria:**
- ✅ Blocking respects specific phase requirements
- ✅ Phase 2 doesn't unblock Phase 3-dependent projects
- ✅ Phase 3 correctly unblocks
- ✅ No false positive unblocking

---

### D3: Stress Test with Manual Edits

**Objective:** Verify workspace handles manual edits gracefully

**Scenario 1: Manual projects.json Edit**

```bash
# 1. Edit projects.json directly (simulate manual change)
nano .jumpstart/projects.json
# Change: proj-sfs-integration phase from null → 1

# 2. Check if workspace detects inconsistency
npx jumpstart-mode workspace sync --audit

# Expected:
# ⚠️  Drift detected:
# • proj-sfs-integration: projects.json says phase=1, state.json says phase=null

# 3. Recover with sync
npx jumpstart-mode workspace sync --pull
# Or: npx jumpstart-mode workspace sync --push --force
```

**Scenario 2: Manual state.json Edit**

```bash
# 4. Edit state.json directly
nano projects/legacy-sfs-analysis/.jumpstart/state/state.json
# Change: "current_phase": null → "current_phase": 1

# 5. Check workspace detects it
npx jumpstart-mode workspace sync --audit

# Expected: Detects drift in the opposite direction

# 6. Recover
npx jumpstart-mode workspace sync --pull
```

**Scenario 3: Missing Project**

```bash
# 7. Delete a project entry from projects.json (simulate corruption)
# Remove proj-cx-consumer-api entry

# 8. Check if workspace complains
npx jumpstart-mode workspace status

# Expected error or warning about missing project

# 9. Recover by re-adding entry from backup or recreating
npx jumpstart-mode workspace create-project ...
```

**Success Criteria:**
- ✅ Manual edits are detected
- ✅ Workspace doesn't crash
- ✅ Sync recovers from drift
- ✅ Clear error messages guide recovery

---

## Summary & Validation Matrix

### Test Results Table

| Option | Test | Status | Notes |
|--------|------|--------|-------|
| **A1** | Phase 1 Agent activation | ⏳ Pending | Check workspace detection |
| **A2** | spec-loader works | ⏳ Pending | Project-scoped path loading |
| **A3** | phase-gate-updater works | ⏳ Pending | Auto-updates state + unblocking |
| **B1** | Sync audit detects drift | ⏳ Pending | Intentional drift test |
| **B2** | Pull sync recovers registry | ⏳ Pending | State files → projects.json |
| **B3** | Push sync enforces registry | ⏳ Pending | projects.json → state files |
| **C1** | 4 projects created | ⏳ Pending | Salesforce scenario init |
| **C2** | Dependencies work | ⏳ Pending | Blocks + unblocking correct |
| **C3** | Scout phase starts | ⏳ Pending | codebase-context.md created |
| **C4** | Unblocking signals work | ⏳ Pending | Scout approval → Consumer unblock |
| **D1** | Pit Crew multi-project | ⏳ Pending | Cross-project visibility |
| **D2** | Partial phase gates | ⏳ Pending | Phase 2 doesn't unblock Phase 3+ |
| **D3** | Stress test manual edits | ⏳ Pending | Drift detection + recovery |

---

## Expected Outcomes

**If All Tests Pass:**
✅ Multi-workspace Jump Start is **production-ready**
- Agents work seamlessly across projects
- Dependencies are enforced correctly
- Unblocking happens automatically
- Sync prevents data corruption
- Brownfield + greenfield mix works
- Enterprise refactoring scenarios fully supported

**If Tests Fail:**
🔴 Document failures, prioritize by impact
- High: Agent workspace detection
- High: Dependency unblocking
- Medium: Sync mechanisms
- Low: Edge case handling

---

**Start with Option A1 and proceed through checklist.**

**Record results here as you complete each test.**

