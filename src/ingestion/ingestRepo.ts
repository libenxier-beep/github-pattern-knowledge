import path from "node:path";
import { writeFile } from "node:fs/promises";
import { GitHubClient, type GitHubSearchRepo, toRepoMetadata } from "../github/client";
import type { RepoContext, SelectedFile } from "../types";
import { ensureDir, truncateText, writeJson } from "../utils/fs";
import { getKnowledgePaths, safeKebab, toProjectRelative } from "../utils/paths";

const MAX_FILE_CHARS = 20_000;
const MAX_SELECTED_FILES = 12;
const MAX_CONTEXT_CHARS = 150_000;

const METADATA_FILES = ["package.json", "pyproject.toml", "cargo.toml", "go.mod", "composer.json", "Gemfile", "deno.json", "pnpm-workspace.yaml"];
const TEXT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".md", ".json", ".toml", ".yaml", ".yml", ".mjs", ".cjs"];
const KEYWORDS = ["plugin", "registry", "provider", "command", "router", "config", "pipeline", "workflow", "task", "storage", "store", "retry", "checkpoint", "auth", "schema"];

function textLike(filePath: string): boolean {
  return TEXT_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

function focusWords(seedFocus: string[]): string[] {
  return seedFocus.flatMap((item) => item.toLowerCase().split(/[_-]+/)).filter((item) => item.length > 2);
}

function selectTreeFiles(tree: Array<{ path: string; type: string; size?: number }>, seedFocus: string[] = []): Array<{ path: string; reason: string; size?: number }> {
  const keywords = [...new Set([...KEYWORDS, ...focusWords(seedFocus)])];
  const files = tree
    .filter((item) => item.type === "blob")
    .filter((item) => item.size === undefined || item.size < 120_000)
    .filter((item) => textLike(item.path))
    .filter((item) => !/(^|\/)(node_modules|\.git|dist|build|coverage|\.next)\//.test(item.path));

  const scored = files.map((item) => {
    const lower = item.path.toLowerCase();
    let score = 0;
    const reasons: string[] = [];
    if (METADATA_FILES.some((name) => lower.endsWith(name.toLowerCase()))) {
      score += 20;
      reasons.push("package metadata");
    }
    if (/^(src|lib|packages)\//.test(lower)) {
      score += 10;
      reasons.push("source boundary");
    }
    if (/^(docs|examples|tests|test|__tests__)\//.test(lower) || lower.includes(".test.") || lower.includes(".spec.")) {
      score += 8;
      reasons.push("docs/examples/tests evidence");
    }
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += 14;
        reasons.push(`${keyword} signal`);
      }
    }
    if (lower.endsWith("readme.md")) {
      score += 6;
      reasons.push("readme");
    }
    return { ...item, score, reason: reasons.slice(0, 3).join(", ") || "representative text file" };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SELECTED_FILES)
    .map(({ path: filePath, reason, size }) => ({ path: filePath, reason, size }));
}

export async function ingestRepo(client: GitHubClient, repo: GitHubSearchRepo, runId: string, now = new Date(), seedFocus: string[] = []): Promise<RepoContext> {
  const releasesCount = await client.getReleaseCount(repo.full_name);
  const metadata = toRepoMetadata(repo, releasesCount);
  const tree = await client.getTree(repo.full_name, repo.default_branch);
  const readme = await client.getReadme(repo.full_name);
  const selected = selectTreeFiles(tree, seedFocus);
  const selectedFiles: SelectedFile[] = [];
  let contextChars = readme.length;
  let filesTruncated = 0;

  for (const item of selected) {
    if (contextChars >= MAX_CONTEXT_CHARS) {
      filesTruncated += 1;
      continue;
    }
    try {
      const content = await client.getFileText(repo.full_name, repo.default_branch, item.path);
      const remaining = Math.max(0, MAX_CONTEXT_CHARS - contextChars);
      const { text, truncated } = truncateText(content, Math.min(MAX_FILE_CHARS, remaining));
      selectedFiles.push({ path: item.path, reason: item.reason, content: text, truncated, size: item.size });
      contextChars += text.length;
      if (truncated) {
        filesTruncated += 1;
      }
    } catch {
      selectedFiles.push({ path: item.path, reason: `${item.reason}; content fetch failed`, truncated: true, size: item.size });
      filesTruncated += 1;
    }
  }

  const packageMetadata = selectedFiles
    .filter((file) => METADATA_FILES.some((name) => file.path.toLowerCase().endsWith(name.toLowerCase())) && file.content)
    .map((file) => ({ path: file.path, excerpt: truncateText(file.content ?? "", 2000).text }));

  return {
    run_id: runId,
    repo: repo.full_name,
    url: repo.html_url,
    default_branch: repo.default_branch,
    fixture: false,
    metadata,
    tree_summary: tree.map((item) => item.path).slice(0, 2000),
    selected_files: selectedFiles,
    readme_excerpt: truncateText(readme, 4000).text,
    package_metadata: packageMetadata,
    fetched_at: now.toISOString(),
    truncation: {
      files_truncated: filesTruncated,
      context_truncated: contextChars >= MAX_CONTEXT_CHARS
    },
    seed_focus: seedFocus.length ? seedFocus : undefined
  };
}

export async function writeSourceSnapshot(projectRoot: string, context: RepoContext): Promise<string> {
  const paths = getKnowledgePaths(projectRoot);
  const runSourceDir = path.join(paths.sourcesDir, context.run_id);
  const selectedDir = path.join(runSourceDir, "selected_files");
  await ensureDir(selectedDir);

  const selectedForSnapshot = [];
  for (const file of context.selected_files) {
    const safeName = `${safeKebab(file.path)}.txt`;
    if (file.content) {
      await writeFile(path.join(selectedDir, safeName), file.content, "utf8");
    }
    selectedForSnapshot.push({
      path: file.path,
      reason: file.reason,
      truncated: file.truncated,
      size: file.size,
      snapshot_file: file.content ? `selected_files/${safeName}` : null
    });
  }

  const snapshotPath = path.join(runSourceDir, "repo_snapshot.json");
  await writeJson(snapshotPath, {
    run_id: context.run_id,
    repo: context.repo,
    url: context.url,
    fixture: context.fixture,
    metadata: context.metadata,
    tree_summary: context.tree_summary,
    readme_excerpt: context.readme_excerpt,
    package_metadata: context.package_metadata,
    selected_files: selectedForSnapshot,
    fetched_at: context.fetched_at,
    truncation: context.truncation
  });
  return toProjectRelative(projectRoot, snapshotPath);
}
