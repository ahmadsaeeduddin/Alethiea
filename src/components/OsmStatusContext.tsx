"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type OsmStatus = "idle" | "ready" | "streaming" | "error";

interface OsmStatusContextValue {
  status: OsmStatus;
  set: (next: OsmStatus) => void;
}

const DEFAULT_VALUE: OsmStatusContextValue = { status: "idle", set: () => {} };

const Ctx = createContext<OsmStatusContextValue>(DEFAULT_VALUE);

export function OsmStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OsmStatus>("idle");
  // Stable `set` reference so Dashboard effects that depend on it don't thrash.
  const set = useCallback((next: OsmStatus) => setStatus(next), []);
  const value = useMemo<OsmStatusContextValue>(() => ({ status, set }), [status, set]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOsmStatus(): OsmStatusContextValue {
  return useContext(Ctx);
}
