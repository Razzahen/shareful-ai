---
title: "Fix Vercel environment variables not available in Edge Runtime"
slug: fix-vercel-env-vars-edge-runtime
tags: [vercel, edge, environment-variables, nextjs]
problem: "process.env.VAR is undefined in Edge Runtime or Middleware despite being set in Vercel dashboard"
solution_type: fix
created: 2026-02-08
environment:
  framework: nextjs
  version: "14+"
---

## Problem

Environment variables set in the Vercel dashboard work in serverless functions but return `undefined` in Edge Runtime or Middleware:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const apiKey = process.env.API_KEY; // undefined!
  // ...
}

export const config = { matcher: "/api/:path*" };
```

## Solution

Edge Runtime only has access to environment variables that are explicitly listed in `env` or available at build time via `NEXT_PUBLIC_` prefix.

**Option 1: Use `process.env` directly (it works, but requires redeployment)**

Environment variables are inlined at build time for Edge Runtime. After adding a new variable in the Vercel dashboard, you must redeploy:

```typescript
// middleware.ts -- this works after redeployment
export function middleware(request: NextRequest) {
  const apiKey = process.env.API_KEY; // works if redeployed after setting
}
```

**Option 2: For runtime-configurable values, use Vercel Edge Config**

```typescript
import { get } from "@vercel/edge-config";

export async function middleware(request: NextRequest) {
  const apiKey = await get<string>("api_key");
}
```

**Option 3: Move logic to a serverless function**

If you need full `process.env` access with runtime values, use a standard API route instead of Edge:

```typescript
// app/api/check/route.ts (serverless, not edge)
export async function GET() {
  const apiKey = process.env.API_KEY; // always available
  return Response.json({ ok: true });
}

// Remove edge runtime declaration to use serverless
// export const runtime = "edge";  <-- remove this
```

## Why It Works

Edge Runtime runs on Vercel's CDN edge network with a stripped-down V8 isolate. Unlike serverless functions (which run full Node.js), Edge functions do not have access to `process.env` at runtime. Instead, Vercel inlines environment variable values during the build step. This means changes to env vars require a redeployment to take effect in Edge functions.

## Context

- Next.js 14+ with App Router
- Applies to `middleware.ts` and any route with `export const runtime = "edge"`
- Serverless functions (`runtime: "nodejs"`, the default) always have runtime access to `process.env`
- Secret variables (not prefixed with `NEXT_PUBLIC_`) are available in Edge but only after rebuild
- `NEXT_PUBLIC_` variables are available everywhere including client-side code
