import YAML from "yaml";
import type { ParsedMarkdown } from "../types";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function parseMarkdown<T = Record<string, unknown>>(markdown: string): ParsedMarkdown<T> {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {} as T, body: markdown };
  }
  const frontmatter = (YAML.parse(match[1]) ?? {}) as T;
  const body = markdown.slice(match[0].length);
  return { frontmatter, body };
}

export function stringifyMarkdown(frontmatter: Record<string, unknown>, body: string): string {
  const yaml = YAML.stringify(frontmatter, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}
