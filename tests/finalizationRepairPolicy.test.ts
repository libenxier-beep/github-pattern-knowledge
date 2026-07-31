import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import {
  assertToolingAuthorityUnchanged,
  buildFinalizationRepairPlan
} from "../src/scheduler/finalizationRepairPolicy";

const execFile = promisify(execFileCallback);

describe("finalization repair policy", () => {
  test("routes deterministic artifact and report gate failures back to run-owned drafts", () => {
    const artifact = buildFinalizationRepairPlan({
      runId: "run-2026-07-31-1b62",
      attempt: 1,
      error: "Deep-dive artifact harness failed: pattern: unknown transfer_target taxonomy value: data_tool"
    });
    const report = buildFinalizationRepairPlan({
      runId: "run-2026-07-31-1b62",
      attempt: 2,
      error: "Deep-dive report gate failed: report_evidence_appendix_required"
    });

    expect(artifact).toMatchObject({ action: "repair_run_artifacts", max_attempts: 3 });
    expect(report).toMatchObject({ action: "repair_run_artifacts", max_attempts: 3 });
    expect(artifact.allowed_mutations).toContain(
      "github_engineering_patterns/sources/run-2026-07-31-1b62/drafts/**"
    );
    expect(artifact.allowed_mutations).toContain(
      "github_engineering_patterns/sources/runs/run-2026-07-31-1b62/drafts/**"
    );
    expect(artifact.protected_authorities).toContain("tool_repository/**");
    expect(artifact.rerun_daily).toBe(false);
  });

  test("stops on source identity failures and after the bounded repair budget", () => {
    const sourceFailure = buildFinalizationRepairPlan({
      runId: "run-2026-07-31-1b62",
      attempt: 1,
      error: "Deep-dive source snapshot commit mismatch"
    });
    const exhausted = buildFinalizationRepairPlan({
      runId: "run-2026-07-31-1b62",
      attempt: 4,
      error: "Deep-dive artifact harness failed: pattern: unknown taxonomy value"
    });

    expect(sourceFailure.action).toBe("abort_run");
    expect(exhausted).toMatchObject({ action: "abort_run", reason: "repair_attempts_exhausted" });
  });

  test("repairs unsupported accepted-unit claims but not a changed pinned checkout", () => {
    const unsupportedUnit = buildFinalizationRepairPlan({
      runId: "run-2026-07-31-1b62",
      attempt: 1,
      error: "Deep-dive evidence missing from pinned checkout: unit-a:src/missing.go"
    });
    const checkoutDrift = buildFinalizationRepairPlan({
      runId: "run-2026-07-31-1b62",
      attempt: 1,
      error: "Deep-dive pinned checkout commit mismatch"
    });

    expect(unsupportedUnit.action).toBe("repair_run_artifacts");
    expect(checkoutDrift.action).toBe("abort_run");
  });

  test("rejects an invalid run id instead of widening the repair path", () => {
    expect(() => buildFinalizationRepairPlan({
      runId: "../escape",
      attempt: 1,
      error: "Deep-dive report gate failed"
    })).toThrow("Finalization repair run id invalid");
  });

  test("binds finalization to the original clean tooling commit", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gpk-repair-authority-"));
    await writeFile(path.join(root, "standard.md"), "fixed standard\n", "utf8");
    await execFile("git", ["init", "--quiet"], { cwd: root });
    await execFile("git", ["add", "."], { cwd: root });
    await execFile("git", [
      "-c", "user.name=Repair Policy Test",
      "-c", "user.email=repair-policy@example.test",
      "commit", "--quiet", "-m", "authority"
    ], { cwd: root });
    const { stdout } = await execFile("git", ["rev-parse", "HEAD"], { cwd: root });
    const originalCommit = stdout.trim();

    await expect(assertToolingAuthorityUnchanged(root, originalCommit)).resolves.toBe(originalCommit);

    await writeFile(path.join(root, "standard.md"), "weakened standard\n", "utf8");
    await expect(assertToolingAuthorityUnchanged(root, originalCommit)).rejects.toThrow(
      "tooling authority is dirty"
    );

    await execFile("git", ["add", "."], { cwd: root });
    await execFile("git", [
      "-c", "user.name=Repair Policy Test",
      "-c", "user.email=repair-policy@example.test",
      "commit", "--quiet", "-m", "weaken standard"
    ], { cwd: root });
    await expect(assertToolingAuthorityUnchanged(root, originalCommit)).rejects.toThrow(
      "tooling authority commit changed"
    );
  });
});
