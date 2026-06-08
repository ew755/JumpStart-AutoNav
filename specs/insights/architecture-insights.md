# Architecture Insights — JumpStart AutoNav

> **Phase:** 3 — Solutioning  
> **Agent:** The Architect  
> **Parent Artifact:** [`specs/architecture.md`](../architecture.md)  
> **Created:** 2026-06-08  
> **Last Updated:** 2026-06-08  

---

### Brownfield architecture = document + gate, not rebuild

**Timestamp:** 2026-06-08T19:00:00Z  
**Type:** Decision  
**Confidence:** High  

**Insight:** Root Phase 3 architecture describes **existing** P0–P2 workspace stack (ADR-009–012). Phase 4 delta is documentation, traceability matrix, and semver publish — aligned with PRD brownfield scope.

**Tags:** brownfield, scope

---

### Hook Must Have mapping corrected to repo filenames

**Timestamp:** 2026-06-08T19:05:00Z  
**Type:** Discovery  
**Confidence:** High  

**Insight:** PRD E6-S1 used logical names; architecture maps to actual hooks: `workspace-pitcrew-guard.js`, `workspace-context.js`, `phase-boundary-guard.js`, plus `lib/workspace-path-resolver.js` + tool-bridge for spec redirect (not a hook file).

**Tags:** hooks, accuracy

---

### Phase 3 approval triggers pilot unblock evaluation

**Timestamp:** 2026-06-08T19:10:00Z  
**Type:** Constraint  
**Confidence:** High  

**Insight:** `approvePhase` Phase 3 should call `checkUnblocks` for proj-default — pilot dependency may clear when architecture gate approved. Pit Crew human acknowledgment may still be required per workspace settings.

**Tags:** pitcrew, governance

---

### Inherited ADRs supersede new product ADRs for infra

**Timestamp:** 2026-06-08T19:12:00Z  
**Type:** Decision  
**Confidence:** High  

**Insight:** Workspace infrastructure decisions live in `.jumpstart/decisions/ADR-009` through `ADR-012`. Root `specs/decisions/` ADRs cover **product release** choices only (semver, doc-first Phase 4, hook tiering).

**Tags:** adr, traceability

---

### Tool-driven stress test fixes (P0/P1)

**Timestamp:** 2026-06-08T20:15:00Z  
**Type:** Decision  
**Confidence:** High  

**Insight:** Dogfood temp set-active/restores; validate-deps shows BLOCKED; report JSON includes cross_project_dependencies; `parseFormatArg` accepts `--format json`. `approvePhase` cleared pilot→default block (`unblocked_projects: ["proj-workspace-pilot"]`).

**Tags:** workspace, dogfood, tools
