const CONTEXT_REQUIRED = new Set([
  "build",
  "config",
  "default",
  "index",
  "main",
  "name",
  "package",
  "private",
  "scripts",
  "test",
  "type",
  "version"
]);

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with"
]);

function fileContext(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  const leaf = (parts.pop() ?? "file").replace(/\.[^.]+$/, "");
  const parent = parts.pop();
  if (parent) {
    return `${parent}/${leaf}`;
  }
  return leaf.length >= 8 ? leaf : `${leaf}-module`;
}

function normalizeName(raw: string, filePath: string): string | null {
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean || STOPWORDS.has(clean.toLowerCase())) {
    return null;
  }
  const needsContext = clean.length < 8 || CONTEXT_REQUIRED.has(clean.toLowerCase());
  return needsContext ? `${fileContext(filePath)}:${clean}` : clean;
}

export function extractConcreteNames(content: string, filePath: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /"name"\s*:\s*"([^"]{3,80})"/g,
    /\bname\s*=\s*"([^"]{3,80})"/g,
    /\b(?:class|interface|type|function|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    /\bfunc\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)/g,
    /\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    /\b(?:describe|it|test)\(["'`]([^"'`]{8,80})["'`]/g,
    /"([A-Za-z0-9:_@./-]{3,80})"\s*:/g,
    /^([A-Za-z0-9_.-]{3,80}):/gm
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const normalized = match[1] ? normalizeName(match[1], filePath) : null;
      if (normalized) {
        names.add(normalized);
      }
      if (names.size >= 4) {
        break;
      }
    }
    if (names.size >= 4) {
      break;
    }
  }
  if (names.size === 0) {
    names.add(fileContext(filePath));
  }
  return [...names].slice(0, 4);
}
