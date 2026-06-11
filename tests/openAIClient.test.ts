import { describe, expect, test } from "vitest";
import { OpenAIResponsesClient } from "../src/extraction/llmClient";

describe("OpenAI Responses client", () => {
  test("sends structured-output Responses requests without storing response state", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ output_text: "{\"ok\":true}" }), { status: 200 });
    }) as typeof fetch;
    const client = new OpenAIResponsesClient({
      apiKey: "test-key",
      model: "gpt-5.5",
      baseUrl: "https://api.openai.test/v1",
      fetchImpl
    });

    const result = await client.completeJson<{ ok: boolean }>("test", {
      system: "system",
      user: "user",
      schemaName: "test_schema",
      schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } }
    });
    const body = JSON.parse(String(calls[0].init.body));

    expect(result.ok).toBe(true);
    expect(calls[0].url).toBe("https://api.openai.test/v1/responses");
    expect(body.model).toBe("gpt-5.5");
    expect(body.store).toBe(false);
    expect(body.reasoning.effort).toBe("medium");
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
  });
});
