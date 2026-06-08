---
id: challenger-brief-workspace-pilot
phase: 0
agent: Challenger
status: Approved
created: 2026-06-08
updated: 2026-06-08
version: 1.0.0
approved_by: Eric
approval_date: 2026-06-08
---

# Challenger Brief — Workspace Pilot

## Problem Statement

Jump Start multi-project workspace infrastructure is implemented (P0–P2) but not validated against a real nested project driving Phase 0→1 with live registry, hooks, Pit Crew gates, and headless path scoping.

## Root Cause Analysis

- Framework work stayed at the repo root; no pilot project exercised nested `specs/` layout
- Cross-project dependency on `proj-default` (Phase 3) was never stress-tested with Pit Crew hook
- Headless runner path redirection was tested in fixtures only, not against this live workspace

## Validation Criteria

- [x] Approved challenger brief lives under `projects/proj-workspace-pilot/specs/`
- [x] Analyst produces `product-brief.md` in the same directory (not workspace root)
- [x] `workspace sync --audit` reports no drift after phase advancement
- [x] Pit Crew guard injects when `proj-workspace-pilot` is active and dependency is blocked

## Phase Gate Approval

- [x] Problem statement exists
- [x] Root causes identified
- [x] Validation criteria defined

**Approved by:** Eric  
**Approval date:** 2026-06-08
