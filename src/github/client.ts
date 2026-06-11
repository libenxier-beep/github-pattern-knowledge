import type { RepoMetadata } from "../types";
import { loadDotEnvLocal } from "../utils/env";

export type GitHubSearchRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics?: string[];
  archived: boolean;
  fork: boolean;
  pushed_at: string;
  updated_at: string;
  created_at: string;
  default_branch: string;
};

export type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
  sha: string;
};

export type GitHubCommit = {
  sha: string;
};

export class GitHubClient {
  private readonly token?: string;
  private readonly baseUrl: string;

  constructor(options: { token?: string; baseUrl?: string } = {}) {
    loadDotEnvLocal();
    this.token = options.token ?? process.env.GITHUB_TOKEN;
    this.baseUrl = options.baseUrl ?? "https://api.github.com";
  }

  private async request<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "github-pattern-knowledge"
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers,
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`GitHub API ${response.status} for ${path}: ${message.slice(0, 240)}`);
    }
    return (await response.json()) as T;
  }

  async searchRepos(query: string, perPage = 5): Promise<GitHubSearchRepo[]> {
    const data = await this.request<{ items: GitHubSearchRepo[] }>(
      `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`
    );
    return data.items;
  }

  async getRepo(fullName: string): Promise<GitHubSearchRepo> {
    return this.request<GitHubSearchRepo>(`/repos/${fullName}`);
  }

  async getTree(fullName: string, ref: string): Promise<GitHubTreeItem[]> {
    const data = await this.request<{ tree: GitHubTreeItem[]; truncated: boolean }>(
      `/repos/${fullName}/git/trees/${encodeURIComponent(ref)}?recursive=1`
    );
    return data.tree;
  }

  async getCommitSha(fullName: string, branch: string): Promise<string> {
    const data = await this.request<GitHubCommit>(`/repos/${fullName}/commits/${encodeURIComponent(branch)}`);
    return data.sha;
  }

  async getReadme(fullName: string, ref?: string): Promise<string> {
    try {
      const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      const data = await this.request<{ content: string; encoding: string }>(`/repos/${fullName}/readme${refQuery}`);
      return Buffer.from(data.content, "base64").toString("utf8");
    } catch {
      return "";
    }
  }

  async getFileText(fullName: string, ref: string, filePath: string): Promise<string> {
    const encoded = filePath.split("/").map(encodeURIComponent).join("/");
    const data = await this.request<{ content: string; encoding: string }>(`/repos/${fullName}/contents/${encoded}?ref=${encodeURIComponent(ref)}`);
    return Buffer.from(data.content, "base64").toString("utf8");
  }

  async getReleaseCount(fullName: string): Promise<number> {
    try {
      const data = await this.request<unknown[]>(`/repos/${fullName}/releases?per_page=5`);
      return data.length;
    } catch {
      return 0;
    }
  }
}

export function toRepoMetadata(repo: GitHubSearchRepo, releasesCount = 0): RepoMetadata {
  return {
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    open_issues: repo.open_issues_count,
    language: repo.language,
    topics: repo.topics ?? [],
    archived: repo.archived,
    fork: repo.fork,
    pushed_at: repo.pushed_at,
    updated_at: repo.updated_at,
    created_at: repo.created_at,
    default_branch: repo.default_branch,
    description: repo.description,
    releases_count: releasesCount
  };
}
