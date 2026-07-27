import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { getKnowledgePaths, getWorkContextsRoot, toProjectRelative } from "../utils/paths";
import { canonicalizePortableLocator } from "../deepDive/valueFunction";

export type RunLocatorIssue = {
  run_file: string;
  field: string;
  locator: string;
  reason: "missing" | "unsafe_relative_path" | "absolute_path_forbidden";
};

export type RunJsonIssue = {
  run_file: string;
  error: string;
};

export type RunLocatorShapeIssue = {
  run_file: string;
  field: string;
  expected: string;
  actual: string;
};

export type RunLocatorIntegrityResult = {
  valid: boolean;
  checked_records: number;
  checked_locators: number;
  missing: RunLocatorIssue[];
  parse_errors: RunJsonIssue[];
  shape_errors: RunLocatorShapeIssue[];
};

type Locator = { field: string; locator: string };
type LocatorShape = Omit<RunLocatorShapeIssue, "run_file">;

const ARRAY_LOCATOR_FIELDS = new Set([
  "added_patterns",
  "promoted_patterns",
  "rejected_patterns",
  "updated_indexes",
  "learned_files",
  "audit_files",
  "index_files",
  "evidence_files"
]);

const SCALAR_LOCATOR_FIELDS = new Set([
  "generated_card",
  "source_snapshot",
  "checkout_receipt_file",
  "report_file",
  "source_audit",
  "receipt_file",
  "superseded_by",
  "run_file"
]);

const NULLABLE_SCALAR_LOCATOR_FIELDS = new Set(["generated_card", "source_snapshot"]);

async function listJsonFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return listJsonFiles(file);
    return entry.isFile() && entry.name.endsWith(".json") ? [file] : [];
  }));
  return nested.flat().sort();
}

function valueShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function collectLocators(
  value: unknown,
  trail: string[] = [],
  output: Locator[] = [],
  shapeErrors: LocatorShape[] = []
): Locator[] {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLocators(item, [...trail, String(index)], output, shapeErrors));
    return output;
  }

  for (const [key, child] of Object.entries(value)) {
    const field = [...trail, key];
    if (SCALAR_LOCATOR_FIELDS.has(key)) {
      if (typeof child === "string" && child.trim()) {
        output.push({ field: field.join("."), locator: child });
      } else if (child === null && NULLABLE_SCALAR_LOCATOR_FIELDS.has(key)) {
        // Preparation-only runs explicitly use null when no artifact has been published yet.
      } else {
        shapeErrors.push({ field: field.join("."), expected: "non-empty string", actual: valueShape(child) });
      }
    }
    if (ARRAY_LOCATOR_FIELDS.has(key)) {
      if (!Array.isArray(child)) {
        shapeErrors.push({ field: field.join("."), expected: "array of non-empty strings", actual: valueShape(child) });
      } else {
        child.forEach((item, index) => {
          const itemField = [...field, String(index)].join(".");
          if (typeof item === "string" && item.trim()) {
            output.push({ field: itemField, locator: item });
          } else {
            shapeErrors.push({ field: itemField, expected: "non-empty string", actual: valueShape(item) });
          }
        });
      }
    }
    if (key === "routed_patterns") {
      if (!Array.isArray(child)) {
        shapeErrors.push({ field: field.join("."), expected: "array of objects with file", actual: valueShape(child) });
      } else {
        child.forEach((item, index) => {
          const itemField = [...field, String(index), "file"].join(".");
          const locator = item && typeof item === "object" && !Array.isArray(item) && "file" in item ? item.file : undefined;
          if (typeof locator === "string" && locator.trim()) {
            output.push({ field: itemField, locator });
          } else {
            shapeErrors.push({ field: itemField, expected: "non-empty string", actual: valueShape(locator) });
          }
        });
      }
    }
    if (key === "rejected_daily_patterns_not_removed") {
      if (!Array.isArray(child)) {
        shapeErrors.push({ field: field.join("."), expected: "array of objects with pattern", actual: valueShape(child) });
      } else {
        child.forEach((item, index) => {
          const itemField = [...field, String(index), "pattern"].join(".");
          const locator = item && typeof item === "object" && !Array.isArray(item) && "pattern" in item ? item.pattern : undefined;
          if (typeof locator === "string" && locator.trim()) {
            output.push({ field: itemField, locator });
          } else {
            shapeErrors.push({ field: itemField, expected: "non-empty string", actual: valueShape(locator) });
          }
        });
      }
    }
    collectLocators(child, field, output, shapeErrors);
  }
  return output;
}

function locatorTarget(projectRoot: string, locator: string): { file: string; authorityRoot: string } | null {
  const parsed = canonicalizePortableLocator(locator);
  if (!parsed.safe || !parsed.canonical_form) return null;
  const normalized = parsed.canonical;
  const knowledgeRoot = getKnowledgePaths(projectRoot).knowledgeRoot;
  const workContextsRoot = getWorkContextsRoot(projectRoot);
  if (normalized.startsWith("work_contexts/")) {
    return {
      file: path.resolve(workContextsRoot, normalized.slice("work_contexts/".length)),
      authorityRoot: path.resolve(workContextsRoot)
    };
  }
  if (normalized.startsWith(`${path.basename(knowledgeRoot)}/`)) {
    return {
      file: path.resolve(knowledgeRoot, normalized.slice(path.basename(knowledgeRoot).length + 1)),
      authorityRoot: path.resolve(knowledgeRoot)
    };
  }
  return {
    file: path.resolve(workContextsRoot, normalized),
    authorityRoot: path.resolve(workContextsRoot)
  };
}

async function isFileWithin(file: string, authorityRoot: string): Promise<boolean> {
  try {
    if (!(await stat(file)).isFile()) return false;
    const [actualFile, actualRoot] = await Promise.all([realpath(file), realpath(authorityRoot)]);
    return actualFile === actualRoot || actualFile.startsWith(`${actualRoot}${path.sep}`);
  } catch {
    return false;
  }
}

export async function validateRunLocatorIntegrity(projectRoot = process.cwd()): Promise<RunLocatorIntegrityResult> {
  const root = path.resolve(projectRoot);
  const runFiles = await listJsonFiles(getKnowledgePaths(root).runsDir);
  const missing: RunLocatorIssue[] = [];
  const parseErrors: RunJsonIssue[] = [];
  const shapeErrors: RunLocatorShapeIssue[] = [];
  let checkedLocators = 0;

  for (const runFile of runFiles) {
    const portableRunFile = toProjectRelative(root, runFile);
    let record: unknown;
    try {
      record = JSON.parse(await readFile(runFile, "utf8"));
    } catch (error) {
      parseErrors.push({ run_file: portableRunFile, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      shapeErrors.push({
        run_file: portableRunFile,
        field: "$",
        expected: "object",
        actual: valueShape(record)
      });
      continue;
    }
    const recordShapeErrors: LocatorShape[] = [];
    const locators = collectLocators(record, [], [], recordShapeErrors);
    shapeErrors.push(...recordShapeErrors.map((issue) => ({ run_file: portableRunFile, ...issue })));
    for (const item of locators) {
      checkedLocators += 1;
      if (path.isAbsolute(item.locator) || path.win32.isAbsolute(item.locator)) {
        missing.push({ run_file: portableRunFile, field: item.field, locator: item.locator, reason: "absolute_path_forbidden" });
        continue;
      }
      const target = locatorTarget(root, item.locator);
      if (!target) {
        missing.push({ run_file: portableRunFile, field: item.field, locator: item.locator, reason: "unsafe_relative_path" });
        continue;
      }
      if (!(await isFileWithin(target.file, target.authorityRoot))) {
        missing.push({ run_file: portableRunFile, field: item.field, locator: item.locator, reason: "missing" });
      }
    }
  }

  return {
    valid: missing.length === 0 && parseErrors.length === 0 && shapeErrors.length === 0,
    checked_records: runFiles.length,
    checked_locators: checkedLocators,
    missing,
    parse_errors: parseErrors,
    shape_errors: shapeErrors
  };
}
