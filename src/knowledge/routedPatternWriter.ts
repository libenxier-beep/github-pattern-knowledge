import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { HarnessResult, PatternDraft, PatternFrontmatter, Taxonomy } from "../types";
import { stringifyMarkdown } from "./frontmatter";
import { ensurePatternNavigationSections } from "./retrievalTags";
import { validatePatternMarkdown } from "../harness/patternHarness";
import { ensureDir, writeJson } from "../utils/fs";
import { getKnowledgePaths, getWorkContextsRoot, toKnowledgeRelative, toWorkContextRelative } from "../utils/paths";
import { routePattern, type PatternRoute } from "../routing/knowledgeRouter";
import type { WritePatternOutcome } from "./patternWriter";

export type RoutedPatternOutcome = WritePatternOutcome & {
  route: PatternRoute;
};

function routeDirectory(projectRoot: string, route: PatternRoute, runId: string): string {
  const workContextsRoot = getWorkContextsRoot(projectRoot);
  if (route.disposition === "review_queue") {
    return path.join(workContextsRoot, "github_engineering_patterns", "sources", "runs", runId, "review_queue");
  }
  return path.join(workContextsRoot, route.context, "sources", "runs", runId, "routed_patterns");
}

async function writeRoutedAccepted(
  frontmatter: PatternFrontmatter,
  markdown: string,
  route: PatternRoute,
  projectRoot: string
): Promise<WritePatternOutcome> {
  const filePath = path.join(routeDirectory(projectRoot, route, frontmatter.run_id), `${frontmatter.id}.md`);
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, markdown, "utf8");
  const workContextsRoot = getWorkContextsRoot(projectRoot);
  const file = toWorkContextRelative(filePath, workContextsRoot);
  if (route.disposition === "review_queue") {
    await writeJson(`${filePath}.json`, {
      id: frontmatter.id,
      run_id: frontmatter.run_id,
      route,
      source_repo: frontmatter.source_repos?.[0]?.repo ?? null,
      markdown_file: file
    });
  }
  return {
    accepted: true,
    file,
    result: { valid: true, errors: [], warnings: [], checked_at: new Date().toISOString() },
    id: frontmatter.id
  };
}

export async function writeRoutedPatternDraft(projectRoot: string, draft: PatternDraft, taxonomy: Taxonomy): Promise<RoutedPatternOutcome> {
  const route = routePattern(draft.frontmatter);
  const paths = getKnowledgePaths(projectRoot);
  const frontmatter = draft.frontmatter;
  const body = ensurePatternNavigationSections(draft.body, frontmatter);
  const markdown = stringifyMarkdown(frontmatter as unknown as Record<string, unknown>, body);
  const result: HarnessResult = validatePatternMarkdown(`${frontmatter.id}.md`, markdown, taxonomy);
  if (result.valid) {
    return { ...(await writeRoutedAccepted(frontmatter, markdown, route, projectRoot)), route };
  }

  const rejectedPath = path.join(paths.rejectedPatternsDir, `${frontmatter.run_id}-${frontmatter.id}.md`);
  const metaPath = path.join(paths.rejectedPatternsDir, `${frontmatter.run_id}-${frontmatter.id}.json`);
  await ensureDir(paths.rejectedPatternsDir);
  await writeFile(rejectedPath, markdown, "utf8");
  await writeJson(metaPath, {
    run_id: frontmatter.run_id,
    id: frontmatter.id,
    route,
    source_repo: frontmatter.source_repos?.[0]?.repo ?? null,
    rejected_at: new Date().toISOString(),
    errors: result.errors,
    warnings: result.warnings,
    markdown_file: toKnowledgeRelative(projectRoot, rejectedPath, paths.knowledgeRoot)
  });
  return {
    accepted: false,
    file: toKnowledgeRelative(projectRoot, rejectedPath, paths.knowledgeRoot),
    result,
    id: frontmatter.id,
    route
  };
}
