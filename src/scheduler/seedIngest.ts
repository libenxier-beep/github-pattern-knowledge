import path from "node:path";
import type { DailyRunResult, RepoScore, SeedRepo } from "../types";
import { ensureKnowledgeScaffold } from "../knowledge/scaffold";
import { ensureSeedManifest, getPendingSeeds } from "../seeds/seedPool";
import { GitHubClient } from "../github/client";
import { ingestRepo } from "../ingestion/ingestRepo";
import { scoreRepoContext } from "../scoring/scoreRepo";
import { processRepoContext } from "./processRepo";
import { localDateString } from "../utils/date";
import { shortHash } from "../utils/paths";
import { getKnowledgePaths } from "../utils/paths";
import { writeJson } from "../utils/fs";

export type SeedIngestOptions = {
  projectRoot?: string;
  limit?: number;
  runDate?: Date;
  repos?: string[];
};

export type SeedIngestSummary = {
  batch_id: string;
  date: string;
  requested_count: number;
  processed_count: number;
  success_count: number;
  failure_count: number;
  remaining_count: number;
  results: Array<
    | { repo: string; status: "success"; run_id: string; added_patterns: string[]; generated_card: string | null }
    | { repo: string; status: "failed"; error: string }
  >;
  summary_file: string;
};

function repoRunId(seed: SeedRepo, runDate: Date): string {
  const slug = seed.repo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `seed-${localDateString(runDate)}-${String(seed.rank).padStart(2, "0")}-${slug}-${shortHash(`${seed.repo}-${runDate.toISOString()}`)}`;
}

function selectedScore(contextRepo: string, score: RepoScore): RepoScore {
  return {
    ...score,
    repo: contextRepo,
    selected: true
  };
}

export async function runSeedIngest(options: SeedIngestOptions = {}): Promise<SeedIngestSummary> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const runDate = options.runDate ?? new Date();
  await ensureKnowledgeScaffold(projectRoot);
  await ensureSeedManifest(projectRoot);
  const pending = await getPendingSeeds(projectRoot);
  const requested = options.repos?.length
    ? pending.filter((seed) => options.repos?.includes(seed.repo))
    : pending.slice(0, options.limit ?? pending.length);
  const client = new GitHubClient();
  const results: SeedIngestSummary["results"] = [];

  for (const seed of requested) {
    try {
      const repo = await client.getRepo(seed.repo);
      const context = await ingestRepo(client, repo, repoRunId(seed, runDate), runDate, seed.focus);
      context.seed_rank = seed.rank;
      const score = selectedScore(context.repo, scoreRepoContext(context, runDate));
      const run: DailyRunResult = await processRepoContext({
        projectRoot,
        context,
        candidateScores: [score],
        runDate,
        startedAt: new Date().toISOString()
      });
      if (run.status === "success") {
        results.push({
          repo: seed.repo,
          status: "success",
          run_id: run.run_id,
          added_patterns: run.added_patterns,
          generated_card: run.generated_card
        });
      } else {
        results.push({
          repo: seed.repo,
          status: "failed",
          error: run.failure_reason ?? "No pattern draft passed harness"
        });
      }
    } catch (error) {
      results.push({
        repo: seed.repo,
        status: "failed",
        error: error instanceof Error ? error.message : "unknown seed ingest failure"
      });
      const message = error instanceof Error ? error.message : "";
      if (message.includes("API rate limit exceeded") || message.includes("403")) {
        break;
      }
    }
  }

  const remaining = await getPendingSeeds(projectRoot);
  const paths = getKnowledgePaths(projectRoot);
  const batchId = `seed-batch-${localDateString(runDate)}-${shortHash(`${runDate.toISOString()}-${results.length}`)}`;
  const summaryPath = path.join(paths.runsDir, `${batchId}.json`);
  const summary: Omit<SeedIngestSummary, "summary_file"> = {
    batch_id: batchId,
    date: localDateString(runDate),
    requested_count: requested.length,
    processed_count: results.length,
    success_count: results.filter((item) => item.status === "success").length,
    failure_count: results.filter((item) => item.status === "failed").length,
    remaining_count: remaining.length,
    results
  };
  await writeJson(summaryPath, summary);
  return { ...summary, summary_file: summaryPath };
}
