import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const executableName = process.platform === "win32" ? "tsx.cmd" : "tsx";
const tsxPath = path.join(projectRoot, "node_modules", ".bin", executableName);

async function exists(file, mode = constants.F_OK) {
  try {
    await access(file, mode);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args, stdout = process.stdout) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["inherit", stdout, process.stderr]
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

const lockfile = path.join(projectRoot, "package-lock.json");
if (!(await exists(lockfile))) {
  console.error("automation bootstrap failed: package-lock.json is missing or unreadable");
  process.exit(1);
}

console.error("automation bootstrap: reconciling locked dependencies for this checkout");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const install = await run(npm, ["ci", "--no-audit", "--no-fund"], process.stderr);
if (install.signal) {
  console.error(`automation bootstrap failed: npm ci terminated by ${install.signal}`);
  process.exit(1);
}
if (install.code !== 0) process.exit(install.code ?? 1);

if (!(await exists(tsxPath, constants.X_OK))) {
  console.error("automation bootstrap failed: node_modules/.bin/tsx is unavailable after npm ci");
  process.exit(1);
}

const preflight = await run(tsxPath, ["src/cli/automationPreflight.ts"]);
if (preflight.signal) {
  console.error(`automation preflight terminated by ${preflight.signal}`);
  process.exit(1);
}
process.exit(preflight.code ?? 1);
