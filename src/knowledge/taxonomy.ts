import path from "node:path";
import type { Taxonomy } from "../types";
import { readJson } from "../utils/fs";
import { getKnowledgePaths } from "../utils/paths";

export async function loadTaxonomy(projectRoot = process.cwd()): Promise<Taxonomy> {
  const paths = getKnowledgePaths(projectRoot);
  return readJson<Taxonomy>(path.join(paths.schemasDir, "taxonomy.json"));
}

export function isAllowedTaxonomyValue(taxonomy: Taxonomy, axis: keyof Taxonomy, value: string): boolean {
  return taxonomy[axis].includes(value);
}
