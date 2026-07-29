import path from "node:path";
import os from "node:os";
import { readFileSync } from "node:fs";

export type KnowledgePaths = {
  projectRoot: string;
  knowledgeRoot: string;
  patternsDir: string;
  indexesDir: string;
  cardsDir: string;
  rejectedPatternsDir: string;
  rejectedCardsDir: string;
  sourcesDir: string;
  schemasDir: string;
  runsDir: string;
  failedRunsDir: string;
};

export function getProjectRoot(projectRoot = process.cwd()): string {
  return path.resolve(projectRoot);
}

export function isGitHubPatternKnowledgeCheckout(projectRoot = process.cwd()): boolean {
  const root = getProjectRoot(projectRoot);
  const canonicalProjectRoot = path.join(os.homedir(), ".codex", "system-projects", "github-pattern-knowledge");
  if (root === canonicalProjectRoot) return true;
  try {
    const contract = readFileSync(path.join(root, "REPOSITORY.md"), "utf8");
    return /^repository_id:\s*github-pattern-knowledge\s*$/m.test(contract);
  } catch {
    return false;
  }
}

export function getKnowledgePaths(projectRoot = process.cwd()): KnowledgePaths {
  const root = getProjectRoot(projectRoot);
  const configuredRoot = process.env.KNOWLEDGE_ROOT;
  const defaultWorkContextRoot = path.join(os.homedir(), ".codex", "memories", "work_contexts", "github_engineering_patterns");
  const knowledgeRoot = path.resolve(
    configuredRoot ?? (isGitHubPatternKnowledgeCheckout(root) ? defaultWorkContextRoot : path.join(root, "knowledge"))
  );
  return {
    projectRoot: root,
    knowledgeRoot,
    patternsDir: path.join(knowledgeRoot, "patterns"),
    indexesDir: path.join(knowledgeRoot, "indexes"),
    cardsDir: path.join(knowledgeRoot, "cards"),
    rejectedPatternsDir: path.join(knowledgeRoot, "rejected", "patterns"),
    rejectedCardsDir: path.join(knowledgeRoot, "rejected", "cards"),
    sourcesDir: path.join(knowledgeRoot, "sources"),
    schemasDir: path.join(knowledgeRoot, "schemas"),
    runsDir: path.join(knowledgeRoot, "runs"),
    failedRunsDir: path.join(knowledgeRoot, "runs", "failed")
  };
}

export function toProjectRelative(projectRoot: string, filePath: string): string {
  const relative = path.relative(projectRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return path.resolve(filePath);
  }
  return relative.split(path.sep).join("/");
}

export function toKnowledgeRelative(projectRoot: string, filePath: string, knowledgeRoot = getKnowledgePaths(projectRoot).knowledgeRoot): string {
  const relative = path.relative(knowledgeRoot, filePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return path.join(path.basename(knowledgeRoot), relative).split(path.sep).join("/");
  }
  return toProjectRelative(projectRoot, filePath);
}

export function getWorkContextsRoot(projectRoot?: string): string {
  const configuredRoot = process.env.WORK_CONTEXTS_ROOT;
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }
  const configuredKnowledgeRoot = process.env.KNOWLEDGE_ROOT;
  if (configuredKnowledgeRoot) {
    return path.dirname(path.resolve(configuredKnowledgeRoot));
  }
  if (projectRoot && !isGitHubPatternKnowledgeCheckout(projectRoot)) {
    return path.join(path.resolve(projectRoot), "work_contexts");
  }
  return path.resolve(path.join(os.homedir(), ".codex", "memories", "work_contexts"));
}

export function toWorkContextRelative(filePath: string, workContextsRoot = getWorkContextsRoot()): string {
  const relative = path.relative(workContextsRoot, filePath);
  return path.join("work_contexts", relative).split(path.sep).join("/");
}

export function safeKebab(input: string, fallback = "item"): string {
  const value = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return value || fallback;
}

export function shortHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).slice(0, 4);
}
