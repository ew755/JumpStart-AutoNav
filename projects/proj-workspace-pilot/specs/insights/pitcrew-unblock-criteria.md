# Pit Crew Unblock Criteria — Workspace Pilot

> **Story:** E3-S2  
> **Updated:** 2026-06-08

---

## Current Dependency

From `.jumpstart/state/workspace-state.json`:

```json
{
  "from": "proj-workspace-pilot",
  "to": "proj-default",
  "type": "phase_dependency",
  "blocked": true,
  "unblock_condition": "Phase 3"
}
```

---

## Pit Crew Outcome

Recorded in `workspace_resume_context.pit_crew_outcomes[]` and `last_pit_crew_review` via `recordPitCrewReview()`.

**Summary:** Block is expected. Pilot validation does not require unblocking to complete M3–M4.

---

## Unblock Criteria

| Criterion | Required for unblock |
|-----------|---------------------|
| `proj-default` Phase 3 approved | Yes — `architecture.md` gate approved |
| Pit Crew review documented | Yes — `last_pit_crew_review` non-null |
| Human explicit approval | Yes — operator sets `blocked: false` or runs approved unblock workflow |
| Pilot Phase 4 complete | No — not required for unblock |

---

## Operator Guidance When Blocked

When `canAdvanceProject('proj-workspace-pilot')` is called:

- `allowed`: `false`
- `pitCrewReview`: `true`
- `reason`: contains **"Pit Crew"**

SessionStart hook (`buildPitCrewBlock`) includes **`/jumpstart.pitcrew`** — verified in dogfood step "Pit Crew guard triggers for blocked dependency".

This is **guidance**, not an error bug. See [pitcrew-proj-default-dependency.md](pitcrew-proj-default-dependency.md).
