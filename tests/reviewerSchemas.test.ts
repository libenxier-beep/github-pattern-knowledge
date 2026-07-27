import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

type JsonSchema = {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean;
  required?: string[];
};

function assertApiCompatibleSchema(schema: JsonSchema, location = "root"): void {
  expect(schema.type, `${location} must declare type`).toBeTypeOf("string");
  if (schema.type === "object") {
    expect(schema.additionalProperties, `${location} must reject undeclared fields`).toBe(false);
    const properties = schema.properties ?? {};
    expect(new Set(schema.required ?? []), `${location} must require every declared field`).toEqual(
      new Set(Object.keys(properties))
    );
    for (const [name, property] of Object.entries(properties)) {
      assertApiCompatibleSchema(property, `${location}.${name}`);
    }
  }
  if (schema.type === "array" && schema.items) {
    assertApiCompatibleSchema(schema.items, `${location}[]`);
  }
}

describe("independent reviewer response schemas", () => {
  test("source-judgment schema is versioned and API-compatible", async () => {
    const file = path.join(process.cwd(), "schemas", "independent-source-judgment.schema.json");
    const schema = JSON.parse(await readFile(file, "utf8")) as JsonSchema;

    assertApiCompatibleSchema(schema);
    expect(schema.properties?.reviewer_role).toMatchObject({
      type: "string",
      const: "independent_source_judge"
    });
    expect(schema.properties?.candidate_reviews?.items?.properties?.disposition?.enum).toEqual([
      "accepted",
      "rejected",
      "revise"
    ]);
  });
});
