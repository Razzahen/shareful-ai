---
title: "Fix Prisma migration drift between schema and database"
slug: fix-prisma-migration-drift
tags: [prisma, migration, database, schema]
problem: "Prisma warns about migration drift or shadow database mismatch after manual DB changes"
solution_type: fix
created: 2026-02-08
environment:
  framework: prisma
  version: "5.0+"
---

## Problem

After making manual changes to the database (adding columns, modifying types) or pulling from a different branch, Prisma reports:

```
Error: The current database is not managed by Prisma Migrate.
Drift detected: Your database schema is not in sync with your migration history.
```

Or `prisma migrate dev` fails because the shadow database does not match the expected state.

## Solution

**Scenario 1: Manual DB changes need to be captured in a migration**

```bash
# Create a migration from the current DB state without applying it
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > prisma/migrations/YYYYMMDDHHMMSS_manual_changes/migration.sql

# Or let Prisma detect and create the migration automatically
npx prisma migrate dev --name sync_manual_changes
```

**Scenario 2: Reset migration history to match current DB (development only)**

```bash
# Mark all existing migrations as applied without running them
npx prisma migrate resolve --applied "20240101000000_init"

# Or reset everything (WARNING: drops all data)
npx prisma migrate reset
```

**Scenario 3: Baseline an existing database**

```bash
# Create a baseline migration from the existing DB
mkdir -p prisma/migrations/0_init

# Generate SQL that represents the current DB state
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# Mark it as already applied
npx prisma migrate resolve --applied 0_init
```

**Scenario 4: Fix shadow database issues**

```bash
# Use a direct URL for migrations (bypasses connection pooler)
# In schema.prisma:
# datasource db {
#   url       = env("DATABASE_URL")
#   directUrl = env("DIRECT_DATABASE_URL")
# }

# Then run migrate dev normally
npx prisma migrate dev
```

## Why It Works

Prisma Migrate tracks applied migrations in a `_prisma_migrations` table in your database. Drift occurs when the actual database schema differs from what the migration history says it should be. `migrate resolve` updates the tracking table without modifying the database, while `migrate diff` generates the SQL needed to bring them in sync.

The shadow database is a temporary database Prisma creates during `migrate dev` to validate migrations from scratch. `directUrl` ensures Prisma can create and drop this temporary database (connection poolers often block `CREATE DATABASE`).

## Context

- Prisma 4.x+ for `migrate diff`, Prisma 5.x+ for improved drift detection
- NEVER run `migrate reset` in production -- it drops and recreates the database
- For production deployments, use `npx prisma migrate deploy` (not `migrate dev`)
- Team workflow: always commit migrations to git, never edit applied migration files
- If two branches create conflicting migrations, merge and run `migrate dev` to reconcile
