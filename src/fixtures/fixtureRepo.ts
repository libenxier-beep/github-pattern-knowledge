import type { RepoContext } from "../types";

export function createFixtureRepoContext(runId: string, now = new Date()): RepoContext {
  const iso = now.toISOString();
  return {
    run_id: runId,
    repo: "fixture/agent-workflow-kit",
    url: "fixture://agent-workflow-kit",
    default_branch: "main",
    commit_sha: "fixture-agent-workflow-kit",
    fixture: true,
    metadata: {
      stars: 2400,
      forks: 210,
      open_issues: 34,
      language: "TypeScript",
      topics: ["agent", "cli", "developer-tools", "automation"],
      archived: false,
      fork: false,
      pushed_at: iso,
      updated_at: iso,
      created_at: "2023-02-01T00:00:00.000Z",
      default_branch: "main",
      description: "Fixture repo context for testing agent workflow capability boundaries.",
      releases_count: 3
    },
    tree_summary: [
      "package.json",
      "README.md",
      "docs/capabilities.md",
      "examples/basic-workflow.ts",
      "src/capabilities/registry.ts",
      "src/capabilities/lifecycle.ts",
      "src/commands/router.ts",
      "src/storage/checkpoints.ts",
      "tests/capability-registry.test.ts",
      ".github/workflows/ci.yml"
    ],
    selected_files: [
      {
        path: "src/capabilities/registry.ts",
        reason: "Capability registry with explicit lifecycle hooks",
        truncated: false,
        content: `export type Capability = {
  id: string;
  initialize(context: RuntimeContext): Promise<void>;
  run(input: CapabilityInput): Promise<CapabilityOutput>;
  cleanup(): Promise<void>;
};

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, Capability>();

  register(capability: Capability) {
    if (this.capabilities.has(capability.id)) throw new Error("duplicate capability");
    this.capabilities.set(capability.id, capability);
  }

  async initializeAll(context: RuntimeContext) {
    for (const capability of this.capabilities.values()) {
      await capability.initialize(context);
    }
  }
}`
      },
      {
        path: "src/commands/router.ts",
        reason: "CLI command routing table delegates to capability handlers",
        truncated: false,
        content: `const handlers: Record<string, CommandHandler> = {
  daily: runDailyWorkflow,
  harness: runHarness,
  index: regenerateIndexes
};

export async function routeCommand(argv: string[]) {
  const command = argv[2] ?? "daily";
  const handler = handlers[command];
  if (!handler) throw new UsageError(command);
  return handler(argv.slice(3));
}`
      },
      {
        path: "tests/capability-registry.test.ts",
        reason: "Tests verify lifecycle ordering and duplicate capability rejection",
        truncated: false,
        content: `test("initializes registered capabilities in insertion order", async () => {
  const events: string[] = [];
  const registry = new CapabilityRegistry();
  registry.register(fakeCapability("search", events));
  registry.register(fakeCapability("write", events));
  await registry.initializeAll(context);
  expect(events).toEqual(["search:init", "write:init"]);
});`
      }
    ],
    readme_excerpt: "Agent Workflow Kit is a local CLI toolkit that registers capabilities, routes commands, and records checkpoints for long-running agent jobs.",
    package_metadata: [
      {
        path: "package.json",
        excerpt: "{\"scripts\":{\"daily\":\"tsx src/commands/router.ts daily\",\"test\":\"vitest run\"},\"dependencies\":{\"yaml\":\"latest\"}}"
      }
    ],
    fetched_at: iso,
    truncation: { files_truncated: 0, context_truncated: false }
  };
}
