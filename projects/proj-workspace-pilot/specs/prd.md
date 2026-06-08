---
id: prd-workspace-pilot
phase: 2
agent: PM
status: Approved
created: 2026-06-08
updated: 2026-06-08
version: 1.0.0
approved_by: Eric
approval_date: 2026-06-08
upstream_refs:
  - projects/proj-workspace-pilot/specs/challenger-brief.md
  - projects/proj-workspace-pilot/specs/product-brief.md
dependencies:
  - challenger-brief-workspace-pilot
  - product-brief-workspace-pilot
risk_level: low
owners:
  - Eric
---

# Product Requirements Document (PRD) — Workspace Pilot

> **Phase:** 2 — Planning  
> **Agent:** The Product Manager  
> **Status:** Draft  
> **Created:** 2026-06-08  
> **Approval date:** Pending  
> **Approved by:** Pending  
> **Upstream References:**
> - [challenger-brief.md](challenger-brief.md)
> - [product-brief.md](product-brief.md)

---

## Product Overview

The Workspace Pilot validates that Jump Start multi-project workspace support (P0–P2) works on a **live nested project** in the AutoNav monorepo—not only in test fixtures. The pilot serves framework maintainers (Morgan), multi-project leads (Alex), and agent operators (Riley) by proving correct artifact scoping, registry/state sync, Pit Crew cross-project gates, and headless path redirection. MVP success is measured by automated dogfood (`npm run dogfood:workspace`), clean sync audits, and Phase 0–2 spec artifacts confined to `projects/proj-workspace-pilot/specs/`. This is a validation program, not a customer-facing application.

---

## Epics

### Epic E1: Nested Project Artifact Layout

**Description:** Ensure all Jump Start phase artifacts for the pilot live under the nested project root and are loadable via workspace-aware spec APIs.  
**Primary Persona:** Morgan, Framework Maintainer  
**Scope Tier:** Must Have  
**Validation Criterion Served:** Phase 0 criterion 1–2

---

#### Story E1-S1: Phase artifacts in pilot specs directory

> As a **framework maintainer**,  
> I want **all pilot phase specs under `projects/proj-workspace-pilot/specs/`**,  
> so that **multi-project layout matches production conventions**.

**Acceptance Criteria:**

```gherkin
Given proj-workspace-pilot is the active project
When loadSpec(context, "challenger-brief.md") is called
Then the resolved path contains "projects/proj-workspace-pilot/specs"
And the file content includes "Workspace Pilot"

Given proj-workspace-pilot is the active project
When loadSpec(context, "product-brief.md") is called
Then validatePhaseGate returns valid true for the approved brief
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | None |

---

#### Story E1-S2: Registry reflects pilot phase progression

> As a **multi-project lead**,  
> I want **projects.json and pilot state.json to stay aligned**,  
> so that **workspace status commands show accurate phase**.

**Acceptance Criteria:**

```gherkin
Given pilot state.json has current_phase N
When workspace sync --pull runs from repo root
Then projects.json entry for proj-workspace-pilot shows phase N and status "phase-N"

Given registry and state are aligned
When workspace sync --audit runs
Then zero drift errors are reported
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E1-S1 |

---

### Epic E2: Automated Dogfood Validation

**Description:** Provide a repeatable script and CI test proving live workspace behavior.  
**Primary Persona:** Morgan, Framework Maintainer  
**Scope Tier:** Must Have  
**Validation Criterion Served:** Phase 0 criteria 2–4 (via automation)

---

#### Story E2-S1: Dogfood script passes on clean workspace

> As a **framework maintainer**,  
> I want **`npm run dogfood:workspace` to pass from repo root**,  
> so that **I have one command to validate the pilot**.

**Acceptance Criteria:**

```gherkin
Given the repo is on main with proj-workspace-pilot active
When npm run dogfood:workspace executes
Then exit code is 0
And output includes "Dogfood pass complete"

Given dogfood runs successfully
When test-dogfood-workspace-pilot.test.js runs in CI
Then all tests pass
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | M |
| **Dependencies** | E1-S1, E1-S2 |

---

#### Story E2-S2: Tool-bridge redirects root specs writes

> As an **agent operator**,  
> I want **create_file to specs/ at workspace root to redirect to pilot specs**,  
> so that **headless and IDE agents cannot pollute root specs/**.

**Acceptance Criteria:**

```gherkin
Given multi-project mode with active proj-workspace-pilot
When tool-bridge create_file targets "{workspaceRoot}/specs/new-artifact.md"
Then the file is written under projects/proj-workspace-pilot/specs/new-artifact.md
And no file exists at workspace root specs/new-artifact.md

Given path redirection occurred
When create_file response is inspected
Then redirected equals true
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | E1-S1 |

---

### Epic E3: Cross-Project Governance

**Description:** Validate Pit Crew gate and blocked dependency visibility for the pilot.  
**Primary Persona:** Alex, Multi-Project Lead  
**Scope Tier:** Must Have  
**Validation Criterion Served:** Phase 0 criterion 4

---

#### Story E3-S1: Pit Crew SessionStart injection

> As a **multi-project lead**,  
> I want **SessionStart to warn when blocked deps involve the active project**,  
> so that **I run Pit Crew before advancing phases**.

**Acceptance Criteria:**

```gherkin
Given workspace-state.json has a blocked dependency involving proj-workspace-pilot
And proj-workspace-pilot is the active project
When workspace-pitcrew-guard SessionStart hook runs
Then additionalContext includes "Pit Crew Review Required"
And additionalContext includes "/jumpstart.pitcrew"

Given the same blocked dependency exists
When canAdvanceProject("proj-workspace-pilot") is called
Then allowed is false and pitCrewReview is true
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Must Have |
| **Size** | S |
| **Dependencies** | None |

---

#### Story E3-S2: Document Pit Crew decision path (Should Have)

> As a **multi-project lead**,  
> I want **Pit Crew roundtable notes captured in workspace resume context**,  
> so that **cross-project unblock decisions are traceable**.

**Acceptance Criteria:**

```gherkin
Given /jumpstart.pitcrew completes on a blocked dependency
When workspace-state.json is read
Then workspace_resume_context documents the review outcome or next steps

Given Pit Crew has not run
When pilot attempts phase advancement past blocked gate
Then operator sees explicit Pit Crew guidance (not a generic error)
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Should Have |
| **Size** | M |
| **Dependencies** | E3-S1 |

---

### Epic E4: Headless Multi-Project Setup

**Description:** Confirm headless runner initializes multi-project scenarios correctly.  
**Primary Persona:** Riley, Agent Operator  
**Scope Tier:** Should Have

---

#### Story E4-S1: Headless multi-workspace scenario initializes

> As an **agent operator**,  
> I want **headless runner to set up multi-project workspace from e2e scenario**,  
> so that **mock agent runs use correct project specs paths**.

**Acceptance Criteria:**

```gherkin
Given scenario multi-workspace exists
When headless-runner runs with --scenario multi-workspace --mock --max-turns 3
Then log includes "Multi-project workspace" and active project id
And phase artifacts copy to projects/proj-alpha/specs (fixture scenario)

Given headless-workspace tests run
When setupMultiWorkspaceScenario completes
Then getWorkspaceContext reports mode multi-project
```

| Attribute | Value |
|-----------|-------|
| **Priority** | Should Have |
| **Size** | M |
| **Dependencies** | E2-S2 |

---

## Non-Functional Requirements

### Performance

| NFR ID | Requirement | Threshold | Verification Method |
|--------|-------------|-----------|---------------------|
| NFR-P01 | Dogfood script runtime | < 30 seconds on dev machine | `npm run dogfood:workspace` timing |
| NFR-P02 | Workspace sync audit | < 5 seconds | CLI manual / script step |

### Reliability

| NFR ID | Requirement | Target | Verification Method |
|--------|-------------|--------|---------------------|
| NFR-A01 | Dogfood script exit code | 100% pass on clean main | CI + local run |
| NFR-A02 | Sync audit after phase gate | 0 drift errors | `workspace sync --audit` |

### Security

| Requirement | Detail | Verification Method |
|-------------|--------|-------------------|
| No secrets in pilot specs | Pilot artifacts contain no credentials | Manual review + secret scan |

### Observability

| Requirement | Detail |
|-------------|--------|
| Resume context | Pilot and workspace state resume_context updated after each phase |
| Dogfood logging | Script prints step pass/fail with clear labels |

---

## Dependencies and Risks

### External Dependencies

| # | Dependency | Type | Impact if Unavailable | Mitigation |
|---|-----------|------|----------------------|------------|
| 1 | Jump Start workspace P0–P2 on main | Platform | Pilot cannot validate | Pin to tagged release |
| 2 | proj-default Phase 3 (future) | Cross-project | Pilot dep stays blocked | Pit Crew; document in PRD |
| 3 | Vitest CI environment | Platform | Dogfood CI test skipped | `describe.skipIf` guard |

### Risk Register

| # | Risk | Type | Impact | Probability | Mitigation | Owner |
|---|------|------|--------|-------------|------------|-------|
| 1 | Agents write to root specs despite hooks | Technical | High | Med | Path resolver + hook context | Morgan |
| 2 | Pit Crew block mistaken for bug | Process | Med | High | Document in PRD + product brief | Alex |
| 3 | Mock headless never completes phase | Technical | Low | High | Should Have only; dogfood is MVP | Riley |

---

## Success Metrics

| Metric | Phase 0 Criterion | Target | Measurement Method | Frequency |
|--------|-------------------|--------|-------------------|-----------|
| Pilot specs layout | #1 | 100% artifacts under pilot specs/ | File path check | Per phase |
| Analyst/PM output location | #2 | No root specs pollution | Dogfood + manual | Per phase |
| Sync audit clean | #3 | 0 drift errors | `workspace sync --audit` | After each gate |
| Pit Crew injection | #4 | Hook fires when dep blocked | Dogfood step + IDE session | Per release |
| Dogfood pass rate | MVP | 100% on main | CI | Every commit |

---

## Implementation Milestones

### Milestone M1: Phase 0–1 Validation (Complete)

**Goal:** Challenger and product brief approved in pilot specs; dogfood passes.  
**Stories Included:** E1-S1, E1-S2, E2-S1, E2-S2, E3-S1  
**Depends On:** None

### Milestone M2: Phase 2 Planning (This PRD)

**Goal:** PRD approved with traceable stories to validation criteria.  
**Stories Included:** All E1–E3 Must Have stories documented  
**Depends On:** M1

### Milestone M3: Phase 3 Architecture (Next)

**Goal:** Architect produces validation architecture + implementation plan for remaining Should/Could items.  
**Stories Included:** E3-S2, E4-S1  
**Depends On:** M2 approval

---

## Task Breakdown

> Validation-focused tasks (not application runtime). Paths relative to repo root.

### Stage 1: Setup (Complete)

- [x] T001 [E1-S1] Seed `projects/proj-workspace-pilot/specs/` with Phase 0–1 artifacts
- [x] T002 [E1-S2] Set active project to proj-workspace-pilot in projects.json
- [x] T003 [P] [E2-S1] Add `scripts/dogfood-workspace-pilot.mjs`
- [x] T004 [P] [E2-S1] Add `tests/test-dogfood-workspace-pilot.test.js`
- [x] T005 [P] [E2-S1] Register `npm run dogfood:workspace` in package.json

### Stage 2: Foundational (Complete)

- [x] T006 [E2-S2] Implement `lib/workspace-path-resolver.js`
- [x] T007 [E2-S2] Wire path resolver into `bin/lib/tool-bridge.js`
- [x] T008 [E3-S1] Add `.github/hooks/workspace-pitcrew-guard.js`
- [x] T009 [E3-S1] Register pitcrew hook in autonav.json

**Checkpoint:** ☑ Foundation ready

### Stage 3: Story E3-S2 — Pit Crew documentation (Should Have)

**Goal:** Capture Pit Crew outcomes in workspace resume context  
**Independent Test:** After pitcrew session, resume_context contains review notes

- [ ] T010 [E3-S2] Run `/jumpstart.pitcrew` on proj-default dependency
- [ ] T011 [E3-S2] Update workspace-state.json resume_context with Pit Crew outcome
- [ ] T012 [E3-S2] Document unblock criteria in pilot specs/insights/

### Stage 4: Story E4-S1 — Headless completion (Should Have)

**Goal:** Improve mock headless analyst completion rate  
**Independent Test:** Headless analyst completes without max-turns on multi-workspace scenario

- [ ] T013 [P] [E4-S1] Extend mock responses for analyst persona on multi-workspace
- [ ] T014 [E4-S1] Add headless e2e assertion for product-brief creation in scenario tmp dir
- [ ] T015 [E4-S1] Optional: wire dogfood to verify headless output path

---

## Traceability Matrix

| Epic | Product Brief Must Have | Phase 0 Criterion |
|------|-------------------------|-------------------|
| E1 | #1, #4 | #1, #3 |
| E2 | #3, #5 | #2, #3, #4 |
| E3 | #5 | #4 |
| E4 | Should Have #1 | — |

---

## Out of Scope

- New workspace features beyond P0–P2
- Resolving proj-default Phase 3 dependency (separate track)
- Production deployment or user-facing UI
- Full Requirements Deep Dive (abbreviated validation PRD)

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
  "@id": "js:prd-workspace-pilot",
  "js:phase": 2,
  "js:agent": "PM",
  "js:status": "Approved",
  "js:version": "1.0.0",
  "js:upstream": [
    { "@id": "js:challenger-brief-workspace-pilot" },
    { "@id": "js:product-brief-workspace-pilot" }
  ],
  "js:downstream": [
    { "@id": "js:architecture" },
    { "@id": "js:implementation-plan" }
  ]
}
```
