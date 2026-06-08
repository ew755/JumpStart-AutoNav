# Workspace Test Fixtures

Stub layouts for validating single-project, migrated-root, and multi-project workspace modes.

| Fixture | Description |
|---------|-------------|
| `single-project/` | Classic Jump Start layout without `projects.json` |
| `migrated-root/` | Single project registered as `proj-default` at path `.` |
| `multi-project/` | Two projects under `projects/proj-alpha` and `projects/proj-beta` |

## Layout scenarios (automated)

| Scenario | Layout | Test file |
|----------|--------|-----------|
| **A — Monorepo** | `projects/{id}/` inside one git repo | `tests/test-workspace-layout-scenarios.test.js` |
| **B — Multi-repo hub** | Hub repo + sibling checkouts via `../frontend` paths | same |

```bash
# Unit/integration tests (13 cases)
npm run test:workspace-layouts

# CLI smoke (temp dirs, both scenarios)
npm run smoke:workspace-layouts
```

Scenario B confirms: spec loading, path redirect, validate-deps, Pit Crew guard, sync pull, and approvePhase all work when project paths leave the hub root. IDE hooks are not exercised here (Copilot-only).

Register siblings via CLI:

```bash
npx jumpstart-mode workspace link-sibling --id=proj-frontend --name=Frontend --path=../frontend --init --set-active
```

## Regenerate

```bash
node tests/fixtures/workspace/generate-fixtures.mjs
```

## Manual smoke test

```bash
# Single-project → workspace migration
cd tests/fixtures/workspace/single-project
node ../../../../bin/cli.js workspace upgrade
node ../../../../bin/cli.js workspace status

# Multi-project workspace
cd ../multi-project
node ../../../../bin/cli.js workspace status
node ../../../../bin/cli.js workspace set-active proj-beta
node ../../../../bin/cli.js workspace validate-deps
```

## Automated tests

```bash
npx vitest run tests/test-workspace-*.test.js
```
