import path from "node:path";
import { shortHash } from "../utils/paths";
import type { DailyRunResult, RepoContext, RepoScore, SeedRepo } from "../types";
import { ensureKnowledgeScaffold } from "../knowledge/scaffold";
import { GitHubClient } from "../github/client";
import { discoverGitHubRepos } from "../discovery/discoverRepos";
import { ingestRepo } from "../ingestion/ingestRepo";
import { createFixtureRepoContext } from "../fixtures/fixtureRepo";
import { scoreRepoContext } from "../scoring/scoreRepo";
import { localDateString } from "../utils/date";
import { getPendingSeeds } from "../seeds/seedPool";
import { learnedRepoSet } from "../knowledge/repoRegistry";
import { processRepoContext } from "./processRepo";

export type RunDailyOptions = {
  projectRoot?: string;
  forceFixture?: boolean;
  skipSeeds?: boolean;
  runDate?: Date;
};

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
  const repos = await discoverGitHubRepos(client, runDate);
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

export async function runDaily(options: RunDailyOptions = {}): Promise<DailyRunResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const runDate = options.runDate ?? new Date();
  const id = runId(runDate);
  const startedAt = new Date().toISOString();
  await ensureKnowledgeScaffold(projectRoot);

  let contextAndScores: { context: RepoContext; scores: RepoScore[] };
  let githubFailure: string | undefined;
  let markLearned = false;
  let learnedRepo: string | undefined;
  let learnedUrl: string | undefined;

  if (options.forceFixture) {
    contextAndScores = fixtureContext(id, runDate);
  } else {
    try {
      const seed = options.skipSeeds ? null : await trySeedContext(id, runDate, projectRoot);
      if (seed) {
        contextAndScores = seed;
        markLearned = true;
        learnedRepo = seed.seed.repo;
        learnedUrl = seed.seed.url;
      } else {
        const github = await tryGitHubContext(projectRoot, id, runDate);
        contextAndScores = github ?? fixtureContext(id, runDate);
        markLearned = Boolean(github);
        if (!github) {
          githubFailure = "GitHub seed/discovery or ingestion returned no usable candidates; fixture fallback used.";
        }
      }
    } catch (error) {
      githubFailure = error instanceof Error ? error.message : "GitHub seed/discovery failed";
      contextAndScores = fixtureContext(id, runDate);
    }
  }

  return processRepoContext({
    projectRoot,
    context: contextAndScores.context,
    candidateScores: contextAndScores.scores,
    runDate,
    startedAt,
    githubFailure,
    markLearned,
    learnedRepo,
    learnedUrl
  });
}
