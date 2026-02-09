# shareful-ai

CLI for sharing AI coding solutions as markdown files in GitHub repos.

## Commands

- `npm run dev` -- run CLI directly via `node src/cli.ts`
- `npm run build` -- bundle with obuild to `dist/cli.mjs`
- `npm run type-check` -- TypeScript check without emitting (`tsc --noEmit`)
- `npm run format` -- format with Prettier
- `npm run format:check` -- check formatting without fixing

## CLI usage

```bash
npx shareful-ai init [name]     # Create a shares repo with sample SHARE.md
npx shareful-ai create          # Create a new share interactively
npx shareful-ai search <query>  # Search shareful.ai for solutions
npx shareful-ai check           # Validate all SHARE.md files in repo
```

## Gotchas

- `create` has dual modes: interactive (default) or non-interactive (when all flags provided: `-t`, `-p`, `--tags`, `--type`). If adding new required fields, update both paths
- SHARE.md body must contain four required sections: `## Problem`, `## Solution`, `## Why It Works`, `## Context`. Missing sections cause validation failure
- Slug is auto-generated from title (lowercase, strip special chars, max 64 chars). The slug must match its parent directory name -- `shares/{slug}/SHARE.md`
- `check` validates every `shares/*/SHARE.md` in the current repo. Exits with code 1 if any share is invalid

## Architecture

```
src/
  cli.ts            # Entry point, command routing, banner display
  create.ts         # Interactive share creation with @clack/prompts
  check.ts          # Validate all SHARE.md files in repo
  init.ts           # Scaffold a new shares repository
  search.ts         # Search shareful.ai API for solutions
  share-parser.ts   # YAML frontmatter parsing and validation (gray-matter)
  config.ts         # Load config for shares repo path
  types.ts          # ShareFrontmatter, ParsedShare, SolutionType interfaces
  constants.ts      # API URLs, directory names, file names
  colors.ts         # ANSI color escape codes
  telemetry.ts      # Optional anonymous tracking (disabled via DISABLE_TELEMETRY)
```

## Conventions

- Frontmatter constraints: title max 128 chars, slug max 64 chars (`[a-z0-9-]`), problem max 256 chars, 1-10 tags (each max 32 chars)
- Solution types: `fix`, `workaround`, `pattern`, `reference`, `config`
- API search endpoint: `https://shareful.ai/api/search`
