import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { finalizeDeepDive } from "../src/scheduler/finalizeDeepDive";
import type { DeepDiveManifest } from "../src/deepDive/valueFunction";
import { DEFAULT_TAXONOMY } from "../src/knowledge/defaultSchemas";
import { readLearnedRepoRegistry } from "../src/knowledge/repoRegistry";

const execFile = promisify(execFileCallback);

function patternArtifact(id: string, commit: string): string {
  return `---
id: ${id}
name: Evidence-bound publication loop for ${id}
summary: A source-backed pattern that demonstrates a complete publication boundary with deterministic recovery checks.
engineering_problems:
  - workflow_orchestration
project_types:
  - agent_workflow
pattern_types:
  - state_machine
complexity: high
quality_score: 94
source_repos:
  - repo: owner/repo
    url: https://github.com/owner/repo
    commit: ${commit}
    reference_files:
      - src/runtime.py
      - tests/test_runtime.py
use_when:
  - Multiple independently completing attempts can publish state out of ownership order.
avoid_when:
  - One synchronous owner performs the entire operation without retries or concurrent publication.
tradeoffs:
  - Adds an explicit publication fence in exchange for deterministic recovery and inspectable ownership.
transfer_targets:
  - agent_tooling
related_patterns: []
created_at: 2026-07-25
updated_at: 2026-07-25
run_id: run-finalize
core_functional_paradigm_ids:
  - relationship-map
tags:
  - publication
  - recovery
---

# Evidence-bound publication loop

## Progressive Disclosure
- 10-second triage: use this when concurrent attempts can publish stale state after ownership changes.
- 30-second decision: compare the publication owner, completion fence, and rollback behavior before adoption.
- 2-minute transfer check: inspect failure recovery and decide whether the target has a durable ownership signal.
- Evidence pass: reopen the pinned production and degraded-path test files before transferring the mechanism.

## Retrieval Tags
- Problems: \`workflow_orchestration\`
- Project types: \`agent_workflow\`
- Pattern types: \`state_machine\`
- Transfer targets: \`agent_tooling\`
- Complexity: \`high\`
- Source repos: \`owner/repo\`
- Tags: \`publication\`, \`recovery\`
- Use when: Multiple independently completing attempts can publish state out of ownership order.
- Avoid when: One synchronous owner performs the entire operation without concurrent publication.

## Engineering Problem
Concurrent attempts can finish out of order, so completion time alone cannot prove which attempt still owns the right to publish shared state.

## Core Judgment
Separate work completion from publication authority and revalidate the current owner immediately before committing externally visible state.

## Core Functional Paradigm
The defining paradigm is a source-backed relationship map: resolve a task entry, traverse explicit typed relations, and return a bounded path that can reopen authoritative source. It matters because removing relationship expansion leaves only broad recall, not explainable impact navigation. The non-obvious move is to separate candidate recall from evidence-bearing traversal; this improves traceability and context control, while retaining graph incompleteness and source verification as explicit limits.

## Use When
Use this boundary when retries, workers, or asynchronous stages can overlap and an older attempt could otherwise overwrite a newer accepted result.

## Avoid When
Avoid the extra fence when one synchronous owner completes the whole operation and no retry, failover, or concurrent publication path exists.

## Design Forces
The design trades a small amount of metadata and one final ownership check for deterministic stale-writer rejection and clearer recovery semantics.

## Boundary Decisions
Workers may compute candidate results, but only the publication owner may advance visible state after confirming its lease or version remains current.

## Failure Modes
A fence checked too early still permits stale publication, while an unversioned rollback can erase a newer result and create false recovery confidence.

## Simpler Alternatives
A direct write is preferable when execution is single-owner and synchronous; otherwise use a compare-and-swap version before introducing a larger coordinator.

## Transfer Guidance
Identify the publication owner, choose a monotonic identity, test out-of-order completion, and preserve a durable receipt for both rejection and success.

## Implementation Hint
Store a run or lease version and compare it immediately before the atomic publication step.

## Evidence Table
| Reference file | Observed structure | Concrete names | Why it supports the pattern |
| --- | --- | --- | --- |
| \`src/runtime.py\` | Production runtime performs the state transition behind an explicit publication boundary. | \`step()\`, \`publication_owner\` | The runtime file demonstrates where candidate work becomes externally visible and where ownership must be checked. |
| \`tests/test_runtime.py\` | Degraded-path test exercises the runtime contract and makes publication behavior deterministic. | \`test_step()\`, \`stale_writer\` | The test file corroborates the production boundary instead of relying only on filenames or descriptive documentation. |

## Source Evidence
The mechanism is bound to owner/repo at commit ${commit}; src/runtime.py and tests/test_runtime.py provide production and degraded-path evidence for the publication decision.
`;
}

async function fixture(
  qualified = true,
  reportContent = `---
date: 2026-07-26
source_repo: owner/repo
source_url: https://github.com/owner/repo
patterns:
  - pattern-loop
card_type: daily_design_card
run_id: run-finalize
created_at: 2026-07-26
---

# 日报

## 项目本身做什么

这个项目把代码中的对象与关系组织为可查询的结构，让审查者能沿着依赖路径理解改动范围、定位相关对象，并据此安排审查顺序。

## 核心机制如何工作

【输入对象】解析后的代码实体、当前改动和已经识别的关系。

【判断依据】只根据源码中可观察的调用、导入、继承、包含和测试关系建立连接，不把文字相似直接当成实际依赖。

【产生结果】先形成全局关系视图，再围绕当前任务截取局部路径，让审查者按需要逐步展开相关材料。

【最小例子】当一个支付函数发生变化时，系统先确认该函数，再沿调用关系找到订单服务，随后找到覆盖这些对象的测试，最终生成需要阅读与验证的范围。

【事实边界】关系视图可能漏掉反射、运行时配置和动态调用，原始代码与确定性检查仍然是最终事实来源。

## 与相邻方法的区别和组合

【区别】关键词和语义检索擅长找到可能的入口，关系路由擅长从确认后的对象沿明确连接展开影响范围，两者的证据强度不同。

【组合】先用关键词或语义检索扩大入口召回，再用关系路由收窄范围并逐层披露原文，最后由测试或其他确定性检查验证。

## 最重要的迁移

【源码观察】代码对象是节点，调用和引用是边。【迁移推论】在文档与知识库中，文档、段落和概念可成为节点，引用、来源与冲突可成为边；迁移时必须保留关系可追踪与局部变化可定位。

## 一句话

先讲项目价值，再讲可迁移的设计判断。

## 证据附录

具体源码证据只放在这里。
`
): Promise<{ projectRoot: string; manifestPath: string }> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "deep-finalize-"));
  const checkoutPath = path.join(projectRoot, "checkouts", "owner-repo");
  await mkdir(path.join(checkoutPath, "src"), { recursive: true });
  await mkdir(path.join(checkoutPath, "tests"), { recursive: true });
  await writeFile(path.join(checkoutPath, "src", "runtime.py"), "def step():\n    return True\n", "utf8");
  await writeFile(path.join(checkoutPath, "tests", "test_runtime.py"), "def test_step():\n    assert True\n", "utf8");
  await execFile("git", ["init", "--quiet", checkoutPath]);
  await execFile("git", ["-C", checkoutPath, "add", "."]);
  await execFile("git", [
    "-C", checkoutPath,
    "-c", "user.name=Deep Finalize Test",
    "-c", "user.email=deep-finalize@example.test",
    "commit", "--quiet", "-m", "fixture"
  ]);
  await execFile("git", ["-C", checkoutPath, "remote", "add", "origin", "https://github.com/owner/repo.git"]);
  const { stdout: commitStdout } = await execFile("git", ["-C", checkoutPath, "rev-parse", "HEAD"]);
  const commit = commitStdout.trim();
  const root = path.join(projectRoot, "work_contexts");
  const files = [
    "github_engineering_patterns/cards/report.md",
    "github_engineering_patterns/runs/source.md",
    "github_engineering_patterns/runs/candidates.md",
    "github_engineering_patterns/runs/accepted.md",
    "github_engineering_patterns/runs/rejected.md",
    "github_engineering_patterns/patterns/pattern-loop.md",
    "loop_harness_engineering/patterns/pattern-detail-a.md",
    "loop_harness_engineering/patterns/pattern-detail-b.md",
    "loop_harness_engineering/patterns/pattern-detail-c.md"
  ];
  for (const file of files) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    const content = file.endsWith("cards/report.md")
      ? reportContent
      : file.includes("/patterns/")
        ? patternArtifact(path.basename(file, ".md"), commit)
        : "evidence\n";
    await writeFile(target, content, "utf8");
  }
  const sourceSnapshotPath = path.join(projectRoot, "knowledge", "sources", "run-finalize", "repo_snapshot.json");
  await mkdir(path.dirname(sourceSnapshotPath), { recursive: true });
  await writeFile(sourceSnapshotPath, `${JSON.stringify({
    run_id: "run-finalize",
    repo: "owner/repo",
    commit_sha: commit,
    fixture: false
  }, null, 2)}\n`, "utf8");
  const checkoutReceiptPath = path.join(projectRoot, "knowledge", "sources", "run-finalize", "checkout_receipt.json");
  await writeFile(checkoutReceiptPath, `${JSON.stringify({
    repo: "owner/repo",
    url: "https://github.com/owner/repo",
    commit,
    checkout_path: checkoutPath
  }, null, 2)}\n`, "utf8");
  const taxonomyPath = path.join(projectRoot, "knowledge", "schemas", "taxonomy.json");
  await mkdir(path.dirname(taxonomyPath), { recursive: true });
  await writeFile(taxonomyPath, `${JSON.stringify(DEFAULT_TAXONOMY, null, 2)}\n`, "utf8");
  const baseScores = {
    evidence: qualified ? 24 : 0,
    mechanism: 19,
    closed_loop: 14,
    transfer: 14,
    ai_leverage: 9,
    boundaries: 9,
    retrieval: 5
  };
  const unit = (id: string, artifact_file: string, owner_context: string, kind: "canonical_loop" | "implementation_detail") => ({
    id,
    artifact_file,
    owner_context,
    kind,
    evidence_refs: ["src/runtime.py#step", "tests/test_runtime.py#test_step"],
    has_production_source: true,
    has_corroborating_evidence: true,
    filename_only_claim: false,
    confidence: "medium" as const,
    transfer_bridge: {
      commodity_baseline: "Publish the newest completed result as current.",
      production_pressure: "Concurrent attempts can finish out of order and overwrite newer state.",
      craft_move: "Fence publication with monotonic ownership and verify immediately before commit.",
      obvious_alternative_failure: "Completion order is not ownership order, so last-finished-wins can publish stale state.",
      cross_domain_analogies: ["knowledge publication", "media generation"],
      source_domain_problem: "A domain workflow can publish stale state after ownership changes.",
      domain_neutral_mechanism: "Fence publication by monotonic ownership and verify before commit.",
      target_domains: ["knowledge publishing", "media generation"],
      transfer_invariants: ["single publication owner", "version checked before commit"],
      non_transferable_source_details: ["source-specific field names and retry constants"],
      analogy_break_conditions: ["irreversible side effects require transactions or compensation"],
      human_recall_trigger: "Two attempts may finish out of order.",
      agent_adaptation_task: "Map publication ownership and add a stale-writer test.",
      deterministic_acceptance_check: "An older attempt cannot publish after a newer owner exists."
    },
    scores: baseScores
  });
  const manifest = {
    schema_version: "1.5",
    run_id: "run-finalize",
    repo: "owner/repo",
    commit,
    checkout_receipt_file: "knowledge/sources/run-finalize/checkout_receipt.json",
    report_file: "github_engineering_patterns/cards/report.md",
    reader_review_file: "github_engineering_patterns/runs/reader-review.json",
    audit_files: [
      "github_engineering_patterns/runs/source.md",
      "github_engineering_patterns/runs/candidates.md",
      "github_engineering_patterns/runs/accepted.md",
      "github_engineering_patterns/runs/rejected.md",
      "github_engineering_patterns/runs/reader-review.json"
    ],
    primary_value_thesis: {
      source_function: "Build a queryable graph of code entities and relationships for review.",
      primary_abstraction: "Typed code entities are nodes and source relationships are directed edges.",
      why_primary: "The graph is the product's organizing model; publication mechanisms only support it.",
      canonical_unit_id: "loop",
      evidence_refs: ["src/runtime.py#step", "tests/test_runtime.py#test_step"],
      mechanism_contract: {
        source_inputs: ["parsed source entities", "the current change set"],
        decision_or_relation_rules: [
          "Emit relationships only from source-observable syntax or bounded framework rules.",
          "Resolve an entry object before traversing only allowed relationship types."
        ],
        produced_outputs: ["a repository relation view", "a task-scoped subgraph"],
        worked_example: "A changed payment function resolves to one symbol, expands to its caller and covering test, and returns that path as the review plan.",
        validation_boundary: "The graph is derived; source files and deterministic checks remain authoritative."
      },
      core_functional_paradigms: [
        {
          id: "relationship-map",
          name: "Relationship map instead of undirected broad recall",
          problem: "Review needs explicit dependency and impact paths after an entry object is known.",
          design_choice: "Compile source objects and observable relationships into a queryable map.",
          mechanism: "Resolve one object, traverse allowed typed relationships, and return the connected review path.",
          importance: "Without the map, the product can find text but loses its repository-wide impact and navigation capability.",
          non_obvious_move: "It separates broad entry recall from deterministic relationship expansion instead of asking similarity or an LLM to infer every connection at query time.",
          benefits: ["explainable impact paths", "bounded task context"],
          tradeoffs: ["dynamic relationships can be missing and source verification remains necessary"],
          canonical_unit_id: "loop",
          evidence_refs: ["src/runtime.py#step", "tests/test_runtime.py#test_step"]
        }
      ],
      adjacent_approaches: [
        {
          approach: "vector semantic retrieval",
          selection_basis: "latent content similarity",
          best_for: "finding a likely entry from natural-language intent",
          limitation: "similarity does not prove a source dependency",
          not_equivalent_reason: "it ranks related text rather than typed source relationships",
          combination_role: "use for broad recall before graph expansion"
        },
        {
          approach: "progressive disclosure",
          selection_basis: "the reader's current task and expansion need",
          best_for: "controlling how much verified context is shown",
          limitation: "it needs a retrieval surface to supply candidates",
          not_equivalent_reason: "it is a presentation policy rather than a relationship index",
          combination_role: "use the task subgraph as a staged reading plan"
        }
      ],
      transfer_mappings: [
        {
          target_domain: "knowledge bases",
          source_entities: ["code symbols", "files"],
          target_entities: ["concepts", "documents"],
          relationship_mapping: "Calls and imports become citations and semantic links.",
          preserved_invariant: "Every conclusion remains traceable through explicit edges."
        },
        {
          target_domain: "document systems",
          source_entities: ["code symbols", "files"],
          target_entities: ["sections", "documents"],
          relationship_mapping: "Calls and imports become references and dependency links.",
          preserved_invariant: "A local change exposes the connected impact surface."
        }
      ],
      non_applicable_conditions: ["The target has no meaningful relationships to query or maintain."]
    },
    units: [
      unit("loop", "github_engineering_patterns/patterns/pattern-loop.md", "github_engineering_patterns", "canonical_loop"),
      unit("detail-a", "loop_harness_engineering/patterns/pattern-detail-a.md", "loop_harness_engineering", "implementation_detail"),
      unit("detail-b", "loop_harness_engineering/patterns/pattern-detail-b.md", "loop_harness_engineering", "implementation_detail"),
      unit("detail-c", "loop_harness_engineering/patterns/pattern-detail-c.md", "loop_harness_engineering", "implementation_detail")
    ]
  } as DeepDiveManifest;
  await writeFile(path.join(root, "github_engineering_patterns", "runs", "reader-review.json"), `${JSON.stringify({
    reviewer_role: "independent_reader",
    verdict: "pass",
    reviewed_report_file: manifest.report_file,
    reviewed_canonical_unit_id: manifest.primary_value_thesis.canonical_unit_id,
    answers: {
      project_problem: "The project narrows review work by turning source objects and explicit relationships into an explainable impact plan.",
      primary_sequence: "It resolves one changed object, traverses allowed relationships, returns affected objects and tests, and then reopens source evidence.",
      worked_example: "A payment-function change expands to the order service and its covering tests, producing a bounded list for review and verification.",
      counterfactual: "Without relationship traversal, the system can locate the changed object but cannot explain which callers, dependents, or tests should follow.",
      adjacent_composition: "Keyword and semantic retrieval find an entry, relationship traversal expands impact, progressive disclosure controls reading, and tests decide.",
      canonical_alignment: "The declared canonical loop preserves the same object-resolution, relationship-traversal, review-plan, and source-verification sequence.",
      core_paradigms: [
        {
          paradigm_id: "relationship-map",
          importance: "Without the compiled relationship map, the project loses its defining ability to expose repository-wide impact paths after an entry object is known.",
          design_reasoning: "The design separates broad entry recall from source-backed relationship expansion so similarity and language-model judgment do not impersonate dependency evidence.",
          mechanism: "It resolves one source object, traverses allowed typed relationships, and returns the connected objects and tests as a bounded review path.",
          benefits_and_cleverness: "The split produces explainable impact paths and bounded context while still allowing semantic retrieval to supply a broad initial entry.",
          tradeoffs_and_limits: "Dynamic calls and configuration can be absent from the derived map, so source inspection and deterministic tests remain authoritative.",
          source_and_canonical_alignment: "Pinned production and test evidence support the same relationship-map mechanism carried by the declared canonical loop."
        }
      ]
    }
  }, null, 2)}\n`, "utf8");
  const manifestPath = path.join(projectRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const failedRunPath = path.join(projectRoot, "knowledge", "runs", "failed", "run-finalize.json");
  await mkdir(path.dirname(failedRunPath), { recursive: true });
  await writeFile(failedRunPath, `${JSON.stringify({
    run_id: "run-finalize",
    status: "failed",
    fixture: false,
    selected_repo: { repo: "owner/repo" },
    source_snapshot: "knowledge/sources/run-finalize/repo_snapshot.json"
  }, null, 2)}\n`, "utf8");
  return { projectRoot, manifestPath };
}

describe("deep-dive finalizer", () => {
  test("registers only artifacts that pass the value gate and exist", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const result = await finalizeDeepDive({ projectRoot, manifestPath });
    const registry = await readLearnedRepoRegistry(projectRoot);

    expect(result.qualified).toBe(true);
    expect(registry.repos[0].pattern_files).toHaveLength(4);
    expect(registry.repos[0].pattern_files).toContain("work_contexts/github_engineering_patterns/patterns/pattern-loop.md");
    const run = JSON.parse(await readFile(path.join(projectRoot, "knowledge", "runs", "run-finalize.json"), "utf8"));
    expect(run.routed_patterns).toHaveLength(3);
    expect(run.routed_patterns.every((item: { confidence: string }) => item.confidence === "medium")).toBe(true);
  });

  test("refuses to learn an unqualified manifest", async () => {
    const { projectRoot, manifestPath } = await fixture(false);
    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow("dimension_below_floor:evidence");
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("does not mark a repository learned when durable receipt publication fails", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const blockedReceiptPath = path.join(projectRoot, "knowledge", "runs", "run-finalize-deep-finalization.json");
    await mkdir(blockedReceiptPath, { recursive: true });

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow();

    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("marks a recovered failed receipt as superseded by the successful run", async () => {
    const { projectRoot, manifestPath } = await fixture(true);

    await finalizeDeepDive({ projectRoot, manifestPath });

    const failed = JSON.parse(
      await readFile(path.join(projectRoot, "knowledge", "runs", "failed", "run-finalize.json"), "utf8")
    );
    expect(failed.status).toBe("failed");
    expect(failed.superseded_by).toBe("knowledge/runs/run-finalize.json");
    expect(failed.recovered_at).toEqual(expect.any(String));
  });

  test("rejects a report whose main narrative leaks source identifiers", async () => {
    const report = `# 日报

## 一句话

系统通过 \`retry_budget\`、\`src/runtime.ts\` 和 \`publishVersion()\` 控制流程。

## 证据附录

这里可以保留具体源码标识。
`;
    const { projectRoot, manifestPath } = await fixture(true, report);

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "report_main_narrative_contains_internal_identifiers"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects a readable report that cannot be published as an active card", async () => {
    const report = `# 日报

## 项目本身做什么

这个项目把隐含关系提升为可验证的运行时结构，并保留完整的问题、机制、收益、边界和迁移说明。

它解决的不是单一功能缺失，而是多个参与者和多阶段处理下，责任、状态、顺序与失败恢复逐渐变得不可追踪的问题。设计先明确输入和判断规则，再把结果交给确定性检查，而不是依赖模糊的事后解释。

## 核心机制如何工作

系统从输入开始，根据明确契约推进状态，产生结果并运行确定性验证；失败时保留证据并停止发布。

一个具体例子是：收到候选对象后，宿主先确认身份和允许的关系，再按边界执行变换；如果验证通过才发布，否则保留原始材料和失败原因。这样既允许智能模块提出候选，也不把最终事实权交给不可重复的判断。

## 证据附录

固定提交中的生产代码和失败测试提供证据。
`;
    const { projectRoot, manifestPath } = await fixture(true, report);

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "Deep-dive active card gate failed"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("requires a durable source run before publishing a finalization receipt or registry record", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    await rm(path.join(projectRoot, "knowledge", "runs", "failed", "run-finalize.json"));

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow("Deep-dive source run missing");

    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
    await expect(readFile(path.join(projectRoot, "knowledge", "runs", "run-finalize-deep-finalization.json"), "utf8"))
      .rejects.toThrow();
  });

  test("rejects fixture runs even when a self-reported manifest passes the value gate", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const runPath = path.join(projectRoot, "knowledge", "runs", "failed", "run-finalize.json");
    const run = JSON.parse(await readFile(runPath, "utf8"));
    await writeFile(runPath, `${JSON.stringify({ ...run, fixture: true }, null, 2)}\n`, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow("Deep-dive source run must be non-fixture");
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test.each([
    ["run id", { run_id: "different-run" }, "Deep-dive source run id mismatch"],
    ["repository", { selected_repo: { repo: "other/repo" } }, "Deep-dive source run repository mismatch"],
    ["commit", {}, "Deep-dive source snapshot commit mismatch"]
  ])("rejects a manifest whose %s is not bound to the source run", async (_label, runPatch, expected) => {
    const { projectRoot, manifestPath } = await fixture(true);
    const runPath = path.join(projectRoot, "knowledge", "runs", "failed", "run-finalize.json");
    const run = JSON.parse(await readFile(runPath, "utf8"));
    await writeFile(runPath, `${JSON.stringify({ ...run, ...runPatch }, null, 2)}\n`, "utf8");
    if (expected.includes("commit")) {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      await writeFile(manifestPath, `${JSON.stringify({ ...manifest, commit: "ffffffffffffffffffffffffffffffffffffffff" }, null, 2)}\n`, "utf8");
    }

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(expected);
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rolls back success receipts when the learned-registry write fails late", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const registryPath = path.join(projectRoot, "knowledge", "registry", "learned_repos.json");
    await mkdir(registryPath, { recursive: true });

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow();

    await expect(readFile(path.join(projectRoot, "knowledge", "runs", "run-finalize.json"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(projectRoot, "knowledge", "runs", "run-finalize-deep-finalization.json"), "utf8"))
      .rejects.toThrow();
    const failed = JSON.parse(
      await readFile(path.join(projectRoot, "knowledge", "runs", "failed", "run-finalize.json"), "utf8")
    );
    expect(failed.superseded_by).toBeUndefined();
    expect(failed.recovered_at).toBeUndefined();
  });

  test("rejects a self-reported checkout when its durable receipt is missing", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    await rm(path.join(projectRoot, "knowledge", "sources", "run-finalize", "checkout_receipt.json"));

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow("checkout receipt missing");
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects accepted evidence that is absent from the pinned checkout", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.units[0].evidence_refs = ["src/missing.py#step", "tests/test_runtime.py#test_step"];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow("evidence missing from pinned checkout");
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects a primary value thesis whose source evidence is absent from the pinned checkout", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.primary_value_thesis.evidence_refs = ["src/missing.py#graph", "tests/test_runtime.py#test_step"];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "primary value evidence missing from pinned checkout"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects ignored untracked evidence that exists locally but not in the pinned commit", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const checkoutPath = path.join(projectRoot, "checkouts", "owner-repo");
    await writeFile(path.join(checkoutPath, ".git", "info", "exclude"), "ignored.py\n", "utf8");
    await writeFile(path.join(checkoutPath, "ignored.py"), "def ghost():\n    return True\n", "utf8");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.units[0].evidence_refs = ["ignored.py#ghost", "tests/test_runtime.py#test_step"];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const artifactPath = path.join(
      projectRoot,
      "work_contexts",
      "github_engineering_patterns",
      "patterns",
      "pattern-loop.md"
    );
    await writeFile(
      artifactPath,
      (await readFile(artifactPath, "utf8")).replaceAll("src/runtime.py", "ignored.py"),
      "utf8"
    );

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "evidence does not match pinned commit"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects assume-unchanged evidence whose working bytes differ from the pinned commit", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const checkoutPath = path.join(projectRoot, "checkouts", "owner-repo");
    await execFile("git", ["-C", checkoutPath, "update-index", "--assume-unchanged", "src/runtime.py"]);
    await writeFile(
      path.join(checkoutPath, "src", "runtime.py"),
      "def step():\n    return 'hidden replacement'\n",
      "utf8"
    );

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "evidence does not match pinned commit"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects an accepted artifact without commit-pinned provenance", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    await writeFile(
      path.join(projectRoot, "work_contexts", "github_engineering_patterns", "patterns", "pattern-loop.md"),
      "# Unbound artifact\n",
      "utf8"
    );

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow("artifact provenance mismatch");
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects artifact evidence declarations that exceed the manifest and pinned checkout", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const artifactPath = path.join(
      projectRoot,
      "work_contexts",
      "github_engineering_patterns",
      "patterns",
      "pattern-loop.md"
    );
    const artifact = (await readFile(artifactPath, "utf8"))
      .replace(
        "      - tests/test_runtime.py\n",
        "      - tests/test_runtime.py\n      - src/ghost.py\n"
      )
      .replace(
        "\n\n## Source Evidence",
        "\n| `src/ghost.py` | A claimed production path appears in metadata but is absent from the pinned checkout. | `ghost()` | This row is structurally specific while deliberately lacking checkout-backed evidence for the regression test. |\n\n## Source Evidence"
      );
    await writeFile(artifactPath, artifact, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "Deep-dive artifact provenance mismatch"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects a provenance-bound accepted artifact that fails the pattern harness", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(
      path.join(projectRoot, "work_contexts", "github_engineering_patterns", "patterns", "pattern-loop.md"),
      `---\nsource_repos:\n  - repo: owner/repo\n    commit: ${manifest.commit}\n    reference_files:\n      - src/runtime.py\n      - tests/test_runtime.py\n---\n\n# Structurally incomplete artifact\n`,
      "utf8"
    );

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "Deep-dive artifact harness failed"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects a conflicting replay after a run id has been finalized", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    await finalizeDeepDive({ projectRoot, manifestPath });

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const originalArtifact = path.join(
      projectRoot,
      "work_contexts",
      "github_engineering_patterns",
      "patterns",
      "pattern-loop.md"
    );
    const conflictingArtifact = path.join(path.dirname(originalArtifact), "pattern-loop-conflicting.md");
    const conflictingContent = (await readFile(originalArtifact, "utf8"))
      .replace("id: pattern-loop\n", "id: pattern-loop-conflicting\n");
    await writeFile(conflictingArtifact, conflictingContent, "utf8");
    manifest.units[0].artifact_file = "github_engineering_patterns/patterns/pattern-loop-conflicting.md";
    const conflictingManifest = path.join(projectRoot, "conflicting-manifest.json");
    await writeFile(conflictingManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath: conflictingManifest }))
      .rejects.toThrow("conflicting finalization");
    const registry = await readLearnedRepoRegistry(projectRoot);
    expect(registry.repos[0].pattern_files).not.toContain(
      "work_contexts/github_engineering_patterns/patterns/pattern-loop-conflicting.md"
    );
  });

  test("rejects a failed or placeholder independent reader review", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const reviewPath = path.join(
      projectRoot,
      "work_contexts",
      "github_engineering_patterns",
      "runs",
      "reader-review.json"
    );
    const review = JSON.parse(await readFile(reviewPath, "utf8"));
    review.verdict = "fail";
    review.answers.primary_sequence = "有流程。";
    await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "Deep-dive independent reader review failed its contract"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects an independent reader receipt that cannot explain a declared core paradigm", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const reviewPath = path.join(
      projectRoot,
      "work_contexts",
      "github_engineering_patterns",
      "runs",
      "reader-review.json"
    );
    const review = JSON.parse(await readFile(reviewPath, "utf8"));
    review.answers.core_paradigms[0].benefits_and_cleverness = "很好。";
    await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "Deep-dive independent reader review failed its core paradigm contract"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects a core paradigm that is not declared by its canonical Work Context artifact", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const artifactPath = path.join(
      projectRoot,
      "work_contexts",
      "github_engineering_patterns",
      "patterns",
      "pattern-loop.md"
    );
    const artifact = (await readFile(artifactPath, "utf8")).replace(
      "core_functional_paradigm_ids:\n  - relationship-map\n",
      ""
    );
    await writeFile(artifactPath, artifact, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "canonical Work Context artifact does not declare core paradigm: relationship-map"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects a canonical Work Context artifact that declares but does not explain its core paradigm", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const artifactPath = path.join(
      projectRoot,
      "work_contexts",
      "github_engineering_patterns",
      "patterns",
      "pattern-loop.md"
    );
    const artifact = (await readFile(artifactPath, "utf8")).replace(
      /\n## Core Functional Paradigm\n[\s\S]*?\n## Use When/,
      "\n## Use When"
    );
    await writeFile(artifactPath, artifact, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "canonical Work Context artifact does not explain core paradigm: relationship-map"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("does not force an adjacent-method comparison when it is not needed to explain the core paradigm", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.primary_value_thesis.adjacent_approaches;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const reviewPath = path.join(
      projectRoot,
      "work_contexts",
      "github_engineering_patterns",
      "runs",
      "reader-review.json"
    );
    const review = JSON.parse(await readFile(reviewPath, "utf8"));
    delete review.answers.adjacent_composition;
    await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");

    const result = await finalizeDeepDive({ projectRoot, manifestPath });

    expect(result.qualified).toBe(true);
  });

  test("rejects core paradigm evidence that is absent from the pinned checkout", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.primary_value_thesis.core_functional_paradigms[0].evidence_refs = [
      "src/runtime.py#step",
      "tests/missing.py#test_step"
    ];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow(
      "core paradigm evidence missing from pinned checkout"
    );
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("requires rejected-unit evidence before publishing success", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.units.push({
      ...manifest.units[3],
      id: "rejected-missing-evidence",
      kind: "rejected",
      artifact_file: "github_engineering_patterns/sources/runs/run-finalize/rejected/missing.md"
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow("Deep-dive artifact missing");
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("rejects evidence read from a dirty pinned checkout", async () => {
    const { projectRoot, manifestPath } = await fixture(true);
    await writeFile(
      path.join(projectRoot, "checkouts", "owner-repo", "src", "runtime.py"),
      "def step():\n    return 'uncommitted replacement'\n",
      "utf8"
    );

    await expect(finalizeDeepDive({ projectRoot, manifestPath })).rejects.toThrow("pinned checkout is dirty");
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });
});
