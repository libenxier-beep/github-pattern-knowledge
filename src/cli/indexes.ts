import { ensureKnowledgeScaffold } from "../knowledge/scaffold";
import { generateIndexes } from "../indexes/generateIndexes";
import { validateKnowledgeAuthorityIntegrity } from "../harness/knowledgeAuthorityIntegrity";
import { getKnowledgePaths } from "../utils/paths";

await ensureKnowledgeScaffold(process.cwd());
const authority = await validateKnowledgeAuthorityIntegrity(process.cwd());
if (!authority.valid) {
  throw new Error(`Knowledge authority integrity failed: ${JSON.stringify(authority.issues)}`);
}
const paths = getKnowledgePaths(process.cwd());
const result = await generateIndexes({
  projectRoot: process.cwd(),
  patternsDir: paths.patternsDir,
  indexesDir: paths.indexesDir,
  knowledgeRoot: paths.knowledgeRoot
});
console.log(JSON.stringify({ written_files: result.written_files, pattern_count: result.index.pattern_count }, null, 2));
