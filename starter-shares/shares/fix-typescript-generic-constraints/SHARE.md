---
title: "Fix TypeScript generic constraints for key-value lookups"
slug: fix-typescript-generic-constraints
tags: [typescript, generics, type-safety]
problem: "TypeScript generic function loses type information when accessing object properties dynamically"
solution_type: pattern
created: 2026-02-08
environment:
  language: typescript
  version: "5.0+"
---

## Problem

When writing a generic function that accesses object properties, TypeScript widens the return type or throws errors about string index signatures:

```typescript
// Returns 'unknown' or errors with "Type 'string' cannot be used to index type 'T'"
function getProperty<T>(obj: T, key: string) {
  return obj[key]; // Error!
}

const user = { name: "Alice", age: 30 };
const name = getProperty(user, "name"); // type: unknown
```

## Solution

Use the `keyof` constraint with a second generic parameter:

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 30 };
const name = getProperty(user, "name"); // type: string
const age = getProperty(user, "age"); // type: number
// getProperty(user, "email"); // Error: "email" is not assignable to "name" | "age"
```

For more complex patterns like a typed event emitter:

```typescript
type EventMap = {
  login: { userId: string };
  logout: { reason: string };
  error: { code: number; message: string };
};

function emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
  // fully typed event and payload
}

emit("login", { userId: "123" }); // OK
emit("error", { code: 500, message: "fail" }); // OK
// emit("login", { code: 500 }); // Error: missing userId
```

## Why It Works

The `K extends keyof T` constraint tells TypeScript that `K` must be one of the known keys of `T`. The return type `T[K]` is an indexed access type -- TypeScript resolves it to the specific property type for that key. This creates a relationship between the key argument and the return type, preserving full type information through the generic.

## Context

- TypeScript 5.0+ (works in 4.x too but `satisfies` and const type parameters are 5.0+)
- Common in utility libraries, ORM wrappers, config accessors, and state management
- For runtime-dynamic keys where you cannot know the key at compile time, consider using a discriminated union or `Record<string, T>` instead
