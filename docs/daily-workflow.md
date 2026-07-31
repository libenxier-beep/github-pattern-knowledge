# Daily Learning Workflow

This document is the canonical operating rule for one real GitHub Pattern Knowledge learning run. The automation and the optional Codex skill are callers; neither owns a second copy of this workflow.

## Authority Map

| Concern | Authority |
| --- | --- |
| Repository ownership and lifecycle | `REPOSITORY.md` |
| Run order, handoffs, and stop behavior | this document |
| Candidate lanes, exclusions, and deterministic ranking | `src/discovery/selectionPolicy.ts`, `src/discovery/discoverRepos.ts`, and `src/scoring/scoreRepo.ts` |
| Human-report reasoning and readability | `docs/human-report-quality-standard.md` |
| Independent source-judgment response contract | `schemas/independent-source-judgment.schema.json` |
| Manifest shape and value gates | `src/deepDive/valueFunction.ts` |
| Report mechanical gates | `src/deepDive/reportReadability.ts` |
| Publication, provenance, and registry mutation | `src/scheduler/finalizeDeepDive.ts` |
| Failed-finalization repair classification and immutable tooling authority | `src/scheduler/finalizationRepairPolicy.ts` |
| Regression behavior | `tests/` and `src/harness/` |
| Pending-seed progress | `registry/learned_repos.json` compared with `registry/seed_repos.json` |
| Reader preferences and latest-run projection | bounded automation memory; advisory only |
| Schedule, recipient, and delivery credentials | the calling automation |

When prose and executable validation disagree, stop the run and repair the repository contract. Do not weaken an executable gate from inside a learning run.

## Public Run Contract

A caller asks for exactly one bounded run. The workflow returns either:

- a finalized, verified run plus its complete human report; or
- an explicit failure containing the failed stage, exact error, retained artifacts, and most likely repair.

Preparation, review drafts, and routed drafts are not learned knowledge. Only successful `finalize` may mark a repository accepted.

## Workflow

### 1. Preflight

- Use a clean isolated checkout of this tool repository.
- Run `npm run --silent automation-preflight` from that checkout before reading or executing the remaining workflow. Stdout must contain exactly one JSON readiness result; dependency-bootstrap and install diagnostics belong on stderr. This command owns lockfile-based dependency bootstrap for a fresh checkout, with package lifecycle scripts disabled, then enters the tracked readiness validator. In one result it verifies the clean tool commit, canonical roots and registries, read/write authority, authenticated GitHub capability, Feishu bot identity, pending-seed selection, unfinished runs, and interrupted publication recovery. Stop on any readiness error.
- Read `REPOSITORY.md`, this document, and the human-report quality standard.
- Inspect bounded automation memory only for reader preferences and a human-readable latest-run projection. Never compare its “next seed” wording with the registry or use it to select, skip, or block a repository; the registries are the sole progress authority.
- Do not edit the pipeline, automation, skills, or memory during the scheduled run.
- Treat the current checkout and commit as the only tool authority. Never read a sibling working tree, copy uncommitted workflow files, or create a synthetic commit from another dirty checkout to satisfy a missing interface.
- The short knowledge-root lock serializes individual mutations. A durable whole-run lease then owns the interval from real preparation through finalization. A second run must resume or explicitly abort the first; the next scheduled preflight deterministically recovers expired leases and interrupted publication journals.

### 2. Prepare once

Run `npm run daily` exactly once. It prefers pending seeds and skips only repositories already accepted by the learned registry. This phase selects a repository, pins a commit, and writes source evidence plus a preparation receipt. It must not publish canonical knowledge.

Stop if discovery or preparation fails. Never substitute a fixture, heuristic extraction, an old review draft, or a previously routed draft and call the run learned.

### 3. Establish source identity

Clone or refresh the selected repository under the run's local dependency area. Verify the exact origin, detached commit, clean worktree, and tracked-file inventory. Persist the checkout receipt required by finalization. Every tracked file must be classified before source judgment begins.

### 4. Reconstruct the project before extracting lessons

Inspect production code, degraded-path tests, examples, configuration, CI, and maintained documentation by subsystem and runtime responsibility. Derive architecture from observed behavior and relationships, not filenames or repository reputation.

First identify the important, non-obvious functional paradigms that create the project's defining value. For each, establish the observable problem, design choice, causal mechanism, counterfactual importance, benefits, clever move, tradeoffs, authority boundary, and canonical evidence-backed loop. Explain adjacent approaches only when they clarify why the choice matters or how responsibilities compose. Then identify supporting implementation and reliability mechanisms. Preserve complete design loops and useful implementation details, but reject filler units, generic templates, unsupported claims, unsafe defaults, and source-context leakage.

Use `docs/human-report-quality-standard.md` as the positive reasoning contract. It defines what a stranger must be able to understand and retell. Do not turn its headings or labels into the report's intellectual structure by themselves.

### 5. Separate proposal, judgment, and enforcement

- The primary analyst proposes source synthesis, candidate units, transfer inferences, and the human report.
- An independent source-judgment pass decides whether evidence supports each proposed unit.
- An independent stranger-reader pass checks whether the report, evidence, and canonical units communicate every declared core functional paradigm and whether each is genuinely important and non-obvious.
- Deterministic code validates provenance, schema, value score, report shape, ownership, publication safety, and registry mutation.

Reviewer or model failure is a run failure. Do not silently replace either with keyword or heuristic approval.

Use the repository-owned `schemas/independent-source-judgment.schema.json` for the source-judgment response. Do not generate an ad hoc response schema inside a run. Bind the returned run id and commit to the active preparation receipt before accepting any verdict.

### 6. Build the audit trail

Create source synthesis, candidate, accepted, rejected, checkout, reader-review, report, and manifest artifacts for the same run and pinned commit. Route each accepted unit to the Work Context that owns its responsibility boundary. Keep source observations distinct from transfer inferences.

Keep proposed reports and pattern notes under the run's `sources/<run_id>/drafts/` evidence area. The manifest's publication plan maps each reviewed draft to its final owner path. Callers must never materialize those files themselves: finalization validates the staged bytes, writes a durable publication journal, publishes them, and commits the registry. A normal failure rolls back immediately; after a process or machine interruption, the next preflight either completes a registry-backed commit or restores every prior target before allowing another run.

The human report is not the durable learning surface. Every declared core functional paradigm must also be carried by its canonical Work Context pattern: list the paradigm id in `core_functional_paradigm_ids` and explain the same problem, design choice, mechanism, counterfactual importance, non-obvious move, benefits, and limits under `## Core Functional Paradigm`. Supporting implementation units remain in their owning contexts and must not displace the defining paradigm in the canonical note.

The manifest and artifacts must satisfy the current executable schema. Read the types and validation errors from the repository instead of copying a field list into a prompt or skill.

### 7. Finalize

Run:

```bash
npm run finalize -- --manifest /absolute/path/value_manifest.json
```

Finalization is the only publication seam. Do not hand-edit the learned registry or reinterpret a failed gate as partial success.

If finalization fails before publication on a report, artifact, manifest, ownership, taxonomy, readability, or independent-reader contract, keep the same run and enter a bounded repair loop:

1. Pass the exact error and the next attempt number to `npm run finalization-repair-plan -- --run-id <run-id> --attempt <n> --error "<exact error>"`.
2. Continue only when its JSON action is `repair_run_artifacts`. Modify only the listed run-owned drafts, audit receipts, and manifest. Correct the answer that failed: revise or reject unsupported units, fix ownership and taxonomy, improve the report, and repeat independent review whenever its reviewed substance changes.
3. Run `finalize` again against the same run and pinned source. Do not run `daily` again, switch repositories, weaken a gate, or publish partial output.
4. Allow at most three repair rounds. If the plan says `abort_run`, the budget is exhausted, or the failure concerns source identity, checkout integrity, tooling authority, lease ownership, reviewer availability, or publication transaction safety, abort with the exact error.

The clean tool commit recorded during preparation is immutable for the whole loop. Finalization rejects a dirty tool checkout or a different commit. Standards, tests, schemas, skills, workflow code, automation configuration, canonical registry/indexes, pinned source evidence, and local checkout are never repair targets. A failed learning answer must adapt to the fixed evaluator; the evaluator must not adapt to the answer.

If source analysis, independent review, report construction, or verification stops before finalization, release the active run explicitly:

```bash
npm run automation-abort -- --run-id <run-id> --reason "<exact failed gate>"
```

This records an abort receipt; it does not mark the repository learned.

### 8. Verify and deliver

Run the verification commands in `docs/verification-checklist.md`, including every affected Work Context audit. Regenerate indexes when canonical knowledge changed.

Only after finalization and all verification succeed may the caller deliver the finalized report. Delivery must preserve the report's substance and evidence links. Recipient identity, message limits, idempotency, and success receipts belong to the automation configuration, not this repository workflow.

## Stop Conditions

Stop without claiming learning succeeded when any required checkout, evidence, inventory, reviewer, manifest, report, ownership, publication, test, audit, build, index, harness, or delivery gate remains failed after its authorized repair path. A repairable prepublication content gate returns to the bounded same-run repair loop; it does not start a new discovery run. Report the exact error and the most likely bounded repair. Retain evidence according to repository lifecycle rules; never delete or relabel evidence merely to make the dashboard appear clean.

A missing or untracked workflow interface is a deployment failure. Pause the caller, repair and commit the complete repository contract, verify it in a fresh clean checkout, and only then start a new run. Do not repair deployment drift inside an active learning run.

## Maintenance Rule

Change each rule at its owning layer:

- reasoning-quality changes go to the human-report standard and its focused tests;
- deterministic acceptance changes go to code and tests;
- run ordering or handoff changes go here;
- scheduling and recipient changes go only to the automation;
- discovery wording and manual routing changes go only to the thin skill metadata.

Remove duplicate wording from callers whenever this contract changes.
