# Migration Guide: Single-Project → Multi-Workspace

**Time to complete:** 10–30 minutes  
**Prerequisites:** Existing Jump Start project

## Overview

This guide walks you through converting an existing single-project Jump Start workspace into a multi-project workspace while preserving all existing artifacts and state.

## Before You Start

- [ ] Backup your `.jumpstart/` folder
- [ ] Backup your `specs/`, `src/`, `tests/` folders
- [ ] Commit current work to git
- [ ] Ensure you're on the latest Jump Start version: `npm install jumpstart-mode@latest`

## Migration Path A: Minimal (Recommended for 1→2 Projects)

### What Happens

- Project stays in **root** (no folder restructuring)
- Created as `proj-default` in projects registry
- All existing paths unchanged
- `.jumpstart/projects.json` created automatically

### Steps

1. **Backup current state:**
   ```bash
   git add .
   git commit -m "Pre-multi-workspace backup"
   ```

2. **Initialize workspace mode:**
   ```bash
   jumpstart-mode workspace status
   ```
   
   **Output:**
   ```
   📊 Workspace Status
   
   Workspace ID: dev-workspace-001
   Total Projects: 1
   Active Project: proj-default
   
   Projects:
   ▶️   [initializing] proj-default — Your Project
        Path: .
   ```

3. **Verify projects.json was created:**
   ```bash
   cat .jumpstart/projects.json
   ```

4. **Done!** Continue working as before:
   ```bash
   jumpstart-mode challenge "Next feature..."
   ```

**When to use this path:**
- You're adding just 1–2 more projects
- Your project is already mature (past Phase 2)
- You want minimal disruption

---

## Migration Path B: Structured (Recommended for 3+ Projects)

### What Happens

- Project moved into `projects/` subfolder
- Clean separation: shared assets (workspace) vs. project-specific
- Better organization for growing workspaces
- Slightly more setup

### Steps

1. **Backup:**
   ```bash
   git add .
   git commit -m "Pre-migration backup"
   ```

2. **Create project folder:**
   ```bash
   mkdir -p projects/my-project
   ```

3. **Move project artifacts:**
   ```bash
   # Move core folders
   mv specs projects/my-project/
   mv src projects/my-project/
   mv tests projects/my-project/
   
   # Move project-specific .jumpstart/config.yaml
   mkdir -p projects/my-project/.jumpstart
   mv .jumpstart/config.yaml projects/my-project/.jumpstart/
   ```

4. **Leave workspace-level assets in place:**
   ```bash
   # These stay in root/.jumpstart/
   # - agents/
   # - templates/
   # - skills/
   # - schemas/
   # (and all other workspace-shared files)
   ```

5. **Update projects.json:**
   ```bash
   # Edit .jumpstart/projects.json
   # Change path from "." to "projects/my-project"
   ```

   **Before:**
   ```json
   {
     "projects": [
       { "id": "proj-default", "path": ".", "config_path": ".jumpstart/config.yaml" }
     ]
   }
   ```

   **After:**
   ```json
   {
     "projects": [
       { 
         "id": "proj-my-project", 
         "path": "projects/my-project", 
         "config_path": "projects/my-project/.jumpstart/config.yaml",
         "name": "My Project"
       }
     ]
   }
   ```

6. **Verify structure:**
   ```bash
   tree -L 3
   ```

   **Expected output:**
   ```
   .
   ├── .jumpstart/
   │   ├── agents/
   │   ├── templates/
   │   ├── skills/
   │   ├── projects.json          # NEW
   │   ├── state/
   │   │   ├── workspace-state.json # NEW
   │   │   ├── state.json         # MOVED (now in projects/my-project)
   │   │   └── ...
   │   └── ...
   ├── projects/
   │   └── my-project/
   │       ├── .jumpstart/
   │       │   ├── config.yaml
   │       │   └── state/        # Project state goes here
   │       ├── specs/
   │       ├── src/
   │       └── tests/
   └── README.md
   ```

7. **Move project state:**
   ```bash
   # Create project state directory
   mkdir -p projects/my-project/.jumpstart/state
   
   # Move state files
   mv .jumpstart/state/state.json projects/my-project/.jumpstart/state/
   mv .jumpstart/state/timeline.json projects/my-project/.jumpstart/state/
   mv .jumpstart/state/usage-log.json projects/my-project/.jumpstart/state/
   mv .jumpstart/state/todos.json projects/my-project/.jumpstart/state/
   mv .jumpstart/state/adr-index.json projects/my-project/.jumpstart/state/
   ```

8. **Create workspace state:**
   ```bash
   # Create .jumpstart/state/workspace-state.json
   cat > .jumpstart/state/workspace-state.json << 'EOF'
   {
     "version": "1.0.0",
     "active_project_id": "proj-my-project",
     "workspace_resume_context": {
       "tldr": "Migrated from single-project workspace",
       "cross_project_dependencies": [],
       "workspace_token_budget": 500000,
       "workspace_tokens_used": 0
     },
     "project_locks": {},
     "last_updated": null
   }
   EOF
   ```

9. **Verify workspace:**
   ```bash
   jumpstart-mode workspace status
   ```

10. **Test:**
    ```bash
    jumpstart-mode workspace active
    jumpstart-mode workspace set-active proj-my-project
    ```

11. **Commit:**
    ```bash
    git add .
    git commit -m "Migrate to multi-workspace structure"
    ```

**When to use this path:**
- You're planning 3+ projects
- You want clean organization
- You're OK with restructuring

---

## Rollback Instructions

If something goes wrong:

### Rollback to Backup (All Paths)

```bash
# Restore from git
git reset --hard HEAD~1

# Or restore from backup (if outside git)
rsync -av /path/to/backup/ .
```

### Quick Disable (Keep Structure)

```bash
# Temporarily disable multi-workspace
mv .jumpstart/projects.json .jumpstart/projects.json.bak

# Jump Start reverts to single-project mode
# Restore whenever ready:
mv .jumpstart/projects.json.bak .jumpstart/projects.json
```

---

## Verification Checklist

After migration:

- [ ] `jumpstart-mode workspace status` shows all projects
- [ ] `jumpstart-mode workspace active` shows correct active project
- [ ] `jumpstart-mode workspace validate-deps` reports no errors
- [ ] All `specs/`, `src/`, `tests/` files are intact
- [ ] Existing artifacts (PRD, architecture.md, etc.) are readable
- [ ] Phase state loads correctly: `cat .jumpstart/state/state.json` (or project-specific version)
- [ ] Test running a phase agent: `jumpstart-mode challenge "Test message"`

---

## Token Usage After Migration

Old location (single-project):
```
.jumpstart/usage-log.json → moved to projects/{id}/.jumpstart/state/usage-log.json
```

New workspace aggregate:
```
.jumpstart/usage-log.json (NEW) — workspace-level view
```

**Scripts that read token usage** must update:

```bash
# Old
jq .total .jumpstart/usage-log.json

# New (project-specific)
jq .total projects/my-project/.jumpstart/state/usage-log.json

# New (workspace aggregate)
jq .aggregation.total_workspace_tokens .jumpstart/usage-log.json
```

---

## Add More Projects

Once migrated:

```bash
# Create second project
jumpstart-mode workspace create-project \
  --id proj-new-feature \
  --name "New Feature" \
  --type greenfield

# Switch and work
jumpstart-mode workspace set-active proj-new-feature
jumpstart-mode challenge "..."
```

---

## Troubleshooting

**Problem:** "Projects.json not found"

**Solution:**
```bash
# Manually create it
cat > .jumpstart/projects.json << 'EOF'
{
  "workspace": { "id": "workspace-001", "enabled": true },
  "projects": [
    { 
      "id": "proj-default", 
      "name": "My Project", 
      "path": ".", 
      "status": "phase-X", 
      "config_path": ".jumpstart/config.yaml"
    }
  ],
  "active_project": "proj-default"
}
EOF
```

**Problem:** "State files are in wrong location"

**Solution:**
```bash
# Check current state location
ls -la .jumpstart/state/

# If files are in root .jumpstart/state/:
# Create project directory
mkdir -p projects/my-project/.jumpstart/state

# Move files
mv .jumpstart/state/state.json projects/my-project/.jumpstart/state/
mv .jumpstart/state/timeline.json projects/my-project/.jumpstart/state/
# etc.
```

**Problem:** "Agent can't find project config"

**Solution:**
```bash
# Verify projects.json config_path is correct
cat .jumpstart/projects.json | jq '.projects[].config_path'

# Verify file exists
ls -la projects/my-project/.jumpstart/config.yaml

# Update projects.json if path is wrong
```

---

## Questions?

- Refer to [MULTI_WORKSPACE.md](./MULTI_WORKSPACE.md) for architecture
- Check [MULTI_WORKSPACE_SETUP.md](./MULTI_WORKSPACE_SETUP.md) for reference workflows
- See [ADR-009](./decisions/ADR-009-multi-workspace.md) for design decisions

**Next steps:** Add a second project and set up cross-project dependency tracking.
