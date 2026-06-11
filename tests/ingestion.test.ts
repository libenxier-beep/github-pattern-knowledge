import { describe, expect, test } from "vitest";
import { GitHubClient, type GitHubSearchRepo, type GitHubTreeItem } from "../src/github/client";
import { ingestRepo } from "../src/ingestion/ingestRepo";

class FakeGitHubClient extends GitHubClient {
  async getReleaseCount(): Promise<number> {
    return 2;
  }

  async getCommitSha(): Promise<string> {
    return "fedcba9876543210fedcba9876543210fedcba98";
  }

  async getTree(): Promise<GitHubTreeItem[]> {
    return [
      { path: "src/plugins/registry.ts", type: "blob", size: 2000, sha: "tree-a" },
      { path: "tests/plugins/registry.test.ts", type: "blob", size: 2000, sha: "tree-b" },
      { path: "package.json", type: "blob", size: 200, sha: "tree-c" }
    ];
  }

  async getReadme(): Promise<string> {
    return "A plugin registry project.";
  }

  async getFileText(_fullName: string, _branch: string, filePath: string): Promise<string> {
    if (filePath.endsWith("registry.test.ts")) {
      return "test('rejects duplicate capability', () => registry.register(capability));";
    }
    if (filePath.endsWith("package.json")) {
      return "{\"scripts\":{\"test\":\"vitest run\"}}";
    }
    return "export class CapabilityRegistry { register() {}; initializeAll() {}; }";
  }
}

describe("repository ingestion", () => {
  test("records the concrete default-branch commit sha in repo context", async () => {
    const repo: GitHubSearchRepo = {
      full_name: "owner/project",
      html_url: "https://github.com/owner/project",
      description: "Test repo",
      stargazers_count: 100,
      forks_count: 10,
      open_issues_count: 2,
      language: "TypeScript",
      topics: ["cli"],
      archived: false,
      fork: false,
      pushed_at: "2026-06-11T00:00:00.000Z",
      updated_at: "2026-06-11T00:00:00.000Z",
      created_at: "2020-01-01T00:00:00.000Z",
      default_branch: "main"
    };

    const context = await ingestRepo(new FakeGitHubClient(), repo, "run-ingest", new Date("2026-06-11T00:00:00.000Z"), ["plugin"]);

    expect(context.commit_sha).toBe("fedcba9876543210fedcba9876543210fedcba98");
  });
});
