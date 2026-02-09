import { extractJsonObject } from "./llm-json";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

function getOpenAiBaseUrl(): string {
  return process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL;
}

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return key;
}

async function openAiFetchJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(`${getOpenAiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as T;
}

export async function openAiEmbed(
  texts: string[],
  options?: { model?: string; signal?: AbortSignal }
): Promise<number[][]> {
  const model =
    options?.model ??
    process.env.OPENAI_EMBED_MODEL ??
    "text-embedding-3-small";

  const json = await openAiFetchJson<{
    data: { embedding: number[] }[];
  }>(
    "/embeddings",
    {
      model,
      input: texts,
    },
    options?.signal
  );

  return json.data.map((d) => d.embedding);
}

function extractChatCompletionText(json: unknown): string {
  const content = (
    json as { choices?: Array<{ message?: { content?: unknown } }> }
  )?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Model returned empty content");
  }
  return content;
}

function extractResponsesText(json: unknown): string {
  const outputText = (json as { output_text?: unknown })?.output_text;
  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText;
  }

  const output = (json as { output?: unknown })?.output;
  if (!Array.isArray(output)) {
    throw new Error("Responses API returned no output");
  }

  const parts: string[] = [];
  for (const item of output) {
    if (!(item && typeof item === "object")) {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const c of content) {
      const text = (c as { text?: unknown })?.text;
      if (typeof text === "string") {
        parts.push(text);
      }
    }
  }

  const joined = parts.join("").trim();
  if (!joined) {
    throw new Error("Responses API returned empty content");
  }
  return joined;
}

async function openAiChatCompletionsText(
  args: { system: string; user: string },
  options?: { model?: string; signal?: AbortSignal }
): Promise<string> {
  const model =
    options?.model ?? process.env.OPENAI_JUDGE_MODEL ?? "gpt-4o-mini";

  const json = await openAiFetchJson<unknown>(
    "/chat/completions",
    {
      model,
      temperature: 0,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    },
    options?.signal
  );

  return extractChatCompletionText(json);
}

async function openAiResponsesText(
  args: { system: string; user: string },
  options?: { model?: string; signal?: AbortSignal }
): Promise<string> {
  const model =
    options?.model ?? process.env.OPENAI_JUDGE_MODEL ?? "gpt-4o-mini";

  const json = await openAiFetchJson<unknown>(
    "/responses",
    {
      model,
      temperature: 0,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: args.system }],
        },
        { role: "user", content: [{ type: "input_text", text: args.user }] },
      ],
    },
    options?.signal
  );

  return extractResponsesText(json);
}

export async function openAiJudgeJson(
  args: {
    system: string;
    user: string;
  },
  options?: { model?: string; signal?: AbortSignal }
): Promise<Record<string, unknown>> {
  const api = (process.env.OPENAI_JUDGE_API ?? "auto").toLowerCase();

  const model =
    options?.model ?? process.env.OPENAI_JUDGE_MODEL ?? "gpt-4o-mini";
  const callOptions = { ...options, model };

  let content: string;
  if (api === "chat") {
    content = await openAiChatCompletionsText(args, callOptions);
  } else if (api === "responses") {
    content = await openAiResponsesText(args, callOptions);
  } else {
    try {
      content = await openAiResponsesText(args, callOptions);
    } catch {
      content = await openAiChatCompletionsText(args, callOptions);
    }
  }

  return extractJsonObject(content);
}
