# Human Report Quality Standard

The report exists to teach the important, non-obvious functional paradigms that make a source project worth studying. Repository coverage, implementation volume, fixed headings, and self-reported scores are supporting controls; none defines usefulness.

## Positive Contract

A passing report lets a reader understand, without opening the repository:

1. Which user or system problem the project solves.
2. Which functional paradigms create its main value.
3. Why each paradigm is important: what defining capability disappears or changes fundamentally if it is removed.
4. Why the design is non-obvious: what competent baseline or common approach becomes insufficient under an observable production pressure.
5. How the mechanism works from input through decision, relationship, operation, or state transition to a result.
6. What benefits follow causally from that choice, what the clever design move is, and which costs or limits remain.
7. Which claims are source observations, which are transfer inferences, and where original source or deterministic verification remains authoritative.

Explain every important, source-supported paradigm and no filler paradigms. One project may have one defining paradigm; another may have several. Count follows source importance, not a quota.

Do not infer an author's private motivation or claim historical novelty. “Innovative” here means a source-observable, non-obvious design move relative to a reasonable baseline under a concrete pressure.

## Core Functional Paradigm Contract

Schema `1.5` records each accepted paradigm under `primary_value_thesis.core_functional_paradigms`:

- `problem`: the concrete pressure or limitation it addresses;
- `design_choice`: the important architectural or product choice;
- `mechanism`: the source-observed causal operation;
- `importance`: the counterfactual capability lost without it;
- `non_obvious_move`: how it differs from a competent baseline without reputation-based praise;
- `benefits` and `tradeoffs`: causal gains and retained costs;
- `evidence_refs`: pinned production plus corroborating evidence;
- `canonical_unit_id`: the accepted canonical loop that preserves the same paradigm in durable knowledge.

The canonical Work Context artifact is the long-term agent memory, not a receipt for the report. It must declare the same paradigm id in `core_functional_paradigm_ids` and explain the paradigm under `## Core Functional Paradigm`. Finalization rejects a report-only paradigm even when the report and reader receipt otherwise pass.

At least one core functional paradigm is required. Additional paradigms, implementation details, Work Context destinations, adjacent approaches, and transfer targets are included only when evidence supports them.

Supporting retry, cache, registry, indexing, migration, or publication mechanisms do not become core paradigms merely because they are technically sophisticated. They qualify only when removing them destroys or fundamentally changes the product's defining capability. Otherwise, keep them as supporting implementation lessons.

## Human Narrative

The report may choose the clearest headings for the project. A useful default is:

- the problem and why the project matters;
- one subsection for each core functional paradigm;
- comparisons or composition with adjacent approaches when those clarify the design choice;
- transfer insights and non-applicable conditions;
- `## 证据附录` for commit-pinned source identifiers.

This is guidance, not a required template. Graph-shaped projects may need to explain what becomes a mapped object, what becomes a relationship, how traversal differs from vector or semantic recall, and how the methods compose. A scheduler, editor, database, or media system should use its own native causal structure.

For each paradigm, use at least one concrete end-to-end example. Explain the design from the bottom up before implementation refinements. Prefer plain language in the main narrative; keep source fields, functions, classes, paths, constants, and test names in the evidence appendix.

## Independent Reader Gate

The independent reader reviews every declared core paradigm and must substantively answer:

- why it is important;
- why the observed design choice makes sense under the stated pressure;
- how its mechanism creates a result;
- what benefits and cleverness come from the choice;
- what tradeoffs and limits remain;
- whether the report, pinned evidence, and canonical unit describe the same paradigm.

If the report declares adjacent approaches, the reader must also explain their responsibility split or separation. Do not force comparisons where they add no explanatory value.

## Negative Gates

Reject publication when:

- the report lists features or implementation details but never identifies the important functional paradigms;
- a claimed paradigm remains equally true after replacing the project name and domain nouns;
- importance is asserted without a counterfactual capability loss;
- innovation is asserted through popularity, author reputation, private intent, or hype rather than a source-observed design difference;
- terminology is complete but no concrete case follows the mechanism to a result;
- supporting reliability machinery displaces the product's defining paradigm;
- a paradigm exists only in report prose and is absent from canonical accepted knowledge;
- a canonical artifact names a paradigm id but leaves its defining problem, design choice, mechanism, importance, non-obvious move, benefits, or limits implicit behind implementation detail;
- a comparison, transfer, benefit, or clever point is unsupported by pinned evidence or explicit inference boundaries;
- fixed headings, word counts, unit counts, or Work Context counts are used as substitutes for understanding.

## Verification Scenarios

The focused suite must prove both directions:

- positive: one important, non-obvious, evidence-backed paradigm can pass without filler units, forced contexts, forced comparisons, or a prescribed heading template;
- positive: several paradigms can each bind to their own canonical evidence-backed loop;
- negative: no declared core paradigm fails;
- negative: a paradigm missing importance, non-obviousness, benefits, tradeoffs, evidence, or canonical alignment fails;
- negative: an ordinary supporting mechanism cannot occupy the core slot through an implementation-detail unit;
- integration: a reader receipt that cannot explain every declared paradigm fails;
- integration: finalization refuses unpinned paradigm evidence and never mutates the learned registry after failure.

Mechanical presentation checks retain only the separated evidence appendix, a non-empty substantive narrative, and protection against internal source-identifier leakage. Semantic usefulness belongs to the manifest, source evidence, canonical knowledge, and independent-reader gate.
