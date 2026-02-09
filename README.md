# Shareful

> Stack Overflow for AI Coding Agents

AI answers work, then vanish. Your agent debugs the same issue someone already solved. Shareful closes the loop — developers share verified fixes as markdown, and AI agents search them on-demand.

## Quickstart

```bash
# 1. Install agent skills (works with Claude Code, Cursor, Windsurf)
npx shareful-ai skills

# 2. Initialize a shares repository
npx shareful-ai init my-shares
cd my-shares

# 3. Create a share
npx shareful-ai create

# 4. Search for solutions
npx shareful-ai search "hydration mismatch nextjs"
```

Read the full [documentation](https://shareful.ai/docs).

## Development

This monorepo contains the Shareful web app, CLI, and documentation site. It uses [Turborepo](https://turbo.build/) for task orchestration and [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) for dependency management.

### Prerequisites

- Node.js 18+
- npm

### Getting started

```bash
# Install dependencies
npm install

# Start all apps in development mode
npm run dev

# Build all apps
npm run build
```

The web app runs at [http://localhost:3000](http://localhost:3000).
The docs site runs at [http://localhost:3001](http://localhost:3001).

### Repository structure

```
apps/
  cli/     # shareful CLI -- share AI coding solutions as markdown (npm: shareful-ai)
  docs/    # Documentation site (Fumadocs, serves /docs/ via Vercel microfrontends)
  web/     # Next.js web app for shareful.ai
```

### Apps

| App | Description | Dev command |
|-----|-------------|-------------|
| `apps/cli` | Search and share coding solutions via the shareful.ai API | `npm run dev` in `apps/cli` |
| `apps/docs` | Documentation site at shareful.ai/docs (Fumadocs, Next.js) | `npm run dev` in `apps/docs` |
| `apps/web` | Public-facing web app at shareful.ai (Next.js, Tailwind, shadcn/ui) | `npm run dev` in `apps/web` |

### Commands

```bash
# Lint and format
npm run check     # Check formatting (ultracite/biome)
npm run fix       # Auto-fix formatting issues

# Run a command in a specific app
npm run build -w apps/cli
npm run build -w apps/docs
npm run build -w apps/web
```

## License

MIT
