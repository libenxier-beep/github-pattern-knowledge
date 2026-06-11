import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildArchiveSummary } from "../src/web/archiveSummary";

describe("archive summary", () => {
  test("combines seed and learned registries so the UI can show duplicate-skip state", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "archive-summary-"));
    const registryDir = path.join(root, "knowledge", "registry");
    await mkdir(registryDir, { recursive: true });
    await writeFile(
      path.join(registryDir, "seed_repos.json"),
      JSON.stringify({
        generated_at: "2026-06-11T00:00:00.000Z",
        seed_count: 2,
        repos: [
          { rank: 1, repo: "owner/learned", url: "https://github.com/owner/learned", priority: "p1", focus: ["adapter"] },
          { rank: 2, repo: "owner/pending", url: "https://github.com/owner/pending", priority: "p2", focus: ["pipeline"] }
        ]
      }),
      "utf8"
    );
    await writeFile(
      path.join(registryDir, "learned_repos.json"),
      JSON.stringify({
        generated_at: "2026-06-11T01:00:00.000Z",
        learned_count: 1,
        repos: [
          {
            repo: "owner/learned",
            url: "https://github.com/owner/learned",
            learned_at: "2026-06-11T01:00:00.000Z",
            run_id: "seed-run",
            pattern_files: ["/tmp/pattern.md"]
          }
        ]
      }),
      "utf8"
    );

    const summary = await buildArchiveSummary(root);

    expect(summary.seed_count).toBe(2);
    expect(summary.learned_count).toBe(1);
    expect(summary.pending_count).toBe(1);
    expect(summary.skip_rule).toContain("learned_repos.json");
    expect(summary.repos.map((repo) => [repo.repo, repo.status])).toEqual([
      ["owner/learned", "learned"],
      ["owner/pending", "pending"]
    ]);
    expect(summary.repos[0].pattern_count).toBe(1);
  });
});
