import path from "node:path";
import type { CardFrontmatter, HarnessResult, PatternFrontmatter, Taxonomy } from "../types";
import { parseMarkdown } from "../knowledge/frontmatter";

const REQUIRED_PATTERN_FIELDS: Array<keyof PatternFrontmatter> = [
  "id",
  "name",
  "summary",
  "engineering_problems",
  "project_types",
  "pattern_types",
  "complexity",
  "quality_score",
  "source_repos",
  "use_when",
  "avoid_when",
  "tradeoffs",
  "transfer_targets",
  "related_patterns",
  "created_at",
  "updated_at",
  "run_id"
];

const REQUIRED_SECTIONS = [
  "Progressive Disclosure",
  "Retrieval Tags",
  "Engineering Problem",
  "Core Judgment",
  "Use When",
  "Avoid When",
  "Design Forces",
  "Boundary Decisions",
  "Failure Modes",
  "Simpler Alternatives",
  "Transfer Guidance",
  "Implementation Hint",
  "Source Evidence"
];

const FORBIDDEN_PHRASES = [
  "这个项目结构清晰，值得学习",
  "该项目使用模块化设计",
  "这个项目工程质量很高",
  "适合学习架构设计",
  "project structure is clear and worth learning"
];

function result(errors: string[], warnings: string[] = []): HarnessResult {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checked_at: new Date().toISOString()
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function sectionContent(body: string, section: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${section}`);
  if (start === -1) {
    return "";
  }
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      break;
    }
    collected.push(lines[index]);
  }
  return collected.join("\n").trim();
}

function validateStringArray(field: string, value: unknown, errors: string[], minItemLength = 3): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${field} must be a non-empty array`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.trim().length < minItemLength) {
      errors.push(`${field}[${index}] must be a specific string`);
    }
  });
}

function validateRetrievalTagsSection(content: string, errors: string[]): void {
  const requiredLabels = [
    "Problems:",
    "Project types:",
    "Pattern types:",
    "Transfer targets:",
    "Complexity:",
    "Source repos:",
    "Tags:",
    "Use when:",
    "Avoid when:"
  ];
  for (const label of requiredLabels) {
    if (!content.includes(label)) {
      errors.push(`Retrieval Tags section must include ${label}`);
    }
  }
}

function validateProgressiveDisclosureSection(content: string, errors: string[]): void {
  const requiredPhrases = ["10-second triage", "30-second decision", "2-minute transfer check", "Evidence pass"];
  for (const phrase of requiredPhrases) {
    if (!content.includes(phrase)) {
      errors.push(`Progressive Disclosure section must include ${phrase}`);
    }
  }
}

export function validatePatternMarkdown(fileName: string, markdown: string, taxonomy: Taxonomy): HarnessResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { frontmatter, body } = parseMarkdown<Partial<PatternFrontmatter>>(markdown);
  const baseName = path.basename(fileName);

  if (!markdown.startsWith("---\n")) {
    errors.push("pattern note must include YAML frontmatter");
  }
  if (!body.trim()) {
    errors.push("pattern note must include Markdown body");
  }

  for (const field of REQUIRED_PATTERN_FIELDS) {
    if (frontmatter[field] === undefined || frontmatter[field] === null) {
      errors.push(`${field} is required`);
    }
  }

  if (typeof frontmatter.id === "string") {
    if (!/^pattern-[a-z0-9-]+$/.test(frontmatter.id)) {
      errors.push("id must be kebab-case and start with pattern-");
    }
    if (baseName !== `${frontmatter.id}.md`) {
      errors.push("file name must match pattern id");
    }
    if (frontmatter.id.length > 100) {
      warnings.push("id is longer than recommended");
    }
  }

  if (typeof frontmatter.name !== "string" || frontmatter.name.trim().length < 6) {
    errors.push("name must be a specific string");
  }
  if (typeof frontmatter.summary !== "string" || frontmatter.summary.trim().length < 40) {
    errors.push("summary must be a specific one-sentence summary");
  }
  if (!["low", "medium", "high"].includes(String(frontmatter.complexity))) {
    errors.push("complexity must be low, medium, or high");
  }
  if (typeof frontmatter.quality_score !== "number" || frontmatter.quality_score < 0 || frontmatter.quality_score > 100) {
    errors.push("quality_score must be a number between 0 and 100");
  }

  validateStringArray("engineering_problems", frontmatter.engineering_problems, errors);
  validateStringArray("project_types", frontmatter.project_types, errors);
  validateStringArray("pattern_types", frontmatter.pattern_types, errors);
  validateStringArray("use_when", frontmatter.use_when, errors, 16);
  validateStringArray("avoid_when", frontmatter.avoid_when, errors, 16);
  validateStringArray("tradeoffs", frontmatter.tradeoffs, errors, 16);
  validateStringArray("transfer_targets", frontmatter.transfer_targets, errors);
  if (!Array.isArray(frontmatter.related_patterns)) {
    errors.push("related_patterns must be an array");
  }

  asStringArray(frontmatter.engineering_problems).forEach((value) => {
    if (!taxonomy.engineering_problems.includes(value)) {
      errors.push(`unknown engineering_problem taxonomy value: ${value}`);
    }
  });
  asStringArray(frontmatter.project_types).forEach((value) => {
    if (!taxonomy.project_types.includes(value)) {
      errors.push(`unknown project_type taxonomy value: ${value}`);
    }
  });
  asStringArray(frontmatter.pattern_types).forEach((value) => {
    if (!taxonomy.pattern_types.includes(value)) {
      errors.push(`unknown pattern_type taxonomy value: ${value}`);
    }
  });
  asStringArray(frontmatter.transfer_targets).forEach((value) => {
    if (!taxonomy.transfer_targets.includes(value)) {
      errors.push(`unknown transfer_target taxonomy value: ${value}`);
    }
  });

  if (!Array.isArray(frontmatter.source_repos) || frontmatter.source_repos.length === 0) {
    errors.push("source_repos must include at least one source repo");
  } else {
    frontmatter.source_repos.forEach((source, index) => {
      if (!source || typeof source !== "object") {
        errors.push(`source_repos[${index}] must be an object`);
        return;
      }
      if (typeof source.repo !== "string" || !source.repo.includes("/")) {
        errors.push(`source_repos[${index}].repo must be owner/name or fixture/name`);
      }
      if (typeof source.url !== "string" || source.url.length < 8) {
        errors.push(`source_repos[${index}].url must be present`);
      }
      if (!Array.isArray(source.reference_files) || source.reference_files.length === 0) {
        errors.push(`source_repos[${index}].reference_files must include at least one file`);
      }
    });
  }

  for (const section of REQUIRED_SECTIONS) {
    const content = sectionContent(body, section);
    if (!content) {
      errors.push(`missing required section: ${section}`);
    } else if (content.length < 80 && section !== "Implementation Hint") {
      errors.push(`${section} section must be specific enough`);
    }
  }

  const retrievalTags = sectionContent(body, "Retrieval Tags");
  if (retrievalTags) {
    validateRetrievalTagsSection(retrievalTags, errors);
  }
  const progressiveDisclosure = sectionContent(body, "Progressive Disclosure");
  if (progressiveDisclosure) {
    validateProgressiveDisclosureSection(progressiveDisclosure, errors);
  }

  const sourceEvidence = sectionContent(body, "Source Evidence");
  const sourceRepos = Array.isArray(frontmatter.source_repos) ? frontmatter.source_repos : [];
  const evidenceMentionsSource = sourceRepos.some((source) => {
    const refs = Array.isArray(source.reference_files) ? source.reference_files : [];
    return sourceEvidence.includes(source.repo) || refs.some((ref) => sourceEvidence.includes(ref));
  });
  if (!evidenceMentionsSource) {
    errors.push("Source Evidence must mention the source repo or a reference file");
  }

  for (const phrase of FORBIDDEN_PHRASES) {
    if (markdown.toLowerCase().includes(phrase.toLowerCase())) {
      errors.push(`forbidden generic phrase: ${phrase}`);
    }
  }

  return result(errors, warnings);
}

export function validateCardMarkdown(fileName: string, markdown: string): HarnessResult {
  const errors: string[] = [];
  const { frontmatter, body } = parseMarkdown<Partial<CardFrontmatter>>(markdown);
  const required = ["一句话", "今天抽取的模式", "为什么值得学", "宏观架构启发", "微决策启发", "可迁移场景", "不要照搬的场景", "和本地 Agent 工具的关联"];

  if (!fileName.endsWith(".md")) {
    errors.push("card file must be Markdown");
  }
  if (frontmatter.card_type !== "daily_design_card") {
    errors.push("card_type must be daily_design_card");
  }
  if (!frontmatter.source_repo || !frontmatter.source_url || !frontmatter.run_id) {
    errors.push("card must include source repo, source url, and run id");
  }
  if (!Array.isArray(frontmatter.patterns) || frontmatter.patterns.length === 0) {
    errors.push("card must reference at least one pattern id");
  }
  for (const heading of required) {
    if (!body.includes(`## ${heading}`)) {
      errors.push(`missing card section: ${heading}`);
    }
  }
  return result(errors);
}
