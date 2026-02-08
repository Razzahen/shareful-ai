---
title: "Fix TypeScript module augmentation for extending third-party types"
slug: fix-typescript-module-augmentation
tags: [typescript, types, module-augmentation, declarations]
problem: "Cannot add custom properties to third-party library types like Express Request or Next.js env"
solution_type: pattern
created: 2026-02-08
environment:
  language: typescript
  version: "5.0+"
---

## Problem

You need to add custom properties to an existing type from a third-party library but TypeScript does not recognize them:

```typescript
// Error: Property 'user' does not exist on type 'Request'
app.get("/api/me", (req, res) => {
  res.json(req.user); // TS error!
});
```

## Solution

Create a declaration file that uses module augmentation to extend the existing interface:

**Express Request augmentation:**

```typescript
// types/express.d.ts
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: "admin" | "user";
    };
  }
}

export {}; // required to make this a module
```

**Next.js environment variables:**

```typescript
// types/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    NEXT_PUBLIC_API_URL: string;
    AUTH_SECRET: string;
    NODE_ENV: "development" | "production" | "test";
  }
}
```

**CSS Modules:**

```typescript
// types/css.d.ts
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
```

**Ensure the declaration file is included in tsconfig.json:**

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./types"]
  },
  "include": ["src/**/*", "types/**/*"]
}
```

## Why It Works

TypeScript interfaces are open-ended: declaring the same interface name in the same module scope merges the declarations. Module augmentation (`declare module "..."`) lets you add declarations to a module from outside that module's source files.

The `export {}` line at the bottom is critical for files that only contain `declare module` statements. Without it, TypeScript treats the file as a script (ambient context) rather than a module, and the augmentation may not apply correctly.

## Context

- TypeScript 4.x+ (module augmentation has been stable since 2.x)
- The `types/` directory convention is not required -- any `.d.ts` file included by `tsconfig.json` works
- For Express: augment `express-serve-static-core` not `express` (Request lives in the core module)
- For Prisma: extend generated types by augmenting `@prisma/client`
- Global augmentations (like `ProcessEnv`) use `declare namespace` or `declare global`
