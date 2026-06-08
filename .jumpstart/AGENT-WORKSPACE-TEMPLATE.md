# Agent: Workspace-Aware Template

Reference for integrating Jump Start multi-project workspace support into agent personas.

## Step 1: Input Context — Workspace Detection

```markdown
### Workspace Mode Detection

Before starting your protocol:

1. Check if `.jumpstart/projects.json` exists:
   - **If YES (workspace mode):** Load active project via `getWorkspaceContext()`
   - **If NO (single-project mode):** Use global `.jumpstart/config.yaml` and root `specs/`

2. If workspace mode:
   ```javascript
   const workspaceContext = require('../lib/workspace-context');
   const context = workspaceContext.getWorkspaceContext(process.cwd());
   ```
   - `context.mode` — `"multi-project"`, `"single-project"`, or `"workspace-no-active"`
   - `context.project` — Active project metadata (`project_id`, `name`, `projectPath`, …)
   - `context.config` — Scoped paths (`specs_path`, `src_path`, `tests_path`, `state_path`)
   - `context.state` — Project-scoped state (`current_phase`, `approved_artifacts`, …)

3. Use `context.config.specs_path` for all artifact paths in workspace mode.
```

SessionStart hook `.github/hooks/workspace-context.js` also injects active project paths into agent context automatically.

## Step 2: Load Upstream Artifacts

Pass the **full context object** (not `context.workspace`):

```javascript
const specLoader = require('../lib/spec-loader');

// Analyst (Phase 1) loads Phase 0 challenger brief:
const upstream = specLoader.loadUpstreamArtifact(context, 1);
if (!upstream.loaded) {
  throw new Error(`Cannot proceed: ${upstream.error}`);
}
const challengerBrief = upstream.spec.content;
```

| Agent phase | `loadUpstreamArtifact(context, phase)` |
|-------------|------------------------------------------|
| Analyst (1) | `1` → challenger-brief.md |
| PM (2)      | `2` → product-brief.md |
| Architect (3) | `3` → prd.md |
| Developer (4) | `4` → architecture.md |

## Step 3: Phase Gate Approval

```javascript
const phaseGateUpdater = require('../lib/phase-gate-updater');
const path = require('path');

const result = phaseGateUpdater.approvePhase(
  context,
  path.join(context.config.specs_path, 'product-brief.md'),
  'Eric'
);

if (result.unblocked_projects?.length > 0) {
  console.log(`Unblocked: ${result.unblocked_projects.join(', ')}`);
}
```

## Step 4: CLI Commands

```bash
jumpstart-mode workspace status
jumpstart-mode workspace upgrade          # migrate single-project → workspace
jumpstart-mode workspace set-active <id>
jumpstart-mode workspace validate-deps
jumpstart-mode workspace sync --audit
```

## Integration Checklist

- [ ] Workspace Mode Detection step in Input Context
- [ ] Upstream loads use full `context` + correct phase number
- [ ] Phase gate approval uses `approvePhase(context, specPath, approver)`
- [ ] Input Context artifact paths note workspace scoping
- [ ] Test single-project and multi-project layouts

## Code Locations

| Module | Path |
|--------|------|
| Context detection | `lib/workspace-context.js` |
| Spec loading | `lib/spec-loader.js` |
| Phase gate updates | `lib/phase-gate-updater.js` |
| Registry CLI | `bin/workspace.js` |
| SessionStart hook | `.github/hooks/workspace-context.js` |
