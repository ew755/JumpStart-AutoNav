# Changelog

All notable changes to `jumpstart-mode` are documented in this file.

## [1.2.0] - 2026-06-08

Workspace product release (PRD Must Have epics E2–E5). Single-project installs remain unchanged until `jumpstart-mode workspace upgrade`.

### Epic E2 — Multi-project workspace CLI

- Workspace commands: `status`, `set-active`, `sync --audit/--pull`, `validate-deps`, `report`
- Active project spec scoping via `lib/workspace-context.js` and `lib/workspace-path-resolver.js`
- Registry/state sync with drift audit

### Epic E3 — Pit Crew and cross-project governance

- SessionStart Pit Crew guard (`workspace-pitcrew-guard.js`) for blocked dependencies
- `workspace pitcrew-record` CLI and `canAdvanceProject` gating
- Cross-project dependency validation with BLOCKED / satisfied markers

### Epic E4 — Adopter documentation

- README Multi-Project Workspace section aligned to PRD CLI surface
- `.jumpstart/MULTI_WORKSPACE.md` operator guide
- `specs/prd-traceability.md` Must Have story matrix

### Epic E5 — Release regression

- `npm run dogfood:workspace` and `dogfood:workspace:headless` release gates
- Workspace vitest suite (90+ tests) in CI
- Unified `jumpstart-mode approve` → `approvePhase()` (gate + registry sync + dependency unblock)

### Epic E6 — Hook catalog (docs)

- Must Have hook tier documented per ADR-015 (four governance surfaces vs full 26-hook catalog)

### Fixed

- Dogfood auto `set-active` / restore for root-track developers on `proj-default`
- `validate-deps` surfaces BLOCKED dependencies and unblock conditions
- `report --format json` parsing (space-separated form)
- JSON report includes `cross_project_dependencies`

[1.2.0]: https://github.com/compare/v1.1.13...v1.2.0
