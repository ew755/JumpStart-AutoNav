---
id: adr-015
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

# ADR-015: Must Have Hook Subset for Workspace Release

> **Status:** Accepted  
> **Date:** 2026-06-08  
> **Decision Maker:** The Architect (Phase 3)

---

## Context

PRD E6-S1 requires documenting which AutoNav hooks are **required for workspace governance** vs advisory. Repository has 26 hooks in `.github/hooks/autonav.json`. Operators need block-vs-advise clarity (Riley persona).

---

## Decision

**Must Have (workspace release)** — four governance surfaces:

| Surface | Implementation | Mode |
|---------|----------------|------|
| Pit Crew visibility | `.github/hooks/workspace-pitcrew-guard.js` | Advise (SessionStart) |
| Active project context | `.github/hooks/workspace-context.js` | Advise (SessionStart) |
| Phase integrity | `.github/hooks/phase-boundary-guard.js` | Block (PreToolUse) |
| Spec path scoping | `lib/workspace-path-resolver.js` + `bin/lib/tool-bridge.js` | Redirect (not a hook) |

All other hooks in `autonav.json` are **documented-only** for this release — valuable but not release-blocking.

Phase 4 must add this table to `.jumpstart/MULTI_WORKSPACE.md` or `.github/hooks/README.md`.

---

## Consequences

### Positive

- Clear operator expectations for workspace npm story
- Release docs match actual enforcement points

### Negative

- Logical PRD names differ from filenames — doc must map both

---

## Alternatives Considered

### All 26 hooks Must Have

- **Reason Rejected:** Over-scopes release; many are advisory analytics

### Hooks-only, no tool-bridge redirect

- **Reason Rejected:** Spec scoping is critical; implemented outside hook layer

---

## References

- `.github/hooks/autonav.json`
- [specs/prd.md](../prd.md) — E6-S1
