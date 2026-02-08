---
title: "Fix Next.js App Router custom 404 not-found page"
slug: fix-nextjs-app-router-not-found
tags: [nextjs, app-router, 404, routing]
problem: "Custom 404 page not showing or notFound() function not triggering the not-found page"
solution_type: fix
created: 2026-02-08
environment:
  framework: nextjs
  version: "14+"
---

## Problem

You created a custom 404 page in the Next.js App Router but it does not appear. Either you get the default Next.js 404, or `notFound()` throws an error:

```
Error: NEXT_NOT_FOUND
```

Or the not-found page renders but without the root layout.

## Solution

**1. Create `app/not-found.tsx` at the root level:**

```tsx
// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-gray-600">Page not found</p>
      <Link href="/" className="mt-4 text-blue-600 underline">
        Go home
      </Link>
    </div>
  );
}
```

**2. Use `notFound()` in server components and route handlers:**

```tsx
// app/posts/[slug]/page.tsx
import { notFound } from "next/navigation";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound(); // renders app/not-found.tsx
  }

  return <article>{post.content}</article>;
}
```

**3. For segment-level not-found pages, create `not-found.tsx` in that route segment:**

```
app/
  not-found.tsx              # catches all unmatched routes
  blog/
    not-found.tsx            # catches /blog/* misses
    [slug]/
      page.tsx               # calls notFound() for invalid slugs
```

## Why It Works

Next.js App Router looks for `not-found.tsx` in the nearest route segment, then walks up to the root. The root `app/not-found.tsx` catches all unmatched URLs automatically (no explicit call needed). The `notFound()` function throws a special `NEXT_NOT_FOUND` error that Next.js catches and renders the nearest `not-found.tsx`.

The file must be named exactly `not-found.tsx` (not `404.tsx`, not `NotFound.tsx`). The Pages Router convention of `pages/404.tsx` does not work in App Router.

## Context

- Next.js 13.4+ App Router
- `not-found.tsx` is a server component by default (add `"use client"` only if needed)
- The root `app/not-found.tsx` is automatically wrapped in `app/layout.tsx`
- `notFound()` works in server components, route handlers, and server actions
- For Pages Router, use `pages/404.tsx` instead
