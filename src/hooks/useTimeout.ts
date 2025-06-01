import { useEffect, useRef, useCallback } from "react";

export function useTimeout() {
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  const setTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = globalThis.setTimeout(() => {
      timeoutsRef.current.delete(timeoutId);
      callback();
    }, delay);

    timeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  const clearTimeout = useCallback((timeoutId: NodeJS.Timeout) => {
    globalThis.clearTimeout(timeoutId);
    timeoutsRef.current.delete(timeoutId);
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => globalThis.clearTimeout(id));
    timeoutsRef.current.clear();
  }, []);

  // Clean up all timeouts on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  return { setTimeout, clearTimeout, clearAllTimeouts };
}
