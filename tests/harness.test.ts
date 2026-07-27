import { describe, expect, test } from "vitest";
import { validateCardMarkdown, validatePatternMarkdown } from "../src/harness/patternHarness";
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

  test("rejects malformed core functional paradigm ids when a pattern declares them", () => {
    const invalid = validPattern.replace(
      "run_id: run-2026-06-11-001\n",
      "run_id: run-2026-06-11-001\ncore_functional_paradigm_ids:\n  - Not A Stable Id\n"
    );

    const result = validatePatternMarkdown("pattern-plugin-registry-lifecycle-hooks.md", invalid, taxonomy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "core_functional_paradigm_ids must contain kebab-case ids: Not A Stable Id"
    );
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

  test("rejects duplicate or aliased reference files", () => {
    const invalid = validPattern.replace(
      "      - tests/plugins/registry.test.ts",
      "      - src/plugins/registry.ts"
    );

    const result = validatePatternMarkdown("pattern-plugin-registry-lifecycle-hooks.md", invalid, taxonomy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("source_repos[0].reference_files must include at least two distinct canonical files");
  });
});

const decisionFirstCard = `---
date: 2026-07-26
source_repo: owner/project
source_url: https://github.com/owner/project
source_commit: ${commitSha}
patterns:
  - pattern-plugin-registry-lifecycle-hooks
card_type: daily_design_card
run_id: run-2026-07-26-report
created_at: 2026-07-26
---

# Project report

## 项目本身做什么

这个项目把大型材料中的对象和关系编译成可查询的任务地图，让使用者先确定影响路径，再决定需要核验哪些原始材料。

## 核心机制如何工作

【输入对象】原始材料、当前任务以及能够回到来源的对象标识。

【判断依据】系统只把可观察关系或明确标记的推断关系用于导航，并在身份不确定时保留候选。

【产生结果】系统返回任务相关的局部关系、来源路径和下一步阅读计划。

【最小例子】当一项发布规则发生变化时，系统从该规则出发找到依赖它的流程和验证项，再把这些对象按来源路径组织成复核清单。

【事实边界】关系地图可能不完整或过期，最终判断仍需回到原始材料与确定性检查。

## 与相邻方法的区别和组合

【区别】关键词检索寻找准确出现，语义检索寻找相似内容，关系图沿已确认连接扩展，渐进式披露控制本轮展示多少。

【组合】先用关键词或语义检索找入口，再确认身份并沿图扩展，随后逐步打开原文，最后运行确定性检查。

## 最重要的迁移

【源码观察】源项目用关系地图规划任务上下文，并让关系路径返回可核验来源。【迁移推论】文档和知识库可以重定义节点、关系、来源、证据等级和失效规则，用同一方法追踪影响、冲突与证据；高风险结论仍应回到原始材料确认。

## 证据附录

固定提交的生产代码与失败测试提供证据。
`;

describe("daily card harness", () => {
  test("accepts the decision-first report contract without legacy duplicate headings", () => {
    const result = validateCardMarkdown("2026-07-26-owner-project.md", decisionFirstCard);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("leaves core-paradigm judgment to finalization instead of inferring it from a fixed heading", () => {
    const freeForm = decisionFirstCard.replace(/## 核心机制如何工作[\s\S]*?\n## 与相邻方法的区别和组合/, "## 设计取舍与组合");
    const result = validateCardMarkdown("2026-07-26-owner-project.md", freeForm);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("grandfathers a complete legacy card created before the decision-first contract", () => {
    const legacy = `---
date: 2026-07-25
source_repo: owner/project
source_url: https://github.com/owner/project
patterns:
  - pattern-plugin-registry-lifecycle-hooks
card_type: daily_design_card
run_id: run-2026-07-25-report
created_at: 2026-07-25
---

# Legacy report

## 一句话
摘要。
## 今天抽取的模式
模式。
## 为什么值得学
理由。
## 宏观架构启发
架构。
## 微决策启发
决策。
## 可迁移场景
场景。
## 不要照搬的场景
边界。
## 和本地 Agent 工具的关联
关联。
`;

    const result = validateCardMarkdown("2026-07-25-owner-project.md", legacy);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("does not let a new card evade the decision-first contract by using legacy headings", () => {
    const newLegacy = decisionFirstCard
      .replace("created_at: 2026-07-26", "created_at: 2026-07-27")
      .replace(/# Project report[\s\S]*/, `# Regressed report

## 一句话
摘要。
## 今天抽取的模式
模式。
## 为什么值得学
理由。
## 宏观架构启发
架构。
## 微决策启发
决策。
## 可迁移场景
场景。
## 不要照搬的场景
边界。
## 和本地 Agent 工具的关联
关联。`);

    const result = validateCardMarkdown("2026-07-27-owner-project.md", newLegacy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("report_evidence_appendix_required");
  });
});
