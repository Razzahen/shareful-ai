export function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed) as Record<string, unknown>;
  }

  const slice = findFirstJsonObjectSlice(trimmed);
  if (!slice) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(slice) as Record<string, unknown>;
}

function findFirstJsonObjectSlice(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  const end = findMatchingObjectEnd(text, start);
  return end === null ? null : text.slice(start, end + 1);
}

function findMatchingObjectEnd(
  text: string,
  startIndex: number
): number | null {
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (!ch) {
      continue;
    }

    const next = nextStringState({ ch, inString, isEscaped });
    inString = next.inString;
    isEscaped = next.isEscaped;

    if (inString) {
      continue;
    }

    if (ch === "{") {
      depth++;
      continue;
    }

    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return null;
}

function nextStringState(args: {
  ch: string;
  inString: boolean;
  isEscaped: boolean;
}): { inString: boolean; isEscaped: boolean } {
  if (!args.inString) {
    return {
      inString: args.ch === '"',
      isEscaped: false,
    };
  }

  if (args.isEscaped) {
    return { inString: true, isEscaped: false };
  }

  if (args.ch === "\\") {
    return { inString: true, isEscaped: true };
  }

  if (args.ch === '"') {
    return { inString: false, isEscaped: false };
  }

  return { inString: true, isEscaped: false };
}
