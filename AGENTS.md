# Shareful

Monorepo for shareful.ai — verified coding solutions shared as markdown in GitHub repos.

## Commands

- `npm install` — install all workspace dependencies
- `npm run dev` — start all apps in development mode (Turborepo)
- `npm run build` — build all apps
- `npm run check` — check formatting (ultracite/biome)
- `npm run fix` — auto-fix formatting issues

## Scope

- Root file: shared rules only
- `apps/web/AGENTS.md`: web app rules
- `apps/shareful-cli/AGENTS.md`: shareful CLI rules
- `apps/cli/AGENTS.md`: skills CLI rules

## Workspace structure

| App | Package name | Purpose |
|-----|-------------|---------|
| `apps/web` | `web` | Next.js web app at shareful.ai |
| `apps/shareful-cli` | `shareful` | CLI for sharing coding solutions |
| `apps/cli` | `skills` | CLI for the agent skills ecosystem |

Run a command in a specific workspace:

```bash
npm run dev -w apps/web
npm run dev -w apps/shareful-cli
npm test -w apps/cli
```

## Cross-workspace gotchas

- IMPORTANT: Run `npm run fix` before committing — husky pre-commit hook runs `ultracite fix` on staged files and will reject unformatted code
- The `apps/cli` and `apps/shareful-cli` packages use `obuild` for bundling. The `apps/web` package uses Next.js. Do not mix build tooling across workspaces
- `apps/web` uses Biome for linting/formatting. `apps/cli` and `apps/shareful-cli` use Prettier. Do not apply one formatter to the other's files

## Conventions

- TypeScript strict mode in all workspaces
- SHARE.md files live in `shares/{slug}/SHARE.md` (shareful content format)
- SKILL.md files live in `skills/{name}/SKILL.md` (agent skills format)
- Seed content is in `starter-shares/` — these are example SHARE.md files for bootstrapping
