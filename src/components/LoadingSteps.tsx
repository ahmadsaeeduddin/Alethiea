"use client";

import Link from "next/link";
import type { AreaStreamEvent, OsmQueryName } from "@/types";

export type StepStatus = "pending" | "active" | "done" | "skipped";

export interface QueryProgress {
  status: StepStatus;
  count?: number;
  /** Set while Overpass is being retried. */
  attempt?: number;
  of?: number;
}

/** What the page knows about an area request so far, built from the /api/area stream. */
export interface LoadProgress {
  cache: "checking" | "hit" | "miss";
  queries: Record<OsmQueryName, QueryProgress>;
  /** Features have arrived; the grid is being scored in the browser. */
  received: boolean;
}

export const INITIAL_PROGRESS: LoadProgress = {
  cache: "checking",
  queries: { green: { status: "pending" }, facilities: { status: "pending" }, buildings: { status: "pending" } },
  received: false,
};

export function applyStreamEvent(progress: LoadProgress, event: AreaStreamEvent): LoadProgress {
  switch (event.type) {
    case "cache":
      return event.hit
        ? {
            ...progress,
            cache: "hit",
            queries: { green: { status: "skipped" }, facilities: { status: "skipped" }, buildings: { status: "skipped" } },
          }
        : { ...progress, cache: "miss" };
    case "query": {
      const current = progress.queries[event.query];
      const next: QueryProgress =
        event.phase === "start"
          ? { status: "active" }
          : event.phase === "retry"
            ? { ...current, status: "active", attempt: event.attempt, of: event.of }
            : { status: "done", count: event.count };
      return { ...progress, queries: { ...progress.queries, [event.query]: next } };
    }
    case "result":
      return { ...progress, received: true };
    default:
      return progress;
  }
}

const QUERY_STEPS: { query: OsmQueryName; label: string; what: string; noun: [string, string] }[] = [
  { query: "green", label: "Fetch green spaces", what: "Parks, gardens, sports pitches and grass", noun: ["green area", "green areas"] },
  { query: "facilities", label: "Fetch schools & hospitals", what: "Schools, colleges, hospitals and clinics", noun: ["facility", "facilities"] },
  { query: "buildings", label: "Fetch buildings", what: "Usually the slowest step: every mapped footprint", noun: ["building", "buildings"] },
];

interface Step {
  key: string;
  label: string;
  detail: string;
  status: StepStatus;
  warning?: boolean;
}

function stepsFor(progress: LoadProgress, cells: number): Step[] {
  const cacheStep: Step = {
    key: "cache",
    label: "Check for a saved copy",
    status: progress.cache === "checking" ? "active" : "done",
    detail:
      progress.cache === "hit"
        ? "Found one, so OpenStreetMap does not need to be asked again"
        : progress.cache === "miss"
          ? "None yet, so the data is fetched live from OpenStreetMap"
          : "Areas opened before load instantly",
  };

  const queries = QUERY_STEPS.map(({ query, label, what, noun }): Step => {
    const q = progress.queries[query];
    const retrying = q.status === "active" && q.attempt !== undefined;
    return {
      key: query,
      label,
      status: q.status,
      warning: retrying,
      detail:
        q.status === "done"
          ? `${(q.count ?? 0).toLocaleString()} ${q.count === 1 ? noun[0] : noun[1]} found`
          : q.status === "skipped"
            ? "Loaded from the saved copy"
            : retrying
              ? `OpenStreetMap is busy, retrying (attempt ${q.attempt} of ${q.of})`
              : what,
    };
  });

  const scoreStep: Step = {
    key: "score",
    label: `Score ${cells} grid cells and draw the map`,
    status: progress.received ? "active" : "pending",
    detail: "50% green-space scarcity · 30% buildings · 20% schools & hospitals",
  };

  return [cacheStep, ...queries, scoreStep];
}

function StepIcon({ status, index }: { status: StepStatus; index: number }) {
  if (status === "done" || status === "skipped") {
    return (
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          status === "done" ? "bg-[var(--green)] text-white" : "bg-[#dfe9da] text-[var(--green)]"
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative grid h-7 w-7 shrink-0 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-2 border-[#d5e3cf]" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--green)] motion-safe:animate-spin" />
        <span className="h-2 w-2 rounded-full bg-[var(--green)]" />
      </span>
    );
  }
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-white text-xs font-semibold text-[var(--muted)]"
      aria-hidden="true"
    >
      {index + 1}
    </span>
  );
}

interface LoadingStepsProps {
  progress: LoadProgress;
  label: string;
  sizeKm: number;
  cells: number;
  elapsedSeconds: number;
}

export function LoadingSteps({ progress, label, sizeKm, cells, elapsedSeconds }: LoadingStepsProps) {
  const steps = stepsFor(progress, cells);
  const finished = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const activeIndex = steps.findIndex((s) => s.status === "active");
  const share = (finished + (activeIndex >= 0 ? 0.5 : 0)) / steps.length;
  const active = activeIndex >= 0 ? steps[activeIndex] : null;

  return (
    <div className="map-loading-backdrop grid min-h-[520px] place-items-center px-4 py-8 lg:min-h-[600px]">
      <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(18,62,42,0.16)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--green)]">Preparing your map</p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-[var(--green-dark)]">{label}</h2>
            <p className="text-xs text-[var(--muted)]">
              {sizeKm} × {sizeKm} km study area
            </p>
          </div>
          <p className="shrink-0 rounded-full bg-[#eff3e9] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--green-dark)]">
            {elapsedSeconds}s
          </p>
        </div>

        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e2ebdd]"
          role="progressbar"
          aria-label="Loading progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={finished}
        >
          <div
            className="h-full rounded-full bg-[var(--green)] transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(4, share * 100)}%` }}
          />
        </div>

        <ol className="mt-5 space-y-3.5">
          {steps.map((step, index) => (
            <li key={step.key} className="flex gap-3" aria-current={step.status === "active" ? "step" : undefined}>
              <StepIcon status={step.status} index={index} />
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-sm font-semibold ${
                    step.status === "pending" ? "text-[var(--muted)]" : "text-[var(--green-dark)]"
                  }`}
                >
                  {step.label}
                </p>
                <p className={`mt-0.5 text-xs leading-5 ${step.warning ? "font-medium text-[#9a5b12]" : "text-[var(--muted)]"}`}>
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="sr-only" role="status" aria-live="polite">
          {active ? `${active.label}. ${active.detail}` : ""}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <p className="max-w-[17rem] text-xs leading-5 text-[var(--muted)]">
            New areas usually take 10–40 seconds: public OpenStreetMap servers are shared.
          </p>
          <Link
            href="/"
            className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--green-dark)] hover:bg-[#f6f7f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
          >
            Pick another area
          </Link>
        </div>
      </div>
    </div>
  );
}
