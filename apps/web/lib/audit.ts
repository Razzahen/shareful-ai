import { db } from "./db";
import { indexEvents } from "./schema";

export async function logIndexEvent(
  eventType: string,
  owner: string,
  repo: string,
  slug?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(indexEvents).values({
    eventType,
    owner,
    repo,
    slug: slug ?? null,
    metadata: metadata ?? null,
  });
}
