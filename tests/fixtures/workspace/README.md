# Workspace Test Fixtures

Stub layouts for validating single-project, migrated-root, and multi-project workspace modes.

| Fixture | Description |
|---------|-------------|
| `single-project/` | Classic Jump Start layout without `projects.json` |
| `migrated-root/` | Single project registered as `proj-default` at path `.` |
| `multi-project/` | Two projects under `projects/proj-alpha` and `projects/proj-beta` |

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
