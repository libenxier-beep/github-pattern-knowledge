# Progress

## Round Contract

- Build a local TypeScript/Vite MVP under `$HOME/.codex/system-projects/github-pattern-knowledge`.
- Prioritize `knowledge/` schema, taxonomy, harness, and generated indexes over card UI.
- Support real GitHub discovery with clearly marked fixture fallback.
- Verify with tests, typecheck, build, daily run, and harness.

## Progress Update

- Project skeleton, package scripts, and tests were created.
- TDD red state was observed before implementation.
- Core harness, index, scoring, and daily fixture tests pass.
- Daily orchestration includes GitHub attempt, fallback fixture, source snapshot, extraction, harness, index, card, and run metadata.
- Local dashboard reads knowledge artifacts through a Vite local API.
- Replaced the original AI/agent-heavy eight repos with `git/git`, `curl/curl`, `nodejs/node`, `redis/redis`, `hashicorp/vault`, `envoyproxy/envoy`, `getsentry/sentry`, and `elastic/elasticsearch`.
- Added seed pool ingestion and learned repo registry. Daily runs now process pending seed repos before open discovery.

## Decisions

- Project location: `$HOME/.codex/system-projects` because the tool code is Codex/Agent system tooling and the home directory is not assumed to be a Git repo.
- Knowledge location: `.codex/memories/work_contexts/github_engineering_patterns` because the extracted patterns are durable work-scene knowledge.
- Tech stack: TypeScript + Node.js + Vite React because the request prioritizes local CLI plus simple dashboard.
- Storage: Markdown source files plus generated JSON indexes.
- Extractor: deterministic heuristic extractor first; LLM extractor reserved behind interface and prompt file.
- Seed ingestion: successful repos are recorded in `registry/learned_repos.json`; failed or rate-limited repos remain pending.

## Risks

- GitHub public API can rate-limit unauthenticated runs.
- Heuristic extraction is intentionally conservative and may miss subtle patterns without LLM support.
- The local dashboard is designed for development server usage; it is not a deployed app.

## Handoff

Run `npm run daily -- --fixture` for deterministic smoke testing, then `npm run daily` for real GitHub discovery. Use `npm run harness` after any manual note edits.
