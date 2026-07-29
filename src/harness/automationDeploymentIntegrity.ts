import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getKnowledgePaths, getWorkContextsRoot, isGitHubPatternKnowledgeCheckout } from "../utils/paths";

const execFileAsync = promisify(execFile);

export const AUTOMATION_REQUIRED_INTERFACES = [
  "package.json",
  "REPOSITORY.md",
  "docs/daily-workflow.md",
  "docs/human-report-quality-standard.md",
  "docs/verification-checklist.md",
  "schemas/independent-source-judgment.schema.json",
  "scripts/automationPreflightBootstrap.mjs",
  "src/cli/automationPreflight.ts",
  "src/cli/daily.ts",
  "src/cli/finalize.ts",
  "src/cli/harness.ts",
  "src/harness/automationDeploymentIntegrity.ts",
  "src/scheduler/finalizeDeepDive.ts"
] as const;

const REQUIRED_SCRIPTS: Record<string, string> = {
  "automation-preflight": "node scripts/automationPreflightBootstrap.mjs",
  daily: "tsx src/cli/daily.ts",
  finalize: "tsx src/cli/finalize.ts",
  harness: "tsx src/cli/harness.ts"
};

export interface AutomationDeploymentResult {
  valid: boolean;
  commit: string | null;
  errors: string[];
  knowledgeRoot: string;
  workContextsRoot: string;
  learnedRegistryCount: number | null;
  seedRegistryCount: number | null;
  nextPendingSeedRepo: string | null;
}

function normalizeRepo(repo: string): string {
  return repo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}

async function git(projectRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: projectRoot });
  return stdout.trim();
}

export async function validateAutomationDeployment(projectRoot: string): Promise<AutomationDeploymentResult> {
  const errors: string[] = [];
  let commit: string | null = null;
  const isolatedCheckout = !isGitHubPatternKnowledgeCheckout(projectRoot);
  const knowledgeRoot = getKnowledgePaths(projectRoot).knowledgeRoot;
  const workContextsRoot = getWorkContextsRoot(projectRoot);
  let learnedRegistryCount: number | null = null;
  let seedRegistryCount: number | null = null;
  let nextPendingSeedRepo: string | null = null;

  if (isolatedCheckout && !process.env.KNOWLEDGE_ROOT) {
    errors.push("KNOWLEDGE_ROOT is not bound for isolated automation checkout");
  }
  if (isolatedCheckout && !process.env.WORK_CONTEXTS_ROOT) {
    errors.push("WORK_CONTEXTS_ROOT is not bound for isolated automation checkout");
  }
  if (knowledgeRoot !== path.join(workContextsRoot, "github_engineering_patterns")) {
    errors.push("knowledge root is not the github_engineering_patterns child of WORK_CONTEXTS_ROOT");
  }

  try {
    const inside = await git(projectRoot, ["rev-parse", "--is-inside-work-tree"]);
    if (inside !== "true") errors.push("tool checkout is not a Git worktree");
    commit = await git(projectRoot, ["rev-parse", "HEAD"]);
  } catch {
    errors.push("tool checkout has no verifiable Git commit");
  }

  if (commit) {
    const status = await git(projectRoot, ["status", "--porcelain", "--untracked-files=all"]);
    if (status.length > 0) errors.push("tool checkout is dirty");

    for (const relative of AUTOMATION_REQUIRED_INTERFACES) {
      try {
        await git(projectRoot, ["ls-files", "--error-unmatch", "--", relative]);
      } catch {
        errors.push(`required tracked interface missing: ${relative}`);
      }
    }
  }

  try {
    const packageJson = JSON.parse(await readFile(`${projectRoot}/package.json`, "utf8")) as {
      scripts?: Record<string, unknown>;
    };
    for (const [name, command] of Object.entries(REQUIRED_SCRIPTS)) {
      if (packageJson.scripts?.[name] !== command) errors.push(`package script mismatch: ${name}`);
    }
  } catch {
    errors.push("package.json is missing or invalid");
  }

  let learnedRepos = new Set<string>();
  try {
    const registry = JSON.parse(
      await readFile(path.join(knowledgeRoot, "registry", "learned_repos.json"), "utf8")
    ) as { learned_count?: unknown; repos?: Array<{ repo?: unknown; status?: unknown }> };
    if (!Array.isArray(registry.repos)) throw new Error("repos missing");
    learnedRepos = new Set(
      registry.repos
        .filter((record) => record.status === undefined || record.status === "accepted")
        .map((record) => (typeof record.repo === "string" ? normalizeRepo(record.repo) : ""))
        .filter(Boolean)
    );
    learnedRegistryCount = learnedRepos.size;
    if (registry.learned_count !== learnedRegistryCount) {
      errors.push("learned registry count does not match accepted records");
    }
  } catch {
    errors.push("canonical learned registry is missing or invalid");
  }

  try {
    const registry = JSON.parse(
      await readFile(path.join(knowledgeRoot, "registry", "seed_repos.json"), "utf8")
    ) as { seed_count?: unknown; repos?: Array<{ rank?: unknown; repo?: unknown }> };
    if (!Array.isArray(registry.repos)) throw new Error("repos missing");
    const seeds = registry.repos
      .filter((record): record is { rank?: unknown; repo: string } => typeof record.repo === "string")
      .sort((left, right) => Number(left.rank ?? 0) - Number(right.rank ?? 0));
    seedRegistryCount = seeds.length;
    if (registry.seed_count !== seedRegistryCount) {
      errors.push("seed registry count does not match seed records");
    }
    nextPendingSeedRepo = seeds.find((seed) => !learnedRepos.has(normalizeRepo(seed.repo)))?.repo ?? null;
  } catch {
    errors.push("canonical seed registry is missing or invalid");
  }

  return {
    valid: errors.length === 0,
    commit,
    errors,
    knowledgeRoot,
    workContextsRoot,
    learnedRegistryCount,
    seedRegistryCount,
    nextPendingSeedRepo
  };
}
