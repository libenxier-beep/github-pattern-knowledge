import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export type EngineeringInventoryBuckets = {
  production_source: string[];
  tests: string[];
  examples: string[];
  docs: string[];
  config_ci: string[];
  scripts: string[];
  assets: string[];
  other: string[];
};

export type EngineeringInventory = {
  repo_root: string;
  total_tracked_files: number;
  classified_files: number;
  language_counts: Record<string, number>;
  production_roots: string[];
  buckets: EngineeringInventoryBuckets;
  unclassified_files: string[];
};

function extensionKey(file: string): string {
  const extension = path.extname(file).toLowerCase();
  return extension || "[no-extension]";
}

function explicitSetuptoolsPackageRoots(pyproject: string): string[] {
  const lines = pyproject.split(/\r?\n/);
  let inSetuptools = false;
  let packageList = "";
  for (const line of lines) {
    if (/^\s*\[[^\]]+\]\s*$/.test(line)) {
      inSetuptools = /^\s*\[tool\.setuptools\]\s*$/.test(line);
      continue;
    }
    if (!inSetuptools && !packageList) continue;
    if (!packageList && /^\s*packages\s*=/.test(line)) {
      packageList = line;
    } else if (packageList && !packageList.includes("]")) {
      packageList += `\n${line}`;
    }
    if (packageList.includes("]")) break;
  }
  return [...packageList.matchAll(/["']([^"']+)["']/g)]
    .map((match) => match[1].split(".")[0])
    .filter(Boolean);
}

async function inferProductionRoots(repoRoot: string, files: string[]): Promise<string[]> {
  const roots = new Set<string>();
  for (const conventional of ["src", "lib", "packages", "app", "apps"]) {
    if (files.some((file) => file.startsWith(`${conventional}/`))) roots.add(conventional);
  }
  if (files.includes("pyproject.toml")) {
    try {
      const pyproject = await readFile(path.join(repoRoot, "pyproject.toml"), "utf8");
      const projectName = pyproject.match(/^name\s*=\s*["']([^"']+)["']/m)?.[1];
      if (projectName) {
        const packageRoot = projectName.replace(/-/g, "_");
        if (files.some((file) => file.startsWith(`${packageRoot}/`))) roots.add(packageRoot);
      }
      for (const packageRoot of explicitSetuptoolsPackageRoots(pyproject)) {
        if (files.some((file) => file.startsWith(`${packageRoot}/`))) roots.add(packageRoot);
      }
    } catch {
      // Inventory remains useful without package metadata.
    }
  }
  return [...roots].sort();
}

export async function inventoryEngineeringFiles(repoRoot: string): Promise<EngineeringInventory> {
  const absoluteRoot = path.resolve(repoRoot);
  const { stdout } = await execFile("git", ["-C", absoluteRoot, "ls-files", "-z"], { encoding: "buffer" });
  const files = stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  const productionRoots = await inferProductionRoots(absoluteRoot, files);
  const buckets: EngineeringInventoryBuckets = {
    production_source: [],
    tests: [],
    examples: [],
    docs: [],
    config_ci: [],
    scripts: [],
    assets: [],
    other: []
  };

  for (const file of files) {
    const lower = file.toLowerCase();
    if (/^(tests?|__tests__)\//.test(lower) || /(?:^|\/)(?:test_|[^/]+\.(?:test|spec)\.)/.test(lower)) {
      buckets.tests.push(file);
    } else if (/(?:^|\/)examples?\//.test(lower)) {
      buckets.examples.push(file);
    } else if (/^(docs?|skills?)\//.test(lower) || lower.endsWith(".md")) {
      buckets.docs.push(file);
    } else if (/^(\.github|docker)\//.test(lower) || /(^|\/)(?:pyproject\.toml|package\.json|.*\.ya?ml|.*\.toml|.*\.json)$/.test(lower)) {
      buckets.config_ci.push(file);
    } else if (/^(scripts?|bin)\//.test(lower) || lower.endsWith(".sh")) {
      buckets.scripts.push(file);
    } else if (/\.(?:png|jpe?g|gif|svg|webp|ico|mp4|mov|woff2?|ttf)$/.test(lower)) {
      buckets.assets.push(file);
    } else if (productionRoots.some((root) => file.startsWith(`${root}/`))) {
      buckets.production_source.push(file);
    } else {
      buckets.other.push(file);
    }
  }

  const languageCounts: Record<string, number> = {};
  for (const file of files) {
    const key = extensionKey(file);
    languageCounts[key] = (languageCounts[key] ?? 0) + 1;
  }
  const classifiedFiles = Object.values(buckets).reduce((count, entries) => count + entries.length, 0);

  return {
    repo_root: absoluteRoot,
    total_tracked_files: files.length,
    classified_files: classifiedFiles,
    language_counts: languageCounts,
    production_roots: productionRoots,
    buckets,
    unclassified_files: files.filter((file) => !Object.values(buckets).some((entries) => entries.includes(file)))
  };
}
