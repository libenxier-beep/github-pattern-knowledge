import { randomUUID } from "node:crypto";
import { open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { ensureDir, writeJson } from "../utils/fs";
import { getKnowledgePaths } from "../utils/paths";

const RUN_LEASE_FILE = ".github-pattern-knowledge-active-run.json";

export type RunLease = {
  schema_version: 1;
  run_id: string;
  token: string;
  started_at: string;
  hostname: string;
  phase: "prepared";
};

export type RecoveredRunLease = RunLease & {
  recovered_at: string;
  recovery_reason: "lease_expired" | "caller_aborted";
  detail?: string;
};

function leasePath(projectRoot: string): string {
  return path.join(getKnowledgePaths(projectRoot).knowledgeRoot, RUN_LEASE_FILE);
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}

function validLease(value: unknown): value is RunLease {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const lease = value as Partial<RunLease>;
  return lease.schema_version === 1 &&
    typeof lease.run_id === "string" && lease.run_id.length > 0 &&
    typeof lease.token === "string" && lease.token.length > 0 &&
    typeof lease.started_at === "string" && Number.isFinite(Date.parse(lease.started_at)) &&
    typeof lease.hostname === "string" && lease.hostname.length > 0 &&
    lease.phase === "prepared";
}

export async function inspectRunLease(projectRoot: string): Promise<RunLease | null> {
  try {
    const parsed = JSON.parse(await readFile(leasePath(projectRoot), "utf8")) as unknown;
    if (!validLease(parsed)) throw new Error("Active automation run lease is invalid");
    return parsed;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

export async function acquireRunLease(projectRoot: string, runId: string, startedAt = new Date()): Promise<RunLease> {
  const knowledgeRoot = getKnowledgePaths(projectRoot).knowledgeRoot;
  await ensureDir(knowledgeRoot);
  const file = leasePath(projectRoot);
  const lease: RunLease = {
    schema_version: 1,
    run_id: runId,
    token: randomUUID(),
    started_at: startedAt.toISOString(),
    hostname: hostname(),
    phase: "prepared"
  };
  let handle;
  try {
    handle = await open(file, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(lease, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    return lease;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (errorCode(error) === "EEXIST") {
      const active = await inspectRunLease(projectRoot).catch(() => null);
      throw new Error(`Unfinished automation run blocks discovery: ${active?.run_id ?? "unknown"}`);
    }
    throw error;
  }
}

export async function completeRunLease(projectRoot: string, runId: string, token: string): Promise<void> {
  const active = await inspectRunLease(projectRoot);
  if (!active) return;
  if (active.run_id !== runId || active.token !== token) {
    throw new Error(`Automation run lease owner mismatch: active=${active.run_id}, requested=${runId}`);
  }
  await unlink(leasePath(projectRoot));
}

export async function recoverExpiredRunLease(
  projectRoot: string,
  now = new Date(),
  maxAgeMs = 18 * 60 * 60 * 1000
): Promise<RecoveredRunLease | null> {
  const active = await inspectRunLease(projectRoot);
  if (!active) return null;
  if (now.getTime() - Date.parse(active.started_at) < maxAgeMs) return null;

  const recovered: RecoveredRunLease = {
    ...active,
    recovered_at: now.toISOString(),
    recovery_reason: "lease_expired"
  };
  const paths = getKnowledgePaths(projectRoot);
  await ensureDir(paths.failedRunsDir);
  await writeJson(path.join(paths.failedRunsDir, `${active.run_id}-lease-recovery.json`), recovered);
  await completeRunLease(projectRoot, active.run_id, active.token);
  return recovered;
}

export async function abortRunLease(projectRoot: string, runId: string, detail: string): Promise<RecoveredRunLease> {
  const active = await inspectRunLease(projectRoot);
  if (!active || active.run_id !== runId) {
    throw new Error(`Automation run lease owner mismatch: active=${active?.run_id ?? "none"}, requested=${runId}`);
  }
  const recovered: RecoveredRunLease = {
    ...active,
    recovered_at: new Date().toISOString(),
    recovery_reason: "caller_aborted",
    detail: detail.trim() || "caller reported a failed review or validation gate"
  };
  const paths = getKnowledgePaths(projectRoot);
  await ensureDir(paths.failedRunsDir);
  await writeJson(path.join(paths.failedRunsDir, `${active.run_id}-lease-recovery.json`), recovered);
  await completeRunLease(projectRoot, active.run_id, active.token);
  return recovered;
}
