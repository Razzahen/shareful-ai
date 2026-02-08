---
title: "Use TypeScript satisfies operator for type-safe config objects"
slug: fix-typescript-satisfies-type-safety
tags: [typescript, satisfies, type-safety, config]
problem: "Type annotation on config object widens types and loses literal inference"
solution_type: pattern
created: 2026-02-08
environment:
  language: typescript
  version: "5.0+"
---

## Problem

Using a type annotation on a config object enforces the shape but widens the inferred types, losing autocomplete for specific values:

```typescript
type Route = {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  handler: () => void;
};

type Routes = Record<string, Route>;

// Type annotation: values are widened
const routes: Routes = {
  home: { path: "/", method: "GET", handler: () => {} },
  login: { path: "/login", method: "POST", handler: () => {} },
};

// routes.home.method is type "GET" | "POST" | "PUT" | "DELETE" -- lost the specific "GET"
// Object.keys(routes) is string[] -- lost "home" | "login"
```

## Solution

Use `satisfies` to validate the type while preserving narrow inference:

```typescript
const routes = {
  home: { path: "/", method: "GET", handler: () => {} },
  login: { path: "/login", method: "POST", handler: () => {} },
} satisfies Routes;

// routes.home.method is "GET" (narrow!)
// routes.login.method is "POST" (narrow!)
// TypeScript still enforces Route shape -- typos and missing fields are caught

// Combine with "as const" for full literal types:
const routes = {
  home: { path: "/", method: "GET", handler: () => {} },
  login: { path: "/login", method: "POST", handler: () => {} },
} as const satisfies Routes;
```

**Practical example with theme config:**

```typescript
type ThemeConfig = {
  colors: Record<string, string>;
  spacing: Record<string, string>;
};

const theme = {
  colors: {
    primary: "#3b82f6",
    secondary: "#6b7280",
    danger: "#ef4444",
  },
  spacing: {
    sm: "0.5rem",
    md: "1rem",
    lg: "2rem",
  },
} satisfies ThemeConfig;

// theme.colors.primary is string (validated against ThemeConfig)
// theme.colors.oops -- Error: Property 'oops' does not exist (autocomplete works!)
```

## Why It Works

`satisfies` validates that an expression matches a type without changing the inferred type. A type annotation (`const x: Type = ...`) forces the variable to be exactly `Type`, widening all values. `satisfies` checks compatibility at the assignment but lets TypeScript infer the narrowest possible type from the value itself.

This gives you both validation (catches structural errors) and inference (preserves literal types and known keys).

## Context

- TypeScript 4.9+ (the `satisfies` operator was added in 4.9)
- Ideal for config objects, route definitions, theme configs, i18n keys
- `as const satisfies Type` is the most powerful combination: readonly + validated + narrow
- Does not work with `let` declarations where the value might change later (use type annotation instead)
