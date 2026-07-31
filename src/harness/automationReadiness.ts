import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import {
  resolveGitHubCredential,
  type GitHubCredential,
  type GitHubCredentialSource
} from "../github/credentials";
import { recoverExpiredRunLease, type RecoveredRunLease, type RunLease } from "../scheduler/runLease";
import { recoverInterruptedPublication, type PublicationRecovery } from "../scheduler/publicationTransaction";
import { getKnowledgePaths, getWorkContextsRoot } from "../utils/paths";
import { validateAutomationDeployment, type AutomationDeploymentResult } from "./automationDeploymentIntegrity";

const execFile = promisify(execFileCallback);
const ACTIVE_RUN_FILE = ".github-pattern-knowledge-active-run.json";
const DEFAULT_WORK_CONTEXT_CHECK_TIMEOUT_MS = 90_000;

export type FeishuCapability = {
  ready: boolean;
  profile: "github-pattern-report";
  identity: "bot" | "unavailable";
};

export type AutomationReadinessOptions = {
  knowledgeRoot?: string;
  workContextsRoot?: string;
  resolveGitHub?: () => GitHubCredential;
  checkFeishu?: () => Promise<FeishuCapability>;
  checkWorkContexts?: () => Promise<{ ready: boolean; checks: string[] }>;
  workContextCheckTimeoutMs?: number;
  recoverExpiredLease?: boolean;
  now?: Date;
};

export type AutomationReadinessResult = AutomationDeploymentResult & {
  capabilities: {
    github: { ready: boolean; source: GitHubCredentialSource };
    feishu: FeishuCapability;
    authority_writable: boolean;
    active_run: RunLease | null;
    recovered_run: RecoveredRunLease | null;
    recovered_publication: PublicationRecovery | null;
    work_contexts: { ready: boolean; checks: string[] };
  };
};

async function defaultFeishuCheck(): Promise<FeishuCapability> {
  try {
    const { stdout } = await execFile(
      "lark-cli",
      ["--profile", "github-pattern-report", "whoami", "--as", "bot"],
      { timeout: 10_000, maxBuffer: 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout) as { available?: unknown; tokenStatus?: unknown; identity?: { type?: unknown } };
    const ready = parsed.available === true && parsed.tokenStatus === "ready";
    return { ready, profile: "github-pattern-report", identity: ready ? "bot" : "unavailable" };
  } catch {
    return { ready: false, profile: "github-pattern-report", identity: "unavailable" };
  }
}

async function readActiveRun(knowledgeRoot: string): Promise<RunLease | null> {
  try {
    return JSON.parse(await readFile(path.join(knowledgeRoot, ACTIVE_RUN_FILE), "utf8")) as RunLease;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    if (code === "ENOENT") return null;
    throw new Error("Active automation run lease is unreadable");
  }
}

async function defaultWorkContextCheck(
  workContextsRoot: string,
  timeoutMs: number
): Promise<{ ready: boolean; checks: string[] }> {
  const checks: Array<[string, string[]]> = [
    ["validate", ["scripts/validate_work_contexts.py"]],
    ["routing", ["scripts/route_context.py", "--evaluate", "--format", "text"]],
    ["lifecycle", ["scripts/audit_artifact_lifecycle.py"]]
  ];
  try {
    await Promise.all(checks.map(([, args]) =>
      execFile("python3", args, { cwd: workContextsRoot, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 })
    ));
    return { ready: true, checks: checks.map(([name]) => name) };
  } catch {
    return { ready: false, checks: checks.map(([name]) => name) };
  }
}

export async function validateAutomationReadiness(
  projectRoot: string,
  options: AutomationReadinessOptions = {}
): Promise<AutomationReadinessResult> {
  const knowledgeRoot = path.resolve(options.knowledgeRoot ?? getKnowledgePaths(projectRoot).knowledgeRoot);
  const workContextsRoot = path.resolve(options.workContextsRoot ?? getWorkContextsRoot(projectRoot));
  const deployment = await validateAutomationDeployment(projectRoot, { knowledgeRoot, workContextsRoot });
  const errors = [...deployment.errors];

  const github = (options.resolveGitHub ?? resolveGitHubCredential)();
  if (!github.token) errors.push("GitHub authenticated credential unavailable");

  const feishu = await (options.checkFeishu ?? defaultFeishuCheck)();
  if (!feishu.ready) errors.push("Feishu bot profile github-pattern-report unavailable");

  const workContextCheckTimeoutMs = options.workContextCheckTimeoutMs ?? DEFAULT_WORK_CONTEXT_CHECK_TIMEOUT_MS;
  const workContexts = await (
    options.checkWorkContexts ?? (() => defaultWorkContextCheck(workContextsRoot, workContextCheckTimeoutMs))
  )();
  if (!workContexts.ready) errors.push("Canonical Work Context validation, routing, or lifecycle audit failed");

  let authorityWritable = true;
  try {
    await Promise.all([access(knowledgeRoot, constants.R_OK | constants.W_OK), access(workContextsRoot, constants.R_OK | constants.W_OK)]);
  } catch {
    authorityWritable = false;
    errors.push("Canonical Work Context authority is not readable and writable");
  }

  let recoveredRun: RecoveredRunLease | null = null;
  let recoveredPublication: PublicationRecovery | null = null;
  if (
    options.recoverExpiredLease !== false &&
    knowledgeRoot === getKnowledgePaths(projectRoot).knowledgeRoot
  ) {
    recoveredPublication = await recoverInterruptedPublication(projectRoot);
    recoveredRun = await recoverExpiredRunLease(projectRoot, options.now);
  }
  const activeRun = await readActiveRun(knowledgeRoot);
  if (activeRun) errors.push(`Unfinished automation run requires resume or abort: ${activeRun.run_id}`);

  return {
    ...deployment,
    valid: errors.length === 0,
    errors,
    capabilities: {
      github: { ready: Boolean(github.token), source: github.source },
      feishu,
      authority_writable: authorityWritable,
      active_run: activeRun,
      recovered_run: recoveredRun,
      recovered_publication: recoveredPublication,
      work_contexts: workContexts
    }
  };
}
