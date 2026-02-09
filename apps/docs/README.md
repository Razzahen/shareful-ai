# shareful.ai — Docs

> Documentation site for Shareful

Built with [Fumadocs](https://fumadocs.dev) and Next.js. Served at [shareful.ai/docs](https://shareful.ai/docs) via Vercel microfrontends.

## Getting started

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to see the result.

## Key files

| Path | Description |
|------|-------------|
| `lib/source.ts` | Content source adapter ([`loader()`](https://fumadocs.dev/docs/headless/source-api)) |
| `lib/layout.shared.tsx` | Shared layout options |
| `source.config.ts` | Fumadocs MDX config (frontmatter schema, etc.) |

## Routes

| Route | Description |
|-------|-------------|
| `app/(home)` | Landing page and other pages |
| `app/docs` | Documentation layout and pages |
| `app/api/search/route.ts` | Search route handler |

## License

MIT
