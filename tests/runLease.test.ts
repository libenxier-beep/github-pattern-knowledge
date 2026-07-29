import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import {
  acquireRunLease,
  completeRunLease,
  inspectRunLease,
  recoverExpiredRunLease
} from "../src/scheduler/runLease";

describe("whole-run lease", () => {
  test("survives process boundaries until the matching run completes", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "gpk-run-lease-"));
    const lease = await acquireRunLease(projectRoot, "run-a", new Date("2026-07-29T00:00:00.000Z"));

    await expect(acquireRunLease(projectRoot, "run-b", new Date("2026-07-29T01:00:00.000Z"))).rejects.toThrow(
      "Unfinished automation run"
    );
    await expect(inspectRunLease(projectRoot)).resolves.toMatchObject({ run_id: "run-a", token: lease.token });

    await expect(completeRunLease(projectRoot, "run-b", lease.token)).rejects.toThrow("lease owner mismatch");
    await completeRunLease(projectRoot, "run-a", lease.token);
    await expect(inspectRunLease(projectRoot)).resolves.toBeNull();
  });

  test("recovers only an expired lease and records the prior run", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "gpk-run-lease-expired-"));
    await acquireRunLease(projectRoot, "run-old", new Date("2026-07-28T00:00:00.000Z"));

    await expect(
      recoverExpiredRunLease(projectRoot, new Date("2026-07-28T01:00:00.000Z"), 18 * 60 * 60 * 1000)
    ).resolves.toBeNull();
    await expect(
      recoverExpiredRunLease(projectRoot, new Date("2026-07-29T00:00:00.000Z"), 18 * 60 * 60 * 1000)
    ).resolves.toMatchObject({ run_id: "run-old", recovery_reason: "lease_expired" });
    await expect(inspectRunLease(projectRoot)).resolves.toBeNull();
  });
});
