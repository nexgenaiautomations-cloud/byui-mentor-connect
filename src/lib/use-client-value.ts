"use client";
// Browser-only values (sessionStorage, matchMedia, the user's time zone)
// read without a setState-in-effect round trip. The server and the hydration
// render see `serverValue`; the client then re-renders with the real value.
// `read` must return a primitive (or a cached object) so React can compare
// snapshots.
import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscribe, read, () => serverValue);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
