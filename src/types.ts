export type Complexity = "low" | "medium" | "high";
export type EvidenceStrength = "weak" | "medium" | "strong";
export type Maturity = "experimental" | "stable" | "battle_tested";

export type Taxonomy = {
  engineering_problems: string[];
  project_types: string[];
  pattern_types: string[];
  transfer_targets: string[];
};

export type SourceRepoRef = {
  repo: string;
  url: string;
  commit: string;
  reference_files: string[];
};

export type PatternFrontmatter = {
  id: string;
  name: string;
  summary: string;
  engineering_problems: string[];
  project_types: string[];
  pattern_types: string[];
  complexity: Complexity;
  quality_score: number;
  source_repos: SourceRepoRef[];
  use_when: string[];
  avoid_when: string[];
  tradeoffs: string[];
  transfer_targets: string[];
  related_patterns: string[];
  created_at: string;
  updated_at: string;
  run_id: string;
  aliases?: string[];
  evidence_strength?: EvidenceStrength;
  maturity?: Maturity;
  source_languages?: string[];
  source_frameworks?: string[];
  risk_level?: Complexity;
  tags?: string[];
};

export type PatternDraft = {
  frontmatter: PatternFrontmatter;
  body: string;
};

export type ParsedMarkdown<T = Record<string, unknown>> = {
  frontmatter: T;
  body: string;
};

export type RepoMetadata = {
  stars: number;
  forks: number;
  open_issues: number;
  language: string | null;
  topics: string[];
  archived: boolean;
  fork: boolean;
  pushed_at: string;
  updated_at: string;
  created_at: string;
  default_branch?: string;
  description?: string | null;
  license?: string | null;
  releases_count?: number;
};

export type SelectedFile = {
  path: string;
  reason: string;
  content?: string;
  truncated: boolean;
  size?: number;
};

export type RepoContext = {
  run_id: string;
  repo: string;
  url: string;
  default_branch: string;
  commit_sha: string;
  fixture: boolean;
  metadata: RepoMetadata;
  tree_summary: string[];
  selected_files: SelectedFile[];
  readme_excerpt: string;
  package_metadata: Array<{ path: string; excerpt: string }>;
  fetched_at: string;
  truncation: {
    files_truncated: number;
    context_truncated: boolean;
  };
  seed_focus?: string[];
  seed_rank?: number;
};

export type ScoreBreakdown = {
  score: number;
  reasons: string[];
  signals: Record<string, boolean | number | string | null>;
};

export type RepoScore = {
  repo: string;
  url: string;
  total_score: number;
  engineering_quality: ScoreBreakdown;
  long_term_impact: ScoreBreakdown;
  recent_heat: ScoreBreakdown;
  selected: boolean;
  rejection_reasons?: string[];
};

export type HarnessResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checked_at: string;
};

export type CardFrontmatter = {
  date: string;
  source_repo: string;
  source_url: string;
  patterns: string[];
  card_type: "daily_design_card";
  run_id: string;
  created_at: string;
};

export type RunMetadata = {
  run_id: string;
  date: string;
  status: "success" | "failed";
  fixture: boolean;
  candidate_scores: RepoScore[];
  selected_repo: RepoScore;
  added_patterns: string[];
  rejected_patterns: string[];
  updated_indexes: string[];
  generated_card: string | null;
  source_snapshot: string | null;
  harness_result: {
    accepted: number;
    rejected: number;
    errors: Record<string, string[]>;
  };
  failure_reason?: string;
  started_at: string;
  finished_at: string;
};

export type DailyRunResult = RunMetadata & {
  run_file: string;
};

export type SeedRepo = {
  rank: number;
  repo: string;
  url: string;
  priority: "p1" | "p2" | "p3";
  focus: string[];
};

export type LearnedRepoRecord = {
  repo: string;
  url: string;
  learned_at: string;
  run_id: string;
  pattern_files: string[];
};

export type LearnedRepoRegistry = {
  generated_at: string;
  learned_count: number;
  repos: LearnedRepoRecord[];
};
