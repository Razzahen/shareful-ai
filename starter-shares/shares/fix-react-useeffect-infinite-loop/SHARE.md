---
title: "Fix React useEffect infinite loop caused by object dependencies"
slug: fix-react-useeffect-infinite-loop
tags: [react, hooks, useeffect, performance]
problem: "useEffect runs infinitely because an object or array in the dependency array is recreated every render"
solution_type: fix
created: 2026-02-08
environment:
  framework: react
  version: "18+"
---

## Problem

A `useEffect` hook reruns on every render, causing infinite loops or excessive API calls. The console may show rapid repeated renders or the browser tab freezes:

```tsx
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  // BUG: options is a new object every render, triggering useEffect every time
  const options = { includeDetails: true };

  useEffect(() => {
    fetch(`/api/users/${userId}`, options).then((r) => r.json()).then(setUser);
  }, [userId, options]); // options changes every render!

  return <div>{user?.name}</div>;
}
```

## Solution

Move the object inside the effect, or memoize it with `useMemo`:

**Option 1: Move inside the effect (preferred)**

```tsx
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const options = { includeDetails: true };
    fetch(`/api/users/${userId}`, options).then((r) => r.json()).then(setUser);
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

**Option 2: Memoize with useMemo (when the value is needed outside the effect)**

```tsx
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const options = useMemo(() => ({ includeDetails: true }), []);

  useEffect(() => {
    fetch(`/api/users/${userId}`, options).then((r) => r.json()).then(setUser);
  }, [userId, options]);

  return <div>{user?.name}</div>;
}
```

**Option 3: Compare specific primitive values**

```tsx
useEffect(() => {
  fetchUser(userId, includeDetails);
}, [userId, includeDetails]); // primitives are stable
```

## Why It Works

React uses `Object.is` to compare dependency array values between renders. Primitives (strings, numbers, booleans) compare by value, but objects and arrays compare by reference. A new `{}` is created every render, so `Object.is({}, {})` is always `false`, triggering the effect every time.

Moving the object inside the effect removes it from the dependency array entirely. Memoizing with `useMemo` preserves the same reference across renders.

## Context

- React 18+ with hooks
- Also applies to `useCallback` dependencies and `useMemo` dependencies
- The React ESLint plugin `react-hooks/exhaustive-deps` will warn about missing dependencies but won't catch this over-inclusion pattern
- Common with fetch options objects, filter/sort configs, and style objects
