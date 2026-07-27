import path from "node:path";
import { CARD_SCHEMA, DEFAULT_TAXONOMY, PATTERN_SCHEMA, RUN_SCHEMA } from "./defaultSchemas";
import { ensureDir, pathExists, writeJson } from "../utils/fs";
import { getKnowledgePaths } from "../utils/paths";

const RETRIEVAL_STRATEGY = `# Agent Retrieval Strategy

This knowledge base is optimized for Codex and programming agents that need reusable engineering judgment, not project trivia.

## Retrieval Order

1. Identify the current project's primary engineering problem.
2. Search \`knowledge/indexes/by_engineering_problem.json\` for candidate patterns.
3. Search \`knowledge/indexes/by_tag.json\` for concrete labels that actually exist in the generated index, such as \`checkpoint\`, \`bounded-retry\`, \`stale-state\`, \`reconciliation\`, or \`approval\`.
4. Search \`knowledge/indexes/by_pattern_type.json\` for mechanism classes such as \`pipeline\`, \`capability_boundary\`, or \`lifecycle_hooks\`.
5. Filter by project type and complexity so small projects do not inherit infrastructure-scale patterns too early.
6. Open candidate notes and read \`Progressive Disclosure\`, then \`Retrieval Tags\`.
7. Continue only when \`use_when\` matches and \`avoid_when\` does not match the active task.
8. Sort by \`quality_score\`, then by \`evidence_strength\` when present.
9. Follow the note-level disclosure ladder: 10-second triage, 30-second decision, 2-minute transfer check, and evidence pass only when applying the pattern.
10. Read deeper sections only after the tag gate passes: \`Core Judgment\`, \`Boundary Decisions\`, \`Failure Modes\`, \`Simpler Alternatives\`, and \`Transfer Guidance\`.

## Human Card Boundary

Do not read \`cards/\` during default agent retrieval. Cards are human-facing summaries for quick scanning. Agents should open them only when the user explicitly asks for cards, briefings, daily digests, or human-readable summaries.

## Avoiding False Pattern Transfer

Do not introduce complex abstractions before requirements stabilize. If the target project has one implementation, few modules, no external extension point, weak tests, or rapidly changing business rules, prefer the simpler alternative in the note. If \`avoid_when\` matches the current context, do not apply the pattern by default.

## Resolving Pattern Conflicts

Prefer the pattern that most directly matches the current engineering problem. When two patterns compete, compare \`Design Forces\`: choose the boundary that is easier to inspect, easier to rollback, and imposes fewer long-term constraints. During MVP work, local simplicity usually wins. For stable infrastructure evolution, a higher-complexity pattern can be justified when the boundary is already proven.

## Recognizing Premature Abstraction

A project is not ready for a complex pattern when module count is low, only one implementation exists, business rules change weekly, no explicit extension point exists, no third-party integration is planned, the abstraction makes debugging harder, or tests are too weak to protect the new boundary.

## Simple Versus Extensible

If the direction of change is uncertain, choose the simplest removable shape. If the same change repeats and the interface has stabilized, extract a durable abstraction. Real extension points should come from observed demand, not imagined future users. Stabilize the interface before optimizing the internals.
`;

export async function ensureKnowledgeScaffold(projectRoot = process.cwd()): Promise<void> {
  const paths = getKnowledgePaths(projectRoot);
  await Promise.all([
    ensureDir(paths.patternsDir),
    ensureDir(paths.indexesDir),
    ensureDir(paths.cardsDir),
    ensureDir(paths.rejectedPatternsDir),
    ensureDir(paths.rejectedCardsDir),
    ensureDir(paths.sourcesDir),
    ensureDir(paths.schemasDir),
    ensureDir(paths.runsDir),
    ensureDir(paths.failedRunsDir)
  ]);

  const taxonomyPath = path.join(paths.schemasDir, "taxonomy.json");
  if (!(await pathExists(taxonomyPath))) {
    await writeJson(taxonomyPath, DEFAULT_TAXONOMY);
  }
  const schemaFiles: Array<[string, unknown]> = [
    ["pattern.schema.json", PATTERN_SCHEMA],
    ["card.schema.json", CARD_SCHEMA],
    ["run.schema.json", RUN_SCHEMA]
  ];
  for (const [fileName, schema] of schemaFiles) {
    const fullPath = path.join(paths.schemasDir, fileName);
    if (!(await pathExists(fullPath))) {
      await writeJson(fullPath, schema);
    }
  }
  const retrievalPath = path.join(paths.schemasDir, "retrieval_strategy.md");
  if (!(await pathExists(retrievalPath))) {
    await import("node:fs/promises").then((fs) => fs.writeFile(retrievalPath, RETRIEVAL_STRATEGY, "utf8"));
  }
}
