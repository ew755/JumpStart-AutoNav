---
id: product-brief-workspace-pilot
phase: 1
agent: Analyst
status: Approved
created: 2026-06-08
updated: 2026-06-08
version: 1.0.0
approved_by: Eric
approval_date: 2026-06-08
upstream_refs:
  - projects/proj-workspace-pilot/specs/challenger-brief.md
dependencies:
  - challenger-brief-workspace-pilot
risk_level: low
owners:
  - Eric
---

# Product Brief — Workspace Pilot

> **Phase:** 1 — Analysis  
> **Agent:** The Analyst  
> **Status:** Draft  
> **Created:** 2026-06-08  
> **Approval date:** Pending  
> **Approved by:** Pending  
> **Upstream Reference:** [challenger-brief.md](challenger-brief.md)

---

## Problem Reference

**Reframed Problem Statement (from Phase 0):**

> Jump Start multi-project workspace infrastructure is implemented (P0–P2) but not validated against a real nested project driving Phase 0→1 with live registry, hooks, Pit Crew gates, and headless path scoping.

**Validation Criteria (from Phase 0):**

1. Approved challenger brief lives under `projects/proj-workspace-pilot/specs/`
2. Analyst produces `product-brief.md` in the same directory (not workspace root)
3. `workspace sync --audit` reports no drift after phase advancement
4. Pit Crew guard injects when `proj-workspace-pilot` is active and dependency is blocked

---

## Vision Statement

> Teams operating multiple AI-driven Jump Start projects in one repository can switch active projects, scope artifacts correctly, and see cross-project dependencies before phase advancement — without breaking single-project backwards compatibility.

---

## User Personas

### Persona 1: Morgan, Framework Maintainer

| Attribute | Detail |
|-----------|--------|
| **Goals** | Keep workspace registry, hooks, and headless runner aligned; prevent regressions across P0–P2 features |
| **Frustrations** | Validation only in fixtures; live `projects.json` drift; agents writing to root `specs/` |
| **Technical Proficiency** | High |
| **Relevant Context** | Owns Jump Start framework repo; runs vitest and dogfood scripts in CI |
| **Current Workaround** | Manual inspection of paths and registry after each workspace change |
| **Representative Quote** | "I need proof the pilot project behaves like production, not just test fixtures." |

### Persona 2: Alex, Multi-Project Lead

| Attribute | Detail |
|-----------|--------|
| **Goals** | Run Project A (framework) and Project B (pilot) in parallel without artifact collisions |
| **Frustrations** | Unclear active project; blocked dependencies discovered late |
| **Technical Proficiency** | Medium |
| **Relevant Context** | Uses VS Code + Jump Start agents; approves phase gates |
| **Current Workaround** | Separate git branches per effort |
| **Representative Quote** | "Tell me which project I'm in and what's blocking me before I approve the next phase." |

### Persona 3: Riley, Agent Operator

| Attribute | Detail |
|-----------|--------|
| **Goals** | Run headless or IDE agents that write specs to the correct nested directory |
| **Frustrations** | Headless runs landing artifacts at workspace root |
| **Technical Proficiency** | Medium–High |
| **Relevant Context** | Uses `npm run emulate` and SessionStart hooks for context |
| **Current Workaround** | Manually move files after agent runs |
| **Representative Quote** | "If the hook says pilot specs, the agent should write there — full stop." |

---

## User Journeys

### Current-State Journey (Primary Persona: Morgan)

| Step | Action | Thinking | Feeling | Pain Point (Severity) |
|------|--------|----------|---------|----------------------|
| 1 | Implements workspace P2 feature | "Tests pass in fixtures" | Cautiously optimistic | Fixture-only coverage (Moderate) |
| 2 | Creates nested pilot project | "Does registry pick it up?" | Uncertain | Manual registry edits (Moderate) |
| 3 | Runs agent on pilot | "Where did the spec land?" | Frustrated | Root `specs/` pollution (Critical) |
| 4 | Checks cross-project deps | "Is Pit Crew wired?" | Anxious | Blockers found at gate time (Moderate) |
| 5 | Runs sync audit | "Registry vs state drift?" | Tired | Manual reconcile (Minor) |

### Future-State Journey (Primary Persona: Morgan)

| Step | Action | Thinking | Feeling | Improvement |
|------|--------|----------|---------|-------------|
| 1 | Sets active project to pilot | "Context is explicit" | Confident | SessionStart hooks inject paths |
| 2 | Runs dogfood script | "Live validation automated" | Relieved | `npm run dogfood:workspace` |
| 3 | Agent writes product brief | "File in pilot specs/" | Satisfied | Path resolver redirects writes |
| 4 | Pit Crew hook fires on blocked dep | "Expected — run pitcrew" | In control | Early cross-project warning |
| 5 | Sync audit clean | "Registry matches state" | Done | No drift |

---

## Value Proposition

**Structured Format:**

- **For** framework maintainers and multi-project leads
- **Who** need confidence that nested Jump Start projects work end-to-end
- **The** Workspace Pilot validation program
- **Is a** live dogfood project within the AutoNav monorepo
- **That** proves registry, hooks, path scoping, Pit Crew gates, and headless setup on real files
- **Unlike** fixture-only tests alone
- **Our approach** exercises production layout (`projects/proj-workspace-pilot/`) with automated dogfood + CI checks

**Narrative Version:**

> The Workspace Pilot is not a new product — it is a structured validation effort that treats multi-project workspace support as a deliverable. By driving Phase 0→1 on a nested project with real registry state, cross-project dependencies, and automated checks, the team gains repeatable evidence that the framework works before betting larger efforts on parallel project mode.

---

## Competitive Landscape

| Alternative | Type | Strengths | Weaknesses | Relevance |
|-------------|------|-----------|------------|-----------|
| Fixture-only integration tests | DIY Workaround | Fast CI, isolated | May miss live registry/hook interactions | High — current baseline |
| Separate repos per project | Indirect Substitute | Hard isolation | Loses shared agents/templates; no cross-project deps | Medium |
| Manual QA checklist | DIY Workaround | Flexible | Not repeatable; drifts from code | Medium |

**Key Insight:** Automated dogfood on a live nested project closes the gap between fixture tests and day-to-day operator experience.

> _Note: Based on human's domain knowledge of this framework repo._

---

## Scope Recommendation

### Must Have (MVP)

| # | Capability | Validation Criterion Served | Rationale |
|---|-----------|---------------------------|-----------|
| 1 | Approved challenger brief in pilot `specs/` | Criterion 1 | Phase 0 gate — done |
| 2 | Product brief in pilot `specs/` (this artifact) | Criterion 2 | Phase 1 deliverable |
| 3 | `npm run dogfood:workspace` passes | Criteria 2–4 | Automates path, Pit Crew, sync checks |
| 4 | Active project + registry/state alignment | Criterion 3 | `sync --audit` clean after updates |
| 5 | Pit Crew SessionStart injection when dep blocked | Criterion 4 | Verified in dogfood script |

### Should Have

| # | Capability | Rationale |
|---|-----------|-----------|
| 1 | Full headless analyst run completing Phase 1 artifact (not just setup) | Mock agent hits turn limit today; improve mock responses later |
| 2 | Pit Crew roundtable notes in workspace resume context | Documents cross-project decision |

### Could Have

| # | Capability | Rationale |
|---|-----------|-----------|
| 1 | GraphViz export in dogfood report | Nice visual for stakeholders |
| 2 | Second pilot project for parallel mode stress test | P2 feature validation |

### Won't Have (This Release)

| # | Capability | Reason for Exclusion |
|---|-----------|---------------------|
| 1 | New workspace features (P3) | Pilot validates existing P0–P2 only |
| 2 | Production deployment of pilot code | No application runtime — validation only |
| 3 | Resolving `proj-default` Phase 3 dependency | Out of pilot scope; tracked separately |

### Constraints and Boundaries

- Pilot artifacts live only under `projects/proj-workspace-pilot/`
- No changes to Jump Start phase agent protocols as part of pilot MVP
- Cross-project dependency on `proj-default` Phase 3 remains blocked until Pit Crew review
- Dogfood script is the authoritative automated pass/fail for pilot MVP

---

## Open Questions

### Resolved (from Phase 0)

- **Where should pilot specs live?** Under `projects/proj-workspace-pilot/specs/` (confirmed).

### New Questions (for Phase 2)

- Should PM treat pilot MVP as a single epic or fold into framework release notes?
- What acceptance criteria define "headless analyst complete" vs "setup only"?

### Deferred

- **Parallel mode dogfood with two active projects:** Deferred until sequential pilot passes; revisit after Phase 2 plan.

---

## Requirements Coverage Summary

| Section | Relevance | Coverage | Key Gaps |
|---------|-----------|----------|----------|
| 1 — Context, Goals | HIGH | 90% | — |
| 2 — System Inventory | MED | 70% | Full inventory of hooks deferred to architect |
| 3 — Pain Points | HIGH | 85% | — |
| 4 — Functional Reqs | HIGH | 80% | Headless completion criteria |
| 5 — NFRs | MED | 60% | Performance targets N/A for validation pilot |
| 6 — Data & Integration | LOW | 50% | — |
| 7 — Compatibility | HIGH | 90% | — |
| 8 — Users & UX | HIGH | 85% | — |
| 9 — Governance & Risk | HIGH | 75% | Pit Crew automation depth |
| 10 — Releases | MED | 70% | — |
| 11 — Tech Architecture | MED | 65% | Covered in framework ADRs |
| 12 — Cost & Budget | LOW | 40% | Token budgets optional for pilot |
| 13 — Team & Staffing | LOW | 30% | — |
| 14 — Documentation | MED | 80% | — |
| 15 — AI Components | HIGH | 75% | Agent path scoping |
| 16 — Compliance | LOW | 20% | — |
| 17 — Observability | MED | 60% | Timeline/usage optional |
| 18 — Vendors | LOW | 10% | — |

> **Full requirements responses:** Not generated — pilot scope is validation, not greenfield product. PM may skip Requirements Deep Dive or run abbreviated pass.

---

## Risks to the Product Concept

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| Pilot passes dogfood but real agent sessions still write to root | High | Medium | Path resolver + hook context; monitor in Phase 4 build |
| Pit Crew gate blocks all pilot progress | Medium | High | Document expected block; run `/jumpstart.pitcrew` |
| Confusion between pilot project and `proj-default` product | Medium | Medium | Clear naming; active project in every SessionStart |

---

## Insights Reference

**Companion Document:** [specs/insights/product-brief-insights.md](insights/product-brief-insights.md)

1. **Pilot is validation, not a shipping product** — Scope stays bounded to P0–P2 evidence.
2. **Dogfood script is MVP acceptance** — Automates criteria 2–4 from Phase 0.
3. **Pit Crew block is expected behavior** — Not a defect for this pilot.

---

## Phase Gate Approval

- [x] Human has reviewed this brief
- [x] At least one user persona is defined
- [x] User journeys are mapped (if configured)
- [x] MVP scope is populated
- [x] Every Must Have capability traces to a Phase 0 validation criterion
- [x] All open questions are resolved or explicitly deferred with rationale
- [x] Human has explicitly approved this brief for Phase 2 handoff

**Approved by:** Eric  
**Approval date:** 2026-06-08  
**Status:** Approved

---

## Linked Data

```json-ld
{
  "@context": { "js": "https://jumpstart.dev/schema/" },
  "@type": "js:SpecArtifact",
  "@id": "js:product-brief-workspace-pilot",
  "js:phase": 1,
  "js:agent": "Analyst",
  "js:status": "Approved",
  "js:version": "1.0.0",
  "js:upstream": [
    { "@id": "js:challenger-brief-workspace-pilot" }
  ],
  "js:downstream": [
    { "@id": "js:prd" }
  ]
}
```
