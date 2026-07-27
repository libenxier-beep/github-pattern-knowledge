import path from "node:path";

export type DeepDiveUnitKind =
  | "canonical_loop"
  | "implementation_detail"
  | "context_pattern"
  | "routed_draft"
  | "review_draft"
  | "rejected";

export type DeepDiveUnitScores = {
  evidence: number;
  mechanism: number;
  closed_loop: number;
  transfer: number;
  ai_leverage: number;
  boundaries: number;
  retrieval: number;
};

export type CrossDomainTransferBridge = {
  commodity_baseline: string;
  production_pressure: string;
  craft_move: string;
  obvious_alternative_failure: string;
  cross_domain_analogies: string[];
  source_domain_problem: string;
  domain_neutral_mechanism: string;
  target_domains: string[];
  transfer_invariants: string[];
  non_transferable_source_details: string[];
  analogy_break_conditions: string[];
  human_recall_trigger: string;
  agent_adaptation_task: string;
  deterministic_acceptance_check: string;
};

export type DeepDiveUnit = {
  id: string;
  artifact_file: string;
  owner_context: string;
  kind: DeepDiveUnitKind;
  evidence_refs: string[];
  has_production_source: boolean;
  has_corroborating_evidence: boolean;
  filename_only_claim: boolean;
  confidence?: "low" | "medium" | "high";
  transfer_bridge?: CrossDomainTransferBridge;
  scores: DeepDiveUnitScores;
};

export type PrimaryValueTransferMapping = {
  target_domain: string;
  source_entities: string[];
  target_entities: string[];
  relationship_mapping: string;
  preserved_invariant: string;
};

export type PrimaryValueThesis = {
  source_function: string;
  primary_abstraction: string;
  why_primary: string;
  canonical_unit_id: string;
  evidence_refs: string[];
  mechanism_contract: PrimaryMechanismContract;
  core_functional_paradigms: CoreFunctionalParadigm[];
  adjacent_approaches?: AdjacentApproachComparison[];
  transfer_mappings: PrimaryValueTransferMapping[];
  non_applicable_conditions: string[];
};

export type CoreFunctionalParadigm = {
  id: string;
  name: string;
  problem: string;
  design_choice: string;
  mechanism: string;
  importance: string;
  non_obvious_move: string;
  benefits: string[];
  tradeoffs: string[];
  canonical_unit_id: string;
  evidence_refs: string[];
};

export type PrimaryMechanismContract = {
  source_inputs: string[];
  decision_or_relation_rules: string[];
  produced_outputs: string[];
  worked_example: string;
  validation_boundary: string;
};

export type AdjacentApproachComparison = {
  approach: string;
  selection_basis: string;
  best_for: string;
  limitation: string;
  not_equivalent_reason: string;
  combination_role: string;
};

export type DeepDiveManifest = {
  schema_version: "1.5";
  run_id: string;
  repo: string;
  commit: string;
  checkout_receipt_file: string;
  report_file: string;
  reader_review_file: string;
  audit_files: string[];
  primary_value_thesis: PrimaryValueThesis;
  units: DeepDiveUnit[];
};

export type ValueGateResult = {
  qualified: boolean;
  total_score: number;
  dimension_scores: DeepDiveUnitScores;
  errors: string[];
};

const MAX_SCORES: DeepDiveUnitScores = {
  evidence: 25,
  mechanism: 20,
  closed_loop: 15,
  transfer: 15,
  ai_leverage: 10,
  boundaries: 10,
  retrieval: 5
};

const ACCEPTED_KINDS = new Set<DeepDiveUnitKind>(["canonical_loop", "implementation_detail", "context_pattern"]);
const UNIT_KINDS = new Set<DeepDiveUnitKind>([
  "canonical_loop",
  "implementation_detail",
  "context_pattern",
  "routed_draft",
  "review_draft",
  "rejected"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unitScore(unit: DeepDiveUnit, key: keyof DeepDiveUnitScores): number {
  const scores: Record<string, unknown> = isRecord(unit.scores) ? unit.scores : {};
  const value = scores[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function averageDimension(units: DeepDiveUnit[], key: keyof DeepDiveUnitScores): number {
  if (units.length === 0) return 0;
  return Number((units.reduce((sum, unit) => {
    const value = unitScore(unit, key);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0) / units.length).toFixed(2));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedStringSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter(nonEmptyString).map((item) => item.trim().toLowerCase()));
}

function normalizedEvidenceFileSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  const files = value.flatMap((item) => {
    if (!nonEmptyString(item)) return [];
    const file = item.trim().split("#", 1)[0] ?? "";
    const locator = canonicalizePortableLocator(file);
    return locator.safe && locator.canonical_form ? [locator.canonical] : [];
  });
  return new Set(files);
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export type PortableLocator = {
  canonical: string;
  safe: boolean;
  canonical_form: boolean;
};

export function canonicalizePortableLocator(value: string): PortableLocator {
  const trimmed = value.trim();
  const slashNormalized = trimmed.replaceAll("\\", "/");
  const canonical = path.posix.normalize(slashNormalized);
  const safe =
    canonical !== "." &&
    !path.posix.isAbsolute(canonical) &&
    !/^[A-Za-z]:\//.test(canonical) &&
    canonical !== ".." &&
    !canonical.startsWith("../") &&
    !canonical.includes("\0");
  return {
    canonical,
    safe,
    canonical_form: safe && value === trimmed && slashNormalized === canonical
  };
}

function artifactOwner(artifactFile: string): string | null {
  const parts = artifactFile.split("/").filter(Boolean);
  if (parts[0] === "work_contexts") return parts[1] ?? null;
  return parts[0] ?? null;
}

function hasCompleteTransferBridge(unit: DeepDiveUnit): boolean {
  const bridge = unit.transfer_bridge;
  if (!bridge) return false;
  const targetDomains = normalizedStringSet(bridge.target_domains);
  const crossDomainAnalogies = normalizedStringSet(bridge.cross_domain_analogies);
  return (
    nonEmptyString(bridge.commodity_baseline) &&
    nonEmptyString(bridge.production_pressure) &&
    nonEmptyString(bridge.craft_move) &&
    nonEmptyString(bridge.obvious_alternative_failure) &&
    crossDomainAnalogies.size >= 1 &&
    nonEmptyString(bridge.source_domain_problem) &&
    nonEmptyString(bridge.domain_neutral_mechanism) &&
    targetDomains.size >= 1 &&
    normalizedStringSet(bridge.transfer_invariants).size > 0 &&
    normalizedStringSet(bridge.non_transferable_source_details).size > 0 &&
    normalizedStringSet(bridge.analogy_break_conditions).size > 0 &&
    nonEmptyString(bridge.human_recall_trigger) &&
    nonEmptyString(bridge.agent_adaptation_task) &&
    nonEmptyString(bridge.deterministic_acceptance_check)
  );
}

function completePrimaryTransferMapping(value: unknown): value is PrimaryValueTransferMapping {
  if (!isRecord(value)) return false;
  return (
    nonEmptyString(value.target_domain) &&
    normalizedStringSet(value.source_entities).size >= 2 &&
    normalizedStringSet(value.target_entities).size >= 2 &&
    nonEmptyString(value.relationship_mapping) &&
    nonEmptyString(value.preserved_invariant)
  );
}

function completePrimaryMechanismContract(value: unknown): value is PrimaryMechanismContract {
  if (!isRecord(value)) return false;
  return (
    normalizedStringSet(value.source_inputs).size > 0 &&
    normalizedStringSet(value.decision_or_relation_rules).size > 0 &&
    normalizedStringSet(value.produced_outputs).size > 0 &&
    nonEmptyString(value.worked_example) &&
    nonEmptyString(value.validation_boundary)
  );
}

function completeCoreFunctionalParadigm(value: unknown): value is CoreFunctionalParadigm {
  if (!isRecord(value)) return false;
  return (
    nonEmptyString(value.id) &&
    nonEmptyString(value.name) &&
    nonEmptyString(value.problem) &&
    nonEmptyString(value.design_choice) &&
    nonEmptyString(value.mechanism) &&
    nonEmptyString(value.importance) &&
    nonEmptyString(value.non_obvious_move) &&
    normalizedStringSet(value.benefits).size > 0 &&
    normalizedStringSet(value.tradeoffs).size > 0 &&
    nonEmptyString(value.canonical_unit_id) &&
    normalizedEvidenceFileSet(value.evidence_refs).size >= 2
  );
}

function completeAdjacentApproach(value: unknown): value is AdjacentApproachComparison {
  if (!isRecord(value)) return false;
  return (
    nonEmptyString(value.approach) &&
    nonEmptyString(value.selection_basis) &&
    nonEmptyString(value.best_for) &&
    nonEmptyString(value.limitation) &&
    nonEmptyString(value.not_equivalent_reason) &&
    nonEmptyString(value.combination_role)
  );
}

export function scoreDeepDiveManifest(manifest: DeepDiveManifest): ValueGateResult {
  const errors: string[] = [];
  const rawManifest: Record<string, unknown> = isRecord(manifest) ? manifest as unknown as Record<string, unknown> : {};
  if (!isRecord(manifest)) errors.push("manifest_shape_invalid:root");
  if (rawManifest.schema_version !== "1.5") errors.push("schema_version_invalid");
  if (typeof rawManifest.run_id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(rawManifest.run_id)) {
    errors.push("run_id_invalid");
  }
  if (typeof rawManifest.repo !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(rawManifest.repo.trim())) {
    errors.push("repo_invalid");
  }
  if (typeof rawManifest.commit !== "string" || !/^[a-f0-9]{40}$/i.test(rawManifest.commit)) {
    errors.push("commit_sha_invalid");
  }

  const primaryValue = rawManifest.primary_value_thesis;
  if (primaryValue === undefined || primaryValue === null) {
    errors.push("primary_value_thesis_required");
  } else if (!isRecord(primaryValue)) {
    errors.push("primary_value_thesis_shape_invalid");
  } else {
    const evidenceFiles = normalizedEvidenceFileSet(primaryValue.evidence_refs);
    const mechanismContract = primaryValue.mechanism_contract;
    const rawCoreParadigms = primaryValue.core_functional_paradigms;
    const coreParadigms = Array.isArray(rawCoreParadigms)
      ? rawCoreParadigms.filter(completeCoreFunctionalParadigm)
      : [];
    const rawAdjacentApproaches = primaryValue.adjacent_approaches;
    const rawMappings = primaryValue.transfer_mappings;
    const mappings = Array.isArray(rawMappings) ? rawMappings.filter(completePrimaryTransferMapping) : [];
    const shapeValid =
      nonEmptyString(primaryValue.source_function) &&
      nonEmptyString(primaryValue.primary_abstraction) &&
      nonEmptyString(primaryValue.why_primary) &&
      nonEmptyString(primaryValue.canonical_unit_id) &&
      completePrimaryMechanismContract(mechanismContract) &&
      Array.isArray(rawCoreParadigms) &&
      rawCoreParadigms.length > 0 &&
      rawCoreParadigms.every(completeCoreFunctionalParadigm) &&
      (rawAdjacentApproaches === undefined ||
        (Array.isArray(rawAdjacentApproaches) && rawAdjacentApproaches.every(completeAdjacentApproach))) &&
      Array.isArray(primaryValue.evidence_refs) &&
      primaryValue.evidence_refs.every(nonEmptyString) &&
      Array.isArray(rawMappings) &&
      rawMappings.every(completePrimaryTransferMapping) &&
      Array.isArray(primaryValue.non_applicable_conditions) &&
      primaryValue.non_applicable_conditions.every(nonEmptyString) &&
      normalizedStringSet(primaryValue.non_applicable_conditions).size > 0;
    if (!shapeValid) errors.push("primary_value_thesis_shape_invalid");
    if (mechanismContract === undefined || mechanismContract === null) {
      errors.push("primary_mechanism_contract_required");
    } else if (!completePrimaryMechanismContract(mechanismContract)) {
      errors.push("primary_mechanism_contract_shape_invalid");
    }
    if (!Array.isArray(rawCoreParadigms) || rawCoreParadigms.length === 0) {
      errors.push("core_functional_paradigms_required");
    } else {
      for (const [index, paradigm] of rawCoreParadigms.entries()) {
        if (!completeCoreFunctionalParadigm(paradigm)) {
          const id = isRecord(paradigm) && nonEmptyString(paradigm.id) ? paradigm.id : `paradigm-${index}`;
          errors.push(`core_functional_paradigm_shape_invalid:${id}`);
        }
      }
      for (const id of duplicateValues(coreParadigms.map((item) => item.id))) {
        errors.push(`duplicate_core_functional_paradigm:${id}`);
      }
    }
    if (rawAdjacentApproaches !== undefined &&
      (!Array.isArray(rawAdjacentApproaches) || !rawAdjacentApproaches.every(completeAdjacentApproach))) {
      errors.push("primary_adjacent_approaches_shape_invalid");
    }
    if (evidenceFiles.size < 2) errors.push("primary_value_evidence_insufficient");
    if (normalizedStringSet(mappings.map((mapping) => mapping.target_domain)).size < 1) {
      errors.push("primary_value_transfer_mapping_minimum_not_met");
    }
  }

  const rawAuditFiles = rawManifest.audit_files;
  if (!Array.isArray(rawAuditFiles) || !rawAuditFiles.every(nonEmptyString)) {
    errors.push("manifest_shape_invalid:audit_files");
  }
  const auditFiles = Array.isArray(rawAuditFiles) ? rawAuditFiles.filter(nonEmptyString) : [];
  const rawUnits = rawManifest.units;
  if (!Array.isArray(rawUnits)) errors.push("manifest_shape_invalid:units");
  const units = Array.isArray(rawUnits) ? rawUnits.filter(isRecord) as unknown as DeepDiveUnit[] : [];
  if (Array.isArray(rawUnits) && units.length !== rawUnits.length) errors.push("manifest_shape_invalid:units");

  for (const [index, unit] of units.entries()) {
    const id = nonEmptyString(unit.id) ? unit.id : `unit-${index}`;
    const kindValid = typeof unit.kind === "string" && UNIT_KINDS.has(unit.kind as DeepDiveUnitKind);
    if (!kindValid) errors.push(`unit_kind_invalid:${id}`);
    const shapeValid =
      nonEmptyString(unit.id) &&
      nonEmptyString(unit.artifact_file) &&
      nonEmptyString(unit.owner_context) &&
      typeof unit.kind === "string" &&
      Array.isArray(unit.evidence_refs) &&
      unit.evidence_refs.every(nonEmptyString) &&
      typeof unit.has_production_source === "boolean" &&
      typeof unit.has_corroborating_evidence === "boolean" &&
      typeof unit.filename_only_claim === "boolean" &&
      isRecord(unit.scores);
    if (!shapeValid) errors.push(`unit_shape_invalid:${id}`);
  }

  const accepted = units.filter((unit) => ACCEPTED_KINDS.has(unit.kind));
  const canonical = accepted.filter((unit) => unit.kind === "canonical_loop");
  const canonicalArtifacts = new Map<DeepDiveUnit, PortableLocator>();
  for (const unit of accepted) {
    if (nonEmptyString(unit.artifact_file)) {
      canonicalArtifacts.set(unit, canonicalizePortableLocator(unit.artifact_file));
    }
  }
  const transferBridges = accepted.filter(hasCompleteTransferBridge);

  if (isRecord(primaryValue)) {
    const canonicalUnitId = primaryValue.canonical_unit_id;
    if (!nonEmptyString(canonicalUnitId)) {
      errors.push("primary_canonical_unit_id_required");
    } else {
      const primaryUnit = accepted.find((unit) => unit.id === canonicalUnitId.trim());
      if (!primaryUnit) {
        errors.push("primary_canonical_unit_not_found");
      } else {
        if (primaryUnit.kind !== "canonical_loop") errors.push("primary_canonical_unit_kind_invalid");
        const primaryEvidence = normalizedEvidenceFileSet(primaryValue.evidence_refs);
        const unitEvidence = normalizedEvidenceFileSet(primaryUnit.evidence_refs);
        if (![...primaryEvidence].some((file) => unitEvidence.has(file))) {
          errors.push("primary_canonical_unit_evidence_disconnected");
        }
      }
    }

    const rawCoreParadigms = primaryValue.core_functional_paradigms;
    const coreParadigms = Array.isArray(rawCoreParadigms)
      ? rawCoreParadigms.filter(completeCoreFunctionalParadigm)
      : [];
    for (const paradigm of coreParadigms) {
      const canonicalUnit = accepted.find((unit) => unit.id === paradigm.canonical_unit_id);
      if (!canonicalUnit) {
        errors.push(`core_paradigm_canonical_unit_not_found:${paradigm.id}`);
        continue;
      }
      if (canonicalUnit.kind !== "canonical_loop") {
        errors.push(`core_paradigm_canonical_unit_kind_invalid:${paradigm.id}`);
      }
      const paradigmEvidence = normalizedEvidenceFileSet(paradigm.evidence_refs);
      const unitEvidence = normalizedEvidenceFileSet(canonicalUnit.evidence_refs);
      if (![...paradigmEvidence].some((file) => unitEvidence.has(file))) {
        errors.push(`core_paradigm_canonical_unit_evidence_disconnected:${paradigm.id}`);
      }
    }
    if (coreParadigms.length > 0 && !coreParadigms.some((item) => item.canonical_unit_id === primaryValue.canonical_unit_id)) {
      errors.push("primary_canonical_unit_not_declared_as_core_paradigm");
    }
  }

  if (!nonEmptyString(rawManifest.checkout_receipt_file)) {
    errors.push("checkout_receipt_required");
  } else {
    const receiptLocator = canonicalizePortableLocator(rawManifest.checkout_receipt_file);
    if (!receiptLocator.safe) errors.push("locator_unsafe:checkout_receipt_file");
    else if (!receiptLocator.canonical_form) errors.push("locator_not_canonical:checkout_receipt_file");
  }
  if (!nonEmptyString(rawManifest.report_file)) errors.push("daily_report_required");
  if (nonEmptyString(rawManifest.report_file)) {
    const reportLocator = canonicalizePortableLocator(rawManifest.report_file);
    if (!reportLocator.safe) errors.push("locator_unsafe:report_file");
    else if (!reportLocator.canonical_form) errors.push("locator_not_canonical:report_file");
  }
  if (!nonEmptyString(rawManifest.reader_review_file)) {
    errors.push("reader_review_required");
  } else {
    const reviewLocator = canonicalizePortableLocator(rawManifest.reader_review_file);
    if (!reviewLocator.safe) errors.push("locator_unsafe:reader_review_file");
    else if (!reviewLocator.canonical_form) errors.push("locator_not_canonical:reader_review_file");
  }
  if (auditFiles.length < 4) errors.push("complete_audit_trail_required");
  const canonicalAuditFiles = auditFiles.map((file, index) => {
    const locator = canonicalizePortableLocator(file);
    if (!locator.safe) errors.push(`locator_unsafe:audit_file:${index}`);
    else if (!locator.canonical_form) errors.push(`locator_not_canonical:audit_file:${locator.canonical}`);
    return locator;
  });
  if (
    nonEmptyString(rawManifest.reader_review_file) &&
    !canonicalAuditFiles.some((item) => item.safe && item.canonical === rawManifest.reader_review_file)
  ) {
    errors.push("reader_review_not_in_audit_trail");
  }
  for (const file of duplicateValues(canonicalAuditFiles.filter((item) => item.safe).map((item) => item.canonical))) {
    errors.push(`duplicate_audit_file:${file}`);
  }
  if (canonical.length < 1) errors.push("canonical_loop_required");
  if (accepted.length < 1) errors.push("accepted_unit_required");
  if (transferBridges.length < 1) errors.push("cross_domain_transfer_bridge_required");

  for (const id of duplicateValues(accepted.map((unit) => unit.id).filter(nonEmptyString))) errors.push(`duplicate_unit_id:${id}`);
  for (const file of duplicateValues(
    [...canonicalArtifacts.values()].filter((item) => item.safe).map((item) => item.canonical)
  )) {
    errors.push(`duplicate_artifact_file:${file}`);
  }

  for (const [index, unit] of units.entries()) {
    const id = nonEmptyString(unit.id) ? unit.id : `unit-${index}`;
    if (unit.filename_only_claim) errors.push("filename_only_claim_forbidden");
    for (const [key, maximum] of Object.entries(MAX_SCORES) as Array<[keyof DeepDiveUnitScores, number]>) {
      const score = unitScore(unit, key);
      if (!Number.isFinite(score) || score < 0 || score > maximum) {
        errors.push(`score_out_of_range:${id}:${key}`);
      }
    }
  }
  for (const unit of accepted) {
    const evidenceRefs = normalizedStringSet(unit.evidence_refs);
    const evidenceFiles = normalizedEvidenceFileSet(unit.evidence_refs);
    if (
      evidenceRefs.size < 2 ||
      evidenceFiles.size < 2 ||
      !unit.has_production_source ||
      !unit.has_corroborating_evidence
    ) {
      errors.push(`insufficient_evidence:${unit.id}`);
    }
    const locator = canonicalArtifacts.get(unit);
    if (locator && !locator.safe) errors.push(`locator_unsafe:artifact_file:${unit.id}`);
    else if (locator && !locator.canonical_form) errors.push(`locator_not_canonical:artifact_file:${unit.id}`);
    if (locator?.safe && nonEmptyString(unit.owner_context) && artifactOwner(locator.canonical) !== unit.owner_context.trim()) {
      errors.push(`artifact_owner_mismatch:${unit.id}:${unit.owner_context}`);
    }
  }

  const dimension_scores: DeepDiveUnitScores = {
    evidence: averageDimension(accepted, "evidence"),
    mechanism: averageDimension(accepted, "mechanism"),
    closed_loop: averageDimension(accepted, "closed_loop"),
    transfer: averageDimension(accepted, "transfer"),
    ai_leverage: averageDimension(accepted, "ai_leverage"),
    boundaries: averageDimension(accepted, "boundaries"),
    retrieval: averageDimension(accepted, "retrieval")
  };
  const total_score = Number(Object.values(dimension_scores).reduce((sum, score) => sum + score, 0).toFixed(2));

  for (const [key, maximum] of Object.entries(MAX_SCORES) as Array<[keyof DeepDiveUnitScores, number]>) {
    if (dimension_scores[key] < maximum * 0.7) errors.push(`dimension_below_floor:${key}`);
  }
  if (total_score < 85) errors.push("total_score_below_85");

  return { qualified: errors.length === 0, total_score, dimension_scores, errors: [...new Set(errors)] };
}
