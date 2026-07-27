import path from "node:path";
import type { DailyRunResult, RepoContext, RepoScore, RunMetadata } from "../types";
import { writeJson } from "../utils/fs";
import { getKnowledgePaths, toKnowledgeRelative } from "../utils/paths";
import { writeSourceSnapshot } from "../ingestion/ingestRepo";
import { localDateString } from "../utils/date";

export type ProcessRepoOptions = {
  projectRoot: string;
  context: RepoContext;
  candidateScores: RepoScore[];
  runDate: Date;
  startedAt: string;
  githubFailure?: string;
};

function normalizeRepo(value: string): string {
  return value.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}

function validatePreparationInput(options: ProcessRepoOptions): RepoScore {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(options.context.run_id)) {
    throw new Error("Preparation run id invalid");
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(options.context.repo.trim())) {
    throw new Error("Preparation repository invalid");
  }
  const selected = options.candidateScores.filter((score) => score.selected);
  if (selected.length !== 1) {
    throw new Error("Preparation requires exactly one selected candidate");
  }
  if (normalizeRepo(selected[0].repo) !== normalizeRepo(options.context.repo)) {
    throw new Error("Preparation selected candidate repository mismatch");
  }
  return selected[0];
}

export async function processRepoContext(options: ProcessRepoOptions): Promise<DailyRunResult> {
  const selectedScore = validatePreparationInput(options);
  const paths = getKnowledgePaths(options.projectRoot);
  const sourceSnapshot = await writeSourceSnapshot(options.projectRoot, options.context);
  const finishedAt = new Date().toISOString();
  const metadata: RunMetadata = {
    run_id: options.context.run_id,
    date: localDateString(options.runDate),
    status: "failed",
    fixture: options.context.fixture,
    candidate_scores: options.candidateScores,
    selected_repo: selectedScore,
    added_patterns: [],
    promoted_patterns: [],
    routed_patterns: [],
    rejected_patterns: [],
    updated_indexes: [],
    generated_card: null,
    source_snapshot: sourceSnapshot,
    harness_result: {
      accepted: 0,
      rejected: 0,
      errors: {}
    },
    failure_reason: options.githubFailure ?? "Preparation complete; canonical publication requires commit-bound deep finalization",
    started_at: options.startedAt,
    finished_at: finishedAt
  };

  const runPath = path.join(paths.failedRunsDir, `${metadata.run_id}.json`);
  await writeJson(runPath, metadata);
  return { ...metadata, run_file: toKnowledgeRelative(options.projectRoot, runPath, paths.knowledgeRoot) };
}
