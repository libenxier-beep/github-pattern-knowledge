import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { generateIndexes } from "../src/indexes/generateIndexes";

const pattern = (quality: number, id = "pattern-plugin-registry-lifecycle-hooks") => `---
id: ${id}
name: Plugin registry with lifecycle hooks
summary: Stable lifecycle hooks for independently evolving extension modules.
engineering_problems:
  - plugin_extension
project_types:
  - cli_tool
pattern_types:
  - registry
complexity: medium
quality_score: ${quality}
source_repos:
  - repo: owner/project
    url: https://github.com/owner/project
    commit: unknown
    reference_files:
      - src/plugins/registry.ts
use_when:
  - Multiple modules need stable registration and lifecycle boundaries.
avoid_when:
  - Only one implementation exists.
tradeoffs:
  - Adds indirection for extension isolation.
transfer_targets:
  - codex_skill_system
related_patterns: []
created_at: 2026-06-11
updated_at: 2026-06-11
run_id: run-2026-06-11-001
tags:
  - lifecycle
  - extension
---

# Plugin registry with lifecycle hooks
`;

describe("index generator", () => {
  test("groups patterns by every retrieval axis and sorts by quality score", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pattern-indexes-"));
    const patternsDir = path.join(root, "knowledge", "patterns");
    const indexesDir = path.join(root, "knowledge", "indexes");
    await import("node:fs/promises").then((fs) => fs.mkdir(patternsDir, { recursive: true }));
    await writeFile(path.join(patternsDir, "pattern-plugin-registry-lifecycle-hooks.md"), pattern(87), "utf8");
    await writeFile(path.join(patternsDir, "pattern-plugin-registry-lifecycle-hooks-a7f3.md"), pattern(91, "pattern-plugin-registry-lifecycle-hooks-a7f3"), "utf8");

    const output = await generateIndexes({ patternsDir, indexesDir, projectRoot: root });

    expect(output.index.pattern_count).toBe(2);
    expect(output.index.patterns.map((item) => item.quality_score)).toEqual([91, 87]);
    expect(output.by_engineering_problem.plugin_extension).toHaveLength(2);
    expect(output.by_project_type.cli_tool[0].id).toBe("pattern-plugin-registry-lifecycle-hooks-a7f3");
    expect(output.by_pattern_type.registry).toHaveLength(2);
    expect(output.by_complexity.medium).toHaveLength(2);
    expect(output.by_transfer_target.codex_skill_system).toHaveLength(2);
    expect(output.by_source_repo["owner/project"]).toHaveLength(2);
    expect(output.index.patterns[0].tags).toEqual(["lifecycle", "extension"]);
    expect(output.by_tag.lifecycle).toHaveLength(2);
    expect(output.written_files.some((file) => file.endsWith("by_tag.json"))).toBe(true);
  });
});
