import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { clonePinnedRepo } from "../src/deepDive/localRepo";
import { inventoryEngineeringFiles } from "../src/deepDive/inventory";

const execFile = promisify(execFileCallback);

async function createSourceRepo(): Promise<{ root: string; commit: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "deep-source-"));
  await execFile("git", ["init", "-q", root]);
  await execFile("git", ["-C", root, "config", "user.name", "Deep Test"]);
  await execFile("git", ["-C", root, "config", "user.email", "deep@example.test"]);
  await mkdir(path.join(root, "browser_pkg"), { recursive: true });
  await mkdir(path.join(root, "tests"), { recursive: true });
  await mkdir(path.join(root, "examples"), { recursive: true });
  await writeFile(path.join(root, "pyproject.toml"), '[project]\nname = "browser-pkg"\n', "utf8");
  await writeFile(path.join(root, "browser_pkg", "service.py"), "class BrowserService:\n    pass\n", "utf8");
  await writeFile(path.join(root, "tests", "test_service.py"), "def test_service():\n    assert True\n", "utf8");
  await writeFile(path.join(root, "examples", "demo.py"), "print('demo')\n", "utf8");
  await execFile("git", ["-C", root, "add", "."]);
  await execFile("git", ["-C", root, "commit", "-qm", "fixture"]);
  const { stdout } = await execFile("git", ["-C", root, "rev-parse", "HEAD"]);
  return { root, commit: stdout.trim() };
}

async function createSetuptoolsPackageRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "setuptools-source-"));
  await execFile("git", ["init", "-q", root]);
  await execFile("git", ["-C", root, "config", "user.name", "Deep Test"]);
  await execFile("git", ["-C", root, "config", "user.email", "deep@example.test"]);
  await mkdir(path.join(root, "graphify"), { recursive: true });
  await writeFile(
    path.join(root, "pyproject.toml"),
    '[project]\nname = "graphifyy"\n\n[tool.setuptools]\npackages = ["graphify"]\n',
    "utf8"
  );
  await writeFile(path.join(root, "graphify", "service.py"), "class GraphService:\n    pass\n", "utf8");
  await execFile("git", ["-C", root, "add", "."]);
  await execFile("git", ["-C", root, "commit", "-qm", "fixture"]);
  return root;
}

describe("local repository deep-dive intake", () => {
  test("clones and verifies the exact requested commit", async () => {
    const source = await createSourceRepo();
    const destinationRoot = await mkdtemp(path.join(tmpdir(), "deep-clone-"));

    const receipt = await clonePinnedRepo({
      repo: "fixture/browser-pkg",
      url: source.root,
      commit: source.commit,
      destinationRoot
    });

    expect(receipt.commit).toBe(source.commit);
    expect(receipt.repo).toBe("fixture/browser-pkg");
    expect(path.isAbsolute(receipt.checkout_path)).toBe(true);
  });

  test("classifies a root package directory as production source and covers every tracked file", async () => {
    const source = await createSourceRepo();

    const inventory = await inventoryEngineeringFiles(source.root);

    expect(inventory.total_tracked_files).toBe(4);
    expect(inventory.classified_files).toBe(4);
    expect(inventory.unclassified_files).toEqual([]);
    expect(inventory.buckets.production_source).toContain("browser_pkg/service.py");
    expect(inventory.buckets.tests).toContain("tests/test_service.py");
    expect(inventory.buckets.examples).toContain("examples/demo.py");
  });

  test("classifies package-local examples separately from production source", async () => {
    const source = await createSourceRepo();
    const nestedExample = path.join(
      source.root,
      "browser_pkg",
      "examples",
      "nested.py"
    );
    await mkdir(path.dirname(nestedExample), { recursive: true });
    await writeFile(nestedExample, "print('nested')\n", "utf8");
    await execFile("git", ["-C", source.root, "add", "."]);
    await execFile("git", ["-C", source.root, "commit", "-qm", "nested example"]);

    const inventory = await inventoryEngineeringFiles(source.root);

    expect(inventory.buckets.examples).toContain(
      "browser_pkg/examples/nested.py"
    );
    expect(inventory.buckets.production_source).not.toContain(
      "browser_pkg/examples/nested.py"
    );
    expect(inventory.unclassified_files).toEqual([]);
  });

  test("uses explicit setuptools packages when the distribution name differs", async () => {
    const root = await createSetuptoolsPackageRepo();

    const inventory = await inventoryEngineeringFiles(root);

    expect(inventory.production_roots).toContain("graphify");
    expect(inventory.buckets.production_source).toContain("graphify/service.py");
    expect(inventory.buckets.other).not.toContain("graphify/service.py");
  });
});
