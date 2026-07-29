import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import {
  beginPublicationTransaction,
  recoverInterruptedPublication
} from "../src/scheduler/publicationTransaction";
import { acquireRunLease, inspectRunLease } from "../src/scheduler/runLease";

describe("interrupted publication recovery", () => {
  test("restores the prior target when a run dies before registry commit", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "gpk-publication-recovery-"));
    const target = path.join(projectRoot, "work_contexts", "github_engineering_patterns", "cards", "report.md");
    const staged = path.join(projectRoot, "knowledge", "sources", "run-crashed", "drafts", "report.md");
    await mkdir(path.dirname(target), { recursive: true });
    await mkdir(path.dirname(staged), { recursive: true });
    await writeFile(target, "prior\n");
    await writeFile(staged, "candidate\n");
    await mkdir(path.join(projectRoot, "knowledge", "registry"), { recursive: true });
    await writeFile(path.join(projectRoot, "knowledge", "registry", "learned_repos.json"), JSON.stringify({ learned_count: 0, repos: [] }));
    await acquireRunLease(projectRoot, "run-crashed", new Date("2026-07-29T00:00:00.000Z"));
    await beginPublicationTransaction(projectRoot, "run-crashed", [{
      target_file: "github_engineering_patterns/cards/report.md",
      target_path: target,
      staged_path: staged
    }]);
    await writeFile(target, "candidate\n");

    const recovery = await recoverInterruptedPublication(projectRoot);

    expect(recovery).toMatchObject({ run_id: "run-crashed", action: "rolled_back" });
    await expect(readFile(target, "utf8")).resolves.toBe("prior\n");
    await expect(inspectRunLease(projectRoot)).resolves.toBeNull();
  });
});
