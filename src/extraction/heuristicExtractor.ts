import type { PatternDraft, PatternFrontmatter, RepoContext, RepoScore } from "../types";
import type { PatternExtractor } from "./extractor";
import { extractConcreteNames } from "../knowledge/evidenceNames";
import { evidenceSupportRationale } from "../knowledge/evidenceText";
import { localDateString } from "../utils/date";
import { ensurePatternNavigationSections } from "../knowledge/retrievalTags";

function includesAny(paths: string[], words: string[]): boolean {
  const text = paths.join("\n").toLowerCase();
  return words.some((word) => text.includes(word));
}

function projectTypes(context: RepoContext): string[] {
  const topics = context.metadata.topics;
  const types = new Set<string>();
  if (topics.includes("cli")) types.add("cli_tool");
  if (topics.includes("developer-tools")) types.add("devtool");
  if (topics.includes("automation")) types.add("automation_tool");
  if (topics.includes("agent")) types.add("agent_workflow");
  if (topics.includes("framework")) types.add("framework");
  if (types.size === 0) types.add(context.metadata.language ? "library" : "devtool");
  return [...types].slice(0, 3);
}

function referenceFiles(context: RepoContext, keywords: string[]): string[] {
  const selected = context.selected_files
    .filter((file) => keywords.some((keyword) => file.path.toLowerCase().includes(keyword)))
    .map((file) => file.path);
  return (selected.length > 0 ? selected : context.selected_files.map((file) => file.path)).slice(0, 4);
}

type EvidenceRow = {
  file: string;
  observedStructure: string;
  concreteNames: string[];
  supportRationale: string;
};

function sourceCommit(context: RepoContext): string {
  return context.commit_sha || (context.fixture ? `fixture-${context.repo.split("/").pop() ?? "repo"}` : "unknown");
}

function contentForPath(context: RepoContext, filePath: string): string {
  const selected = context.selected_files.find((file) => file.path === filePath);
  if (selected?.content) {
    return selected.content;
  }
  const packageMeta = context.package_metadata.find((file) => file.path === filePath);
  if (packageMeta?.excerpt) {
    return packageMeta.excerpt;
  }
  if (filePath.toLowerCase() === "readme.md") {
    return context.readme_excerpt;
  }
  return "";
}

function observedStructure(filePath: string, content: string): string {
  const lowerPath = filePath.toLowerCase();
  const lower = content.toLowerCase();
  if (lowerPath.includes("test") || lowerPath.includes("spec") || /\b(?:test|describe|it)\(/.test(content)) {
    return "Test file that locks the boundary behavior and makes the claimed pattern checkable instead of only descriptive.";
  }
  if (lowerPath.endsWith(".json") || lowerPath.endsWith(".yaml") || lowerPath.endsWith(".yml") || lowerPath.endsWith(".toml")) {
    return "Configuration or metadata file that exposes the public contract, command surface, schema, or integration boundary.";
  }
  if (lower.includes("registry") || lower.includes("register")) {
    return "Runtime file that defines registration ownership and keeps extension lookup separate from capability implementation.";
  }
  if (lower.includes("router") || lower.includes("command") || lower.includes("handler")) {
    return "Runtime file that maps external commands or requests to handlers through an explicit dispatch boundary.";
  }
  if (lower.includes("schema") || lower.includes("validate") || lower.includes("config")) {
    return "Runtime or documentation file that defines validation rules around a user-facing configuration boundary.";
  }
  if (lower.includes("store") || lower.includes("cache") || lower.includes("storage")) {
    return "Runtime file that separates persistence, cache lookup, or durable state mutation from caller workflow code.";
  }
  if (lower.includes("pipeline") || lower.includes("processor") || lower.includes("exporter")) {
    return "Runtime file that names staged processing responsibilities and separates stage ownership in a data flow.";
  }
  return "Selected source file that exposes a named module boundary, exported contract, or operational integration point.";
}

function buildEvidenceRows(context: RepoContext, keywords: string[], coreNoun: string): EvidenceRow[] {
  const keywordRefs = referenceFiles(context, keywords);
  const refs = new Set<string>();
  for (const ref of keywordRefs) {
    refs.add(ref);
  }
  for (const file of context.selected_files) {
    if (refs.size >= 4) {
      break;
    }
    if (!refs.has(file.path)) {
      refs.add(file.path);
    }
  }
  if (refs.size < 2 && context.readme_excerpt) {
    refs.add("README.md");
  }
  const rows = [...refs].slice(0, 4).map((file) => {
    const content = contentForPath(context, file);
    const names = extractConcreteNames(content, file);
    const observed = observedStructure(file, content);
    return {
      file,
      observedStructure: observed,
      concreteNames: names,
      supportRationale: evidenceSupportRationale(file, observed, names, coreNoun)
    };
  });
  return rows.length >= 2 ? rows : rows.concat({
    file: "README.md",
    observedStructure: "Repository overview that states the public intent and helps cross-check whether the extracted pattern matches the project purpose.",
    concreteNames: ["README"],
    supportRationale: `Supports the ${coreNoun} claim only as secondary context; runtime or test evidence should be preferred when available.`
  }).slice(0, 2);
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function evidenceTable(rows: EvidenceRow[]): string {
  const tableRows = rows.map((row) => {
    const names = row.concreteNames.map((name) => `\`${escapeTableCell(name)}\``).join(", ");
    return `| \`${escapeTableCell(row.file)}\` | ${escapeTableCell(row.observedStructure)} | ${names} | ${escapeTableCell(row.supportRationale)} |`;
  });
  return `## Evidence Table
| Reference file | Observed structure | Concrete names | Why it supports the pattern |
| --- | --- | --- | --- |
${tableRows.join("\n")}`;
}

function sourceEvidence(context: RepoContext, rows: EvidenceRow[], coreNoun: string): string {
  const refs = rows.map((row) => row.file);
  const names = rows.flatMap((row) => row.concreteNames).slice(0, 8);
  return `## Source Evidence
The source repo ${context.repo} was inspected at commit ${sourceCommit(context)}. The concrete reference files are ${refs.join(", ")}. The evidence names ${names.map((name) => `\`${name}\``).join(", ")} are the audit handles an agent should reopen before applying this ${coreNoun} pattern to another codebase.`;
}

function evidenceSections(context: RepoContext, rows: EvidenceRow[], coreNoun: string): string {
  return `${evidenceTable(rows)}

${sourceEvidence(context, rows, coreNoun)}`;
}

type FocusPattern = {
  id: string;
  name: string;
  summary: string;
  engineering_problems: string[];
  pattern_types: string[];
  transfer_targets: string[];
  use_when: string[];
  avoid_when: string[];
  tradeoffs: string[];
  keywords: string[];
  bodyTitle: string;
  coreNoun: string;
};

function focusText(context: RepoContext): string {
  return (context.seed_focus ?? []).join(" ").toLowerCase();
}

function inferFocusPattern(context: RepoContext): FocusPattern | null {
  const focus = focusText(context);
  if (!focus) {
    return null;
  }
  const repoSlug = context.repo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (focus.includes("reconciliation") || focus.includes("controller")) {
    return {
      id: `pattern-state-machine-reconciliation-loop-${repoSlug}`,
      name: "Reconciliation loop for declarative state",
      summary: "A controller-style reconciliation loop repeatedly compares desired state with observed state and makes small convergent repairs.",
      engineering_problems: ["state_management", "workflow_orchestration", "error_recovery"],
      pattern_types: ["state_machine", "retry_policy", "task_graph"],
      transfer_targets: ["workflow_engine", "agent_tooling", "repo_auditor"],
      use_when: ["External state can drift from desired state and the system needs repeated, idempotent convergence rather than one-shot execution."],
      avoid_when: ["The workflow is a short local command with no external drift, no durable desired state, and no need for retry-safe convergence."],
      tradeoffs: ["Adds control-loop complexity in exchange for repairability, idempotence, and stable ownership of external state transitions."],
      keywords: ["controller", "reconcile", "sync", "workqueue", "state"],
      bodyTitle: "Reconciliation loop for declarative state",
      coreNoun: "reconciliation loop"
    };
  }
  if (focus.includes("pipeline") || focus.includes("processor") || focus.includes("exporter") || focus.includes("query_engine")) {
    return {
      id: `pattern-pipeline-staged-processing-${repoSlug}`,
      name: "Staged processing pipeline with explicit boundaries",
      summary: "A staged pipeline splits ingest, transform, execute, and export responsibilities so high-volume systems can evolve safely.",
      engineering_problems: ["data_flow", "observability", "package_architecture"],
      pattern_types: ["pipeline", "layered_architecture"],
      transfer_targets: ["workflow_engine", "developer_dashboard", "repo_auditor"],
      use_when: ["Data or events pass through repeated stages and each stage needs separate configuration, tests, and operational visibility."],
      avoid_when: ["The data path has one simple transformation and introducing stages would hide direct control flow."],
      tradeoffs: ["Improves replacement and observability of each stage while adding configuration surface and cross-stage contract maintenance."],
      keywords: ["pipeline", "processor", "exporter", "query", "engine", "stage"],
      bodyTitle: "Staged processing pipeline with explicit boundaries",
      coreNoun: "processing pipeline"
    };
  }
  if (focus.includes("fixture") || focus.includes("test_runner") || focus.includes("testing")) {
    return {
      id: `pattern-testing-strategy-extensible-test-harness-${repoSlug}`,
      name: "Extensible test harness around reusable fixtures",
      summary: "A test harness pattern turns repeated setup, execution, and reporting into reusable fixtures and stable extension hooks.",
      engineering_problems: ["testing_strategy", "developer_experience", "plugin_extension"],
      pattern_types: ["lifecycle_hooks", "plugin_system", "facade"],
      transfer_targets: ["testing_harness", "repo_auditor", "codex_skill_system"],
      use_when: ["Many tests share setup and teardown rules, or downstream users need to extend test behavior without patching the runner."],
      avoid_when: ["A project has a tiny test suite and simple inline setup is easier to inspect than fixture indirection."],
      tradeoffs: ["Improves test reuse and ecosystem extension while making fixture dependency order a contract that must be documented and tested."],
      keywords: ["fixture", "hook", "test", "runner", "report"],
      bodyTitle: "Extensible test harness around reusable fixtures",
      coreNoun: "test harness"
    };
  }
  if (focus.includes("declarative") || focus.includes("schema") || focus.includes("config")) {
    return {
      id: `pattern-declarative-config-schema-boundary-${repoSlug}`,
      name: "Declarative configuration behind a schema boundary",
      summary: "A declarative configuration boundary lets users describe intent while the runtime validates, normalizes, and executes it safely.",
      engineering_problems: ["configuration", "validation", "api_boundary"],
      pattern_types: ["declarative_config", "schema_validation", "adapter"],
      transfer_targets: ["local_automation_tool", "workflow_engine", "web_app_backend"],
      use_when: ["Users or integrations need a stable intent format that can be validated before runtime execution changes external state."],
      avoid_when: ["The workflow is controlled only by internal code and no stable user-facing configuration contract exists yet."],
      tradeoffs: ["Moves flexibility into data and validation, but creates migration and compatibility obligations for the schema."],
      keywords: ["config", "schema", "validate", "declarative", "parser"],
      bodyTitle: "Declarative configuration behind a schema boundary",
      coreNoun: "configuration boundary"
    };
  }
  if (focus.includes("store") || focus.includes("storage") || focus.includes("cache") || focus.includes("persistence")) {
    return {
      id: `pattern-file-based-store-storage-boundary-${repoSlug}`,
      name: "Explicit storage boundary for durable local state",
      summary: "A storage boundary isolates persistence format, cache lookup, and mutation rules so runtime code does not depend on storage internals.",
      engineering_problems: ["persistence", "caching", "local_file_system"],
      pattern_types: ["repository", "file_based_store", "adapter"],
      transfer_targets: ["local_automation_tool", "knowledge_base", "repo_auditor"],
      use_when: ["Runtime behavior needs durable local state, cache reuse, or storage migrations that should not leak into command handlers."],
      avoid_when: ["State is temporary, tiny, and easier to pass directly through function arguments."],
      tradeoffs: ["Adds a persistence interface in exchange for testable storage behavior and safer future migration."],
      keywords: ["store", "storage", "cache", "object", "database", "index"],
      bodyTitle: "Explicit storage boundary for durable local state",
      coreNoun: "storage boundary"
    };
  }
  if (focus.includes("adapter") || focus.includes("provider") || focus.includes("protocol") || focus.includes("transport")) {
    return {
      id: `pattern-adapter-protocol-boundary-${repoSlug}`,
      name: "Adapter boundary around external protocols",
      summary: "A protocol adapter boundary keeps external APIs replaceable while preserving a stable internal contract for callers.",
      engineering_problems: ["api_boundary", "dependency_management", "security_boundary"],
      pattern_types: ["adapter", "provider", "facade"],
      transfer_targets: ["agent_tooling", "web_app_backend", "repo_auditor"],
      use_when: ["The system talks to external protocols, providers, or transports that may change independently from core logic."],
      avoid_when: ["There is a single stable API and no foreseeable need to swap, test, or constrain provider behavior."],
      tradeoffs: ["Improves replaceability and testability while adding translation code and compatibility maintenance."],
      keywords: ["adapter", "provider", "protocol", "transport", "client", "server"],
      bodyTitle: "Adapter boundary around external protocols",
      coreNoun: "adapter boundary"
    };
  }
  if (focus.includes("security") || focus.includes("secret") || focus.includes("auth") || focus.includes("permission")) {
    return {
      id: `pattern-capability-boundary-security-sensitive-actions-${repoSlug}`,
      name: "Capability boundary for security-sensitive actions",
      summary: "A capability boundary constrains security-sensitive operations behind explicit policy, validation, and auditable execution paths.",
      engineering_problems: ["security_boundary", "authorization", "validation"],
      pattern_types: ["capability_boundary", "facade", "schema_validation"],
      transfer_targets: ["agent_tooling", "local_automation_tool", "testing_harness"],
      use_when: ["A tool can read secrets, mutate infrastructure, execute code, or cross a trust boundary that needs explicit permission checks."],
      avoid_when: ["The operation is read-only, local, and has no sensitive state or external side effect."],
      tradeoffs: ["Adds policy and audit overhead in exchange for constrained blast radius and safer automation."],
      keywords: ["security", "secret", "auth", "policy", "permission", "capability"],
      bodyTitle: "Capability boundary for security-sensitive actions",
      coreNoun: "security capability boundary"
    };
  }
  return null;
}

function focusedBody(context: RepoContext, pattern: FocusPattern, rows: EvidenceRow[]): string {
  return `# ${pattern.bodyTitle}

## Engineering Problem
The source repo ${context.repo} is useful because its focus area points at a recurring engineering problem: ${pattern.coreNoun} must keep behavior understandable while the system grows across modules, users, and operational cases.

## Core Judgment
The core judgment is to make the ${pattern.coreNoun} an explicit boundary instead of leaving the behavior scattered across feature code. That boundary should own sequencing, validation, and recovery rules while keeping domain-specific work in smaller modules.

## Use When
Use this when ${pattern.use_when[0]} The target project should already have enough repeated behavior that a named boundary removes real ambiguity rather than adding ceremony.

## Avoid When
Avoid this when ${pattern.avoid_when[0]} If the project is still a one-file prototype, keep the behavior direct and write down the future extraction trigger instead.

## Design Forces
This pattern balances simplicity, evolvability, testability, and operational visibility. ${pattern.tradeoffs[0]} The boundary earns its keep only when it reduces future coordination cost.

## Boundary Decisions
The boundary should own the shared contract and failure handling; leaf modules should own local implementation detail. Avoid letting the boundary become a global bag of dependencies or a hidden policy engine.

## Failure Modes
Common failures include abstracting before a repeated shape exists, letting hidden shared state accumulate behind the boundary, and failing to test the contract that makes the pattern useful.

## Simpler Alternatives
Use direct function calls, a small switch statement, or one local module while there is only one implementation. Write the seam so it can be deleted or extracted later without forcing an ecosystem-level abstraction.

## Transfer Guidance
First identify the repeated decision the source repo solved. Then compare module count, change frequency, failure cost, and test coverage in the target project. Transfer only the boundary contract first; copy internal structure only after the target has similar scale pressure.

## Implementation Hint
Start with a small typed interface, one host-owned orchestration function, and tests around the contract. Keep source evidence nearby so future agents can re-check the pattern before applying it.

${evidenceSections(context, rows, pattern.coreNoun)}`;
}

function baseFrontmatter(context: RepoContext, score: RepoScore | undefined, runDate: Date, overrides: Partial<PatternFrontmatter>): PatternFrontmatter {
  const created = localDateString(runDate);
  return {
    id: overrides.id ?? "pattern-package-architecture-explicit-boundaries",
    name: overrides.name ?? "Explicit package boundaries from source and test evidence",
    summary: overrides.summary ?? "A source-tree boundary pattern that keeps runtime code, tests, examples, and metadata independently inspectable.",
    engineering_problems: overrides.engineering_problems ?? ["package_architecture"],
    project_types: overrides.project_types ?? projectTypes(context),
    pattern_types: overrides.pattern_types ?? ["layered_architecture"],
    complexity: overrides.complexity ?? "medium",
    quality_score: Math.max(60, Math.min(95, score?.engineering_quality.score ?? 72)),
    source_repos: [
      {
        repo: overrides.source_repos?.[0]?.repo ?? context.repo,
        url: overrides.source_repos?.[0]?.url ?? context.url,
        commit: overrides.source_repos?.[0]?.commit ?? sourceCommit(context),
        reference_files: overrides.source_repos?.[0]?.reference_files ?? referenceFiles(context, ["src", "lib", "package"])
      }
    ],
    use_when: overrides.use_when ?? ["A local tool has enough modules that source, tests, examples, and metadata need separate ownership boundaries."],
    avoid_when: overrides.avoid_when ?? ["The project has only one runtime file and no recurring boundary decisions for tests, examples, or metadata."],
    tradeoffs: overrides.tradeoffs ?? ["Adds a small amount of directory discipline in exchange for easier auditing by humans and agents."],
    transfer_targets: overrides.transfer_targets ?? ["knowledge_base", "repo_auditor"],
    related_patterns: [],
    created_at: created,
    updated_at: created,
    run_id: context.run_id,
    evidence_strength: context.fixture ? "medium" : "weak",
    maturity: "stable",
    source_languages: context.metadata.language ? [context.metadata.language] : [],
    source_frameworks: [],
    risk_level: "medium",
    tags: overrides.tags ?? ["architecture", "auditability"]
  };
}

function withRetrievalTags(draft: PatternDraft): PatternDraft {
  return {
    ...draft,
    body: ensurePatternNavigationSections(draft.body, draft.frontmatter)
  };
}

function registryBody(context: RepoContext, rows: EvidenceRow[]): string {
  return `# Capability registry with lifecycle hooks

## Engineering Problem
Agent and CLI tools tend to accumulate capabilities that each need startup context, execution rules, and cleanup. Without a host-owned registry, those lifecycle decisions drift into command handlers and make later extension risky.

## Core Judgment
The key judgment is to let capability modules own domain behavior while a small registry owns lifecycle sequencing. That keeps extension points explicit without letting every command invent its own initialization path.

## Use When
Use this when three or more independently changing capabilities need the same initialize, run, and cleanup contract. It is especially useful when an agent tool must expose new capabilities without rewriting the command surface.

## Avoid When
Avoid this when there is only one implementation, when capability boundaries are still unstable, or when direct function calls remain easier to inspect. A registry too early makes debugging harder and hides simple control flow.

## Design Forces
The pattern trades directness for extension isolation, lifecycle testability, and predictable ownership. It also introduces registry state, so the registry must stay small and avoid becoming a service locator for unrelated dependencies.

## Boundary Decisions
The host boundary owns registration, duplicate detection, lifecycle order, and shared runtime context. Each capability owns its private state and exposes only the lifecycle hooks in the contract; cross-capability calls should go through explicit host APIs.

## Failure Modes
Common failures include storing hidden mutable state in the registry, allowing plugins to import each other by name, letting registration order become undocumented behavior, and skipping tests that prove lifecycle order or duplicate rejection.

## Simpler Alternatives
A plain array of explicit function calls is better when there are only one or two capabilities. A switch statement in the command handler is also clearer until the same lifecycle shape repeats across modules.

## Transfer Guidance
Count independently changing modules first, then list shared lifecycle phases, then write one test that proves ordering and one test that proves duplicate protection. If those tests feel unnecessary, the registry is probably premature.

## Implementation Hint
Use a typed capability contract, a small map keyed by capability id, and one host-owned method per lifecycle phase. Keep dependency injection explicit through the runtime context instead of allowing global imports.

${evidenceSections(context, rows, "capability registry")}`;
}

function commandBody(context: RepoContext, rows: EvidenceRow[]): string {
  return `# Explicit command router table

## Engineering Problem
CLI tools often start with a single command and then grow subcommands, flags, and workflow entry points. If routing logic stays mixed with command behavior, every new command increases regression risk.

## Core Judgment
The useful boundary is a thin router that maps command names to handlers and leaves each handler responsible for its own workflow. The router should validate the command surface, not own business behavior.

## Use When
Use this when a tool has several subcommands with different dependencies but the same process entry point. It helps agents inspect the available action surface before changing one command.

## Avoid When
Avoid it when the CLI has one command or when options are still being discovered. In that phase, a direct function call or a small switch statement is more transparent and easier to delete.

## Design Forces
The router improves discoverability, testability, and separation between parsing and execution. The cost is an extra layer that can become a dumping ground if handlers are not kept independent.

## Boundary Decisions
The router owns command lookup, unknown-command errors, and delegation. Handlers own validation of their domain inputs and should not mutate the router table at runtime.

## Failure Modes
The main failure mode is letting router-level state leak into handlers. Another is treating command names as hidden plugin ids, which makes renames dangerous unless tests lock the command contract.

## Simpler Alternatives
A switch statement is enough when the command list is short and unlikely to grow. A direct script entry is better for one-off automation that will not become a reused local tool.

## Transfer Guidance
List every command and handler, then check whether command addition requires touching unrelated workflows. If yes, introduce a router table and test unknown command behavior plus one happy path.

## Implementation Hint
Represent the command surface as a typed record from command name to handler. Keep argument parsing near the router and workflow-specific validation inside each handler.

${evidenceSections(context, rows, "command router")}`;
}

function boundaryBody(context: RepoContext, rows: EvidenceRow[]): string {
  return `# Evidence-backed source boundary layout

## Engineering Problem
Agent-readable tools need source, tests, examples, and metadata to be easy to inspect without cloning mental state from a previous session. A flat or mixed layout makes automated audit and later extraction weaker.

## Core Judgment
The core judgment is to make repository evidence follow the same boundaries as runtime responsibilities. Source files show behavior, tests prove contracts, examples show usage, and metadata exposes operational commands.

## Use When
Use this when a local tool is meant to be maintained by agents across sessions and needs clear audit trails for behavior, tests, and generated artifacts.

## Avoid When
Avoid forcing this layout on tiny scripts or throwaway experiments. If the code can be understood in one screen and has no reusable contract, directory ceremony will slow iteration.

## Design Forces
The pattern trades some up-front organization for lower future search cost and safer automated changes. It works only if each directory has a real responsibility rather than serving as decorative architecture.

## Boundary Decisions
Runtime modules, tests, examples, and metadata must not duplicate responsibilities. Tests should verify contracts at module boundaries, while examples should show expected use rather than becoming hidden integration tests.

## Failure Modes
Common failure modes include creating empty directories, using examples as production dependencies, and letting metadata scripts become the only reliable documentation of how the project works.

## Simpler Alternatives
Keep a single script plus a README when there is no stable public contract. Split only after a second workflow or a second maintainer-agent needs to inspect behavior independently.

## Transfer Guidance
Ask whether an agent can find entry points, contracts, examples, and verification commands in under a minute. If not, introduce the smallest layout split that maps to those questions.

## Implementation Hint
Keep top-level directories boring and explicit: source, tests, docs, examples, generated knowledge, and run metadata. Avoid creating layers that do not own a distinct decision.

${evidenceSections(context, rows, "source boundary layout")}`;
}

export class HeuristicExtractor implements PatternExtractor {
  async extractPatterns(context: RepoContext, score?: RepoScore, runDate = new Date()): Promise<PatternDraft[]> {
    const paths = [...context.tree_summary, ...context.selected_files.map((file) => file.path)];
    const drafts: PatternDraft[] = [];
    const focusPattern = inferFocusPattern(context);

    if (focusPattern) {
      const evidence = buildEvidenceRows(context, focusPattern.keywords, focusPattern.coreNoun);
      const refs = evidence.map((row) => row.file);
      return [
        {
          frontmatter: baseFrontmatter(context, score, runDate, {
            id: focusPattern.id,
            name: focusPattern.name,
            summary: focusPattern.summary,
            engineering_problems: focusPattern.engineering_problems,
            pattern_types: focusPattern.pattern_types,
            transfer_targets: focusPattern.transfer_targets,
            source_repos: [{ repo: context.repo, url: context.url, commit: sourceCommit(context), reference_files: refs }],
            use_when: focusPattern.use_when,
            avoid_when: focusPattern.avoid_when,
            tradeoffs: focusPattern.tradeoffs,
            tags: [...(context.seed_focus ?? []), "seed-focus"]
          }),
          body: focusedBody(context, focusPattern, evidence)
        }
      ].map(withRetrievalTags);
    }

    if (includesAny(paths, ["plugin", "registry", "provider", "capabilit", "lifecycle"])) {
      const evidence = buildEvidenceRows(context, ["plugin", "registry", "provider", "capabilit", "lifecycle"], "capability registry");
      const refs = evidence.map((row) => row.file);
      drafts.push({
        frontmatter: baseFrontmatter(context, score, runDate, {
          id: "pattern-plugin-system-capability-lifecycle-registry",
          name: "Capability registry with lifecycle hooks",
          summary: "A capability registry keeps extension ownership local while centralizing initialize, execute, and cleanup sequencing.",
          engineering_problems: ["plugin_extension", "lifecycle_management", "extensibility"],
          pattern_types: ["registry", "plugin_system", "lifecycle_hooks", "capability_boundary"],
          transfer_targets: ["codex_skill_system", "agent_tooling", "workflow_engine"],
          source_repos: [{ repo: context.repo, url: context.url, commit: sourceCommit(context), reference_files: refs }],
          use_when: ["Three or more independently changing capabilities need a shared lifecycle without cross-importing each other."],
          avoid_when: ["Only one implementation exists or direct function calls still make the lifecycle easier to inspect."],
          tradeoffs: ["Adds registry state and lifecycle indirection in exchange for extension isolation and testable ordering."],
          tags: ["extension", "lifecycle", "capability-boundary"]
        }),
        body: registryBody(context, evidence)
      });
    }

    if (includesAny(paths, ["command", "router", "cli"])) {
      const evidence = buildEvidenceRows(context, ["command", "router", "cli"], "command router");
      const refs = evidence.map((row) => row.file);
      drafts.push({
        frontmatter: baseFrontmatter(context, score, runDate, {
          id: "pattern-command-routing-explicit-handler-table",
          name: "Explicit command router table",
          summary: "A narrow command router maps command names to handlers so CLI workflow boundaries stay inspectable and testable.",
          engineering_problems: ["command_routing", "api_boundary", "developer_experience"],
          pattern_types: ["command_router", "facade"],
          transfer_targets: ["cli_assistant", "local_automation_tool", "agent_tooling"],
          source_repos: [{ repo: context.repo, url: context.url, commit: sourceCommit(context), reference_files: refs }],
          use_when: ["Several subcommands share one process entry point but should keep independent workflow behavior."],
          avoid_when: ["The tool has a single command or the command surface still changes faster than tests can stabilize it."],
          tradeoffs: ["Adds a dispatch layer in exchange for clearer command ownership and safer new-command additions."],
          tags: ["cli", "routing", "handler-table"]
        }),
        body: commandBody(context, evidence)
      });
    }

    if (drafts.length === 0) {
      const evidence = buildEvidenceRows(context, ["src", "lib", "test", "docs", "package"], "source boundary layout");
      const refs = evidence.map((row) => row.file);
      drafts.push({
        frontmatter: baseFrontmatter(context, score, runDate, {
          source_repos: [{ repo: context.repo, url: context.url, commit: sourceCommit(context), reference_files: refs }]
        }),
        body: boundaryBody(context, evidence)
      });
    }

    return drafts.slice(0, 3).map(withRetrievalTags);
  }
}
