# Workspace P0 Implementation Plan

**Status:** In progress  
**Updated:** 2026-06-06  
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

## P1 — Next sprint

| Item | Priority | Notes |
|------|----------|-------|
| Pre-agent sync hook (ADR-010) | High | Block or warn when registry/state drift detected |
| `sync --push` backup | High | Archive state before destructive push |
| `validateSync` test suite | High | All three drift directions |
| CLI integration tests | Medium | `bin/workspace.js` routing and exit codes |
| `approvePhase` end-to-end test | Medium | Verify state file writes |
| Headless runner multi-project | Medium | Scenario with `projects.json` |
| `remove-project` command | Medium | Documented but missing |
| Schema validation at write | Low | Validate `projects.json` against schema |

## P2 — Phase 4 (ADR-012)

- Parallel project mode with resource limits
- Cross-workspace cost governance / token aggregation
- Workspace ADR registry
- Knowledge graph across projects
- Pit Crew cross-project review automation

## Verification checklist

```bash
# Unit + integration
npx vitest run tests/test-workspace-*.test.js tests/test-phase-gate-updater.test.js tests/test-hooks.test.js

# Manual smoke
npx jumpstart-mode workspace status
npx jumpstart-mode workspace validate-deps
npx jumpstart-mode workspace sync --audit
```

## Architecture notes

- **Canonical active project:** `projects.json.active_project` (reconciled into `workspace-state.json` on load)
- **Context object:** Pass full `getWorkspaceContext()` result to spec-loader and phase-gate-updater — never `context.workspace` (boolean)
- **Upstream phases:** Analyst=1, PM=2, Architect=3, Developer=4
