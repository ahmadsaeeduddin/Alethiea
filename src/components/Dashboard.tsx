"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImpactComparison } from "@/components/ImpactComparison";
import { MapShell } from "@/components/MapShell";
import { PriorityPanel } from "@/components/PriorityPanel";
import { ZoneDetails } from "@/components/ZoneDetails";
import { areaToBbox, areaToParams, formatCenter } from "@/lib/area";
import { splitFeatures } from "@/lib/geoUtils";
import { simulateIntervention } from "@/lib/scenario";
import { priorityBand, rankCells } from "@/lib/scoring";
import type { AreaFeatureCollection, AreaSelection } from "@/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AreaFeatureCollection };

interface DashboardProps {
  area: AreaSelection;
  /** Human-readable name of the selected area, shown in the header. */
  label: string;
}

export function Dashboard({ area, label }: DashboardProps) {
  const [reloadKey, setReloadKey] = useState(0);

  const bbox = useMemo(() => areaToBbox(area), [area]);
  const query = useMemo(() => areaToParams(area).toString(), [area]);
  /** Identifies the request a piece of state belongs to, so a new area resets everything. */
  const requestKey = `${query}#${reloadKey}`;

  // State is tagged with requestKey and read back through a match, so switching areas resets
  // the view without an effect writing state synchronously.
  const [result, setResult] = useState<{ key: string; state: LoadState } | null>(null);
  const [selection, setSelection] = useState<{ key: string; cellId: string | null; proposalId: string | null }>({
    key: requestKey,
    cellId: null,
    proposalId: null,
  });

  const load: LoadState = useMemo(
    () => (result?.key === requestKey ? result.state : { status: "loading" }),
    [result, requestKey],
  );
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

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/area?${query}`, { signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json()) as AreaFeatureCollection & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `Could not load map data (HTTP ${res.status})`);
        return body;
      })
      .then((data) => setResult({ key: requestKey, state: { status: "ready", data } }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          state: { status: "error", message: err instanceof Error ? err.message : "Could not load map data" },
        });
      });

    return () => controller.abort();
  }, [query, requestKey]);

  const features = useMemo(() => (load.status === "ready" ? load.data.features : []), [load]);
  const layers = useMemo(() => splitFeatures(features), [features]);
  const ranking = useMemo(() => (features.length ? rankCells(features, bbox) : null), [features, bbox]);

  const cells = ranking?.cells ?? [];
  const selectedCell = cells.find((c) => c.id === selectedCellId) ?? null;
  const proposalCell = cells.find((c) => c.id === proposalCellId);
  const scenario = useMemo(
    () => (ranking && proposalCell ? simulateIntervention(proposalCell.center, ranking, features) : null),
    [ranking, proposalCell, features],
  );

  const top = cells[0];
  const schools = layers.facilities.filter((f) => f.properties.category === "school").length;
  const hospitals = layers.facilities.length - schools;
  const ready = load.status === "ready";
  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const metrics = [
    {
      label: "Mapped green spaces",
      value: ready ? String(layers.green.length) : "…",
      detail: "OSM parks, gardens, pitches & grass",
    },
    {
      label: "Analysis grid",
      value: ready ? `${cells.length} cells` : "…",
      detail: `${area.sizeKm} × ${area.sizeKm} km · ~200 m cells`,
    },
    {
      label: "Facilities",
      value: ready ? String(layers.facilities.length) : "…",
      detail: ready ? `${schools} schools · ${hospitals} hospital${hospitals === 1 ? "" : "s"}` : "Schools & hospitals",
    },
    {
      label: "Top priority",
      value: top ? `${top.id} · ${top.score}` : "…",
      detail: top ? `${priorityBand(top.priority).label} need` : "Highest-scoring cell",
    },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <header className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-[var(--panel)] px-5 py-5 shadow-[0_18px_60px_rgba(39,65,43,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--green-dark)] text-xl text-[var(--lime)] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
            aria-label="Back to area selection"
          >
            ◒
          </Link>
          <div>
            <p className="text-xl font-semibold tracking-[-0.04em]">GreenGap</p>
            <p className="text-sm text-[var(--muted)]">
              {label} · {area.sizeKm} × {area.sizeKm} km · {formatCenter(area.center)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--green-dark)]">
            <span className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : load.status === "error" ? "bg-red-500" : "bg-amber-400"}`} />
            {ready ? "Live OSM data" : load.status === "error" ? "Data unavailable" : "Loading OSM data"}
          </span>
          <Link
            href="/"
            className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--green-dark)] hover:bg-[#f6f7f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
          >
            Change area
          </Link>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <article key={metric.label} className="rounded-3xl border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--green-dark)]">{metric.value}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{metric.detail}</p>
              </article>
            ))}
          </div>

          <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_20px_60px_rgba(39,65,43,0.1)]">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h1 className="font-semibold tracking-[-0.02em]">{label}</h1>
                <p className="mt-0.5 text-sm text-[var(--muted)]">Grid cells are coloured by greening priority. Click one to see why.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-[var(--muted)]">
                <span className="rounded-full bg-[#edf4e8] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#4b8f55]" />Green space</span>
                <span className="rounded-full bg-[#f2f1ed] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#8a938b]" />Buildings</span>
                <span className="rounded-full bg-[#e8effc] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#2d6cdf]" />Schools</span>
                <span className="rounded-full bg-[#fce8ef] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#d6336c]" />Hospitals</span>
              </div>
            </div>

            {load.status === "error" ? (
              <div role="alert" className="grid h-[520px] place-items-center bg-[#fbf3ef] px-6 text-center lg:h-[600px]">
                <div>
                  <p className="text-sm font-semibold text-[#8a3b2a]">{load.message}</p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#8a3b2a]/80">
                    Public OpenStreetMap servers rate-limit and time out under load. Retrying usually works; a smaller
                    area is faster.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={retry}
                      className="rounded-full bg-[var(--green-dark)] px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)]"
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
            ) : load.status === "loading" ? (
              <div className="grid h-[520px] place-items-center bg-[#e8eee3] px-6 text-center lg:h-[600px]">
                <div>
                  <p className="text-sm font-semibold text-[var(--green-dark)]">Loading OpenStreetMap features…</p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[var(--muted)]">
                    Querying parks, buildings, schools and hospitals for this {area.sizeKm} × {area.sizeKm} km square.
                    A new area usually takes a few seconds.
                  </p>
                </div>
              </div>
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
              />
            )}
          </section>

          <footer className="mt-3 space-y-1 px-2 text-xs leading-5 text-[var(--muted)]">
            <p>
              Data: {ready && load.data.metadata ? load.data.metadata.source : "© OpenStreetMap contributors"}
              {ready && load.data.metadata ? ` · fetched ${new Date(load.data.metadata.fetchedAt).toLocaleTimeString()}` : ""}.
              Weights are MVP assumptions. Building footprints are not population, and OSM coverage varies by
              neighbourhood
              {ready ? ` (${layers.buildings.length} buildings mapped in this area)` : ""}.
            </p>
            {ranking?.notes.map((note) => <p key={note}>{note}</p>)}
          </footer>
        </div>

        <aside className="flex flex-col gap-5">
          <section className="rounded-[28px] bg-[var(--green-dark)] p-6 text-white shadow-[0_20px_60px_rgba(18,62,42,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lime)]">Mission</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.04em]">Find the places where more green could matter most.</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">GreenGap combines green-space scarcity, building concentration, and nearby public facilities into an explainable priority score.</p>
          </section>

          {ranking ? (
            <>
              <ZoneDetails
                cell={selectedCell}
                scoredCells={cells.filter((c) => c.priority !== "unscored").length}
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
          ) : (
            <section className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 text-sm text-[var(--muted)] shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
              {load.status === "error"
                ? "Rankings are unavailable until map data loads."
                : ready
                  ? "OpenStreetMap has no mapped features in this square. Try another area or a larger size."
                  : "Scoring grid cells…"}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
