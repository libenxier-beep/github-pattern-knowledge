import { describe, expect, test } from "vitest";
import { buildDiscoveryQueries, discoverGitHubRepos } from "../src/discovery/discoverRepos";
import type { GitHubSearchRepo } from "../src/github/client";

function repo(fullName: string, stars: number, overrides: Partial<GitHubSearchRepo> = {}): GitHubSearchRepo {
  return {
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    description: "developer tooling repository",
    stargazers_count: stars,
    forks_count: 100,
    open_issues_count: 10,
    language: "TypeScript",
    topics: ["developer-tools"],
    archived: false,
    fork: false,
    pushed_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    created_at: "2022-01-01T00:00:00Z",
    default_branch: "main",
    ...overrides
  };
}

describe("GitHub discovery", () => {
  test("searches mechanism-rich engineering systems across domains, not only AI projects", () => {
    const queries = buildDiscoveryQueries(new Date("2026-07-05T00:00:00Z"));
    const joined = queries.join(" ").toLowerCase();

    expect(joined).toContain("document management");
    expect(joined).toContain("video editing");
    expect(joined).toContain("quantitative trading");
    expect(joined).toContain("state machine");
  });

  test("samples AI, domain, and mechanism lanes inside the default request budget", async () => {
    const calls: string[] = [];
    const client = {
      async searchRepos(query: string) {
        calls.push(query.toLowerCase());
        return [];
      }
    };

    await discoverGitHubRepos(client, new Date("2026-07-05T00:00:00Z"), {
      limit: 8,
      maxPages: 1,
      maxRequests: 10
    });

    expect(calls.some((query) => query.includes("ai-agents"))).toBe(true);
    expect(calls.some((query) => query.includes("document management"))).toBe(true);
    expect(calls.some((query) => query.includes("video editing"))).toBe(true);
    expect(calls.some((query) => query.includes("state machine"))).toBe(true);
  });

  test("keeps AI engineering as one focused lane instead of a broad popularity sweep", () => {
    const queries = buildDiscoveryQueries(new Date("2026-07-05T00:00:00Z"));
    const joined = queries.join(" ");

    expect(joined).toContain("topic:ai-agents");
    expect(joined).toContain("mcp");
    expect(joined).toContain("browser automation");
    expect(joined).toContain("research automation");
    expect(queries.some((query) => query.startsWith("stars:>500 pushed:>"))).toBe(false);
  });

  test("continues past excluded first-page repos before returning candidates", async () => {
    const calls: Array<{ query: string; perPage: number; page?: number }> = [];
    const client = {
      async searchRepos(query: string, perPage: number, page?: number) {
        calls.push({ query, perPage, page });
        return page === 2 ? [repo("owner/fresh", 900)] : [repo("owner/learned", 1000)];
      }
    };

    const results = await discoverGitHubRepos(client, new Date("2026-07-05T00:00:00Z"), {
      excludeRepos: new Set(["owner/learned"]),
      limit: 1,
      maxRequests: 20,
      maxPages: 2,
      perPage: 1
    });

    expect(results.map((item) => item.full_name)).toEqual(["owner/fresh"]);
    expect(calls.some((call) => call.page === 2)).toBe(true);
  });

  test("filters roadmap and resource-list repositories from engineering pattern discovery", async () => {
    const client = {
      async searchRepos() {
        return [
          repo("nilbuild/developer-roadmap", 1000, {
            description: "Interactive roadmaps and educational content to help developers grow.",
            topics: ["developer-roadmap", "roadmap", "frontend-roadmap"]
          }),
          repo("owner/engineering-tool", 800)
        ];
      }
    };

    const results = await discoverGitHubRepos(client, new Date("2026-07-05T00:00:00Z"), {
      limit: 1,
      maxRequests: 1
    });

    expect(results.map((item) => item.full_name)).toEqual(["owner/engineering-tool"]);
  });

  test("filters article and learning-path repositories from engineering pattern discovery", async () => {
    const client = {
      async searchRepos() {
        return [
          repo("owner/ai-articles", 1000, {
            description: "Articles and learning path for AI engineers.",
            topics: ["ai", "articles", "learning-path"]
          }),
          repo("owner/agent-runtime", 800, {
            description: "AI agent runtime with code execution and MCP tools.",
            topics: ["ai-agents", "mcp", "developer-tools"]
          })
        ];
      }
    };

    const results = await discoverGitHubRepos(client, new Date("2026-07-05T00:00:00Z"), {
      limit: 1,
      maxRequests: 1
    });

    expect(results.map((item) => item.full_name)).toEqual(["owner/agent-runtime"]);
  });

  test("keeps relevant AI engineering ahead of generic popularity", async () => {
    const client = {
      async searchRepos() {
        return [
          repo("owner/generic-devtool", 50000, {
            description: "Popular developer tooling framework.",
            topics: ["developer-tools"]
          }),
          repo("owner/local-agent-runtime", 900, {
            description: "AI agent runtime with MCP, browser automation, evals, memory, and local workflow tools.",
            topics: ["ai-agents", "mcp", "evals", "developer-tools"]
          })
        ];
      }
    };

    const results = await discoverGitHubRepos(client, new Date("2026-07-05T00:00:00Z"), {
      limit: 2,
      maxRequests: 1
    });

    expect(results.map((item) => item.full_name)).toEqual(["owner/local-agent-runtime", "owner/generic-devtool"]);
  });

  test("ranks cross-domain production craft above a commodity AI feature surface", async () => {
    const client = {
      async searchRepos() {
        return [
          repo("owner/commodity-agent", 5000, {
            description: "AI agent with model selection, chat instructions, MCP tools, and function calling.",
            topics: ["ai-agents", "mcp", "llm"]
          }),
          repo("owner/versioned-publishing-engine", 1200, {
            description:
              "Document management and publishing workflow with provenance, versioning, approval, rollback, conflict reconciliation, idempotent jobs, and partial-failure recovery.",
            topics: ["document-management", "workflow", "publishing", "version-control"]
          })
        ];
      }
    };

    const results = await discoverGitHubRepos(client, new Date("2026-07-05T00:00:00Z"), {
      limit: 2,
      maxRequests: 1
    });

    expect(results.map((item) => item.full_name)).toEqual(["owner/versioned-publishing-engine", "owner/commodity-agent"]);
  });
});
