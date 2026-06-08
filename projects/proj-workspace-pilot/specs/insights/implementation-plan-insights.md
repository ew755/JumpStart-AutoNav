# Implementation Plan Insights — Workspace Pilot

> Watch-items and rationale for Developer agent (Phase 4).

---

### Pre-Completed Foundation

**Timestamp:** 2026-06-08T18:20:00Z  
**Type:** Discovery  
**Confidence:** High  
**Source:** Git history + PRD Stage 1–2 checkboxes

**Insight:**  
Tasks T001–T009 (path resolver, pitcrew hook, dogfood script) are already on `main`. Developer should not re-implement — verify with `npm run dogfood:workspace` before starting M3.

**Impact:** M3-T01 is first actionable task

**Tags:** phase-4, developer, foundation

---

### Pit Crew Session Before State Write

**Timestamp:** 2026-06-08T18:22:00Z  
**Type:** Constraint  
**Confidence:** High  
**Source:** ADR-001

**Insight:**  
M3-T02 must use outcome text from actual `/jumpstart.pitcrew` session (M3-T01). Do not fabricate outcomes — Eric approves Pit Crew summary before `recordPitCrewReview` runs.

**Impact:** Task ordering M3-T01 → M3-T02 is strict

**Tags:** pitcrew, human-gate

---

### Windows Path Handling

**Timestamp:** 2026-06-08T18:25:00Z  
**Type:** Pattern  
**Confidence:** High  
**Source:** phase-gate-updater.js fix (commit 4efb2a8)

**Insight:**  
Use `context.project.project_id` for project resolution — never regex on absolute paths like `C:\projects\...`. All new workspace code must use `path.join` and workspace-context APIs.

**Impact:** M3-T02, M4-T02 implementations

**Tags:** windows, paths, regression

---

### Mock Registry Turn Budget

**Timestamp:** 2026-06-08T18:28:00Z  
**Type:** Open Question  
**Confidence:** Medium  
**Source:** Headless runner behavior

**Insight:**  
If 8 turns insufficient after M4-T01, increase test budget to 12 — do NOT change dogfood. Log actual turn count in test output for future tuning.

**Impact:** M4-T02 Done When criteria

**Tags:** headless, mock, turns
