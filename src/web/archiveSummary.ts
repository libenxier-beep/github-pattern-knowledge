import path from "node:path";
import type { LearnedRepoRecord, LearnedRepoRegistry, SeedRepo } from "../types";
import { pathExists, readJson } from "../utils/fs";
import { getKnowledgePaths } from "../utils/paths";

type SeedManifest = {
  generated_at?: string;
  seed_count?: number;
  repos?: SeedRepo[];
};

export type ArchiveRepoStatus = "learned" | "legacy_unreviewed" | "quarantined" | "pending";

export type ArchiveRepoRow = {
  repo: string;
  url: string;
  status: ArchiveRepoStatus;
  rank: number | null;
  priority: SeedRepo["priority"] | null;
  focus: string[];
  learned_at: string | null;
  run_id: string | null;
  pattern_count: number;
  pattern_files: string[];
};

export type ArchiveSummary = {
  generated_at: string;
  seed_registry_generated_at: string | null;
  learned_registry_generated_at: string | null;
  seed_count: number;
  learned_count: number;
  pending_count: number;
  repos: ArchiveRepoRow[];
  skip_rule: string;
};

function normalizeRepo(repo: string): string {
  return repo.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "").toLowerCase();
}

function blocksReingestion(repo: LearnedRepoRecord): boolean {
  return repo.status === undefined || repo.status === "accepted";
}

function archiveStatus(repo: LearnedRepoRecord): ArchiveRepoStatus {
  if (repo.status === undefined || repo.status === "accepted") return "learned";
  if (repo.status === "quarantined") return "quarantined";
  return "legacy_unreviewed";
}

async function readJsonIfExists<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await pathExists(filePath))) {
    return fallback;
  }
  return readJson<T>(filePath);
}

function toLearnedRow(seed: SeedRepo | undefined, learned: LearnedRepoRecord): ArchiveRepoRow {
  return {
    repo: learned.repo,
    url: learned.url,
    status: archiveStatus(learned),
    rank: seed?.rank ?? null,
    priority: seed?.priority ?? null,
    focus: seed?.focus ?? [],
    learned_at: learned.learned_at,
    run_id: learned.run_id,
    pattern_count: learned.pattern_files.length,
    pattern_files: learned.pattern_files
  };
}

function toPendingRow(seed: SeedRepo): ArchiveRepoRow {
  return {
    repo: seed.repo,
    url: seed.url,
    status: "pending",
    rank: seed.rank,
    priority: seed.priority,
    focus: seed.focus,
    learned_at: null,
    run_id: null,
    pattern_count: 0,
    pattern_files: []
  };
}

export async function buildArchiveSummary(projectRoot = process.cwd()): Promise<ArchiveSummary> {
  const paths = getKnowledgePaths(projectRoot);
  const registryDir = path.join(paths.knowledgeRoot, "registry");
  const seedRegistryPath = path.join(registryDir, "seed_repos.json");
  const learnedRegistryPath = path.join(registryDir, "learned_repos.json");
  const seedRegistry = await readJsonIfExists<SeedManifest>(seedRegistryPath, { repos: [] });
  const learnedRegistry = await readJsonIfExists<LearnedRepoRegistry>(learnedRegistryPath, {
    generated_at: new Date().toISOString(),
    learned_count: 0,
    repos: []
  });

  const seeds = [...(seedRegistry.repos ?? [])].sort((a, b) => a.rank - b.rank);
  const seedsByRepo = new Map(seeds.map((seed) => [normalizeRepo(seed.repo), seed]));
  const learnedByRepo = new Map(learnedRegistry.repos.map((repo) => [normalizeRepo(repo.repo), repo]));
  const acceptedRepos = new Set(learnedRegistry.repos.filter(blocksReingestion).map((repo) => normalizeRepo(repo.repo)));
  const rows: ArchiveRepoRow[] = [];

  for (const seed of seeds) {
    const learned = learnedByRepo.get(normalizeRepo(seed.repo));
    rows.push(learned ? toLearnedRow(seed, learned) : toPendingRow(seed));
  }

  for (const learned of learnedRegistry.repos) {
    if (!seedsByRepo.has(normalizeRepo(learned.repo))) {
      rows.push(toLearnedRow(undefined, learned));
    }
  }

  rows.sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    return a.repo.localeCompare(b.repo);
  });

  return {
    generated_at: new Date().toISOString(),
    seed_registry_generated_at: seedRegistry.generated_at ?? null,
    learned_registry_generated_at: learnedRegistry.generated_at ?? null,
    seed_count: seedRegistry.seed_count ?? seeds.length,
    learned_count: acceptedRepos.size,
    pending_count: seeds.filter((seed) => !acceptedRepos.has(normalizeRepo(seed.repo))).length,
    repos: rows,
    skip_rule: "Seed and daily ingestion skip only accepted records in registry/learned_repos.json; legacy_unreviewed and quarantined records remain eligible for a proper deep dive."
  };
}
