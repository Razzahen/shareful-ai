---
title: "Fix Postgres connection exhaustion in serverless environments"
slug: fix-postgres-connection-pooling-serverless
tags: [postgres, serverless, connection-pooling, vercel, lambda]
problem: "too many connections for role or FATAL: remaining connection slots are reserved in serverless functions"
solution_type: fix
created: 2026-02-08
environment:
  language: node
  framework: nextjs
---

## Problem

Serverless functions (Vercel, AWS Lambda, Netlify) create a new database connection on every invocation. Under load, this exhausts the Postgres connection limit:

```
error: remaining connection slots are reserved for non-replication superuser connections
FATAL: too many connections for role "myuser"
```

Each serverless function instance opens its own connection, and cold starts multiply the problem.

## Solution

Use a connection pooler like PgBouncer or Neon/Supabase's built-in pooler. For Vercel + Neon:

```typescript
// lib/db.ts
import { Pool } from "@neondatabase/serverless";

// Use the pooled connection string (port 5432 -> pooler port 6543)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // one connection per serverless instance
});

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
```

For Prisma, use the connection pooler URL and limit connections:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // pooled connection string
  directUrl = env("DIRECT_DATABASE_URL") // direct for migrations only
}
```

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

## Why It Works

Connection poolers (PgBouncer, Neon pooler, Supabase pooler) sit between your application and Postgres. They maintain a fixed pool of real database connections and multiplex many client connections across them. A serverless function connects to the pooler (lightweight) instead of directly to Postgres (heavy).

Setting `max: 1` per serverless instance ensures each function only holds one pooled connection. The `globalThis` pattern in dev prevents hot-reload from creating multiple Prisma clients.

## Context

- Postgres default `max_connections` is typically 100
- Vercel serverless functions can scale to hundreds of concurrent instances
- Neon pooler: change port from 5432 to 6543 in the connection string
- Supabase pooler: use the "Connection Pooling" URL from the dashboard
- For long-running servers (not serverless), a local pool with `max: 10-20` is fine
