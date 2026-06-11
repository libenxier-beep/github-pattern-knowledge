import path from "node:path";
import type { LearnedRepoRecord, LearnedRepoRegistry } from "../types";
import { ensureDir, pathExists, readJson, writeJson } from "../utils/fs";
import { getKnowledgePaths } from "../utils/paths";

function registryPath(projectRoot: string): string {
  return path.join(getKnowledgePaths(projectRoot).knowledgeRoot, "registry", "learned_repos.json");
}

function normalizeRepo(repo: string): string {
  return repo.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
}

export async function readLearnedRepoRegistry(projectRoot = process.cwd()): Promise<LearnedRepoRegistry> {
  const filePath = registryPath(projectRoot);
  if (!(await pathExists(filePath))) {
    return {
      generated_at: new Date().toISOString(),
      learned_count: 0,
      repos: []
    };
  }
  const registry = await readJson<LearnedRepoRegistry>(filePath);
  return {
    generated_at: registry.generated_at,
    learned_count: registry.repos.length,
    repos: registry.repos
  };
}

export async function writeLearnedRepoRegistry(projectRoot: string, registry: LearnedRepoRegistry): Promise<string> {
  const filePath = registryPath(projectRoot);
  await ensureDir(path.dirname(filePath));
  const sorted = [...registry.repos].sort((a, b) => a.repo.localeCompare(b.repo));
  await writeJson(filePath, {
    generated_at: new Date().toISOString(),
    learned_count: sorted.length,
    repos: sorted
  });
  return filePath;
}

export async function markRepoLearned(projectRoot: string, record: LearnedRepoRecord): Promise<string> {
  const registry = await readLearnedRepoRegistry(projectRoot);
  const repo = normalizeRepo(record.repo);
  const existing = new Map(registry.repos.map((item) => [normalizeRepo(item.repo), item]));
  existing.set(repo, { ...record, repo });
  return writeLearnedRepoRegistry(projectRoot, {
    generated_at: new Date().toISOString(),
    learned_count: existing.size,
    repos: [...existing.values()]
  });
}

export async function isRepoLearned(projectRoot: string, repo: string): Promise<boolean> {
  const registry = await readLearnedRepoRegistry(projectRoot);
  const normalized = normalizeRepo(repo);
  return registry.repos.some((record) => normalizeRepo(record.repo) === normalized);
}

export async function learnedRepoSet(projectRoot: string): Promise<Set<string>> {
  const registry = await readLearnedRepoRegistry(projectRoot);
  return new Set(registry.repos.map((record) => normalizeRepo(record.repo)));
}
