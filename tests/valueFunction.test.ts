import { describe, expect, test } from "vitest";
import { scoreDeepDiveManifest, type DeepDiveManifest } from "../src/deepDive/valueFunction";

function validManifest(): DeepDiveManifest {
  const manifest: DeepDiveManifest = {
    schema_version: "1.5",
    run_id: "run-deep-valid",
    repo: "owner/repo",
    commit: "fedcba9876543210fedcba9876543210fedcba98",
    checkout_receipt_file: "github_engineering_patterns/sources/runs/run-deep-valid/checkout_receipt.json",
    report_file: "github_engineering_patterns/cards/2026-07-12-owner-repo.md",
    reader_review_file: "github_engineering_patterns/sources/runs/run-deep-valid/reader_review.json",
    audit_files: [
      "github_engineering_patterns/sources/runs/run-deep-valid/source_synthesis.md",
      "github_engineering_patterns/sources/runs/run-deep-valid/candidates.md",
      "github_engineering_patterns/sources/runs/run-deep-valid/accepted.md",
      "github_engineering_patterns/sources/runs/run-deep-valid/rejected.md",
      "github_engineering_patterns/sources/runs/run-deep-valid/reader_review.json"
    ],
    primary_value_thesis: {
      source_function: "Build a queryable graph of code entities and relationships for review.",
      primary_abstraction: "Typed entities are nodes and source relationships are directed edges.",
      why_primary: "The graph is the product's organizing model; reliability mechanisms only support it.",
      canonical_unit_id: "observation-action-loop",
      evidence_refs: ["src/runtime.py#step", "tests/test_runtime.py#test_step"],
      mechanism_contract: {
        source_inputs: ["parsed code entities", "the current change set"],
        decision_or_relation_rules: [
          "Emit typed edges only from source-observable syntax or bounded framework rules.",
          "Resolve task entry points before traversing only allowed relation types."
        ],
        produced_outputs: ["a repository-wide relation view", "a task-scoped subgraph"],
        worked_example: "A changed payment function resolves to one symbol, expands to its caller and covering test, and returns that path as the review plan.",
        validation_boundary: "The graph is derived and incomplete; source, tests, and type checks remain authoritative."
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
          canonical_unit_id: "observation-action-loop",
          evidence_refs: ["src/runtime.py#step", "tests/test_runtime.py#test_step"]
        }
      ],
      adjacent_approaches: [
        {
          approach: "vector semantic retrieval",
          selection_basis: "latent content similarity",
          best_for: "finding a likely entry from natural-language intent",
          limitation: "similarity does not prove a source dependency",
          not_equivalent_reason: "it ranks related text instead of traversing typed source relationships",
          combination_role: "use it for broad recall before graph expansion"
        },
        {
          approach: "progressive disclosure",
          selection_basis: "the reader's current task and expansion need",
          best_for: "controlling how much verified context is shown at each step",
          limitation: "it needs an index or graph to supply candidate material",
          not_equivalent_reason: "it is a presentation policy rather than a relationship index",
          combination_role: "use the task subgraph as its staged reading plan"
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
      {
        id: "observation-action-loop",
        artifact_file: "github_engineering_patterns/patterns/pattern-observation-action-loop.md",
        owner_context: "github_engineering_patterns",
        kind: "canonical_loop",
        evidence_refs: ["src/runtime.py#Agent.step", "tests/test_runtime.py#test_step"],
        has_production_source: true,
        has_corroborating_evidence: true,
        filename_only_claim: false,
        scores: { evidence: 24, mechanism: 19, closed_loop: 15, transfer: 14, ai_leverage: 9, boundaries: 9, retrieval: 5 }
      },
      {
        id: "stale-state-guard",
        artifact_file: "loop_harness_engineering/patterns/pattern-stale-state-guard.md",
        owner_context: "loop_harness_engineering",
        kind: "implementation_detail",
        evidence_refs: ["src/actions.py#multi_act", "tests/test_actions.py#test_guard"],
        has_production_source: true,
        has_corroborating_evidence: true,
        filename_only_claim: false,
        scores: { evidence: 23, mechanism: 18, closed_loop: 13, transfer: 14, ai_leverage: 9, boundaries: 9, retrieval: 5 }
      },
      {
        id: "domain-scoped-secrets",
        artifact_file: "loop_harness_engineering/patterns/pattern-domain-scoped-secrets.md",
        owner_context: "loop_harness_engineering",
        kind: "implementation_detail",
        evidence_refs: ["src/security.py#release", "tests/test_security.py#test_domain"],
        has_production_source: true,
        has_corroborating_evidence: true,
        filename_only_claim: false,
        scores: { evidence: 23, mechanism: 18, closed_loop: 13, transfer: 14, ai_leverage: 9, boundaries: 10, retrieval: 5 }
      },
      {
        id: "typed-tool-contract",
        artifact_file: "mcp/patterns/pattern-typed-tool-contract.md",
        owner_context: "mcp",
        kind: "implementation_detail",
        evidence_refs: ["src/tools.py#compile_schema", "tests/test_tools.py#test_validation"],
        has_production_source: true,
        has_corroborating_evidence: true,
        filename_only_claim: false,
        scores: { evidence: 23, mechanism: 18, closed_loop: 12, transfer: 14, ai_leverage: 9, boundaries: 9, retrieval: 5 }
      }
    ]
  };
  for (const unit of manifest.units.slice(0, 2)) {
    Object.assign(unit, {
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
      }
    });
  }
  return manifest;
}

describe("deep-dive value function", () => {
  test("rejects a thesis that never identifies an important non-obvious functional paradigm", () => {
    const manifest = validManifest();
    delete (manifest.primary_value_thesis as unknown as Record<string, unknown>).core_functional_paradigms;

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("core_functional_paradigms_required");
  });

  test("rejects a claimed core paradigm that does not explain importance, non-obviousness, benefits, and tradeoffs", () => {
    const manifest = validManifest();
    (manifest.primary_value_thesis as unknown as Record<string, unknown>).core_functional_paradigms = [{
      id: "relationship-map",
      name: "Relationship map",
      problem: "Broad retrieval can find relevant text but cannot expose explicit impact paths.",
      design_choice: "Compile source objects and observable relationships into a queryable map.",
      mechanism: "Resolve an object, then traverse typed relationships to produce a bounded path.",
      canonical_unit_id: "observation-action-loop",
      evidence_refs: ["src/runtime.py#step", "tests/test_runtime.py#test_step"]
    }];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("core_functional_paradigm_shape_invalid:relationship-map");
  });

  test("accepts one evidence-backed core paradigm without forcing extra units, contexts, comparisons, or mappings", () => {
    const manifest = validManifest();
    (manifest.primary_value_thesis as unknown as Record<string, unknown>).core_functional_paradigms = [{
      id: "relationship-map",
      name: "Relationship map instead of undirected broad recall",
      problem: "Review needs explicit dependency and impact paths after an entry object is known.",
      design_choice: "Compile source objects and observable relationships into a queryable map.",
      mechanism: "Resolve one object, traverse allowed typed relationships, and return the connected review path.",
      importance: "Without the map, the product can find text but loses its repository-wide impact and navigation capability.",
      non_obvious_move: "It separates broad entry recall from deterministic relationship expansion instead of asking similarity or an LLM to infer every connection at query time.",
      benefits: ["explainable impact paths", "bounded task context"],
      tradeoffs: ["dynamic relationships can be missing and source verification remains necessary"],
      canonical_unit_id: "observation-action-loop",
      evidence_refs: ["src/runtime.py#step", "tests/test_runtime.py#test_step"]
    }];
    manifest.primary_value_thesis.adjacent_approaches = [];
    manifest.primary_value_thesis.transfer_mappings = [manifest.primary_value_thesis.transfer_mappings[0]];
    manifest.units = [manifest.units[0]];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("accepts one strong transfer destination instead of forcing two analogies", () => {
    const manifest = validManifest();
    const bridge = manifest.units[0].transfer_bridge!;
    bridge.cross_domain_analogies = ["knowledge publication"];
    bridge.target_domains = ["knowledge publishing"];
    manifest.units = [manifest.units[0]];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects a supporting implementation detail presented as an important functional paradigm", () => {
    const manifest = validManifest();
    (manifest.primary_value_thesis as unknown as Record<string, unknown>).core_functional_paradigms = [{
      id: "retry-helper",
      name: "Retry helper",
      problem: "Transient operations can fail.",
      design_choice: "Retry the operation.",
      mechanism: "Repeat the call after a transient error.",
      importance: "The report claims this is the product's defining capability.",
      non_obvious_move: "The report claims ordinary retry is innovative without a source-specific pressure.",
      benefits: ["fewer transient failures"],
      tradeoffs: ["more attempts"],
      canonical_unit_id: "stale-state-guard",
      evidence_refs: ["src/actions.py#multi_act", "tests/test_actions.py#test_guard"]
    }];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("core_paradigm_canonical_unit_kind_invalid:retry-helper");
  });

  test("rejects a manifest that has strong implementation units but no primary value thesis", () => {
    const manifest = validManifest() as unknown as Record<string, unknown>;
    delete manifest.primary_value_thesis;
    const result = scoreDeepDiveManifest(manifest as unknown as DeepDiveManifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("primary_value_thesis_required");
  });

  test("rejects a primary value thesis without any explicit structural transfer mapping", () => {
    const manifest = validManifest();
    manifest.primary_value_thesis.transfer_mappings = [];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("primary_value_transfer_mapping_minimum_not_met");
  });

  test("rejects a high-scoring primary thesis that omits the observable mechanism contract", () => {
    const manifest = validManifest();
    delete (manifest.primary_value_thesis as unknown as Record<string, unknown>).mechanism_contract;

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("primary_mechanism_contract_required");
  });

  test("rejects a mechanism contract without an observable decision or relationship rule", () => {
    const manifest = validManifest();
    manifest.primary_value_thesis.mechanism_contract.decision_or_relation_rules = [];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("primary_mechanism_contract_shape_invalid");
  });

  test("rejects a mechanism contract without an end-to-end worked example", () => {
    const manifest = validManifest();
    delete (manifest.primary_value_thesis.mechanism_contract as unknown as Record<string, unknown>).worked_example;

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("primary_mechanism_contract_shape_invalid");
  });

  test("rejects a primary mechanism that is not carried by an accepted canonical loop", () => {
    const manifest = validManifest();
    manifest.primary_value_thesis.canonical_unit_id = "stale-state-guard";

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("primary_canonical_unit_kind_invalid");
  });

  test("rejects a primary canonical loop disconnected from the primary evidence", () => {
    const manifest = validManifest();
    manifest.units[0].evidence_refs = ["src/other.py#run", "tests/test_other.py#test_run"];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("primary_canonical_unit_evidence_disconnected");
  });

  test("rejects a manifest that omits the independent reader review receipt", () => {
    const manifest = validManifest() as unknown as Record<string, unknown>;
    delete manifest.reader_review_file;

    const result = scoreDeepDiveManifest(manifest as unknown as DeepDiveManifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("reader_review_required");
  });

  test("allows a single relevant adjacent approach instead of forcing two comparisons", () => {
    const manifest = validManifest();
    (manifest.primary_value_thesis as unknown as Record<string, unknown>).adjacent_approaches = [
      {
        approach: "semantic retrieval",
        selection_basis: "content similarity",
        best_for: "finding a likely entry",
        limitation: "similarity does not prove dependency",
        not_equivalent_reason: "it ranks text instead of traversing source relationships",
        combination_role: "use before graph expansion"
      }
    ];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects an adjacent-method comparison that omits the non-equivalence or composition judgment", () => {
    const manifest = validManifest();
    const thesis = manifest.primary_value_thesis as unknown as Record<string, unknown>;
    const approaches = thesis.adjacent_approaches as Array<Record<string, unknown>>;
    delete approaches[0].not_equivalent_reason;
    delete approaches[1].combination_role;

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("primary_adjacent_approaches_shape_invalid");
  });

  test("rejects today's false-success shape with zero canonical loops and filename-only evidence", () => {
    const manifest = validManifest();
    manifest.units = manifest.units.slice(0, 2).map((unit) => ({
      ...unit,
      kind: "routed_draft",
      filename_only_claim: true
    }));

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(["accepted_unit_required", "canonical_loop_required", "filename_only_claim_forbidden"])
    );
  });

  test("qualifies an evidence-backed manifest when every universal hard gate and weighted score passes", () => {
    const result = scoreDeepDiveManifest(validManifest());

    expect(result.qualified).toBe(true);
    expect(result.total_score).toBeGreaterThanOrEqual(85);
    expect(result.errors).toEqual([]);
  });

  test("rejects a source that lacks any complete cross-domain transfer bridge", () => {
    const manifest = validManifest();
    for (const unit of manifest.units) {
      delete (unit as typeof unit & { transfer_bridge?: unknown }).transfer_bridge;
    }

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("cross_domain_transfer_bridge_required");
  });

  test("rejects transfer bridges that omit the full 80-to-95 craft contract", () => {
    const manifest = validManifest();
    for (const unit of manifest.units.slice(0, 2)) {
      delete (unit.transfer_bridge as unknown as Record<string, unknown>).commodity_baseline;
    }

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("cross_domain_transfer_bridge_required");
  });

  test("rejects self-reported dimension scores above their contract maximum", () => {
    const manifest = validManifest();
    manifest.units[0].scores.evidence = 26;

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("score_out_of_range:observation-action-loop:evidence");
  });

  test("reports an incomplete bridge as a gate failure instead of throwing on malformed JSON", () => {
    const manifest = validManifest();
    for (const unit of manifest.units.slice(0, 2)) {
      delete (unit.transfer_bridge as unknown as Record<string, unknown>).target_domains;
    }

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("cross_domain_transfer_bridge_required");
  });

  test("rejects repeated units, audit files, and owner labels that do not match artifact ownership", () => {
    const manifest = validManifest();
    manifest.audit_files = Array(4).fill(manifest.audit_files[0]);
    manifest.units = manifest.units.map((unit, index) => ({
      ...unit,
      id: index === 0 ? unit.id : manifest.units[0].id,
      artifact_file: manifest.units[0].artifact_file,
      owner_context: index === 0 ? unit.owner_context : `invented-context-${index}`
    }));

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "duplicate_audit_file:github_engineering_patterns/sources/runs/run-deep-valid/source_synthesis.md",
        "duplicate_unit_id:observation-action-loop",
        "duplicate_artifact_file:github_engineering_patterns/patterns/pattern-observation-action-loop.md",
        "artifact_owner_mismatch:observation-action-loop:invented-context-1"
      ])
    );
  });

  test("requires two distinct canonical evidence files per accepted unit", () => {
    const manifest = validManifest();
    manifest.units[0].evidence_refs = ["src/runtime.py#Agent.step", "src/runtime.py#Agent.other"];

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("insufficient_evidence:observation-action-loop");
  });

  test("rejects unknown unit kinds instead of silently dropping them from publication", () => {
    const manifest = validManifest();
    (manifest.units[3] as unknown as { kind: string }).kind = "typo_kind";

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toContain("unit_kind_invalid:typed-tool-contract");
  });

  test("turns malformed JSON shapes into deterministic gate errors instead of throwing", () => {
    const manifest = validManifest() as unknown as Record<string, unknown>;
    manifest.audit_files = "not-an-array";
    manifest.units = [{
      id: "broken",
      kind: "canonical_loop",
      artifact_file: null,
      owner_context: null,
      scores: null
    }];

    expect(() => scoreDeepDiveManifest(manifest as unknown as DeepDiveManifest)).not.toThrow();
    const result = scoreDeepDiveManifest(manifest as unknown as DeepDiveManifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "manifest_shape_invalid:audit_files",
      "unit_shape_invalid:broken",
      "score_out_of_range:broken:evidence"
    ]));
  });

  test("rejects unsafe run ids and unpinned commit identities at the value boundary", () => {
    const manifest = validManifest();
    manifest.run_id = "../escape";
    manifest.commit = "main";

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(["run_id_invalid", "commit_sha_invalid"]));
  });

  test("canonicalizes locators before counting distinct audits, artifacts, and owner contexts", () => {
    const manifest = validManifest();
    const audit = manifest.audit_files[0];
    manifest.audit_files = [
      audit,
      audit.replace("/source_synthesis.md", "/./source_synthesis.md"),
      audit.replace("/source_synthesis.md", "/alias/../source_synthesis.md"),
      audit.replace("github_engineering_patterns/", "github_engineering_patterns//")
    ];
    const aliases = [
      ["github_engineering_patterns/patterns/loop.md", "github_engineering_patterns"],
      ["loop_harness_engineering/../github_engineering_patterns/patterns/loop.md", "loop_harness_engineering"],
      ["mcp/../github_engineering_patterns/patterns/loop.md", "mcp"],
      ["agent_memory_knowledge_bases/../github_engineering_patterns/patterns/loop.md", "agent_memory_knowledge_bases"]
    ];
    manifest.units = manifest.units.map((unit, index) => ({
      ...unit,
      artifact_file: aliases[index][0],
      owner_context: aliases[index][1]
    }));

    const result = scoreDeepDiveManifest(manifest);

    expect(result.qualified).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      `duplicate_audit_file:${audit}`,
      "duplicate_artifact_file:github_engineering_patterns/patterns/loop.md",
      "locator_not_canonical:artifact_file:stale-state-guard"
    ]));
  });
});
