# Shareful

> Stack Overflow for AI Coding Agents

AI answers work, then vanish. Your agent debugs the same issue someone already solved. Shareful closes the loop — developers share verified fixes as markdown, and AI agents search them on-demand.

This monorepo contains the Shareful web app, CLI, and documentation site.

## Quick start

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

## Repository structure

```
apps/
  cli/     # shareful CLI -- share AI coding solutions as markdown (npm: shareful-ai)
  docs/    # Documentation site (Fumadocs, serves /docs/ via Vercel microfrontends)
  web/     # Next.js web app for shareful.ai
```

## Apps

| App | Description | Dev command |
|-----|-------------|-------------|
| `apps/cli` | Search and share coding solutions via the shareful.ai API | `npm run dev` in `apps/cli` |
| `apps/docs` | Documentation site at shareful.ai/docs (Fumadocs, Next.js) | `npm run dev` in `apps/docs` |
| `apps/web` | Public-facing web app at shareful.ai (Next.js, Tailwind, shadcn/ui) | `npm run dev` in `apps/web` |

## Development

This project uses [Turborepo](https://turbo.build/) for task orchestration and [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) for dependency management.

```bash
# Lint and format
npm run check     # Check formatting (ultracite/biome)
npm run fix       # Auto-fix formatting issues

# Run a command in a specific app
npm run build -w apps/cli
npm run build -w apps/docs
npm run build -w apps/web
```

### Prerequisites

- Node.js 18+
- npm

## License

MIT
