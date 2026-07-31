import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const MAX_REPAIR_ATTEMPTS = 3;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

const REPAIRABLE_FINALIZATION_ERRORS = [
  "Deep-dive artifact locator is not canonical:",
  "Deep-dive artifact escapes Work Context root:",
  "Deep-dive value gate failed:",
  "Deep-dive artifact harness failed:",
  "Deep-dive report gate failed:",
  "Deep-dive active card gate failed:",
  "Deep-dive artifact provenance mismatch:",
  "Deep-dive primary value evidence locator invalid",
  "Deep-dive primary value evidence missing from pinned checkout:",
  "Deep-dive core paradigm evidence locator invalid:",
  "Deep-dive core paradigm evidence missing from pinned checkout:",
  "Deep-dive evidence locator invalid:",
  "Deep-dive evidence missing from pinned checkout:",
  "Deep-dive core paradigm canonical unit missing:",
  "Deep-dive canonical Work Context artifact does not declare core paradigm:",
  "Deep-dive canonical Work Context artifact does not explain core paradigm:",
  "Deep-dive independent reader review is missing or invalid JSON",
  "Deep-dive independent reader review failed its contract",
  "Deep-dive independent reader review failed its core paradigm contract",
  "Deep-dive staged publication is not owned by run drafts:",
  "Deep-dive publication plan missing target:",
  "Deep-dive publication plan contains unowned target:",
  "Deep-dive duplicate publication target:",
  "Deep-dive artifact missing:"
] as const;

export type FinalizationRepairPlan = {
  schema_version: 1;
  run_id: string;
  attempt: number;
  max_attempts: number;
  action: "repair_run_artifacts" | "abort_run";
  reason: "repairable_prepublication_gate" | "non_repairable_gate" | "repair_attempts_exhausted";
  exact_error: string;
  allowed_mutations: string[];
  protected_authorities: string[];
  rerun_daily: false;
  next_command: string;
};

export function buildFinalizationRepairPlan(input: {
  runId: string;
  attempt: number;
  error: string;
}): FinalizationRepairPlan {
  if (!RUN_ID.test(input.runId)) throw new Error("Finalization repair run id invalid");
  if (!Number.isInteger(input.attempt) || input.attempt < 1) {
    throw new Error("Finalization repair attempt must be a positive integer");
  }
  const exactError = input.error.trim();
  if (!exactError) throw new Error("Finalization repair error is required");

  const allowedMutations = [
    `github_engineering_patterns/sources/run-${input.runId.replace(/^run-/, "")}/drafts/**`,
    `github_engineering_patterns/sources/runs/${input.runId}/drafts/**`,
    `github_engineering_patterns/sources/runs/${input.runId}/accepted.md`,
    `github_engineering_patterns/sources/runs/${input.runId}/rejected.md`,
    `github_engineering_patterns/sources/runs/${input.runId}/rejected/**`,
    `github_engineering_patterns/sources/runs/${input.runId}/judgment.json`,
    `github_engineering_patterns/sources/runs/${input.runId}/source_review.json`,
    `github_engineering_patterns/sources/runs/${input.runId}/reader_review.json`,
    `github_engineering_patterns/sources/runs/${input.runId}/value_manifest.json`
  ];
  const protectedAuthorities = [
    "tool_repository/**",
    "automation_configuration/**",
    "skills/**",
    "memory_rules/**",
    "github_engineering_patterns/registry/**",
    "github_engineering_patterns/indexes/**",
    "github_engineering_patterns/patterns/**",
    "github_engineering_patterns/cards/**",
    `github_engineering_patterns/sources/${input.runId}/repo_snapshot.json`,
    `github_engineering_patterns/sources/runs/${input.runId}/checkout_receipt.json`,
    `github_engineering_patterns/sources/runs/${input.runId}/inventory.json`,
    `github_engineering_patterns/sources/runs/${input.runId}/run.json`,
    `github_engineering_patterns/sources/runs/${input.runId}/*.schema.json`,
    `github_engineering_patterns/sources/${input.runId}/tracked-file-inventory*`,
    "local-deps/**"
  ];
  const exhausted = input.attempt > MAX_REPAIR_ATTEMPTS;
  const repairable = REPAIRABLE_FINALIZATION_ERRORS.some((prefix) => exactError.startsWith(prefix));
  const action = !exhausted && repairable ? "repair_run_artifacts" : "abort_run";
  const reason = exhausted
    ? "repair_attempts_exhausted"
    : repairable
      ? "repairable_prepublication_gate"
      : "non_repairable_gate";

  return {
    schema_version: 1,
    run_id: input.runId,
    attempt: input.attempt,
    max_attempts: MAX_REPAIR_ATTEMPTS,
    action,
    reason,
    exact_error: exactError,
    allowed_mutations: allowedMutations,
    protected_authorities: protectedAuthorities,
    rerun_daily: false,
    next_command: action === "repair_run_artifacts"
      ? "repair only allowed run artifacts, repeat required independent review when substance changes, then rerun finalize"
      : "run automation-abort with the exact failed gate"
  };
}

async function git(projectRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd: projectRoot });
  return stdout.trim();
}

export async function assertToolingAuthorityUnchanged(
  projectRoot: string,
  expectedCommit?: string
): Promise<string | null> {
  let currentCommit: string;
  try {
    const inside = await git(projectRoot, ["rev-parse", "--is-inside-work-tree"]);
    if (inside !== "true") return null;
    currentCommit = await git(projectRoot, ["rev-parse", "HEAD"]);
  } catch {
    return null;
  }

  const status = await git(projectRoot, ["status", "--porcelain", "--untracked-files=all"]);
  if (status) throw new Error("Deep-dive tooling authority is dirty; repair may not modify standards, tests, schemas, skills, or pipeline code");
  if (expectedCommit && currentCommit !== expectedCommit) {
    throw new Error(
      `Deep-dive tooling authority commit changed during active run: expected ${expectedCommit}, got ${currentCommit}`
    );
  }
  return currentCommit;
}

export async function readToolingCommit(projectRoot: string): Promise<string | null> {
  return assertToolingAuthorityUnchanged(projectRoot);
}
