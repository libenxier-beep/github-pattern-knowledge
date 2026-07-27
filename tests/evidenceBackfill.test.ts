import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { backfillPatternEvidence } from "../src/knowledge/evidenceBackfill";
import { validatePatternMarkdown } from "../src/harness/patternHarness";
import { getKnowledgePaths } from "../src/utils/paths";
import type { Taxonomy } from "../src/types";

const taxonomy: Taxonomy = {
  engineering_problems: ["plugin_extension"],
  project_types: ["cli_tool"],
  pattern_types: ["registry"],
  transfer_targets: ["agent_tooling"]
};

const weakPattern = `---
id: pattern-plugin-registry-example
name: Plugin registry example
summary: A registry pattern that centralizes extension lookup and lifecycle sequencing for agent tools.
engineering_problems:
  - plugin_extension
project_types:
  - cli_tool
pattern_types:
  - registry
complexity: medium
quality_score: 82
source_repos:
  - repo: owner/project
    url: https://github.com/owner/project
    commit: unknown
    reference_files:
      - src/plugins/registry.ts
use_when:
  - Multiple independently changing plugins need a host-owned registration and lifecycle boundary.
avoid_when:
  - Only one implementation exists and a registry would hide direct control flow.
tradeoffs:
  - Adds registry indirection in exchange for extension isolation and inspectable lifecycle order.
transfer_targets:
  - agent_tooling
related_patterns: []
created_at: 2026-06-11
updated_at: 2026-06-11
run_id: run-backfill
tags:
  - registry
---

# Plugin registry example

## Progressive Disclosure
- 10-second triage: read \`Retrieval Tags\` to decide whether this pattern matches the active task.
- 30-second decision: read \`Core Judgment\`, \`Use When\`, and \`Avoid When\`.
- 2-minute transfer check: read \`Boundary Decisions\`, \`Failure Modes\`, \`Simpler Alternatives\`, and \`Transfer Guidance\`.
- Evidence pass: read \`Source Evidence\` and selected source snapshots only when applying the pattern.

## Retrieval Tags
- Problems: \`plugin_extension\`
- Project types: \`cli_tool\`
- Pattern types: \`registry\`
- Transfer targets: \`agent_tooling\`
- Complexity: \`medium\`
- Source repos: \`owner/project\`
- Tags: \`registry\`
- Use when: Multiple independently changing plugins need a host-owned registration and lifecycle boundary.
- Avoid when: Only one implementation exists and a registry would hide direct control flow.

## Engineering Problem
Agent tools accumulate extension points until initialization and cleanup behavior becomes hard to inspect.

## Core Judgment
Use a host-owned registry boundary so plugins own domain behavior while lifecycle sequencing stays central.

## Use When
Use it when independently changing plugins need stable registration, startup, and cleanup behavior.

## Avoid When
Avoid it when direct calls remain clearer and there is no repeated lifecycle shape.

## Design Forces
The pattern trades direct calls for extension isolation, lifecycle testability, and safer future replacement.

## Boundary Decisions
The host owns lifecycle orchestration while plugins expose only the small contract promised by the registry.

## Failure Modes
Hidden mutable registry state and undocumented registration order can make the abstraction harder to debug.

## Simpler Alternatives
Use a plain list of function calls while there are only one or two implementations.

## Transfer Guidance
First count independently changing modules, then test registration order and duplicate rejection.

## Implementation Hint
Start with a small typed registry map and tests around lifecycle order.

## Source Evidence
The source repo owner/project is represented by src/plugins/registry.ts.
`;

describe("evidence backfill", () => {
  test("upgrades weak legacy pattern notes using source snapshots and concrete commit resolver", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "evidence-backfill-"));
    const paths = getKnowledgePaths(projectRoot);
    await mkdir(paths.patternsDir, { recursive: true });
    await mkdir(path.join(paths.sourcesDir, "run-backfill"), { recursive: true });
    const patternPath = path.join(paths.patternsDir, "pattern-plugin-registry-example.md");
    await writeFile(patternPath, weakPattern, "utf8");
    await writeFile(
      path.join(paths.sourcesDir, "run-backfill", "repo_snapshot.json"),
      JSON.stringify(
        {
          run_id: "run-backfill",
          repo: "owner/project",
          selected_files: [
            {
              path: "src/plugins/registry.ts",
              reason: "registry lifecycle evidence",
              snapshot_file: "selected_files/src-plugins-registry-ts.txt"
            },
            {
              path: "tests/plugins/registry.test.ts",
              reason: "registry contract test evidence",
              snapshot_file: "selected_files/tests-plugins-registry-test-ts.txt"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );
    await mkdir(path.join(paths.sourcesDir, "run-backfill", "selected_files"), { recursive: true });
    await writeFile(path.join(paths.sourcesDir, "run-backfill", "selected_files", "src-plugins-registry-ts.txt"), "export class CapabilityRegistry { register() {}; initializeAll() {}; }", "utf8");
    await writeFile(path.join(paths.sourcesDir, "run-backfill", "selected_files", "tests-plugins-registry-test-ts.txt"), "test('rejects duplicate capability', () => registry.register(capability));", "utf8");

    const result = await backfillPatternEvidence(projectRoot, {
      commitResolver: async () => "2222222222222222222222222222222222222222"
    });
    const updated = await readFile(patternPath, "utf8");
    const harness = validatePatternMarkdown("pattern-plugin-registry-example.md", updated, taxonomy);

    expect(result.updated).toBe(1);
    expect(updated).toContain("commit: \"2222222222222222222222222222222222222222\"");
    expect(updated).toContain("## Evidence Table");
    expect(updated).toContain("tests/plugins/registry.test.ts");
    expect(updated).toContain("maturity: experimental");
    expect(updated).toContain("risk_level: medium");
    expect(harness.valid).toBe(true);
  });
});
