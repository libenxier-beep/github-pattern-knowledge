import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const AUTOMATION_REQUIRED_INTERFACES = [
  "package.json",
  "REPOSITORY.md",
  "docs/daily-workflow.md",
  "docs/human-report-quality-standard.md",
  "docs/verification-checklist.md",
  "src/cli/automationPreflight.ts",
  "src/cli/daily.ts",
  "src/cli/finalize.ts",
  "src/cli/harness.ts",
  "src/harness/automationDeploymentIntegrity.ts",
  "src/scheduler/finalizeDeepDive.ts"
] as const;

const REQUIRED_SCRIPTS: Record<string, string> = {
  "automation-preflight": "tsx src/cli/automationPreflight.ts",
  daily: "tsx src/cli/daily.ts",
  finalize: "tsx src/cli/finalize.ts",
  harness: "tsx src/cli/harness.ts"
};

export interface AutomationDeploymentResult {
  valid: boolean;
  commit: string | null;
  errors: string[];
}

async function git(projectRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: projectRoot });
  return stdout.trim();
}

export async function validateAutomationDeployment(projectRoot: string): Promise<AutomationDeploymentResult> {
  const errors: string[] = [];
  let commit: string | null = null;

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

  return { valid: errors.length === 0, commit, errors };
}
