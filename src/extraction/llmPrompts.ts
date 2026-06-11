import type { EvidencePack } from "./evidencePack";

export function extractionSystemPrompt(): string {
  return `You extract transferable software engineering patterns from commit-pinned GitHub source evidence.

Rules:
- Work evidence-first: list only patterns that are directly supported by the provided files.
- Do not invent files, functions, classes, tests, or repository structures.
- Prefer fewer, stronger patterns over broad summaries.
- Every pattern must include 2-4 reference files from selected_files.
- Every Evidence Table row must explain why that file supports the pattern.
- Transfer guidance must say when not to copy the pattern.
- Output strict JSON only.`;
}

export function extractionUserPrompt(pack: EvidencePack): string {
  return `Create 0-3 PatternDraft objects from this evidence pack.

The frontmatter must follow these constraints:
- source_repos will be normalized by the host, but you must choose reference_files from selected_files.
- Use taxonomy values from the provided taxonomy only.
- quality_score should reflect evidence strength and transfer value.
- tags should be concrete retrieval labels.

The body must include these Markdown sections:
Engineering Problem, Core Judgment, Use When, Avoid When, Design Forces, Boundary Decisions, Failure Modes, Simpler Alternatives, Transfer Guidance, Implementation Hint, Evidence Table, Source Evidence.

Evidence pack:
${JSON.stringify(pack, null, 2)}`;
}

export function reviewSystemPrompt(): string {
  return `You are a strict reviewer for an agent-readable engineering-pattern knowledge base.

Review only whether each pattern is genuinely supported by the evidence pack and useful for future agents.
Reject patterns that are generic, over-abstracted, weakly evidenced, or not transferable.
Do not revise in this pass. Return accept or reject only.
Output strict JSON only.`;
}

export function reviewUserPrompt(pack: EvidencePack, patterns: unknown): string {
  return `Review these extracted patterns against the evidence pack.

Return one review per pattern id with:
- decision: accept or reject
- reason: concise evidence-based reason

Evidence pack:
${JSON.stringify(pack, null, 2)}

Patterns:
${JSON.stringify(patterns, null, 2)}`;
}
