import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getKnowledgePaths, getWorkContextsRoot } from "../src/utils/paths";

describe("knowledge authority path resolution", () => {
  test("keeps an identified tool checkout bound to canonical Work Context roots", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "gpk-paths-"));
    await writeFile(
      path.join(projectRoot, "REPOSITORY.md"),
      "---\nschema_version: 1\nrepository_id: github-pattern-knowledge\n---\n",
      "utf8"
    );
    const previousKnowledgeRoot = process.env.KNOWLEDGE_ROOT;
    const previousWorkContextsRoot = process.env.WORK_CONTEXTS_ROOT;

    delete process.env.KNOWLEDGE_ROOT;
    delete process.env.WORK_CONTEXTS_ROOT;
    try {
      const workContextsRoot = path.join(os.homedir(), ".codex", "memories", "work_contexts");
      expect(getKnowledgePaths(projectRoot).knowledgeRoot).toBe(
        path.join(workContextsRoot, "github_engineering_patterns")
      );
      expect(getWorkContextsRoot(projectRoot)).toBe(workContextsRoot);
    } finally {
      if (previousKnowledgeRoot === undefined) delete process.env.KNOWLEDGE_ROOT;
      else process.env.KNOWLEDGE_ROOT = previousKnowledgeRoot;
      if (previousWorkContextsRoot === undefined) delete process.env.WORK_CONTEXTS_ROOT;
      else process.env.WORK_CONTEXTS_ROOT = previousWorkContextsRoot;
    }
  });
});
