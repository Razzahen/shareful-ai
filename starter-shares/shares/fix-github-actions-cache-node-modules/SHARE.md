---
title: "Fix GitHub Actions slow builds by caching node_modules"
slug: fix-github-actions-cache-node-modules
tags: [github-actions, ci, cache, node]
problem: "GitHub Actions CI runs npm install on every push, adding 2-5 minutes to each build"
solution_type: fix
created: 2026-02-08
environment:
  framework: github-actions
---

## Problem

Every CI run downloads and installs all npm dependencies from scratch:

```yaml
# Slow: full install every time
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
  - run: npm install  # 2-5 minutes every time
  - run: npm test
```

## Solution

Use `actions/setup-node` with its built-in caching, or use `actions/cache` for finer control:

**Option 1: Built-in cache (simplest)**

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: "npm" # caches ~/.npm based on package-lock.json
  - run: npm ci # uses cache, ~30 seconds
  - run: npm test
```

**Option 2: Cache node_modules directly (fastest)**

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20

  - name: Cache node_modules
    id: cache-deps
    uses: actions/cache@v4
    with:
      path: node_modules
      key: node-modules-${{ hashFiles('package-lock.json') }}

  - name: Install dependencies
    if: steps.cache-deps.outputs.cache-hit != 'true'
    run: npm ci

  - run: npm test
```

**Option 3: For pnpm**

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: pnpm/action-setup@v4
    with:
      version: 9
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: "pnpm"
  - run: pnpm install --frozen-lockfile
  - run: pnpm test
```

## Why It Works

`actions/cache` stores the `node_modules` directory (or npm's global cache) between workflow runs. The cache key is based on the hash of `package-lock.json`, so the cache is invalidated only when dependencies change. On cache hit, `npm ci` is skipped entirely (Option 2) or runs much faster using cached packages (Option 1).

Option 1 caches the npm download cache (`~/.npm`), so `npm ci` still runs but does not download packages. Option 2 caches the installed `node_modules` directly and skips `npm ci` entirely on cache hit, which is faster.

## Context

- GitHub Actions cache has a 10GB limit per repository
- Cache entries not accessed for 7 days are evicted
- Use `npm ci` instead of `npm install` in CI -- it is faster and respects the lockfile exactly
- For monorepos with multiple `package-lock.json` files, use `hashFiles('**/package-lock.json')`
- Cache is scoped to the branch; PRs can read cache from the base branch
