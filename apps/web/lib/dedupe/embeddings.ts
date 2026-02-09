import { createHash } from "node:crypto";
import { EMBEDDING_DIMENSION } from "./constants";
import { geminiEmbed } from "./gemini";
import { resolveEmbeddingProviderChain } from "./llm-config";
import { openAiEmbed } from "./openai";
import type { EmbeddingProvider } from "./providers";

export function createOpenAiEmbeddingProvider(): EmbeddingProvider {
  return {
    embed(texts) {
      return openAiEmbed(texts);
    },
  };
}

export function createGeminiEmbeddingProvider(): EmbeddingProvider {
  return {
    embed(texts) {
      return geminiEmbed(texts, { outputDimensionality: EMBEDDING_DIMENSION });
    },
  };
}

export function createConfiguredEmbeddingProvider(): EmbeddingProvider {
  const chain = resolveEmbeddingProviderChain();
  const providers = chain.map((name) => {
    switch (name) {
      case "gemini":
        return { name, provider: createGeminiEmbeddingProvider() };
      case "openai":
        return { name, provider: createOpenAiEmbeddingProvider() };
      default:
        return assertNeverProvider(name);
    }
  });

  return {
    async embed(texts) {
      if (texts.length === 0) {
        return [];
      }

      const errors: Array<{ name: string; error: unknown }> = [];
      for (const { name, provider } of providers) {
        try {
          const embeddings = await provider.embed(texts);
          if (
            !Array.isArray(embeddings) ||
            embeddings.length !== texts.length
          ) {
            throw new Error(
              `Embedding provider '${name}' returned ${embeddings.length} embeddings for ${texts.length} texts`
            );
          }
          if (
            embeddings.some(
              (embedding) => embedding.length !== EMBEDDING_DIMENSION
            )
          ) {
            throw new Error(
              `Embedding provider '${name}' returned vectors with dimension != ${EMBEDDING_DIMENSION}`
            );
          }
          return embeddings;
        } catch (error) {
          errors.push({ name, error });
        }
      }

      throw new Error(
        `All embedding providers failed: ${errors
          .map((e) => `${e.name}: ${formatProviderError(e.error)}`)
          .join("; ")}`
      );
    },
  };
}

function assertNeverProvider(value: never): never {
  throw new Error(`Unsupported embedding provider: ${String(value)}`);
}

function formatProviderError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 200);
  }
  if (typeof error === "string") {
    return error.slice(0, 200);
  }
  try {
    return JSON.stringify(error).slice(0, 200);
  } catch {
    return "Unknown error";
  }
}

// Deterministic, lightweight embedding for tests/evals when a real model isn't available.
// This is NOT intended for production quality vector search.
export function createHashEmbeddingProvider(
  dimensions = 64
): EmbeddingProvider {
  return {
    embed(texts) {
      return Promise.resolve(texts.map((t) => hashToUnitVector(t, dimensions)));
    },
  };
}

function hashToUnitVector(text: string, dimensions: number): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const h = createHash("sha256").update(token).digest();
    const idx = h.readUInt32BE(0) % dimensions;
    // Signed contribution to reduce collisions.
    const sign = (h[4] ?? 0) % 2 === 0 ? 1 : -1;
    vec[idx] = (vec[idx] ?? 0) + sign;
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]+/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);
}
