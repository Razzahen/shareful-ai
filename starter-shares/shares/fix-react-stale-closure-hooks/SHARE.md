---
title: "Fix React stale closure bug in hooks and event handlers"
slug: fix-react-stale-closure-hooks
tags: [react, hooks, closures, state]
problem: "Event handler or timer callback reads outdated state value instead of the latest"
solution_type: fix
created: 2026-02-08
environment:
  framework: react
  version: "18+"
---

## Problem

A callback set up in `useEffect` or `setTimeout` captures an old state value and never sees updates:

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count); // Always logs 0!
      setCount(count + 1); // Always sets to 1!
    }, 1000);
    return () => clearInterval(id);
  }, []); // empty deps = closure captures initial count forever

  return <div>{count}</div>;
}
```

The counter increments to 1 and stops, or the logged value is always the initial state.

## Solution

**Option 1: Use the updater function form of setState (preferred)**

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((prev) => prev + 1); // always uses latest value
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <div>{count}</div>;
}
```

**Option 2: Use a ref for values you need to read (not set)**

```tsx
function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages; // keep ref in sync

  useEffect(() => {
    const ws = new WebSocket(`/ws/${roomId}`);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      // Read latest messages via ref, update via setState
      if (!messagesRef.current.some((m) => m.id === msg.id)) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    return () => ws.close();
  }, [roomId]);

  return <MessageList messages={messages} />;
}
```

**Option 3: Add the value to the dependency array (when appropriate)**

```tsx
useEffect(() => {
  const id = setInterval(() => {
    console.log(count); // now always current
  }, 1000);
  return () => clearInterval(id);
}, [count]); // effect re-runs when count changes
```

## Why It Works

JavaScript closures capture variables by reference, but React state variables are constants within each render. When `useEffect` runs with `[]` dependencies, its callback closes over the state value from the initial render. The updater function `(prev) => prev + 1` receives the latest state from React's internal state queue, bypassing the stale closure.

Refs are mutable containers whose `.current` value is shared across all renders, so reading `ref.current` always gets the latest value.

## Context

- React 18+ with hooks
- This is the single most common hooks bug
- The `react-hooks/exhaustive-deps` ESLint rule catches missing dependencies but does not detect that adding them might cause other issues (like recreating intervals)
- For complex state logic with many interdependent values, consider `useReducer` instead
