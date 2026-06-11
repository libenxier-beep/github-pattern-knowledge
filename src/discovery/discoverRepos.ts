import type { GitHubClient, GitHubSearchRepo } from "../github/client";
import { addYears, localDateString } from "../utils/date";

function oneYearAgo(now: Date): string {
  return localDateString(addYears(now, -1));
}

function polluted(repo: GitHubSearchRepo): boolean {
  const text = `${repo.full_name} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")}`.toLowerCase();
  const blocked = ["awesome", "prompt-list", "prompts", "demo", "landing-page", "template-only", "course-list"];
  return blocked.some((item) => text.includes(item));
}

export function buildDiscoveryQueries(now = new Date()): string[] {
  const pushedAfter = oneYearAgo(now);
  return [
    `stars:>500 pushed:>${pushedAfter} archived:false`,
    "topic:cli stars:>300 archived:false",
    "topic:developer-tools stars:>300 archived:false",
    "topic:automation stars:>300 archived:false",
    "topic:testing stars:>300 archived:false",
    "topic:framework stars:>500 archived:false",
    "topic:agent stars:>100 archived:false"
  ];
}

export async function discoverGitHubRepos(client: GitHubClient, now = new Date()): Promise<GitHubSearchRepo[]> {
  const byRepo = new Map<string, GitHubSearchRepo>();
  for (const query of buildDiscoveryQueries(now)) {
    const repos = await client.searchRepos(query, 6);
    for (const repo of repos) {
      if (repo.archived || repo.fork || repo.stargazers_count < 100 || polluted(repo)) {
        continue;
      }
      byRepo.set(repo.full_name, repo);
    }
  }
  return [...byRepo.values()].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 8);
}
