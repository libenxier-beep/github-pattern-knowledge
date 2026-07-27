import type { GitHubSearchRepo } from "../github/client";
import type { RepoContext } from "../types";
import { addYears, localDateString } from "../utils/date";

export type DiscoveryCapability = {
  id: string;
  weight: number;
  terms: string[];
  queries: Array<{ text: string; minStars: number }>;
};

export type SelectionPolicy = {
  aiEngineeringTerms: string[];
  engineeringDomainTerms: string[];
  localWorkTerms: string[];
  transferBridgeTerms: string[];
  contentNoiseTerms: string[];
  capabilities: DiscoveryCapability[];
};

export const AI_ENGINEERING_TERMS = [
  "ai-agents",
  "ai agents",
  "agent runtime",
  "agentic",
  "auto-research",
  "autoresearch",
  "browser automation",
  "code execution",
  "computer use",
  "evals",
  "evaluation",
  "function calling",
  "karpathy",
  "llm",
  "mcp",
  "model context protocol",
  "rag",
  "research automation",
  "roomhead",
  "tool use",
  "tool-use",
  "video use",
  "video-use"
];

export const LOCAL_WORK_TERMS = [
  "agent",
  "automation",
  "browser",
  "capability router",
  "code execution",
  "codex",
  "evals",
  "github pattern",
  "local",
  "mcp",
  "memory",
  "provider",
  "queue",
  "repo audit",
  "research",
  "routing",
  "schema",
  "skill",
  "tool",
  "video",
  "workflow"
];

export const ENGINEERING_DOMAIN_TERMS = [
  "analytics",
  "animation",
  "audio",
  "build system",
  "collaboration",
  "compiler",
  "content management",
  "data pipeline",
  "database",
  "diagram",
  "distributed systems",
  "document management",
  "editorial",
  "graphics",
  "image processing",
  "knowledge base",
  "note-taking",
  "observability",
  "project management",
  "publishing",
  "quantitative trading",
  "rendering",
  "risk management",
  "robotics",
  "scheduling",
  "scientific computing",
  "security",
  "simulation",
  "version control",
  "video editing",
  "wiki",
  "workflow automation"
];

export const PRODUCTION_CRAFT_TERMS = [
  "backpressure",
  "cancellation",
  "checkpoint",
  "compatibility",
  "conflict",
  "degraded",
  "fallback",
  "graceful shutdown",
  "idempotency",
  "idempotent",
  "interrupt",
  "lease",
  "migration",
  "observability",
  "ownership",
  "partial failure",
  "race",
  "reconciliation",
  "recovery",
  "resume",
  "retries",
  "retry",
  "rollback",
  "shutdown",
  "versioning"
];

export const CROSS_DOMAIN_MECHANISM_TERMS = [
  "adapter",
  "approval",
  "cache",
  "capability",
  "event",
  "outbox",
  "plugin",
  "projection",
  "queue",
  "sandbox",
  "scheduler",
  "state machine",
  "stream",
  "transaction",
  "workflow"
];

export const TRANSFER_BRIDGE_TERMS = [
  "approval",
  "audit trail",
  "checkpoint",
  "composition",
  "constraint",
  "dependency graph",
  "event sourcing",
  "feedback loop",
  "lifecycle",
  "non-destructive",
  "ownership",
  "policy",
  "provenance",
  "reconciliation",
  "render graph",
  "risk model",
  "rollback",
  "sandbox",
  "scheduler",
  "staging",
  "state machine",
  "validation",
  "version control",
  "versioning"
];

export const CONTENT_NOISE_TERMS = [
  "article",
  "articles",
  "awesome",
  "blog",
  "book list",
  "course-list",
  "developer-roadmap",
  "educational content",
  "landing-page",
  "learning-path",
  "newsletter",
  "prompt-list",
  "prompts",
  "resource-list",
  "roadmap",
  "tutorial"
];

export const DISCOVERY_CAPABILITIES: DiscoveryCapability[] = [
  {
    id: "agent_runtime",
    weight: 1,
    terms: ["ai-agents", "ai agents", "agent runtime", "agentic", "tool use", "tool-use", "function calling"],
    queries: [
      { text: "topic:ai-agents", minStars: 50 },
      { text: "agent runtime", minStars: 20 }
    ]
  },
  {
    id: "knowledge_content_systems",
    weight: 0.95,
    terms: ["document management", "content management", "knowledge base", "publishing", "editorial", "wiki", "note-taking"],
    queries: [
      { text: '"document management" workflow', minStars: 20 },
      { text: '"content management" versioning', minStars: 20 },
      { text: '"publishing workflow"', minStars: 20 }
    ]
  },
  {
    id: "visual_media_systems",
    weight: 0.95,
    terms: ["video editing", "image processing", "graphics", "diagram", "animation", "rendering", "audio"],
    queries: [
      { text: '"video editing"', minStars: 20 },
      { text: '"image processing" workflow', minStars: 20 },
      { text: 'graphics rendering pipeline', minStars: 20 }
    ]
  },
  {
    id: "quantitative_decision_systems",
    weight: 0.85,
    terms: ["quantitative trading", "algorithmic trading", "risk management", "portfolio", "backtesting"],
    queries: [
      { text: '"quantitative trading"', minStars: 20 },
      { text: '"risk management" engine', minStars: 20 },
      { text: 'backtesting portfolio', minStars: 20 }
    ]
  },
  {
    id: "mechanism_rich_systems",
    weight: 1,
    terms: ["state machine", "provenance", "reconciliation", "versioning", "approval workflow", "dependency graph"],
    queries: [
      { text: '"state machine" workflow', minStars: 20 },
      { text: 'provenance versioning workflow', minStars: 20 },
      { text: 'reconciliation scheduler', minStars: 20 }
    ]
  },
  {
    id: "data_scientific_systems",
    weight: 0.85,
    terms: ["data pipeline", "analytics", "scientific computing", "simulation"],
    queries: [
      { text: '"data pipeline" orchestration', minStars: 20 },
      { text: '"scientific computing" workflow', minStars: 20 },
      { text: 'simulation framework', minStars: 20 }
    ]
  },
  {
    id: "operations_workflow_systems",
    weight: 0.85,
    terms: ["workflow automation", "project management", "collaboration", "scheduling", "approval workflow"],
    queries: [
      { text: '"workflow automation"', minStars: 20 },
      { text: '"approval workflow"', minStars: 20 },
      { text: 'collaboration scheduling', minStars: 20 }
    ]
  },
  {
    id: "developer_infrastructure",
    weight: 0.9,
    terms: ["version control", "database", "distributed systems", "build system", "compiler", "observability", "developer tools"],
    queries: [
      { text: '"version control"', minStars: 50 },
      { text: '"build system"', minStars: 50 },
      { text: '"distributed systems" tooling', minStars: 50 }
    ]
  },
  {
    id: "mcp_tooling",
    weight: 1,
    terms: ["mcp", "model context protocol", "tool use", "tool-use"],
    queries: [
      { text: "topic:mcp", minStars: 20 },
      { text: "\"model context protocol\"", minStars: 20 }
    ]
  },
  {
    id: "browser_computer_automation",
    weight: 0.9,
    terms: ["browser automation", "computer use"],
    queries: [
      { text: "\"browser automation\" agent", minStars: 20 },
      { text: "\"computer use\" agent", minStars: 20 }
    ]
  },
  {
    id: "research_automation",
    weight: 0.85,
    terms: ["auto-research", "autoresearch", "research automation", "rag"],
    queries: [
      { text: "\"research automation\" ai", minStars: 20 },
      { text: "rag agent", minStars: 20 }
    ]
  },
  {
    id: "eval_harness",
    weight: 0.8,
    terms: ["evals", "evaluation"],
    queries: [{ text: "evals agent", minStars: 20 }]
  },
  {
    id: "code_execution",
    weight: 0.75,
    terms: ["code execution"],
    queries: [{ text: "\"code execution\" agent", minStars: 20 }]
  },
  {
    id: "video_automation",
    weight: 0.65,
    terms: ["video use", "video-use"],
    queries: [{ text: "\"video-use\" agent", minStars: 10 }]
  },
  {
    id: "frontier_reference",
    weight: 0.55,
    terms: ["karpathy", "roomhead", "llm"],
    queries: [{ text: "topic:llm", minStars: 50 }]
  }
];

export const DEFAULT_SELECTION_POLICY: SelectionPolicy = {
  aiEngineeringTerms: AI_ENGINEERING_TERMS,
  engineeringDomainTerms: ENGINEERING_DOMAIN_TERMS,
  localWorkTerms: LOCAL_WORK_TERMS,
  transferBridgeTerms: TRANSFER_BRIDGE_TERMS,
  contentNoiseTerms: CONTENT_NOISE_TERMS,
  capabilities: DISCOVERY_CAPABILITIES
};

export function matchTerms(text: string, terms: string[]): string[] {
  const normalized = text.toLowerCase();
  return terms.filter((term) => normalized.includes(term));
}

export function repoSearchText(repo: GitHubSearchRepo): string {
  return [repo.full_name, repo.description ?? "", ...(repo.topics ?? []), repo.language ?? ""].join(" ");
}

export function contextSearchText(context: RepoContext): string {
  return [
    context.repo,
    context.metadata.description ?? "",
    context.metadata.language ?? "",
    ...context.metadata.topics,
    context.readme_excerpt,
    ...context.tree_summary,
    ...context.selected_files.map((file) => `${file.path} ${file.reason} ${file.content ?? ""}`)
  ].join(" ");
}

export function isContentNoiseRepo(repo: GitHubSearchRepo): boolean {
  return matchTerms(repoSearchText(repo), DEFAULT_SELECTION_POLICY.contentNoiseTerms).length > 0;
}

function uniqueMatches(matches: string[]): string[] {
  return [...new Set(matches)];
}

function recencyScore(repo: GitHubSearchRepo, now = new Date()): number {
  const pushedAt = new Date(repo.pushed_at);
  if (Number.isNaN(pushedAt.getTime())) {
    return 0;
  }
  const ageDays = Math.max(0, (now.getTime() - pushedAt.getTime()) / 86_400_000);
  return Math.max(0, 1 - ageDays / 365);
}

function popularityScore(repo: GitHubSearchRepo): number {
  return Math.min(1, Math.log10(repo.stargazers_count + 1) / 5);
}

export function matchedCapabilities(repo: GitHubSearchRepo, policy: SelectionPolicy = DEFAULT_SELECTION_POLICY): string[] {
  const text = repoSearchText(repo);
  return policy.capabilities.filter((capability) => matchTerms(text, capability.terms).length > 0).map((capability) => capability.id);
}

export function scoreRepoSearchCandidate(repo: GitHubSearchRepo, now = new Date(), policy: SelectionPolicy = DEFAULT_SELECTION_POLICY): number {
  const text = repoSearchText(repo);
  const engineeringDomainMatches = uniqueMatches(matchTerms(text, policy.engineeringDomainTerms));
  const localMatches = uniqueMatches(matchTerms(text, policy.localWorkTerms));
  const productionCraftMatches = uniqueMatches(matchTerms(text, PRODUCTION_CRAFT_TERMS));
  const crossDomainMechanismMatches = uniqueMatches(matchTerms(text, CROSS_DOMAIN_MECHANISM_TERMS));
  const transferBridgeMatches = uniqueMatches(matchTerms(text, policy.transferBridgeTerms));
  const capabilityWeight = policy.capabilities
    .filter((capability) => matchTerms(text, capability.terms).length > 0)
    .reduce((total, capability) => total + capability.weight, 0);

  const capabilityFit = Math.min(1, capabilityWeight / 2.4);
  const craftFit = Math.min(1, productionCraftMatches.length / 4);
  const mechanismFit = Math.min(1, crossDomainMechanismMatches.length / 4);
  const transferFit = Math.min(1, transferBridgeMatches.length / 4);
  const domainFit = Math.min(1, engineeringDomainMatches.length / 4);
  const localFit = Math.min(1, localMatches.length / 5);

  return (
    capabilityFit * 25 +
    craftFit * 25 +
    mechanismFit * 15 +
    transferFit * 15 +
    domainFit * 8 +
    localFit * 7 +
    recencyScore(repo, now) * 3 +
    popularityScore(repo) * 2
  );
}

export function compareRepoSearchCandidates(a: GitHubSearchRepo, b: GitHubSearchRepo, now = new Date(), policy: SelectionPolicy = DEFAULT_SELECTION_POLICY): number {
  const scoreDelta = scoreRepoSearchCandidate(b, now, policy) - scoreRepoSearchCandidate(a, now, policy);
  if (Math.abs(scoreDelta) > 0.0001) {
    return scoreDelta;
  }
  return b.stargazers_count - a.stargazers_count;
}

export function buildCapabilityQueries(now = new Date(), policy: SelectionPolicy = DEFAULT_SELECTION_POLICY): string[] {
  const pushedAfter = localDateString(addYears(now, -1));
  const maxQueries = Math.max(0, ...policy.capabilities.map((capability) => capability.queries.length));
  const queries: string[] = [];
  for (let queryIndex = 0; queryIndex < maxQueries; queryIndex += 1) {
    for (const capability of policy.capabilities) {
      const query = capability.queries[queryIndex];
      if (query) queries.push(`${query.text} stars:>${query.minStars} pushed:>${pushedAfter} archived:false`);
    }
  }
  return queries;
}
