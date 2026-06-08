# Architecture Insights — Workspace Pilot

> Living document for Phase 3 technical decision rationale.

---

### Validation Architecture Scope

**Timestamp:** 2026-06-08T18:00:00Z  
**Type:** Decision  
**Confidence:** High  
**Source:** PRD + product brief scope boundaries

**Insight:**  
Phase 3 architecture documents validation infrastructure for remaining Should Have items (E3-S2, E4-S1), not a greenfield application. Components map to existing `lib/` modules. No new databases, APIs, or deployment targets.

**Evidence:**
- PRD Out of Scope: "New workspace features beyond P0–P2"
- Product brief: "Pilot is validation, not a shipping product"

**Impact:**
- Architecture.md uses C4 diagram of validation components
- Implementation plan M1–M2 marked complete

**Tags:** validation, scope, brownfield

---

### Pit Crew Block Is Expected

**Timestamp:** 2026-06-08T18:05:00Z  
**Type:** Constraint  
**Confidence:** High  
**Source:** Phase 0 validation criteria + live workspace-state.json

**Insight:**  
`canAdvanceProject('proj-workspace-pilot')` returning `pitCrewReview: true` is correct behavior while `proj-default` remains at Phase < 3. E3-S2 documents the acknowledged decision — it does not remove the gate.

**Evidence:**
- `test-dogfood-workspace-pilot.test.js` asserts block
- PRD risk #2: "Pit Crew block mistaken for bug"

**Alternatives Considered:**
- Auto-unblock for pilot — rejected; violates cross-project governance intent

**Impact:**
- ADR-001 captures outcomes without changing `blocked: true`

**Tags:** pitcrew, governance, cross-project

---

### Dogfood vs Headless Completion Split

**Timestamp:** 2026-06-08T18:10:00Z  
**Type:** Trade-Off  
**Confidence:** High  
**Source:** PRD NFR-P01 + current dogfood `--max-turns 3`

**Insight:**  
Dogfood remains a fast smoke test (~30s NFR). Full analyst completion requires 8+ mock turns and belongs in a dedicated Vitest test, not the dogfood script.

**Evidence:**
- Dogfood headless step only checks log strings "Multi-project workspace" and "Workspace initialized"
- Product brief Should Have #1 distinguishes setup vs completion

**Alternatives Considered:**
- Single dogfood command for everything — rejected for performance and clarity

**Impact:**
- ADR-002; M4-T02 dedicated test

**Tags:** headless, dogfood, performance

---

### Library-First for New Code

**Timestamp:** 2026-06-08T18:15:00Z  
**Type:** Pattern  
**Confidence:** High  
**Source:** Roadmap Article I

**Insight:**  
`workspace-pitcrew-resume.js` and mock registry extensions follow library-first: testable modules in `lib/` or `bin/lib/`, wired from CLI/scripts/hooks — not embedded in agent personas.

**Impact:**
- M3-T02, M4-T01 file locations

**Tags:** library-first, architecture
