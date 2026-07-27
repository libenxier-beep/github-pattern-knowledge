import { access, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createFixtureRepoContext } from "../src/fixtures/fixtureRepo";
import { readLearnedRepoRegistry } from "../src/knowledge/repoRegistry";
import { ensureKnowledgeScaffold } from "../src/knowledge/scaffold";
import { runDaily } from "../src/scheduler/daily";
import { processRepoContext } from "../src/scheduler/processRepo";
import { scoreRepoContext } from "../src/scoring/scoreRepo";
import { validateRunLocatorIntegrity } from "../src/harness/runLocatorIntegrity";

describe("daily workflow", () => {
  test("keeps failed fixture preparation out of canonical, routed, card, and index projections", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "pattern-daily-"));
    const result = await runDaily({ projectRoot, forceFixture: true, runDate: new Date("2026-06-11T08:00:00.000Z") });

    expect(result.status).toBe("failed");
    expect(result.fixture).toBe(true);
    expect(result.added_patterns).toEqual([]);
    expect(result.routed_patterns).toEqual([]);
    expect(result.generated_card).toBeNull();
    expect(result.updated_indexes).toEqual([]);

    expect(result.added_patterns).toHaveLength(0);

    const run = JSON.parse(await readFile(path.join(projectRoot, result.run_file), "utf8"));
    expect(run.selected_repo.repo).toBe("fixture/agent-workflow-kit");
    expect(run.fixture).toBe(true);
    expect(run.harness_result.accepted).toBe(0);
    expect(await validateRunLocatorIntegrity(projectRoot)).toMatchObject({ valid: true, shape_errors: [] });
  });

  test("does not succeed or mark learned when every valid artifact is routed or review-only", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "pattern-review-only-"));
    const runDate = new Date("2026-07-12T08:00:00.000Z");
    await ensureKnowledgeScaffold(projectRoot);
    const context = createFixtureRepoContext("run-review-only", runDate);
    context.fixture = false;
    context.repo = "owner/review-only";
    context.url = "https://github.com/owner/review-only";
    const selectedScore = { ...scoreRepoContext(context, runDate), selected: true };

    const result = await processRepoContext({
      projectRoot,
      context,
      candidateScores: [selectedScore],
      runDate,
      startedAt: runDate.toISOString()
    });
    const registry = await readLearnedRepoRegistry(projectRoot);

    expect(result.status).toBe("failed");
    expect(result.added_patterns).toEqual([]);
    expect(result.routed_patterns).toEqual([]);
    expect(result.generated_card).toBeNull();
    expect(result.updated_indexes).toEqual([]);
    expect(registry.repos).toEqual([]);
  });

  test("preparation does not invoke a pattern extractor or publish knowledge projections", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "pattern-preparation-only-"));
    const runDate = new Date("2026-07-12T08:00:00.000Z");
    await ensureKnowledgeScaffold(projectRoot);
    const context = createFixtureRepoContext("run-preparation-only", runDate);
    context.fixture = false;
    context.repo = "owner/preparation-only";
    context.url = "https://github.com/owner/preparation-only";
    const selectedScore = { ...scoreRepoContext(context, runDate), selected: true };
    const previousMode = process.env.EXTRACTOR_MODE;
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.EXTRACTOR_MODE = "llm";
    delete process.env.OPENAI_API_KEY;

    try {
      const result = await processRepoContext({
        projectRoot,
        context,
        candidateScores: [selectedScore],
        runDate,
        startedAt: runDate.toISOString()
      });

      expect(result.status).toBe("failed");
      expect(result.failure_reason).toContain("Preparation complete");
      expect(await readdir(path.join(projectRoot, "knowledge", "patterns"))).toEqual([]);
      expect(await readdir(path.join(projectRoot, "knowledge", "cards"))).toEqual([]);
      expect(await readdir(path.join(projectRoot, "knowledge", "indexes"))).toEqual([]);
      await expect(readdir(path.join(projectRoot, "work_contexts"))).rejects.toThrow();
    } finally {
      if (previousMode === undefined) delete process.env.EXTRACTOR_MODE;
      else process.env.EXTRACTOR_MODE = previousMode;
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });

  test("rejects unsafe run identities and ambiguous selected candidates before writing", async () => {
    const runDate = new Date("2026-07-12T08:00:00.000Z");

    const unsafeRoot = await mkdtemp(path.join(tmpdir(), "pattern-unsafe-run-"));
    const unsafeContext = createFixtureRepoContext("../escape", runDate);
    const unsafeScore = { ...scoreRepoContext(unsafeContext, runDate), selected: true };
    await expect(processRepoContext({
      projectRoot: unsafeRoot,
      context: unsafeContext,
      candidateScores: [unsafeScore],
      runDate,
      startedAt: runDate.toISOString()
    })).rejects.toThrow("Preparation run id invalid");
    await expect(access(path.join(unsafeRoot, "knowledge", "escape"))).rejects.toThrow();

    const ambiguousRoot = await mkdtemp(path.join(tmpdir(), "pattern-ambiguous-selection-"));
    const context = createFixtureRepoContext("run-ambiguous", runDate);
    const score = { ...scoreRepoContext(context, runDate), selected: true };
    await expect(processRepoContext({
      projectRoot: ambiguousRoot,
      context,
      candidateScores: [score, { ...score }],
      runDate,
      startedAt: runDate.toISOString()
    })).rejects.toThrow("exactly one selected candidate");

    await expect(processRepoContext({
      projectRoot: ambiguousRoot,
      context,
      candidateScores: [{ ...score, repo: "other/repo" }],
      runDate,
      startedAt: runDate.toISOString()
    })).rejects.toThrow("selected candidate repository mismatch");
  });
});
