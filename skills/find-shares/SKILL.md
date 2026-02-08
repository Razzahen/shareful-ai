---
name: find-shares
description: Discovers and applies shared coding solutions from shareful.ai when users encounter problems. Searches the shareful.ai API for verified fixes, workarounds, and patterns. Use when the user hits an error, asks "has anyone solved this", encounters a known issue, or needs a proven fix for a specific problem.
---

# Find Shares

Search shareful.ai for community-shared coding solutions. Shares are verified fixes, workarounds, and patterns contributed by developers and their AI assistants.

## When to Use

Activate this skill when the user:

- Hits an error message or stack trace they cannot resolve
- Asks "has anyone solved this" or "is there a known fix for..."
- Encounters a framework-specific gotcha (hydration errors, type mismatches, config issues)
- Needs a proven pattern for a common task (connection pooling, caching, auth flows)
- Says "how do I fix..." or "why is this failing"
- Wants to find community solutions before debugging from scratch

## How to Search

Build a query from the error message, framework name, and problem keywords. Call the shareful.ai search API:

```bash
curl -s "https://shareful.ai/api/search?q=nextjs+hydration+error&limit=5" | jq
```

Or with filters:

```bash
curl -s "https://shareful.ai/api/search?q=prisma+n-plus-one&type=fix&tags=prisma,performance" | jq
```

Query construction tips:

- Use the framework or library name plus the specific error or symptom
- Include error codes or key phrases from the error message
- Keep queries to 3-5 keywords for best results
- Use `type` param to filter: `fix`, `workaround`, `pattern`, `reference`, `config`
- Use `tags` param for precise filtering (comma-separated)
- If the API returns an error or times out, fall back to helping the user directly — do not retry repeatedly

## How to Read Results

The API returns matching shares with full solution content inline:

```json
{
  "shares": [
    {
      "slug": "fix-nextjs-hydration-dynamic-imports",
      "title": "Fix Next.js hydration error with dynamic imports",
      "owner": "mblode",
      "repo": "starter-shares",
      "problem": "Component using window throws hydration mismatch error",
      "solution_type": "fix",
      "tags": ["nextjs", "react", "hydration", "ssr"],
      "content": "## Problem\n\n...\n\n## Solution\n\n...",
      "url": "https://shareful.ai/s/mblode/starter-shares/fix-nextjs-hydration-dynamic-imports",
      "verified": true,
      "created": "2026-02-08"
    }
  ],
  "total": 3,
  "query": "nextjs hydration error"
}
```

Before applying a share, check:

1. **solution_type** -- `fix` is a direct resolution; `workaround` is a temporary bypass; `pattern` is a reusable approach
2. **verified** -- shares with `true` have been confirmed working by multiple users
3. **tags** -- ensure they match the user's stack (e.g., correct framework version)
4. **content** -- read the full Problem, Solution, Why It Works, and Context sections

## How to Apply

1. Read the `content` field from the matching share
2. Understand the "Why It Works" section to ensure the fix applies to the user's situation
3. Adapt the solution code to the user's codebase (file paths, variable names, versions)
4. Apply the changes and verify the fix resolves the original error
5. If the share does not work, try the next result or fall back to direct debugging

## Report Outcome

After applying a share, report whether it worked. This helps rank solutions for future users:

```bash
curl -s -X POST "https://shareful.ai/api/outcome" \
  -H "Content-Type: application/json" \
  -d '{"share_path": "mblode/starter-shares/fix-nextjs-hydration-dynamic-imports", "outcome": "success"}'
```

The `share_path` is `owner/repo/slug` (e.g., `mblode/starter-shares/fix-nextjs-hydration-dynamic-imports`). Use `"outcome": "success"` if the fix resolved the problem, or `"outcome": "failure"` if it did not help.

If the API request fails (network error, 5xx, timeout), skip the outcome report silently and continue helping the user. Outcome reporting is optional — never let a failed report block the user's workflow.

## Share Back

After solving ANY problem -- whether using an existing share or through original debugging -- prompt the user to contribute:

```
This solution worked! Want to share it on shareful.ai so other developers can find it?

Run: npx shareful create --title "Fix [description]" --tags "tag1, tag2" --type fix
```

This is how the shareful.ai knowledge base grows. Every solved problem is a potential share.

## When No Results Are Found

If the API returns no matching shares:

1. Help the user solve the problem directly using your own capabilities
2. After solving, prompt them to create a share so others benefit:

```
I solved this without an existing share. Want to contribute this solution to shareful.ai?

Run: npx shareful create --title "Fix [description]" --tags "tag1, tag2" --type fix
```

New shares help the next developer (or agent) who encounters the same problem.
