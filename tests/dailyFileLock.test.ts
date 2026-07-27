import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { acquireDailyFileLock, runDaily } from "../src/scheduler/daily";

async function waitForPublishedOwner(
  filePath: string,
  child: ChildProcessWithoutNullStreams
): Promise<{ pid: number; hostname: string }> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const owner = JSON.parse(await readFile(filePath, "utf8")) as { pid?: unknown; hostname?: unknown };
      if (typeof owner.pid === "number" && typeof owner.hostname === "string") {
        return owner as { pid: number; hostname: string };
      }
    } catch {
      // The lock may be between exclusive creation and metadata publication.
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Lock owner exited before publishing its lock`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for child process to publish its daily lock");
}

async function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await once(child, "exit");
}

describe("daily cross-process lock contract", () => {
  test("serializes different worktrees that target the same knowledge root", async () => {
    const rootA = await mkdtemp(path.join(tmpdir(), "pattern-worktree-a-"));
    const rootB = await mkdtemp(path.join(tmpdir(), "pattern-worktree-b-"));
    const sharedKnowledgeRoot = path.join(await mkdtemp(path.join(tmpdir(), "pattern-shared-knowledge-")), "github_engineering_patterns");
    const previousKnowledgeRoot = process.env.KNOWLEDGE_ROOT;
    process.env.KNOWLEDGE_ROOT = sharedKnowledgeRoot;
    let release: (() => Promise<void>) | undefined;

    try {
      release = await acquireDailyFileLock(rootA);
      await expect(acquireDailyFileLock(rootB)).rejects.toThrow("Daily run already in progress");
    } finally {
      await release?.();
      if (previousKnowledgeRoot === undefined) delete process.env.KNOWLEDGE_ROOT;
      else process.env.KNOWLEDGE_ROOT = previousKnowledgeRoot;
    }
  });

  test(
    "rejects a live owner, then reclaims its same-host lock after the owner crashes",
    async () => {
      const projectRoot = await mkdtemp(path.join(tmpdir(), "pattern-daily-file-lock-"));
      const lockPath = path.join(projectRoot, "knowledge", ".github-pattern-knowledge-daily.lock");
      const dailyModule = pathToFileURL(path.resolve("src/scheduler/daily.ts")).href;
      const child = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          "--input-type=module",
          "--eval",
          `import { acquireDailyFileLock } from ${JSON.stringify(dailyModule)}; await acquireDailyFileLock(process.env.DAILY_LOCK_TEST_ROOT); await new Promise(() => setInterval(() => {}, 1000));`
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DAILY_LOCK_TEST_ROOT: projectRoot
          }
        }
      );
      const previousMode = process.env.EXTRACTOR_MODE;
      process.env.EXTRACTOR_MODE = "heuristic";

      try {
        const owner = await waitForPublishedOwner(lockPath, child);
        expect(owner).toMatchObject({ pid: child.pid });

        await expect(
          runDaily({ projectRoot, forceFixture: true, runDate: new Date("2026-07-25T08:00:00.000Z") })
        ).rejects.toThrow("Daily run already in progress");

        child.kill("SIGKILL");
        await waitForExit(child);
        await expect(access(lockPath)).resolves.toBeUndefined();

        await expect(
          runDaily({ projectRoot, forceFixture: true, runDate: new Date("2026-07-26T08:00:00.000Z") })
        ).resolves.toMatchObject({ status: "failed" });
        expect(owner.hostname).toBe(hostname());
        await expect(access(lockPath)).rejects.toThrow();
      } finally {
        if (previousMode === undefined) delete process.env.EXTRACTOR_MODE;
        else process.env.EXTRACTOR_MODE = previousMode;
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        await waitForExit(child);
      }
    },
    10_000
  );

  test.each([
    ["malformed", "not-json"],
    ["unknown", JSON.stringify({ token: "unknown-owner" })],
    [
      "another host",
      JSON.stringify({ pid: 999_999_999, hostname: `${hostname()}.other-host`, started_at: new Date().toISOString(), token: "remote" })
    ]
  ])("conservatively rejects a %s lock", async (_kind, lockContents) => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "pattern-daily-unsafe-lock-"));
    const lockPath = path.join(projectRoot, "knowledge", ".github-pattern-knowledge-daily.lock");
    await mkdir(path.dirname(lockPath), { recursive: true });
    await writeFile(lockPath, lockContents, "utf8");

    await expect(
      runDaily({ projectRoot, forceFixture: true, runDate: new Date("2026-07-25T08:00:00.000Z") })
    ).rejects.toThrow("Daily run already in progress");
    await expect(access(path.join(projectRoot, "knowledge", "schemas"))).rejects.toThrow();
    await expect(readFile(lockPath, "utf8")).resolves.toBe(lockContents);
  });
});
