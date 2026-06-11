import type { PatternFrontmatter } from "../types";

type RetrievalTagFrontmatter = Pick<
  PatternFrontmatter,
  | "engineering_problems"
  | "project_types"
  | "pattern_types"
  | "transfer_targets"
  | "complexity"
  | "source_repos"
  | "use_when"
  | "avoid_when"
  | "tags"
>;

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function inlineCodeList(values: string[]): string {
  const clean = unique(values);
  return clean.length > 0 ? clean.map((value) => `\`${value}\``).join(", ") : "`none`";
}

function oneLine(value: string | undefined): string {
  return String(value ?? "Not specified.").replace(/\s+/g, " ").trim();
}

export function renderRetrievalTags(frontmatter: RetrievalTagFrontmatter): string {
  return `## Retrieval Tags
- Problems: ${inlineCodeList(frontmatter.engineering_problems)}
- Project types: ${inlineCodeList(frontmatter.project_types)}
- Pattern types: ${inlineCodeList(frontmatter.pattern_types)}
- Transfer targets: ${inlineCodeList(frontmatter.transfer_targets)}
- Complexity: \`${frontmatter.complexity}\`
- Source repos: ${inlineCodeList(frontmatter.source_repos.map((source) => source.repo))}
- Tags: ${inlineCodeList(frontmatter.tags ?? [])}
- Use when: ${oneLine(frontmatter.use_when[0])}
- Avoid when: ${oneLine(frontmatter.avoid_when[0])}`;
}

export function renderProgressiveDisclosure(): string {
  return `## Progressive Disclosure
- 10-second triage: read \`Retrieval Tags\` to decide whether this pattern matches the active task.
- 30-second decision: read \`Core Judgment\`, \`Use When\`, and \`Avoid When\`.
- 2-minute transfer check: read \`Boundary Decisions\`, \`Failure Modes\`, \`Simpler Alternatives\`, and \`Transfer Guidance\`.
- Evidence pass: read \`Source Evidence\` and selected source snapshots only when applying the pattern.`;
}

function hasSection(body: string, heading: string): boolean {
  return new RegExp(`^## ${heading}$`, "m").test(body);
}

function insertAfterTitle(body: string, section: string): string {
  const lines = body.trimEnd().split(/\r?\n/);
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  if (titleIndex === -1) {
    return `${section}\n\n${body.trimStart()}`;
  }

  lines.splice(titleIndex + 1, 0, "", section);
  return `${lines.join("\n")}\n`;
}

export function ensureRetrievalTagsSection(body: string, frontmatter: RetrievalTagFrontmatter): string {
  if (hasSection(body, "Retrieval Tags")) {
    return body;
  }

  return insertAfterTitle(body, renderRetrievalTags(frontmatter));
}

export function ensureProgressiveDisclosureSection(body: string): string {
  if (hasSection(body, "Progressive Disclosure")) {
    return body;
  }

  const section = renderProgressiveDisclosure();
  const retrievalHeading = "\n## Retrieval Tags\n";
  if (body.includes(retrievalHeading)) {
    return body.replace(retrievalHeading, `\n${section}\n\n## Retrieval Tags\n`);
  }

  return insertAfterTitle(body, section);
}

export function ensurePatternNavigationSections(body: string, frontmatter: RetrievalTagFrontmatter): string {
  return ensureProgressiveDisclosureSection(ensureRetrievalTagsSection(body, frontmatter));
}
