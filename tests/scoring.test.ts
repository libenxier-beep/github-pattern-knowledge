import { describe, expect, test } from "vitest";
import { scoreRepoContext } from "../src/scoring/scoreRepo";
import type { RepoContext } from "../src/types";

const context: RepoContext = {
  run_id: "run-2026-06-11-001",
  repo: "owner/project",
  url: "https://github.com/owner/project",
  default_branch: "main",
  commit_sha: "1111111111111111111111111111111111111111",
  fixture: false,
  metadata: {
    stars: 4000,
    forks: 350,
    open_issues: 50,
    language: "TypeScript",
    topics: ["cli", "developer-tools"],
    archived: false,
    fork: false,
    pushed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_at: "2021-01-01T00:00:00.000Z"
  },
  tree_summary: [
    "src/index.ts",
    "src/plugins/registry.ts",
    "tests/registry.test.ts",
    "docs/plugins.md",
    "examples/basic.ts",
    ".github/workflows/ci.yml",
    "package.json"
  ],
  selected_files: [],
  readme_excerpt: "A maintained developer tool with plugin lifecycle docs.",
  package_metadata: [{ path: "package.json", excerpt: "{\"scripts\":{\"test\":\"vitest\"}}" }],
  fetched_at: new Date().toISOString(),
  truncation: { files_truncated: 0, context_truncated: false }
};

describe("repo scoring", () => {
  test("weights engineering quality above heat and preserves score breakdowns", () => {
    const score = scoreRepoContext(context, new Date());

    expect(score.repo).toBe("owner/project");
    expect(score.total_score).toBeCloseTo(
      score.engineering_quality.score * 0.38 + (score.selection_fit?.score ?? 0) * 0.32 + score.long_term_impact.score * 0.18 + score.recent_heat.score * 0.12,
      5
    );
    expect(score.engineering_quality.score).toBeGreaterThan(score.recent_heat.score - 10);
    expect(score.engineering_quality.signals.has_tests).toBe(true);
    expect(score.engineering_quality.signals.has_ci).toBe(true);
  });

  test("keeps AI engineering and local workflow alignment ahead of generic popularity", () => {
    const genericPopular: RepoContext = {
      ...context,
      repo: "owner/generic-devtool",
      metadata: {
        ...context.metadata,
        stars: 120000,
        forks: 9000,
        topics: ["developer-tools"]
      },
      tree_summary: [
        "src/index.ts",
        "src/config.ts",
        "tests/config.test.ts",
        "docs/usage.md",
        "examples/basic.ts",
        ".github/workflows/ci.yml",
        "package.json"
      ],
      readme_excerpt: "A popular developer tool."
    };
    const aiLocal: RepoContext = {
      ...context,
      repo: "owner/agent-runtime",
      metadata: {
        ...context.metadata,
        stars: 4500,
        forks: 300,
        topics: ["ai-agents", "mcp", "llm", "developer-tools"]
      },
      tree_summary: [
        "src/agents/tool-runner.ts",
        "src/mcp/server.ts",
        "src/evals/harness.ts",
        "src/memory/store.ts",
        "tests/agent-runtime.test.ts",
        "docs/mcp.md",
        "examples/local-agent.ts",
        ".github/workflows/ci.yml",
        "package.json"
      ],
      readme_excerpt: "AI agent runtime for MCP tools, browser automation, evals, memory, and local workflow automation."
    };

    const genericScore = scoreRepoContext(genericPopular, new Date());
    const aiScore = scoreRepoContext(aiLocal, new Date());

    expect(aiScore.selection_fit?.signals.ai_engineering_matches).toContain("ai-agents");
    expect(aiScore.selection_fit?.signals.local_work_matches).toContain("mcp");
    expect(aiScore.selection_fit?.signals.capability_matches).toContain("agent_runtime");
    expect(aiScore.selection_fit?.signals.capability_matches).toContain("mcp_tooling");
    expect(aiScore.total_score).toBeGreaterThan(genericScore.total_score);
  });

  test("prefers production last-mile craft over a commodity AI feature surface", () => {
    const commodityAgent: RepoContext = {
      ...context,
      repo: "owner/commodity-agent",
      metadata: {
        ...context.metadata,
        topics: ["ai-agents", "mcp", "developer-tools"]
      },
      tree_summary: [
        "src/agent.ts",
        "src/tools.ts",
        "tests/agent.test.ts",
        "docs/usage.md",
        ".github/workflows/ci.yml",
        "package.json"
      ],
      selected_files: [
        {
          path: "src/agent.ts",
          reason: "primary runtime",
          content: "The agent sends prompts and executes tools.",
          truncated: false
        }
      ],
      readme_excerpt: "AI agent with model selection and MCP tools."
    };
    const craftedAgent: RepoContext = {
      ...commodityAgent,
      repo: "owner/crafted-agent",
      selected_files: [
        {
          path: "src/runtime.ts",
          reason: "production recovery runtime",
          content:
            "The runtime uses checkpoint recovery, cancellation ownership, idempotent retries, compatibility fallback, graceful shutdown, conflict reconciliation, and degraded-mode observability.",
          truncated: false
        },
        {
          path: "tests/runtime-failure.test.ts",
          reason: "failure-path corroboration",
          content: "Tests partial failure, race recovery, resume, migration, rollback, and stale writer versioning.",
          truncated: false
        }
      ],
      readme_excerpt: "AI agent runtime designed for production recovery and compatibility."
    };

    const commodityScore = scoreRepoContext(commodityAgent, new Date());
    const craftedScore = scoreRepoContext(craftedAgent, new Date());

    expect(craftedScore.selection_fit?.signals.production_craft_matches).toEqual(
      expect.arrayContaining(["recovery", "cancellation", "idempotent", "compatibility", "shutdown"])
    );
    expect(craftedScore.selection_fit?.reasons).toContain("production_last_mile_craft");
    expect(craftedScore.total_score).toBeGreaterThan(commodityScore.total_score);
  });

  test("lets a mechanism-rich non-AI system outrank a commodity AI system", () => {
    const commodityAgent: RepoContext = {
      ...context,
      repo: "owner/commodity-agent",
      metadata: {
        ...context.metadata,
        stars: 5000,
        forks: 400,
        topics: ["ai-agents", "mcp", "llm"]
      },
      tree_summary: [
        "src/agent.ts",
        "src/tools.ts",
        "tests/agent.test.ts",
        "docs/usage.md",
        ".github/workflows/ci.yml",
        "package.json"
      ],
      selected_files: [
        {
          path: "src/agent.ts",
          reason: "primary runtime",
          content: "The agent selects a model, sends a prompt, and calls MCP tools.",
          truncated: false
        }
      ],
      readme_excerpt: "AI agent with prompts, function calling, and MCP tools."
    };
    const craftedPublishingSystem: RepoContext = {
      ...context,
      repo: "owner/versioned-publishing-engine",
      metadata: {
        ...context.metadata,
        stars: 1200,
        forks: 100,
        topics: ["document-management", "workflow", "publishing", "version-control"]
      },
      tree_summary: [
        "src/workflow.ts",
        "src/version-store.ts",
        "src/recovery.ts",
        "tests/conflict-recovery.test.ts",
        "docs/editorial-workflow.md",
        "examples/publishing.ts",
        ".github/workflows/ci.yml",
        "package.json"
      ],
      selected_files: [
        {
          path: "src/workflow.ts",
          reason: "production publishing workflow",
          content:
            "The document workflow preserves provenance, transfers ownership at approval, versions every publication, and reconciles conflicts before idempotent publish jobs.",
          truncated: false
        },
        {
          path: "tests/conflict-recovery.test.ts",
          reason: "degraded-path corroboration",
          content: "Tests partial failure recovery, rollback, stale version rejection, resume, and audit-trail repair.",
          truncated: false
        }
      ],
      readme_excerpt: "Document management and publishing workflow with version control, approval, provenance, and recovery."
    };

    const commodityScore = scoreRepoContext(commodityAgent, new Date());
    const craftedScore = scoreRepoContext(craftedPublishingSystem, new Date());

    expect(craftedScore.selection_fit?.signals.engineering_domain_matches).toEqual(
      expect.arrayContaining(["document management", "publishing"])
    );
    expect(craftedScore.selection_fit?.signals.transfer_bridge_matches).toEqual(
      expect.arrayContaining(["provenance", "version control"])
    );
    expect(craftedScore.total_score).toBeGreaterThan(commodityScore.total_score);
  });
});
