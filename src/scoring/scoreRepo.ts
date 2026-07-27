import type { RepoContext, RepoScore, ScoreBreakdown } from "../types";
import {
  AI_ENGINEERING_TERMS,
  CROSS_DOMAIN_MECHANISM_TERMS,
  DISCOVERY_CAPABILITIES,
  ENGINEERING_DOMAIN_TERMS,
  LOCAL_WORK_TERMS,
  PRODUCTION_CRAFT_TERMS,
  TRANSFER_BRIDGE_TERMS,
  contextSearchText,
  matchTerms
} from "../discovery/selectionPolicy";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysSince(dateText: string, now: Date): number {
  const time = Date.parse(dateText);
  if (Number.isNaN(time)) {
    return 9999;
  }
  return Math.max(0, (now.getTime() - time) / 86_400_000);
}

function hasAny(paths: string[], predicates: Array<(path: string) => boolean>): boolean {
  return paths.some((item) => predicates.some((predicate) => predicate(item.toLowerCase())));
}

export function scoreRepoContext(context: RepoContext, now = new Date()): RepoScore {
  const tree = context.tree_summary.map((item) => item.toLowerCase());
  const hasTests = hasAny(tree, [(p) => p.includes("test"), (p) => p.includes("spec")]);
  const hasDocs = hasAny(tree, [(p) => p.startsWith("docs/"), (p) => p.includes("readme")]);
  const hasExamples = hasAny(tree, [(p) => p.startsWith("examples/"), (p) => p.includes("example")]);
  const hasCi = hasAny(tree, [(p) => p.startsWith(".github/workflows/"), (p) => p.includes("ci")]);
  const hasPackageMetadata = context.package_metadata.length > 0 || hasAny(tree, [(p) => ["package.json", "pyproject.toml", "cargo.toml", "go.mod"].some((name) => p.endsWith(name))]);
  const hasSourceDepth = tree.filter((p) => p.startsWith("src/") || p.startsWith("packages/") || p.startsWith("lib/")).length >= 3;
  const hasBoundarySignals = hasAny(tree, [
    (p) => p.includes("plugin"),
    (p) => p.includes("registry"),
    (p) => p.includes("provider"),
    (p) => p.includes("command"),
    (p) => p.includes("workflow"),
    (p) => p.includes("pipeline"),
    (p) => p.includes("config")
  ]);
  const hasRelease = Number(context.metadata.releases_count ?? 0) > 0;
  const selectionText = contextSearchText(context);
  const aiEngineeringMatches = matchTerms(selectionText, AI_ENGINEERING_TERMS);
  const engineeringDomainMatches = matchTerms(selectionText, ENGINEERING_DOMAIN_TERMS);
  const localWorkMatches = matchTerms(selectionText, LOCAL_WORK_TERMS);
  const productionCraftMatches = matchTerms(selectionText, PRODUCTION_CRAFT_TERMS);
  const crossDomainMechanismMatches = matchTerms(selectionText, CROSS_DOMAIN_MECHANISM_TERMS);
  const transferBridgeMatches = matchTerms(selectionText, TRANSFER_BRIDGE_TERMS);
  const capabilityMatches = DISCOVERY_CAPABILITIES.filter((capability) => matchTerms(selectionText, capability.terms).length > 0).map((capability) => capability.id);

  const qualitySignals: Record<string, boolean | number | string | null> = {
    has_tests: hasTests,
    has_docs: hasDocs,
    has_examples: hasExamples,
    has_ci: hasCi,
    has_package_metadata: hasPackageMetadata,
    has_source_depth: hasSourceDepth,
    has_boundary_signals: hasBoundarySignals,
    releases_count: context.metadata.releases_count ?? 0,
    language: context.metadata.language
  };
  const engineeringQuality: ScoreBreakdown = {
    score: clamp(
      20 +
        (hasTests ? 15 : 0) +
        (hasDocs ? 10 : 0) +
        (hasExamples ? 8 : 0) +
        (hasCi ? 10 : 0) +
        (hasPackageMetadata ? 10 : 0) +
        (hasSourceDepth ? 12 : 0) +
        (hasBoundarySignals ? 10 : 0) +
        (hasRelease ? 5 : 0)
    ),
    reasons: Object.entries(qualitySignals)
      .filter(([, value]) => value === true)
      .map(([key]) => key),
    signals: qualitySignals
  };

  const ageDays = daysSince(context.metadata.created_at, now);
  const starsScore = Math.min(35, Math.log10(Math.max(1, context.metadata.stars)) * 12);
  const forksScore = Math.min(20, Math.log10(Math.max(1, context.metadata.forks)) * 8);
  const ageScore = ageDays > 365 ? 15 : ageDays / 24;
  const infraTopic = context.metadata.topics.some((topic) => ["cli", "developer-tools", "framework", "automation", "testing", "infrastructure", "database"].includes(topic));
  const longTermImpact: ScoreBreakdown = {
    score: clamp(starsScore + forksScore + ageScore + (infraTopic ? 15 : 0) + (hasRelease ? 10 : 0) + (hasDocs ? 5 : 0)),
    reasons: [
      `${context.metadata.stars} stars`,
      `${context.metadata.forks} forks`,
      ageDays > 365 ? "project_age_over_one_year" : "young_project",
      infraTopic ? "infrastructure_or_devtool_topic" : "general_topic"
    ],
    signals: {
      stars: context.metadata.stars,
      forks: context.metadata.forks,
      age_days: Math.round(ageDays),
      infra_topic: infraTopic,
      releases_count: context.metadata.releases_count ?? 0
    }
  };

  const pushedDays = daysSince(context.metadata.pushed_at, now);
  const updatedDays = daysSince(context.metadata.updated_at, now);
  const recentHeat: ScoreBreakdown = {
    score: clamp(
      45 * Math.max(0, 1 - pushedDays / 180) +
        25 * Math.max(0, 1 - updatedDays / 180) +
        Math.min(15, context.metadata.open_issues / 20) +
        (hasRelease ? 10 : 0) +
        (context.metadata.stars > 1000 ? 5 : 0)
    ),
    reasons: [
      `pushed_${Math.round(pushedDays)}_days_ago`,
      `updated_${Math.round(updatedDays)}_days_ago`,
      hasRelease ? "has_releases" : "release_unknown"
    ],
    signals: {
      pushed_days: Math.round(pushedDays),
      updated_days: Math.round(updatedDays),
      open_issues: context.metadata.open_issues,
      stars: context.metadata.stars
    }
  };

  const selectionFit: ScoreBreakdown = {
    score: clamp(
      (engineeringDomainMatches.length > 0 || capabilityMatches.length > 0 ? 5 : 0) +
        Math.min(10, (engineeringDomainMatches.length + capabilityMatches.length) * 2) +
        Math.min(30, productionCraftMatches.length * 3) +
        Math.min(20, crossDomainMechanismMatches.length * 3) +
        Math.min(25, transferBridgeMatches.length * 3) +
        Math.min(10, localWorkMatches.length * 2)
    ),
    reasons: [
      ...(engineeringDomainMatches.length > 0 || capabilityMatches.length > 0 ? ["engineering_system_source"] : []),
      ...(aiEngineeringMatches.length > 0 ? ["ai_engineering_source_domain"] : []),
      ...(localWorkMatches.length > 0 ? ["local_work_environment_alignment"] : []),
      ...(productionCraftMatches.length >= 3 ? ["production_last_mile_craft"] : []),
      ...(crossDomainMechanismMatches.length >= 3 ? ["cross_domain_mechanism_density"] : []),
      ...(transferBridgeMatches.length >= 3 ? ["cross_domain_transfer_bridge"] : []),
      ...capabilityMatches.map((capability) => `capability:${capability}`)
    ],
    signals: {
      ai_engineering_matches: aiEngineeringMatches,
      engineering_domain_matches: engineeringDomainMatches,
      local_work_matches: localWorkMatches,
      production_craft_matches: productionCraftMatches,
      cross_domain_mechanism_matches: crossDomainMechanismMatches,
      transfer_bridge_matches: transferBridgeMatches,
      capability_matches: capabilityMatches
    }
  };

  const rejectionReasons: string[] = [];
  if (context.metadata.archived) {
    rejectionReasons.push("archived repo");
  }
  if (context.metadata.fork) {
    rejectionReasons.push("fork repo");
  }
  if (!hasSourceDepth && !hasBoundarySignals) {
    rejectionReasons.push("insufficient analyzable engineering structure");
  }

  const total = engineeringQuality.score * 0.38 + selectionFit.score * 0.32 + longTermImpact.score * 0.18 + recentHeat.score * 0.12;
  return {
    repo: context.repo,
    url: context.url,
    total_score: Number(total.toFixed(2)),
    engineering_quality: engineeringQuality,
    selection_fit: selectionFit,
    long_term_impact: longTermImpact,
    recent_heat: recentHeat,
    selected: false,
    rejection_reasons: rejectionReasons.length > 0 ? rejectionReasons : undefined
  };
}
