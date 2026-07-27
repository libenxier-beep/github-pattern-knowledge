# Progress

## Current Contract

- Build a local TypeScript/Vite MVP under `$HOME/.codex/system-projects/github-pattern-knowledge`.
- Keep the authoritative knowledge under the GitHub Engineering Patterns Work Context.
- Separate bounded daily preparation from evidence-gated deep finalization.
- Prioritize schemas, tests, the value gate, registry/run integrity, and generated indexes over card UI.
- Support real GitHub discovery with clearly marked fixture fallback.
- Verify with tests, typecheck, build, preparation smoke, harness, and Work Context governance checks.

## Progress Update

- Project skeleton, package scripts, and tests were created.
- TDD red state was observed before implementation.
- Core harness, index, scoring, and daily fixture tests pass.
- Daily orchestration includes GitHub attempt, fallback fixture, scoring, source snapshot, and preparation receipt only.
- Deep finalization binds the run, repository, non-fixture flag, durable checkout receipt, Git origin/HEAD, source evidence, artifact provenance, and commit; requires the manifest and artifact to name the same distinct canonical evidence-file set, then validates complete transfer bridges and every accepted pattern through the canonical content harness before publication.
- Finalization shares the knowledge-root mutation lock with preparation, rejects conflicting replay, and rolls back published run/receipt state when the learned-registry write fails.
- Learned registry states are `accepted`, `legacy_unreviewed`, and `quarantined`; only accepted records block re-ingestion.
- Registry writes are lock-protected, explicitly mode `0644`, and atomically replaced; dead or stale incomplete local reclaim owners can be safely recovered without stealing live locks.
- Historical run locators, including nested batch results, are recursively validated by the harness; recognized locator fields fail closed on malformed scalar, array, or routed-record shapes.
- Local dashboard reads knowledge artifacts through a Vite local API.
- Replaced the original AI/agent-heavy eight repos with `git/git`, `curl/curl`, `nodejs/node`, `redis/redis`, `hashicorp/vault`, `envoyproxy/envoy`, `getsentry/sentry`, and `elastic/elasticsearch`.
- Added seed pool preparation and the status-aware learned repo registry. Daily runs process pending eligible seeds before open discovery.

## Decisions

- Project location: `$HOME/.codex/system-projects` because the tool code is Codex/Agent system tooling and the home directory is not assumed to be a Git repo.
- Knowledge location: `.codex/memories/work_contexts/github_engineering_patterns` because the extracted patterns are durable work-scene knowledge.
- Tech stack: TypeScript + Node.js + Vite React because the request prioritizes local CLI plus simple dashboard.
- Storage: Markdown source files plus generated JSON indexes.
- Preparation: no extractor and no active-knowledge mutation.
- Finalization: only a passing non-fixture deep dive may create accepted registry state.

## Risks

- GitHub public API can rate-limit unauthenticated runs.
- Deep-dive judgment can still over-abstract source-backed evidence; deterministic binding prevents fabricated provenance but cannot prove that every interpretation is good.
- Candidate artifacts are prepared before finalization, so failed finalization still requires explicit review of any staged file placement.
- Multi-file rollback covers ordinary failures; a process or machine crash between filesystem writes remains a journal/recovery concern rather than a cross-file transaction.
- The local dashboard is designed for development server usage; it is not a deployed app.

## Handoff

Run `npm run daily -- --fixture` for deterministic preparation smoke testing, then `npm run daily` for real GitHub discovery. Use `npm run finalize -- --manifest <absolute-path>` only after a source-complete non-fixture deep dive. Run `npm run harness` after any active-note, archive, locator, or registry migration.
