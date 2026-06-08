# ADR-001: Pit Crew Resume Context Capture

> **Status:** Accepted  
> **Date:** 2026-06-08  
> **Decision Maker:** The Architect (Phase 3)

---

## Context

PRD story E3-S2 requires Pit Crew roundtable outcomes to be traceable in `workspace_resume_context` after `/jumpstart.pitcrew` completes. Today, `last_pit_crew_review` exists in the schema (see MULTI_WORKSPACE.md) but is always `null` in live state. Pit Crew sessions are advisory-only and do not auto-write artifacts.

Operators need explicit guidance when `canAdvanceProject` returns `pitCrewReview: true` — not a generic error. The pilot dependency `proj-workspace-pilot → proj-default (Phase 3)` will remain blocked for the foreseeable future; documenting the acknowledged decision prevents repeated confusion.

## Decision

Introduce a small library module `lib/workspace-pitcrew-resume.js` with a single exported function `recordPitCrewReview(rootDir, payload)` that:

1. Reads `.jumpstart/state/workspace-state.json`
2. Sets `workspace_resume_context.last_pit_crew_review` to ISO timestamp
3. Appends to `workspace_resume_context.pit_crew_outcomes[]` with `{ date, topic, outcome, next_steps, dependency_ref }`
4. Updates `workspace_resume_context.tldr` with a one-line summary

Pit Crew session notes remain in `specs/insights/pitcrew-*.md` (manual or facilitator output). The library captures a **structured summary** only — not full roundtable transcript.

Phase 4 task M2-T010 runs `/jumpstart.pitcrew` manually; M2-T011 calls `recordPitCrewReview` with the session outcome.

## Consequences

### Positive

- Satisfies E3-S2 acceptance criteria with machine-readable state
- Operators see prior Pit Crew decisions in workspace resume context
- Library-first: independently testable without IDE hooks

### Negative

- Manual step after Pit Crew — not auto-wired to facilitator agent yet
- `pit_crew_outcomes[]` array grows over time (mitigate: cap at 20 entries, FIFO)

### Neutral

- Does not unblock dependencies automatically — human must still approve cross-project resolution

## Alternatives Considered

### Auto-hook on facilitator completion

- **Pros:** Zero manual step
- **Cons:** Facilitator is advisory-only with no standard artifact path; hook would be fragile
- **Reason Rejected:** Out of pilot scope; deferred to P3 workspace polish

### Store outcomes only in pilot insights markdown

- **Pros:** Simpler, no schema change
- **Cons:** Fails E3-S2 Gherkin (`workspace-state.json is read`)
- **Reason Rejected:** Does not meet PRD acceptance criteria

## References

- PRD E3-S2
- `.jumpstart/MULTI_WORKSPACE.md` — `last_pit_crew_review` field
- Product brief: "Pit Crew block is expected behavior"
