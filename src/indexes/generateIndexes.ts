import path from "node:path";
import type { PatternFrontmatter } from "../types";
import { parseMarkdown } from "../knowledge/frontmatter";
import { ensureDir, listMarkdownFiles, writeJson } from "../utils/fs";
import { toKnowledgeRelative } from "../utils/paths";
import { readFile } from "node:fs/promises";

export type PatternIndexEntry = {
  id: string;
  name: string;
  summary: string;
  file: string;
  engineering_problems: string[];
  project_types: string[];
  pattern_types: string[];
  complexity: string;
  quality_score: number;
  source_repos: string[];
  transfer_targets: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type AxisEntry = {
  id: string;
  name: string;
  summary: string;
  quality_score: number;
  complexity: string;
  file: string;
  engineering_problems: string[];
  project_types: string[];
  pattern_types: string[];
  transfer_targets: string[];
  source_repos: string[];
  tags: string[];
};

export type IndexBundle = {
  index: {
    generated_at: string;
    pattern_count: number;
    patterns: PatternIndexEntry[];
  };
  by_engineering_problem: Record<string, AxisEntry[]>;
  by_project_type: Record<string, AxisEntry[]>;
  by_pattern_type: Record<string, AxisEntry[]>;
  by_complexity: Record<string, AxisEntry[]>;
  by_transfer_target: Record<string, AxisEntry[]>;
  by_source_repo: Record<string, AxisEntry[]>;
  by_tag: Record<string, AxisEntry[]>;
  written_files: string[];
};

export type GenerateIndexesOptions = {
  patternsDir: string;
  indexesDir: string;
  projectRoot: string;
  knowledgeRoot?: string;
};

function toEntry(projectRoot: string, filePath: string, frontmatter: PatternFrontmatter, knowledgeRoot?: string): PatternIndexEntry {
  return {
    id: frontmatter.id,
    name: frontmatter.name,
    summary: frontmatter.summary,
    file: toKnowledgeRelative(projectRoot, filePath, knowledgeRoot),
    engineering_problems: frontmatter.engineering_problems,
    project_types: frontmatter.project_types,
    pattern_types: frontmatter.pattern_types,
    complexity: frontmatter.complexity,
    quality_score: frontmatter.quality_score,
    source_repos: frontmatter.source_repos.map((source) => source.repo),
    transfer_targets: frontmatter.transfer_targets,
    tags: frontmatter.tags ?? [],
    created_at: frontmatter.created_at,
    updated_at: frontmatter.updated_at
  };
}

function toAxisEntry(entry: PatternIndexEntry): AxisEntry {
  return {
    id: entry.id,
    name: entry.name,
    summary: entry.summary,
    quality_score: entry.quality_score,
    complexity: entry.complexity,
    file: entry.file,
    engineering_problems: entry.engineering_problems,
    project_types: entry.project_types,
    pattern_types: entry.pattern_types,
    transfer_targets: entry.transfer_targets,
    source_repos: entry.source_repos,
    tags: entry.tags
  };
}

function pushAxis(target: Record<string, AxisEntry[]>, key: string, entry: AxisEntry): void {
  if (!target[key]) {
    target[key] = [];
  }
  target[key].push(entry);
}

function sortEntries<T extends { quality_score: number; updated_at?: string }>(entries: T[]): T[] {
  return entries.sort((a, b) => {
    const quality = b.quality_score - a.quality_score;
    if (quality !== 0) {
      return quality;
    }
    return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
  });
}

function sortAxis(axis: Record<string, AxisEntry[]>): void {
  for (const key of Object.keys(axis)) {
    axis[key] = sortEntries(axis[key]);
  }
}

function canonicalId(name: string): string {
  return `canonical-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function buildCanonicalIndex(entries: PatternIndexEntry[], sourceIndex: string): Record<string, unknown> {
  const groups = new Map<string, PatternIndexEntry[]>();
  for (const entry of entries) {
    const current = groups.get(entry.name) ?? [];
    current.push(entry);
    groups.set(entry.name, current);
  }
  const patterns = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) => {
    const sorted = [...group].sort((a, b) => b.quality_score - a.quality_score || b.updated_at.localeCompare(a.updated_at));
    return {
      canonical_id: canonicalId(name),
      name,
      summary: sorted[0].summary,
      canonical_group_key: name.toLowerCase(),
      evidence_count: group.length,
      quality_score_min: Math.min(...group.map((item) => item.quality_score)),
      quality_score_max: Math.max(...group.map((item) => item.quality_score)),
      engineering_problems: uniqueSorted(group.flatMap((item) => item.engineering_problems)),
      project_types: uniqueSorted(group.flatMap((item) => item.project_types)),
      pattern_types: uniqueSorted(group.flatMap((item) => item.pattern_types)),
      transfer_targets: uniqueSorted(group.flatMap((item) => item.transfer_targets)),
      tags: uniqueSorted(group.flatMap((item) => item.tags)),
      source_repos: uniqueSorted(group.flatMap((item) => item.source_repos)),
      evidence: sorted.map((item) => ({
        id: item.id,
        file: item.file,
        source_repos: item.source_repos,
        quality_score: item.quality_score,
        project_types: item.project_types,
        complexity: item.complexity,
        updated_at: item.updated_at
      }))
    };
  });
  return {
    generated_at: new Date().toISOString(),
    source_index: sourceIndex,
    purpose: "Canonical grouping layer that separates complete engineering-loop concepts from per-repository evidence samples.",
    path_policy: "All file paths are repo-relative.",
    pattern_count: entries.length,
    canonical_count: patterns.length,
    duplicate_group_count: patterns.filter((item) => Number(item.evidence_count) > 1).length,
    patterns
  };
}

export async function generateIndexes(options: GenerateIndexesOptions): Promise<IndexBundle> {
  await ensureDir(options.indexesDir);
  const files = await listMarkdownFiles(options.patternsDir);
  const entries: PatternIndexEntry[] = [];

  for (const file of files) {
    const markdown = await readFile(file, "utf8");
    const { frontmatter } = parseMarkdown<PatternFrontmatter>(markdown);
    if (!frontmatter.id) {
      continue;
    }
    entries.push(toEntry(options.projectRoot, file, frontmatter, options.knowledgeRoot));
  }

  sortEntries(entries);
  const bundle: IndexBundle = {
    index: {
      generated_at: new Date().toISOString(),
      pattern_count: entries.length,
      patterns: entries
    },
    by_engineering_problem: {},
    by_project_type: {},
    by_pattern_type: {},
    by_complexity: {},
    by_transfer_target: {},
    by_source_repo: {},
    by_tag: {},
    written_files: []
  };

  for (const entry of entries) {
    const axisEntry = toAxisEntry(entry);
    entry.engineering_problems.forEach((key) => pushAxis(bundle.by_engineering_problem, key, axisEntry));
    entry.project_types.forEach((key) => pushAxis(bundle.by_project_type, key, axisEntry));
    entry.pattern_types.forEach((key) => pushAxis(bundle.by_pattern_type, key, axisEntry));
    pushAxis(bundle.by_complexity, entry.complexity, axisEntry);
    entry.transfer_targets.forEach((key) => pushAxis(bundle.by_transfer_target, key, axisEntry));
    entry.source_repos.forEach((key) => pushAxis(bundle.by_source_repo, key, axisEntry));
    entry.tags.forEach((key) => pushAxis(bundle.by_tag, key, axisEntry));
  }

  sortAxis(bundle.by_engineering_problem);
  sortAxis(bundle.by_project_type);
  sortAxis(bundle.by_pattern_type);
  sortAxis(bundle.by_complexity);
  sortAxis(bundle.by_transfer_target);
  sortAxis(bundle.by_source_repo);
  sortAxis(bundle.by_tag);

  const filesToWrite: Array<[string, unknown]> = [
    ["index.json", bundle.index],
    ["by_engineering_problem.json", bundle.by_engineering_problem],
    ["by_project_type.json", bundle.by_project_type],
    ["by_pattern_type.json", bundle.by_pattern_type],
    ["by_complexity.json", bundle.by_complexity],
    ["by_transfer_target.json", bundle.by_transfer_target],
    ["by_source_repo.json", bundle.by_source_repo],
    ["by_tag.json", bundle.by_tag],
    [
      "canonical_patterns.json",
      buildCanonicalIndex(entries, toKnowledgeRelative(options.projectRoot, path.join(options.indexesDir, "index.json"), options.knowledgeRoot))
    ]
  ];

  for (const [fileName, value] of filesToWrite) {
    const fullPath = path.join(options.indexesDir, fileName);
    await writeJson(fullPath, value);
    bundle.written_files.push(toKnowledgeRelative(options.projectRoot, fullPath, options.knowledgeRoot));
  }

  return bundle;
}
