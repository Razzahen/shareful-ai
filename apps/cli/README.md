# shareful-ai

Share AI coding solutions as markdown files in GitHub repos.

## Install

```sh
npm install -g shareful-ai
```

Requires Node.js 18+.

## Quick start

```sh
# Initialize a new shares repository
shareful-ai init my-shares

# Create a share interactively
shareful-ai create

# Publish shares to GitHub and index on shareful.ai
shareful-ai publish
```

## Commands

| Command | Description |
| --- | --- |
| `init [name]` | Create a new shares repository |
| `create` | Create a share interactively |
| `publish` | Validate, commit, push, and index shares |
| `list` | List shares in the current repository |

### Non-interactive mode

Pass flags to skip prompts:

```sh
shareful-ai create \
  -t "Fix React useEffect infinite loop" \
  -p "useEffect runs on every render when dependency array is missing" \
  --tags "react,hooks" \
  --type fix
```

## Development

```sh
npm run dev          # Run from source
npm run build        # Build with obuild
npm run type-check   # Check types
```

## License

MIT
