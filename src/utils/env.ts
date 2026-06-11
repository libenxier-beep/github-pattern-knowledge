import { readFileSync } from "node:fs";
import path from "node:path";

let loaded = false;

export function loadDotEnvLocal(projectRoot = process.cwd()): void {
  if (loaded) {
    return;
  }
  loaded = true;
  const filePath = path.join(projectRoot, ".env.local");
  let content = "";
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const index = line.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && value && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
