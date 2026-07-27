import type { PatternFrontmatter } from "../types";

export type KnowledgeContextId =
  | "github_engineering_patterns"
  | "loop_harness_engineering"
  | "skill_engineering"
  | "agent_memory_knowledge_bases"
  | "backend_retrieval_information_flow"
  | "mcp";

export type PatternRouteDisposition = "context_pattern" | "review_queue";

export type PatternRoute = {
  context: KnowledgeContextId;
  disposition: PatternRouteDisposition;
  reason: string;
  confidence: "high" | "medium" | "low";
};

function hasAny(values: string[] | undefined, needles: string[]): boolean {
  return (values ?? []).some((value) => needles.some((needle) => value.toLowerCase().includes(needle)));
}

export function routePattern(frontmatter: PatternFrontmatter): PatternRoute {
  if (hasAny(frontmatter.transfer_targets, ["knowledge_base"]) || hasAny(frontmatter.pattern_types, ["file_based_store"])) {
    return {
      context: "agent_memory_knowledge_bases",
      disposition: "context_pattern",
      reason: "Persistence-oriented transfer targets and pattern types route to the memory/knowledge-base context.",
      confidence: "medium"
    };
  }
  if (hasAny(frontmatter.transfer_targets, ["codex_skill_system"]) || hasAny(frontmatter.tags, ["skill", "runbook"])) {
    return {
      context: "skill_engineering",
      disposition: "context_pattern",
      reason: "Skill-oriented transfer targets and tags route to skill engineering.",
      confidence: "medium"
    };
  }
  if (
    hasAny(frontmatter.transfer_targets, ["mcp_server", "tool_protocol"]) ||
    hasAny(frontmatter.project_types, ["mcp_server"]) ||
    hasAny(frontmatter.tags, ["mcp", "tool-protocol"])
  ) {
    return {
      context: "mcp",
      disposition: "context_pattern",
      reason: "Explicit MCP or tool-protocol ownership routes to the protocol/tool-surface context.",
      confidence: "medium"
    };
  }
  if (
    hasAny(frontmatter.pattern_types, ["middleware", "command_router", "checkpointing"]) &&
    (
      hasAny(frontmatter.project_types, ["agent_workflow"]) ||
      hasAny(frontmatter.transfer_targets, ["agent_tooling", "local_automation_tool", "cli_assistant", "testing_harness"])
    )
  ) {
    return {
      context: "loop_harness_engineering",
      disposition: "context_pattern",
      reason: "Agent workflow execution surfaces route to loop and harness engineering unless they form a complete closed loop.",
      confidence: "medium"
    };
  }
  return {
    context: "github_engineering_patterns",
    disposition: "review_queue",
    reason: "No complete-loop or high-confidence Work Context route was detected; hold for human or distiller review instead of promoting it as a GEP pattern.",
    confidence: "low"
  };
}
