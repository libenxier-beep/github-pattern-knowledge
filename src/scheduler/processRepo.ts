import path from "node:path";
import type { DailyRunResult, RepoContext, RepoScore, RunMetadata } from "../types";
import { writeJson } from "../utils/fs";
import { getKnowledgePaths, toProjectRelative } from "../utils/paths";
import { loadTaxonomy } from "../knowledge/taxonomy";
import { scoreRepoContext } from "../scoring/scoreRepo";
import { createExtractor } from "../extraction/createExtractor";
import { writePatternDraft } from "../knowledge/patternWriter";
import { generateIndexes } from "../indexes/generateIndexes";
import { generateDailyCard } from "../cards/generateCard";
import { writeSourceSnapshot } from "../ingestion/ingestRepo";
import { localDateString } from "../utils/date";
import { markRepoLearned } from "../knowledge/repoRegistry";

export type ProcessRepoOptions = {
  projectRoot: string;
  context: RepoContext;
  candidateScores: RepoScore[];
  runDate: Date;
  startedAt: string;
  githubFailure?: string;
  markLearned?: boolean;
  learnedRepo?: string;
  learnedUrl?: string;
};

export async function processRepoContext(options: ProcessRepoOptions): Promise<DailyRunResult> {
  const paths = getKnowledgePaths(options.projectRoot);
  const taxonomy = await loadTaxonomy(options.projectRoot);
  const sourceSnapshot = await writeSourceSnapshot(options.projectRoot, options.context);
  const selectedScore =
    options.candidateScores.find((score) => score.selected) ?? { ...scoreRepoContext(options.context, options.runDate), selected: true };
  const { extractor } = createExtractor({ taxonomy, projectRoot: options.projectRoot });
  const drafts = await extractor.extractPatterns(options.context, selectedScore, options.runDate);
  const addedPatterns: string[] = [];
  const rejectedPatterns: string[] = [];
  const harnessErrors: Record<string, string[]> = {};

  for (const draft of drafts) {
    const outcome = await writePatternDraft(options.projectRoot, draft, taxonomy);
    if (outcome.accepted) {
      addedPatterns.push(outcome.file);
    } else {
      rejectedPatterns.push(outcome.file);
      harnessErrors[outcome.file] = outcome.result.errors;
    }
  }

  const indexBundle = await generateIndexes({
    patternsDir: paths.patternsDir,
    indexesDir: paths.indexesDir,
    projectRoot: options.projectRoot
  });
  const acceptedIds = addedPatterns.map((file) => path.basename(file, ".md"));
  const card = await generateDailyCard(options.projectRoot, options.context, acceptedIds, drafts, options.runDate);
  const finishedAt = new Date().toISOString();
  const metadata: RunMetadata = {
    run_id: options.context.run_id,
    date: localDateString(options.runDate),
    status: addedPatterns.length > 0 ? "success" : "failed",
    fixture: options.context.fixture,
    candidate_scores: options.candidateScores,
    selected_repo: selectedScore,
    added_patterns: addedPatterns,
    rejected_patterns: rejectedPatterns,
    updated_indexes: indexBundle.written_files,
    generated_card: card,
    source_snapshot: sourceSnapshot,
    harness_result: {
      accepted: addedPatterns.length,
      rejected: rejectedPatterns.length,
      errors: harnessErrors
    },
    failure_reason: addedPatterns.length > 0 ? options.githubFailure : options.githubFailure ?? "No pattern draft passed harness",
    started_at: options.startedAt,
    finished_at: finishedAt
  };

  const runPath = path.join(metadata.status === "success" ? paths.runsDir : paths.failedRunsDir, `${metadata.run_id}.json`);
  await writeJson(runPath, metadata);
  if (metadata.status === "success" && options.markLearned && !options.context.fixture) {
    await markRepoLearned(options.projectRoot, {
      repo: options.learnedRepo ?? options.context.repo,
      url: options.learnedUrl ?? options.context.url,
      learned_at: finishedAt,
      run_id: options.context.run_id,
      pattern_files: addedPatterns
    });
  }
  return { ...metadata, run_file: toProjectRelative(options.projectRoot, runPath) };
}
