import { describe, expect, test } from "vitest";
import { extractConcreteNames } from "../src/knowledge/evidenceNames";

describe("evidence name extraction", () => {
  test("adds file context to short code and config names", () => {
    expect(extractConcreteNames("export default function Page() {}", "app/revalidatepath/page.js")).toContain("revalidatepath/page:Page");
    expect(extractConcreteNames('{"type":"module","main":"index.js"}', "packages/demo/package.json")).toContain("demo/package:type");
  });

  test("drops unhelpful schema stopwords and falls back to the file module", () => {
    expect(extractConcreteNames("of:\n  type: string", "internal/config.schema.yaml")).toEqual(["internal/config.schema"]);
  });
});
