import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { ensureDir, pathExists } from "../utils/fs";
import { safeKebab } from "../utils/paths";

const execFile = promisify(execFileCallback);

export type ClonePinnedRepoOptions = {
  repo: string;
  url: string;
  commit: string;
  destinationRoot: string;
};

export type LocalRepoReceipt = {
  repo: string;
  url: string;
  commit: string;
  checkout_path: string;
};

export async function clonePinnedRepo(options: ClonePinnedRepoOptions): Promise<LocalRepoReceipt> {
  const checkoutPath = path.resolve(options.destinationRoot, safeKebab(options.repo));
  await ensureDir(path.dirname(checkoutPath));

  if (await pathExists(path.join(checkoutPath, ".git"))) {
    await execFile("git", ["-C", checkoutPath, "fetch", "--quiet", "origin", options.commit]);
  } else {
    await execFile("git", ["clone", "--quiet", "--no-checkout", options.url, checkoutPath]);
  }
  await execFile("git", ["-C", checkoutPath, "checkout", "--quiet", "--detach", options.commit]);
  const { stdout } = await execFile("git", ["-C", checkoutPath, "rev-parse", "HEAD"]);
  const actualCommit = stdout.trim();
  if (actualCommit !== options.commit) {
    throw new Error(`Pinned checkout mismatch: expected ${options.commit}, got ${actualCommit}`);
  }
  return { repo: options.repo, url: options.url, commit: actualCommit, checkout_path: checkoutPath };
}
