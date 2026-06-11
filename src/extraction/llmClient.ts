import { loadDotEnvLocal } from "../utils/env";

export type LLMJsonRequest = {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
};

export interface LLMClient {
  completeJson<T>(purpose: string, payload: LLMJsonRequest): Promise<T>;
}

type ResponsesApiOutputText = {
  type?: string;
  text?: string;
};

type ResponsesApiOutputItem = {
  type?: string;
  content?: ResponsesApiOutputText[];
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: ResponsesApiOutputItem[];
};

export type OpenAIResponsesClientOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class OpenAIResponsesClient implements LLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly reasoningEffort: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIResponsesClientOptions = {}) {
    loadDotEnvLocal();
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for LLM extraction");
    }
    this.apiKey = apiKey;
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
    this.reasoningEffort = process.env.OPENAI_REASONING_EFFORT ?? "medium";
    this.baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async completeJson<T>(_purpose: string, payload: LLMJsonRequest): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          { role: "system", content: payload.system },
          { role: "user", content: payload.user }
        ],
        store: false,
        reasoning: { effort: this.reasoningEffort },
        text: {
          format: {
            type: "json_schema",
            name: payload.schemaName,
            schema: payload.schema,
            strict: true
          }
        }
      }),
      signal: AbortSignal.timeout(120_000)
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI Responses API ${response.status}: ${message.slice(0, 500)}`);
    }

    const data = (await response.json()) as ResponsesApiResponse;
    const text =
      data.output_text ??
      data.output
        ?.flatMap((item) => item.content ?? [])
        .map((content) => content.text)
        .filter((value): value is string => Boolean(value))
        .join("\n");
    if (!text) {
      throw new Error("OpenAI Responses API returned no JSON text");
    }
    return JSON.parse(text) as T;
  }
}
