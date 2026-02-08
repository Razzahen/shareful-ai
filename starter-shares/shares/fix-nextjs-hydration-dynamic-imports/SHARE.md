---
title: "Fix Next.js hydration error with dynamic imports"
slug: fix-nextjs-hydration-dynamic-imports
tags: [nextjs, react, hydration, ssr]
problem: "Component using window or document throws hydration mismatch error during SSR"
solution_type: fix
created: 2026-02-08
environment:
  framework: nextjs
  version: "14+"
---

## Problem

When a React component accesses browser-only APIs like `window`, `document`, or `localStorage` during server-side rendering, Next.js throws a hydration mismatch error:

```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

This happens because the server renders one version of the component (without browser APIs) and the client renders a different version (with browser APIs), causing a mismatch.

## Solution

Use `next/dynamic` with `ssr: false` to skip server-side rendering for components that depend on browser APIs:

```tsx
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse bg-gray-200" />,
});

export default function Page() {
  return (
    <div>
      <h1>Location</h1>
      <MapComponent />
    </div>
  );
}
```

For inline usage where you need `window` in a component you control:

```tsx
"use client";

import { useEffect, useState } from "react";

export function WindowSize() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!size) return null;
  return (
    <span>
      {size.width} x {size.height}
    </span>
  );
}
```

## Why It Works

`next/dynamic` with `ssr: false` tells Next.js to only render the component on the client. The server outputs the `loading` fallback instead, so both server and client agree on the initial HTML. Once the client hydrates, the real component mounts.

The `useEffect` approach works because `useEffect` only runs on the client after hydration. By initializing state to `null` and updating it in `useEffect`, the server and client both render `null` initially, avoiding a mismatch.

## Context

- Next.js 13+ App Router and Pages Router
- Common with map libraries (Leaflet, Mapbox), chart libraries, and any code that reads `window` dimensions
- The `"use client"` directive alone does NOT fix this -- client components still run on the server during SSR
