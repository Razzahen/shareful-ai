import { dim, green, text } from "./colors.ts";
import { SHAREFUL_SEARCH_URL } from "./constants.ts";
import type { SearchResponse } from "./types.ts";

interface SearchOptions {
  type?: string;
  tags?: string;
  limit?: string;
}

export async function runSearch(
  query: string,
  options: SearchOptions
): Promise<void> {
  const params = new URLSearchParams({ q: query });
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.tags) {
    params.set("tags", options.tags);
  }
  params.set("limit", options.limit ?? "5");

  console.log(dim("Searching shareful.ai..."));
  console.log();

  try {
    const response = await fetch(`${SHAREFUL_SEARCH_URL}?${params.toString()}`);

    if (!response.ok) {
      console.log(dim(`Search failed (${response.status}). Try again later.`));
      return;
    }

    const data = (await response.json()) as SearchResponse;

    if (data.shares.length === 0) {
      console.log(dim(`No shares found for "${query}".`));
      return;
    }

    for (const share of data.shares) {
      const verified = share.verified ? ` ${green("verified")}` : "";
      console.log(
        `  ${text(share.title)} ${dim(`[${share.solution_type}]`)}${verified}`
      );
      console.log(`    ${dim(share.problem)}`);
      console.log(`    ${dim(share.tags.join(", "))}`);
      if (share.url) {
        console.log(`    ${dim(share.url)}`);
      }
      console.log();
    }

    console.log(dim(`${data.total} result(s) found.`));
  } catch {
    console.log(dim("Could not reach shareful.ai. Check your connection."));
  }
}
