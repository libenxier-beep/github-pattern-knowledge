import path from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { GitHubClient } from "../github/client";
import type { PatternFrontmatter } from "../types";
import { extractConcreteNames } from "./evidenceNames";
import { evidenceSupportRationale } from "./evidenceText";
import { parseMarkdown, stringifyMarkdown } from "./frontmatter";
import { getKnowledgePaths } from "../utils/paths";

type SnapshotFile = {
  path: string;
  reason?: string;
  snapshot_file?: string | null;
};

type RepoSnapshot = {
  run_id: string;
  repo: string;
  selected_files?: SnapshotFile[];
};

type EvidenceRow = {
  file: string;
  observedStructure: string;
  concreteNames: string[];
  supportRationale: string;
};

export type EvidenceBackfillResult = {
  checked: number;
  updated: number;
  skipped: Array<{ file: string; reason: string }>;
};

export type EvidenceBackfillOptions = {
  commitResolver?: (repo: string, url: string) => Promise<string | null>;
};

function isConcreteCommit(value: unknown): boolean {
  return typeof value === "string" && (/^[a-f0-9]{40}$/i.test(value) || /^fixture-[a-z0-9-]+$/i.test(value));
}

async function defaultCommitResolver(repo: string): Promise<string | null> {
  if (repo.startsWith("fixture/")) {
    return `fixture-${repo.split("/").pop() ?? "repo"}`;
  }
  const client = new GitHubClient();
  const metadata = await client.getRepo(repo);
  return client.getCommitSha(repo, metadata.default_branch);
}

function sectionBounds(body: string, section: string): { start: number; end: number } | null {
  const marker = `## ${section}`;
  const start = body.indexOf(marker);
  if (start === -1) {
    return null;
  }
  const next = body.slice(start + marker.length).search(/\n## /);
  return {
    start,
    end: next === -1 ? body.length : start + marker.length + next + 1
  };
}

function replaceSection(body: string, section: string, replacement: string, beforeSection?: string): string {
  const bounds = sectionBounds(body, section);
  if (bounds) {
    return `${body.slice(0, bounds.start).trimEnd()}\n\n${replacement.trim()}\n\n${body.slice(bounds.end).trimStart()}`;
  }
  if (beforeSection) {
    const before = sectionBounds(body, beforeSection);
    if (before) {
      return `${body.slice(0, before.start).trimEnd()}\n\n${replacement.trim()}\n\n${body.slice(before.start).trimStart()}`;
    }
  }
  return `${body.trimEnd()}\n\n${replacement.trim()}\n`;
}

function observedStructure(filePath: string, content: string, reason = ""): string {
  const lowerPath = filePath.toLowerCase();
  const lower = `${reason}\n${content}`.toLowerCase();
  if (lowerPath.includes("test") || lowerPath.includes("spec") || /\b(?:test|describe|it)\(/.test(content)) {
    return "Test or example evidence that locks the claimed boundary behavior and gives future agents a checkable contract.";
  }
  if (lowerPath.endsWith(".json") || lowerPath.endsWith(".yaml") || lowerPath.endsWith(".yml") || lowerPath.endsWith(".toml")) {
    return "Configuration or metadata evidence that exposes commands, schema, dependencies, or integration boundaries.";
  }
  if (lower.includes("registry") || lower.includes("register")) {
    return "Runtime evidence for registration ownership and extension lookup separated from feature implementation.";
  }
  if (lower.includes("router") || lower.includes("command") || lower.includes("handler")) {
    return "Runtime evidence for dispatch ownership, command mapping, or handler delegation at an explicit boundary.";
  }
  if (lower.includes("schema") || lower.includes("validate") || lower.includes("config")) {
    return "Runtime or documentation evidence for validation around a user-facing configuration boundary.";
  }
  if (lower.includes("store") || lower.includes("cache") || lower.includes("storage")) {
    return "Runtime evidence for persistence, cache lookup, or durable state mutation behind a named boundary.";
  }
  return "Selected source evidence exposing a named module, public contract, or operational integration point.";
}

async function readSnapshot(projectRoot: string, runId: string): Promise<{ snapshot: RepoSnapshot; dir: string } | null> {
  const paths = getKnowledgePaths(projectRoot);
  const dir = path.join(paths.sourcesDir, runId);
  try {
    const snapshot = JSON.parse(await readFile(path.join(dir, "repo_snapshot.json"), "utf8")) as RepoSnapshot;
    return { snapshot, dir };
  } catch {
    return null;
  }
}

async function readSnapshotContent(snapshotDir: string, selected: SnapshotFile): Promise<string> {
  if (!selected.snapshot_file) {
    return "";
  }
  try {
    return await readFile(path.join(snapshotDir, selected.snapshot_file), "utf8");
  } catch {
    return "";
  }
}

async function buildRows(projectRoot: string, frontmatter: PatternFrontmatter): Promise<EvidenceRow[]> {
  const snapshot = await readSnapshot(projectRoot, frontmatter.run_id);
  if (!snapshot) {
    return [];
  }
  const selected = snapshot.snapshot.selected_files ?? [];
  const byPath = new Map(selected.map((file) => [file.path, file]));
  const existingRefs = frontmatter.source_repos.flatMap((source) => source.reference_files ?? []);
  const refs = new Set<string>();
  for (const ref of existingRefs) {
    if (byPath.has(ref)) {
      refs.add(ref);
    }
  }
  for (const file of selected) {
    if (refs.size >= 4) {
      break;
    }
    refs.add(file.path);
  }
  if (refs.size < 2) {
    return [];
  }

  const rows: EvidenceRow[] = [];
  const patternLabel = frontmatter.pattern_types?.[0]?.replace(/_/g, " ") ?? "pattern";
  for (const ref of [...refs].slice(0, 4)) {
    const selectedFile = byPath.get(ref);
    const content = selectedFile ? await readSnapshotContent(snapshot.dir, selectedFile) : "";
    const observed = observedStructure(ref, content, selectedFile?.reason);
    const concreteNames = extractConcreteNames(content, ref);
    rows.push({
      file: ref,
      observedStructure: observed,
      concreteNames,
      supportRationale: evidenceSupportRationale(ref, observed, concreteNames, patternLabel)
    });
  }
  return rows;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function evidenceTable(rows: EvidenceRow[]): string {
  const tableRows = rows.map((row) => {
    const names = row.concreteNames.map((name) => `\`${escapeCell(name)}\``).join(", ");
    return `| \`${escapeCell(row.file)}\` | ${escapeCell(row.observedStructure)} | ${names} | ${escapeCell(row.supportRationale)} |`;
  });
  return `## Evidence Table
| Reference file | Observed structure | Concrete names | Why it supports the pattern |
| --- | --- | --- | --- |
${tableRows.join("\n")}`;
}

function sourceEvidence(frontmatter: PatternFrontmatter, rows: EvidenceRow[], commit: string): string {
  const source = frontmatter.source_repos[0];
  const refs = rows.map((row) => row.file).join(", ");
  const names = rows.flatMap((row) => row.concreteNames).slice(0, 8).map((name) => `\`${name}\``).join(", ");
  return `## Source Evidence
The source repo ${source.repo} was audited at commit ${commit}. The concrete reference files are ${refs}. The evidence names ${names} are the handles future agents should reopen in the source snapshot before applying this pattern.`;
}

async function patternFiles(projectRoot: string): Promise<string[]> {
  const paths = getKnowledgePaths(projectRoot);
  try {
    const entries = await readdir(paths.patternsDir);
    return entries.filter((entry) => entry.endsWith(".md")).map((entry) => path.join(paths.patternsDir, entry));
  } catch {
    return [];
  }
}

export async function backfillPatternEvidence(projectRoot = process.cwd(), options: EvidenceBackfillOptions = {}): Promise<EvidenceBackfillResult> {
  const commitResolver = options.commitResolver ?? defaultCommitResolver;
  const commitCache = new Map<string, string | null>();
  const skipped: EvidenceBackfillResult["skipped"] = [];
  let updated = 0;
  const files = await patternFiles(projectRoot);

  for (const file of files) {
    const markdown = await readFile(file, "utf8");
    const parsed = parseMarkdown<PatternFrontmatter>(markdown);
    const source = parsed.frontmatter.source_repos?.[0];
    if (!source) {
      skipped.push({ file, reason: "missing source repo" });
      continue;
    }
    const rows = await buildRows(projectRoot, parsed.frontmatter);
    if (rows.length < 2) {
      skipped.push({ file, reason: "fewer than two source snapshot evidence rows" });
      continue;
    }
    let commit = isConcreteCommit(source.commit) ? source.commit : commitCache.get(source.repo);
    if (commit === undefined) {
      commit = await commitResolver(source.repo, source.url);
      commitCache.set(source.repo, commit);
    }
    if (!commit || !isConcreteCommit(commit)) {
      skipped.push({ file, reason: "could not resolve concrete commit" });
      continue;
    }

    const nextFrontmatter: PatternFrontmatter = {
      ...parsed.frontmatter,
      source_repos: [
        {
          ...source,
          commit,
          reference_files: rows.map((row) => row.file)
        },
        ...parsed.frontmatter.source_repos.slice(1)
      ],
      evidence_strength: parsed.frontmatter.evidence_strength === "strong" ? "strong" : "medium",
      maturity: parsed.frontmatter.maturity ?? "experimental",
      risk_level: parsed.frontmatter.risk_level ?? parsed.frontmatter.complexity,
      updated_at: new Date().toISOString().slice(0, 10)
    };
    const withTable = replaceSection(parsed.body, "Evidence Table", evidenceTable(rows), "Source Evidence");
    const nextBody = replaceSection(withTable, "Source Evidence", sourceEvidence(nextFrontmatter, rows, commit));
    await writeFile(file, stringifyMarkdown(nextFrontmatter as unknown as Record<string, unknown>, nextBody), "utf8");
    updated += 1;
  }

  return { checked: files.length, updated, skipped };
}
