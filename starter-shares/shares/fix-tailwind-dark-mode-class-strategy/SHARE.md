---
title: "Fix Tailwind CSS dark mode not working with class strategy"
slug: fix-tailwind-dark-mode-class-strategy
tags: [tailwind, css, dark-mode, theming]
problem: "Tailwind dark: variants have no effect even though dark mode class is toggled"
solution_type: fix
created: 2026-02-08
environment:
  framework: tailwind
  version: "3.x"
---

## Problem

You set `darkMode: "class"` in Tailwind config and toggle a `dark` class on `<html>`, but `dark:` utility classes have no effect:

```html
<html class="dark">
  <body>
    <div class="bg-white dark:bg-gray-900">
      <!-- Still shows white background -->
    </div>
  </body>
</html>
```

## Solution

**1. Verify `tailwind.config.ts` has the class strategy:**

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

**2. Toggle the class on the `<html>` element (not `<body>`):**

```tsx
"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return <button onClick={toggle}>{dark ? "Light" : "Dark"} mode</button>;
}
```

**3. Prevent flash of wrong theme with a head script:**

```html
<head>
  <script>
    if (
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
    }
  </script>
</head>
```

## Why It Works

Tailwind's `class` strategy generates CSS like `.dark .dark\:bg-gray-900 { background: ... }`. The `dark` class must be on an ancestor element. The convention is `<html>` because it is the root -- placing it on `<body>` or a nested `<div>` means `dark:` variants on elements outside that subtree will not activate.

The inline `<head>` script runs synchronously before the page paints, preventing a flash of the wrong theme.

## Context

- Tailwind CSS v3.x and v4.x
- For Tailwind v4, dark mode uses CSS `@custom-variant` and may default to media strategy
- The `next-themes` package handles all of this automatically for Next.js: `npm install next-themes`
- If using `darkMode: "media"` (default), no class toggling is needed -- it follows the OS preference
