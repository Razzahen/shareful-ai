---
title: "Fix Prisma N+1 query problem with includes and joins"
slug: fix-prisma-n-plus-one-queries
tags: [prisma, database, performance, n-plus-one]
problem: "Prisma makes hundreds of individual queries when loading related data in a loop"
solution_type: fix
created: 2026-02-08
environment:
  language: typescript
  framework: prisma
---

## Problem

Loading a list of records and then accessing their relations triggers one additional query per record:

```typescript
// N+1 problem: 1 query for posts + N queries for authors
const posts = await prisma.post.findMany();

for (const post of posts) {
  // Each access triggers a separate SQL query!
  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
  });
  console.log(post.title, author.name);
}
```

With 100 posts, this generates 101 database queries.

## Solution

**Option 1: Use `include` to eager-load relations (recommended)**

```typescript
const posts = await prisma.post.findMany({
  include: {
    author: true, // JOINs author in a single query
    comments: {
      include: {
        user: true, // nested includes work too
      },
    },
  },
});

// No additional queries needed
for (const post of posts) {
  console.log(post.title, post.author.name);
}
```

**Option 2: Use `select` for specific fields (better performance)**

```typescript
const posts = await prisma.post.findMany({
  select: {
    title: true,
    createdAt: true,
    author: {
      select: {
        name: true,
        avatar: true,
      },
    },
  },
});
```

**Option 3: Use `relationLoadStrategy: "join"` for a single SQL query (Prisma 5.9+)**

```typescript
const posts = await prisma.post.findMany({
  relationLoadStrategy: "join", // single SQL JOIN instead of multiple queries
  include: {
    author: true,
    tags: true,
  },
});
```

## Why It Works

By default, Prisma loads relations lazily -- it only queries the database when you access a relation. `include` tells Prisma to load relations eagerly in the initial query. Under the hood, Prisma issues a second query with an `IN` clause (e.g., `WHERE id IN (1, 2, 3, ...)`) rather than one query per record.

With `relationLoadStrategy: "join"`, Prisma generates a single SQL query with `JOIN` clauses, which can be faster for simple relations.

## Context

- Prisma 4.x+ for `include`, Prisma 5.9+ for `relationLoadStrategy: "join"`
- Use Prisma's query logging to detect N+1: `new PrismaClient({ log: ["query"] })`
- For GraphQL resolvers, consider `prisma-graphql-fields-optimizer` or DataLoader pattern
- `select` is more efficient than `include` when you do not need all columns
