# Verification Checklist

- run `npm run automation-preflight` from the clean commit that the automation will execute
- repeat preflight from a fresh checkout with no `node_modules`; confirm it installs from `package-lock.json` before entering the TypeScript validator
- repeat preflight from an identified fresh worktree with both root variables unset; confirm it still reports the canonical Work Context roots, the authoritative registry counts, and the same next pending seed
- confirm an unidentified checkout with unset roots and a missing or inconsistent registry fails closed before `npm run daily`
- confirm the repository-owned independent-review schema passes its focused API-compatibility test

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run daily -- --fixture`
- `npm run harness`
- confirm fixture preparation writes a source snapshot and failed/preparation receipt only
- confirm fixture preparation leaves patterns, routed Work Contexts, cards, indexes, and learned registry unchanged
- run focused finalization tests when manifest, report, registry, ownership, or value-gate behavior changes
- confirm the positive report case satisfies `docs/human-report-quality-standard.md`: at least one important, non-obvious functional paradigm with a source-observed problem, design choice, causal mechanism, counterfactual importance, benefits, clever move, tradeoffs, authority boundary, and canonical alignment
- confirm a single strong paradigm can pass without filler units, forced Work Contexts, forced adjacent approaches, forced transfer targets, or prescribed headings
- confirm negative cases reject missing or malformed core paradigms, supporting implementation details promoted as defining paradigms, shallow reader receipts, source/transfer blur, and unpinned paradigm evidence
- confirm finalization rejects a missing/tampered checkout receipt, ignored/untracked or assume-unchanged evidence, same-file evidence aliases, artifact evidence that exceeds the manifest/Git HEAD, unbound or schema-invalid pattern artifacts, path aliases, and conflicting replay
- confirm a late registry failure restores the prior failed run and leaves no success/finalization receipt
- inspect `run_locator_integrity` in the harness result; every historical local locator must resolve and `parse_errors` plus `shape_errors` must both be empty
- inspect `knowledge_authority_integrity`; active pattern/card sources must be accepted, related ids must resolve to active or explicit routed artifacts, and accepted registry files must exist
- when the authoritative Work Context changes, also run its repository validator, lifecycle audit, and router behavior evaluation
