import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { validateRunLocatorIntegrity } from "../src/harness/runLocatorIntegrity";

describe("run locator integrity", () => {
  test("walks nested batch results and resolves portable Work Context locators", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "run-locators-"));
    const pattern = path.join(projectRoot, "work_contexts", "github_engineering_patterns", "patterns", "good.md");
    await mkdir(path.dirname(pattern), { recursive: true });
    await writeFile(pattern, "pattern\n", "utf8");

    const runPath = path.join(projectRoot, "knowledge", "runs", "batch.json");
    await mkdir(path.dirname(runPath), { recursive: true });
    await writeFile(runPath, `${JSON.stringify({
      run_id: "batch",
      results: [
        {
          added_patterns: ["work_contexts/github_engineering_patterns/patterns/good.md"],
          generated_card: "github_engineering_patterns/cards/missing.md"
        }
      ]
    }, null, 2)}\n`, "utf8");

    const result = await validateRunLocatorIntegrity(projectRoot);

    expect(result.checked_records).toBe(1);
    expect(result.checked_locators).toBe(2);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([
      expect.objectContaining({
        run_file: "knowledge/runs/batch.json",
        field: "results.0.generated_card",
        locator: "github_engineering_patterns/cards/missing.md"
      })
    ]);
  });

  test("reports malformed run JSON instead of silently skipping it", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "run-locators-json-"));
    const runPath = path.join(projectRoot, "knowledge", "runs", "broken.json");
    await mkdir(path.dirname(runPath), { recursive: true });
    await writeFile(runPath, "{broken", "utf8");

    const result = await validateRunLocatorIntegrity(projectRoot);

    expect(result.valid).toBe(false);
    expect(result.parse_errors).toEqual([
      expect.objectContaining({ run_file: "knowledge/runs/broken.json" })
    ]);
  });

  test("rejects recognized locator fields with malformed shapes instead of counting zero locators", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "run-locators-shape-"));
    const runPath = path.join(projectRoot, "knowledge", "runs", "malformed-shapes.json");
    await mkdir(path.dirname(runPath), { recursive: true });
    await writeFile(runPath, `${JSON.stringify({
      run_id: "malformed-shapes",
      added_patterns: "knowledge/patterns/missing.md",
      generated_card: 42,
      routed_patterns: [{ file: 42 }],
      audit_files: [null, { file: "missing.md" }]
    }, null, 2)}\n`, "utf8");

    const result = await validateRunLocatorIntegrity(projectRoot);

    expect(result.valid).toBe(false);
    expect(result.checked_records).toBe(1);
    expect(result.checked_locators).toBe(0);
    expect(result.shape_errors.map((item) => item.field)).toEqual(expect.arrayContaining([
      "added_patterns",
      "generated_card",
      "routed_patterns.0.file",
      "audit_files.0",
      "audit_files.1"
    ]));
  });

  test("rejects absolute locators even when the file exists", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "run-locators-absolute-"));
    const external = path.join(projectRoot, "external.md");
    await writeFile(external, "outside authority\n", "utf8");
    const runPath = path.join(projectRoot, "knowledge", "runs", "absolute.json");
    await mkdir(path.dirname(runPath), { recursive: true });
    await writeFile(runPath, `${JSON.stringify({ run_id: "absolute", generated_card: external }, null, 2)}\n`, "utf8");

    const result = await validateRunLocatorIntegrity(projectRoot);

    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([
      expect.objectContaining({ locator: external, reason: "absolute_path_forbidden" })
    ]);
  });

  test("does not satisfy a Work Context locator with a same-named file under the project root", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "run-locators-authority-"));
    const wrongRootFile = path.join(projectRoot, "github_engineering_patterns", "cards", "wrong.md");
    await mkdir(path.dirname(wrongRootFile), { recursive: true });
    await writeFile(wrongRootFile, "wrong authority\n", "utf8");
    const runPath = path.join(projectRoot, "knowledge", "runs", "wrong-root.json");
    await mkdir(path.dirname(runPath), { recursive: true });
    await writeFile(runPath, `${JSON.stringify({
      run_id: "wrong-root",
      generated_card: "github_engineering_patterns/cards/wrong.md"
    }, null, 2)}\n`, "utf8");

    const result = await validateRunLocatorIntegrity(projectRoot);

    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([
      expect.objectContaining({ locator: "github_engineering_patterns/cards/wrong.md", reason: "missing" })
    ]);
  });
});
