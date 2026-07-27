import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { PatternFrontmatter } from "../src/types";
import { routePattern } from "../src/routing/knowledgeRouter";
import { createFixtureRepoContext } from "../src/fixtures/fixtureRepo";
import { HeuristicExtractor } from "../src/extraction/heuristicExtractor";
import { writeRoutedPatternDraft } from "../src/knowledge/routedPatternWriter";
import { DEFAULT_TAXONOMY } from "../src/knowledge/defaultSchemas";

function pattern(name: string, extra: Partial<PatternFrontmatter> = {}): PatternFrontmatter {
  return {
    id: "pattern-test-route",
    name,
    summary: "A source-backed pattern used to test deterministic knowledge routing.",
    engineering_problems: ["workflow_orchestration"],
    project_types: ["agent_workflow"],
    pattern_types: ["pipeline"],
    complexity: "medium",
    quality_score: 90,
    source_repos: [],
    use_when: ["The target has a repeated workflow boundary."],
    avoid_when: ["The target has no repeated workflow boundary."],
    tradeoffs: ["Adds a named boundary and corresponding maintenance cost."],
    transfer_targets: ["workflow_engine"],
    related_patterns: [],
    created_at: "2026-07-10",
    updated_at: "2026-07-10",
    run_id: "run-test",
    ...extra
  };
}

describe("knowledge routing", () => {
  test("holds generic reconciliation labels for review instead of treating the name as proof", () => {
    const route = routePattern(pattern("Reconciliation loop for declarative state"));
    expect(route.context).toBe("github_engineering_patterns");
    expect(route.disposition).toBe("review_queue");
  });

  test("holds generic staged-pipeline labels for review instead of treating the name as proof", () => {
    const route = routePattern(pattern("Staged processing pipeline with explicit boundaries"));
    expect(route.context).toBe("github_engineering_patterns");
    expect(route.disposition).toBe("review_queue");
  });

  test("does not treat a previously accepted title as proof for a new source", () => {
    const route = routePattern(pattern("Evaluation-gated agent research loop", {
      source_repos: [{
        repo: "unrelated/spoof",
        url: "https://github.com/unrelated/spoof",
        commit: "1111111111111111111111111111111111111111",
        reference_files: ["README.md", "package.json"]
      }]
    }));

    expect(route.disposition).toBe("review_queue");
  });

  test("does not use an exact historical title as routing proof", () => {
    const route = routePattern(pattern("Project skill as operational runbook package", { pattern_types: ["plugin_system"] }));
    expect(route.context).toBe("github_engineering_patterns");
    expect(route.disposition).toBe("review_queue");
  });

  test("routes explicit structured skill signals regardless of title", () => {
    const route = routePattern(pattern("Unrelated punctuation!?", {
      pattern_types: ["plugin_system"],
      transfer_targets: ["codex_skill_system"]
    }));
    expect(route.context).toBe("skill_engineering");
    expect(route.disposition).toBe("context_pattern");
  });

  test("routes explicit structured MCP signals regardless of title", () => {
    const route = routePattern(pattern("Schema-normalized agent tool surface.", {
      pattern_types: ["schema_validation"],
      transfer_targets: ["mcp_server"],
      tags: ["mcp"]
    }));
    expect(route.context).toBe("mcp");
    expect(route.disposition).toBe("context_pattern");
  });

  test("holds unknown mechanisms for review rather than promoting them", () => {
    const route = routePattern(pattern("Unclassified boundary mechanism", { project_types: ["library"], pattern_types: ["adapter"] }));
    expect(route.context).toBe("github_engineering_patterns");
    expect(route.disposition).toBe("review_queue");
  });

  test("keeps routed writes under the sibling Work Context root derived from a custom knowledge root", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "routing-project-"));
    const mutationRoot = await mkdtemp(path.join(tmpdir(), "routing-mutation-root-"));
    const fakeHome = await mkdtemp(path.join(tmpdir(), "routing-fake-home-"));
    const knowledgeRoot = path.join(mutationRoot, "github_engineering_patterns");
    const runId = `route-root-${path.basename(projectRoot)}`;
    const previousHome = process.env.HOME;
    const previousKnowledgeRoot = process.env.KNOWLEDGE_ROOT;
    const previousWorkContextsRoot = process.env.WORK_CONTEXTS_ROOT;
    process.env.HOME = fakeHome;
    process.env.KNOWLEDGE_ROOT = knowledgeRoot;
    delete process.env.WORK_CONTEXTS_ROOT;

    try {
      const context = createFixtureRepoContext(runId, new Date("2026-07-25T00:00:00.000Z"));
      const drafts = await new HeuristicExtractor().extractPatterns(context, undefined, new Date("2026-07-25T00:00:00.000Z"));
      const contextDraft = drafts.find((draft) => routePattern(draft.frontmatter).context === "loop_harness_engineering");
      expect(contextDraft).toBeDefined();
      const reviewDraft = {
        ...contextDraft!,
        frontmatter: {
          ...contextDraft!.frontmatter,
          id: `${contextDraft!.frontmatter.id}-review-only`,
          name: "Unclassified boundary mechanism",
          project_types: ["library"],
          pattern_types: ["adapter"],
          transfer_targets: ["workflow_engine"],
          tags: []
        }
      };
      expect(routePattern(reviewDraft.frontmatter).disposition).toBe("review_queue");

      await writeRoutedPatternDraft(projectRoot, reviewDraft, DEFAULT_TAXONOMY);
      await writeRoutedPatternDraft(projectRoot, contextDraft!, DEFAULT_TAXONOMY);

      const expectedReview = path.join(knowledgeRoot, "sources", "runs", runId, "review_queue", `${reviewDraft.frontmatter.id}.md`);
      const expectedContext = path.join(
        mutationRoot,
        "loop_harness_engineering",
        "sources",
        "runs",
        runId,
        "routed_patterns",
        `${contextDraft!.frontmatter.id}.md`
      );
      await expect(access(expectedReview)).resolves.toBeUndefined();
      await expect(access(expectedContext)).resolves.toBeUndefined();

      const fallbackRoot = path.join(fakeHome, ".codex", "memories", "work_contexts");
      await expect(
        access(path.join(fallbackRoot, "github_engineering_patterns", "sources", "runs", runId, "review_queue", `${reviewDraft.frontmatter.id}.md`))
      ).rejects.toThrow();
      await expect(
        access(
          path.join(
            fallbackRoot,
            "loop_harness_engineering",
            "sources",
            "runs",
            runId,
            "routed_patterns",
            `${contextDraft!.frontmatter.id}.md`
          )
        )
      ).rejects.toThrow();
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousKnowledgeRoot === undefined) delete process.env.KNOWLEDGE_ROOT;
      else process.env.KNOWLEDGE_ROOT = previousKnowledgeRoot;
      if (previousWorkContextsRoot === undefined) delete process.env.WORK_CONTEXTS_ROOT;
      else process.env.WORK_CONTEXTS_ROOT = previousWorkContextsRoot;
    }
  });
});
