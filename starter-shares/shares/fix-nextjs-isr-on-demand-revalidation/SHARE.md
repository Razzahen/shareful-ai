---
title: "Fix Next.js ISR stale content with on-demand revalidation"
slug: fix-nextjs-isr-on-demand-revalidation
tags: [nextjs, isr, revalidation, caching]
problem: "ISR pages show stale content for up to revalidate seconds after updating the data source"
solution_type: pattern
created: 2026-02-08
environment:
  framework: nextjs
  version: "14+"
---

## Problem

Using time-based ISR, pages can show stale data for the entire revalidation window:

```tsx
// app/blog/[slug]/page.tsx
export const revalidate = 3600; // revalidates at most once per hour

export default async function BlogPost({ params }) {
  const post = await getPost(params.slug);
  return <article>{post.content}</article>;
}
```

After updating a blog post in the CMS, users see the old content for up to 60 minutes.

## Solution

Use on-demand revalidation triggered by webhooks or API routes:

**1. Create a revalidation API route:**

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidation-secret");
  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: "Invalid secret" }, { status: 401 });
  }

  const { path, tag } = await request.json();

  if (tag) {
    revalidateTag(tag); // invalidates all fetches with this tag
  } else if (path) {
    revalidatePath(path); // invalidates specific page
  }

  return Response.json({ revalidated: true, now: Date.now() });
}
```

**2. Tag your data fetches:**

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await fetch(`https://cms.example.com/posts/${slug}`, {
    next: { tags: [`post-${slug}`, "posts"] },
  }).then((r) => r.json());

  return <article>{post.content}</article>;
}
```

**3. Call the revalidation endpoint from your CMS webhook:**

```bash
curl -X POST https://yoursite.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidation-secret: YOUR_SECRET" \
  -d '{"tag": "post-my-blog-post"}'
```

**4. Revalidate from Server Actions:**

```tsx
"use server";

import { revalidateTag } from "next/cache";

export async function updatePost(slug: string, data: PostData) {
  await db.posts.update({ where: { slug }, data });
  revalidateTag(`post-${slug}`);
}
```

## Why It Works

Time-based ISR (`revalidate: 3600`) serves stale content until the timer expires and a request triggers regeneration. On-demand revalidation with `revalidateTag()` or `revalidatePath()` immediately marks the cached page as stale, so the next request triggers a fresh render.

Tags allow fine-grained invalidation: updating one blog post only regenerates that post's page, not all pages. `revalidatePath("/blog")` can invalidate an entire route segment.

## Context

- Next.js 13.4+ App Router for `revalidateTag` and `revalidatePath`
- Combine with a short `revalidate` time as a safety net (e.g., `revalidate = 3600` plus on-demand)
- CMS webhooks (Sanity, Contentful, Strapi) should call your revalidation endpoint on publish
- The revalidation secret prevents unauthorized cache purging
- On Vercel, on-demand revalidation works across all edge regions
