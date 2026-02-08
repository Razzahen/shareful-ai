---
title: "Fix ESM/CJS interop errors with dual package imports"
slug: fix-esm-cjs-interop-dual-package
tags: [esm, cjs, node, modules, interop]
problem: "ERR_REQUIRE_ESM or SyntaxError: Cannot use import statement when mixing ESM and CJS modules"
solution_type: fix
created: 2026-02-08
environment:
  language: node
  version: "18+"
---

## Problem

When importing an ESM-only package from a CommonJS project, Node.js throws:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported.
Instead change the require to a dynamic import() which is available in all CommonJS modules.
```

Or the reverse -- importing CJS from ESM:

```
SyntaxError: Named export 'something' not found. The requested module is a CommonJS module.
```

## Solution

**Scenario 1: CJS project needs an ESM-only package**

Use dynamic `import()` instead of `require()`:

```javascript
// Before (broken)
const { nanoid } = require("nanoid");

// After (working)
async function main() {
  const { nanoid } = await import("nanoid");
  console.log(nanoid());
}
main();
```

Or switch your project to ESM by adding `"type": "module"` to `package.json`:

```json
{
  "type": "module"
}
```

**Scenario 2: ESM project importing CJS with named exports**

Use default import and destructure:

```javascript
// Before (broken)
import { someExport } from "cjs-package";

// After (working)
import cjsPackage from "cjs-package";
const { someExport } = cjsPackage;
```

**Scenario 3: TypeScript project with ESM/CJS confusion**

Set `tsconfig.json` correctly:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "esModuleInterop": true
  }
}
```

## Why It Works

Node.js treats `.mjs` files and packages with `"type": "module"` as ESM, and `.cjs` files or packages without `"type": "module"` as CJS. `require()` is synchronous and cannot load ESM modules. Dynamic `import()` is asynchronous and works in both module systems.

CJS modules have a single `module.exports` value, so named exports are not directly available to ESM `import { name }` syntax. The default import gets the full `module.exports` object.

## Context

- Node.js 18+ (ESM support stable since 12.x but fully reliable from 18+)
- Common offenders: `nanoid`, `node-fetch`, `chalk` v5+, `execa` v6+, `got` v12+
- TypeScript `moduleResolution: "nodenext"` handles both systems correctly
- Bundlers (webpack, Vite, esbuild) handle this transparently in most cases -- this issue primarily affects Node.js runtime
