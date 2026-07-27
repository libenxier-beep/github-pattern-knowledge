---
schema_version: 1
repository_id: github-pattern-knowledge
kind: owned-system
lifecycle: active
criticality: frequent
owner: liben+codex
last_reviewed: 2026-07-26
---

# GitHub Pattern Knowledge Repository Contract

## Purpose

This repository implements a two-phase local learning system: bounded GitHub discovery/preparation followed by commit-bound, evidence-gated deep finalization. Its primary users are programming agents, maintainers of the pipeline, and reviewers of reusable pattern knowledge.

## Responsibilities

It owns discovery, scoring, commit-pinned ingestion, source preparation, finalization gates, the deterministic pattern and locator harnesses, status-aware learned-repository registry writes after successful non-fixture deep finalization, indexes, scheduling, the local dashboard, and deterministic tests. Daily and seed preparation do not publish active knowledge. The repository does not own the generated Work Context as a repository, third-party source repositories, credentials, dependency caches, or automatic publication of private knowledge.

## Authority

Tracked source, tests, configuration, and maintained project documentation are canonical for the application. The accepted pattern layer written to the configured knowledge root is canonical in repository `work-contexts`; generated indexes and cards are projections, while commit-pinned snapshots, run records, and rejected drafts are evidence. `local-deps/` contains disposable third-party vendor clones, `.env.local` is private-local configuration, and build or dependency outputs are non-authoritative.

## Lifecycle

The repository is active and frequently used. `liben+codex` maintains it, with the latest governance review on 2026-07-26. Pipeline changes require tests, type checking, build validation, harness checks, and protection of the committed rule that only a source-bound non-fixture deep finalization with at least one important, non-obvious, evidence-backed core functional paradigm may mark a repository learned. Every declared paradigm must explain its problem, design choice, mechanism, counterfactual importance, benefits, clever move, tradeoffs, authority boundary, and canonical accepted loop. Supporting mechanisms cannot substitute for the project's defining capabilities, and artifact or Work Context counts are not quality proxies.

## Relationships

| Type | Target | Required | Notes |
| --- | --- | --- | --- |
| upstream | https://github.com/libenxier-beep/github-pattern-knowledge.git | no | Configured `origin` and package metadata repository URL. |
| generation-target | work-contexts:github_engineering_patterns/ | yes | Default `KNOWLEDGE_ROOT` resolves to this Work Context; environment configuration may select another root. |
| discovery-adapter | codex-custom-skills:github-engineering-pattern-knowledge | no | Optional thin skill routes manual requests here; repository docs and code own the workflow. |
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

Use `docs/daily-workflow.md` for the canonical real-run sequence. Use `npm test`, `npm run typecheck`, `npm run build`, and `npm run harness` before accepting pipeline changes. Use `npm run daily -- --fixture` for deterministic preparation smoke coverage. `processRepoContext` writes only a source snapshot and preparation receipt; only `finalizeDeepDive` may publish success metadata and update the learned registry after all source, uniqueness, ownership, evidence, transfer, score, artifact, and report gates pass.

## Retirement

Retirement requires preserving accepted patterns and evidence in the authoritative Work Context, recording the disposition of unfinished run records and rejected drafts, removing or migrating scheduled execution and the operating skill, and deleting only reproducible build, dependency, and vendor-cache paths. Credentials and private-local configuration must be destroyed or migrated separately and never archived into public history.
