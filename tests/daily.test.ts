import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { runDaily } from "../src/scheduler/daily";

describe("daily workflow", () => {
  test("runs the full fixture fallback loop without polluting accepted patterns on harness failure", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "pattern-daily-"));
    const result = await runDaily({ projectRoot, forceFixture: true, runDate: new Date("2026-06-11T08:00:00.000Z") });

    expect(result.status).toBe("success");
    expect(result.fixture).toBe(true);
    expect(result.added_patterns.length).toBeGreaterThanOrEqual(1);
    expect(result.generated_card).toMatch(/knowledge\/cards\/2026-06-11-fixture-agent-workflow-kit/);
    expect(result.updated_indexes).toContain("knowledge/indexes/index.json");

    const index = JSON.parse(await readFile(path.join(projectRoot, "knowledge", "indexes", "index.json"), "utf8"));
    expect(index.pattern_count).toBe(result.added_patterns.length);

    const run = JSON.parse(await readFile(path.join(projectRoot, result.run_file), "utf8"));
    expect(run.selected_repo.repo).toBe("fixture/agent-workflow-kit");
    expect(run.fixture).toBe(true);
    expect(run.harness_result.accepted).toBe(result.added_patterns.length);
  });
});
