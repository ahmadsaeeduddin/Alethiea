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

  return (
    <main className="mx-auto min-h-screen max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--green-dark)] text-xl text-[var(--lime)] shadow-sm" aria-hidden="true">
            ◒
          </div>
          <div>
            <p className="text-xl font-semibold tracking-[-0.04em]">GreenGap</p>
            <p className="text-sm text-[var(--muted)]">Urban greening priority explorer</p>
          </div>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
          Cities have limited greening budgets. GreenGap ranks small zones by how underserved they are by mapped
          greenery, so planners know where to look first.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div className="rounded-[28px] bg-[var(--green-dark)] p-6 text-white shadow-[0_20px_60px_rgba(18,62,42,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lime)]">Step 1</p>
            <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.04em]">
              Choose the area you want to study.
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Search a place, pick a preset, or click the map. Everything after this — the priority grid, the scores and
              the greening scenario — is computed live from OpenStreetMap for the square you choose.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
            <label htmlFor="place-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Search a place
            </label>
            <input
              id="place-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Gulberg Lahore"
              autoComplete="off"
              className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--green)] focus-visible:ring-2 focus-visible:ring-[var(--green)]/30"
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]" aria-live="polite">
              {searchState === "searching"
                ? "Searching…"
                : searchState === "error"
                  ? "Place search is unavailable. Click the map instead."
                  : "Powered by OpenStreetMap Nominatim."}
            </p>

            {hits.length > 0 && (
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {hits.map((hit) => (
                  <li key={`${hit.lat},${hit.lng}`}>
                    <button
                      type="button"
                      onClick={() => jumpTo([hit.lng, hit.lat], hit.label.split(",")[0])}
                      className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 text-left text-xs leading-5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
                    >
                      {hit.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Or start from</p>
            <div className="mt-2 grid gap-2">
              {AREA_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => jumpTo(preset.area.center, preset.name)}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] ${
                    label === preset.name ? "border-[var(--green)] bg-white" : "border-[var(--line)] bg-white/70"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[var(--green-dark)]">{preset.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">{preset.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Area size</p>
            <div className="mt-2 flex gap-2" role="group" aria-label="Study area size">
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
              {cells} cells of {GRID_CELL_SIZE_METERS} m. Larger areas take longer to load from OpenStreetMap.
            </p>

            <dl className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--muted)]">Selected</dt>
                <dd className="font-semibold text-[var(--green-dark)]">{label}</dd>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <dt className="text-[var(--muted)]">Centre</dt>
                <dd className="font-medium tabular-nums text-[var(--green-dark)]">{formatCenter(area.center)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="mt-4 w-full rounded-full bg-[var(--green-dark)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--green)] disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)]"
            >
              {starting ? "Loading area…" : `Analyse this ${area.sizeKm} × ${area.sizeKm} km area`}
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_20px_60px_rgba(39,65,43,0.1)]">
            <div className="flex flex-col gap-1 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="font-semibold tracking-[-0.02em]">Click anywhere to centre the study area</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  The shaded square is what gets analysed. Works anywhere OpenStreetMap has coverage.
                </p>
              </div>
            </div>
            <AreaPickerMap area={area} onPickCenter={pickCenter} recenterKey={recenterKey} />
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
