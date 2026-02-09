export type IdleCallbackHandle = number;

export interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

type IdleCallback = (deadline: IdleDeadline) => void;

interface IdleWindowApi {
  requestIdleCallback?: (
    callback: IdleCallback,
    options?: { timeout: number }
  ) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
}

export function scheduleIdleCallback(callback: () => void, timeoutMs: number) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const idleWindow = window as unknown as IdleWindowApi;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => callback(), {
      timeout: timeoutMs,
    });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const timeoutId = window.setTimeout(callback, timeoutMs);
  return () => window.clearTimeout(timeoutId);
}
