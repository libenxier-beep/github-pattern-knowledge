# Contributing

Thanks for helping improve GitHub Pattern Knowledge.

This project is most useful when it stays auditable: accepted knowledge should point back to concrete repositories, commits, and source files.

## Development Setup

```bash
git clone https://github.com/libenxier-beep/github-pattern-knowledge.git
cd github-pattern-knowledge
npm install
```

Recommended runtime:

- Node.js 22.12 or newer
- npm 10 or newer

Optional environment:

```bash
cp .env.example .env.local
```

Keep real tokens in `.env.local` or your shell environment. Never commit secrets or generated private knowledge data.

## Useful Commands

```bash
npm test
npm run typecheck
npm run build
EXTRACTOR_MODE=heuristic npm run daily -- --fixture
npm run harness
```

Use the fixture command for deterministic local smoke tests. Use real GitHub discovery only when you are intentionally exercising API behavior.

## Pull Request Checklist

Before opening a pull request:

- Keep the change focused.
- Add or update tests for behavior changes.
- Run `npm test`, `npm run typecheck`, and `npm run build`.
- Run `EXTRACTOR_MODE=heuristic npm run daily -- --fixture` when scheduler, ingestion, extraction, indexes, cards, or harness behavior changes.
- Run `npm run harness` when pattern-note shape, evidence, taxonomy, or generated knowledge behavior changes.
- Confirm `git status -sb` does not include secrets, `dist`, `node_modules`, `.env.local`, or private generated knowledge.

## Knowledge Quality Rules

Accepted pattern notes must be evidence-backed. Prefer fewer accepted patterns over broad claims with weak source support.

Good pattern notes include:

- a clear engineering problem
- use and avoid conditions
- boundary decisions and tradeoffs
- concrete failure modes
- source repo, URL, commit, and 2-4 reference files
- evidence table rows with actual functions, classes, tests, modules, or config keys

Do not treat daily cards as the source of truth. `patterns/` is the durable knowledge layer.

## LLM Boundary

LLMs may help with pattern extraction and review only from bounded evidence packs. Discovery, scoring, ingestion, source snapshots, harness validation, indexes, learned-repo archive writes, and dashboard reads should remain deterministic.

## Issue Reports

For bugs, include:

- command run
- expected behavior
- actual behavior
- relevant environment variables without secrets
- Node.js and npm versions

For feature requests, explain the agent workflow or knowledge-quality problem the feature would improve.
