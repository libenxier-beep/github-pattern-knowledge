function handlesSubject(concreteNames: string[]): { text: string; plural: boolean } {
  const names = concreteNames.slice(0, 2);
  if (names.length === 0) {
    return { text: "the named source surface", plural: false };
  }
  return { text: names.map((name) => `\`${name}\``).join(names.length === 1 ? "" : " and "), plural: names.length > 1 };
}

export function evidenceSupportRationale(filePath: string, observedStructure: string, concreteNames: string[], patternLabel = "pattern"): string {
  const lower = `${filePath}\n${observedStructure}`.toLowerCase();
  const handles = handlesSubject(concreteNames);
  if (lower.includes("test") || lower.includes("spec") || lower.includes("example evidence")) {
    return `Supports the ${patternLabel} because ${handles.text} ${handles.plural ? "turn" : "turns"} the claimed boundary behavior in this file into a checkable contract an agent can reopen before transfer.`;
  }
  if (lower.includes("configuration") || lower.includes("metadata") || lower.includes("schema")) {
    return `Supports the ${patternLabel} because ${handles.text} ${handles.plural ? "expose" : "exposes"} the configuration or metadata contract where callers bind to the boundary, not just prose about it.`;
  }
  if (lower.includes("registry") || lower.includes("registration")) {
    return `Supports the ${patternLabel} because ${handles.text} ${handles.plural ? "name" : "names"} the registration or lookup surface that separates extension ownership from host orchestration.`;
  }
  if (lower.includes("dispatch") || lower.includes("command") || lower.includes("handler") || lower.includes("router")) {
    return `Supports the ${patternLabel} because ${handles.text} ${handles.plural ? "are concrete dispatch handles" : "is the concrete dispatch handle"} that maps external input to owned handler code.`;
  }
  if (lower.includes("persistence") || lower.includes("cache") || lower.includes("storage")) {
    return `Supports the ${patternLabel} because ${handles.text} ${handles.plural ? "are places" : "is where"} durable state, cache lookup, or storage mutation is isolated behind a named boundary.`;
  }
  if (lower.includes("pipeline") || lower.includes("processor") || lower.includes("exporter") || lower.includes("stage")) {
    return `Supports the ${patternLabel} because ${handles.text} ${handles.plural ? "make" : "makes"} a stage boundary visible in source instead of leaving processing order implicit.`;
  }
  return `Supports the ${patternLabel} because ${handles.text} ${handles.plural ? "give concrete source handles" : "gives a concrete source handle"} in this file for auditing the claimed boundary before applying it elsewhere.`;
}
