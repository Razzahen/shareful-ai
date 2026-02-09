import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { shares } from "@/lib/schema";

const BASE_URL = "https://shareful.ai";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allShares = await db
    .select({
      owner: shares.owner,
      repo: shares.repo,
      slug: shares.slug,
      updatedAt: shares.updatedAt,
    })
    .from(shares);

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      priority: 1,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      priority: 0.8,
    },
    ...allShares.map((share) => ({
      url: `${BASE_URL}/s/${share.owner}/${share.repo}/${share.slug}`,
      lastModified: share.updatedAt ?? new Date(),
      priority: 0.7,
    })),
  ];
}
