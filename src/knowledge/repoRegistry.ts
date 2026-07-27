import { randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";
import type { LearnedRepoRecord, LearnedRepoRegistry } from "../types";
import { ensureDir, pathExists, readJson } from "../utils/fs";
import { getKnowledgePaths } from "../utils/paths";

export type RegistryMutationOptions = {
  lockTimeoutMs?: number;
  lockRetryMs?: number;
};

type RegistryLockOwner = {
  hostname: string;
  pid: number;
  token: string;
  started_at: string;
};

type LockObservation = {
  raw: string;
  owner: RegistryLockOwner | null;
  identity: string;
  modifiedAtMs: number;
};

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_LOCK_RETRY_MS = 20;
const RECLAIM_LOCK_STALE_MS = 30_000;

function registryPath(projectRoot: string): string {
  return path.join(getKnowledgePaths(projectRoot).knowledgeRoot, "registry", "learned_repos.json");
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}

function optionValue(value: number | undefined, fallback: number, minimum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < minimum) {
    throw new RangeError(`Registry lock option must be a finite number >= ${minimum}`);
  }
  return value;
}

function parseLockOwner(raw: string): RegistryLockOwner | null {
  try {
    const value = JSON.parse(raw) as Partial<RegistryLockOwner>;
    if (
      typeof value.hostname !== "string" ||
      !value.hostname.trim() ||
      !Number.isSafeInteger(value.pid) ||
      Number(value.pid) <= 0 ||
      typeof value.token !== "string" ||
      !value.token ||
      typeof value.started_at !== "string"
    ) {
      return null;
    }
    return value as RegistryLockOwner;
  } catch {
    return null;
  }
}

async function observeLock(lockFile: string): Promise<LockObservation | null> {
  let handle;
  try {
    handle = await open(lockFile, "r");
    const raw = await handle.readFile("utf8");
    const stats = await handle.stat();
    return {
      raw,
      owner: parseLockOwner(raw),
      identity: `${stats.dev}:${stats.ino}:${stats.size}:${stats.mtimeMs}:${stats.ctimeMs}`,
      modifiedAtMs: stats.mtimeMs
    };
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function lockOwnerState(owner: RegistryLockOwner | null): "live" | "dead" | "unknown" {
  if (!owner || owner.hostname.toLowerCase() !== hostname().toLowerCase()) return "unknown";
  try {
    process.kill(owner.pid, 0);
    return "live";
  } catch (error) {
    return errorCode(error) === "ESRCH" ? "dead" : "live";
  }
}

async function removeIfOwned(filePath: string, token: string): Promise<void> {
  const observation = await observeLock(filePath);
  if (observation?.owner?.token !== token) return;
  try {
    await unlink(filePath);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

async function createOwnedLock(filePath: string): Promise<{ token: string; release: () => Promise<void> } | null> {
  const token = randomUUID();
  let handle;
  try {
    handle = await open(filePath, "wx", 0o600);
  } catch (error) {
    if (errorCode(error) === "EEXIST") return null;
    throw error;
  }

  const owner: RegistryLockOwner = {
    hostname: hostname(),
    pid: process.pid,
    token,
    started_at: new Date().toISOString()
  };
  try {
    await handle.writeFile(`${JSON.stringify(owner)}\n`, "utf8");
    await handle.sync();
    await handle.close();
  } catch (error) {
    await handle.close().catch(() => undefined);
    try {
      await unlink(filePath);
    } catch (cleanupError) {
      if (errorCode(cleanupError) !== "ENOENT") throw cleanupError;
    }
    throw error;
  }
  return { token, release: () => removeIfOwned(filePath, token) };
}

function sameObservation(left: LockObservation, right: LockObservation): boolean {
  return left.raw === right.raw && left.identity === right.identity;
}

async function removeObservedLock(
  filePath: string,
  observed: LockObservation,
  removable: (current: LockObservation) => boolean
): Promise<boolean> {
  const current = await observeLock(filePath);
  if (!current) return true;
  if (!sameObservation(current, observed) || !removable(current)) return false;
  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return true;
    throw error;
  }
}

function staleIncompleteReclaim(observation: LockObservation): boolean {
  return observation.owner === null && Date.now() - observation.modifiedAtMs >= RECLAIM_LOCK_STALE_MS;
}

async function createReclaimLock(filePath: string): Promise<{ token: string; release: () => Promise<void> } | null> {
  const created = await createOwnedLock(filePath);
  if (created) return created;

  const observed = await observeLock(filePath);
  if (!observed) return createOwnedLock(filePath);
  const state = lockOwnerState(observed.owner);
  let removable: ((current: LockObservation) => boolean) | undefined;
  if (state === "dead") {
    removable = (current) => lockOwnerState(current.owner) === "dead";
  } else if (staleIncompleteReclaim(observed)) {
    removable = staleIncompleteReclaim;
  }
  if (!removable || !(await removeObservedLock(filePath, observed, removable))) return null;
  return createOwnedLock(filePath);
}

async function tryReclaimDeadLock(lockFile: string, observed: LockObservation): Promise<boolean> {
  const reclaimFile = `${lockFile}.reclaim`;
  const reclaim = await createReclaimLock(reclaimFile);
  if (!reclaim) return false;
  try {
    const current = await observeLock(lockFile);
    if (!current) return true;
    if (!sameObservation(current, observed) || lockOwnerState(current.owner) !== "dead") return false;
    await unlink(lockFile);
    return true;
  } finally {
    await reclaim.release();
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquireRegistryLock(projectRoot: string, options: RegistryMutationOptions = {}): Promise<() => Promise<void>> {
  const filePath = registryPath(projectRoot);
  await ensureDir(path.dirname(filePath));
  const lockFile = `${filePath}.lock`;
  const timeoutMs = optionValue(options.lockTimeoutMs, DEFAULT_LOCK_TIMEOUT_MS, 0);
  const retryMs = optionValue(options.lockRetryMs, DEFAULT_LOCK_RETRY_MS, 1);
  const deadline = Date.now() + timeoutMs;
  let ownerDescription = "unknown owner";

  while (true) {
    const lock = await createOwnedLock(lockFile);
    if (lock) return lock.release;

    const observation = await observeLock(lockFile);
    if (!observation) continue;
    ownerDescription = observation.owner
      ? `${observation.owner.hostname}:${observation.owner.pid}`
      : "unknown owner";
    if (lockOwnerState(observation.owner) === "dead" && (await tryReclaimDeadLock(lockFile, observation))) {
      continue;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`Timed out waiting for learned registry lock (${ownerDescription})`);
    }
    await wait(Math.min(retryMs, remaining));
  }
}

async function writeRegistryAtomically(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  const handle = await open(temporaryPath, "wx", 0o644);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.chmod(0o644);
    await handle.sync();
    await handle.close();
    await rename(temporaryPath, filePath);
  } catch (error) {
    await handle.close().catch(() => undefined);
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      if (errorCode(cleanupError) !== "ENOENT") throw cleanupError;
    }
    throw error;
  }
}

function normalizeRepo(repo: string): string {
  return repo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^ssh:\/\/git@github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function blocksReingestion(record: LearnedRepoRecord): boolean {
  return record.status === undefined || record.status === "accepted";
}

function acceptedCount(records: LearnedRepoRecord[]): number {
  return records.filter(blocksReingestion).length;
}

export async function readLearnedRepoRegistry(projectRoot = process.cwd()): Promise<LearnedRepoRegistry> {
  const filePath = registryPath(projectRoot);
  if (!(await pathExists(filePath))) {
    return {
      generated_at: new Date().toISOString(),
      learned_count: 0,
      repos: []
    };
  }
  const registry = await readJson<LearnedRepoRegistry>(filePath);
  return {
    generated_at: registry.generated_at,
    learned_count: acceptedCount(registry.repos),
    repos: registry.repos
  };
}

async function writeLearnedRepoRegistryUnlocked(projectRoot: string, registry: LearnedRepoRegistry): Promise<string> {
  const filePath = registryPath(projectRoot);
  await ensureDir(path.dirname(filePath));
  const sorted = [...registry.repos].sort((a, b) => a.repo.localeCompare(b.repo));
  await writeRegistryAtomically(filePath, {
    generated_at: new Date().toISOString(),
    learned_count: acceptedCount(sorted),
    repos: sorted
  });
  return filePath;
}

export async function writeLearnedRepoRegistry(
  projectRoot: string,
  registry: LearnedRepoRegistry,
  options: RegistryMutationOptions = {}
): Promise<string> {
  const release = await acquireRegistryLock(projectRoot, options);
  try {
    return await writeLearnedRepoRegistryUnlocked(projectRoot, registry);
  } finally {
    await release();
  }
}

export async function markRepoLearned(
  projectRoot: string,
  record: LearnedRepoRecord,
  options: RegistryMutationOptions = {}
): Promise<string> {
  const release = await acquireRegistryLock(projectRoot, options);
  try {
    const registry = await readLearnedRepoRegistry(projectRoot);
    const repo = normalizeRepo(record.repo);
    const existing = new Map(registry.repos.map((item) => [normalizeRepo(item.repo), item]));
    existing.set(repo, { ...record, repo, status: "accepted" });
    return await writeLearnedRepoRegistryUnlocked(projectRoot, {
      generated_at: new Date().toISOString(),
      learned_count: existing.size,
      repos: [...existing.values()]
    });
  } finally {
    await release();
  }
}

export async function isRepoLearned(projectRoot: string, repo: string): Promise<boolean> {
  const registry = await readLearnedRepoRegistry(projectRoot);
  const normalized = normalizeRepo(repo);
  return registry.repos.some((record) => blocksReingestion(record) && normalizeRepo(record.repo) === normalized);
}

export async function learnedRepoSet(projectRoot: string): Promise<Set<string>> {
  const registry = await readLearnedRepoRegistry(projectRoot);
  return new Set(registry.repos.filter(blocksReingestion).map((record) => normalizeRepo(record.repo)));
}
