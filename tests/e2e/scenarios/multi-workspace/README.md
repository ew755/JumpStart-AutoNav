# Multi-Workspace Scenario

Headless e2e scenario for **multi-project workspace** mode.

## Layout

This scenario uses a thin manifest plus shared fixture:

- `workspace-fixture.json` — points at `tests/fixtures/workspace/multi-project/`
- `01-challenger/challenger-brief.md` — copied into the active project's specs during setup

## Run

```bash
node bin/headless-runner.js --agent analyst --scenario multi-workspace --mock
```

The runner copies the two-project registry, sets active project to `proj-alpha`, and
routes phase artifacts to `projects/proj-alpha/specs/`.
