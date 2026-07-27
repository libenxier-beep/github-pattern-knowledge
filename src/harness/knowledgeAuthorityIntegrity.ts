import { readFile, realpath, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CardFrontmatter, PatternFrontmatter } from "../types";
import { canonicalizePortableLocator } from "../deepDive/valueFunction";
import { parseMarkdown } from "../knowledge/frontmatter";
import { readLearnedRepoRegistry } from "../knowledge/repoRegistry";
import { listMarkdownFiles } from "../utils/fs";
import { getKnowledgePaths, getWorkContextsRoot, toProjectRelative } from "../utils/paths";

export type KnowledgeAuthorityIssueReason =
  | "active_pattern_parse_error"
  | "active_card_parse_error"
  | "duplicate_active_pattern_id"
  | "active_source_repo_not_accepted"
  | "active_card_source_repo_not_accepted"
  | "related_pattern_unresolved"
  | "accepted_registry_locator_invalid"
  | "accepted_registry_file_missing"
  | "absolute_local_path_in_active_artifact";

export type KnowledgeAuthorityIssue = {
  reason: KnowledgeAuthorityIssueReason;
  file?: string;
  value?: string;
};

export type KnowledgeAuthorityIntegrityResult = {
  valid: boolean;
  checked_active_patterns: number;
  checked_active_cards: number;
  checked_related_patterns: number;
  checked_registry_files: number;
  issues: KnowledgeAuthorityIssue[];
};

function normalizeRepo(value: string): string {
  return value.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}

function hasLocalAbsolutePath(markdown: string): boolean {
  const unixAbsolutePath = /(?:^|[\s("'`])\/(?!\/)(?:[^/\s"'`)]+\/)+[^/\s"'`)]+/m;
  const windowsAbsolutePath = /(?:^|[\s("'`])[A-Za-z]:[\\/](?![\\/])[^\s"'`)]+/m;
  return unixAbsolutePath.test(markdown) || windowsAbsolutePath.test(markdown) || markdown.includes("file://");
}

async function isRegularFileWithin(file: string, authorityRoot: string): Promise<boolean> {
  try {
    if (!(await stat(file)).isFile()) return false;
    const [actualFile, actualRoot] = await Promise.all([realpath(file), realpath(authorityRoot)]);
    return actualFile.startsWith(`${actualRoot}${path.sep}`);
  } catch {
    return false;
  }
}

function registryTarget(
  projectRoot: string,
  locatorValue: string
): { file: string; authorityRoot: string } | null {
  const locator = canonicalizePortableLocator(locatorValue);
  if (!locator.safe || !locator.canonical_form) return null;
  const knowledgeRoot = getKnowledgePaths(projectRoot).knowledgeRoot;
  const workContextsRoot = getWorkContextsRoot(projectRoot);
  if (locator.canonical.startsWith("work_contexts/")) {
    return {
      file: path.resolve(workContextsRoot, locator.canonical.slice("work_contexts/".length)),
      authorityRoot: workContextsRoot
    };
  }
  const knowledgePrefix = `${path.basename(knowledgeRoot)}/`;
  if (locator.canonical.startsWith(knowledgePrefix)) {
    return {
      file: path.resolve(knowledgeRoot, locator.canonical.slice(knowledgePrefix.length)),
      authorityRoot: knowledgeRoot
    };
  }
  return {
    file: path.resolve(workContextsRoot, locator.canonical),
    authorityRoot: workContextsRoot
  };
}

async function allowedRelatedIds(projectRoot: string, activePatternFiles: string[]): Promise<Set<string>> {
  const workContextsRoot = getWorkContextsRoot(projectRoot);
  let siblingFiles: string[] = [];
  try {
    await readdir(workContextsRoot);
    siblingFiles = await listMarkdownFiles(workContextsRoot);
  } catch {
    siblingFiles = [];
  }
  const explicitTargets = siblingFiles.filter((file) => {
    const relative = path.relative(workContextsRoot, file).split(path.sep);
    return relative[1] === "patterns" || relative.includes("routed_patterns");
  });
  const ids = new Set<string>();
  for (const file of [...new Set([...activePatternFiles, ...explicitTargets])]) {
    try {
      const { frontmatter } = parseMarkdown<{ id?: unknown }>(await readFile(file, "utf8"));
      if (typeof frontmatter.id === "string" && frontmatter.id.trim()) ids.add(frontmatter.id.trim());
    } catch {
      // Active parse failures are reported by the main pass; malformed routed targets cannot satisfy a relation.
    }
  }
  return ids;
}

export async function validateKnowledgeAuthorityIntegrity(
  projectRoot = process.cwd()
): Promise<KnowledgeAuthorityIntegrityResult> {
  const root = path.resolve(projectRoot);
  const knowledgePaths = getKnowledgePaths(root);
  const activePatternFiles = await listMarkdownFiles(knowledgePaths.patternsDir);
  const activeCardFiles = await listMarkdownFiles(knowledgePaths.cardsDir);
  const registry = await readLearnedRepoRegistry(root);
  const acceptedRepos = new Set(
    registry.repos
      .filter((record) => record.status === undefined || record.status === "accepted")
      .map((record) => normalizeRepo(record.repo))
  );
  const relatedIds = await allowedRelatedIds(root, activePatternFiles);
  const activeIds = new Set<string>();
  const issues: KnowledgeAuthorityIssue[] = [];
  let checkedRelatedPatterns = 0;

  for (const file of activePatternFiles) {
    const portableFile = toProjectRelative(root, file);
    let markdown = "";
    let frontmatter: PatternFrontmatter;
    try {
      markdown = await readFile(file, "utf8");
      ({ frontmatter } = parseMarkdown<PatternFrontmatter>(markdown));
    } catch {
      issues.push({ reason: "active_pattern_parse_error", file: portableFile });
      continue;
    }
    if (activeIds.has(frontmatter.id)) {
      issues.push({ reason: "duplicate_active_pattern_id", file: portableFile, value: frontmatter.id });
    }
    activeIds.add(frontmatter.id);
    if (hasLocalAbsolutePath(markdown)) {
      issues.push({ reason: "absolute_local_path_in_active_artifact", file: portableFile });
    }
    for (const source of Array.isArray(frontmatter.source_repos) ? frontmatter.source_repos : []) {
      if (typeof source?.repo === "string" && !acceptedRepos.has(normalizeRepo(source.repo))) {
        issues.push({
          reason: "active_source_repo_not_accepted",
          file: portableFile,
          value: source.repo
        });
      }
    }
    for (const related of Array.isArray(frontmatter.related_patterns) ? frontmatter.related_patterns : []) {
      if (typeof related !== "string") continue;
      checkedRelatedPatterns += 1;
      if (!relatedIds.has(related)) {
        issues.push({ reason: "related_pattern_unresolved", file: portableFile, value: related });
      }
    }
  }

  for (const file of activeCardFiles) {
    const portableFile = toProjectRelative(root, file);
    try {
      const markdown = await readFile(file, "utf8");
      const { frontmatter } = parseMarkdown<CardFrontmatter>(markdown);
      if (!acceptedRepos.has(normalizeRepo(frontmatter.source_repo ?? ""))) {
        issues.push({
          reason: "active_card_source_repo_not_accepted",
          file: portableFile,
          value: frontmatter.source_repo
        });
      }
      if (hasLocalAbsolutePath(markdown)) {
        issues.push({ reason: "absolute_local_path_in_active_artifact", file: portableFile });
      }
    } catch {
      issues.push({ reason: "active_card_parse_error", file: portableFile });
    }
  }

  let checkedRegistryFiles = 0;
  for (const record of registry.repos.filter((item) => item.status === undefined || item.status === "accepted")) {
    for (const locator of Array.isArray(record.pattern_files) ? record.pattern_files : []) {
      checkedRegistryFiles += 1;
      const target = registryTarget(root, locator);
      if (!target) {
        issues.push({ reason: "accepted_registry_locator_invalid", value: `${record.repo}:${locator}` });
      } else if (!(await isRegularFileWithin(target.file, target.authorityRoot))) {
        issues.push({ reason: "accepted_registry_file_missing", value: `${record.repo}:${locator}` });
      }
    }
  }

  return {
    valid: issues.length === 0,
    checked_active_patterns: activePatternFiles.length,
    checked_active_cards: activeCardFiles.length,
    checked_related_patterns: checkedRelatedPatterns,
    checked_registry_files: checkedRegistryFiles,
    issues
  };
}
