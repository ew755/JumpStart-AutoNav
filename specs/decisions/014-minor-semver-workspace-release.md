---
id: adr-014
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

# ADR-014: Minor Semver for Workspace Product Release

> **Status:** Accepted  
> **Date:** 2026-06-08  
> **Decision Maker:** The Architect (Phase 3)

---

## Context

PRD and PM insights require a semver policy for the workspace headline release. Current package version is `1.1.13`. Workspace mode is additive; single-project installs continue to work via `workspace upgrade`.

---

## Decision

Publish the workspace product release as a **minor** version bump (e.g., `1.1.13 → 1.2.0`):

- Workspace CLI commands remain backward compatible
- Single-project mode unchanged without explicit `workspace upgrade`
- CHANGELOG lists Must Have epics E2–E5 by name

Major bump reserved for breaking changes to CLI contracts, hook JSON schema, or spec artifact paths.

---

## Consequences

### Positive

- npm semver signals additive capability
- Adopters on 1.x can upgrade without major migration

### Negative

- Marketing may want "2.0" for workspace — rejected to match compatibility reality

---

## Alternatives Considered

### Major (2.0.0)

- **Reason Rejected:** No breaking changes in release scope

### Patch only

- **Reason Rejected:** Workspace is headline capability deserving minor signal

---

## References

- [specs/prd.md](../prd.md) — E5-S3, Product Overview semver policy
