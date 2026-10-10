"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AREA_PRESETS,
  AREA_SIZE_OPTIONS,
  areaToParams,
  DEFAULT_AREA,
  formatCenter,
  isValidArea,
} from "@/lib/area";
import { GRID_CELL_SIZE_METERS } from "@/lib/geoUtils";
import type { AreaSelection, GeocodeHit, LngLat } from "@/types";

const AreaPickerMap = dynamic(() => import("@/components/AreaPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[380px] place-items-center bg-[#e8eee3] text-sm font-medium text-[var(--muted)] sm:h-[460px] lg:h-[560px]">
      Loading the map…
    </div>
  ),
});

const cellsFor = (sizeKm: number) => Math.floor((sizeKm * 1000) / GRID_CELL_SIZE_METERS) ** 2;

export function AreaPicker() {
  const router = useRouter();
  const [area, setArea] = useState<AreaSelection>(DEFAULT_AREA);
  const [label, setLabel] = useState<string>(AREA_PRESETS[0].name);
  const [recenterKey, setRecenterKey] = useState(0);
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState(false);
  /** Last finished search, tagged with the term it answered. */
  const [search, setSearch] = useState<{ term: string; hits: GeocodeHit[]; failed: boolean } | null>(null);

  const term = query.trim();
  const answered = search?.term === term ? search : null;
  const hits = answered?.hits ?? [];
  const searchState: "idle" | "searching" | "error" =
    term.length < 3 ? "idle" : !answered ? "searching" : answered.failed ? "error" : "idle";

  // Debounced place search through our own proxy (Nominatim needs a server-side User-Agent).
  useEffect(() => {
    if (term.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((res) => res.json() as Promise<{ hits?: GeocodeHit[]; error?: string }>)
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setSearch({ term, hits: data.hits ?? [], failed: false });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          console.warn(err);
          setSearch({ term, hits: [], failed: true });
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const jumpTo = (center: LngLat, name: string) => {
    setArea((prev) => ({ ...prev, center }));
    setLabel(name);
    setRecenterKey((k) => k + 1);
    setQuery("");
  };

  const pickCenter = (center: LngLat) => {
    setArea((prev) => ({ ...prev, center }));
    setLabel("Custom location");
  };

  const start = () => {
    if (!isValidArea(area)) return;
    setStarting(true);
    const params = areaToParams(area);
    params.set("label", label);
    router.push(`/explore?${params.toString()}`);
  };

  const cells = useMemo(() => cellsFor(area.sizeKm), [area.sizeKm]);
  const noResults = searchState === "idle" && answered !== null && !answered.failed && hits.length === 0;

  return (
    <main className="mx-auto min-h-screen max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--green-dark)] text-xl text-[var(--lime)] shadow-sm" aria-hidden="true">
            ◒
          </div>
          <div>
            <p className="text-xl font-semibold tracking-[-0.04em]">GreenGap</p>
            <p className="text-sm text-[var(--muted)]">Urban greening priority explorer</p>
          </div>
        </div>
        <span className="hidden rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[var(--green-dark)] sm:inline">
          Live data from OpenStreetMap
        </span>
      </header>

      <section className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold leading-[1.1] tracking-[-0.045em] text-[var(--green-dark)] sm:text-4xl lg:text-5xl">
          See where a neighbourhood needs greenery most.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Cities have limited greening budgets. GreenGap scores every 200 m block by green-space scarcity, building
          density and nearby schools and hospitals, then lets you test where a new green space would help.
        </p>
      </section>

      <ol className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { title: "Choose an area", body: "Search a place, pick a preset or click the map." },
          { title: "See the priority grid", body: "Every cell is scored 0–100 and ranked, with the reasons shown." },
          { title: "Test a greening cluster", body: "Drop a 150 m green space and compare before and after." },
        ].map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-3xl border border-white/80 bg-[var(--panel)] p-4 shadow-[0_10px_30px_rgba(39,65,43,0.05)]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--green-dark)] text-sm font-bold text-[var(--lime)]">
              {index + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold text-[var(--green-dark)]">{step.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)] sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--green-dark)]">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#e3eddc] text-xs font-bold">1</span>
            Find a place
          </h2>
          <div className="relative mt-3">
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M13 13l4 4" />
            </svg>
            <label htmlFor="place-search" className="sr-only">
              Search a place
            </label>
            <input
              id="place-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a neighbourhood or city"
              autoComplete="off"
              className="w-full rounded-2xl border border-[var(--line)] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[var(--green)] focus-visible:ring-2 focus-visible:ring-[var(--green)]/30"
            />
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted)]" aria-live="polite">
            {searchState === "searching"
              ? "Searching…"
              : searchState === "error"
                ? "Place search is unavailable right now. Click the map instead."
                : noResults
                  ? `No places found for “${term}”. Try a broader name, or click the map.`
                  : "Type at least 3 letters. Search by OpenStreetMap Nominatim."}
          </p>

          {hits.length > 0 && (
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-1">
              {hits.map((hit) => {
                const [name, ...rest] = hit.label.split(",");
                return (
                  <li key={`${hit.lat},${hit.lng}`}>
                    <button
                      type="button"
                      onClick={() => jumpTo([hit.lng, hit.lat], name)}
                      className="w-full rounded-xl px-3 py-2 text-left text-xs leading-5 hover:bg-[#f2f6ee] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
                    >
                      <span className="block font-semibold text-[var(--green-dark)]">{name}</span>
                      <span className="block truncate text-[var(--muted)]">{rest.join(",").trim()}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-xs font-medium text-[var(--muted)]">Or start from a Lahore neighbourhood</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {AREA_PRESETS.map((preset) => {
              const active = label === preset.name;
              return (
                <button
                  key={preset.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => jumpTo(preset.area.center, preset.name)}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] ${
                    active ? "border-[var(--green)] bg-white shadow-sm" : "border-[var(--line)] bg-white/60"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--green-dark)]">
                    {preset.name}
                    {active && <span className="text-xs text-[var(--green)]" aria-hidden="true">✓</span>}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">{preset.detail}</span>
                </button>
              );
            })}
          </div>

          <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold text-[var(--green-dark)]">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#e3eddc] text-xs font-bold">2</span>
            Choose a size
          </h2>
          <div className="mt-3 flex gap-2" role="group" aria-label="Study area size">
            {AREA_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={area.sizeKm === size}
                onClick={() => setArea((prev) => ({ ...prev, sizeKm: size }))}
                className={`flex-1 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] ${
                  area.sizeKm === size
                    ? "border-[var(--green)] bg-[var(--green-dark)] text-white"
                    : "border-[var(--line)] bg-white/70 text-[var(--green-dark)] hover:bg-white"
                }`}
              >
                {size} × {size} km
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            {cells} cells of {GRID_CELL_SIZE_METERS} m. Larger areas take longer the first time they load.
          </p>

          <div className="mt-6 rounded-2xl bg-[var(--green-dark)] p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lime)]">Ready to analyse</p>
                <p className="mt-1 truncate text-base font-semibold">{label}</p>
                <p className="text-xs text-white/70">
                  {area.sizeKm} × {area.sizeKm} km · {formatCenter(area.center)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-4 py-3 text-sm font-semibold text-[var(--green-dark)] transition hover:bg-white disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {starting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-[var(--green-dark)]/30 border-t-[var(--green-dark)] motion-safe:animate-spin" aria-hidden="true" />
                  Opening the analysis…
                </>
              ) : (
                <>Analyse this area →</>
              )}
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_20px_60px_rgba(39,65,43,0.1)]">
            <div className="flex flex-col gap-1 border-b border-[var(--line)] px-5 py-4 sm:px-6">
              <h2 className="font-semibold tracking-[-0.02em]">Click the map to move the study area</h2>
              <p className="text-sm text-[var(--muted)]">
                The shaded square is what gets analysed. It works anywhere OpenStreetMap has coverage.
              </p>
            </div>
            <div className="relative">
              <AreaPickerMap area={area} onPickCenter={pickCenter} recenterKey={recenterKey} />
              <p className="pointer-events-none absolute left-4 top-4 z-[500] rounded-full bg-white/92 px-3 py-1.5 text-xs font-medium text-[var(--green-dark)] shadow-md backdrop-blur">
                ⌖ Click anywhere to centre the square here
              </p>
            </div>
          </section>

          <p className="mt-3 px-2 text-xs leading-5 text-[var(--muted)]">
            Map data © OpenStreetMap contributors (ODbL). GreenGap ranks relative need from mapped features only;
            building footprints are not population, and OSM coverage varies by neighbourhood.
          </p>
        </div>
      </section>
    </main>
  );
}
