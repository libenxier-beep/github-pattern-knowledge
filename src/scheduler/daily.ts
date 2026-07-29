import path from "node:path";
import { randomUUID } from "node:crypto";
import { lstat, open, readFile, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import { getKnowledgePaths, shortHash } from "../utils/paths";
import { ensureDir } from "../utils/fs";
import type { DailyRunResult, RepoContext, RepoScore, SeedRepo } from "../types";
import { ensureKnowledgeScaffold } from "../knowledge/scaffold";
import { GitHubClient } from "../github/client";
import { discoverGitHubRepos } from "../discovery/discoverRepos";
import { ingestRepo } from "../ingestion/ingestRepo";
import { createFixtureRepoContext } from "../fixtures/fixtureRepo";
import { scoreRepoContext } from "../scoring/scoreRepo";
import { localDateString } from "../utils/date";
import { getPendingSeeds } from "../seeds/seedPool";
import { readLearnedRepoRegistry, learnedRepoSet } from "../knowledge/repoRegistry";
import { processRepoContext } from "./processRepo";
import { acquireRunLease, inspectRunLease } from "./runLease";
import { writeJson } from "../utils/fs";

export type RunDailyOptions = {
  projectRoot?: string;
  forceFixture?: boolean;
  skipSeeds?: boolean;
  runDate?: Date;
};

const activeDailyKnowledgeRoots = new Set<string>();
const DAILY_LOCK_FILE = ".github-pattern-knowledge-daily.lock";

type DailyLockOwner = {
  pid: number;
  hostname: string;
  started_at: string;
  token: string;
};

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}

function parseDailyLockOwner(raw: string): DailyLockOwner | null {
  try {
    const owner = JSON.parse(raw) as Partial<DailyLockOwner> | null;
    if (
      !owner ||
      !Number.isInteger(owner.pid) ||
      (owner.pid ?? 0) <= 0 ||
      typeof owner.hostname !== "string" ||
      owner.hostname.length === 0 ||
      typeof owner.started_at !== "string" ||
      owner.started_at.length === 0 ||
      typeof owner.token !== "string" ||
      owner.token.length === 0
    ) {
      return null;
    }
    return owner as DailyLockOwner;
  } catch {
    return null;
  }
}

function isDefinitelyDeadLocalOwner(owner: DailyLockOwner): boolean {
  if (owner.hostname !== hostname()) return false;
  try {
    process.kill(owner.pid, 0);
    return false;
  } catch (error) {
    return errorCode(error) === "ESRCH";
  }
}

async function reclaimStaleDailyLock(lockPath: string, observedRaw: string, owner: DailyLockOwner): Promise<boolean> {
  if (!isDefinitelyDeadLocalOwner(owner)) return false;
  try {
    const currentRaw = await readFile(lockPath, "utf8");
    const currentOwner = parseDailyLockOwner(currentRaw);
    if (currentRaw !== observedRaw || !currentOwner || currentOwner.token !== owner.token || !isDefinitelyDeadLocalOwner(currentOwner)) {
      return false;
    }
    await unlink(lockPath);
    return true;
  } catch (error) {
    return errorCode(error) === "ENOENT";
  }
}

export async function acquireDailyFileLock(projectRoot: string): Promise<() => Promise<void>> {
  const knowledgeRoot = getKnowledgePaths(projectRoot).knowledgeRoot;
  await ensureDir(knowledgeRoot);
  const lockPath = path.join(knowledgeRoot, DAILY_LOCK_FILE);
  const token = randomUUID();
  let handle;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      handle = await open(lockPath, "wx");
      break;
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      let ownerRaw = "";
      try {
        ownerRaw = await readFile(lockPath, "utf8");
      } catch (readError) {
        if (errorCode(readError) === "ENOENT" && attempt === 0) continue;
      }
      const owner = parseDailyLockOwner(ownerRaw);
      if (attempt === 0 && owner && (await reclaimStaleDailyLock(lockPath, ownerRaw, owner))) continue;
      throw new Error(
        `Daily run already in progress for ${knowledgeRoot}; lock owner: ${ownerRaw.trim() || "unknown owner"}`
      );
    }
  }
  if (!handle) throw new Error(`Unable to acquire daily run lock for ${knowledgeRoot}`);

  const createdIdentity = await handle.stat().then((stats) => `${stats.dev}:${stats.ino}`);
  try {
    await handle.writeFile(
      `${JSON.stringify({ pid: process.pid, hostname: hostname(), started_at: new Date().toISOString(), token })}\n`,
      "utf8"
    );
    await handle.sync();
    await handle.close();
  } catch (error) {
    await handle.close().catch(() => undefined);
    try {
      const current = await lstat(lockPath);
      if (`${current.dev}:${current.ino}` === createdIdentity) await unlink(lockPath);
    } catch (cleanupError) {
      if (errorCode(cleanupError) !== "ENOENT") throw cleanupError;
    }
    throw error;
  }

  return async () => {
    try {
      const current = JSON.parse(await readFile(lockPath, "utf8")) as { token?: string };
      if (current.token === token) await unlink(lockPath);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
  };
}

function runId(runDate: Date): string {
  return `run-${localDateString(runDate)}-${shortHash(`${runDate.toISOString()}-${Math.random()}`)}`;
}

async function trySeedContext(id: string, runDate: Date, projectRoot: string): Promise<{ context: RepoContext; scores: RepoScore[]; seed: SeedRepo } | null> {
  const [seed] = await getPendingSeeds(projectRoot);
  if (!seed) {
    return null;
  }
  const client = new GitHubClient();
  const repo = await client.getRepo(seed.repo);
  const context = await ingestRepo(client, repo, id, runDate, seed.focus);
  const score = { ...scoreRepoContext(context, runDate), selected: true };
  return { context, scores: [score], seed };
}

async function tryGitHubContext(projectRoot: string, id: string, runDate: Date): Promise<{ context: RepoContext; scores: RepoScore[] } | null> {
  const client = new GitHubClient();
  const learned = await learnedRepoSet(projectRoot);
  const repos = await discoverGitHubRepos(client, runDate, { excludeRepos: learned });
  const contexts: RepoContext[] = [];
  const scores: RepoScore[] = [];

  for (const repo of repos.filter((item) => !learned.has(item.full_name)).slice(0, 2)) {
    try {
      const context = await ingestRepo(client, repo, id, runDate);
      const score = scoreRepoContext(context, runDate);
      if (!score.rejection_reasons?.length) {
        contexts.push(context);
      }
      scores.push(score);
    } catch (error) {
      scores.push({
        repo: repo.full_name,
        url: repo.html_url,
        total_score: 0,
        engineering_quality: { score: 0, reasons: [], signals: {} },
        long_term_impact: { score: 0, reasons: [], signals: {} },
        recent_heat: { score: 0, reasons: [], signals: {} },
        selected: false,
        rejection_reasons: [error instanceof Error ? error.message : "ingestion failed"]
      });
    }
  }

  if (contexts.length === 0) {
    return null;
  }
  const ranked = contexts
    .map((context) => ({ context, score: scoreRepoContext(context, runDate) }))
    .sort((a, b) => b.score.total_score - a.score.total_score);
  const selected = ranked[0];
  const candidateScores = scores.map((score) => ({ ...score, selected: score.repo === selected.score.repo }));
  return { context: selected.context, scores: candidateScores };
}

function fixtureContext(id: string, runDate: Date): { context: RepoContext; scores: RepoScore[] } {
  const context = createFixtureRepoContext(id, runDate);
  const score = { ...scoreRepoContext(context, runDate), selected: true };
  return { context, scores: [score] };
}

async function runDailyUnlocked(options: RunDailyOptions = {}): Promise<DailyRunResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const runDate = options.runDate ?? new Date();
  const id = runId(runDate);
  const startedAt = new Date().toISOString();
  await ensureKnowledgeScaffold(projectRoot);
  if (!options.forceFixture) {
    const activeRun = await inspectRunLease(projectRoot);
    if (activeRun) throw new Error(`Unfinished automation run blocks discovery: ${activeRun.run_id}`);
  }

  let contextAndScores: { context: RepoContext; scores: RepoScore[] };
  let githubFailure: string | undefined;

  if (options.forceFixture) {
    contextAndScores = fixtureContext(id, runDate);
  } else {
    try {
      const seed = options.skipSeeds ? null : await trySeedContext(id, runDate, projectRoot);
      if (seed) {
        contextAndScores = seed;
      } else {
        const github = await tryGitHubContext(projectRoot, id, runDate);
        contextAndScores = github ?? fixtureContext(id, runDate);
        if (!github) {
          githubFailure = "GitHub seed/discovery or ingestion returned no usable candidates; fixture fallback used.";
        }
      }
    } catch (error) {
      githubFailure = error instanceof Error ? error.message : "GitHub seed/discovery failed";
      contextAndScores = fixtureContext(id, runDate);
    }
  }

  let result = await processRepoContext({
    projectRoot,
    context: contextAndScores.context,
    candidateScores: contextAndScores.scores,
    runDate,
    startedAt,
    githubFailure
  });
  if (!result.fixture) {
    const lease = await acquireRunLease(projectRoot, result.run_id, new Date(startedAt));
    result = {
      ...result,
      automation_lease: { token: lease.token, started_at: lease.started_at }
    };
    const failedRunPath = path.join(getKnowledgePaths(projectRoot).failedRunsDir, `${result.run_id}.json`);
    const { run_file: _runFile, learned_registry_count: _learned, next_pending_seed_repo: _next, ...metadata } = result;
    await writeJson(failedRunPath, metadata);
  }
  const learned = await readLearnedRepoRegistry(projectRoot);
  const pendingSeeds = await getPendingSeeds(projectRoot);
  return {
    ...result,
    learned_registry_count: learned.learned_count,
    next_pending_seed_repo: pendingSeeds[0]?.repo ?? null
  };
}

export async function runDaily(options: RunDailyOptions = {}): Promise<DailyRunResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const knowledgeRoot = getKnowledgePaths(projectRoot).knowledgeRoot;
  if (activeDailyKnowledgeRoots.has(knowledgeRoot)) {
    throw new Error(`Daily run already in progress for ${knowledgeRoot}`);
  }

  activeDailyKnowledgeRoots.add(knowledgeRoot);
  let releaseFileLock: (() => Promise<void>) | undefined;
  try {
    releaseFileLock = await acquireDailyFileLock(projectRoot);
    return await runDailyUnlocked({ ...options, projectRoot });
  } finally {
    try {
      await releaseFileLock?.();
    } finally {
      activeDailyKnowledgeRoots.delete(knowledgeRoot);
    }
  }
}
