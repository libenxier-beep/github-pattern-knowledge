---
schema_version: 1
repository_id: github-pattern-knowledge
kind: owned-system
lifecycle: active
criticality: frequent
owner: liben+codex
last_reviewed: 2026-07-13
---

# GitHub Pattern Knowledge Repository Contract

## Purpose

This repository implements the local learning loop that discovers or ingests high-quality GitHub repositories, extracts traceable engineering patterns, validates them, and writes reusable knowledge for agents. Its primary users are programming agents, maintainers of the ingestion pipeline, and reviewers of evidence-backed pattern knowledge.

## Responsibilities

It owns discovery, scoring, commit-pinned ingestion, bounded extraction and review, the deterministic pattern harness, learned-repository registry writes after successful non-fixture runs, indexes, scheduling, the local dashboard, and deterministic tests. It does not own the generated Work Context as a repository, third-party source repositories, credentials, dependency caches, or automatic publication of private knowledge.

## Authority

Tracked source, tests, configuration, and maintained project documentation are canonical for the application. The accepted pattern layer written to the configured knowledge root is canonical in repository `work-contexts`; generated indexes and cards are projections, while commit-pinned snapshots, run records, and rejected drafts are evidence. `local-deps/` contains disposable third-party vendor clones, `.env.local` is private-local configuration, and build or dependency outputs are non-authoritative.

## Lifecycle

The repository is active and frequently used. `liben+codex` maintains it, with the latest governance review on 2026-07-13. Pipeline changes require tests, type checking, build validation, harness checks, and protection of the committed rule that only a successful non-fixture run with at least one accepted pattern may mark a repository learned.

## Relationships

| Type | Target | Required | Notes |
| --- | --- | --- | --- |
| upstream | https://github.com/libenxier-beep/github-pattern-knowledge.git | no | Configured `origin` and package metadata repository URL. |
| generation-target | work-contexts:github_engineering_patterns/ | yes | Default `KNOWLEDGE_ROOT` resolves to this Work Context; environment configuration may select another root. |
| operating-skill | codex-custom-skills:github-engineering-pattern-knowledge | no | Maintained skill package supplies the agent-facing runbook. |
| vendor-input | local-deps/* | no | Ignored third-party Git clones used as bounded local evidence; each retains its own upstream authority. |

## Branch Policy

`main` is the long-lived stable application line. `codex/*` branches are allowed for bounded pipeline, dashboard, knowledge-routing, and governance changes. Every active branch must have a contract under `docs/branches/`. Application source, generated knowledge, local vendor inputs, and repository governance must retain their separate authorities on every branch.

## Path Roles

| Path or Pattern | Role | Authority | Notes |
| --- | --- | --- | --- |
| `.editorconfig` | editor policy | canonical | Portable formatting defaults. |
| `.env.example` | configuration template | canonical | Documents supported environment variables without secrets. |
| `.env.local` | local secrets and overrides | private-local | Ignored local configuration; never commit. |
| `.github/` | collaboration and CI configuration | canonical | Workflows, issue templates, and dependency automation. |
| `.gitignore` | repository exclusion rules | canonical | Defines private, generated, cache, and vendor-local paths. |
| `.nvmrc` | Node runtime selection | canonical | Development runtime contract. |
| `CHANGELOG.md` | release history | evidence | Maintained record of externally relevant changes. |
| `CODE_OF_CONDUCT.md` | community policy | canonical | Participation expectations. |
| `CONTRIBUTING.md` | contribution workflow | canonical | Development and review entry point. |
| `LICENSE` | repository license | canonical | Public reuse terms. |
| `README.md` | project introduction | canonical | Human-facing purpose, workflow, and operating guidance. |
| `SECURITY.md` | security policy | canonical | Vulnerability reporting boundary. |
| `REPOSITORY.md` | repository governance contract | canonical | Durable ownership and lifecycle source. |
| `docs/` | maintained project and governance documentation | canonical | Includes architecture, verification, plans, and branch contracts. |
| `index.html` | dashboard entry document | canonical | Vite application entry point. |
| `package.json` | package and command contract | canonical | Scripts, engines, metadata, and dependency declarations. |
| `package-lock.json` | dependency lock | canonical | Reproducible npm dependency resolution. |
| `src/` | application source | canonical | Pipeline, CLI, scheduler, knowledge, and dashboard implementation. |
| `tests/` | behavior tests | canonical | Deterministic verification suite. |
| `tsconfig.json` | TypeScript configuration | canonical | Type-checking and build contract. |
| `vite.config.ts` | dashboard build configuration | canonical | Vite development and production configuration. |
| `vitest.config.ts` | test configuration | canonical | Vitest execution contract. |
| `dist/` | production build output | generated | Rebuild with `npm run build`; do not hand-edit. |
| `tsconfig.tsbuildinfo` | incremental compiler state | cache | Disposable TypeScript acceleration data. |
| `node_modules/` | installed dependencies | cache | Recreate from the lockfile; never source authority. |
| `local-deps/` | third-party source clones | vendor | Ignored upstream repositories used as local evidence inputs. |

## Operations

Use `npm test`, `npm run typecheck`, `npm run build`, and `npm run harness` before accepting pipeline changes. Use `EXTRACTOR_MODE=heuristic npm run daily -- --fixture` for deterministic end-to-end smoke coverage. In the committed daily and seed flows, `processRepoContext` may update the learned registry only after a non-fixture run succeeds with at least one harness-accepted pattern.

## Retirement

Retirement requires preserving accepted patterns and evidence in the authoritative Work Context, recording the disposition of unfinished run records and rejected drafts, removing or migrating scheduled execution and the operating skill, and deleting only reproducible build, dependency, and vendor-cache paths. Credentials and private-local configuration must be destroyed or migrated separately and never archived into public history.
