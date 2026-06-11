import { ensureKnowledgeScaffold } from "../knowledge/scaffold";
import { generateIndexes } from "../indexes/generateIndexes";
import { getKnowledgePaths } from "../utils/paths";

await ensureKnowledgeScaffold(process.cwd());
const paths = getKnowledgePaths(process.cwd());
const result = await generateIndexes({
  projectRoot: process.cwd(),
  patternsDir: paths.patternsDir,
  indexesDir: paths.indexesDir
});
console.log(JSON.stringify({ written_files: result.written_files, pattern_count: result.index.pattern_count }, null, 2));
