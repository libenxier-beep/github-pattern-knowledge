import type { RepoContext, RepoScore, Taxonomy } from "../types";
import { truncateText } from "../utils/fs";

const MAX_FILE_EXCERPT = 12_000;
const MAX_README_EXCERPT = 4_000;
const MAX_TREE_ITEMS = 400;

export type EvidencePackFile = {
  path: string;
  reason: string;
  content_excerpt: string;
  truncated: boolean;
  size?: number;
};

export type EvidencePack = {
  repo: string;
  url: string;
  commit_sha: string;
  default_branch: string;
  metadata: RepoContext["metadata"];
  seed_focus?: string[];
  score?: RepoScore;
  taxonomy: Taxonomy;
  readme_excerpt: string;
  tree_summary: string[];
  package_metadata: RepoContext["package_metadata"];
  selected_files: EvidencePackFile[];
};

export function buildEvidencePack(context: RepoContext, taxonomy: Taxonomy, score?: RepoScore): EvidencePack {
  return {
    repo: context.repo,
    url: context.url,
    commit_sha: context.commit_sha,
    default_branch: context.default_branch,
    metadata: context.metadata,
    seed_focus: context.seed_focus,
    score,
    taxonomy,
    readme_excerpt: truncateText(context.readme_excerpt, MAX_README_EXCERPT).text,
    tree_summary: context.tree_summary.slice(0, MAX_TREE_ITEMS),
    package_metadata: context.package_metadata,
    selected_files: context.selected_files.map((file) => {
      const excerpt = truncateText(file.content ?? "", MAX_FILE_EXCERPT);
      return {
        path: file.path,
        reason: file.reason,
        content_excerpt: excerpt.text,
        truncated: file.truncated || excerpt.truncated,
        size: file.size
      };
    })
  };
}
