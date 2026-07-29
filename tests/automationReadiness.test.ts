import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { validateAutomationReadiness } from "../src/harness/automationReadiness";

const execFileAsync = promisify(execFile);

async function fixture(): Promise<{ projectRoot: string; knowledgeRoot: string; workContextsRoot: string }> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "gpk-readiness-project-"));
  const workContextsRoot = path.join(await mkdtemp(path.join(os.tmpdir(), "gpk-readiness-authority-")), "work_contexts");
  const knowledgeRoot = path.join(workContextsRoot, "github_engineering_patterns");
  await mkdir(path.join(knowledgeRoot, "registry"), { recursive: true });
  await writeFile(path.join(projectRoot, "REPOSITORY.md"), "repository_id: github-pattern-knowledge\n");
  const tracked = [
    "package.json", "REPOSITORY.md", "docs/daily-workflow.md", "docs/human-report-quality-standard.md",
    "docs/verification-checklist.md", "schemas/independent-source-judgment.schema.json",
    "scripts/automationPreflightBootstrap.mjs", "src/cli/automationPreflight.ts", "src/cli/automationAbort.ts", "src/cli/daily.ts",
    "src/cli/finalize.ts", "src/cli/harness.ts", "src/github/credentials.ts",
    "src/harness/automationReadiness.ts", "src/harness/automationDeploymentIntegrity.ts",
    "src/scheduler/finalizeDeepDive.ts", "src/scheduler/publicationTransaction.ts", "src/scheduler/runLease.ts"
  ];
  for (const relative of tracked) {
    const file = path.join(projectRoot, relative);
    await mkdir(path.dirname(file), { recursive: true });
    if (relative !== "REPOSITORY.md") await writeFile(file, "fixture\n");
  }
  await writeFile(path.join(projectRoot, "package.json"), JSON.stringify({ scripts: {
    "automation-preflight": "node scripts/automationPreflightBootstrap.mjs",
    "automation-abort": "tsx src/cli/automationAbort.ts",
    daily: "tsx src/cli/daily.ts", finalize: "tsx src/cli/finalize.ts", harness: "tsx src/cli/harness.ts"
  }}));
  await writeFile(path.join(knowledgeRoot, "registry", "learned_repos.json"), JSON.stringify({ learned_count: 0, repos: [] }));
  await writeFile(path.join(knowledgeRoot, "registry", "seed_repos.json"), JSON.stringify({ seed_count: 1, repos: [{ rank: 1, repo: "owner/repo" }] }));
  await execFileAsync("git", ["init", "-q"], { cwd: projectRoot });
  await execFileAsync("git", ["-C", projectRoot, "config", "user.name", "Readiness Test"]);
  await execFileAsync("git", ["-C", projectRoot, "config", "user.email", "readiness@example.test"]);
  await execFileAsync("git", ["-C", projectRoot, "add", "."]);
  await execFileAsync("git", ["-C", projectRoot, "commit", "-qm", "fixture"]);
  return { projectRoot, knowledgeRoot, workContextsRoot };
}

describe("automation readiness", () => {
  test("reports all caller-owned capabilities without returning secrets", async () => {
    const context = await fixture();
    const result = await validateAutomationReadiness(context.projectRoot, {
      knowledgeRoot: context.knowledgeRoot,
      workContextsRoot: context.workContextsRoot,
      resolveGitHub: () => ({ token: "never-print-me", source: "gh_keychain" }),
      checkFeishu: async () => ({ ready: true, profile: "github-pattern-report", identity: "bot" }),
      checkWorkContexts: async () => ({ ready: true, checks: ["validate", "routing", "lifecycle"] })
    });

    expect(result.valid).toBe(true);
    expect(result.capabilities).toMatchObject({
      github: { ready: true, source: "gh_keychain" },
      feishu: { ready: true, profile: "github-pattern-report", identity: "bot" },
      authority_writable: true
    });
    expect(JSON.stringify(result)).not.toContain("never-print-me");
  });

  test("fails once with the complete missing capability set", async () => {
    const context = await fixture();
    const result = await validateAutomationReadiness(context.projectRoot, {
      knowledgeRoot: context.knowledgeRoot,
      workContextsRoot: context.workContextsRoot,
      resolveGitHub: () => ({ token: undefined, source: "unavailable" }),
      checkFeishu: async () => ({ ready: false, profile: "github-pattern-report", identity: "unavailable" }),
      checkWorkContexts: async () => ({ ready: true, checks: ["validate", "routing", "lifecycle"] })
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "GitHub authenticated credential unavailable",
      "Feishu bot profile github-pattern-report unavailable"
    ]));
  });
});
