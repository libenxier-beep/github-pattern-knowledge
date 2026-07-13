---
schema_version: 1
repository_id: github-pattern-knowledge
branch: main
status: long-lived
base: none
last_reviewed: 2026-07-13
---

# Branch Contract: main

## Purpose

Provide the stable application line for the GitHub engineering-pattern ingestion, validation, learned-repository registry, and local dashboard system.

## Allowed Scope

Tracked application source, tests, configuration, maintained documentation, dependency locks, collaboration policy, and repository governance documentation.

## Prohibited Scope

Credentials, ignored vendor clones, dependency or build output, generated Work Context artifacts, unrelated private knowledge, and bypasses around commit pinning, harness validation, or the successful-run learned-registry guard.

## Relationships

This is the default stable line. The application writes governed knowledge to repository `work-contexts` and is operated by a skill package in repository `codex-custom-skills`; both retain separate authority.

## Acceptance

Relevant tests, type checking, production build, and pattern harness pass; fixture smoke coverage remains deterministic; accepted patterns remain traceable to pinned evidence; failed and fixture runs do not mark repositories learned.

## Exit

This branch is long-lived. Supersede it only through an explicit default-branch migration that updates scheduled operation, the operating skill, knowledge-target configuration, learned-registry behavior, and all active branch contracts.
