---
id: product-brief-autonav
phase: 1
agent: Analyst
status: Approved
created: 2026-06-08
updated: 2026-06-08
version: 1.0.0
approved_by: Eric
approval_date: 2026-06-08
upstream_refs:
  - specs/challenger-brief.md
  - specs/codebase-context.md
dependencies:
  - challenger-brief-autonav
  - codebase-context-autonav
risk_level: medium
owners:
  - Eric
---

# Product Brief — JumpStart AutoNav

> **Phase:** 1 — Analysis  
> **Agent:** The Analyst  
> **Status:** Approved  
> **Created:** 2026-06-08  
> **Approval date:** 2026-06-08  
> **Approved by:** Eric  
> **Upstream Reference:** [challenger-brief.md](challenger-brief.md)

---

## Problem Reference

**Reframed Problem Statement (from Phase 0):**

> JumpStart AutoNav lacks an approved, phase-gated product specification at the repository root. Framework infrastructure is validated (workspace pilot), but maintainers and operators cannot point to approved personas, MVP scope, or architecture for the **product itself** — blocking cross-project dependencies and confident release communication.

**Validation Criteria (from Phase 0):**

1. Approved challenger + product brief exist under root `specs/`
2. PRD defines Must Have scope for next AutoNav release (not pilot)
3. Phase 3 architecture approved at root unblocks pilot dependency
4. `workspace sync --audit` clean after each root phase gate
5. npm package README traceable to approved PRD capabilities

---

## Vision Statement

> Teams adopting JumpStart AutoNav install a spec-driven agentic framework from npm, run multi-project workspaces with governed phase gates and IDE hooks, and ship AI-assisted software with approved artifacts — not ad-hoc prompts and drifting code.

---

## User Personas

### Persona 1: Jordan, Framework Maintainer

| Attribute | Detail |
|-----------|--------|
| **Goals** | Ship stable npm releases; keep workspace, hooks, and headless aligned; maintain test coverage |
| **Frustrations** | Code ahead of root specs; README drift; unclear what counts as "released" vs experimental |
| **Technical Proficiency** | High |
| **Relevant Context** | Owns JumpStart-AutoNav repo; merged workspace P0–P2 and pilot validation |
| **Current Workaround** | ADRs + README; pilot dogfood as informal release gate |
| **Representative Quote** | "Tell me what's in the next npm version before I tag it." |

### Persona 2: Sam, Multi-Project Lead

| Attribute | Detail |
|-----------|--------|
| **Goals** | Run framework product work and nested projects in one repo with clear active project and dependencies |
| **Frustrations** | Pit Crew blocks without approved root architecture; registry vs state confusion |
| **Technical Proficiency** | Medium |
| **Relevant Context** | Approves phase gates; uses `workspace set-active`, Pit Crew |
| **Current Workaround** | Separate mental models for root vs pilot projects |
| **Representative Quote** | "Which project am I in, and what's blocking the other one?" |

### Persona 3: Riley, IDE Agent Operator

| Attribute | Detail |
|-----------|--------|
| **Goals** | Invoke `/jumpstart.*` agents with hooks enforcing phase integrity and correct spec paths |
| **Frustrations** | Unclear when hooks block vs advise; headless vs IDE behavior gaps |
| **Technical Proficiency** | Medium–High |
| **Relevant Context** | VS Code Copilot + AutoNav hooks; occasional headless runs |
| **Current Workaround** | Read hook README; trial and error |
| **Representative Quote** | "The hooks should tell me why I'm blocked, not just that I am." |

### Persona 4: Casey, npm Adopter

| Attribute | Detail |
|-----------|--------|
| **Goals** | Install `jumpstart-mode`, scaffold a project, reach Phase 4 with confidence |
| **Frustrations** | Docs spread across README, MULTI_WORKSPACE, hooks; workspace vs single-project unclear |
| **Technical Proficiency** | Medium |
| **Relevant Context** | External or internal team new to Jump Start |
| **Current Workaround** | Quick Start only; skips multi-project until hit complexity |
| **Representative Quote** | "I need one story for what this package does and how to start." |

---

## User Journeys

### Current-State Journey (Primary Persona: Jordan)

| Step | Action | Thinking | Feeling | Pain Point (Severity) |
|------|--------|----------|---------|----------------------|
| 1 | Ships workspace P2 code | "Tests green" | Relieved | No root PRD for release (High) |
| 2 | Tags npm version | "Is README enough?" | Anxious | Spec gap at root (High) |
| 3 | Pilot completes Phase 4 | "Infra validated" | Satisfied | Product story still unclear (Moderate) |
| 4 | Gets Pit Crew questions | "Why still blocked?" | Confused | Cross-project deps need root Phase 3 (Moderate) |
| 5 | Updates README ad hoc | "Hope this matches code" | Tired | No traceability to PRD (Moderate) |

### Future-State Journey (Primary Persona: Jordan)

| Step | Action | Thinking | Feeling | Improvement |
|------|--------|----------|---------|-------------|
| 1 | Reads approved root PRD | "Scope is explicit" | Confident | Must Have release defined |
| 2 | Runs phases 0–3 at root | "Specs match code" | In control | Brownfield extend, not rewrite |
| 3 | Phase 3 approved | "Architecture signed off" | Done | Unblocks pilot dependency |
| 4 | Phase 4 implements PRD delta | "Small diff" | Focused | MVP is documentation + polish |
| 5 | npm publish with PRD link | "Release notes trace to stories" | Proud | Criterion 5 satisfied |

---

## Value Proposition

**Structured Format:**

- **For** framework maintainers, multi-project leads, and npm adopters  
- **Who** need governed, spec-driven AI development in monorepos  
- **The** JumpStart AutoNav product (`jumpstart-mode`)  
- **Is a** spec-driven agentic coding framework  
- **That** ships multi-project workspace, IDE hooks, CLI, and headless emulation as an integrated npm package  
- **Unlike** raw Copilot/Claude workflows without phase gates  
- **Our approach** combines approved spec artifacts, deterministic hooks, and workspace governance validated by live dogfood  

**Narrative Version:**

> JumpStart AutoNav turns AI-assisted coding from improvised chat into a phased, auditable pipeline. After workspace infrastructure proved out in the pilot, the product track at repo root defines what maintainers ship on npm: multi-project workspace as the headline capability, backed by hooks that enforce roadmap principles and CLIs that operators can automate. Adopters get a single package with a clear Quick Start path and an upgrade path into multi-project mode.

---

## Competitive Landscape

| Alternative | Type | Strengths | Weaknesses | Relevance |
|-------------|------|-----------|------------|-----------|
| Raw IDE agents (Copilot, Cursor) | Indirect | Flexible, fast | No phase gates, spec drift | High |
| BMAD / other agent frameworks | Indirect Substitute | Structured agents | Different artifact model | Medium |
| Internal README + ADRs only | DIY Workaround | Lightweight | Not phase-gated, not npm-oriented | High — current state |
| Separate repos per project | Substitute | Isolation | Loses workspace cross-project deps | Medium |

**Key Insight:** AutoNav's differentiator is **deterministic governance** (hooks + workspace + spec phases), not raw model access.

> _Note: Based on human's domain knowledge of this framework repo._

---

## Scope Recommendation

### Must Have (MVP) — Workspace Product Release

MVP is a **documented, PRD-specified workspace release** on existing code — not new P3 features.

| # | Capability | Validation Criterion | Rationale |
|---|-----------|---------------------|-----------|
| 1 | Root Phase 0–3 specs approved (this brief → PRD → architecture) | #1, #3 | Closes spec gap; unblocks pilot |
| 2 | PRD Must Haves: multi-project workspace CLI, sync, Pit Crew, dogfood path | #2 | Product = shippable workspace surface |
| 3 | README + MULTI_WORKSPACE aligned to approved PRD | #5 | npm adopter story |
| 4 | Regression: `npm run dogfood:workspace` + workspace test suite in CI | #4 | Release quality gate |
| 5 | Phase 4 tasks limited to doc/test gaps vs PRD (brownfield) | #2 | No rewrite |

### Should Have

| # | Capability | Rationale |
|---|-----------|-----------|
| 1 | Headless mock/live parity documented in PRD | Riley persona; pilot proved mock path |
| 2 | Hook catalog cross-ref in release notes | Operators need block-vs-advise clarity |
| 3 | `workspace allocate-budget` (ADR-012 deferred) | Cost governance polish |
| 4 | npm version bump + changelog from PRD | Jordan release workflow |

### Could Have

| # | Capability | Rationale |
|---|-----------|-----------|
| 1 | GraphViz in workspace knowledge-graph export | Stakeholder visuals |
| 2 | Second nested example project in docs | Onboarding |
| 3 | Parallel mode dogfood with two active projects | P2 stress test |

### Won't Have (This Release)

| # | Capability | Reason |
|---|-----------|--------|
| 1 | New workspace P3 features | Out of scope per Phase 0 |
| 2 | Hosted/SaaS AutoNav | CLI/npm product only |
| 3 | Re-running pilot validation program | Pilot complete at phase-4 |
| 4 | Full Requirements Deep Dive (all 18 PRD sections) | Brownfield; abbreviated pass |

### Constraints and Boundaries

- Extend existing `lib/`, hooks, CLI — no greenfield rewrite  
- Root specs live under `specs/` only when `proj-default` is active  
- Multi-project mode must remain backward compatible with single-project  
- Pilot project remains nested; do not merge pilot specs into root  
- Phase 3 approval is the Pit Crew unblock trigger for pilot dependency  

---

## Open Questions

### Resolved (from Phase 0)

- **MVP: workspace vs full AutoNav polish?** → **Workspace-first release** with hooks/headless as Should Have documentation and polish, not new infra.

### New Questions (for Phase 2)

- Target npm semver for workspace release (minor vs major)?
- Which hook subset is Must Have in PRD vs documented-only?

### Deferred

- **Full Neo4j-style graph queries:** Deferred per workspace plan P2 remaining.  
- **proj-default Phase 4 build scope exact file list:** Deferred to Architect/PM task breakdown.

---

## Requirements Coverage Summary

| Section | Relevance | Coverage | Key Gaps |
|---------|-----------|----------|----------|
| 1 — Context, Goals | HIGH | 90% | — |
| 2 — System Inventory | HIGH | 85% | codebase-context covers |
| 3 — Pain Points | HIGH | 85% | — |
| 4 — Functional Reqs | HIGH | 75% | PM PRD detail |
| 5 — NFRs | MED | 60% | PM quantification |
| 8 — Users & UX | HIGH | 85% | — |
| 11 — Tech Architecture | MED | 70% | Phase 3 |
| 15 — AI Components | HIGH | 80% | hooks + agents |

> Abbreviated pass — brownfield product track; PM runs targeted Requirements Deep Dive on workspace + release sections.

---

## Risks to the Product Concept

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Scope creep into new features | High | Medium | MVP = docs + polish only |
| README/PRD drift during Phase 4 | Medium | Medium | Traceability matrix in PRD |
| Pilot confusion with root product | Medium | Low | Clear naming; active project in hooks |

---

## Insights Reference

**Companion Document:** [specs/insights/product-brief-insights.md](insights/product-brief-insights.md)

1. **Workspace-first MVP** — Resolves Phase 0 open question.  
2. **Phase 3 unblock** — Product track goal includes pilot dependency resolution.  
3. **Four personas** — Added npm adopter (Casey) from stakeholder gap.

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
  "@id": "js:product-brief-autonav",
  "js:phase": 1,
  "js:agent": "Analyst",
  "js:status": "Approved",
  "js:version": "1.0.0",
  "js:upstream": [{ "@id": "js:challenger-brief-autonav" }],
  "js:downstream": [{ "@id": "js:prd-autonav" }]
}
```
