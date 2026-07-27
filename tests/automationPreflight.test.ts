import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { validateAutomationDeployment } from "../src/harness/automationDeploymentIntegrity";

const execFileAsync = promisify(execFile);

const requiredFiles = [
  "REPOSITORY.md",
  "docs/daily-workflow.md",
  "docs/human-report-quality-standard.md",
  "docs/verification-checklist.md",
  "schemas/independent-source-judgment.schema.json",
  "src/cli/automationPreflight.ts",
  "src/cli/daily.ts",
  "src/cli/finalize.ts",
  "src/cli/harness.ts",
  "src/harness/automationDeploymentIntegrity.ts",
  "src/scheduler/finalizeDeepDive.ts"
];

async function makeRepo(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "gpk-automation-preflight-"));
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Automation Preflight Test"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "preflight@example.test"], { cwd: root });
  return root;
}

async function writeContract(root: string): Promise<void> {
  for (const relative of requiredFiles) {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${relative}\n`);
  }
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    scripts: {
      "automation-preflight": "tsx src/cli/automationPreflight.ts",
      daily: "tsx src/cli/daily.ts",
      finalize: "tsx src/cli/finalize.ts",
      harness: "tsx src/cli/harness.ts"
    }
  }));
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-qm", "fixture"], { cwd: root });
}

describe("automation deployment preflight", () => {
  test("accepts a clean commit containing the complete caller contract", async () => {
    const root = await makeRepo();
    await writeContract(root);

    const result = await validateAutomationDeployment(root);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.commit).toMatch(/^[a-f0-9]{40}$/);
  });

  test("rejects a checkout that does not contain the committed finalize contract", async () => {
    const root = await makeRepo();
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { daily: "tsx src/cli/daily.ts" } }));
    await execFileAsync("git", ["add", "package.json"], { cwd: root });
    await execFileAsync("git", ["commit", "-qm", "old deployment"], { cwd: root });

    const result = await validateAutomationDeployment(root);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("required tracked interface missing: docs/daily-workflow.md");
    expect(result.errors).toContain("required tracked interface missing: src/cli/finalize.ts");
    expect(result.errors).toContain("package script mismatch: finalize");
  });

  test("rejects uncommitted workflow changes instead of treating them as deployed", async () => {
    const root = await makeRepo();
    await writeContract(root);
    await writeFile(path.join(root, "docs/daily-workflow.md"), "uncommitted replacement\n");

    const result = await validateAutomationDeployment(root);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("tool checkout is dirty");
  });
});
