import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  markRepoLearned,
  readLearnedRepoRegistry,
  writeLearnedRepoRegistry,
  type RegistryMutationOptions
} from "../src/knowledge/repoRegistry";
import type { LearnedRepoRecord, LearnedRepoRegistry } from "../src/types";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function record(index: number): LearnedRepoRecord {
  return {
    repo: `owner/repo-${index}`,
    url: `https://github.com/owner/repo-${index}`,
    learned_at: "2026-07-25T00:00:00.000Z",
    run_id: `run-${index}`,
    pattern_files: [`work_contexts/github_engineering_patterns/patterns/pattern-${index}.md`],
    status: "accepted"
  };
}

function registryPaths(projectRoot: string): { registryDir: string; registryFile: string; lockFile: string } {
  const registryDir = path.join(projectRoot, "knowledge", "registry");
  const registryFile = path.join(registryDir, "learned_repos.json");
  return { registryDir, registryFile, lockFile: `${registryFile}.lock` };
}

function runMarkerProcess(projectRoot: string, index: number, startAt: number): Promise<void> {
  const script = `
    import { markRepoLearned } from "./src/knowledge/repoRegistry.ts";
    const startAt = Number(process.env.REGISTRY_TEST_START_AT);
    while (Date.now() < startAt) await new Promise((resolve) => setTimeout(resolve, 1));
    const index = Number(process.env.REGISTRY_TEST_INDEX);
    await markRepoLearned(process.env.REGISTRY_TEST_ROOT, {
      repo: "owner/repo-" + index,
      url: "https://github.com/owner/repo-" + index,
      learned_at: "2026-07-25T00:00:00.000Z",
      run_id: "run-" + index,
      pattern_files: ["work_contexts/github_engineering_patterns/patterns/pattern-" + index + ".md"],
      status: "accepted"
    });
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        REGISTRY_TEST_ROOT: projectRoot,
        REGISTRY_TEST_INDEX: String(index),
        REGISTRY_TEST_START_AT: String(startAt)
      },
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`registry marker process exited ${code}: ${stderr}`));
    });
  });
}

async function exitedChildPid(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--eval", "process.exit(0)"], { stdio: "ignore" });
    const pid = child.pid;
    child.on("error", reject);
    child.on("close", () => {
      if (pid === undefined) reject(new Error("child process did not expose a pid"));
      else resolve(pid);
    });
  });
}

describe("learned repository registry concurrency", () => {
  test("treats GitHub repository identity as case-insensitive", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-repo-case-"));
    await markRepoLearned(projectRoot, { ...record(1), repo: "Owner/Repo-One" });
    await markRepoLearned(projectRoot, { ...record(2), repo: "owner/repo-one" });

    const registry = await readLearnedRepoRegistry(projectRoot);
    expect(registry.learned_count).toBe(1);
    expect(registry.repos).toHaveLength(1);
    expect(registry.repos[0].run_id).toBe("run-2");
  });

  test("does not lose same-process concurrent marks", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-same-process-"));

    await Promise.all(Array.from({ length: 12 }, (_, index) => markRepoLearned(projectRoot, record(index))));

    const registry = await readLearnedRepoRegistry(projectRoot);
    expect(registry.learned_count).toBe(12);
    expect(registry.repos.map((item) => item.repo).sort()).toEqual(
      Array.from({ length: 12 }, (_, index) => `owner/repo-${index}`).sort()
    );
  });

  test("does not lose cross-process concurrent marks", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-cross-process-"));
    const processCount = 8;
    const startAt = Date.now() + 800;

    await Promise.all(Array.from({ length: processCount }, (_, index) => runMarkerProcess(projectRoot, index, startAt)));

    const registry = await readLearnedRepoRegistry(projectRoot);
    expect(registry.learned_count).toBe(processCount);
    expect(new Set(registry.repos.map((item) => item.repo)).size).toBe(processCount);
  }, 15_000);

  test("keeps the registry parseable while replacing large snapshots", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-atomic-write-"));
    const { registryDir, registryFile } = registryPaths(projectRoot);
    const snapshots: LearnedRepoRegistry[] = Array.from({ length: 6 }, (_, round) => ({
      generated_at: `2026-07-25T00:00:0${round}.000Z`,
      learned_count: 2_000,
      repos: Array.from({ length: 2_000 }, (_, index) => record(round * 2_000 + index))
    }));
    await writeLearnedRepoRegistry(projectRoot, snapshots[0]);

    let writing = true;
    const parseErrors: unknown[] = [];
    const writer = (async () => {
      for (const snapshot of snapshots.slice(1)) {
        await writeLearnedRepoRegistry(projectRoot, snapshot);
      }
      writing = false;
    })();
    while (writing) {
      try {
        JSON.parse(await readFile(registryFile, "utf8"));
      } catch (error) {
        parseErrors.push(error);
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    await writer;

    expect(parseErrors).toEqual([]);
    expect((await readdir(registryDir)).some((file) => file.includes(".tmp"))).toBe(false);
  }, 15_000);

  test("publishes the registry with portable read permissions", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-permissions-"));
    const { registryFile } = registryPaths(projectRoot);

    await markRepoLearned(projectRoot, record(1));

    expect((await stat(registryFile)).mode & 0o777).toBe(0o644);
  });

  test("publishes the registry as 0644 under a restrictive process umask", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-restrictive-umask-"));
    const { registryFile } = registryPaths(projectRoot);
    const previousUmask = process.umask(0o077);
    let mode: number | undefined;

    try {
      await markRepoLearned(projectRoot, record(1));
      mode = (await stat(registryFile)).mode & 0o777;
    } finally {
      process.umask(previousUmask);
    }

    expect(mode).toBe(0o644);
  });

  test("waits for a live owner and proceeds after its lock is released", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-live-lock-"));
    const { registryDir, lockFile } = registryPaths(projectRoot);
    await mkdir(registryDir, { recursive: true });
    await writeFile(
      lockFile,
      `${JSON.stringify({ hostname: hostname(), pid: process.pid, token: "other-live-owner", started_at: new Date().toISOString() })}\n`,
      "utf8"
    );
    const startedAt = Date.now();
    const release = setTimeout(() => void unlink(lockFile), 60);

    await markRepoLearned(projectRoot, record(1), { lockTimeoutMs: 1_000, lockRetryMs: 5 });
    clearTimeout(release);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(40);
    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(1);
  });

  test("reclaims a dead owner lock from the same host", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-dead-lock-"));
    const { registryDir, lockFile } = registryPaths(projectRoot);
    const deadPid = await exitedChildPid();
    await mkdir(registryDir, { recursive: true });
    await writeFile(
      lockFile,
      `${JSON.stringify({ hostname: hostname(), pid: deadPid, token: "dead-owner", started_at: new Date().toISOString() })}\n`,
      "utf8"
    );

    await markRepoLearned(projectRoot, record(1), { lockTimeoutMs: 1_000, lockRetryMs: 5 });

    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(1);
    await expect(access(lockFile)).rejects.toThrow();
  });

  test("recovers when a dead reclaim owner leaves its auxiliary lock behind", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-dead-reclaim-lock-"));
    const { registryDir, lockFile } = registryPaths(projectRoot);
    const reclaimFile = `${lockFile}.reclaim`;
    const deadPid = await exitedChildPid();
    await mkdir(registryDir, { recursive: true });
    await writeFile(
      lockFile,
      `${JSON.stringify({ hostname: hostname(), pid: deadPid, token: "dead-owner", started_at: new Date().toISOString() })}\n`,
      "utf8"
    );
    await writeFile(
      reclaimFile,
      `${JSON.stringify({ hostname: hostname(), pid: deadPid, token: "dead-reclaimer", started_at: new Date().toISOString() })}\n`,
      "utf8"
    );

    await markRepoLearned(projectRoot, record(1), { lockTimeoutMs: 1_000, lockRetryMs: 5 });

    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(1);
    await expect(access(lockFile)).rejects.toThrow();
    await expect(access(reclaimFile)).rejects.toThrow();
  });

  test("does not steal an auxiliary reclaim lock from a live local owner", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-live-reclaim-lock-"));
    const { registryDir, registryFile, lockFile } = registryPaths(projectRoot);
    const reclaimFile = `${lockFile}.reclaim`;
    const deadPid = await exitedChildPid();
    const mainContents = `${JSON.stringify({
      hostname: hostname(),
      pid: deadPid,
      token: "dead-owner",
      started_at: new Date().toISOString()
    })}\n`;
    const reclaimContents = `${JSON.stringify({
      hostname: hostname(),
      pid: process.pid,
      token: "live-reclaimer",
      started_at: new Date().toISOString()
    })}\n`;
    await mkdir(registryDir, { recursive: true });
    await writeFile(lockFile, mainContents, "utf8");
    await writeFile(reclaimFile, reclaimContents, "utf8");

    await expect(
      markRepoLearned(projectRoot, record(1), { lockTimeoutMs: 80, lockRetryMs: 5 })
    ).rejects.toThrow("Timed out waiting for learned registry lock");

    expect(await readFile(lockFile, "utf8")).toBe(mainContents);
    expect(await readFile(reclaimFile, "utf8")).toBe(reclaimContents);
    await expect(access(registryFile)).rejects.toThrow();
  });

  test("recovers from an old incomplete auxiliary reclaim lock", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-stale-reclaim-lock-"));
    const { registryDir, lockFile } = registryPaths(projectRoot);
    const reclaimFile = `${lockFile}.reclaim`;
    const deadPid = await exitedChildPid();
    await mkdir(registryDir, { recursive: true });
    await writeFile(
      lockFile,
      `${JSON.stringify({ hostname: hostname(), pid: deadPid, token: "dead-owner", started_at: new Date().toISOString() })}\n`,
      "utf8"
    );
    await writeFile(reclaimFile, "incomplete-owner-metadata\n", "utf8");
    const staleTime = new Date(Date.now() - 60_000);
    await utimes(reclaimFile, staleTime, staleTime);

    await markRepoLearned(projectRoot, record(1), { lockTimeoutMs: 1_000, lockRetryMs: 5 });

    expect((await readLearnedRepoRegistry(projectRoot)).learned_count).toBe(1);
    await expect(access(lockFile)).rejects.toThrow();
    await expect(access(reclaimFile)).rejects.toThrow();
  });

  test("does not steal a fresh auxiliary reclaim lock with incomplete owner metadata", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-fresh-reclaim-lock-"));
    const { registryDir, registryFile, lockFile } = registryPaths(projectRoot);
    const reclaimFile = `${lockFile}.reclaim`;
    const deadPid = await exitedChildPid();
    const reclaimContents = "incomplete-owner-metadata\n";
    await mkdir(registryDir, { recursive: true });
    await writeFile(
      lockFile,
      `${JSON.stringify({ hostname: hostname(), pid: deadPid, token: "dead-owner", started_at: new Date().toISOString() })}\n`,
      "utf8"
    );
    await writeFile(reclaimFile, reclaimContents, "utf8");

    await expect(
      markRepoLearned(projectRoot, record(1), { lockTimeoutMs: 80, lockRetryMs: 5 })
    ).rejects.toThrow("Timed out waiting for learned registry lock");

    expect(await readFile(reclaimFile, "utf8")).toBe(reclaimContents);
    await expect(access(registryFile)).rejects.toThrow();
  });

  test("times out conservatively without deleting an unknown lock", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "registry-unknown-lock-"));
    const { registryDir, registryFile, lockFile } = registryPaths(projectRoot);
    await mkdir(registryDir, { recursive: true });
    await writeFile(lockFile, "not-json\n", "utf8");
    const options: RegistryMutationOptions = { lockTimeoutMs: 80, lockRetryMs: 5 };
    const startedAt = Date.now();

    await expect(markRepoLearned(projectRoot, record(1), options)).rejects.toThrow("Timed out waiting for learned registry lock");

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(await readFile(lockFile, "utf8")).toBe("not-json\n");
    await expect(access(registryFile)).rejects.toThrow();
  });
});
