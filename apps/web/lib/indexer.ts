import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { fetchManifest, fetchShareMd } from "./github";
import { shares, shareTags, tags } from "./schema";
import { parseShareMd } from "./share-parser";
import type { Share } from "./types";

async function upsertTags(tagNames: string[]): Promise<number[]> {
  const tagIds: number[] = [];

  for (const name of tagNames) {
    const [result] = await db
      .insert(tags)
      .values({ name })
      .onConflictDoNothing({ target: tags.name })
      .returning({ id: tags.id });

    if (result) {
      tagIds.push(result.id);
    } else {
      const [existing] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.name, name))
        .limit(1);
      if (existing) {
        tagIds.push(existing.id);
      }
    }
  }

  return tagIds;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: upsert logic is inherently sequential
export async function indexRepo(owner: string, repo: string): Promise<number> {
  const manifest = await fetchManifest(owner, repo);
  let indexed = 0;

  for (const entry of manifest.shares) {
    try {
      const raw = await fetchShareMd(owner, repo, entry.slug);
      const { frontmatter, content } = parseShareMd(raw);

      const [share] = await db
        .insert(shares)
        .values({
          owner,
          repo,
          slug: frontmatter.slug,
          title: frontmatter.title,
          problem: frontmatter.problem,
          solutionType: frontmatter.solution_type,
          content,
          url: `https://shareful.ai/s/${owner}/${repo}/${frontmatter.slug}`,
          verified: frontmatter.verified ? 1 : 0,
          aiProvider: frontmatter.ai_provider ?? null,
          environment: frontmatter.environment ?? null,
          related: frontmatter.related ?? null,
          createdAt: frontmatter.created ? new Date(frontmatter.created) : null,
          updatedAt: frontmatter.updated ? new Date(frontmatter.updated) : null,
        })
        .onConflictDoUpdate({
          target: [shares.owner, shares.repo, shares.slug],
          set: {
            title: frontmatter.title,
            problem: frontmatter.problem,
            solutionType: frontmatter.solution_type,
            content,
            url: `https://shareful.ai/s/${owner}/${repo}/${frontmatter.slug}`,
            verified: frontmatter.verified ? 1 : 0,
            aiProvider: frontmatter.ai_provider ?? null,
            environment: frontmatter.environment ?? null,
            related: frontmatter.related ?? null,
            updatedAt: frontmatter.updated
              ? new Date(frontmatter.updated)
              : null,
            indexedAt: new Date(),
          },
        })
        .returning({ id: shares.id });

      await db.delete(shareTags).where(eq(shareTags.shareId, share.id));

      const tagIds = await upsertTags(frontmatter.tags);
      if (tagIds.length > 0) {
        await db
          .insert(shareTags)
          .values(tagIds.map((tagId) => ({ shareId: share.id, tagId })));
      }

      indexed++;
    } catch (e) {
      console.error(`Failed to index ${entry.slug} from ${owner}/${repo}:`, e);
    }
  }

  return indexed;
}

export async function getShare(
  owner: string,
  repo: string,
  slug: string
): Promise<Share | null> {
  const result = await db.query.shares.findFirst({
    where: and(
      eq(shares.owner, owner),
      eq(shares.repo, repo),
      eq(shares.slug, slug)
    ),
    with: {
      shareTags: {
        with: { tag: true },
      },
    },
  });

  if (!result) {
    return null;
  }

  return {
    title: result.title,
    slug: result.slug,
    tags: result.shareTags.map((st) => st.tag.name),
    problem: result.problem,
    solution_type: result.solutionType,
    verified: result.verified > 0,
    created: result.createdAt?.toISOString(),
    updated: result.updatedAt?.toISOString(),
    ai_provider: result.aiProvider ?? undefined,
    environment: result.environment ?? undefined,
    related: result.related ?? undefined,
    owner: result.owner,
    repo: result.repo,
    content: result.content,
    url: result.url,
  };
}
