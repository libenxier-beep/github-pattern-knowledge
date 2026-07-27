import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { validateKnowledgeAuthorityIntegrity } from "../src/harness/knowledgeAuthorityIntegrity";

function pattern(id: string, repo: string, related: string[] = [], body = "# Pattern\n"): string {
  return `---
id: ${id}
source_repos:
  - repo: ${repo}
related_patterns:
${related.length ? related.map((item) => `  - ${item}`).join("\n") : "  []"}
---

${body}`;
}

describe("knowledge authority integrity", () => {
  test("fails closed on non-accepted active sources, stale relations, missing registry files, and local paths", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "knowledge-authority-invalid-"));
    const knowledgeRoot = path.join(projectRoot, "knowledge");
    await mkdir(path.join(knowledgeRoot, "patterns"), { recursive: true });
    await mkdir(path.join(knowledgeRoot, "cards"), { recursive: true });
    await mkdir(path.join(knowledgeRoot, "registry"), { recursive: true });
    await writeFile(
      path.join(knowledgeRoot, "patterns", "active.md"),
      pattern("pattern-active", "owner/legacy", ["pattern-archived"], "# Pattern\n\nSee /tmp/private/source.ts.\n"),
      "utf8"
    );
    await writeFile(
      path.join(knowledgeRoot, "cards", "legacy.md"),
      "---\nsource_repo: owner/legacy\n---\n\n# Legacy card\n",
      "utf8"
    );
    await writeFile(path.join(knowledgeRoot, "registry", "learned_repos.json"), `${JSON.stringify({
      generated_at: "2026-07-25T00:00:00.000Z",
      learned_count: 1,
      repos: [
        { repo: "owner/legacy", status: "legacy_unreviewed", pattern_files: [] },
        { repo: "owner/accepted", status: "accepted", pattern_files: ["knowledge/patterns/missing.md"] }
      ]
    }, null, 2)}\n`, "utf8");

    const result = await validateKnowledgeAuthorityIntegrity(projectRoot);

    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.reason)).toEqual(expect.arrayContaining([
      "active_source_repo_not_accepted",
      "active_card_source_repo_not_accepted",
      "related_pattern_unresolved",
      "accepted_registry_file_missing",
      "absolute_local_path_in_active_artifact"
    ]));
  });

  test("accepts active sources backed by accepted registry state and explicit routed relations", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "knowledge-authority-valid-"));
    const knowledgeRoot = path.join(projectRoot, "knowledge");
    const activePattern = path.join(knowledgeRoot, "patterns", "active.md");
    const activeCard = path.join(knowledgeRoot, "cards", "active.md");
    const routedPattern = path.join(
      projectRoot,
      "work_contexts",
      "loop_harness_engineering",
      "sources",
      "runs",
      "run-1",
      "routed_patterns",
      "routed.md"
    );
    await mkdir(path.dirname(activePattern), { recursive: true });
    await mkdir(path.dirname(activeCard), { recursive: true });
    await mkdir(path.dirname(routedPattern), { recursive: true });
    await mkdir(path.join(knowledgeRoot, "registry"), { recursive: true });
    await writeFile(activePattern, pattern("pattern-active", "owner/accepted", ["pattern-routed"]), "utf8");
    await writeFile(activeCard, "---\nsource_repo: owner/accepted\n---\n\n# Accepted card\n", "utf8");
    await writeFile(routedPattern, pattern("pattern-routed", "owner/accepted"), "utf8");
    await writeFile(path.join(knowledgeRoot, "registry", "learned_repos.json"), `${JSON.stringify({
      generated_at: "2026-07-25T00:00:00.000Z",
      learned_count: 1,
      repos: [{
        repo: "owner/accepted",
        status: "accepted",
        pattern_files: ["knowledge/patterns/active.md"]
      }]
    }, null, 2)}\n`, "utf8");

    const result = await validateKnowledgeAuthorityIntegrity(projectRoot);

    expect(result).toMatchObject({
      valid: true,
      checked_active_patterns: 1,
      checked_active_cards: 1,
      checked_related_patterns: 1
    });
    expect(result.issues).toEqual([]);
  });
});
