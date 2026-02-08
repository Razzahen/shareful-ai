---
title: "Fix Docker image size with multi-stage builds for Node.js"
slug: fix-docker-multistage-build-size
tags: [docker, node, image-size, optimization]
problem: "Docker image for Node.js app is 1GB+ due to dev dependencies and build artifacts"
solution_type: pattern
created: 2026-02-08
environment:
  language: node
---

## Problem

A single-stage Dockerfile produces images over 1GB because it includes dev dependencies, source code, build tools, and the full Node.js distribution:

```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/index.js"]
# Image size: ~1.2GB
```

## Solution

Use a multi-stage build with an Alpine base for the production image:

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy only production dependencies and build output
COPY package.json package-lock.json ./
RUN npm ci --production --ignore-scripts
COPY --from=builder /app/dist ./dist

USER appuser

EXPOSE 3000
CMD ["node", "dist/index.js"]
# Image size: ~150MB
```

**For Next.js standalone output (even smaller):**

```javascript
// next.config.ts
export default {
  output: "standalone",
};
```

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
# Image size: ~100MB
```

## Why It Works

Multi-stage builds use multiple `FROM` statements. Each stage starts fresh -- only files explicitly copied with `COPY --from=<stage>` are included in the final image. Dev dependencies, source code, and build tools are left behind in earlier stages.

Alpine Linux images are ~5MB vs ~150MB for Debian-based images. Combined with production-only dependencies and compiled output, the final image contains only what is needed at runtime.

## Context

- Docker 17.05+ for multi-stage builds
- `node:20-alpine` is ~50MB smaller than `node:20-slim` which is ~200MB smaller than `node:20`
- Next.js `standalone` output traces and bundles only used dependencies, producing the smallest possible server
- For monorepos, consider using `turbo prune` to copy only the relevant workspace
- Native add-ons (bcrypt, sharp) may need additional Alpine packages: `RUN apk add --no-cache python3 make g++`
