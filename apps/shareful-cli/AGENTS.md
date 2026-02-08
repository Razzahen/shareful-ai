# shareful

CLI for sharing AI coding solutions as markdown files in GitHub repos.

## Commands

- `npm dev` — run CLI directly via `node src/cli.ts`
- `npm build` — bundle with obuild to `dist/cli.mjs`
- `npm type-check` — TypeScript check without emitting (`tsc --noEmit`)
- `npm format` — format with Prettier
- `npm format:check` — check formatting without fixing

## CLI usage

```bash
npx shareful init [name]     # Create a shares repo with sample SHARE.md
npx shareful create          # Create a new share interactively
npx shareful publish         # Validate, commit, push, and index
npx shareful list            # List shares in current repo
```

Aliases: `create` = `new`, `publish` = `push`, `list` = `ls`

## Gotchas

- `create` has dual modes: interactive (default) or non-interactive (when all flags provided: `-t`, `-p`, `--tags`, `--type`). If adding new required fields, update both paths
- `publish` extracts `owner/repo` from the git remote URL. It handles both SSH (`git@github.com:owner/repo.git`) and HTTPS formats. If remote parsing fails, it falls back to `"unknown"`
- SHARE.md body is validated for max 300 lines and must contain four required sections: `## Problem`, `## Solution`, `## Why It Works`, `## Context`. Missing sections cause validation failure
- Slug is auto-generated from title (lowercase, strip special chars, max 64 chars). The slug must match its parent directory name — `shares/{slug}/SHARE.md`
- `shareful.json` manifest is auto-generated on publish. Do not edit it manually — it gets overwritten

## Architecture

```
src/
  cli.ts            # Entry point, command routing, banner display
  create.ts         # Interactive share creation with @clack/prompts
  publish.ts        # Validation → git add/commit/push → POST /api/index
  share-parser.ts   # YAML frontmatter parsing and validation (gray-matter)
  manifest.ts       # Read/write shareful.json
  types.ts          # ShareFrontmatter, ParsedShare, ShareManifest interfaces
  constants.ts      # API URLs, directory names, file names
  telemetry.ts      # Optional anonymous tracking (disabled via DISABLE_TELEMETRY)
```

## Conventions

- Frontmatter constraints: title max 128 chars, slug max 64 chars (`[a-z0-9-]`), problem max 256 chars, 1-10 tags (each max 32 chars)
- Solution types: `fix`, `workaround`, `pattern`, `reference`, `config`
- Git commit message format: `shareful: update N share(s)`
- API endpoint: `https://shareful.ai/api/index` (POST with `{ repo: "owner/repo" }`)
