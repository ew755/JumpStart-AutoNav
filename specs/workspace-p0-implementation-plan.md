# Workspace P0 Implementation Plan

**Status:** P0 complete, P1 complete, P2 complete  
**Updated:** 2026-06-08  
**Target:** Operational multi-project agent workflows

## Completed (P0)

- [x] Fix `checkUnblocks()` to read `workspace_resume_context.cross_project_dependencies`
- [x] Fix `approvePhase()` to use `context.project.projectPath`
- [x] Reconcile `active_project` / `active_project_id` on load (registry wins)
- [x] Persist project locks via `saveState()`
- [x] Write valid YAML from `createProject()`
- [x] SessionStart hook: `.github/hooks/workspace-context.js`
- [x] Phase gate status hook uses project-scoped artifact paths
- [x] Fix agent workspace API examples (Analyst, PM, Architect, Developer, Challenger, Facilitator)
- [x] Update `AGENT-WORKSPACE-TEMPLATE.md`
- [x] Tests: unblock flow, active pointer reconcile, workspace context hook
- [x] README + tests/README workspace sections

## Completed (P1)

- [x] Pre-agent sync hook — `.github/hooks/workspace-sync-guard.js` (SessionStart drift warnings)
- [x] `sync --push` backup — archives state to `.jumpstart/archive/workspace-sync/`; merges existing fields
- [x] `validateSync` test suite — registry_ahead, state_ahead, missing_state
- [x] CLI integration tests — `tests/test-workspace-cli.test.js`
- [x] `approvePhase` end-to-end test — verifies state file writes
- [x] `remove-project` command — `--confirm`, optional `--delete-files`
- [x] Headless runner multi-project — `tests/e2e/scenarios/multi-workspace/`, `lib/headless-workspace.js`
- [x] Schema validation at write — `lib/workspace-validator.js` wired into `saveConfig()` and migration

## P1 — Remaining

| Item | Priority | Notes |
|------|----------|-------|
| *(none — P1 complete)* | | |

## P1 — Next sprint (superseded — see Completed P1 above)

| Item | Priority | Notes |
|------|----------|-------|
| ~~Pre-agent sync hook (ADR-010)~~ | ~~High~~ | Done |
| ~~`sync --push` backup~~ | ~~High~~ | Done |
| ~~`validateSync` test suite~~ | ~~High~~ | Done |
| ~~CLI integration tests~~ | ~~Medium~~ | Done |
| ~~`approvePhase` end-to-end test~~ | ~~Medium~~ | Done |
| ~~`remove-project` command~~ | ~~Medium~~ | Done |

## Completed (P2 — ADR-012)

- [x] Parallel project mode — `lib/workspace-parallel.js`, capacity checks, pause/resume, `projects-in-flight`
- [x] Pit Crew gate — blocked cross-project dependencies block `canAdvance` / `lockProject`
- [x] Per-project cost governance — `lib/workspace-cost.js`, budget alerts, `budget` / `adjust-budget`, report `--cost-breakdown`
- [x] Cross-project ADR registry — `lib/workspace-adr-registry.js`, `scan-adrs`, `adr-index`, `adr-impacts`, `audit-adr-awareness`
- [x] Phase gate hook — ADR scan on architect (phase 3) approval
- [x] Knowledge graph — `lib/workspace-knowledge-graph.js`, `knowledge-graph`, `query-graph`, GraphViz export
- [x] Schema extensions — `max_concurrent_projects`, `cost_governance` on projects
- [x] Tests — `tests/test-workspace-p2.test.js` (14 tests)

## P2 — Remaining (future)

| Item | Priority | Notes |
|------|----------|-------|
| Full Neo4j-style graph queries | Low | MVP uses path-finding only |
| `workspace allocate-budget` | Low | Mentioned in ADR-012, not implemented |

## Hardening (2026-06-08)

- [x] Headless tool-bridge scoping — `lib/workspace-path-resolver.js` redirects root `specs/` writes
- [x] `loadProjectConfig()` YAML parse — returns `parsed`, `workflow`, `agents`
- [x] Pit Crew SessionStart hook — `.github/hooks/workspace-pitcrew-guard.js`
- [x] Live registry cleanup — `proj-workspace-pilot` `created_at` normalized
- [x] ADR-012 marked Accepted; `IMPLEMENTATION-COMPLETE.md` updated

## P2 — Phase 4 (ADR-012) — superseded by Completed P2 above

- ~~Parallel project mode with resource limits~~
- ~~Cross-workspace cost governance / token aggregation~~
- ~~Workspace ADR registry~~
- ~~Knowledge graph across projects~~
- Pit Crew cross-project review automation (partial — gate in `canAdvance`, full automation deferred)

- [x] Dogfood pass — `proj-workspace-pilot` Phase 0–4 complete, `npm run dogfood:workspace`, CI test
- [x] Pilot validation program — Pit Crew resume writer, mock analyst headless completion (E3-S2, E4-S1)
- [x] Dogfood non-destructive redirect probe — uses `dogfood-redirect-probe.md`, preserves approved artifacts

## Next track

| Item | Owner | Notes |
|------|-------|-------|
| `proj-default` Phase 0→3 | Eric | AutoNav product at repo root; unblocks pilot Pit Crew dependency when Phase 3 approved |
| Release notes | Morgan | Document workspace P0–P2 + pilot dogfood as validation evidence |

## Verification checklist

```bash
# Unit + integration
npx vitest run tests/test-workspace-*.test.js tests/test-headless-workspace.test.js tests/test-workspace-path-resolver.test.js tests/test-phase-gate-updater.test.js tests/test-hooks.test.js

# Headless multi-project smoke (mock, no API)
node bin/headless-runner.js --agent analyst --scenario multi-workspace --mock --dry-run

# Manual smoke
npm run dogfood:workspace
npx jumpstart-mode workspace status
npx jumpstart-mode workspace validate-deps
npx jumpstart-mode workspace sync --audit
```

## Architecture notes

- **Canonical active project:** `projects.json.active_project` (reconciled into `workspace-state.json` on load)
- **Context object:** Pass full `getWorkspaceContext()` result to spec-loader and phase-gate-updater — never `context.workspace` (boolean)
- **Upstream phases:** Analyst=1, PM=2, Architect=3, Developer=4
