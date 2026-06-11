import path from "node:path";
import { DEFAULT_SEED_REPOS } from "./defaultSeedRepos";
import type { SeedRepo } from "../types";
import { ensureDir, pathExists, readJson, writeJson } from "../utils/fs";
import { getKnowledgePaths } from "../utils/paths";
import { learnedRepoSet } from "../knowledge/repoRegistry";

function seedManifestPath(projectRoot: string): string {
  return path.join(getKnowledgePaths(projectRoot).knowledgeRoot, "registry", "seed_repos.json");
}

export async function ensureSeedManifest(projectRoot = process.cwd()): Promise<string> {
  const filePath = seedManifestPath(projectRoot);
  await ensureDir(path.dirname(filePath));
  await writeJson(filePath, {
    generated_at: new Date().toISOString(),
    source: "user-provided GPT-5.5 Pro seed pool, updated replacement list on 2026-06-11",
    scoring_hint: {
      engineering_quality: 0.6,
      long_term_impact: 0.25,
      recent_heat: 0.15
    },
    seed_count: DEFAULT_SEED_REPOS.length,
    repos: DEFAULT_SEED_REPOS
  });
  return filePath;
}

export async function readSeedRepos(projectRoot = process.cwd()): Promise<SeedRepo[]> {
  const filePath = seedManifestPath(projectRoot);
  if (!(await pathExists(filePath))) {
    await ensureSeedManifest(projectRoot);
  }
  const manifest = await readJson<{ repos: SeedRepo[] }>(filePath);
  return manifest.repos.sort((a, b) => a.rank - b.rank);
}

export async function getPendingSeeds(projectRoot = process.cwd()): Promise<SeedRepo[]> {
  const seeds = await readSeedRepos(projectRoot);
  const learned = await learnedRepoSet(projectRoot);
  return seeds.filter((seed) => !learned.has(seed.repo));
}
