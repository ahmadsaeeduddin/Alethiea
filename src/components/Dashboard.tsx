"use client";

import { useEffect, useMemo, useState } from "react";
import { MapShell } from "@/components/MapShell";
import { PriorityPanel } from "@/components/PriorityPanel";
import { ZoneDetails } from "@/components/ZoneDetails";
import { splitFeatures } from "@/lib/geoUtils";
import { priorityBand, rankCells } from "@/lib/scoring";
import type { LahoreFeatureCollection } from "@/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LahoreFeatureCollection };

export function Dashboard() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/lahore.geojson", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load map data (HTTP ${res.status})`);
        return res.json() as Promise<LahoreFeatureCollection>;
      })
      .then((data) => setLoad({ status: "ready", data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({ status: "error", message: err instanceof Error ? err.message : "Could not load map data" });
      });
    return () => controller.abort();
  }, []);

  const features = useMemo(() => (load.status === "ready" ? load.data.features : []), [load]);
  const layers = useMemo(() => splitFeatures(features), [features]);
  const ranking = useMemo(() => (features.length ? rankCells(features) : null), [features]);

  const cells = ranking?.cells ?? [];
  const selectedCell = cells.find((c) => c.id === selectedCellId) ?? null;
  const top = cells[0];
  const schools = layers.facilities.filter((f) => f.properties.category === "school").length;
  const hospitals = layers.facilities.length - schools;
  const ready = load.status === "ready";

  const metrics = [
    {
      label: "Mapped green spaces",
      value: ready ? String(layers.green.length) : "…",
      detail: "OSM parks & gardens",
    },
    {
      label: "Analysis grid",
      value: ready ? `${cells.length} cells` : "…",
      detail: "~200 m × 200 m each",
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
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--green-dark)] text-xl text-[var(--lime)] shadow-sm" aria-hidden="true">
            ◒
          </div>
          <div>
            <p className="text-xl font-semibold tracking-[-0.04em]">GreenGap</p>
            <p className="text-sm text-[var(--muted)]">Lahore urban greening explorer</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--green-dark)] sm:self-auto">
          <span className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-400"}`} />
          Local MVP · v1.0
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
                <h1 className="font-semibold tracking-[-0.02em]">Lahore pilot map</h1>
                <p className="mt-0.5 text-sm text-[var(--muted)]">Grid cells are coloured by greening priority. Click one to see why.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-[var(--muted)]">
                <span className="rounded-full bg-[#edf4e8] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#4b8f55]" />Parks</span>
                <span className="rounded-full bg-[#f2f1ed] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#8a938b]" />Buildings</span>
                <span className="rounded-full bg-[#e8effc] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#2d6cdf]" />Schools</span>
                <span className="rounded-full bg-[#fce8ef] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#d6336c]" />Hospitals</span>
              </div>
            </div>

            {load.status === "error" ? (
              <div role="alert" className="grid h-[520px] place-items-center bg-[#fbf3ef] px-6 text-center text-sm text-[#8a3b2a] lg:h-[600px]">
                {load.message}. Check that public/data/lahore.geojson exists, or run <code>npm run data:fetch</code>.
              </div>
            ) : (
              <MapShell
                green={layers.green}
                buildings={layers.buildings}
                facilities={layers.facilities}
                cells={cells}
                selectedCellId={selectedCellId}
                onSelectCell={setSelectedCellId}
              />
            )}
          </section>

          <footer className="mt-3 space-y-1 px-2 text-xs leading-5 text-[var(--muted)]">
            <p>
              Data: {ready && load.data.metadata ? load.data.metadata.source : "© OpenStreetMap contributors"}
              {ready && load.data.metadata ? ` · fetched ${new Date(load.data.metadata.fetchedAt).toLocaleDateString()}` : ""}.
              Weights are MVP assumptions. Building footprints are not population, and OSM coverage in Lahore is incomplete
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
                onSelectTop={() => top && setSelectedCellId(top.id)}
              />
              <PriorityPanel cells={cells} selectedCellId={selectedCellId} onSelectCell={setSelectedCellId} />
            </>
          ) : (
            <section className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 text-sm text-[var(--muted)] shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
              {load.status === "error" ? "Rankings are unavailable until map data loads." : "Scoring grid cells…"}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
