import { describe, expect, test } from "vitest";
import { validatePatternMarkdown } from "../src/harness/patternHarness";
import type { Taxonomy } from "../src/types";

const taxonomy: Taxonomy = {
  engineering_problems: ["plugin_extension", "configuration"],
  project_types: ["cli_tool", "devtool"],
  pattern_types: ["registry", "plugin_system", "lifecycle_hooks"],
  transfer_targets: ["codex_skill_system", "agent_tooling"]
};

const commitSha = "0123456789abcdef0123456789abcdef01234567";

const validPattern = `---
id: pattern-plugin-registry-lifecycle-hooks
name: Plugin registry with lifecycle hooks
summary: A registry pattern that gives extension modules stable initialize, execute, and cleanup contracts.
engineering_problems:
  - plugin_extension
project_types:
  - cli_tool
  - devtool
pattern_types:
  - registry
  - plugin_system
  - lifecycle_hooks
complexity: medium
quality_score: 87
source_repos:
  - repo: owner/project
    url: https://github.com/owner/project
    commit: ${commitSha}
    reference_files:
      - src/plugins/registry.ts
      - tests/plugins/registry.test.ts
use_when:
  - Multiple independently owned capability modules must share a stable lifecycle contract.
avoid_when:
  - There is only one implementation and the domain boundaries still change every week.
tradeoffs:
  - Adds an indirection layer in exchange for isolated module evolution.
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

## Progressive Disclosure
- 10-second triage: read \`Retrieval Tags\` to decide whether this pattern matches the active task.
- 30-second decision: read \`Core Judgment\`, \`Use When\`, and \`Avoid When\`.
- 2-minute transfer check: read \`Boundary Decisions\`, \`Failure Modes\`, \`Simpler Alternatives\`, and \`Transfer Guidance\`.
- Evidence pass: read \`Source Evidence\` and selected source snapshots only when applying the pattern.

## Retrieval Tags
- Problems: \`plugin_extension\`
- Project types: \`cli_tool\`, \`devtool\`
- Pattern types: \`registry\`, \`plugin_system\`, \`lifecycle_hooks\`
- Transfer targets: \`codex_skill_system\`
- Complexity: \`medium\`
- Source repos: \`owner/project\`
- Tags: \`lifecycle\`, \`extension\`
- Use when: Multiple independently owned capability modules must share a stable lifecycle contract.
- Avoid when: There is only one implementation and the domain boundaries still change every week.

## Engineering Problem
CLI and agent tools often add capabilities one by one until initialization, execution, and cleanup rules become scattered across unrelated files.

## Core Judgment
The central judgment is to make extension ownership explicit at registration time, while keeping lifecycle ordering in one small host module.

## Use When
Use it when at least three modules need stable registration, predictable startup, and independent cleanup without cross-importing each other.

## Avoid When
Avoid it when a single command owns all behavior, because the registry would hide simple control flow behind unnecessary indirection.

## Design Forces
The pattern trades direct calls for predictable extension boundaries, testability, and future replacement of individual capabilities.

## Boundary Decisions
The host owns lifecycle orchestration; plugins own capability-specific state and expose only the lifecycle hooks promised by the contract.

## Failure Modes
Common failures include adding hidden shared state to the registry, letting plugins depend on each other by name, or skipping tests for lifecycle order.

## Simpler Alternatives
A flat list of explicit function calls is better while the project has only one or two modules and no external extension point.

## Transfer Guidance
First count independently changing modules, then identify lifecycle stages, then keep registration data serializable enough to inspect in tests.

## Implementation Hint
Use a small registry map, a typed plugin contract, and one host-owned function for each lifecycle phase.

## Evidence Table
| Reference file | Observed structure | Concrete names | Why it supports the pattern |
| --- | --- | --- | --- |
| \`src/plugins/registry.ts\` | Defines a registry class that owns capability registration and lifecycle sequencing. | \`CapabilityRegistry\`, \`register\`, \`initializeAll\` | This supports the pattern because lifecycle order is centralized in a host-owned boundary rather than spread across plugin modules. |
| \`tests/plugins/registry.test.ts\` | Verifies lifecycle order and duplicate capability rejection at the registry boundary. | \`initializes registered capabilities\`, \`duplicate capability\` | This supports the pattern because the extension contract is locked by tests rather than only described in documentation. |

## Source Evidence
Evidence comes from owner/project at commit ${commitSha}. The concrete files are src/plugins/registry.ts and tests/plugins/registry.test.ts, which show lifecycle sequencing plus contract tests for duplicate registration.
`;

describe("pattern harness", () => {
  test("accepts a traceable pattern with complete schema and required sections", () => {
    const result = validatePatternMarkdown("pattern-plugin-registry-lifecycle-hooks.md", validPattern, taxonomy);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects generic pattern notes without source evidence", () => {
    const invalid = validPattern
      .replace(/reference_files:\n      - src\/plugins\/registry\.ts\n      - tests\/plugins\/registry\.test\.ts/, "reference_files: []")
      .replace(
        `Evidence comes from owner/project at commit ${commitSha}. The concrete files are src/plugins/registry.ts and tests/plugins/registry.test.ts, which show lifecycle sequencing plus contract tests for duplicate registration.`,
        "This project structure is clear and worth learning."
      );

    const result = validatePatternMarkdown("pattern-plugin-registry-lifecycle-hooks.md", invalid, taxonomy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("source_repos[0].reference_files must include at least two files");
    expect(result.errors).toContain("Source Evidence must mention the source repo or a reference file plus the concrete commit");
  });

  test("rejects pattern notes without body retrieval tags", () => {
    const invalid = validPattern.replace(/## Retrieval Tags[\s\S]*?\n## Engineering Problem/, "## Engineering Problem");

    const result = validatePatternMarkdown("pattern-plugin-registry-lifecycle-hooks.md", invalid, taxonomy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing required section: Retrieval Tags");
  });

  test("rejects pattern notes without internal progressive disclosure", () => {
    const invalid = validPattern.replace(/## Progressive Disclosure[\s\S]*?\n## Retrieval Tags/, "## Retrieval Tags");

    const result = validatePatternMarkdown("pattern-plugin-registry-lifecycle-hooks.md", invalid, taxonomy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing required section: Progressive Disclosure");
  });

  test("rejects pattern notes with unknown commit", () => {
    const invalid = validPattern.replace(`commit: ${commitSha}`, "commit: unknown");

    const result = validatePatternMarkdown("pattern-plugin-registry-lifecycle-hooks.md", invalid, taxonomy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("source_repos[0].commit must be a concrete commit SHA or fixture commit id");
  });

  test("rejects pattern notes without evidence table rows for each reference file", () => {
    const invalid = validPattern.replace(/## Evidence Table[\s\S]*?\n## Source Evidence/, "## Source Evidence");

    const result = validatePatternMarkdown("pattern-plugin-registry-lifecycle-hooks.md", invalid, taxonomy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing required section: Evidence Table");
    expect(result.errors).toContain("Evidence Table must mention reference file: src/plugins/registry.ts");
    expect(result.errors).toContain("Evidence Table must mention reference file: tests/plugins/registry.test.ts");
  });
});
