import { extractJsonObject } from "./llm-json";

const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

function getGeminiBaseUrl(): string {
  return process.env.GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL;
}

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return key;
}

async function geminiFetchJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(`${getGeminiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getGeminiKey(),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as T;
}

export async function geminiEmbed(
  texts: string[],
  options?: {
    model?: string;
    outputDimensionality?: number;
    signal?: AbortSignal;
  }
): Promise<number[][]> {
  const model =
    options?.model ??
    process.env.GEMINI_EMBED_MODEL ??
    // Gemini's currently supported embeddings model in v1beta.
    "gemini-embedding-001";
  const outputDimensionality =
    options?.outputDimensionality ??
    (process.env.GEMINI_EMBED_DIM
      ? Number.parseInt(process.env.GEMINI_EMBED_DIM, 10)
      : undefined);

  const requests = texts.map((text) => ({
    model: `models/${model}`,
    content: { parts: [{ text }] },
    ...(outputDimensionality ? { outputDimensionality } : {}),
  }));

  const json = await geminiFetchJson<{
    embeddings: { values: number[] }[];
  }>(
    `/v1beta/models/${model}:batchEmbedContents`,
    { requests },
    options?.signal
  );

  return (json.embeddings ?? []).map((e) => e.values ?? []);
}

function extractGeminiText(json: unknown): string {
  if (!(json && typeof json === "object")) {
    throw new Error("Gemini returned an invalid response");
  }

  const candidates = (json as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Gemini returned no candidates");
  }

  const first = candidates[0] as {
    content?: { parts?: Array<{ text?: string }> };
  };
  const parts = first.content?.parts ?? [];
  const text = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned empty content");
  }

  return text;
}

export async function geminiJudgeJson(
  args: { system: string; user: string },
  options?: { model?: string; signal?: AbortSignal }
): Promise<Record<string, unknown>> {
  const model =
    options?.model ?? process.env.GEMINI_JUDGE_MODEL ?? "gemini-1.5-flash";

  const json = await geminiFetchJson(
    `/v1beta/models/${model}:generateContent`,
    {
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [{ role: "user", parts: [{ text: args.user }] }],
      // Ask Gemini to return strict JSON. This reduces markdown/code-fence noise
      // and makes downstream parsing much more reliable.
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        // Disable "thinking" tokens so maxOutputTokens is used for the response,
        // not internal reasoning that can truncate JSON output.
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    options?.signal
  );

  const content = extractGeminiText(json);
  return extractJsonObject(content);
}
