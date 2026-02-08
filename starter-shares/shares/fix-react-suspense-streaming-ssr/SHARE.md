---
title: "Fix React Suspense boundaries for streaming SSR in Next.js"
slug: fix-react-suspense-streaming-ssr
tags: [react, suspense, ssr, streaming, nextjs]
problem: "Async server component blocks entire page load instead of streaming progressively"
solution_type: pattern
created: 2026-02-08
environment:
  framework: nextjs
  version: "14+"
---

## Problem

A page with a slow data fetch blocks the entire page from rendering. The user sees a blank screen until all data loads:

```tsx
// app/dashboard/page.tsx -- entire page waits for slow query
export default async function Dashboard() {
  const analytics = await getAnalytics(); // 3 seconds
  const user = await getUser(); // 200ms

  return (
    <div>
      <UserHeader user={user} />
      <AnalyticsPanel data={analytics} />
    </div>
  );
}
```

## Solution

Wrap slow components in `<Suspense>` boundaries with fallbacks to enable streaming:

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react";
import { UserHeader } from "./user-header";
import { AnalyticsPanel } from "./analytics-panel";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Dashboard() {
  const user = await getUser(); // fast, load immediately

  return (
    <div>
      <UserHeader user={user} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AnalyticsPanel /> {/* fetches its own data */}
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}
```

```tsx
// app/dashboard/analytics-panel.tsx -- async server component
export async function AnalyticsPanel() {
  const data = await getAnalytics(); // 3 seconds, streams when ready
  return <div>{/* render analytics */}</div>;
}
```

**For parallel data fetching without Suspense:**

```tsx
export default async function Dashboard() {
  // Start both fetches simultaneously
  const [user, analytics] = await Promise.all([getUser(), getAnalytics()]);

  return (
    <div>
      <UserHeader user={user} />
      <AnalyticsPanel data={analytics} />
    </div>
  );
}
```

## Why It Works

React streaming SSR sends HTML to the browser in chunks. Without Suspense, Next.js waits for all `await` calls in a component to resolve before sending any HTML. With Suspense, the server sends the shell (layout + fallbacks) immediately, then streams each Suspense boundary's content as it resolves.

The user sees the page layout and loading skeletons instantly, then content fills in progressively. This dramatically improves perceived performance.

## Context

- Next.js 13.4+ App Router with React 18+ streaming
- Each `<Suspense>` boundary creates an independent streaming chunk
- Nested Suspense boundaries stream independently (inner can resolve before outer)
- `loading.tsx` files are syntactic sugar for wrapping the route segment in Suspense
- The `Promise.all` approach is better when you need all data before rendering (no progressive display)
