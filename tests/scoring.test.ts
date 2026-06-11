import { describe, expect, test } from "vitest";
import { scoreRepoContext } from "../src/scoring/scoreRepo";
import type { RepoContext } from "../src/types";

const context: RepoContext = {
  run_id: "run-2026-06-11-001",
  repo: "owner/project",
  url: "https://github.com/owner/project",
  default_branch: "main",
  commit_sha: "1111111111111111111111111111111111111111",
  fixture: false,
  metadata: {
    stars: 4000,
    forks: 350,
    open_issues: 50,
    language: "TypeScript",
    topics: ["cli", "developer-tools"],
    archived: false,
    fork: false,
    pushed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_at: "2021-01-01T00:00:00.000Z"
  },
  tree_summary: [
    "src/index.ts",
    "src/plugins/registry.ts",
    "tests/registry.test.ts",
    "docs/plugins.md",
    "examples/basic.ts",
    ".github/workflows/ci.yml",
    "package.json"
  ],
  selected_files: [],
  readme_excerpt: "A maintained developer tool with plugin lifecycle docs.",
  package_metadata: [{ path: "package.json", excerpt: "{\"scripts\":{\"test\":\"vitest\"}}" }],
  fetched_at: new Date().toISOString(),
  truncation: { files_truncated: 0, context_truncated: false }
};

describe("repo scoring", () => {
  test("weights engineering quality above heat and preserves score breakdowns", () => {
    const score = scoreRepoContext(context, new Date());

    expect(score.repo).toBe("owner/project");
    expect(score.total_score).toBeCloseTo(
      score.engineering_quality.score * 0.5 + score.long_term_impact.score * 0.3 + score.recent_heat.score * 0.2,
      5
    );
    expect(score.engineering_quality.score).toBeGreaterThan(score.recent_heat.score - 10);
    expect(score.engineering_quality.signals.has_tests).toBe(true);
    expect(score.engineering_quality.signals.has_ci).toBe(true);
  });
});
