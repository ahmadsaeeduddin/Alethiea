"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExploreGuide } from "@/components/ExploreGuide";
import { ImpactComparison } from "@/components/ImpactComparison";
import { applyStreamEvent, INITIAL_PROGRESS, LoadingSteps, type LoadProgress } from "@/components/LoadingSteps";
import { MapShell } from "@/components/MapShell";
import type { LayerVisibility } from "@/components/MapView";
import { PriorityPanel } from "@/components/PriorityPanel";
import { ZoneDetails } from "@/components/ZoneDetails";
import { areaToBbox, areaToParams, formatCenter } from "@/lib/area";
import { GRID_CELL_SIZE_METERS, splitFeatures } from "@/lib/geoUtils";
import { simulateIntervention } from "@/lib/scenario";
import { priorityBand, rankCells } from "@/lib/scoring";
import type { AreaFeatureCollection, AreaSelection, AreaStreamEvent } from "@/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AreaFeatureCollection };

interface DashboardProps {
  area: AreaSelection;
  /** Human-readable name of the selected area, shown in the header. */
  label: string;
}

const LAYER_TOGGLES: { key: keyof LayerVisibility; label: string; swatch: string }[] = [
  { key: "grid", label: "Priority grid", swatch: "linear-gradient(90deg,#c62f2f,#f2a93b,#cfe3b4)" },
  { key: "green", label: "Green space", swatch: "#4b8f55" },
  { key: "buildings", label: "Buildings", swatch: "#8a938b" },
  { key: "facilities", label: "Schools & hospitals", swatch: "linear-gradient(90deg,#2d6cdf 50%,#d6336c 50%)" },
];

const CARD = "rounded-[28px] border border-white/80 bg-[var(--panel)] shadow-[0_12px_36px_rgba(39,65,43,0.06)]";

function Skeleton({ className }: { className: string }) {
  return <span className={`block rounded-lg bg-[#e3eadf] motion-safe:animate-pulse ${className}`} aria-hidden="true" />;
}

export function Dashboard({ area, label }: DashboardProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [layersOn, setLayersOn] = useState<LayerVisibility>({ grid: true, green: true, buildings: true, facilities: true });

  const bbox = useMemo(() => areaToBbox(area), [area]);
  const query = useMemo(() => areaToParams(area).toString(), [area]);
  /** Identifies the request a piece of state belongs to, so a new area resets everything. */
  const requestKey = `${query}#${reloadKey}`;

  // State is tagged with requestKey and read back through a match, so switching areas resets
  // the view without an effect writing state synchronously.
  const [result, setResult] = useState<{ key: string; state: LoadState } | null>(null);
  const [progress, setProgress] = useState<{ key: string; value: LoadProgress } | null>(null);
  const [elapsed, setElapsed] = useState<{ key: string; seconds: number } | null>(null);
  const [selection, setSelection] = useState<{ key: string; cellId: string | null; proposalId: string | null }>({
    key: requestKey,
    cellId: null,
    proposalId: null,
  });

  const load: LoadState = useMemo(
    () => (result?.key === requestKey ? result.state : { status: "loading" }),
    [result, requestKey],
  );
  const loadProgress = progress?.key === requestKey ? progress.value : INITIAL_PROGRESS;
  const elapsedSeconds = elapsed?.key === requestKey ? elapsed.seconds : 0;
  const selectedCellId = selection.key === requestKey ? selection.cellId : null;
  const proposalCellId = selection.key === requestKey ? selection.proposalId : null;

  const selectCell = useCallback(
    (cellId: string | null) => setSelection((prev) => ({ key: requestKey, cellId, proposalId: prev.key === requestKey ? prev.proposalId : null })),
    [requestKey],
  );
  const toggleProposal = useCallback(
    (cellId: string) =>
      setSelection((prev) => ({
        key: requestKey,
        cellId: prev.key === requestKey ? prev.cellId : cellId,
        proposalId: prev.key === requestKey && prev.proposalId === cellId ? null : cellId,
      })),
    [requestKey],
  );
  const clearProposal = useCallback(
    () => setSelection((prev) => ({ key: requestKey, cellId: prev.key === requestKey ? prev.cellId : null, proposalId: null })),
    [requestKey],
  );

  // Stream the area from /api/area so each loading step can be shown as it happens.
  useEffect(() => {
    const controller = new AbortController();
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsed({ key: requestKey, seconds: Math.round((Date.now() - startedAt) / 1000) }),
      1000,
    );

    const handle = (event: AreaStreamEvent) => {
      setProgress((prev) => ({
        key: requestKey,
        value: applyStreamEvent(prev?.key === requestKey ? prev.value : INITIAL_PROGRESS, event),
      }));
      if (event.type === "result") setResult({ key: requestKey, state: { status: "ready", data: event.data } });
      if (event.type === "error") throw new Error(event.message);
      return event.type === "result";
    };

    (async () => {
      const res = await fetch(`/api/area?${query}&stream=1`, { signal: controller.signal });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Could not load map data (HTTP ${res.status})`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) finished = handle(JSON.parse(line) as AreaStreamEvent) || finished;
          newline = buffer.indexOf("\n");
        }
      }
      if (!finished) throw new Error("The connection closed before the area finished loading.");
    })()
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          state: { status: "error", message: err instanceof Error ? err.message : "Could not load map data" },
        });
      })
      .finally(() => clearInterval(timer));

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [query, requestKey]);

  const features = useMemo(() => (load.status === "ready" ? load.data.features : []), [load]);
  // Score on a deferred copy so the "scoring" step can paint before the grid is computed.
  const scoredFeatures = useDeferredValue(features);
  const scoring = features !== scoredFeatures;
  const layers = useMemo(() => splitFeatures(scoredFeatures), [scoredFeatures]);
  const ranking = useMemo(() => (scoredFeatures.length ? rankCells(scoredFeatures, bbox) : null), [scoredFeatures, bbox]);

  const cells = ranking?.cells ?? [];
  const selectedCell = cells.find((c) => c.id === selectedCellId) ?? null;
  const proposalCell = cells.find((c) => c.id === proposalCellId);
  const scenario = useMemo(
    () => (ranking && proposalCell ? simulateIntervention(proposalCell.center, ranking, scoredFeatures) : null),
    [ranking, proposalCell, scoredFeatures],
  );

  const top = cells[0];
  const scoredCount = cells.filter((c) => c.priority !== "unscored").length;
  const schools = layers.facilities.filter((f) => f.properties.category === "school").length;
  const hospitals = layers.facilities.length - schools;
  const ready = load.status === "ready" && !scoring;
  const showLoader = load.status === "loading" || scoring;
  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  const gridSide = Math.floor((area.sizeKm * 1000) / GRID_CELL_SIZE_METERS);

  const metrics = [
    {
      label: "Mapped green spaces",
      value: String(layers.green.length),
      detail: "Parks, gardens, pitches & grass",
    },
    {
      label: "Analysis grid",
      value: `${cells.length} cells`,
      detail: `${scoredCount} with mapped activity · ~200 m each`,
    },
    {
      label: "Facilities",
      value: String(layers.facilities.length),
      detail: `${schools} school${schools === 1 ? "" : "s"} · ${hospitals} hospital${hospitals === 1 ? "" : "s"}`,
    },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <header className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-[var(--panel)] px-5 py-4 shadow-[0_18px_60px_rgba(39,65,43,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--green-dark)] text-xl text-[var(--lime)] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
            aria-label="GreenGap home: choose another area"
          >
            ◒
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--green)]">GreenGap · greening priorities</p>
            <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-[var(--green-dark)]">{label}</h1>
            <p className="truncate text-xs text-[var(--muted)]">
              {area.sizeKm} × {area.sizeKm} km · {formatCenter(area.center)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--green-dark)]">
            <span
              className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : load.status === "error" ? "bg-red-500" : "bg-amber-400 motion-safe:animate-pulse"}`}
            />
            {ready ? "Live OpenStreetMap data" : load.status === "error" ? "Data unavailable" : "Loading data…"}
          </span>
          <Link
            href="/"
            className="rounded-full bg-[var(--green-dark)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--green)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)]"
          >
            Change area
          </Link>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <article key={metric.label} className={`${CARD} rounded-3xl p-5`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{metric.label}</p>
                {ready ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--green-dark)]">{metric.value}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{metric.detail}</p>
                  </>
                ) : (
                  <>
                    <Skeleton className="mt-3 h-7 w-20" />
                    <Skeleton className="mt-2 h-4 w-32" />
                  </>
                )}
              </article>
            ))}

            {ready && top ? (
              <button
                type="button"
                onClick={() => selectCell(top.id)}
                className="group rounded-3xl border border-[var(--green)]/30 bg-white p-5 text-left shadow-[0_12px_36px_rgba(39,65,43,0.08)] transition hover:border-[var(--green)] hover:shadow-[0_16px_40px_rgba(39,65,43,0.14)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Top priority</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--green-dark)]">
                  {top.id}
                  <span
                    className="rounded-lg px-2 py-0.5 text-sm font-semibold"
                    style={{ backgroundColor: priorityBand(top.priority).color }}
                  >
                    {top.score}
                  </span>
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--green)] group-hover:underline">
                  {selectedCellId === top.id ? "Selected on the map" : "Show me this zone →"}
                </p>
              </button>
            ) : (
              <article className={`${CARD} rounded-3xl p-5`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Top priority</p>
                {ready ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">No scored cells in this area.</p>
                ) : (
                  <>
                    <Skeleton className="mt-3 h-7 w-24" />
                    <Skeleton className="mt-2 h-4 w-28" />
                  </>
                )}
              </article>
            )}
          </div>

          <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_20px_60px_rgba(39,65,43,0.1)]">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-6">
              <div>
                <h2 className="font-semibold tracking-[-0.02em]">Greening priority map</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {gridSide} × {gridSide} cells of ~200 m, coloured by need.
                </p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Map layers">
                {LAYER_TOGGLES.map((layer) => {
                  const on = layersOn[layer.key];
                  return (
                    <button
                      key={layer.key}
                      type="button"
                      aria-pressed={on}
                      disabled={!ready}
                      onClick={() => setLayersOn((prev) => ({ ...prev, [layer.key]: !prev[layer.key] }))}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] disabled:cursor-not-allowed disabled:opacity-50 ${
                        on
                          ? "border-[var(--line)] bg-[#f4f7f0] text-[var(--green-dark)] hover:bg-[#ebf1e5]"
                          : "border-dashed border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#f6f7f1]"
                      }`}
                      title={`${on ? "Hide" : "Show"} ${layer.label.toLowerCase()}`}
                    >
                      <i
                        className={`inline-block h-2.5 w-2.5 rounded-full ${on ? "" : "opacity-30"}`}
                        style={{ background: layer.swatch }}
                        aria-hidden="true"
                      />
                      <span className={on ? "" : "line-through decoration-[var(--muted)]/60"}>{layer.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {load.status === "error" ? (
              <div role="alert" className="grid min-h-[520px] place-items-center bg-[#fbf3ef] px-6 text-center lg:min-h-[600px]">
                <div className="max-w-sm">
                  <p className="text-3xl" aria-hidden="true">⚠</p>
                  <p className="mt-2 text-sm font-semibold text-[#8a3b2a]">{load.message}</p>
                  <p className="mt-2 text-xs leading-5 text-[#8a3b2a]/80">
                    Public OpenStreetMap servers rate-limit and time out under load. Retrying usually works; a smaller
                    area is faster.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={retry}
                      className="rounded-full bg-[var(--green-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)]"
                    >
                      Try again
                    </button>
                    <Link
                      href="/"
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--green-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
                    >
                      Pick another area
                    </Link>
                  </div>
                </div>
              </div>
            ) : showLoader ? (
              <LoadingSteps
                progress={scoring ? { ...loadProgress, received: true } : loadProgress}
                label={label}
                sizeKm={area.sizeKm}
                cells={gridSide * gridSide}
                elapsedSeconds={elapsedSeconds}
              />
            ) : (
              <MapShell
                // Remount Leaflet when the study area changes: MapContainer reads bounds once.
                key={query}
                bbox={bbox}
                green={layers.green}
                buildings={layers.buildings}
                facilities={layers.facilities}
                cells={cells}
                selectedCellId={selectedCellId}
                onSelectCell={selectCell}
                scenario={scenario}
                layers={layersOn}
              />
            )}
          </section>

          <footer className="mt-3 space-y-1 px-2 text-xs leading-5 text-[var(--muted)]">
            <p>
              Data: {load.status === "ready" && load.data.metadata ? load.data.metadata.source : "© OpenStreetMap contributors"}
              {load.status === "ready" && load.data.metadata
                ? ` · fetched ${new Date(load.data.metadata.fetchedAt).toLocaleString()}`
                : ""}
              . Weights are MVP assumptions. Building footprints are not population, and OSM coverage varies by
              neighbourhood{ready ? ` (${layers.buildings.length} buildings mapped in this area)` : ""}.
            </p>
            {ready && ranking?.notes.map((note) => <p key={note}>{note}</p>)}
          </footer>
        </div>

        <aside className="flex flex-col gap-5">
          <ExploreGuide hasSelection={selectedCell !== null} hasProposal={scenario !== null} />

          {ready && ranking ? (
            <>
              <ZoneDetails
                cell={selectedCell}
                scoredCells={scoredCount}
                weights={ranking.weights}
                onSelectTop={() => top && selectCell(top.id)}
                isProposed={selectedCell !== null && selectedCell.id === proposalCellId}
                onToggleProposal={() => selectedCell && toggleProposal(selectedCell.id)}
              />
              {scenario && proposalCell && (
                <ImpactComparison
                  scenario={scenario}
                  cellId={proposalCell.id}
                  facilities={layers.facilities}
                  onClear={clearProposal}
                />
              )}
              <PriorityPanel cells={cells} selectedCellId={selectedCellId} onSelectCell={selectCell} />
            </>
          ) : load.status === "error" ? (
            <section className={`${CARD} p-5 text-sm text-[var(--muted)]`}>
              Rankings will appear here once the area loads.
            </section>
          ) : ready ? (
            <section className={`${CARD} p-5 text-sm leading-6 text-[var(--muted)]`}>
              OpenStreetMap has no mapped features in this square. Try another area or a larger size.
            </section>
          ) : (
            <section className={`${CARD} p-5`} aria-hidden="true">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-5 w-40" />
              <div className="mt-5 space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-2xl" />
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
