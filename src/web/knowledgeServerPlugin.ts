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
  return items.sort((a, b) => String((b.frontmatter as { date?: string }).date ?? "").localeCompare(String((a.frontmatter as { date?: string }).date ?? "")));
}

async function runs(projectRoot: string) {
  const paths = getKnowledgePaths(projectRoot);
  const files = [...(await listFiles(paths.runsDir, ".json"))].filter((file) => !file.includes(`${path.sep}failed${path.sep}`));
  const failed = await listFiles(paths.failedRunsDir, ".json");
  const items = await Promise.all(
    [...files, ...failed].map(async (file) => ({
      file: toProjectRelative(projectRoot, file),
      data: await readJsonFile(file, {})
    }))
  );
  return items.sort((a, b) => String((b.data as { started_at?: string }).started_at ?? "").localeCompare(String((a.data as { started_at?: string }).started_at ?? "")));
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
