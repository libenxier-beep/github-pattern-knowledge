import { describe, expect, test } from "vitest";
import { createExtractor } from "../src/extraction/createExtractor";
import { LLMExtractor } from "../src/extraction/llmExtractor";
import type { LLMClient } from "../src/extraction/llmClient";
import { DEFAULT_TAXONOMY } from "../src/knowledge/defaultSchemas";
import { validatePatternMarkdown } from "../src/harness/patternHarness";
import { stringifyMarkdown } from "../src/knowledge/frontmatter";
import { createFixtureRepoContext } from "../src/fixtures/fixtureRepo";

const llmBody = `# Capability lifecycle registry

## Engineering Problem
Agent tools accumulate capability modules until startup and cleanup behavior is scattered across command handlers.

## Core Judgment
Use a host-owned capability registry when several capability modules share the same initialize and execution contract.

## Use When
Use this when independently changing capabilities need shared lifecycle order and duplicate registration protection.

## Avoid When
Avoid this when a single direct function call still exposes all behavior more clearly.

## Design Forces
The registry trades directness for extension isolation, lifecycle testability, and easier capability replacement.

## Boundary Decisions
The host owns registration, duplicate detection, and lifecycle order while each capability owns domain behavior.

## Failure Modes
The pattern fails when the registry becomes a service locator or when registration order is undocumented.

## Simpler Alternatives
Use a plain array of function calls while there are only one or two capabilities.

## Transfer Guidance
Transfer the lifecycle contract first, then add tests for ordering and duplicate rejection before adding plugin discovery.

## Implementation Hint
Start with a typed map keyed by capability id and one host-owned method per lifecycle phase.

## Evidence Table
| Reference file | Observed structure | Concrete names | Why it supports the pattern |
| --- | --- | --- | --- |
| \`src/capabilities/registry.ts\` | Defines a registry class that owns capability registration and lifecycle sequencing. | \`CapabilityRegistry\`, \`register\`, \`initializeAll\` | This supports the pattern because lifecycle order is centralized in a host-owned boundary. |
| \`tests/capability-registry.test.ts\` | Verifies lifecycle order and duplicate capability rejection at the registry boundary. | \`initializes registered capabilities\`, \`duplicate capability\` | This supports the pattern because the extension contract is locked by tests. |

## Source Evidence
Evidence comes from fixture/agent-workflow-kit at commit fixture-agent-workflow-kit. The concrete files are src/capabilities/registry.ts and tests/capability-registry.test.ts.`;

function extractionPayload() {
  return {
    patterns: [
      {
        frontmatter: {
          id: "pattern-capability-lifecycle-registry-llm",
          name: "Capability lifecycle registry",
          summary: "A host-owned registry centralizes capability lifecycle ordering while keeping capability behavior isolated.",
          engineering_problems: ["plugin_extension", "lifecycle_management"],
          project_types: ["agent_workflow", "cli_tool"],
          pattern_types: ["registry", "lifecycle_hooks", "capability_boundary"],
          complexity: "medium",
          quality_score: 88,
          source_repos: [
            {
              repo: "invented/repo",
              url: "https://example.com/invented",
              commit: "unknown",
              reference_files: ["src/capabilities/registry.ts", "tests/capability-registry.test.ts", "not-in-snapshot.ts"]
            }
          ],
          use_when: ["Several independently changing capabilities need shared lifecycle order and duplicate registration protection."],
          avoid_when: ["Only one capability exists and direct calls are easier to inspect."],
          tradeoffs: ["Adds registry indirection in exchange for lifecycle isolation and testable extension ordering."],
          transfer_targets: ["agent_tooling", "codex_skill_system"],
          related_patterns: [],
          tags: ["llm", "registry"]
        },
        body: llmBody
      }
    ]
  };
}

class FakeLLMClient implements LLMClient {
  constructor(private readonly outputs: unknown[]) {}
  calls: Array<{ purpose: string; payload: unknown }> = [];

  async completeJson<T>(purpose: string, payload: unknown): Promise<T> {
    this.calls.push({ purpose, payload });
    return this.outputs.shift() as T;
  }
}

describe("LLM extractor", () => {
  test("normalizes LLM drafts to the current repo, commit, and selected evidence files", async () => {
    const client = new FakeLLMClient([extractionPayload(), { reviews: [{ id: "pattern-capability-lifecycle-registry-llm", decision: "accept", reason: "evidence supports the boundary" }] }]);
    const context = createFixtureRepoContext("run-llm", new Date("2026-06-11T00:00:00.000Z"));

    const [draft] = await new LLMExtractor({ client, taxonomy: DEFAULT_TAXONOMY }).extractPatterns(context, undefined, new Date("2026-06-11T00:00:00.000Z"));
    const markdown = stringifyMarkdown(draft.frontmatter as unknown as Record<string, unknown>, draft.body);
    const result = validatePatternMarkdown(`${draft.frontmatter.id}.md`, markdown, DEFAULT_TAXONOMY);

    expect(draft.frontmatter.source_repos[0]).toEqual({
      repo: "fixture/agent-workflow-kit",
      url: "fixture://agent-workflow-kit",
      commit: "fixture-agent-workflow-kit",
      reference_files: ["src/capabilities/registry.ts", "tests/capability-registry.test.ts"]
    });
    expect(draft.frontmatter.run_id).toBe("run-llm");
    expect(result.valid).toBe(true);
    expect(client.calls.map((call) => call.purpose)).toEqual(["pattern_extraction", "pattern_review"]);
  });

  test("factory chooses heuristic without key and llm when explicitly configured", () => {
    expect(createExtractor({ mode: "auto", hasOpenAIKey: false }).name).toBe("heuristic");
    expect(createExtractor({ mode: "llm", hasOpenAIKey: true, client: new FakeLLMClient([]), taxonomy: DEFAULT_TAXONOMY }).name).toBe("llm");
  });

  test("falls back to heuristic when reviewer rejects every LLM draft", async () => {
    const client = new FakeLLMClient([extractionPayload(), { reviews: [{ id: "pattern-capability-lifecycle-registry-llm", decision: "reject", reason: "too generic" }] }]);
    const context = createFixtureRepoContext("run-review-reject", new Date("2026-06-11T00:00:00.000Z"));

    const drafts = await new LLMExtractor({ client, taxonomy: DEFAULT_TAXONOMY, fallback: createExtractor({ mode: "heuristic" }).extractor }).extractPatterns(context);

    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts[0].frontmatter.id).not.toBe("pattern-capability-lifecycle-registry-llm");
  });
});
