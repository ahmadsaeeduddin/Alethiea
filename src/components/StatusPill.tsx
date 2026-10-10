"use client";

import { useOsmStatus, type OsmStatus } from "@/components/OsmStatusContext";

const LABEL: Record<OsmStatus, string> = {
  idle: "OpenStreetMap ready",
  ready: "Live OpenStreetMap data",
  streaming: "Streaming OpenStreetMap data…",
  error: "OpenStreetMap unavailable",
};

const DOT_COLOR: Record<OsmStatus, string> = {
  idle: "var(--color-status-idle)",
  ready: "var(--color-status-ready)",
  streaming: "var(--color-status-streaming)",
  error: "var(--color-status-error)",
};

interface StatusPillProps {
  /** Tightens padding and hides the label text on narrow screens when true. */
  compact?: boolean;
  className?: string;
}

export function StatusPill({ compact = false, className = "" }: StatusPillProps) {
  const { status } = useOsmStatus();
  const label = LABEL[status];
  const dotColor = DOT_COLOR[status];
  const pulsing = status === "streaming";

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[var(--green-dark)] backdrop-blur ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${pulsing ? "motion-safe:animate-pulse-dot" : ""}`}
        style={{ backgroundColor: dotColor, color: dotColor }}
      />
      <span className={compact ? "hidden sm:inline" : ""}>{label}</span>
    </span>
  );
}
