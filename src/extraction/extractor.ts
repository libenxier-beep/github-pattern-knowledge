import type { PatternDraft, RepoContext, RepoScore } from "../types";

export interface PatternExtractor {
  extractPatterns(input: RepoContext, score?: RepoScore, runDate?: Date): Promise<PatternDraft[]>;
}
