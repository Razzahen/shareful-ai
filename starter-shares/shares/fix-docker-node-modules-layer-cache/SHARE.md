---
title: "Fix Docker build cache invalidation for node_modules"
slug: fix-docker-node-modules-layer-cache
tags: [docker, node, cache, performance]
problem: "Docker rebuilds node_modules from scratch on every code change, making builds slow"
solution_type: fix
created: 2026-02-08
environment:
  language: node
---

## Problem

A naive Dockerfile copies the entire project before running `npm install`, so any source code change invalidates the layer cache and triggers a full reinstall:

```dockerfile
# Slow: any file change triggers npm install
COPY . .
RUN npm install
```

Builds take 2-5 minutes instead of seconds when only application code changed.

## Solution

Copy package files first, install dependencies, then copy source code:

```dockerfile
FROM node:20-alpine AS base

WORKDIR /app

# 1. Copy only package files (cache-friendly layer)
COPY package.json package-lock.json ./

# 2. Install dependencies (cached unless package files change)
RUN npm ci

# 3. Copy source code (changes frequently, but deps are cached)
COPY . .

# 4. Build
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=base /app/dist ./dist

USER node
CMD ["node", "dist/index.js"]
```

Add a `.dockerignore` to avoid copying unnecessary files:

```
node_modules
.git
.next
dist
*.md
.env*
```

## Why It Works

Docker caches each layer based on the inputs to that layer. By copying `package.json` and `package-lock.json` separately and installing before copying source code, the `npm ci` layer is only invalidated when dependencies actually change. Source code changes only affect the `COPY . .` layer and everything after it.

The multi-stage build keeps the final image small by only including production dependencies and compiled output.

## Context

- Works with npm, yarn, and pnpm (copy the corresponding lock file)
- For pnpm: copy `pnpm-lock.yaml` and `.npmrc`, use `RUN corepack enable && pnpm install --frozen-lockfile`
- For monorepos: copy root and workspace package files, then use `--workspace` flags
- `.dockerignore` is critical -- without it, `COPY . .` sends `node_modules` to the Docker daemon, slowing builds even if they are not used
