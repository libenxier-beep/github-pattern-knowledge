import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { DEFAULT_SEED_REPOS } from "../src/seeds/defaultSeedRepos";
import { getPendingSeeds } from "../src/seeds/seedPool";
import { markRepoLearned } from "../src/knowledge/repoRegistry";

describe("seed repository pool", () => {
  test("contains the replaced 60-repo seed pool without removed repos", () => {
    const repos = DEFAULT_SEED_REPOS.map((seed) => seed.repo);
    const added = ["git/git", "curl/curl", "nodejs/node", "redis/redis", "hashicorp/vault", "envoyproxy/envoy", "getsentry/sentry", "elastic/elasticsearch"];
    const removed = [
      "modelcontextprotocol/typescript-sdk",
      "vercel/ai",
      "langchain-ai/langgraph",
      "langchain-ai/langchain",
      "microsoft/autogen",
      "crewAIInc/crewAI",
      "jupyterlab/jupyterlab",
      "microsoft/vscode"
    ];

    expect(repos).toHaveLength(60);
    expect(new Set(repos).size).toBe(60);
    for (const repo of added) {
      expect(repos).toContain(repo);
    }
    for (const repo of removed) {
      expect(repos).not.toContain(repo);
    }
  });

  test("pending seed lookup skips repos already recorded as learned", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "seed-registry-"));
    await markRepoLearned(projectRoot, {
      repo: "git/git",
      url: "https://github.com/git/git",
      learned_at: "2026-06-11T00:00:00.000Z",
      run_id: "seed-test",
      pattern_files: ["patterns/example.md"]
    });

    const pending = await getPendingSeeds(projectRoot);

    expect(pending).toHaveLength(59);
    expect(pending[0].repo).toBe("pytest-dev/pytest");
    expect(pending.some((seed) => seed.repo === "git/git")).toBe(false);
  });
});
