export type HumanReportReadabilityResult = {
  valid: boolean;
  errors: string[];
  internal_identifiers: string[];
};

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---\n")) return markdown;
  const end = markdown.indexOf("\n---\n", 4);
  return end === -1 ? markdown : markdown.slice(end + 5);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function substantiveLength(markdown: string): number {
  return markdown.replace(/[#*_`>\[\]()\s-]/g, "").length;
}

export function assessHumanReportReadability(markdown: string): HumanReportReadabilityResult {
  const errors: string[] = [];
  const body = stripFrontmatter(markdown);
  const appendixMatch = /^## 证据附录\s*$/m.exec(body);
  if (!appendixMatch || appendixMatch.index === undefined) {
    return { valid: false, errors: ["report_evidence_appendix_required"], internal_identifiers: [] };
  }

  const mainNarrative = body.slice(0, appendixMatch.index);
  if (substantiveLength(mainNarrative) < 200) errors.push("report_main_narrative_too_short");
  const identifiers: string[] = [];
  const codeSpans = [...mainNarrative.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
  for (const token of codeSpans) {
    if (/[_/\\]|\.[a-z][a-z0-9]{0,7}\b|\w+\s*\(/i.test(token)) identifiers.push(token);
  }
  identifiers.push(...(mainNarrative.match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/gi) ?? []));
  identifiers.push(...(mainNarrative.match(/\b(?:src|lib|packages|tests?|app|agent)\/[A-Za-z0-9_./-]+/g) ?? []));
  identifiers.push(...(mainNarrative.match(/\b[a-z][a-z0-9]*(?:[A-Z][A-Za-z0-9]*)+\s*\(/g) ?? []));
  if (mainNarrative.includes("```")) identifiers.push("fenced_code_block");

  const internalIdentifiers = unique(identifiers);
  if (internalIdentifiers.length > 0) errors.push("report_main_narrative_contains_internal_identifiers");
  return { valid: errors.length === 0, errors, internal_identifiers: internalIdentifiers };
}
