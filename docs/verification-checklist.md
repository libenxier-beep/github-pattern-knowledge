# Verification Checklist

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run daily -- --fixture`
- `npm run harness`
- `EXTRACTOR_MODE=heuristic npm run daily -- --fixture` for deterministic local smoke tests
- `EXTRACTOR_MODE=llm npm run seed -- --repos owner/name` only when `OPENAI_API_KEY` is intentionally available
- inspect generated `knowledge/runs/*.json`
- inspect generated `knowledge/indexes/index.json`
- inspect generated card in `knowledge/cards/`
