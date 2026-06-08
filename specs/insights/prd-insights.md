# PRD Insights — JumpStart AutoNav

> **Phase:** 2 — Planning  
> **Agent:** The Product Manager  
> **Parent Artifact:** [`specs/prd.md`](../prd.md)  
> **Created:** 2026-06-08  
> **Last Updated:** 2026-06-08  

---

## About This Document

Living log of PM reasoning for the root product-track PRD (workspace-first release).

---

### Semver decision: minor bump

**Timestamp:** 2026-06-08T18:00:00Z  
**Type:** Decision  
**Confidence:** High  

**Insight:** Workspace mode is additive and backward compatible with single-project installs. Release uses a **minor** semver bump (e.g., `1.x.y → 1.(x+1).0`), not major. Major reserved for breaking CLI/hook contract changes.

**Alternatives considered:** Major bump — rejected; no breaking API removal in this release.

**Tags:** release, semver

---

### Hook Must Have subset defined

**Timestamp:** 2026-06-08T18:05:00Z  
**Type:** Decision  
**Confidence:** High  

**Insight:** Four hooks are **Must Have** for the workspace product release (governance + scoping). Remaining 22 hooks are **documented-only** in release notes / hook catalog (Should Have E6-S2).

Must Have hooks:
1. `workspace-pitcrew-guard` — blocked dependency visibility at SessionStart  
2. `workspace-active-project` — active project context injection  
3. `phase-gate-enforcer` — phase integrity on tool use  
4. `workspace-spec-redirect` — nested spec path redirection  

**Tags:** hooks, scope

---

### Brownfield story framing

**Timestamp:** 2026-06-08T18:10:00Z  
**Type:** Decision  
**Confidence:** High  

**Insight:** Most Must Have stories are **verify-and-document** acceptance criteria against existing P0–P2 code, not greenfield implementation. Phase 4 task breakdown emphasizes README/MULTI_WORKSPACE deltas and traceability matrix — aligns with product brief MVP #5.

**Tags:** brownfield, phase-4

---

### Epic boundary: spec track vs product surface

**Timestamp:** 2026-06-08T18:15:00Z  
**Type:** Decision  
**Confidence:** High  

**Insight:** Split E1 (root spec governance track) from E2–E5 (shippable product surface). E1 includes Phase 3 architecture approval story because criterion #3 is a product outcome, not just process.

**Tags:** epics, traceability
