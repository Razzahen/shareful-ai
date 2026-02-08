---
title: "Fix slow Postgres JSONB queries with proper indexing"
slug: fix-postgres-jsonb-query-performance
tags: [postgres, jsonb, indexing, performance]
problem: "JSONB queries using @> or -> operators do sequential scans and run slowly on large tables"
solution_type: fix
created: 2026-02-08
environment:
  language: sql
  framework: postgres
  version: "14+"
---

## Problem

Queries on JSONB columns perform sequential scans even on indexed tables:

```sql
-- Slow: sequential scan on 1M rows
SELECT * FROM events WHERE metadata @> '{"type": "click"}';

-- Also slow: no index for ->> operator
SELECT * FROM users WHERE preferences ->> 'theme' = 'dark';
```

`EXPLAIN ANALYZE` shows `Seq Scan` instead of `Index Scan`.

## Solution

**For containment queries (`@>`), use a GIN index:**

```sql
-- Create GIN index on the JSONB column
CREATE INDEX idx_events_metadata ON events USING GIN (metadata);

-- Now this uses the index
SELECT * FROM events WHERE metadata @> '{"type": "click"}';
SELECT * FROM events WHERE metadata @> '{"type": "click", "page": "/home"}';
```

**For specific key lookups (`->>`, `->>`), use a B-tree expression index:**

```sql
-- Index a specific JSONB key
CREATE INDEX idx_users_theme ON users ((preferences ->> 'theme'));

-- Now this uses the index
SELECT * FROM users WHERE preferences ->> 'theme' = 'dark';
```

**For nested key access:**

```sql
-- Index a nested key
CREATE INDEX idx_events_action ON events ((metadata -> 'action' ->> 'type'));

-- Uses the index
SELECT * FROM events WHERE metadata -> 'action' ->> 'type' = 'purchase';
```

**For Prisma with raw JSONB queries:**

```typescript
// Use Prisma's JsonFilter for indexed queries
const darkUsers = await prisma.user.findMany({
  where: {
    preferences: {
      path: ["theme"],
      equals: "dark",
    },
  },
});
```

## Why It Works

GIN (Generalized Inverted Index) indexes decompose JSONB documents into key-value pairs and index them individually. The `@>` containment operator can use GIN indexes to find matching documents without scanning every row.

B-tree expression indexes extract a specific value from JSONB at index-build time and store it in a regular B-tree. They are smaller and faster than GIN for queries on a single known key, but only work for the exact expression used in the index definition.

## Context

- PostgreSQL 9.4+ for JSONB, 12+ for improved GIN performance
- GIN index with `jsonb_path_ops` is more compact: `USING GIN (metadata jsonb_path_ops)` but only supports `@>` operator
- For frequently queried keys, consider extracting to a proper column instead of JSONB
- GIN indexes are slower to update than B-tree -- acceptable for read-heavy workloads
- `EXPLAIN (ANALYZE, BUFFERS)` confirms index usage and actual performance
