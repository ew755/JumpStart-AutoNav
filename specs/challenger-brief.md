---
id: challenger-brief-autonav
phase: 0
agent: Challenger
status: Approved
created: 2026-06-08
updated: 2026-06-08
version: 1.0.0
approved_by: Eric
approval_date: 2026-06-08
upstream_refs:
  - specs/codebase-context.md
dependencies:
  - codebase-context-autonav
risk_level: medium
owners:
  - Eric
---

# Challenger Brief — JumpStart AutoNav

> **Phase:** 0 — Problem / Challenge Discovery  
> **Agent:** The Challenger  
> **Status:** Approved  
> **Created:** 2026-06-08  
> **Approval date:** 2026-06-08  
> **Approved by:** Eric  
> **Upstream Reference:** [codebase-context.md](codebase-context.md)

---

## Original Statement

> Advance the JumpStart AutoNav product (`proj-default`) through Jump Start phases now that multi-project workspace validation (proj-workspace-pilot) is complete, so the framework has an approved product specification at the repo root and cross-project dependencies can progress.

**Follow-up context:**

> Workspace pilot (Phase 0–4) validated P0–P2 infrastructure. Root project remained at Phase 0 with empty config. Pit Crew blocks pilot advancement until `proj-default` reaches Phase 3. AutoNav is the npm-published spec-driven framework (hooks, headless runner, workspace CLI) — not the pilot validation program.

---

## Assumptions Identified

| # | Assumption | Category | Status | Evidence / Notes |
|---|-----------|----------|--------|-----------------|
| 1 | Pilot completion proves root product is ready to spec | Solution | Untested | Pilot validates infra, not product positioning |
| 2 | AutoNav needs full Phase 0–4 like a greenfield app | Feasibility | Believed | Brownfield — extend existing framework |
| 3 | Primary users are framework maintainers and IDE operators | User | Validated | README, hooks README, pilot personas |
| 4 | Phase 3 on root unblocks pilot dependency | Problem | Validated | workspace-state.json unblock_condition |
| 5 | Shipping npm package equals product success | Value | Untested | Needs Phase 1–2 scope definition |

**Summary:** 2 validated, 2 believed, 2 untested.

---

## Root Cause Analysis (Five Whys)

**Starting point:** Root `proj-default` never completed Jump Start phases while framework code grew rapidly.

1. **Why?** Engineering effort focused on workspace P0–P2 implementation and pilot dogfood.  
2. **Why?** Multi-project mode was higher priority than product documentation at root.  
3. **Why?** No forcing function required root specs before shipping workspace features.  
4. **Why?** Framework repo treated code as source of truth without spec track at root.  
5. **Why?** Jump Start phases were exercised on nested pilot, not registered default project.

**Root Cause Identified:**

> The monorepo's default project (`proj-default`) was registered but never driven through spec phases, creating a **spec gap at the product root** while infrastructure validation succeeded in a nested project.

---

## Stakeholder Map

| Stakeholder | Relationship | Impact | Current Workaround |
|-------------|--------------|--------|-------------------|
| Eric (approver) | Adopts / approves gates | High | Manual decisions per feature |
| Framework maintainers | Build lib/, hooks, CLI | High | README + ADRs only |
| IDE operators | Run `/jumpstart.*` with hooks | Medium | Trial-and-error, pilot docs |
| npm consumers | Install `jumpstart-mode` | Medium | README quick start |
| Workspace pilot (nested) | Blocked on root Phase 3 | High | Pit Crew acknowledged; waits |

**Missing stakeholders check:** CI/automation consumers — include in Phase 1 if headless/CLI is Must Have.

---

## Reframed Problem Statement

**Reframe options presented:**

1. *Ship more workspace code* — rejected; pilot proved infra.  
2. *Document existing framework only* — insufficient; no phased product scope.  
3. **Define and approve what JumpStart AutoNav is as a product** — selected.

**Selected problem statement:**

> JumpStart AutoNav lacks an approved, phase-gated product specification at the repository root. Framework infrastructure is validated (workspace pilot), but maintainers and operators cannot point to approved personas, MVP scope, or architecture for the **product itself** — blocking cross-project dependencies and confident release communication.

---

## Validation Criteria

| # | Criterion | Type | Measurable? |
|---|-----------|------|-------------|
| 1 | Approved challenger + product brief exist under root `specs/` | Artifact | Yes |
| 2 | PRD defines Must Have scope for next AutoNav release (not pilot) | Scope | Yes |
| 3 | Phase 3 architecture approved at root unblocks pilot dependency | Governance | Yes |
| 4 | `workspace sync --audit` clean after each root phase gate | Process | Yes |
| 5 | npm package README traceable to approved PRD capabilities | Docs | Needs refinement |

---

## Constraints and Boundaries

### Explicitly Out of Scope

- Re-implementing workspace P0–P2 (done; pilot validated)
- Duplicating pilot validation artifacts at root
- Customer-facing SaaS or hosted service (framework is CLI/npm product)

### Non-Negotiable Constraints

- Brownfield: extend existing `lib/`, hooks, CLI — no rewrite
- Approver: Eric
- Multi-project workspace remains operational during root phases
- Spec-first: root specs are source of truth (Article IV)

### Known Unknowns

- MVP boundary: workspace-only release vs broader AutoNav hooks/headless polish
- Version bump strategy for npm after Phase 4

---

## Insights Reference

**Companion Document:** [specs/insights/challenger-brief-insights.md](insights/challenger-brief-insights.md)

1. **Pilot ≠ product** — Validation complete; root track defines shippable AutoNav.  
2. **Brownfield spec gap** — Code ahead of root specs.  
3. **Dependency is governance** — Phase 3 unblock is intentional Pit Crew design.

---

## Phase Gate Approval

- [x] Human has reviewed this brief
- [x] Problem statement is specific and testable
- [x] At least one validation criterion is defined
- [x] Constraints and boundaries section is populated
- [x] Human has explicitly approved this brief for Phase 1 handoff

**Approved by:** Eric  
**Approval date:** 2026-06-08  
**Status:** Approved

---

## Linked Data

```json-ld
{
  "@context": { "js": "https://jumpstart.dev/schema/" },
  "@type": "js:SpecArtifact",
  "@id": "js:challenger-brief-autonav",
  "js:phase": 0,
  "js:agent": "Challenger",
  "js:status": "Approved",
  "js:version": "1.0.0",
  "js:upstream": [{ "@id": "js:codebase-context-autonav" }],
  "js:downstream": [{ "@id": "js:product-brief-autonav" }]
}
```
