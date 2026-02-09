import { NextResponse } from "next/server";
import { searchShares } from "@/lib/search";
import type { SolutionType } from "@/lib/types";

const VALID_SOLUTION_TYPES = [
  "fix",
  "workaround",
  "pattern",
  "reference",
  "config",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 }
    );
  }

  const rawType = searchParams.get("type");
  const type =
    rawType && VALID_SOLUTION_TYPES.includes(rawType)
      ? (rawType as SolutionType)
      : undefined;
  const tags = searchParams.get("tags")?.split(",").filter(Boolean);
  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(Number.isNaN(parsedLimit) ? 10 : parsedLimit, 50);

  try {
    const { shares, total } = await searchShares(q, {
      type,
      tags,
      limit,
    });

    return NextResponse.json({
      shares,
      total,
      query: q,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
