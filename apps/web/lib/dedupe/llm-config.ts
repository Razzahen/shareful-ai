export type LlmProviderName = "gemini" | "openai";

const PROVIDER_ALIASES: Record<string, LlmProviderName> = {
  gemini: "gemini",
  google: "gemini",
  openai: "openai",
  gpt: "openai",
};

export function parseProviderChain(args: {
  raw: string | undefined;
  envName: string;
  defaultChain: LlmProviderName[];
}): LlmProviderName[] {
  const raw = args.raw?.trim() ?? "";
  if (!raw) {
    return [...args.defaultChain];
  }

  const chain: LlmProviderName[] = [];
  const seen = new Set<LlmProviderName>();

  for (const token of raw.split(",")) {
    const normalized = token.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    const resolved = PROVIDER_ALIASES[normalized];
    if (!resolved) {
      throw new Error(
        `Unknown provider '${token}' in ${args.envName}. Valid providers: openai, gemini.`
      );
    }

    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    chain.push(resolved);
  }

  if (chain.length === 0) {
    return [...args.defaultChain];
  }

  return chain;
}

export function resolveEmbeddingProviderChain(): LlmProviderName[] {
  return parseProviderChain({
    raw: process.env.SHAREFUL_EMBED_PROVIDERS,
    envName: "SHAREFUL_EMBED_PROVIDERS",
    defaultChain: ["openai"],
  });
}

export function resolveJudgeProviderChain(): LlmProviderName[] {
  return parseProviderChain({
    raw:
      process.env.SHAREFUL_JUDGE_PROVIDERS ??
      process.env.SHAREFUL_LLM_PROVIDERS,
    envName: "SHAREFUL_JUDGE_PROVIDERS",
    defaultChain: ["openai"],
  });
}
