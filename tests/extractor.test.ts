import { describe, expect, test } from "vitest";
import { HeuristicExtractor } from "../src/extraction/heuristicExtractor";
import type { RepoContext } from "../src/types";

describe("heuristic extractor with seed focus", () => {
  test("uses seed focus to produce a repository-specific engineering pattern", async () => {
    const context: RepoContext = {
      run_id: "seed-test",
      repo: "kubernetes/kubernetes",
      url: "https://github.com/kubernetes/kubernetes",
      default_branch: "master",
      commit_sha: "abcdef1234567890abcdef1234567890abcdef12",
      fixture: false,
      metadata: {
        stars: 100000,
        forks: 30000,
        open_issues: 1000,
        language: "Go",
        topics: ["infrastructure"],
        archived: false,
        fork: false,
        pushed_at: "2026-06-11T00:00:00.000Z",
        updated_at: "2026-06-11T00:00:00.000Z",
        created_at: "2014-01-01T00:00:00.000Z",
        releases_count: 5
      },
      tree_summary: ["pkg/controller/controller_utils.go", "staging/src/k8s.io/client-go/tools/cache/controller.go", "cmd/kube-controller-manager/app/core.go"],
      selected_files: [
        {
          path: "pkg/controller/controller_utils.go",
          reason: "controller and reconciliation evidence",
          content: "type Controller struct {}\nfunc (c *Controller) syncHandler() {}\nfunc reconcile() {}\nworkqueue.NewNamedRateLimitingQueue()",
          truncated: false
        },
        {
          path: "pkg/controller/controller_utils_test.go",
          reason: "test verifies controller reconciliation behavior",
          content: "func TestControllerSyncHandler(t *testing.T) { reconcile(); }",
          truncated: false
        }
      ],
      readme_excerpt: "Production-Grade Container Scheduling and Management",
      package_metadata: [],
      fetched_at: "2026-06-11T00:00:00.000Z",
      truncation: { files_truncated: 0, context_truncated: false },
      seed_focus: ["controller_pattern", "reconciliation_loop", "api_boundary", "declarative_state"]
    };

    const [draft] = await new HeuristicExtractor().extractPatterns(context, undefined, new Date("2026-06-11T00:00:00.000Z"));

    expect(draft.frontmatter.id).toContain("reconciliation");
    expect(draft.frontmatter.engineering_problems).toContain("state_management");
    expect(draft.frontmatter.pattern_types).toContain("state_machine");
    expect(draft.frontmatter.source_repos[0].commit).toBe("abcdef1234567890abcdef1234567890abcdef12");
    expect(draft.frontmatter.source_repos[0].reference_files.length).toBeGreaterThanOrEqual(2);
    expect(draft.body).toContain("## Progressive Disclosure");
    expect(draft.body).toContain("10-second triage");
    expect(draft.body).toContain("2-minute transfer check");
    expect(draft.body).toContain("## Retrieval Tags");
    expect(draft.body).toContain("## Evidence Table");
    expect(draft.body).toContain("pkg/controller/controller_utils.go");
    expect(draft.body).toContain("syncHandler");
    expect(draft.body).toContain("Problems: `state_management`, `workflow_orchestration`, `error_recovery`");
    expect(draft.body).toContain("Tags: `controller_pattern`, `reconciliation_loop`, `api_boundary`, `declarative_state`, `seed-focus`");
    expect(draft.body).toContain("reconciliation");
    expect(draft.body).toContain("kubernetes/kubernetes");
  });
});
