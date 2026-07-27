import type { GitHubClient, GitHubSearchRepo } from "../github/client";
import { buildCapabilityQueries, compareRepoSearchCandidates, isContentNoiseRepo, type SelectionPolicy } from "./selectionPolicy";

type RepoSearchClient = Pick<GitHubClient, "searchRepos">;

export type DiscoveryOptions = {
  excludeRepos?: Iterable<string>;
  limit?: number;
  maxPages?: number;
  maxRequests?: number;
  perPage?: number;
  selectionPolicy?: SelectionPolicy;
};

function normalizeRepo(repo: string): string {
  return repo.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "").toLowerCase();
}

export function buildDiscoveryQueries(now = new Date()): string[] {
  return buildCapabilityQueries(now);
}

export async function discoverGitHubRepos(client: RepoSearchClient, now = new Date(), options: DiscoveryOptions = {}): Promise<GitHubSearchRepo[]> {
  const byRepo = new Map<string, GitHubSearchRepo>();
  const excludeRepos = new Set(Array.from(options.excludeRepos ?? []).map(normalizeRepo));
  const limit = options.limit ?? 8;
  const maxPages = options.maxPages ?? 2;
  const maxRequests = options.maxRequests ?? 10;
  const perPage = options.perPage ?? 10;
  const selectionPolicy = options.selectionPolicy;
  const queries = selectionPolicy ? buildCapabilityQueries(now, selectionPolicy) : buildDiscoveryQueries(now);
  let requests = 0;

  for (const query of queries) {
    if (byRepo.size >= limit || requests >= maxRequests) {
      break;
    }
    for (let page = 1; page <= maxPages && byRepo.size < limit && requests < maxRequests; page += 1) {
      const acceptedBeforePage = byRepo.size;
      requests += 1;
      const repos = await client.searchRepos(query, perPage, page);
      for (const repo of repos) {
        if (repo.archived || repo.fork || repo.stargazers_count < 10 || isContentNoiseRepo(repo) || excludeRepos.has(normalizeRepo(repo.full_name))) {
          continue;
        }
        byRepo.set(repo.full_name, repo);
        if (byRepo.size >= limit) {
          break;
        }
      }
      if (repos.length === 0) {
        break;
      }
      if (byRepo.size > acceptedBeforePage) {
        break;
      }
    }
  }
  return [...byRepo.values()].sort((a, b) => compareRepoSearchCandidates(a, b, now, selectionPolicy)).slice(0, limit);
}
