import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { DEFAULT_SEED_REPOS } from "../src/seeds/defaultSeedRepos";
import { ensureSeedManifest, getPendingSeeds } from "../src/seeds/seedPool";
import { markRepoLearned, readLearnedRepoRegistry } from "../src/knowledge/repoRegistry";
import { getKnowledgePaths } from "../src/utils/paths";

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

  test("pending seed lookup reopens legacy-only repos for a proper deep dive", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "seed-registry-legacy-"));
    await markRepoLearned(projectRoot, {
      repo: "git/git",
      url: "https://github.com/git/git",
      learned_at: "2026-06-11T00:00:00.000Z",
      run_id: "seed-legacy",
      pattern_files: ["github_engineering_patterns/sources/runs/legacy/review_queue/git.md"]
    });
    const registryPath = path.join(getKnowledgePaths(projectRoot).knowledgeRoot, "registry", "learned_repos.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8"));
    registry.repos[0].status = "legacy_unreviewed";
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const pending = await getPendingSeeds(projectRoot);

    expect(pending.some((seed) => seed.repo === "git/git")).toBe(true);
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(0);
  });

  test("ensureSeedManifest preserves user-edited seed repos and only appends missing defaults", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "seed-merge-"));
    const registryDir = path.join(getKnowledgePaths(projectRoot).knowledgeRoot, "registry");
    await ensureSeedManifest(projectRoot);
    const seedPath = path.join(registryDir, "seed_repos.json");
    await writeFile(
      seedPath,
      JSON.stringify(
        {
          generated_at: "manual",
          source: "manual edit",
          seed_count: 1,
          repos: [
            { rank: 1, repo: "git/git", url: "https://github.com/git/git", priority: "p1", focus: ["manual_focus"] },
            { rank: 999, repo: "owner/custom", url: "https://github.com/owner/custom", priority: "p3", focus: ["custom"] }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    await ensureSeedManifest(projectRoot);
    const manifest = JSON.parse(await readFile(seedPath, "utf8"));
    const gitSeed = manifest.repos.find((repo: { repo: string }) => repo.repo === "git/git");
    const customSeed = manifest.repos.find((repo: { repo: string }) => repo.repo === "owner/custom");

    expect(manifest.source).toBe("manual edit");
    expect(gitSeed.focus).toEqual(["manual_focus"]);
    expect(customSeed).toBeTruthy();
    expect(manifest.repos).toHaveLength(61);
    expect(manifest.seed_count).toBe(61);
  });
});
