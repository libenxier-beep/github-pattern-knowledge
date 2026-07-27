import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";
import { readJson, pathExists, writeJson } from "../utils/fs";
import { getKnowledgePaths, getWorkContextsRoot, toKnowledgeRelative, toWorkContextRelative } from "../utils/paths";
import { assessHumanReportReadability } from "../deepDive/reportReadability";
import {
  canonicalizePortableLocator,
  scoreDeepDiveManifest,
  type DeepDiveManifest,
  type ValueGateResult
} from "../deepDive/valueFunction";
import { markRepoLearned, readLearnedRepoRegistry } from "../knowledge/repoRegistry";
import { loadTaxonomy } from "../knowledge/taxonomy";
import { validatePatternMarkdown } from "../harness/patternHarness";
import type { LocalRepoReceipt } from "../deepDive/localRepo";
import { acquireDailyFileLock } from "./daily";

const execFile = promisify(execFileCallback);
const ACCEPTED_KINDS = new Set(["canonical_loop", "implementation_detail", "context_pattern"]);

type ReaderReviewReceipt = {
  reviewer_role?: unknown;
  verdict?: unknown;
  reviewed_report_file?: unknown;
  reviewed_canonical_unit_id?: unknown;
  answers?: {
    project_problem?: unknown;
    primary_sequence?: unknown;
    worked_example?: unknown;
    counterfactual?: unknown;
    adjacent_composition?: unknown;
    canonical_alignment?: unknown;
    core_paradigms?: unknown;
  };
};

type ReaderCoreParadigmReview = {
  paradigm_id?: unknown;
  importance?: unknown;
  design_reasoning?: unknown;
  mechanism?: unknown;
  benefits_and_cleverness?: unknown;
  tradeoffs_and_limits?: unknown;
  source_and_canonical_alignment?: unknown;
};

export type FinalizeDeepDiveOptions = {
  projectRoot: string;
  manifestPath: string;
};

export type FinalizeDeepDiveResult = ValueGateResult & {
  receipt_file: string;
  learned_files: string[];
};

function resolveArtifact(root: string, relativeFile: string): string {
  const locator = canonicalizePortableLocator(relativeFile);
  if (!locator.safe || !locator.canonical_form) {
    throw new Error(`Deep-dive artifact locator is not canonical: ${relativeFile}`);
  }
  const portablePrefix = `work_contexts${path.posix.sep}`;
  const workContextRelative = locator.canonical.startsWith(portablePrefix)
    ? locator.canonical.slice(portablePrefix.length)
    : locator.canonical;
  const resolved = path.resolve(root, workContextRelative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Deep-dive artifact escapes Work Context root: ${relativeFile}`);
  }
  return resolved;
}

function resolveSourceFile(
  workContextsRoot: string,
  knowledgeRoot: string,
  sourcesDir: string,
  locatorValue: string,
  label: string
): string {
  const locator = canonicalizePortableLocator(locatorValue);
  if (!locator.safe || !locator.canonical_form) {
    throw new Error(`Deep-dive ${label} locator is not canonical: ${locatorValue}`);
  }
  const knowledgePrefix = `${path.basename(knowledgeRoot)}/`;
  const workContextsPrefix = "work_contexts/";
  const resolved = locator.canonical.startsWith(knowledgePrefix)
    ? path.resolve(knowledgeRoot, locator.canonical.slice(knowledgePrefix.length))
    : locator.canonical.startsWith(workContextsPrefix)
      ? path.resolve(workContextsRoot, locator.canonical.slice(workContextsPrefix.length))
      : path.resolve(workContextsRoot, locator.canonical);
  const sourceRoot = path.resolve(sourcesDir);
  if (resolved !== sourceRoot && !resolved.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error(`Deep-dive ${label} escapes source authority: ${locatorValue}`);
  }
  return resolved;
}

async function isRegularFileWithin(file: string, authorityRoot: string): Promise<boolean> {
  try {
    if (!(await stat(file)).isFile()) return false;
    const [actualFile, actualRoot] = await Promise.all([realpath(file), realpath(authorityRoot)]);
    return actualFile.startsWith(`${actualRoot}${path.sep}`);
  } catch {
    return false;
  }
}

async function evidenceMatchesPinnedCommit(
  checkoutPath: string,
  commit: string,
  file: string
): Promise<boolean> {
  try {
    const { stdout: treeOutput } = await execFile("git", [
      "-C",
      checkoutPath,
      "ls-tree",
      "-r",
      "-z",
      commit,
      "--",
      `:(literal)${file}`
    ]);
    const entries = treeOutput.split("\0").filter(Boolean);
    if (entries.length !== 1) return false;
    const separator = entries[0].indexOf("\t");
    if (separator < 0 || entries[0].slice(separator + 1) !== file) return false;
    const [mode, type, objectId] = entries[0].slice(0, separator).split(/\s+/);
    if (!mode || type !== "blob" || !/^[a-f0-9]{40,64}$/i.test(objectId ?? "")) return false;

    const { stdout: workingObjectId } = await execFile("git", [
      "-C",
      checkoutPath,
      "hash-object",
      `--path=${file}`,
      "--",
      file
    ]);
    return workingObjectId.trim().toLowerCase() === objectId.toLowerCase();
  } catch {
    return false;
  }
}

function normalizeRepo(value: string): string {
  return value
    .trim()
    .replace(/^git\+/, "")
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^ssh:\/\/git@github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

type SourceRun = {
  run_id?: unknown;
  status?: unknown;
  fixture?: unknown;
  selected_repo?: { repo?: unknown };
  source_snapshot?: unknown;
  [key: string]: unknown;
};

async function requireBoundSourceRun(
  manifest: DeepDiveManifest,
  workContextsRoot: string,
  knowledgeRoot: string,
  sourcesDir: string,
  currentRunPath: string,
  failedRunPath: string
): Promise<{ existing: SourceRun; existingRunPath: string }> {
  const existingRunPath = (await pathExists(currentRunPath))
    ? currentRunPath
    : (await pathExists(failedRunPath))
      ? failedRunPath
      : null;
  if (!existingRunPath) throw new Error(`Deep-dive source run missing: ${manifest.run_id}`);

  const existing = await readJson<SourceRun>(existingRunPath);
  if (existing.run_id !== manifest.run_id) throw new Error("Deep-dive source run id mismatch");
  if (existing.fixture !== false) throw new Error("Deep-dive source run must be non-fixture");
  if (existing.status !== "failed" && existing.status !== "success") {
    throw new Error("Deep-dive source run status invalid");
  }
  const selectedRepo = existing.selected_repo?.repo;
  if (typeof selectedRepo !== "string" || normalizeRepo(selectedRepo) !== normalizeRepo(manifest.repo)) {
    throw new Error("Deep-dive source run repository mismatch");
  }
  if (typeof existing.source_snapshot !== "string" || existing.source_snapshot.trim().length === 0) {
    throw new Error("Deep-dive source snapshot missing");
  }

  const snapshotPath = resolveSourceFile(
    workContextsRoot,
    knowledgeRoot,
    sourcesDir,
    existing.source_snapshot,
    "source snapshot"
  );
  if (!(await isRegularFileWithin(snapshotPath, sourcesDir))) {
    throw new Error(`Deep-dive source snapshot missing: ${existing.source_snapshot}`);
  }
  const snapshot = await readJson<{ run_id?: unknown; repo?: unknown; commit_sha?: unknown; fixture?: unknown }>(snapshotPath);
  if (snapshot.run_id !== manifest.run_id) throw new Error("Deep-dive source snapshot run id mismatch");
  if (snapshot.fixture !== false) throw new Error("Deep-dive source snapshot must be non-fixture");
  if (typeof snapshot.repo !== "string" || normalizeRepo(snapshot.repo) !== normalizeRepo(manifest.repo)) {
    throw new Error("Deep-dive source snapshot repository mismatch");
  }
  if (snapshot.commit_sha !== manifest.commit) throw new Error("Deep-dive source snapshot commit mismatch");

  return { existing, existingRunPath };
}

async function requirePinnedCheckout(
  manifest: DeepDiveManifest,
  workContextsRoot: string,
  knowledgeRoot: string,
  sourcesDir: string
): Promise<{ receiptPath: string; checkoutPath: string }> {
  const receiptPath = resolveSourceFile(
    workContextsRoot,
    knowledgeRoot,
    sourcesDir,
    manifest.checkout_receipt_file,
    "checkout receipt"
  );
  if (!(await isRegularFileWithin(receiptPath, sourcesDir))) {
    throw new Error(`Deep-dive checkout receipt missing: ${manifest.checkout_receipt_file}`);
  }
  const receipt = await readJson<Partial<LocalRepoReceipt>>(receiptPath);
  if (
    typeof receipt.repo !== "string" ||
    typeof receipt.url !== "string" ||
    normalizeRepo(receipt.repo) !== normalizeRepo(manifest.repo) ||
    normalizeRepo(receipt.url) !== normalizeRepo(manifest.repo)
  ) {
    throw new Error("Deep-dive checkout receipt repository mismatch");
  }
  if (receipt.commit !== manifest.commit) {
    throw new Error("Deep-dive checkout receipt commit mismatch");
  }
  if (typeof receipt.checkout_path !== "string" || !path.isAbsolute(receipt.checkout_path)) {
    throw new Error("Deep-dive checkout receipt path invalid");
  }
  const checkoutPath = await realpath(receipt.checkout_path).catch(() => "");
  if (!checkoutPath || !(await stat(checkoutPath).catch(() => null))?.isDirectory()) {
    throw new Error("Deep-dive pinned checkout missing");
  }
  let actualCommit = "";
  let actualOrigin = "";
  let checkoutStatus = "";
  try {
    ({ stdout: actualCommit } = await execFile("git", ["-C", checkoutPath, "rev-parse", "HEAD"]));
    ({ stdout: actualOrigin } = await execFile("git", ["-C", checkoutPath, "remote", "get-url", "origin"]));
    ({ stdout: checkoutStatus } = await execFile("git", [
      "-C", checkoutPath, "status", "--porcelain=v1", "--untracked-files=all"
    ]));
  } catch {
    throw new Error("Deep-dive pinned checkout is not a verifiable Git repository");
  }
  if (actualCommit.trim().toLowerCase() !== manifest.commit.toLowerCase()) {
    throw new Error("Deep-dive pinned checkout commit mismatch");
  }
  if (normalizeRepo(actualOrigin) !== normalizeRepo(manifest.repo)) {
    throw new Error("Deep-dive pinned checkout repository mismatch");
  }
  if (checkoutStatus.trim()) {
    throw new Error("Deep-dive pinned checkout is dirty");
  }
  return { receiptPath, checkoutPath };
}

function evidenceFile(reference: string): string | null {
  const locator = canonicalizePortableLocator(reference.split("#", 1)[0] ?? "");
  return locator.safe && locator.canonical_form ? locator.canonical : null;
}

function declaredEvidenceFile(reference: unknown): string | null {
  if (typeof reference !== "string" || reference.includes("#")) return null;
  const locator = canonicalizePortableLocator(reference);
  return locator.safe && locator.canonical_form ? locator.canonical : null;
}

function frontmatter(markdown: string): Record<string, unknown> | null {
  if (!markdown.startsWith("---\n")) return null;
  const end = markdown.indexOf("\n---", 4);
  if (end < 0) return null;
  try {
    const value = parseYaml(markdown.slice(4, end));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function markdownSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return "";
  const section: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) break;
    section.push(lines[index]);
  }
  return section.join("\n").trim();
}

async function requirePrimaryValueEvidence(
  manifest: DeepDiveManifest,
  checkoutPath: string
): Promise<void> {
  const evidenceFiles = manifest.primary_value_thesis.evidence_refs.map(evidenceFile);
  if (evidenceFiles.some((file) => file === null)) {
    throw new Error("Deep-dive primary value evidence locator invalid");
  }
  for (const file of evidenceFiles as string[]) {
    if (!(await isRegularFileWithin(path.resolve(checkoutPath, file), checkoutPath))) {
      throw new Error(`Deep-dive primary value evidence missing from pinned checkout: ${file}`);
    }
    if (!(await evidenceMatchesPinnedCommit(checkoutPath, manifest.commit, file))) {
      throw new Error(`Deep-dive primary value evidence does not match pinned commit: ${file}`);
    }
  }
  for (const paradigm of manifest.primary_value_thesis.core_functional_paradigms) {
    const paradigmEvidenceFiles = paradigm.evidence_refs.map(evidenceFile);
    if (paradigmEvidenceFiles.some((file) => file === null)) {
      throw new Error(`Deep-dive core paradigm evidence locator invalid: ${paradigm.id}`);
    }
    for (const file of paradigmEvidenceFiles as string[]) {
      if (!(await isRegularFileWithin(path.resolve(checkoutPath, file), checkoutPath))) {
        throw new Error(`Deep-dive core paradigm evidence missing from pinned checkout: ${paradigm.id}:${file}`);
      }
      if (!(await evidenceMatchesPinnedCommit(checkoutPath, manifest.commit, file))) {
        throw new Error(`Deep-dive core paradigm evidence does not match pinned commit: ${paradigm.id}:${file}`);
      }
    }
  }
}

async function requireEvidenceAndArtifactProvenance(
  manifest: DeepDiveManifest,
  checkoutPath: string,
  workContextsRoot: string
): Promise<void> {
  for (const unit of manifest.units.filter((item) => ACCEPTED_KINDS.has(item.kind))) {
    const evidenceFiles = unit.evidence_refs.map(evidenceFile);
    if (evidenceFiles.some((file) => file === null)) {
      throw new Error(`Deep-dive evidence locator invalid: ${unit.id}`);
    }
    for (const file of evidenceFiles as string[]) {
      if (!(await isRegularFileWithin(path.resolve(checkoutPath, file), checkoutPath))) {
        throw new Error(`Deep-dive evidence missing from pinned checkout: ${unit.id}:${file}`);
      }
      if (!(await evidenceMatchesPinnedCommit(checkoutPath, manifest.commit, file))) {
        throw new Error(`Deep-dive evidence does not match pinned commit: ${unit.id}:${file}`);
      }
    }

    const artifactPath = resolveArtifact(workContextsRoot, unit.artifact_file);
    const metadata = frontmatter(await readFile(artifactPath, "utf8"));
    const sourceRepos = Array.isArray(metadata?.source_repos) ? metadata.source_repos : [];
    const matchingSources = sourceRepos.filter((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
      const record = candidate as Record<string, unknown>;
      return typeof record.repo === "string" &&
        normalizeRepo(record.repo) === normalizeRepo(manifest.repo) &&
        record.commit === manifest.commit;
    }) as Record<string, unknown>[];
    if (sourceRepos.length !== 1 || matchingSources.length !== 1) {
      throw new Error(`Deep-dive artifact provenance mismatch: ${unit.id}`);
    }
    const matchingSource = matchingSources[0];
    const rawDeclaredReferences = Array.isArray(matchingSource.reference_files) ? matchingSource.reference_files : [];
    const declaredFiles = rawDeclaredReferences.map(declaredEvidenceFile);
    if (declaredFiles.some((file) => file === null)) {
      throw new Error(`Deep-dive artifact provenance mismatch: ${unit.id}`);
    }
    const manifestFiles = evidenceFiles as string[];
    const manifestSet = new Set(manifestFiles);
    const declaredSet = new Set(declaredFiles as string[]);
    if (
      manifestSet.size < 2 ||
      declaredSet.size !== declaredFiles.length ||
      manifestSet.size !== declaredSet.size ||
      ![...manifestSet].every((file) => declaredSet.has(file))
    ) {
      throw new Error(`Deep-dive artifact provenance mismatch: ${unit.id}`);
    }
    for (const file of declaredSet) {
      if (!(await isRegularFileWithin(path.resolve(checkoutPath, file), checkoutPath))) {
        throw new Error(`Deep-dive artifact provenance mismatch: ${unit.id}`);
      }
    }
  }
}

async function requireCoreParadigmsPersisted(
  manifest: DeepDiveManifest,
  workContextsRoot: string
): Promise<void> {
  const canonicalUnits = new Map(
    manifest.units
      .filter((unit) => unit.kind === "canonical_loop")
      .map((unit) => [unit.id, unit])
  );
  const artifactCache = new Map<string, { metadata: Record<string, unknown> | null; coreSection: string }>();

  for (const paradigm of manifest.primary_value_thesis.core_functional_paradigms) {
    const unit = canonicalUnits.get(paradigm.canonical_unit_id);
    if (!unit) {
      throw new Error(`Deep-dive core paradigm canonical unit missing: ${paradigm.id}`);
    }
    let artifact = artifactCache.get(unit.artifact_file);
    if (!artifact) {
      const markdown = await readFile(resolveArtifact(workContextsRoot, unit.artifact_file), "utf8");
      artifact = {
        metadata: frontmatter(markdown),
        coreSection: markdownSection(markdown, "Core Functional Paradigm")
      };
      artifactCache.set(unit.artifact_file, artifact);
    }
    const declaredIds = Array.isArray(artifact.metadata?.core_functional_paradigm_ids)
      ? artifact.metadata.core_functional_paradigm_ids.filter((value): value is string => typeof value === "string")
      : [];
    if (!declaredIds.includes(paradigm.id)) {
      throw new Error(
        `Deep-dive canonical Work Context artifact does not declare core paradigm: ${paradigm.id}`
      );
    }
    if (artifact.coreSection.replace(/\s+/g, "").length < 160) {
      throw new Error(
        `Deep-dive canonical Work Context artifact does not explain core paradigm: ${paradigm.id}`
      );
    }
  }
}

async function requireAcceptedArtifactsPassHarness(
  manifest: DeepDiveManifest,
  projectRoot: string,
  workContextsRoot: string
): Promise<void> {
  const taxonomy = await loadTaxonomy(projectRoot);
  for (const unit of manifest.units.filter((item) => ACCEPTED_KINDS.has(item.kind))) {
    const artifactPath = resolveArtifact(workContextsRoot, unit.artifact_file);
    let harness;
    try {
      harness = validatePatternMarkdown(
        path.basename(artifactPath),
        await readFile(artifactPath, "utf8"),
        taxonomy
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Deep-dive artifact harness failed: ${unit.id}: ${detail}`);
    }
    if (!harness.valid) {
      throw new Error(`Deep-dive artifact harness failed: ${unit.id}: ${harness.errors.join(", ")}`);
    }
  }
}

function substantiveReviewAnswer(value: unknown): value is string {
  return typeof value === "string" && value.replace(/\s+/g, "").length >= 36;
}

function completeReaderCoreParadigm(value: unknown): value is ReaderCoreParadigmReview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const paradigm = value as ReaderCoreParadigmReview;
  return (
    typeof paradigm.paradigm_id === "string" &&
    paradigm.paradigm_id.trim().length > 0 &&
    substantiveReviewAnswer(paradigm.importance) &&
    substantiveReviewAnswer(paradigm.design_reasoning) &&
    substantiveReviewAnswer(paradigm.mechanism) &&
    substantiveReviewAnswer(paradigm.benefits_and_cleverness) &&
    substantiveReviewAnswer(paradigm.tradeoffs_and_limits) &&
    substantiveReviewAnswer(paradigm.source_and_canonical_alignment)
  );
}

async function requireIndependentReaderReview(
  manifest: DeepDiveManifest,
  workContextsRoot: string
): Promise<void> {
  const reviewPath = resolveArtifact(workContextsRoot, manifest.reader_review_file);
  let review: ReaderReviewReceipt;
  try {
    review = await readJson<ReaderReviewReceipt>(reviewPath);
  } catch {
    throw new Error("Deep-dive independent reader review is missing or invalid JSON");
  }
  const answers = review.answers;
  const completeUniversalAnswers = answers && [
    answers.project_problem,
    answers.primary_sequence,
    answers.worked_example,
    answers.counterfactual,
    answers.canonical_alignment
  ].every(substantiveReviewAnswer);
  const adjacentComparisonRequired = (manifest.primary_value_thesis.adjacent_approaches?.length ?? 0) > 0;
  const adjacentAnswerComplete = !adjacentComparisonRequired || substantiveReviewAnswer(answers?.adjacent_composition);
  if (
    review.reviewer_role !== "independent_reader" ||
    review.verdict !== "pass" ||
    review.reviewed_report_file !== manifest.report_file ||
    review.reviewed_canonical_unit_id !== manifest.primary_value_thesis.canonical_unit_id ||
    !completeUniversalAnswers ||
    !adjacentAnswerComplete
  ) {
    throw new Error("Deep-dive independent reader review failed its contract");
  }
  const reviewedParadigms = Array.isArray(answers?.core_paradigms)
    ? answers.core_paradigms.filter(completeReaderCoreParadigm)
    : [];
  const expectedIds = new Set(manifest.primary_value_thesis.core_functional_paradigms.map((item) => item.id));
  const reviewedIds = new Set(reviewedParadigms.map((item) => String(item.paradigm_id)));
  if (
    reviewedParadigms.length !== manifest.primary_value_thesis.core_functional_paradigms.length ||
    reviewedIds.size !== expectedIds.size ||
    [...expectedIds].some((id) => !reviewedIds.has(id))
  ) {
    throw new Error("Deep-dive independent reader review failed its core paradigm contract");
  }
}

type FileSnapshot = Buffer | null;

async function captureFile(file: string): Promise<FileSnapshot> {
  try {
    return await readFile(file);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function restoreFile(file: string, snapshot: FileSnapshot): Promise<void> {
  if (snapshot !== null) {
    await writeFile(file, snapshot);
    return;
  }
  try {
    await unlink(file);
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
  }
}

async function registryContainsFinalization(
  projectRoot: string,
  manifest: DeepDiveManifest,
  learnedFiles: string[]
): Promise<boolean> {
  try {
    const registry = await readLearnedRepoRegistry(projectRoot);
    const repo = normalizeRepo(manifest.repo);
    return registry.repos.some((record) =>
      normalizeRepo(record.repo) === repo &&
      record.status === "accepted" &&
      record.run_id === manifest.run_id &&
      record.pattern_files.length === learnedFiles.length &&
      record.pattern_files.every((file, index) => file === learnedFiles[index])
    );
  } catch {
    return false;
  }
}

async function finalizeDeepDiveUnlocked(options: FinalizeDeepDiveOptions): Promise<FinalizeDeepDiveResult> {
  const manifestBytes = await readFile(path.resolve(options.manifestPath));
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as DeepDiveManifest;
  const manifestHash = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  const gate = scoreDeepDiveManifest(manifest);
  if (!gate.qualified) {
    throw new Error(`Deep-dive value gate failed: ${gate.errors.join(", ")}`);
  }

  const workContextsRoot = getWorkContextsRoot(options.projectRoot);
  const knowledgePaths = getKnowledgePaths(options.projectRoot);
  const currentRunPath = path.join(knowledgePaths.runsDir, `${manifest.run_id}.json`);
  const failedRunPath = path.join(knowledgePaths.failedRunsDir, `${manifest.run_id}.json`);
  const receiptPath = path.join(knowledgePaths.runsDir, `${manifest.run_id}-deep-finalization.json`);
  if (await pathExists(receiptPath)) {
    const priorReceipt = await readJson<{ manifest_sha256?: unknown }>(receiptPath);
    if (priorReceipt.manifest_sha256 !== manifestHash) {
      throw new Error(`Deep-dive conflicting finalization for run id: ${manifest.run_id}`);
    }
  }
  const { existing } = await requireBoundSourceRun(
    manifest,
    workContextsRoot,
    knowledgePaths.knowledgeRoot,
    knowledgePaths.sourcesDir,
    currentRunPath,
    failedRunPath
  );
  const checkout = await requirePinnedCheckout(
    manifest,
    workContextsRoot,
    knowledgePaths.knowledgeRoot,
    knowledgePaths.sourcesDir
  );
  const required = [
    manifest.report_file,
    manifest.reader_review_file,
    ...manifest.audit_files,
    ...manifest.units.map((unit) => unit.artifact_file)
  ];
  for (const file of required) {
    if (!(await isRegularFileWithin(resolveArtifact(workContextsRoot, file), workContextsRoot))) {
      throw new Error(`Deep-dive artifact missing: ${file}`);
    }
  }
  await requirePrimaryValueEvidence(manifest, checkout.checkoutPath);
  await requireEvidenceAndArtifactProvenance(manifest, checkout.checkoutPath, workContextsRoot);
  await requireAcceptedArtifactsPassHarness(manifest, options.projectRoot, workContextsRoot);
  await requireCoreParadigmsPersisted(manifest, workContextsRoot);
  await requireIndependentReaderReview(manifest, workContextsRoot);

  const reportPath = resolveArtifact(workContextsRoot, manifest.report_file);
  const reportReadability = assessHumanReportReadability(await readFile(reportPath, "utf8"));
  if (!reportReadability.valid) {
    throw new Error(`Deep-dive report gate failed: ${reportReadability.errors.join(", ")}`);
  }

  const learnedFiles = manifest.units
    .filter((unit) => ["canonical_loop", "implementation_detail", "context_pattern"].includes(unit.kind))
    .map((unit) => toWorkContextRelative(resolveArtifact(workContextsRoot, unit.artifact_file), workContextsRoot));
  const finishedAt = new Date().toISOString();

  const receipt = {
    ...gate,
    run_id: manifest.run_id,
    repo: manifest.repo,
    commit: manifest.commit,
    manifest_sha256: manifestHash,
    source_snapshot: existing.source_snapshot,
    checkout_receipt_file: manifest.checkout_receipt_file,
    report_file: toWorkContextRelative(resolveArtifact(workContextsRoot, manifest.report_file), workContextsRoot),
    reader_review_file: toWorkContextRelative(resolveArtifact(workContextsRoot, manifest.reader_review_file), workContextsRoot),
    audit_files: [...manifest.audit_files],
    report_readability: reportReadability,
    learned_files: learnedFiles,
    finished_at: finishedAt
  };

  const canonicalFiles = manifest.units
    .filter((unit) => unit.kind === "canonical_loop")
    .map((unit) => toWorkContextRelative(resolveArtifact(workContextsRoot, unit.artifact_file), workContextsRoot));
  const routedUnits = manifest.units
    .filter((unit) => unit.kind === "implementation_detail" || unit.kind === "context_pattern")
    .map((unit) => ({
      id: unit.id,
      file: toWorkContextRelative(resolveArtifact(workContextsRoot, unit.artifact_file), workContextsRoot),
      context: unit.owner_context,
      disposition: unit.kind,
      reason: "Promoted by the commit-pinned deep-dive value gate",
      confidence: unit.confidence ?? "medium"
    }));
  const successfulRun = {
    ...existing,
    status: "success",
    added_patterns: learnedFiles,
    promoted_patterns: canonicalFiles,
    routed_patterns: routedUnits,
    rejected_patterns: manifest.units.filter((unit) => unit.kind === "rejected").map((unit) => unit.artifact_file),
    generated_card: toWorkContextRelative(resolveArtifact(workContextsRoot, manifest.report_file), workContextsRoot).replace(/^work_contexts\//, ""),
    harness_result: {
      accepted: learnedFiles.length,
      rejected: manifest.units.filter((unit) => unit.kind === "rejected").length,
      errors: {}
    },
    value_gate: gate,
    failure_reason: undefined,
    finished_at: finishedAt
  };
  const failedSnapshot = await captureFile(failedRunPath);
  const currentSnapshot = await captureFile(currentRunPath);
  const receiptSnapshot = await captureFile(receiptPath);
  let registryCommitted = false;
  try {
    await writeJson(receiptPath, receipt);
    await writeJson(currentRunPath, successfulRun);
    if (failedSnapshot !== null) {
      const failed = JSON.parse(failedSnapshot.toString("utf8")) as Record<string, unknown>;
      await writeJson(failedRunPath, {
        ...failed,
        superseded_by: toKnowledgeRelative(options.projectRoot, currentRunPath, knowledgePaths.knowledgeRoot),
        recovered_at: finishedAt
      });
    }
    try {
      await markRepoLearned(options.projectRoot, {
        repo: manifest.repo,
        url: `https://github.com/${manifest.repo}`,
        learned_at: finishedAt,
        run_id: manifest.run_id,
        pattern_files: learnedFiles,
        status: "accepted"
      });
      registryCommitted = true;
    } catch (error) {
      registryCommitted = await registryContainsFinalization(options.projectRoot, manifest, learnedFiles);
      if (!registryCommitted) throw error;
    }
  } catch (error) {
    if (!registryCommitted) {
      try {
        await restoreFile(failedRunPath, failedSnapshot);
        await restoreFile(currentRunPath, currentSnapshot);
        await restoreFile(receiptPath, receiptSnapshot);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "Deep-dive finalization failed and rollback was incomplete");
      }
    }
    throw error;
  }
  return {
    ...gate,
    receipt_file: toKnowledgeRelative(options.projectRoot, receiptPath, knowledgePaths.knowledgeRoot),
    learned_files: learnedFiles
  };
}

export async function finalizeDeepDive(options: FinalizeDeepDiveOptions): Promise<FinalizeDeepDiveResult> {
  const release = await acquireDailyFileLock(options.projectRoot);
  try {
    return await finalizeDeepDiveUnlocked(options);
  } finally {
    await release();
  }
}
