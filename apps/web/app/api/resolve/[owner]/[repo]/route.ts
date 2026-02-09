import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoverShareSlugs } from "@/lib/github";
import { repos, shares, shareTags, tags } from "@/lib/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params;

    if (!(owner && repo)) {
      return NextResponse.json(
        { error: "Missing owner or repo" },
        { status: 400 }
      );
    }

    const [repoRecord] = await db
      .select()
      .from(repos)
      .where(and(eq(repos.owner, owner), eq(repos.repo, repo)))
      .limit(1);

    const dbShares = await db
      .select()
      .from(shares)
      .where(and(eq(shares.owner, owner), eq(shares.repo, repo)));

    if (dbShares.length > 0) {
      const shareIds = dbShares.map((s) => s.id);

      const tagResults = await db
        .select({ shareId: shareTags.shareId, tagName: tags.name })
        .from(shareTags)
        .innerJoin(tags, eq(tags.id, shareTags.tagId))
        .where(inArray(shareTags.shareId, shareIds));

      const tagMap = new Map<number, string[]>();
      for (const r of tagResults) {
        const existing = tagMap.get(r.shareId) ?? [];
        existing.push(r.tagName);
        tagMap.set(r.shareId, existing);
      }

      return NextResponse.json({
        owner,
        repo,
        indexed: true,
        indexed_at: repoRecord?.indexedAt?.toISOString() ?? null,
        git_sha: repoRecord?.gitSha ?? null,
        shares: dbShares.map((s) => ({
          slug: s.slug,
          title: s.title,
          problem: s.problem,
          solution_type: s.solutionType,
          tags: tagMap.get(s.id) ?? [],
          verified: s.verified > 0,
          install_count: s.installCount,
          url: s.url,
        })),
      });
    }

    // Not in DB — try discovering from GitHub directly
    const slugs = await discoverShareSlugs(owner, repo);

    if (slugs.length === 0) {
      return NextResponse.json(
        { error: `No shares found in ${owner}/${repo}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner,
      repo,
      indexed: false,
      indexed_at: null,
      git_sha: null,
      shares: slugs.map((slug) => ({
        slug,
        title: null,
        problem: null,
        solution_type: null,
        tags: [],
        verified: false,
        install_count: 0,
        url: `https://shareful.ai/s/${owner}/${repo}/${slug}`,
      })),
    });
  } catch (error) {
    console.error("Resolve error:", error);
    return NextResponse.json(
      { error: "Failed to resolve repo" },
      { status: 500 }
    );
  }
}
