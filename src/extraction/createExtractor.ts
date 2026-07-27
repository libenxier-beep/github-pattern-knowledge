import type { Taxonomy } from "../types";
import { DEFAULT_TAXONOMY } from "../knowledge/defaultSchemas";
import { loadDotEnvLocal } from "../utils/env";
import type { PatternExtractor } from "./extractor";
import { HeuristicExtractor } from "./heuristicExtractor";
import { LLMExtractor } from "./llmExtractor";
import type { LLMClient } from "./llmClient";
import { OpenAIResponsesClient } from "./llmClient";

export type ExtractorMode = "auto" | "heuristic" | "llm";

export type CreateExtractorOptions = {
  mode?: ExtractorMode;
  hasOpenAIKey?: boolean;
  client?: LLMClient;
  taxonomy?: Taxonomy;
  reviewer?: boolean;
  projectRoot?: string;
};

export type CreatedExtractor = {
  name: "heuristic" | "llm";
  requested_mode: ExtractorMode;
  selection_reason: string;
  extractor: PatternExtractor;
};

function envMode(): ExtractorMode {
  const raw = (process.env.EXTRACTOR_MODE ?? "auto").toLowerCase();
  return raw === "heuristic" || raw === "llm" || raw === "auto" ? raw : "auto";
}

export function createExtractor(options: CreateExtractorOptions = {}): CreatedExtractor {
  loadDotEnvLocal(options.projectRoot);
  const mode = options.mode ?? envMode();
  const hasOpenAIKey = options.hasOpenAIKey ?? Boolean(process.env.OPENAI_API_KEY);
  const heuristic = new HeuristicExtractor();

  if (mode === "heuristic" || (mode === "auto" && !hasOpenAIKey && !options.client)) {
    return {
      name: "heuristic",
      requested_mode: mode,
      selection_reason: mode === "heuristic" ? "explicit_heuristic_mode" : "auto_without_openai_key",
      extractor: heuristic
    };
  }
  if (mode === "llm" && !hasOpenAIKey && !options.client) {
    throw new Error("EXTRACTOR_MODE=llm requires OPENAI_API_KEY");
  }

  return {
    name: "llm",
    requested_mode: mode,
    selection_reason: options.client ? "explicit_llm_client" : "openai_key_available",
    extractor: new LLMExtractor({
      client: options.client ?? new OpenAIResponsesClient(),
      taxonomy: options.taxonomy ?? DEFAULT_TAXONOMY,
      reviewer: options.reviewer ?? process.env.LLM_REVIEW !== "0"
    })
  };
}
