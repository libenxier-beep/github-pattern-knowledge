# GitHub Engineering Pattern Knowledge

Local MVP for discovering high-quality GitHub repositories, extracting transferable software engineering patterns, and writing them into a Markdown-first work-context knowledge base for Codex and programming agents.

The human-facing daily card is a secondary output. The durable asset is `knowledge/patterns/`: one traceable engineering pattern per Markdown note, validated by a harness before it enters the accepted knowledge base.

## Tech Stack

- TypeScript + Node.js for the CLI, GitHub ingestion, harness, scoring, and file-backed knowledge pipeline.
- Vite + React for the local dashboard.
- GitHub REST API through `fetch`, with optional `GITHUB_TOKEN`.
- YAML frontmatter through `yaml`.
- JSON indexes generated from Markdown notes.
- Vitest for the core behavior tests.

This project is designed as a local Codex system-tool project. A typical checkout can live under `$HOME/.codex/system-projects/github-pattern-knowledge`, matching the local convention for Codex and agent-system tooling.

The generated knowledge base lives under `$HOME/.codex/memories/work_contexts/github_engineering_patterns` by default when run from the Codex system-projects location, because it is durable work-scene knowledge. Set `KNOWLEDGE_ROOT=/some/path` to override this for tests or migration.

## Knowledge Layout

```txt
$HOME/.codex/memories/work_contexts/github_engineering_patterns/
  README.md           work-context entry and routing guidance
  patterns/          accepted pattern notes, one pattern per Markdown file
  indexes/           generated retrieval indexes
  cards/             daily human-facing design cards
  rejected/          failed pattern/card drafts plus failure metadata
  sources/           lightweight source snapshots for each run
  schemas/           schemas, taxonomy, retrieval strategy
  runs/              daily run metadata and failed run records
```

`patterns/` is the source of truth. `indexes/` is generated cache.

## Pattern Note Standard

Every accepted pattern note is Markdown with YAML frontmatter. Required frontmatter includes:

- `id`, `name`, `summary`
- `engineering_problems`, `project_types`, `pattern_types`
- `complexity`, `quality_score`
- `source_repos[].repo`, `source_repos[].url`, concrete `source_repos[].commit`, and 2-4 `source_repos[].reference_files`
- `use_when`, `avoid_when`, `tradeoffs`, `transfer_targets`
- `created_at`, `updated_at`, `run_id`

Every body must include:

- `Engineering Problem`
- `Core Judgment`
- `Use When`
- `Avoid When`
- `Design Forces`
- `Boundary Decisions`
- `Failure Modes`
- `Simpler Alternatives`
- `Transfer Guidance`
- `Implementation Hint`
- `Evidence Table`
- `Source Evidence`

The evidence path is deliberately stricter than a normal summary. `Evidence Table` must list each reference file, the observed structure in that file, concrete functions/classes/tests/modules/config keys, and why that evidence supports the pattern. `Source Evidence` must name the repo and concrete commit so an agent can reopen the stored snapshot before applying the pattern.

Source snapshots are commit-pinned. After ingestion resolves the default-branch commit SHA, tree, README, and selected file contents are fetched with that commit SHA as the ref rather than with the moving branch name.

## Taxonomy

The first taxonomy lives in `knowledge/schemas/taxonomy.json` and covers:

- engineering problems: configuration, plugin extension, command routing, workflow orchestration, testing strategy, persistence, security boundaries, and related engineering concerns
- project types: CLI tools, web apps, libraries, frameworks, devtools, agent workflows, automation tools, and infrastructure tools
- pattern types: registry, adapter, pipeline, command router, lifecycle hooks, plugin system, schema validation, task graph, file-based store, capability boundary
- transfer targets: Codex skill systems, local automation tools, workflow engines, repo auditors, developer dashboards, CLI assistants, testing harnesses

Agent retrieval guidance is in `knowledge/schemas/retrieval_strategy.md`.

## Setup

```bash
npm install
```

Optional GitHub token:

```bash
export GITHUB_TOKEN=your_github_token_here
```

Without a token, the tool uses unauthenticated GitHub REST API limits. If GitHub discovery or ingestion fails, `npm run daily` falls back to a clearly marked fixture run.

Optional LLM extraction:

```bash
export OPENAI_API_KEY=your_openai_api_key_here
export EXTRACTOR_MODE=auto        # auto | heuristic | llm
export OPENAI_MODEL=gpt-5.5
export OPENAI_REASONING_EFFORT=medium
export LLM_REVIEW=1
```

`EXTRACTOR_MODE=auto` is the default. In auto mode, the pipeline uses `LLMExtractor` only when `OPENAI_API_KEY` is present; otherwise it uses the deterministic heuristic extractor. Explicit `EXTRACTOR_MODE=llm` requires `OPENAI_API_KEY`. LLM requests use the Responses API with structured outputs and `store: false`.

## Commands

```bash
npm run daily
npm run seed -- --list
npm run seed -- --limit 3
npm run daily -- --fixture
npm run evidence
npm run index
npm run harness
npm run dev
npm run typecheck
npm test
npm run build
```

`npm run daily` performs the full loop. It now prioritizes pending repos in the seed pool before falling back to open GitHub discovery:

1. discover candidate GitHub repositories
2. score candidates with `engineering_quality` 50%, `long_term_impact` 30%, `recent_heat` 20%
3. select one repo
4. ingest README, metadata, tree summary, and selected key files
5. write a source snapshot
6. extract 1-3 pattern drafts with the heuristic extractor
7. run evidence and source-traceability checks in the harness
8. write accepted pattern notes
9. write rejected drafts with failure reasons
10. regenerate all indexes
11. generate a daily card
12. write run metadata

`npm run seed -- --list` shows the pending seed repos.

`npm run seed -- --limit 3` processes up to three pending seed repos. Successful repos are recorded in `registry/learned_repos.json`; failed repos stay pending and are not skipped later.

The current seed pool lives in `registry/seed_repos.json` and contains the user-provided 60-repo list. The learned registry prevents daily discovery and seed ingestion from re-learning repos that already produced accepted pattern notes.

`npm run evidence` upgrades existing pattern notes from stored source snapshots. It resolves missing commits when possible, rewrites `Evidence Table`, tightens `Source Evidence`, and keeps old pattern notes from passing only because their Markdown shape is correct.

## Indexes

`npm run index` regenerates:

- `knowledge/indexes/index.json`
- `knowledge/indexes/by_engineering_problem.json`
- `knowledge/indexes/by_project_type.json`
- `knowledge/indexes/by_pattern_type.json`
- `knowledge/indexes/by_complexity.json`
- `knowledge/indexes/by_transfer_target.json`
- `knowledge/indexes/by_source_repo.json`

## Harness

```bash
npm run harness
npm run harness -- knowledge/patterns/pattern-plugin-system-capability-lifecycle-registry.md
```

The harness checks frontmatter completeness, taxonomy values, filename/id consistency, required sections, source repo traceability, concrete commit refs, 2-4 reference files, evidence-table rows for each file, content specificity, and generic banned phrases.

Accepted drafts enter `knowledge/patterns/`. Failed drafts go to `knowledge/rejected/patterns/` with JSON failure metadata.

## Local Dashboard

```bash
npm run dev
```

Open the Vite URL shown in the terminal. The dashboard reads local knowledge files through a Vite-only local API and shows:

- today card
- pattern notes from `index.json`
- index axes
- run metadata
- rejected entries and failure reasons

## Codex Skill

The reusable Codex skill for operating this project is published at:

https://github.com/libenxier-beep/codex-skills/tree/main/skills/github-engineering-pattern-knowledge

See `docs/skill-reference.md` for how this repository references the skill. Use the skill when running seed ingestion, daily learning, archive checks, retrieval-tag maintenance, progressive-disclosure updates, or harness/dashboard validation.

## Extractors

The extraction layer includes:

- `HeuristicExtractor`: deterministic fallback that uses repo metadata, tree paths, README, selected files, docs/tests/examples signals, concrete reference files, and evidence tables.
- `LLMExtractor`: evidence-first OpenAI Responses API extractor for semantic pattern judgment.
- LLM reviewer pass: accepts or rejects LLM drafts before deterministic harness validation.
- `PatternExtractor` interface plus `createExtractor()` factory: keeps daily orchestration independent from the extractor choice.
- `src/extraction/prompts/pattern_extraction.md` and `src/extraction/prompts/pattern_review.md`: prompt contracts.

No API key is hardcoded. Repo discovery, scoring, commit-pinned ingestion, source snapshots, harness validation, indexing, archive writes, and dashboard reads remain deterministic.

## Current Limits

- No vector database, graph database, or complex RAG.
- No cloud deployment or multi-user workflow.
- No deep local repo clone analysis.
- Recent heat approximates activity through push/update/release/issue signals, not star velocity.
- LLM extraction quality still depends on selected source evidence; weak evidence should produce fewer accepted patterns, not more confident prose.
- GitHub unauthenticated runs can hit rate limits; fixture fallback keeps the local loop testable.

## Extension Points

- SQLite index cache
- semantic retrieval
- human feedback and pattern merge/dedupe
- stricter harness scoring
- issue/PR deep analysis
- repo clone parser
- LLM-assisted merge/dedupe and historical pattern review
- periodic knowledge-base refactoring
