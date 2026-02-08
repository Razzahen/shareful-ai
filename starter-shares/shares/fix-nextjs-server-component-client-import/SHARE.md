---
title: "Fix Next.js server component importing client-only code"
slug: fix-nextjs-server-component-client-import
tags: [nextjs, react, server-components, app-router]
problem: "Server component throws error when importing useState, useEffect, or other client-side hooks"
solution_type: fix
created: 2026-02-08
environment:
  framework: nextjs
  version: "14+"
---

## Problem

A server component imports a component or hook that uses client-side APIs, causing a build or runtime error:

```
Error: useState only works in Client Components. Add the "use client" directive at the top of the file to use it.
```

Or:

```
Error: Event handlers cannot be passed to Client Component props. Remove onClick from this component or convert it to a string.
```

## Solution

**Rule: components using hooks, state, effects, or event handlers must have `"use client"` at the top.**

Restructure to keep the server component as the parent and push client interactivity to leaf components:

```tsx
// app/dashboard/page.tsx (Server Component -- no directive needed)
import { getUser } from "@/lib/db";
import { DashboardCharts } from "./charts";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const user = await getUser(); // runs on server, direct DB access

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <DashboardCharts data={user.stats} /> {/* client component */}
      <LogoutButton /> {/* client component */}
    </div>
  );
}
```

```tsx
// app/dashboard/charts.tsx
"use client";

import { useState } from "react";

export function DashboardCharts({ data }: { data: Stats }) {
  const [range, setRange] = useState("7d");
  // interactive chart logic
  return <div>...</div>;
}
```

```tsx
// app/dashboard/logout-button.tsx
"use client";

export function LogoutButton() {
  return <button onClick={() => signOut()}>Logout</button>;
}
```

**Key pattern: pass server data down as props to client components.**

```tsx
// Server component fetches data
const posts = await db.posts.findMany();

// Pass serializable data to client component
<InteractiveList items={posts} />
```

## Why It Works

In Next.js App Router, all components are server components by default. Server components run only on the server and cannot use browser APIs, hooks, or event handlers. The `"use client"` directive marks the boundary where the component tree transitions from server to client.

The boundary is at the `import` level. When a server component imports a client component, Next.js knows to send that subtree to the client. Server components above the boundary stay on the server, reducing the JavaScript bundle sent to the browser.

## Context

- Next.js 13.4+ App Router (Pages Router does not have this concept)
- Server components can import client components, but NOT vice versa (use composition pattern instead)
- Data passed from server to client components must be serializable (no functions, classes, or Date objects without conversion)
- Third-party components without `"use client"` need a wrapper: create a client file that re-exports them
