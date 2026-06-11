const stringArraySchema = {
  type: "array",
  items: { type: "string" }
} as const;

const sourceRepoSchema = {
  type: "object",
  additionalProperties: false,
  required: ["repo", "url", "commit", "reference_files"],
  properties: {
    repo: { type: "string" },
    url: { type: "string" },
    commit: { type: "string" },
    reference_files: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" }
    }
  }
} as const;

const frontmatterSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "summary",
    "engineering_problems",
    "project_types",
    "pattern_types",
    "complexity",
    "quality_score",
    "source_repos",
    "use_when",
    "avoid_when",
    "tradeoffs",
    "transfer_targets",
    "related_patterns",
    "tags"
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    engineering_problems: stringArraySchema,
    project_types: stringArraySchema,
    pattern_types: stringArraySchema,
    complexity: { type: "string", enum: ["low", "medium", "high"] },
    quality_score: { type: "number" },
    source_repos: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: sourceRepoSchema
    },
    use_when: stringArraySchema,
    avoid_when: stringArraySchema,
    tradeoffs: stringArraySchema,
    transfer_targets: stringArraySchema,
    related_patterns: stringArraySchema,
    tags: stringArraySchema
  }
} as const;

const patternSchema = {
  type: "object",
  additionalProperties: false,
  required: ["frontmatter", "body"],
  properties: {
    frontmatter: frontmatterSchema,
    body: { type: "string" }
  }
} as const;

export const EXTRACTION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["patterns"],
  properties: {
    patterns: {
      type: "array",
      maxItems: 3,
      items: patternSchema
    }
  }
} as const;

export const REVIEW_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reviews"],
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "decision", "reason"],
        properties: {
          id: { type: "string" },
          decision: { type: "string", enum: ["accept", "reject"] },
          reason: { type: "string" }
        }
      }
    }
  }
} as const;
