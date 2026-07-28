---
schema_version: 1
repository_id: github-pattern-knowledge
branch: codex/automation-worktree-bootstrap
status: active
base: main
last_reviewed: 2026-07-28
---

# Branch Contract: codex/automation-worktree-bootstrap

## Purpose

Make automation preflight runnable from a fresh isolated checkout whose ignored dependency cache has not been deployed yet.

## Allowed Scope

The preflight bootstrap entry point, deployment-integrity contract, focused regression tests, and the canonical run and verification documentation.

## Prohibited Scope

Discovery, extraction, finalization, report quality, learned-registry behavior, Work Context artifacts, automation scheduling, recipients, or credentials.

## Acceptance

A checkout without `node_modules` installs exactly the locked dependencies before running the existing TypeScript preflight. Install failure remains a hard stop. Focused tests, the full suite, type checking, build, fixture smoke, and harness all pass.

## Exit

Merge into `main` only after the original empty-checkout failure is reproduced and then passes in a fresh detached checkout.
