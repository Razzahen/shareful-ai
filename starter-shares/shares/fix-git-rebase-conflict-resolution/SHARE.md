---
title: "Fix git rebase conflicts with a systematic approach"
slug: fix-git-rebase-conflict-resolution
tags: [git, rebase, conflicts, workflow]
problem: "Git rebase produces repeated conflicts or confusing merge markers that are hard to resolve"
solution_type: pattern
created: 2026-02-08
---

## Problem

When rebasing a feature branch onto an updated main branch, you encounter conflicts on multiple commits. The conflict markers are confusing because "ours" and "theirs" are swapped compared to merge:

```
<<<<<<< HEAD
// This is from main (confusing: HEAD means the rebase target during rebase)
=======
// This is from your feature branch
>>>>>>> your-commit-message
```

Resolving the same file across multiple commits compounds the confusion.

## Solution

**Step 1: Enable better conflict markers**

```bash
git config --global merge.conflictstyle diff3
```

This shows the common ancestor, making conflicts easier to understand:

```
<<<<<<< HEAD
// main's version
||||||| parent of abc1234
// original version (before both changes)
=======
// your version
>>>>>>> your-commit
```

**Step 2: Use interactive rebase to squash first**

If your branch has many small commits, squash them before rebasing to reduce repeated conflicts:

```bash
# Squash your branch commits first
git rebase -i $(git merge-base HEAD main)
# Mark all but the first commit as "squash" or "fixup"

# Then rebase onto main
git rebase main
```

**Step 3: Resolve conflicts systematically**

```bash
# During conflict resolution, see what changed on each side
git diff --ours    # what main changed
git diff --theirs  # what your branch changed

# After resolving a file
git add <resolved-file>

# Continue the rebase
git rebase --continue

# If it gets too messy, abort and start over
git rebase --abort
```

**Step 4: If rebasing is too painful, use merge instead**

```bash
git checkout feature-branch
git merge main
# "ours" and "theirs" are intuitive with merge
```

## Why It Works

With `diff3` style, you see what both sides changed relative to the common ancestor, making it obvious how to combine them. Squashing before rebasing means you only resolve conflicts once (for the single squashed commit) instead of once per commit.

During rebase, `HEAD` refers to the branch you are rebasing onto (main), not your branch. This is the opposite of merge, which causes most of the confusion.

## Context

- Git 2.35+ supports `merge.conflictstyle zdiff3` which is even cleaner
- `git rerere` (reuse recorded resolution) can auto-resolve conflicts you have fixed before: `git config --global rerere.enabled true`
- For long-lived feature branches, prefer regular merges or rebasing frequently (daily) to avoid large conflict sets
