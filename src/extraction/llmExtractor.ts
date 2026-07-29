import type { PatternDraft, PatternFrontmatter, RepoContext, RepoScore, Taxonomy } from "../types";
import { DEFAULT_TAXONOMY } from "../knowledge/defaultSchemas";
import { ensurePatternNavigationSections } from "../knowledge/retrievalTags";
import { localDateString } from "../utils/date";
import { safeKebab } from "../utils/paths";
import type { PatternExtractor } from "./extractor";
import { buildEvidencePack } from "./evidencePack";
import type { LLMClient } from "./llmClient";
import { OpenAIResponsesClient } from "./llmClient";
import { EXTRACTION_RESPONSE_SCHEMA, REVIEW_RESPONSE_SCHEMA } from "./llmSchemas";
import { extractionSystemPrompt, extractionUserPrompt, reviewSystemPrompt, reviewUserPrompt } from "./llmPrompts";

type LLMRawPattern = {
  frontmatter?: Partial<PatternFrontmatter>;
  body?: string;
  body_sections?: Record<string, unknown>;
};

type LLMExtractionResponse = {
  patterns?: LLMRawPattern[];
};

type LLMReview = {
  id: string;
  decision: "accept" | "reject";
  reason: string;
};

type LLMReviewResponse = {
  reviews?: LLMReview[];
};

export type LLMExtractorOptions = {
  client?: LLMClient;
  taxonomy?: Taxonomy;
  reviewer?: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function pickAllowed(values: unknown, allowed: string[], fallback: string[]): string[] {
  const selected = asStringArray(values).filter((value) => allowed.includes(value));
  return selected.length > 0 ? [...new Set(selected)].slice(0, 4) : fallback;
}

function complexity(value: unknown): PatternFrontmatter["complexity"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function boundedScore(value: unknown, fallback = 75): number {
  return typeof value === "number" ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
}

function stableId(raw: unknown, name: string, repo: string): string {
  const candidate = asString(raw);
  if (/^pattern-[a-z0-9-]+$/.test(candidate)) {
    return candidate.slice(0, 100);
  }
  return `pattern-${safeKebab(name || repo)}`.slice(0, 100);
}

function allowedReferenceFiles(raw: unknown, context: RepoContext): string[] {
  const allowed = new Set(context.selected_files.map((file) => file.path));
  if (context.readme_excerpt) {
    allowed.add("README.md");
  }
  const selected = asStringArray(raw).filter((file) => allowed.has(file));
  if (selected.length >= 2) {
    return [...new Set(selected)].slice(0, 4);
  }
  return [...allowed].slice(0, 4);
}

function renderBodyFromSections(name: string, sections?: Record<string, unknown>): string {
  if (!sections) {
    return `# ${name}`;
  }
  const order = [
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
  const rendered = order
    .map((heading) => {
      const value = sections[heading];
      if (typeof value === "string" && value.trim()) {
        return `## ${heading}\n${value.trim()}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
  return `# ${name}\n\n${rendered}`;
}

function ensureTitle(body: string, name: string): string {
  const trimmed = body.trim();
  return trimmed.startsWith("# ") ? trimmed : `# ${name}\n\n${trimmed}`;
}

function ensureConcreteSourceEvidence(body: string, context: RepoContext, refs: string[]): string {
  const required = `The source repo ${context.repo} was audited at commit ${context.commit_sha}. The concrete reference files are ${refs.join(", ")}.`;
  if (body.includes(context.repo) && body.includes(context.commit_sha)) {
    return body;
  }
  if (/^## Source Evidence$/m.test(body)) {
    return `${body.trimEnd()}\n${required}\n`;
  }
  return `${body.trimEnd()}\n\n## Source Evidence\n${required}\n`;
}

function normalizeRawPattern(raw: LLMRawPattern, context: RepoContext, taxonomy: Taxonomy, score: RepoScore | undefined, runDate: Date): PatternDraft {
  const created = localDateString(runDate);
  const rawFrontmatter = raw.frontmatter ?? {};
  const rawSource = rawFrontmatter.source_repos?.[0];
  const refs = allowedReferenceFiles(rawSource?.reference_files, context);
  const name = asString(rawFrontmatter.name) || "Evidence-backed engineering pattern";
  const body = ensureConcreteSourceEvidence(
    ensureTitle(raw.body?.trim() || renderBodyFromSections(name, raw.body_sections), name),
    context,
    refs
  );
  const frontmatter: PatternFrontmatter = {
    id: stableId(rawFrontmatter.id, name, context.repo),
    name,
    summary:
      asString(rawFrontmatter.summary) ||
      `A transferable engineering pattern extracted from ${context.repo} using commit-pinned source evidence.`,
    engineering_problems: pickAllowed(rawFrontmatter.engineering_problems, taxonomy.engineering_problems, ["package_architecture"]),
    project_types: pickAllowed(rawFrontmatter.project_types, taxonomy.project_types, [context.metadata.language ? "library" : "devtool"]),
    pattern_types: pickAllowed(rawFrontmatter.pattern_types, taxonomy.pattern_types, ["layered_architecture"]),
    complexity: complexity(rawFrontmatter.complexity),
    quality_score: boundedScore(rawFrontmatter.quality_score, score?.engineering_quality.score ?? 75),
    source_repos: [{ repo: context.repo, url: context.url, commit: context.commit_sha, reference_files: refs }],
    use_when: asStringArray(rawFrontmatter.use_when).length
      ? asStringArray(rawFrontmatter.use_when)
      : ["The target project has the same repeated source-backed boundary pressure as the reference evidence."],
    avoid_when: asStringArray(rawFrontmatter.avoid_when).length
      ? asStringArray(rawFrontmatter.avoid_when)
      : ["The target project is still simple enough that direct code is easier to inspect and delete."],
    tradeoffs: asStringArray(rawFrontmatter.tradeoffs).length
      ? asStringArray(rawFrontmatter.tradeoffs)
      : ["Adds structure in exchange for clearer ownership and future agent auditability."],
    transfer_targets: pickAllowed(rawFrontmatter.transfer_targets, taxonomy.transfer_targets, ["agent_tooling"]),
    related_patterns: asStringArray(rawFrontmatter.related_patterns),
    created_at: created,
    updated_at: created,
    run_id: context.run_id,
    aliases: asStringArray(rawFrontmatter.aliases),
    evidence_strength: rawFrontmatter.evidence_strength === "strong" ? "strong" : "medium",
    maturity: rawFrontmatter.maturity === "battle_tested" || rawFrontmatter.maturity === "experimental" ? rawFrontmatter.maturity : "stable",
    source_languages: context.metadata.language ? [context.metadata.language] : [],
    source_frameworks: asStringArray(rawFrontmatter.source_frameworks),
    risk_level: complexity(rawFrontmatter.risk_level),
    tags: [...new Set([...asStringArray(rawFrontmatter.tags), "llm-extracted"])]
  };
  return { frontmatter, body: ensurePatternNavigationSections(body, frontmatter) };
}

export class LLMExtractor implements PatternExtractor {
  private readonly client: LLMClient;
  private readonly taxonomy: Taxonomy;
  private readonly reviewer: boolean;
  constructor(options: LLMExtractorOptions = {}) {
    if ("fallback" in options) {
      throw new Error("LLM heuristic fallback is prohibited; model or reviewer failure must stop the run");
    }
    this.client = options.client ?? new OpenAIResponsesClient();
    this.taxonomy = options.taxonomy ?? DEFAULT_TAXONOMY;
    this.reviewer = options.reviewer ?? true;
  }

  async extractPatterns(context: RepoContext, score?: RepoScore, runDate = new Date()): Promise<PatternDraft[]> {
    try {
      const pack = buildEvidencePack(context, this.taxonomy, score);
      const extraction = await this.client.completeJson<LLMExtractionResponse>("pattern_extraction", {
        system: extractionSystemPrompt(),
        user: extractionUserPrompt(pack),
        schemaName: "pattern_extraction",
        schema: EXTRACTION_RESPONSE_SCHEMA
      });
      const normalized = (extraction.patterns ?? [])
        .slice(0, 3)
        .map((pattern) => normalizeRawPattern(pattern, context, this.taxonomy, score, runDate));
      if (!this.reviewer || normalized.length === 0) {
        return normalized;
      }

      const review = await this.client.completeJson<LLMReviewResponse>("pattern_review", {
        system: reviewSystemPrompt(),
        user: reviewUserPrompt(pack, normalized),
        schemaName: "pattern_review",
        schema: REVIEW_RESPONSE_SCHEMA
      });
      const reviews = new Map((review.reviews ?? []).map((item) => [item.id, item]));
      const accepted: PatternDraft[] = [];
      for (const draft of normalized) {
        const decision = reviews.get(draft.frontmatter.id);
        if (decision?.decision === "accept") {
          accepted.push(draft);
        }
      }
      return accepted;
    } catch (error) {
      throw error;
    }
  }
}
