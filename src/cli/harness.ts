import path from "node:path";
import { readFile } from "node:fs/promises";
import { ensureKnowledgeScaffold } from "../knowledge/scaffold";
import { loadTaxonomy } from "../knowledge/taxonomy";
import { validateCardMarkdown, validatePatternMarkdown } from "../harness/patternHarness";
import { validateRunLocatorIntegrity } from "../harness/runLocatorIntegrity";
import { validateKnowledgeAuthorityIntegrity } from "../harness/knowledgeAuthorityIntegrity";
import { listMarkdownFiles } from "../utils/fs";
import { getKnowledgePaths, toProjectRelative } from "../utils/paths";

await ensureKnowledgeScaffold(process.cwd());
const paths = getKnowledgePaths(process.cwd());
const taxonomy = await loadTaxonomy(process.cwd());
const target = process.argv[2];
const files = target
  ? [path.resolve(process.cwd(), target)]
  : [...(await listMarkdownFiles(paths.patternsDir)), ...(await listMarkdownFiles(paths.cardsDir))];

function isInsideDir(dir: string, file: string): boolean {
  const relative = path.relative(dir, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

let failures = 0;
const results = [];
for (const file of files) {
  const markdown = await readFile(file, "utf8");
  const relative = toProjectRelative(process.cwd(), file);
  const result = isInsideDir(paths.cardsDir, file)
    ? validateCardMarkdown(path.basename(file), markdown)
    : validatePatternMarkdown(path.basename(file), markdown, taxonomy);
  if (!result.valid) {
    failures += 1;
  }
  results.push({ file: relative, ...result });
}

const runLocatorIntegrity = target ? undefined : await validateRunLocatorIntegrity(process.cwd());
if (runLocatorIntegrity && !runLocatorIntegrity.valid) {
  failures += 1;
}
const knowledgeAuthorityIntegrity = target ? undefined : await validateKnowledgeAuthorityIntegrity(process.cwd());
if (knowledgeAuthorityIntegrity && !knowledgeAuthorityIntegrity.valid) {
  failures += 1;
}

console.log(JSON.stringify({
  checked: results.length,
  failures,
  results,
  run_locator_integrity: runLocatorIntegrity,
  knowledge_authority_integrity: knowledgeAuthorityIntegrity
}, null, 2));
if (failures > 0) {
  process.exitCode = 1;
}
