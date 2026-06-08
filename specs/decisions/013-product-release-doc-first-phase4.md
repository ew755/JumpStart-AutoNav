---
id: adr-013
phase: 3
agent: Architect
status: Accepted
created: 2026-06-08
updated: 2026-06-08
version: 1.0.0
approved_by: null
approval_date: null
upstream_refs:
  - specs/prd.md
dependencies:
  - architecture-autonav
risk_level: low
owners:
  - Eric
---

# ADR-013: Documentation-First Phase 4 for Workspace Product Release

> **Status:** Accepted  
> **Date:** 2026-06-08  
> **Decision Maker:** The Architect (Phase 3)

---

## Context

PRD Must Have scope defines a **workspace product release** on existing P0–P2 code. Pilot validation (`proj-workspace-pilot` Phase 4) proved infrastructure. Root track must ship npm-ready docs and traceability without re-implementing workspace features.

Forces: Article IV spec-first; PRD E5 regression gates already green; scope creep risk if Phase 4 adds features.

---

## Decision

Phase 4 implementation is **documentation-first**:

1. Create and complete `specs/prd-traceability.md` (E4-S3)
2. Align `README.md` and `.jumpstart/MULTI_WORKSPACE.md` to PRD Must Have commands
3. Document Must Have hook tier vs advisory catalog (E6-S1)
4. Minor semver bump + changelog only after traceability matrix shows zero Must Have gaps
5. **No new workspace P3 features** unless a regression test fails and requires a minimal fix

---

## Consequences

### Positive

- Small, reviewable Phase 4 diff
- Release narrative matches approved PRD
- Maintains dogfood green path

### Negative

- Deferred items (allocate-budget, graph export) remain Should/Could Have
- Hook catalog may lag if new hooks added without doc update

### Neutral

- Developer agent tasks are mostly `[D]` not `[S]` implementation

---

## Alternatives Considered

### Feature polish sprint (allocate-budget, parallel dogfood)

- **Pros:** More headline features in release
- **Cons:** Violates PRD Won't Have / product brief scope
- **Reason Rejected:** Out of MVP

### Major semver bump

- **Pros:** Signals big change
- **Cons:** No breaking API changes; misleads npm consumers
- **Reason Rejected:** ADR-014 minor bump policy

---

## References

- [specs/prd.md](../prd.md) — Epics E4–E6, Milestones M3–M4
- ADR-012 — deferred advanced features
