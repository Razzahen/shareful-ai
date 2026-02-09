# web

Next.js web app for shareful.ai. Displays, searches, and indexes shared coding solutions.

## Commands

- `npm run dev` -- start dev server at http://localhost:3000
- `npm run build` -- production build
- `npm run lint` -- run Biome linter (`biome check`)
- `npm run format` -- auto-format with Biome (`biome format --write`)
- `npm start` -- start production server
- `npm run db:generate` -- generate Drizzle migration files
- `npm run db:migrate` -- run pending migrations
- `npm run db:push` -- push schema to database (dev shortcut, skips migration files)
- `npm run db:studio` -- open Drizzle Studio GUI for the database

## Stack

- Next.js 16 (App Router, React 19, React Compiler enabled)
- Tailwind CSS v4 via `@tailwindcss/postcss`
- shadcn/ui components in `components/ui/`
- Drizzle ORM + Neon PostgreSQL (primary database)
- Vercel KV (Redis) for view-count caching only
- TypeScript strict mode

## Gotchas

- The `cn()` utility in `lib/utils.ts` combines `clsx` + `tailwind-merge`. Always use `cn()` for conditional class names, not raw template literals
- GitHub API calls in `lib/github.ts` use an optional `GITHUB_TOKEN` env var. Without it, requests are rate-limited to 60/hour
- Biome config is inherited from the monorepo root `biome.jsonc` (Ultracite). There is no `biome.json` in this app directory
- Remote images must be allowlisted in `next.config.ts` under `images.remotePatterns`
- Database schema lives in `lib/schema.ts`. After changing it, run `npm run db:generate` then `npm run db:migrate`. Never edit generated SQL files in `drizzle/`
- Full-text search uses PostgreSQL `tsvector` + `pg_trgm`. GIN indexes are created via a manual SQL migration (`drizzle/0001_setup_fts.sql`), not by Drizzle schema

## Architecture

```
app/
  page.tsx                          # Homepage with leaderboards
  search/page.tsx                   # Full-text search
  leaderboard/page.tsx              # Contributor rankings
  submit/page.tsx                   # Register a GitHub repo
  s/[owner]/[repo]/[slug]/page.tsx  # Individual share detail
  u/[username]/page.tsx             # User profile
  api/
    search/route.ts                 # GET -- full-text search with filters
    registry/route.ts               # GET/POST -- manage registered repos
    index/route.ts                  # POST -- trigger repo indexing
    verify/route.ts                 # POST -- record solution verification
    outcome/route.ts                # POST -- record success/failure
    profile/[username]/route.ts     # GET -- contributor profile data
components/
  share-card.tsx, share-detail.tsx  # Share display components
  contributor-card.tsx              # Contributor stats card
  shares-leaderboard.tsx            # Tabbed leaderboard (all-time/trending/recent)
  header.tsx, footer.tsx            # Site layout components
  search-bar.tsx                    # Search input component
  solution-type-badge.tsx           # Badge for solution type
  tag-badge.tsx                     # Badge for tags
  copy-command.tsx                  # Copy-to-clipboard for commands
  agent-logos.tsx                   # AI provider logo display
  ui/                               # shadcn/ui base components
lib/
  db.ts                             # Drizzle client (Neon serverless driver)
  schema.ts                         # Drizzle table definitions (repos, shares, tags, outcomes, verifications)
  types.ts                          # All TypeScript interfaces
  indexer.ts                        # GitHub content fetching and database upsert
  search.ts                         # Full-text search (PostgreSQL tsvector + trigram)
  homepage.ts                       # Leaderboard queries (all-time, trending, recent)
  registry.ts                       # Repo registration and lookup
  reputation.ts                     # Reputation scoring and leaderboards
  github.ts                         # GitHub API client
  share-parser.ts                   # SHARE.md frontmatter parsing
  utils.ts                          # cn() utility
```

## Conventions

- Database tables: `repos`, `shares`, `tags`, `share_tags`, `outcomes`, `verifications` (defined in `lib/schema.ts`)
- KV is used only for view counts: `views:{owner}/{repo}/{slug}`
- Search scoring uses PostgreSQL FTS ranking + trigram similarity
- Solution types: `fix`, `workaround`, `pattern`, `reference`, `config`
