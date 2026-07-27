import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { runDaily } from "../src/scheduler/daily";

describe("daily no-overlap contract", () => {
  test("allows a later run only after the active run releases its project lock", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "pattern-daily-lock-"));
    const options = {
      projectRoot,
      forceFixture: true,
      runDate: new Date("2026-07-25T08:00:00.000Z")
    };

    const attempts = await Promise.allSettled([runDaily(options), runDaily(options)]);
    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    const rejected = attempts.filter((attempt) => attempt.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toContain("Daily run already in progress");

    const failedRuns = await readdir(path.join(projectRoot, "knowledge", "runs", "failed"));
    expect(failedRuns.filter((file) => file.endsWith(".json"))).toHaveLength(1);

    const later = await runDaily({ ...options, runDate: new Date("2026-07-26T08:00:00.000Z") });
    expect(later.run_id).not.toBe((fulfilled[0] as PromiseFulfilledResult<{ run_id: string }>).value.run_id);
  });
});
