import type { Taxonomy } from "../types";

export const DEFAULT_TAXONOMY: Taxonomy = {
  engineering_problems: [
    "configuration",
    "plugin_extension",
    "command_routing",
    "state_management",
    "task_scheduling",
    "error_recovery",
    "persistence",
    "testing_strategy",
    "observability",
    "security_boundary",
    "data_flow",
    "workflow_orchestration",
    "api_boundary",
    "local_file_system",
    "package_architecture",
    "dependency_management",
    "background_jobs",
    "caching",
    "authorization",
    "validation",
    "migration",
    "concurrency",
    "extensibility",
    "developer_experience",
    "lifecycle_management"
  ],
  project_types: [
    "cli_tool",
    "web_app",
    "saas",
    "library",
    "framework",
    "devtool",
    "agent_workflow",
    "automation_tool",
    "data_tool",
    "testing_tool",
    "database_tool",
    "documentation_tool",
    "build_tool",
    "infrastructure_tool",
    "browser_tool",
    "desktop_app"
  ],
  pattern_types: [
    "registry",
    "adapter",
    "pipeline",
    "middleware",
    "event_bus",
    "state_machine",
    "command_router",
    "repository",
    "strategy",
    "lifecycle_hooks",
    "worker_queue",
    "plugin_system",
    "provider",
    "facade",
    "layered_architecture",
    "dependency_injection",
    "schema_validation",
    "retry_policy",
    "checkpointing",
    "task_graph",
    "declarative_config",
    "file_based_store",
    "capability_boundary"
  ],
  transfer_targets: [
    "codex_skill_system",
    "local_automation_tool",
    "workflow_engine",
    "agent_tooling",
    "repo_auditor",
    "code_generator",
    "task_scheduler",
    "knowledge_base",
    "developer_dashboard",
    "cli_assistant",
    "web_app_backend",
    "testing_harness"
  ]
};

export const PATTERN_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Pattern Note",
  type: "object",
  required: [
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
  ]
};

export const CARD_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Daily Design Card",
  type: "object"
};

export const RUN_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Daily Run Metadata",
  type: "object"
};
