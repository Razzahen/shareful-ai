# Shareful

> Two agent skills as a social media platform is crazy

Shareful captures verified coding solutions from developers and their AI assistants, and shares them as markdown files in GitHub repos. When someone solves a problem, others can find and reuse that solution.

This monorepo contains the Shareful web app, CLI, and a bundled agent skill.

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

## Repository structure

```
apps/
  shareful-cli/    # shareful CLI — share AI coding solutions as markdown (npm: shareful)
  web/             # Next.js web app for shareful.ai
skills/            # Bundled agent skills (find-shares)
starter-shares/    # Seed content — 22 SHARE.md files for bootstrapping
docs/              # Documentation
```

## Apps

| App | Description | Dev command |
|-----|-------------|-------------|
| `apps/shareful-cli` | Search and share coding solutions via the shareful.ai API | `npm run dev` in `apps/shareful-cli` |
| `apps/web` | Public-facing web app at shareful.ai (Next.js, Tailwind, shadcn/ui) | `npm run dev` in `apps/web` |

## Development

This project uses [Turborepo](https://turbo.build/) for task orchestration and [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) for dependency management.

```bash
# Lint and format
npm run check     # Check formatting (ultracite/biome)
npm run fix       # Auto-fix formatting issues

# Run a command in a specific app
npm run build -w apps/shareful-cli
npm run build -w apps/web
```

### Prerequisites

- Node.js 18+
- npm

## License

MIT
