import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { HarnessResult, PatternDraft, PatternFrontmatter, Taxonomy } from "../types";
import { stringifyMarkdown } from "./frontmatter";
import { ensurePatternNavigationSections } from "./retrievalTags";
import { validatePatternMarkdown } from "../harness/patternHarness";
import { ensureDir, pathExists, writeJson } from "../utils/fs";
import { getKnowledgePaths, shortHash, toKnowledgeRelative } from "../utils/paths";

export type WritePatternOutcome = {
  accepted: boolean;
  file: string;
  result: HarnessResult;
  id: string;
};

function withUniqueId(frontmatter: PatternFrontmatter, projectRoot: string): Promise<PatternFrontmatter> {
  const paths = getKnowledgePaths(projectRoot);
  async function resolve(candidate: PatternFrontmatter): Promise<PatternFrontmatter> {
    const filePath = path.join(paths.patternsDir, `${candidate.id}.md`);
    if (!(await pathExists(filePath))) {
      return candidate;
    }
    const suffix = shortHash(`${candidate.id}-${candidate.run_id}-${Date.now()}`);
    return { ...candidate, id: `${candidate.id}-${suffix}` };
  }
  return resolve(frontmatter);
}

export async function writePatternDraft(projectRoot: string, draft: PatternDraft, taxonomy: Taxonomy): Promise<WritePatternOutcome> {
  const paths = getKnowledgePaths(projectRoot);
  await ensureDir(paths.patternsDir);
  await ensureDir(paths.rejectedPatternsDir);
  const frontmatter = await withUniqueId(draft.frontmatter, projectRoot);
  const body = ensurePatternNavigationSections(draft.body, frontmatter);
  const markdown = stringifyMarkdown(frontmatter as unknown as Record<string, unknown>, body);
  const result = validatePatternMarkdown(`${frontmatter.id}.md`, markdown, taxonomy);

  if (result.valid) {
    const filePath = path.join(paths.patternsDir, `${frontmatter.id}.md`);
    await writeFile(filePath, markdown, "utf8");
    return { accepted: true, file: toKnowledgeRelative(projectRoot, filePath, paths.knowledgeRoot), result, id: frontmatter.id };
  }

  const rejectedPath = path.join(paths.rejectedPatternsDir, `${frontmatter.run_id}-${frontmatter.id}.md`);
  const metaPath = path.join(paths.rejectedPatternsDir, `${frontmatter.run_id}-${frontmatter.id}.json`);
  await writeFile(rejectedPath, markdown, "utf8");
  await writeJson(metaPath, {
    run_id: frontmatter.run_id,
    id: frontmatter.id,
    source_repo: frontmatter.source_repos?.[0]?.repo ?? null,
    rejected_at: new Date().toISOString(),
    errors: result.errors,
    warnings: result.warnings,
    markdown_file: toKnowledgeRelative(projectRoot, rejectedPath, paths.knowledgeRoot)
  });
  return { accepted: false, file: toKnowledgeRelative(projectRoot, rejectedPath, paths.knowledgeRoot), result, id: frontmatter.id };
}
