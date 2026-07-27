import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { parseMarkdown } from "../knowledge/frontmatter";
import { pathExists } from "../utils/fs";
import { getKnowledgePaths, toProjectRelative } from "../utils/paths";
import { buildArchiveSummary } from "./archiveSummary";

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await pathExists(filePath))) {
    return fallback;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function sendJson(res: ServerResponse, value: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

async function listFiles(dir: string, extension: string): Promise<string[]> {
  if (!(await pathExists(dir))) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listFiles(fullPath, extension)));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      result.push(fullPath);
    }
  }
  return result.sort();
}

function timeValue(data: Record<string, unknown>, ...fields: string[]): number {
  for (const field of fields) {
    const value = data[field];
    if (typeof value !== "string") continue;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function runStatusRank(data: Record<string, unknown>): number {
  if (data.status === "success") return 2;
  if (data.status === "failed") return 1;
  return 0;
}

async function cards(projectRoot: string) {
  const paths = getKnowledgePaths(projectRoot);
  const files = await listFiles(paths.cardsDir, ".md");
  const items = await Promise.all(
    files.map(async (file) => {
      const markdown = await readFile(file, "utf8");
      const parsed = parseMarkdown(markdown);
      return {
        file: toProjectRelative(projectRoot, file),
        frontmatter: parsed.frontmatter,
        body: parsed.body
      };
    })
  );
  return items.sort(
    (a, b) =>
      timeValue(b.frontmatter as Record<string, unknown>, "created_at", "date") -
      timeValue(a.frontmatter as Record<string, unknown>, "created_at", "date")
  );
}

async function runs(projectRoot: string) {
  const paths = getKnowledgePaths(projectRoot);
  const files = [...(await listFiles(paths.runsDir, ".json"))].filter((file) => !file.includes(`${path.sep}failed${path.sep}`));
  const failed = await listFiles(paths.failedRunsDir, ".json");
  const items = await Promise.all(
    [...files, ...failed].map(async (file) => ({
      file: toProjectRelative(projectRoot, file),
      data: await readJsonFile<Record<string, unknown>>(file, {})
    }))
  );
  const logicalRuns = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const runId = typeof item.data.run_id === "string" && item.data.run_id.trim() ? item.data.run_id : item.file;
    const current = logicalRuns.get(runId);
    if (!current) {
      logicalRuns.set(runId, item);
      continue;
    }
    const itemRank = runStatusRank(item.data);
    const currentRank = runStatusRank(current.data);
    if (
      itemRank > currentRank ||
      (itemRank === currentRank && timeValue(item.data, "finished_at") > timeValue(current.data, "finished_at"))
    ) {
      logicalRuns.set(runId, item);
    }
  }
  return [...logicalRuns.values()].sort(
    (a, b) => timeValue(b.data, "finished_at", "started_at") - timeValue(a.data, "finished_at", "started_at")
  );
}

async function rejected(projectRoot: string) {
  const paths = getKnowledgePaths(projectRoot);
  const files = [...(await listFiles(paths.rejectedPatternsDir, ".json")), ...(await listFiles(paths.rejectedCardsDir, ".json"))];
  const items = await Promise.all(
    files.map(async (file) => ({
      file: toProjectRelative(projectRoot, file),
      data: await readJsonFile(file, {})
    }))
  );
  return items.sort((a, b) => a.file.localeCompare(b.file));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, projectRoot: string): Promise<boolean> {
  if (!req.url?.startsWith("/api/knowledge")) {
    return false;
  }
  const paths = getKnowledgePaths(projectRoot);
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname.replace("/api/knowledge", "") || "/";

  try {
    if (route === "/summary") {
      const index = await readJsonFile(path.join(paths.indexesDir, "index.json"), { pattern_count: 0, patterns: [] });
      const cardItems = await cards(projectRoot);
      const runItems = await runs(projectRoot);
      const rejectedItems = await rejected(projectRoot);
      const archive = await buildArchiveSummary(projectRoot);
      sendJson(res, { index, latest_card: cardItems[0] ?? null, cards: cardItems, runs: runItems, rejected: rejectedItems, archive });
      return true;
    }
    if (route === "/index") {
      sendJson(res, await readJsonFile(path.join(paths.indexesDir, "index.json"), { pattern_count: 0, patterns: [] }));
      return true;
    }
    if (route.startsWith("/axis/")) {
      const axis = route.replace("/axis/", "");
      sendJson(res, await readJsonFile(path.join(paths.indexesDir, `${axis}.json`), {}));
      return true;
    }
    if (route === "/cards") {
      sendJson(res, await cards(projectRoot));
      return true;
    }
    if (route === "/archive") {
      sendJson(res, await buildArchiveSummary(projectRoot));
      return true;
    }
    if (route === "/runs") {
      sendJson(res, await runs(projectRoot));
      return true;
    }
    if (route === "/rejected") {
      sendJson(res, await rejected(projectRoot));
      return true;
    }
    if (route.startsWith("/pattern/")) {
      const id = decodeURIComponent(route.replace("/pattern/", ""));
      const filePath = path.join(paths.patternsDir, `${id}.md`);
      if (!(await pathExists(filePath))) {
        sendJson(res, { error: "pattern not found" }, 404);
        return true;
      }
      const markdown = await readFile(filePath, "utf8");
      const parsed = parseMarkdown(markdown);
      sendJson(res, { file: toProjectRelative(projectRoot, filePath), frontmatter: parsed.frontmatter, body: parsed.body });
      return true;
    }
    sendJson(res, { error: "unknown route" }, 404);
    return true;
  } catch (error) {
    sendJson(res, { error: error instanceof Error ? error.message : "unknown api error" }, 500);
    return true;
  }
}

export function knowledgeServerPlugin(): Plugin {
  return {
    name: "knowledge-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!(await handleApi(req, res, process.cwd()))) {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!(await handleApi(req, res, process.cwd()))) {
          next();
        }
      });
    }
  };
}
