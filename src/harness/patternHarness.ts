import path from "node:path";
import type { CardFrontmatter, HarnessResult, PatternFrontmatter, Taxonomy } from "../types";
import { canonicalizePortableLocator } from "../deepDive/valueFunction";
import { assessHumanReportReadability } from "../deepDive/reportReadability";
import { parseMarkdown } from "../knowledge/frontmatter";

const REQUIRED_PATTERN_FIELDS: Array<keyof PatternFrontmatter> = [
  "id",
  "name",
  "summary",
  "engineering_problems",
  "project_types",
  "pattern_types",
  "complexity",
  "evidence_strength",
  "maturity",
  "risk_level",
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
  "Evidence Table",
  "Source Evidence"
];

const FORBIDDEN_PHRASES = [
  "这个项目结构清晰，值得学习",
  "该项目使用模块化设计",
  "这个项目工程质量很高",
  "适合学习架构设计",
  "project structure is clear and worth learning"
];

const LEGACY_CARD_SECTIONS = [
  "一句话",
  "今天抽取的模式",
  "为什么值得学",
  "宏观架构启发",
  "微决策启发",
  "可迁移场景",
  "不要照搬的场景",
  "和本地 Agent 工具的关联"
];

const DECISION_FIRST_CARD_SECTIONS = ["项目本身做什么", "核心机制如何工作", "与相邻方法的区别和组合", "最重要的迁移"];
const DECISION_FIRST_CONTRACT_DATE = "2026-07-26";

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

function validCommitRef(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  return /^[a-f0-9]{40}$/i.test(value) || /^fixture-[a-z0-9-]+$/i.test(value);
}

function validateEvidenceTable(content: string, referenceFiles: string[], errors: string[]): void {
  const requiredLabels = ["Reference file", "Observed structure", "Concrete names", "Why it supports"];
  for (const label of requiredLabels) {
    if (!content.includes(label)) {
      errors.push(`Evidence Table must include ${label}`);
    }
  }

  for (const ref of referenceFiles) {
    if (!content.includes(ref)) {
      errors.push(`Evidence Table must mention reference file: ${ref}`);
      continue;
    }
    const row = content
      .split(/\r?\n/)
      .find((line) => line.includes(ref) && line.includes("|"));
    if (!row) {
      errors.push(`Evidence Table must include a table row for reference file: ${ref}`);
      continue;
    }
    const cells = row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    if (cells.length < 4) {
      errors.push(`Evidence Table row for ${ref} must include observed structure, concrete names, and support rationale`);
      continue;
    }
    const [, observed, concrete, supports] = cells;
    if (!observed || observed.length < 24) {
      errors.push(`Evidence Table observed structure for ${ref} must be specific`);
    }
    if (!concrete || concrete.length < 8 || !/[`A-Za-z0-9_().:-]/.test(concrete)) {
      errors.push(`Evidence Table concrete names for ${ref} must cite functions, classes, tests, modules, or config keys`);
    }
    if (!supports || supports.length < 32) {
      errors.push(`Evidence Table support rationale for ${ref} must explain why the evidence supports the pattern`);
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
  if (frontmatter.core_functional_paradigm_ids !== undefined) {
    validateStringArray("core_functional_paradigm_ids", frontmatter.core_functional_paradigm_ids, errors);
    for (const id of asStringArray(frontmatter.core_functional_paradigm_ids)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
        errors.push(`core_functional_paradigm_ids must contain kebab-case ids: ${id}`);
      }
    }
  }
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
      if (!validCommitRef(source.commit)) {
        errors.push(`source_repos[${index}].commit must be a concrete commit SHA or fixture commit id`);
      }
      if (!Array.isArray(source.reference_files) || source.reference_files.length < 2) {
        errors.push(`source_repos[${index}].reference_files must include at least two files`);
      } else if (source.reference_files.length > 4) {
        errors.push(`source_repos[${index}].reference_files must include no more than four files`);
      } else {
        const canonicalFiles: string[] = [];
        source.reference_files.forEach((file, fileIndex) => {
          if (typeof file !== "string" || file.trim().length < 3) {
            errors.push(`source_repos[${index}].reference_files[${fileIndex}] must be a concrete file path`);
            return;
          }
          const locator = canonicalizePortableLocator(file);
          if (file.includes("#") || !locator.safe || !locator.canonical_form) {
            errors.push(`source_repos[${index}].reference_files[${fileIndex}] must be a canonical repo-relative file path`);
            return;
          }
          canonicalFiles.push(locator.canonical);
        });
        if (canonicalFiles.length !== source.reference_files.length || new Set(canonicalFiles).size !== canonicalFiles.length) {
          errors.push(`source_repos[${index}].reference_files must include at least two distinct canonical files`);
        }
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

  const sourceRepos = Array.isArray(frontmatter.source_repos) ? frontmatter.source_repos : [];
  const evidenceTable = sectionContent(body, "Evidence Table");
  const referenceFiles = sourceRepos.flatMap((source) => (Array.isArray(source.reference_files) ? source.reference_files : []));
  if (evidenceTable) {
    validateEvidenceTable(evidenceTable, referenceFiles, errors);
  } else {
    for (const ref of referenceFiles) {
      errors.push(`Evidence Table must mention reference file: ${ref}`);
    }
  }

  const sourceEvidence = sectionContent(body, "Source Evidence");
  const evidenceMentionsSource = sourceRepos.some((source) => {
    const refs = Array.isArray(source.reference_files) ? source.reference_files : [];
    const commit = typeof source.commit === "string" ? source.commit : "";
    return (sourceEvidence.includes(source.repo) || refs.some((ref) => sourceEvidence.includes(ref))) && (commit ? sourceEvidence.includes(commit) : false);
  });
  if (!evidenceMentionsSource) {
    errors.push("Source Evidence must mention the source repo or a reference file plus the concrete commit");
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
  const createdAt = typeof frontmatter.created_at === "string" ? frontmatter.created_at.slice(0, 10) : "";
  const declaresDecisionFirstShape = DECISION_FIRST_CARD_SECTIONS.some((heading) => body.includes(`## ${heading}`));
  const requiresDecisionFirstShape = !createdAt || createdAt >= DECISION_FIRST_CONTRACT_DATE || declaresDecisionFirstShape;
  if (requiresDecisionFirstShape) {
    errors.push(...assessHumanReportReadability(markdown).errors);
  } else {
    for (const heading of LEGACY_CARD_SECTIONS) {
      if (!body.includes(`## ${heading}`)) {
        errors.push(`missing card section: ${heading}`);
      }
    }
  }
  return result(errors);
}
