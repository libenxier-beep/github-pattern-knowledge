import { createHash } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists, readJson, writeJson } from "../utils/fs";
import { getKnowledgePaths, getWorkContextsRoot, toKnowledgeRelative } from "../utils/paths";
import { readLearnedRepoRegistry } from "../knowledge/repoRegistry";
import { abortRunLease, completeRunLease, inspectRunLease } from "./runLease";

type PublicationEntry = {
  target_file: string;
  target_path: string;
  staged_path: string;
};

type JournalEntry = {
  target_file: string;
  staged_file: string;
  staged_sha256: string;
  before_sha256: string | null;
  before_base64: string | null;
};

type PublicationJournal = {
  schema_version: 1;
  run_id: string;
  state: "publishing" | "committed" | "rolled_back";
  started_at: string;
  finished_at?: string;
  entries: JournalEntry[];
};

export type PublicationRecovery = {
  run_id: string;
  action: "rolled_back" | "completed_commit";
  journal_file: string;
};

function journalPath(projectRoot: string, runId: string): string {
  return path.join(getKnowledgePaths(projectRoot).sourcesDir, runId, "publication-transaction.json");
}

function assertWithin(file: string, root: string, label: string): void {
  const resolved = path.resolve(file);
  const authority = path.resolve(root);
  if (resolved === authority || !resolved.startsWith(`${authority}${path.sep}`)) {
    throw new Error(`Publication ${label} escapes its authority: ${file}`);
  }
}

async function snapshot(file: string): Promise<string | null> {
  try {
    return (await readFile(file)).toString("base64");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    if (code === "ENOENT") return null;
    throw error;
  }
}

function resolveTarget(projectRoot: string, locator: string): string {
  const workContextsRoot = getWorkContextsRoot(projectRoot);
  const relative = locator.startsWith("work_contexts/") ? locator.slice("work_contexts/".length) : locator;
  const resolved = path.resolve(workContextsRoot, relative);
  assertWithin(resolved, workContextsRoot, "target");
  return resolved;
}

async function restore(projectRoot: string, entry: JournalEntry): Promise<void> {
  const targetPath = resolveTarget(projectRoot, entry.target_file);
  const current = await snapshot(targetPath);
  const currentHash = current === null ? null : createHash("sha256").update(Buffer.from(current, "base64")).digest("hex");
  if (currentHash !== entry.staged_sha256 && currentHash !== entry.before_sha256) {
    throw new Error(`Publication rollback target changed outside the active transaction: ${entry.target_file}`);
  }
  if (entry.before_base64 !== null) {
    await ensureDir(path.dirname(targetPath));
    await writeFile(targetPath, Buffer.from(entry.before_base64, "base64"));
    return;
  }
  try {
    await unlink(targetPath);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    if (code !== "ENOENT") throw error;
  }
}

export async function beginPublicationTransaction(
  projectRoot: string,
  runId: string,
  entries: PublicationEntry[]
): Promise<string | null> {
  if (entries.length === 0) return null;
  const file = journalPath(projectRoot, runId);
  if (await pathExists(file)) {
    const existing = await readJson<PublicationJournal>(file);
    if (existing.state === "committed") return file;
    if (existing.state === "publishing") {
      throw new Error(`Unresolved publication transaction exists for ${runId}: ${existing.state}`);
    }
  }
  const workContextsRoot = getWorkContextsRoot(projectRoot);
  const knowledgePaths = getKnowledgePaths(projectRoot);
  const sourcesDir = knowledgePaths.sourcesDir;
  const journalEntries: JournalEntry[] = [];
  for (const entry of entries) {
    assertWithin(entry.target_path, workContextsRoot, "target");
    assertWithin(entry.staged_path, sourcesDir, "staging file");
    const stagedBytes = await readFile(entry.staged_path);
    const beforeBase64 = await snapshot(entry.target_path);
    journalEntries.push({
      target_file: entry.target_file,
      staged_file: toKnowledgeRelative(projectRoot, entry.staged_path, knowledgePaths.knowledgeRoot),
      staged_sha256: createHash("sha256").update(stagedBytes).digest("hex"),
      before_sha256: beforeBase64 === null
        ? null
        : createHash("sha256").update(Buffer.from(beforeBase64, "base64")).digest("hex"),
      before_base64: beforeBase64
    });
  }
  await writeJson(file, {
    schema_version: 1,
    run_id: runId,
    state: "publishing",
    started_at: new Date().toISOString(),
    entries: journalEntries
  } satisfies PublicationJournal);
  return file;
}

export async function finishPublicationTransaction(
  projectRoot: string,
  runId: string,
  state: "committed" | "rolled_back"
): Promise<void> {
  const file = journalPath(projectRoot, runId);
  if (!(await pathExists(file))) return;
  const journal = await readJson<PublicationJournal>(file);
  await writeJson(file, { ...journal, state, finished_at: new Date().toISOString() });
}

export async function rollbackPublicationTransaction(projectRoot: string, runId: string): Promise<void> {
  const file = journalPath(projectRoot, runId);
  if (!(await pathExists(file))) return;
  const journal = await readJson<PublicationJournal>(file);
  for (const entry of journal.entries) await restore(projectRoot, entry);
  await finishPublicationTransaction(projectRoot, runId, "rolled_back");
}

export async function recoverInterruptedPublication(projectRoot: string): Promise<PublicationRecovery | null> {
  const active = await inspectRunLease(projectRoot);
  if (!active) return null;
  const file = journalPath(projectRoot, active.run_id);
  if (!(await pathExists(file))) return null;
  const journal = await readJson<PublicationJournal>(file);
  if (journal.run_id !== active.run_id || journal.state !== "publishing") return null;

  const registry = await readLearnedRepoRegistry(projectRoot);
  const registryCommitted = registry.repos.some((record) => record.status === "accepted" && record.run_id === active.run_id);
  if (registryCommitted) {
    await finishPublicationTransaction(projectRoot, active.run_id, "committed");
    await completeRunLease(projectRoot, active.run_id, active.token);
    return { run_id: active.run_id, action: "completed_commit", journal_file: file };
  }

  await rollbackPublicationTransaction(projectRoot, active.run_id);
  await abortRunLease(projectRoot, active.run_id, "deterministically rolled back an interrupted publication");
  return { run_id: active.run_id, action: "rolled_back", journal_file: file };
}
