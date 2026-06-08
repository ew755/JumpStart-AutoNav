# ADR-002: Headless Mock Analyst Extension for Multi-Workspace

> **Status:** Accepted  
> **Date:** 2026-06-08  
> **Decision Maker:** The Architect (Phase 3)

---

## Context

E4-S1 requires headless analyst to complete Phase 1 artifact creation in the multi-workspace scenario, not merely initialize the workspace. Current mock registry (`bin/lib/mock-responses.js`) returns `null` from `getCompletionResponse()`, causing the mock LLM provider to use generic defaults that exhaust the turn budget before writing `product-brief.md`.

Dogfood intentionally uses `--max-turns 3` for a **setup smoke test** only (PRD Stage 2 complete). Full completion is Should Have and must be proven in a dedicated test with a higher turn budget (8 turns).

The multi-workspace scenario seeds only `01-challenger/challenger-brief.md` into `proj-alpha/specs/`. Analyst must produce `product-brief.md` under the active nested project path.

## Decision

Add `createMultiWorkspaceAnalystRegistry()` to `mock-responses.js` that:

1. Extends `createPersonaRegistry('compliant-user')`
2. Implements `getCompletionResponse(messages)` returning structured assistant messages with `create_file` tool calls targeting the workspace-context-resolved specs path
3. Includes canned `product-brief.md` content matching Jump Start template minimum sections (personas, MVP scope, phase gate placeholders)

Wire headless-runner to use this registry when `--scenario multi-workspace` AND `--agent analyst` AND `--mock` are combined.

Add `tests/e2e/scenarios/multi-workspace/02-analyst/product-brief.md` as **reference fixture** for mock content (copied by scenario setup for tests that skip full headless run).

Dogfood script **unchanged** at `--max-turns 3`. New test `tests/test-headless-analyst-multi-workspace.test.js` validates completion at `--max-turns 8`.

## Consequences

### Positive

- E4-S1 independently testable in CI without live LLM API key
- Clear separation: dogfood = smoke, dedicated test = completion
- Reuses existing headless-workspace path routing — validates E2-S2 in e2e path

### Negative

- Mock completions are canned — do not prove live LLM behavior
- Scenario-specific registry adds branching in headless-runner init

### Neutral

- Live headless analyst remains available via `npm run emulate` without `--mock`

## Alternatives Considered

### Increase dogfood max-turns to 15

- **Pros:** Single command proves completion
- **Cons:** Violates NFR-P01 (< 30s); couples smoke + completion
- **Reason Rejected:** PRD distinguishes setup vs completion

### Add 02-analyst fixture only (no mock registry change)

- **Pros:** `copyPhaseArtifacts` would place brief without running analyst
- **Cons:** Does not test analyst agent loop or tool-bridge path
- **Reason Rejected:** Fails "headless analyst completes" intent

## References

- PRD E4-S1, product brief Should Have #1
- `tests/e2e/scenarios/multi-workspace/README.md`
- `lib/headless-workspace.js` — `copyPhaseArtifacts`
