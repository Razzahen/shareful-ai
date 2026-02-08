---
title: "Fix unnecessary React re-renders with memo and stable references"
slug: fix-react-memo-unnecessary-rerenders
tags: [react, performance, memo, optimization]
problem: "Child components re-render on every parent render even when their props have not changed"
solution_type: pattern
created: 2026-02-08
environment:
  framework: react
  version: "18+"
---

## Problem

A parent component re-renders frequently (e.g., from state updates), causing all child components to re-render even when their props are unchanged:

```tsx
function Dashboard() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <Clock time={time} />
      <ExpensiveChart data={chartData} /> {/* re-renders every second! */}
      <UserList users={users} /> {/* re-renders every second! */}
    </div>
  );
}
```

## Solution

**1. Wrap expensive components with `React.memo`:**

```tsx
const ExpensiveChart = memo(function ExpensiveChart({
  data,
}: {
  data: ChartData[];
}) {
  // expensive rendering logic
  return <canvas>{/* ... */}</canvas>;
});
```

**2. Stabilize object/array/function props:**

```tsx
function Dashboard() {
  const [time, setTime] = useState(new Date());
  const [filter, setFilter] = useState("all");

  // Memoize derived data
  const filteredUsers = useMemo(
    () => users.filter((u) => filter === "all" || u.role === filter),
    [users, filter]
  );

  // Stabilize callback references
  const handleSelect = useCallback(
    (userId: string) => {
      setSelectedUser(userId);
    },
    [] // no dependencies needed if it only calls setState
  );

  return (
    <div>
      <Clock time={time} />
      <ExpensiveChart data={chartData} />
      <UserList users={filteredUsers} onSelect={handleSelect} />
    </div>
  );
}
```

**3. Split state to isolate re-renders (composition pattern):**

```tsx
function Dashboard() {
  return (
    <div>
      <LiveClock /> {/* owns its own time state, re-renders independently */}
      <ExpensiveChart data={chartData} />
      <UserList users={users} />
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time.toLocaleTimeString()}</span>;
}
```

## Why It Works

By default, when a parent component re-renders, React re-renders all children regardless of whether their props changed. `React.memo` adds a shallow comparison of props before re-rendering -- if all props are the same by reference, the component skips rendering.

But `memo` only works if props are referentially stable. A new `[]`, `{}`, or `() => {}` on every render defeats `memo`. `useMemo` and `useCallback` preserve references between renders.

The composition pattern (Option 3) is often the best solution: move frequently-changing state into a dedicated component so it does not trigger re-renders of siblings.

## Context

- React 18+ (React Compiler in React 19 may auto-memoize, reducing the need for manual `memo`)
- Do NOT memoize everything by default -- measure first with React DevTools Profiler
- `memo` has a small overhead per render for the comparison; only use it on components where re-rendering is noticeably expensive
- Primitive props (strings, numbers, booleans) are always referentially stable
- Context value changes re-render all consumers regardless of `memo` -- consider splitting contexts
