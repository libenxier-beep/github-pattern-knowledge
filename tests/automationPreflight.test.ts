import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  "scripts/automationPreflightBootstrap.mjs",
  "src/cli/automationAbort.ts",
  "src/cli/automationPreflight.ts",
  "src/cli/daily.ts",
  "src/cli/finalize.ts",
  "src/cli/harness.ts",
  "src/github/credentials.ts",
  "src/harness/automationReadiness.ts",
  "src/harness/automationDeploymentIntegrity.ts",
  "src/scheduler/finalizeDeepDive.ts",
  "src/scheduler/publicationTransaction.ts",
  "src/scheduler/runLease.ts"
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
      "automation-preflight": "node scripts/automationPreflightBootstrap.mjs",
      "automation-abort": "tsx src/cli/automationAbort.ts",
      daily: "tsx src/cli/daily.ts",
      finalize: "tsx src/cli/finalize.ts",
      harness: "tsx src/cli/harness.ts"
    }
  }));
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-qm", "fixture"], { cwd: root });
}

async function writeAuthority(root: string): Promise<{ knowledgeRoot: string; workContextsRoot: string }> {
  const workContextsRoot = path.join(root, "work_contexts");
  const knowledgeRoot = path.join(workContextsRoot, "github_engineering_patterns");
  const registryRoot = path.join(knowledgeRoot, "registry");
  await mkdir(registryRoot, { recursive: true });
  await writeFile(
    path.join(registryRoot, "learned_repos.json"),
    JSON.stringify({
      generated_at: "2026-07-29T00:00:00.000Z",
      learned_count: 1,
      repos: [{ repo: "fastify/fastify", status: "accepted" }]
    })
  );
  await writeFile(
    path.join(registryRoot, "seed_repos.json"),
    JSON.stringify({
      seed_count: 2,
      repos: [
        { rank: 1, repo: "fastify/fastify" },
        { rank: 2, repo: "kubernetes/kubernetes" }
      ]
    })
  );
  return { knowledgeRoot, workContextsRoot };
}

describe("automation deployment preflight", () => {
  test("rejects an isolated automation checkout when canonical knowledge roots are not bound", async () => {
    const root = await makeRepo();
    await writeContract(root);
    const previousKnowledgeRoot = process.env.KNOWLEDGE_ROOT;
    const previousWorkContextsRoot = process.env.WORK_CONTEXTS_ROOT;

    delete process.env.KNOWLEDGE_ROOT;
    delete process.env.WORK_CONTEXTS_ROOT;
    try {
      const result = await validateAutomationDeployment(root);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("KNOWLEDGE_ROOT is not bound for isolated automation checkout");
      expect(result.errors).toContain("WORK_CONTEXTS_ROOT is not bound for isolated automation checkout");
    } finally {
      if (previousKnowledgeRoot === undefined) delete process.env.KNOWLEDGE_ROOT;
      else process.env.KNOWLEDGE_ROOT = previousKnowledgeRoot;
      if (previousWorkContextsRoot === undefined) delete process.env.WORK_CONTEXTS_ROOT;
      else process.env.WORK_CONTEXTS_ROOT = previousWorkContextsRoot;
    }
  });

  test("accepts an identified tool worktree through repository-owned canonical root binding", async () => {
    const root = await makeRepo();
    await writeContract(root);
    await writeFile(
      path.join(root, "REPOSITORY.md"),
      "---\nschema_version: 1\nrepository_id: github-pattern-knowledge\n---\n",
      "utf8"
    );
    await execFileAsync("git", ["add", "REPOSITORY.md"], { cwd: root });
    await execFileAsync("git", ["commit", "-qm", "identify tool checkout"], { cwd: root });
    const previousKnowledgeRoot = process.env.KNOWLEDGE_ROOT;
    const previousWorkContextsRoot = process.env.WORK_CONTEXTS_ROOT;

    delete process.env.KNOWLEDGE_ROOT;
    delete process.env.WORK_CONTEXTS_ROOT;
    try {
      const result = await validateAutomationDeployment(root);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    } finally {
      if (previousKnowledgeRoot === undefined) delete process.env.KNOWLEDGE_ROOT;
      else process.env.KNOWLEDGE_ROOT = previousKnowledgeRoot;
      if (previousWorkContextsRoot === undefined) delete process.env.WORK_CONTEXTS_ROOT;
      else process.env.WORK_CONTEXTS_ROOT = previousWorkContextsRoot;
    }
  });

  test("reports the bound authority and next pending seed before a scheduled run", async () => {
    const root = await makeRepo();
    await writeContract(root);
    const authority = await writeAuthority(await mkdtemp(path.join(os.tmpdir(), "gpk-authority-")));
    const previousKnowledgeRoot = process.env.KNOWLEDGE_ROOT;
    const previousWorkContextsRoot = process.env.WORK_CONTEXTS_ROOT;

    process.env.KNOWLEDGE_ROOT = authority.knowledgeRoot;
    process.env.WORK_CONTEXTS_ROOT = authority.workContextsRoot;
    try {
      const result = await validateAutomationDeployment(root);

      expect(result).toMatchObject({
        valid: true,
        knowledgeRoot: authority.knowledgeRoot,
        workContextsRoot: authority.workContextsRoot,
        learnedRegistryCount: 1,
        seedRegistryCount: 2,
        nextPendingSeedRepo: "kubernetes/kubernetes"
      });
    } finally {
      if (previousKnowledgeRoot === undefined) delete process.env.KNOWLEDGE_ROOT;
      else process.env.KNOWLEDGE_ROOT = previousKnowledgeRoot;
      if (previousWorkContextsRoot === undefined) delete process.env.WORK_CONTEXTS_ROOT;
      else process.env.WORK_CONTEXTS_ROOT = previousWorkContextsRoot;
    }
  });

  test("bootstraps locked dependencies before preflight in a fresh checkout", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gpk-automation-bootstrap-"));
    const bin = path.join(root, "bin");
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "bootstrap-fixture" }));
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3 }));

    const fakeTsx = path.join(root, "fake-tsx");
    await writeFile(fakeTsx, "#!/bin/sh\nprintf '%s\\n' '{\"valid\":true,\"bootstrapped\":true}'\n");
    await chmod(fakeTsx, 0o755);

    const fakeNpm = path.join(bin, "npm");
    await writeFile(fakeNpm, `#!/bin/sh
printf '%s\\n' "$*" > npm-args.txt
mkdir -p node_modules/.bin
cp fake-tsx node_modules/.bin/tsx
chmod +x node_modules/.bin/tsx
`);
    await chmod(fakeNpm, 0o755);

    const bootstrap = path.resolve("scripts/automationPreflightBootstrap.mjs");
    let outcome: { code: number; stdout: string; stderr: string };
    try {
      const result = await execFileAsync(process.execPath, [bootstrap], {
        cwd: root,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` }
      });
      outcome = { code: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      outcome = {
        code: typeof failure.code === "number" ? failure.code : 1,
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? String(error)
      };
    }

    expect(outcome).toMatchObject({ code: 0, stderr: "" });
    expect(outcome.stdout).toContain('"bootstrapped":true');
    expect((await readFile(path.join(root, "npm-args.txt"), "utf8")).trim()).toBe(
      "ci --no-audit --no-fund"
    );
  }, 15_000);

  test("stops with the npm ci exit code when dependency bootstrap fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gpk-automation-bootstrap-failure-"));
    const bin = path.join(root, "bin");
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "bootstrap-fixture" }));
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3 }));

    const fakeNpm = path.join(bin, "npm");
    await writeFile(fakeNpm, "#!/bin/sh\nexit 42\n");
    await chmod(fakeNpm, 0o755);

    const bootstrap = path.resolve("scripts/automationPreflightBootstrap.mjs");
    let exitCode = 0;
    try {
      await execFileAsync(process.execPath, [bootstrap], {
        cwd: root,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` }
      });
    } catch (error) {
      exitCode = (error as { code?: number }).code ?? 1;
    }

    expect(exitCode).toBe(42);
  }, 15_000);

  test("reconciles an existing dependency cache against the lockfile before preflight", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gpk-automation-bootstrap-stale-"));
    const bin = path.join(root, "bin");
    const localBin = path.join(root, "node_modules", ".bin");
    await mkdir(bin, { recursive: true });
    await mkdir(localBin, { recursive: true });
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "bootstrap-fixture" }));
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3 }));

    const staleTsx = path.join(localBin, "tsx");
    await writeFile(staleTsx, "#!/bin/sh\nprintf '%s\\n' '{\"stale\":true}'\n");
    await chmod(staleTsx, 0o755);

    const reconciledTsx = path.join(root, "reconciled-tsx");
    await writeFile(reconciledTsx, "#!/bin/sh\nprintf '%s\\n' '{\"reconciled\":true}'\n");
    await chmod(reconciledTsx, 0o755);

    const fakeNpm = path.join(bin, "npm");
    await writeFile(fakeNpm, `#!/bin/sh
printf '%s\\n' "$*" > npm-args.txt
cp reconciled-tsx node_modules/.bin/tsx
chmod +x node_modules/.bin/tsx
`);
    await chmod(fakeNpm, 0o755);

    const bootstrap = path.resolve("scripts/automationPreflightBootstrap.mjs");
    const result = await execFileAsync(process.execPath, [bootstrap], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` }
    });

    expect(result.stdout).toContain('"reconciled":true');
    expect((await readFile(path.join(root, "npm-args.txt"), "utf8")).trim()).toBe(
      "ci --no-audit --no-fund"
    );
  }, 15_000);

  test("accepts a clean commit containing the complete caller contract", async () => {
    const root = await makeRepo();
    await writeContract(root);
    const authority = await writeAuthority(await mkdtemp(path.join(os.tmpdir(), "gpk-authority-")));
    const previousKnowledgeRoot = process.env.KNOWLEDGE_ROOT;
    const previousWorkContextsRoot = process.env.WORK_CONTEXTS_ROOT;

    process.env.KNOWLEDGE_ROOT = authority.knowledgeRoot;
    process.env.WORK_CONTEXTS_ROOT = authority.workContextsRoot;
    try {
      const result = await validateAutomationDeployment(root);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.commit).toMatch(/^[a-f0-9]{40}$/);
    } finally {
      if (previousKnowledgeRoot === undefined) delete process.env.KNOWLEDGE_ROOT;
      else process.env.KNOWLEDGE_ROOT = previousKnowledgeRoot;
      if (previousWorkContextsRoot === undefined) delete process.env.WORK_CONTEXTS_ROOT;
      else process.env.WORK_CONTEXTS_ROOT = previousWorkContextsRoot;
    }
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
