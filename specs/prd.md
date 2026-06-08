---
id: prd-autonav
phase: 2
agent: PM
status: Approved
created: 2026-06-08
updated: 2026-06-08
version: 1.0.0
approved_by: Eric
approval_date: 2026-06-08
upstream_refs:
  - specs/challenger-brief.md
  - specs/product-brief.md
  - specs/codebase-context.md
dependencies:
  - challenger-brief-autonav
  - product-brief-autonav
  - codebase-context-autonav
risk_level: medium
owners:
  - Eric
---

# Product Requirements Document (PRD) — JumpStart AutoNav

> **Phase:** 2 — Planning  
> **Agent:** The Product Manager  
> **Status:** Approved  
> **Created:** 2026-06-08  
> **Approval date:** 2026-06-08  
> **Approved by:** Eric  
> **Upstream References:**
> - [challenger-brief.md](challenger-brief.md)
> - [product-brief.md](product-brief.md)
> - [codebase-context.md](codebase-context.md)

---

## Product Overview

JumpStart AutoNav (`jumpstart-mode`) is a spec-driven agentic coding framework published to npm. The **workspace-first product release** documents and gates the multi-project workspace capability already implemented and validated by `proj-workspace-pilot` — it does not add new P3 workspace infrastructure. Primary personas are Jordan (framework maintainer), Sam (multi-project lead), Riley (IDE operator), and Casey (npm adopter). MVP delivers approved root specs through Phase 3, PRD-defined Must Have workspace CLI/sync/Pit Crew/dogfood behavior, README and MULTI_WORKSPACE alignment traceable to this document, and CI regression gates. Phase 4 is limited to documentation, traceability, and test-gap closure versus this PRD. Phase 3 architecture approval unblocks the cross-project Pit Crew dependency from pilot to root.

**Release semver policy:** Minor bump (backward compatible; workspace additive to single-project mode).

---

## Epics

### Epic E1: Root Product Specification Track

**Description:** Complete the phase-gated spec track at repo root (`proj-default`) so the product has approved artifacts maintainers can cite for npm releases and cross-project governance can unblock at Phase 3.  
**Primary Persona:** Jordan, Framework Maintainer  
**Scope Tier:** Must Have  
**Validation Criterion Served:** #1, #3

---

#### Story E1-S1: Root Phase 0–1 artifacts approved

> As a **framework maintainer**,  
> I want **approved challenger brief and product brief under root `specs/`**,  
> so that **the product track has a governed foundation before PRD and architecture**.

**Acceptance Criteria:**

```gherkin
Given proj-default is the active project
When validatePhaseGate is run against specs/challenger-brief.md
Then valid is true
And approved_by is Eric

Given proj-default is the active project
When validatePhaseGate is run against specs/product-brief.md
Then valid is true
And the MVP section lists workspace-first release scope
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | XS |
| **Dependencies** | None |

**Notes:** Satisfied at Phase 1 gate (2026-06-08). Retained for traceability to criterion #1.

---

#### Story E1-S2: Root PRD approved with Must Have workspace scope

> As a **framework maintainer**,  
> I want **an approved PRD at root defining the workspace product release**,  
> so that **Phase 3 architecture and Phase 4 work have bounded Must Have scope**.

**Acceptance Criteria:**

```gherkin
Given specs/prd.md exists at repo root
When the Phase Gate Approval section is inspected
Then every Must Have epic has at least one user story
And every Must Have story has at least two Gherkin acceptance criteria

Given the PRD Product Overview is read
When Must Have epics E2 through E5 are enumerated
Then each epic maps to product-brief MVP capabilities 2–4
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E1-S1 |

---

#### Story E1-S3: Root Phase 3 architecture approved

> As a **multi-project lead**,  
> I want **root Phase 3 architecture approved**,  
> so that **proj-workspace-pilot cross-project dependency unblock_condition Phase 3 is satisfied**.

**Acceptance Criteria:**

```gherkin
Given proj-default reaches Phase 3
When validatePhaseGate is run against specs/architecture.md
Then valid is true
And approved_by is not Pending

Given root architecture is approved
When workspace-state.json cross_project_dependencies is read
Then the proj-workspace-pilot to proj-default dependency blocked flag may be cleared per unblock_condition
And node bin/workspace.js sync --audit exits 0
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | M |
| **Dependencies** | E1-S2 |

**Notes:** Implementation artifact is Phase 3 output, not Phase 4 code.

---

### Epic E2: Workspace CLI and Registry Sync

**Description:** Expose and verify the multi-project workspace operator surface: upgrade, status, active project switching, and registry/state sync with zero drift after phase gates.  
**Primary Persona:** Sam, Multi-Project Lead  
**Scope Tier:** Must Have  
**Validation Criterion Served:** #2, #4

---

#### Story E2-S1: Workspace upgrade and status

> As an **npm adopter**,  
> I want **to upgrade a single-project install to workspace mode and view project status**,  
> so that **I can enable multi-project without losing my existing project**.

**Acceptance Criteria:**

```gherkin
Given a repo in single-project mode with valid .jumpstart/config.yaml
When jumpstart-mode workspace upgrade runs from repo root
Then exit code is 0
And .jumpstart/projects.json is created
And the prior project is registered as the default active project

Given workspace mode is initialized
When jumpstart-mode workspace status runs
Then output lists all registered projects with phase and status fields
And the active project id is shown
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | None |

---

#### Story E2-S2: Active project switching and spec scoping

> As a **multi-project lead**,  
> I want **to set the active project and load specs from that project's directory**,  
> so that **root and nested projects do not share spec paths**.

**Acceptance Criteria:**

```gherkin
Given workspace mode with proj-default and proj-workspace-pilot registered
When jumpstart-mode workspace set-active proj-workspace-pilot runs
Then projects.json active_project_id equals proj-workspace-pilot

Given proj-workspace-pilot is active
When loadSpec resolves product-brief.md
Then the path contains projects/proj-workspace-pilot/specs
And the file does not resolve to root specs/product-brief.md unless proj-default is active
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E2-S1 |

---

#### Story E2-S3: Sync audit clean after phase gates

> As a **framework maintainer**,  
> I want **`workspace sync --audit` to report zero drift after each root phase gate**,  
> so that **registry and per-project state stay aligned**.

**Acceptance Criteria:**

```gherkin
Given proj-default state.json and projects.json are updated after a phase approval
When node bin/workspace.js sync --audit runs from repo root
Then exit code is 0
And output reports zero drift errors

Given registry phase differs from project state.json current_phase
When workspace sync --pull runs
Then projects.json phase matches state.json after sync
And a subsequent sync --audit passes
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E2-S1 |

---

#### Story E2-S4: Cross-project dependency validation

> As a **multi-project lead**,  
> I want **validate-deps and workspace report to show blocked cross-project dependencies**,  
> so that **I know what gates another project before advancing**.

**Acceptance Criteria:**

```gherkin
Given workspace-state.json lists a blocked dependency from proj-workspace-pilot to proj-default
When jumpstart-mode workspace validate-deps runs
Then output references the blocked dependency
And includes unblock_condition Phase 3

Given the same workspace state
When jumpstart-mode workspace report --format json runs
Then JSON output includes cross_project_dependencies array with blocked true
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E2-S1 |

---

### Epic E3: Pit Crew and Cross-Project Governance

**Description:** Govern cross-project phase advancement via Pit Crew visibility, blocked advancement checks, and auditable review recording.  
**Primary Persona:** Sam, Multi-Project Lead  
**Scope Tier:** Must Have  
**Validation Criterion Served:** #3

---

#### Story E3-S1: SessionStart Pit Crew guard for blocked deps

> As an **IDE agent operator**,  
> I want **SessionStart to warn when the active project has blocked cross-project dependencies**,  
> so that **I run Pit Crew before expecting phase advancement**.

**Acceptance Criteria:**

```gherkin
Given a blocked dependency involves the active project
When workspace-pitcrew-guard SessionStart hook runs
Then additionalContext includes Pit Crew Review Required
And additionalContext includes /jumpstart.pitcrew

Given no blocked dependencies involve the active project
When workspace-pitcrew-guard SessionStart hook runs
Then additionalContext does not include Pit Crew Review Required
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E2-S4 |

---

#### Story E3-S2: Pit Crew review recording CLI

> As a **multi-project lead**,  
> I want **to record Pit Crew outcomes via workspace pitcrew-record**,  
> so that **cross-project decisions are traceable in workspace-state.json**.

**Acceptance Criteria:**

```gherkin
Given workspace mode is initialized
When node bin/workspace.js pitcrew-record --topic="test" --outcome="acknowledged" runs
Then exit code is 0
And workspace-state.json workspace_resume_context includes a new pit_crew_outcomes entry

Given pitcrew-record is invoked without required flags
When the command runs
Then exit code is non-zero
And stderr describes missing required arguments
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E2-S1 |

---

#### Story E3-S3: Phase advancement blocked when Pit Crew required

> As a **multi-project lead**,  
> I want **canAdvanceProject to block advancement when Pit Crew review is required**,  
> so that **cross-project gates are enforced programmatically**.

**Acceptance Criteria:**

```gherkin
Given a blocked cross-project dependency with pitCrewReview true for proj-workspace-pilot
When canAdvanceProject("proj-workspace-pilot") is called
Then allowed is false
And pitCrewReview is true

Given root proj-default reaches approved Phase 3 architecture
When unblock condition is evaluated for the pilot dependency
Then advancement policy matches workspace-state.json unblock_condition
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E3-S1, E1-S3 |

---

### Epic E4: npm Adopter Documentation

**Description:** Align README and MULTI_WORKSPACE with approved PRD capabilities so npm adopters have a single coherent onboarding path.  
**Primary Persona:** Casey, npm Adopter  
**Scope Tier:** Must Have  
**Validation Criterion Served:** #5

---

#### Story E4-S1: README documents workspace Quick Start path

> As an **npm adopter**,  
> I want **README to explain single-project Quick Start and workspace upgrade path**,  
> so that **I can adopt without reading pilot-only docs**.

**Acceptance Criteria:**

```gherkin
Given README.md at repo root
When the Multi-Project Workspace section is read
Then it documents jumpstart-mode workspace upgrade
And it documents workspace set-active and sync --audit commands
And it links to .jumpstart/MULTI_WORKSPACE.md

Given a reader follows README workspace commands only
When they run workspace upgrade then status on a fresh clone
Then commands match documented syntax without undocumented flags
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | M |
| **Dependencies** | E2-S1 |

---

#### Story E4-S2: MULTI_WORKSPACE aligned to PRD Must Have capabilities

> As a **framework maintainer**,  
> I want **MULTI_WORKSPACE.md to describe the same Must Have CLI and governance surface as this PRD**,  
> so that **deep-dive docs do not contradict the product brief**.

**Acceptance Criteria:**

```gherkin
Given .jumpstart/MULTI_WORKSPACE.md
When Must Have workspace commands are compared to PRD Epic E2 and E3
Then every Must Have command in E2 (upgrade, status, set-active, sync, validate-deps, report) appears in MULTI_WORKSPACE
And Pit Crew cross-project dependency section references workspace-state.json

Given MULTI_WORKSPACE describes Beta status
When README workspace section is read
Then status wording is consistent (Beta or updated per Phase 4 release note)
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | M |
| **Dependencies** | E4-S1 |

---

#### Story E4-S3: PRD-to-README traceability matrix

> As a **framework maintainer**,  
> I want **a traceability matrix linking PRD Must Have stories to README sections and tests**,  
> so that **release review can verify criterion #5 without manual grep**.

**Acceptance Criteria:**

```gherkin
Given specs/prd-traceability.md exists after Phase 4
When each Must Have story E2-S1 through E5-S2 is listed
Then each row includes README section anchor or path
And each row includes at least one test file or npm script verifying the story

Given a Must Have story has no test mapping
When the traceability matrix is reviewed at release gate
Then the row is flagged as gap requiring Phase 4 task completion
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E1-S2, E4-S1 |

---

### Epic E5: Release Regression Gates

**Description:** Enforce workspace quality via dogfood scripts and automated tests in CI before npm publish.  
**Primary Persona:** Jordan, Framework Maintainer  
**Scope Tier:** Must Have  
**Validation Criterion Served:** #4

---

#### Story E5-S1: Workspace dogfood script passes

> As a **framework maintainer**,  
> I want **`npm run dogfood:workspace` to pass on main**,  
> so that **live nested-project behavior is validated in one command**.

**Acceptance Criteria:**

```gherkin
Given repo on main with proj-workspace-pilot registered
When npm run dogfood:workspace executes from repo root
Then exit code is 0
And output includes Dogfood pass complete

Given dogfood uses a throwaway redirect probe file
When dogfood completes
Then projects/proj-workspace-pilot/specs/product-brief.md gate remains approved
And the probe file is removed or lives outside pilot specs
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E2-S2 |

---

#### Story E5-S2: Workspace test suite passes in CI

> As a **framework maintainer**,  
> I want **workspace-related vitest files to pass in the CI quality gate**,  
> so that **regressions block merge to main**.

**Acceptance Criteria:**

```gherkin
Given GitHub Actions quality.yml runs on push to main
When the batched vitest step executes
Then tests matching test-workspace-*.test.js pass
And tests/test-dogfood-workspace-pilot.test.js passes

Given a workspace lib change breaks sync audit behavior
When CI runs
Then at least one workspace test fails before merge
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E5-S1 |

---

#### Story E5-S3: Minor semver release with changelog (Should Have)

> As a **framework maintainer**,  
> I want **npm version bump and changelog entries derived from PRD Must Have epics**,  
> so that **consumers know workspace is the headline capability**.

**Acceptance Criteria:**

```gherkin
Given Phase 4 release tasks are complete
When package.json version is bumped
Then the bump is minor not major per PRD semver policy
And CHANGELOG or release notes list Must Have epics E2–E5 by name

Given npm publish is run
Then published README on npm matches repo README workspace section for Must Have commands
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Should Have |
| **Size** | S |
| **Dependencies** | E4-S3, E5-S2 |

---

### Epic E6: Hooks and Headless Operator Experience

**Description:** Document hook governance tiers and headless mock workspace parity for IDE operators; no new hook infrastructure in this release.  
**Primary Persona:** Riley, IDE Agent Operator  
**Scope Tier:** Should Have  

---

#### Story E6-S1: Must Have hook subset documented

> As an **IDE agent operator**,  
> I want **docs to list which four hooks are required for workspace governance vs advisory**,  
> so that **I understand block vs advise behavior**.

**Acceptance Criteria:**

```gherkin
Given release documentation or MULTI_WORKSPACE hook section
When Must Have hooks are listed
Then the list includes workspace-pitcrew-guard, workspace-active-project, phase-gate-enforcer, workspace-spec-redirect
And each entry states block or advise mode

Given a hook not in the Must Have four
When the hook catalog is read
Then it is labeled documented-only for this release
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Should Have |
| **Size** | S |
| **Dependencies** | E3-S1 |

**Notes:** Exact hook filenames must match `.github/hooks/autonav.json` entries at Phase 4 doc time.

---

#### Story E6-S2: Headless mock multi-workspace path documented

> As an **IDE agent operator**,  
> I want **README or MULTI_WORKSPACE to document npm run dogfood:workspace:headless**,  
> so that **I can validate mock analyst runs without live LLM cost**.

**Acceptance Criteria:**

```gherkin
Given headless multi-workspace mock scenario exists
When npm run dogfood:workspace:headless runs
Then exit code is 0 within 120 seconds on CI runner hardware
And output artifacts land under the active project's specs path not root specs

Given documentation is updated in Phase 4
When an operator searches README for headless workspace
Then dogfood:workspace:headless command and --scenario multi-workspace are documented
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Should Have |
| **Size** | S |
| **Dependencies** | E5-S1 |

---

## Non-Functional Requirements

### Performance

| NFR ID | Requirement | Threshold | Percentile | Verification Method | SLA Tier |
|--------|-------------|-----------|-----------|-------------------|----------|
| NFR-P01 | workspace sync --audit completes on 2-project monorepo | < 3 seconds | p95 | Local timed run on main | Tier 2 |
| NFR-P02 | workspace status command | < 2 seconds | p95 | Local timed run | Tier 2 |
| NFR-P03 | dogfood:workspace script | < 90 seconds | p95 | npm run on CI ubuntu-latest | Tier 2 |

### Throughput and Scalability

| NFR ID | Requirement | Target | Sustained Duration | Verification Method |
|--------|-------------|--------|-------------------|-------------------|
| NFR-T01 | Registered projects per workspace | ≥ 10 projects without sync failure | Steady state | Fixture test or manual scale note in architecture |
| NFR-T02 | Concurrent headless runs | 1 active run per project id (documented limitation) | — | MULTI_WORKSPACE parallel mode section |

### Availability and Reliability

| NFR ID | Requirement | Target | Measurement Period | Verification Method |
|--------|-------------|--------|-------------------|-------------------|
| NFR-A01 | CLI commands return structured exit codes | 0 success, non-zero on validation failure | Per release | Integration tests |
| NFR-A02 | sync --audit detects registry drift | 100% of induced drift cases caught | Per test run | test-workspace-sync*.test.js |
| NFR-A03 | Dogfood does not mutate approved pilot specs | 0 gate regressions after dogfood | Per dogfood run | dogfood assert on product-brief gate |

### Security

| Requirement | Detail | Verification Method |
|-------------|--------|-------------------|
| No secrets in specs or workspace-state | API keys only via env vars | Manual review + grep in CI |
| Hook scripts read-only on specs outside active project | Redirect enforces nested paths | test-workspace tool-bridge tests |
| npm package surface | No elevated privileges required beyond Node.js file I/O | README prerequisites |

**Compliance requirements:** None (developer tooling; no regulated data)

### Accessibility

| Requirement | Target | Verification Method |
|-------------|--------|-------------------|
| CLI output human-readable | Plain text + optional JSON report format | Manual CLI review |
| Documentation readability | WCAG not applicable to CLI; docs use structured headings | Tech writer checklist Phase 4 |

### Observability

| Requirement | Detail |
|-------------|--------|
| Logging | CLI errors to stderr with actionable message |
| Monitoring | CI quality gate as release monitor |
| Metrics | workspace-state.json tracks pit_crew_outcomes and token budget fields |

### Backward Compatibility (Brownfield)

| Requirement | Detail | Verification Method |
|-------------|--------|-------------------|
| Single-project mode | workspace upgrade preserves existing specs at root | test-workspace-migration*.test.js |
| Existing jumpstart-mode commands | Non-workspace commands unchanged | Regression vitest batch |
| Pilot project isolation | proj-workspace-pilot specs remain under projects/ path | dogfood + E2-S2 tests |

### Other

| Category | Requirement | Detail |
|----------|-------------|--------|
| Runtime | Node.js | >= 14 per package.json |
| Package manager | npm | Primary; npm ci in CI |
| Internationalisation | English only | Docs and CLI messages |

---

## Dependencies and Risks

### External Dependencies

| # | Dependency | Type | Impact if Unavailable | Mitigation |
|---|-----------|------|----------------------|------------|
| 1 | GitHub Actions CI | Platform | No automated regression gate | Run vitest locally before publish |
| 2 | npm registry | Platform | Cannot ship package | Tag only after local dogfood pass |
| 3 | VS Code Copilot hooks runtime | Platform | Hook stories unverifiable in headless CI | Vitest hook unit tests + manual IDE spot check |
| 4 | proj-workspace-pilot nested project | Data | Dogfood fails | Keep pilot registered in projects.json |

### Risk Register

| # | Risk Description | Type | Impact | Probability | Mitigation | Owner |
|---|-----------------|------|--------|------------|------------|-------|
| 1 | Scope creep into new workspace features | Business | High | Medium | PRD Won't Have mirrors product brief; Architect flags deviations | Eric |
| 2 | README/PRD drift during Phase 4 | Schedule | Medium | Medium | E4-S3 traceability matrix | Jordan |
| 3 | Hook filename mismatch in E6 docs | Technical | Low | Medium | Verify against autonav.json at doc time | Riley |
| 4 | Pilot vs root product confusion | Business | Medium | Low | Active project called out in README; separate spec paths | Sam |
| 5 | Phase 3 delay blocks pilot dependency narrative | Schedule | Medium | Low | E1-S3 explicit milestone; Pit Crew already acknowledged | Eric |

---

## Success Metrics

| Metric | Phase 0 Criterion | Target | Measurement Method | Frequency | Baseline |
|--------|-------------------|--------|-------------------|-----------|----------|
| Root spec artifacts approved | #1 | challenger + product brief + PRD + architecture gates approved | validatePhaseGate on each artifact | Per phase gate | Phase 0–1 approved 2026-06-08 |
| PRD Must Have scope defined | #2 | ≥ 4 Must Have epics with ≥ 12 stories | PRD document review | Phase 2 gate | No root PRD (pre-Phase 2) |
| Pilot dependency unblocked | #3 | blocked false after root Phase 3 | workspace-state.json + validate-deps | Phase 3 gate | blocked true |
| Sync audit clean | #4 | 0 drift errors | workspace sync --audit | Each root phase gate | Clean at Phase 1 |
| README traceability | #5 | 100% Must Have stories mapped in prd-traceability.md | Matrix review at Phase 4 | Pre-publish | No matrix |
| Dogfood pass rate | #4 (automation) | 100% on main | npm run dogfood:workspace in CI/local | Each merge to main | Passing post-pilot |

---

## Implementation Milestones

### Milestone M1: Planning Complete

**Goal:** Root PRD approved with workspace-first Must Have scope locked.  
**Stories Included:** E1-S1, E1-S2  
**Depends On:** None

### Milestone M2: Architecture Signed Off

**Goal:** Root Phase 3 architecture approved; pilot Phase 3 unblock condition satisfied.  
**Stories Included:** E1-S3  
**Depends On:** M1

### Milestone M3: Documentation Aligned

**Goal:** README and MULTI_WORKSPACE match PRD; traceability matrix drafted.  
**Stories Included:** E4-S1, E4-S2, E4-S3, E6-S1, E6-S2  
**Depends On:** M2

### Milestone M4: Release Ready

**Goal:** Dogfood and CI green; minor semver publish candidate.  
**Stories Included:** E2-S1 through E5-S2, E5-S3  
**Depends On:** M3

---

## Task Breakdown

**Format:** `[Task ID] [P?] [Story] Description`

**Brownfield note:** Stages 1–2 are verification baselines. User story stages emphasize documentation, traceability, and test-gap closure — not greenfield workspace implementation.

---

### Stage 1: Setup (Release Baseline)

**Purpose:** Confirm workspace mode and active project for root product track

- [ ] T001 Verify proj-default active via `node bin/workspace.js active`
- [ ] T002 [P] Run baseline `node bin/workspace.js sync --audit` and record output in Phase 4 notes
- [ ] T003 [P] Confirm projects.json lists proj-default and proj-workspace-pilot with correct paths

---

### Stage 2: Foundational (Traceability Scaffold)

**Purpose:** Scaffolding required before documentation stories

**⚠️ CRITICAL:** E4-S3 traceability matrix depends on this stage

- [ ] T004 Create `specs/prd-traceability.md` skeleton with columns Story ID, README ref, Test/script ref, Status
- [ ] T005 [P] Map E2 stories to existing tests under `tests/test-workspace-*.test.js`
- [ ] T006 [P] Map E3 stories to `tests/test-workspace-pitcrew*.test.js` and hook tests

**Checkpoint:** ☐ Traceability scaffold ready — documentation stages may proceed

---

### Stage 3: Story E4-S1 — README workspace Quick Start (Must Have)

**Goal:** README documents upgrade, set-active, sync for npm adopters  
**Independent Test:** New clone user follows README workspace section only

- [ ] T007 [P] [E4-S1] Audit README Multi-Project Workspace section against PRD E2 commands in `README.md`
- [ ] T008 [E4-S1] Add or fix workspace command examples and MULTI_WORKSPACE link in `README.md`
- [ ] T009 [E4-S1] Update traceability row for E4-S1 in `specs/prd-traceability.md`

**Checkpoint:** ☐ E4-S1 README path verified

---

### Stage 4: Story E4-S2 — MULTI_WORKSPACE alignment (Must Have)

**Goal:** Deep-dive doc matches PRD Must Have surface  
**Independent Test:** Side-by-side PRD E2/E3 vs MULTI_WORKSPACE command list

- [ ] T010 [P] [E4-S2] Audit `.jumpstart/MULTI_WORKSPACE.md` for missing Must Have commands
- [ ] T011 [E4-S2] Update Pit Crew and workspace-state.json sections in `.jumpstart/MULTI_WORKSPACE.md`
- [ ] T012 [E4-S2] Align Beta/status wording between README and MULTI_WORKSPACE

**Checkpoint:** ☐ E4-S2 docs aligned

---

### Stage 5: Story E6-S1 — Hook Must Have catalog (Should Have)

**Goal:** Four Must Have hooks documented with block/advise mode  
**Independent Test:** Doc list matches `.github/hooks/autonav.json`

- [ ] T013 [P] [E6-S1] Resolve exact hook ids from `.github/hooks/autonav.json`
- [ ] T014 [E6-S1] Add Must Have vs documented-only hook table to `.jumpstart/MULTI_WORKSPACE.md` or `.github/hooks/README.md`
- [ ] T015 [E6-S1] Update traceability for E6-S1

**Checkpoint:** ☐ Hook catalog published

---

### Stage 6: Story E6-S2 — Headless mock documentation (Should Have)

**Goal:** Operators can find dogfood:workspace:headless without pilot docs  
**Independent Test:** `npm run dogfood:workspace:headless` documented and passes

- [ ] T016 [P] [E6-S2] Add headless workspace section to README or MULTI_WORKSPACE
- [ ] T017 [E6-S2] Verify `npm run dogfood:workspace:headless` exit 0 and document expected runtime

**Checkpoint:** ☐ E6-S2 headless path documented

---

### Stage 7: Story E4-S3 — Complete traceability matrix (Must Have)

**Goal:** 100% Must Have story coverage for criterion #5  
**Independent Test:** No Must Have row has empty Test column at release

- [ ] T018 [E4-S3] Complete all Must Have rows in `specs/prd-traceability.md`
- [ ] T019 [P] [E4-S3] Flag gaps as Phase 4 todos for any story lacking test mapping

**Checkpoint:** ☐ Traceability matrix complete for Must Have stories

---

### Stage 8: Story E5-S3 — Release versioning (Should Have)

**Goal:** Minor semver bump with PRD-derived changelog  
**Independent Test:** package.json version and CHANGELOG match policy

- [ ] T020 [E5-S3] Bump minor version in `package.json`
- [ ] T021 [P] [E5-S3] Add CHANGELOG entry listing Must Have epics E2–E5
- [ ] T022 [E5-S3] Run full dogfood and vitest workspace batch before npm publish

**Checkpoint:** ☐ Release candidate ready

---

### Stage 9: Polish and Cross-Cutting

**Purpose:** Final release gate

- [ ] T023 [P] Run `node bin/workspace.js sync --audit` after Phase 4 doc commits
- [ ] T024 [P] Run `npm run dogfood:workspace` and `npm run dogfood:workspace:headless`
- [ ] T025 Update root `README.md` npm badge/version if published

---

### Dependencies and Execution Order

```
Stage 1 (Setup)
    ↓
Stage 2 (Traceability scaffold) ← BLOCKS E4-S3 completion
    ↓
Stages 3–6 (Docs — E4, E6) → can overlap after Stage 2
    ↓
Stage 7 (E4-S3 matrix complete)
    ↓
Stage 8–9 (Release polish)
```

**MVP First:** Stages 1–2 → E4-S1 → E4-S2 → E4-S3 → dogfood verification (E5 already green; maintain).

---

## Glossary

| Term | Definition |
|------|------------|
| proj-default | Root JumpStart AutoNav product project; specs under `specs/` |
| proj-workspace-pilot | Nested validation project under `projects/proj-workspace-pilot/` |
| workspace mode | Multi-project layout with `.jumpstart/projects.json` registry |
| Pit Crew | Advisory multi-agent roundtable; `/jumpstart.pitcrew` |
| dogfood | `npm run dogfood:workspace` live validation script |
| Must Have hooks | Four governance hooks listed in E6-S1 |
| unblock_condition | Phase level in workspace-state.json that clears a blocked dependency |

---

## Insights Reference

**Companion Document:** [specs/insights/prd-insights.md](insights/prd-insights.md)

1. **Minor semver** — Workspace release is backward compatible.  
2. **Four Must Have hooks** — Remainder documented-only.  
3. **Brownfield stories** — Verify-and-document, not rewrite P0–P2.

---

## Cross-Reference Links

| This Document | Links To | Section |
|---|---|---|
| User Stories | architecture.md (Phase 3) | Component Mapping |
| Epics | implementation-plan.md (Phase 3) | Task Mapping |
| Personas | product-brief.md | User Personas |
| Success Metrics | challenger-brief.md | Validation Criteria |

---

## Phase Gate Approval

- [x] Human has reviewed this PRD
- [x] Every epic has at least one user story
- [x] Every Must Have story has at least 2 acceptance criteria
- [x] Acceptance criteria are specific and testable (no vague qualifiers)
- [x] Non-functional requirements have measurable thresholds
- [x] At least one implementation milestone is defined
- [x] Task breakdown includes Setup, Foundational, and at least one user story stage
- [x] Dependencies have identified mitigations
- [x] Risks have identified mitigations
- [x] Success metrics map to Phase 0 validation criteria
- [x] Human has explicitly approved this PRD for Phase 3 handoff

**Approved by:** Eric  
**Approval date:** 2026-06-08  
**Status:** Approved

---

## Linked Data

```json-ld
{
  "@context": { "js": "https://jumpstart.dev/schema/" },
  "@type": "js:SpecArtifact",
  "@id": "js:prd-autonav",
  "js:phase": 2,
  "js:agent": "PM",
  "js:status": "Approved",
  "js:version": "1.0.0",
  "js:upstream": [
    { "@id": "js:challenger-brief-autonav" },
    { "@id": "js:product-brief-autonav" }
  ],
  "js:downstream": [
    { "@id": "js:architecture-autonav" },
    { "@id": "js:implementation-plan-autonav" }
  ]
}
```
