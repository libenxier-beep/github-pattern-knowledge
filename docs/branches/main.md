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

Provide the stable application line for the GitHub engineering-pattern ingestion, validation, finalization, and local dashboard system.

## Allowed Scope

Tracked application source, tests, configuration, maintained documentation, dependency locks, collaboration policy, and repository governance documentation.

## Prohibited Scope

Credentials, ignored vendor clones, dependency or build output, generated Work Context artifacts, unrelated private knowledge, and bypasses around commit pinning or the finalization value gate.

## Relationships

This is the default stable line. The application writes governed knowledge to repository `work-contexts` and is operated by a skill package in repository `codex-custom-skills`; both retain separate authority.

## Acceptance

Relevant tests, type checking, production build, and pattern harness pass; fixture smoke coverage remains deterministic; accepted patterns remain traceable to pinned evidence; only finalization can update learned state.

## Exit

This branch is long-lived. Supersede it only through an explicit default-branch migration that updates scheduled operation, the operating skill, knowledge-target configuration, and all active branch contracts.
