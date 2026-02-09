import { DIM, GREEN, RESET, TEXT } from "./colors.ts";
import { SHAREFUL_SEARCH_URL } from "./constants.ts";
import type { SearchResponse, SolutionType } from "./types.ts";
import { VALID_SOLUTION_TYPES } from "./types.ts";

interface SearchOptions {
  type?: SolutionType;
  tags?: string;
  limit?: number;
}

function parseSearchOptions(args: string[]): {
  query: string;
  options: SearchOptions;
} {
  const options: SearchOptions = {};
  const queryParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--type" && next) {
      options.type = next as SolutionType;
      i++;
    } else if (arg === "--tags" && next) {
      options.tags = next;
      i++;
    } else if (arg === "--limit" && next) {
      options.limit = Number.parseInt(next, 10);
      i++;
    } else if (!arg.startsWith("-")) {
      queryParts.push(arg);
    }
  }

  return { query: queryParts.join(" "), options };
}

export async function runSearch(args: string[]): Promise<void> {
  const { query, options } = parseSearchOptions(args);

  if (!query) {
    console.log(
      `${DIM}Usage:${RESET} ${TEXT}npx shareful-ai search <query>${RESET}`
    );
    console.log();
    console.log(`${DIM}Options:${RESET}`);
    console.log(
      `  ${TEXT}--type <type>${RESET}   ${DIM}Filter by: ${VALID_SOLUTION_TYPES.join(", ")}${RESET}`
    );
    console.log(
      `  ${TEXT}--tags <tags>${RESET}   ${DIM}Filter by tags (comma-separated)${RESET}`
    );
    console.log(
      `  ${TEXT}--limit <n>${RESET}    ${DIM}Max results (default: 5)${RESET}`
    );
    return;
  }

  const params = new URLSearchParams({ q: query });
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.tags) {
    params.set("tags", options.tags);
  }
  params.set("limit", String(options.limit ?? 5));

  console.log(`${DIM}Searching shareful.ai...${RESET}`);
  console.log();

  try {
    const response = await fetch(`${SHAREFUL_SEARCH_URL}?${params.toString()}`);

    if (!response.ok) {
      console.log(
        `${DIM}Search failed (${response.status}). Try again later.${RESET}`
      );
      return;
    }

    const data = (await response.json()) as SearchResponse;

    if (data.shares.length === 0) {
      console.log(`${DIM}No shares found for "${query}".${RESET}`);
      return;
    }

    for (const share of data.shares) {
      const verified = share.verified ? ` ${GREEN}verified${RESET}` : "";
      console.log(
        `  ${TEXT}${share.title}${RESET} ${DIM}[${share.solution_type}]${verified}${RESET}`
      );
      console.log(`    ${DIM}${share.problem}${RESET}`);
      console.log(`    ${DIM}${share.tags.join(", ")}${RESET}`);
      if (share.url) {
        console.log(`    ${DIM}${share.url}${RESET}`);
      }
      console.log();
    }

    console.log(`${DIM}${data.total} result(s) found.${RESET}`);
  } catch {
    console.log(
      `${DIM}Could not reach shareful.ai. Check your connection.${RESET}`
    );
  }
}
