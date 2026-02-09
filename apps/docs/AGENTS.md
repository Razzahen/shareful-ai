# docs

Fumadocs documentation site for shareful.ai. Serves docs at the `/docs` path via Vercel Microfrontends integration with the web app.

## Commands

- `npm run dev` -- start dev server at http://localhost:3001
- `npm run build` -- production build
- `npm start` -- start production server
- `npm run types:check` -- run fumadocs-mdx codegen, next typegen, then `tsc --noEmit`
- `npm run lint` -- lint with Biome (`biome check`)
- `npm run format` -- format with Biome (`biome format --write`)

## Stack

- Next.js 16 (App Router)
- Fumadocs (fumadocs-core, fumadocs-ui, fumadocs-mdx)
- Tailwind CSS v4 via @tailwindcss/postcss
- Vercel Microfrontends for integration with the web app
- TypeScript strict mode

## Gotchas

- Content source is `content/docs/` with MDX files. Page ordering is controlled by `content/docs/meta.json`.
- `source.config.ts` configures the Fumadocs MDX collection -- restart the dev server after changes.
- `postinstall` runs `fumadocs-mdx` to generate types into `.source/`. These generated files are gitignored.
- Path alias `@/*` maps to the app root; `fumadocs-mdx:collections/*` maps to `.source/*`.
- Biome config is at `biome.json` in this app (not the monorepo root). It uses Biome v2 schema with Next.js and React domains enabled.
- LLM-consumable docs are served at `/docs/llms.txt`, `/docs/llms-full.txt`, and per-page at `/docs/<slug>.mdx` (rewritten to `/llms.mdx/docs/<slug>` in `next.config.mjs`).
- `next.config.mjs` wraps the config with both `withMicrofrontends` and `withMDX` -- order matters.
- The `includeProcessedMarkdown` option is enabled in `source.config.ts` to support the LLM text routes.

## Architecture

```
app/
  layout.tsx                    # Root layout
  global.css                    # Global styles (Tailwind + Fumadocs)
  (home)/                       # Home route group
    layout.tsx                  # Home layout
    page.tsx                    # Landing page at /docs
  docs/
    [[...slug]]/page.tsx        # Dynamic catch-all for doc pages
    api/search/                 # Search API route
    layout.tsx                  # Docs sidebar layout
  llms.txt/                     # /docs/llms.txt route
  llms-full.txt/                # /docs/llms-full.txt route
  llms.mdx/                     # Per-page MDX plain-text route
  og/docs/                      # OG image generation route
components/
  ai/page-actions.tsx           # AI-powered page action components
content/
  docs/                         # MDX documentation content
    meta.json                   # Page ordering and navigation
    index.mdx                   # Getting started
    cli.mdx                     # CLI reference
    configuration.mdx           # Configuration guide
    creating-shares.mdx         # Creating shares guide
    faq.mdx                     # FAQ
    finding-shares.mdx          # Finding shares guide
    publishing.mdx              # Publishing guide
    share-format.mdx            # Share format spec
lib/
  cn.ts                         # tailwind-merge utility
  layout.shared.tsx             # Shared layout configuration
  source.ts                     # Fumadocs source loader
source.config.ts                # Fumadocs MDX collection config
```
