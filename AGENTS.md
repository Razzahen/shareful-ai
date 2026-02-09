# Shareful

Monorepo for shareful.ai -- verified coding solutions shared as markdown in GitHub repos.

## Commands

- `npm install` -- install all workspace dependencies
- `npm run dev` -- start all apps in development mode (Turborepo)
- `npm run build` -- build all apps
- `npm run check` -- check formatting (ultracite/biome)
- `npm run fix` -- auto-fix formatting issues

## Scope

- Root file: shared rules only
- `apps/web/AGENTS.md`: web app rules
- `apps/cli/AGENTS.md`: shareful CLI rules
- `apps/docs/AGENTS.md`: documentation site rules

## Workspace structure

| App | Package name | Purpose |
|-----|-------------|---------|
| `apps/web` | `web` | Next.js web app at shareful.ai |
| `apps/cli` | `shareful-ai` | CLI for sharing coding solutions |
| `apps/docs` | `docs` | Fumadocs documentation site |

Run a command in a specific workspace:

```bash
npm run dev -w apps/web
npm run dev -w apps/cli
npm run dev -w apps/docs
```

## Cross-workspace gotchas

- IMPORTANT: Run `npm run fix` before committing -- husky pre-commit hook runs `ultracite fix` on staged files and will reject unformatted code
- The `apps/cli` package uses `obuild` for bundling. The `apps/web` and `apps/docs` packages use Next.js. Do not mix build tooling across workspaces
- `apps/web` and `apps/docs` use Biome for linting/formatting via the root `biome.jsonc`. `apps/cli` uses Prettier. Do not apply one formatter to the other's files

## Conventions

- TypeScript strict mode in all workspaces
- SHARE.md files live in `shares/{slug}/SHARE.md` (shareful content format)
