"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/SegmentedControl";
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

const HIGHLIGHTS = [
  { icon: "▦", label: "200 m spatial grid", detail: "Every block scored 0–100" },
  { icon: "⚡", label: "OpenStreetMap live", detail: "Streams in seconds" },
  { icon: "◆", label: "Explainable scoring", detail: "50 / 30 / 20 weights" },
] as const;

const JOURNEY = [
  { title: "Choose an area", body: "Search a place, pick a preset, or click the map to recentre.", icon: "⌖" },
  { title: "See the priority grid", body: "Every cell is scored 0–100 and ranked, with the reasons shown.", icon: "▦" },
  { title: "Test a greening cluster", body: "Drop a 150 m green space and compare before and after.", icon: "✚" },
] as const;

export function AreaPicker() {
  const router = useRouter();
  const [area, setArea] = useState<AreaSelection>(DEFAULT_AREA);
  const [label, setLabel] = useState<string>(AREA_PRESETS[0].name);
  const [recenterKey, setRecenterKey] = useState(0);
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState(false);
  /** Last finished search, tagged with the term it answered. */
  const [search, setSearch] = useState<{ term: string; hits: GeocodeHit[]; failed: boolean } | null>(null);
  const hitsListRef = useRef<HTMLUListElement>(null);

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

  // Keyboard nav for hit list: ArrowDown from the input moves focus into the list.
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && hits.length > 0) {
      event.preventDefault();
      const first = hitsListRef.current?.querySelector<HTMLButtonElement>("button");
      first?.focus();
    }
  };

  const onHitKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = Array.from(
      hitsListRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    const idx = buttons.indexOf(event.currentTarget);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[(idx + 1) % buttons.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (idx === 0) {
        document.getElementById("place-search")?.focus();
      } else {
        buttons[idx - 1]?.focus();
      }
    }
  };

  return (
    <div className="relative">
      {/* Ambient hero gradient layer under the first screen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] hero-gradient"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] hero-grid-overlay"
      />

      <div className="relative mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* ─── Hero ─── */}
        <section id="overview" className="pb-10 pt-4 motion-safe:animate-fade-in">
          <span className="eyebrow">Explainable urban greening</span>
          <h1 className="editorial-headline mt-3 max-w-3xl text-4xl text-[var(--green-dark)] sm:text-5xl lg:text-6xl">
            See where a neighbourhood needs greenery most.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            Cities have limited greening budgets. GreenGap scores every 200 m block by green-space scarcity, building
            density and nearby schools and hospitals, then lets you test where a new green space would help.
          </p>

          <ul className="mt-7 flex flex-wrap gap-2.5">
            {HIGHLIGHTS.map((item, i) => (
              <li
                key={item.label}
                className={`glass-panel flex items-center gap-2.5 rounded-full px-4 py-2 text-sm shadow-[var(--shadow-glass-sm)] motion-safe:animate-float motion-safe:delay-${(i + 1) * 100}`}
                style={{ animationDelay: `${(i + 1) * 180}ms` }}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--green-dark)] text-xs text-[var(--lime)]" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="font-semibold text-[var(--green-dark)]">{item.label}</span>
                <span className="hidden text-xs text-[var(--muted)] sm:inline">· {item.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── 3-step journey ─── */}
        <section className="mb-12 motion-safe:animate-slide-up">
          <ol className="relative grid gap-4 sm:grid-cols-3">
            {/* Connecting line (visible on sm+) */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-[var(--line)] to-transparent sm:block"
            />
            {JOURNEY.map((step, index) => (
              <li
                key={step.title}
                className="glass-panel relative rounded-3xl p-5 shadow-[var(--shadow-glass-md)] motion-safe:transition-all motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--shadow-glass-lg)]"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--green-dark)] text-lg text-[var(--lime)] shadow-md motion-safe:animate-glow-pulse">
                    <span aria-hidden="true">{step.icon}</span>
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--background)] bg-[var(--green)] text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--green-dark)]">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── Picker + Map ─── */}
        <section id="presets" className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
          <div className="glass-panel rounded-[28px] p-5 shadow-[var(--shadow-glass-lg)] sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--green-dark)]">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--green)] text-xs font-bold text-white">
                1
              </span>
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
                onKeyDown={onSearchKeyDown}
                placeholder="Search a neighbourhood or city"
                autoComplete="off"
                className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-white py-3 pl-10 pr-10 text-sm outline-none transition focus:border-[var(--green)] focus-visible:ring-2 focus-visible:ring-[var(--green)]/30"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[var(--muted)] hover:bg-[#f2f6ee] hover:text-[var(--green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
                >
                  ×
                </button>
              )}
              {searchState === "searching" && (
                <span
                  aria-hidden="true"
                  className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[var(--line)] border-t-[var(--green)] motion-safe:animate-spin"
                />
              )}
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
              <ul
                ref={hitsListRef}
                className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-1 motion-safe:animate-slide-down"
              >
                {hits.map((hit) => {
                  const [name, ...rest] = hit.label.split(",");
                  return (
                    <li key={`${hit.lat},${hit.lng}`}>
                      <button
                        type="button"
                        onClick={() => jumpTo([hit.lng, hit.lat], name)}
                        onKeyDown={onHitKeyDown}
                        className="w-full rounded-xl px-3 py-2 text-left text-xs leading-5 transition hover:bg-[#f2f6ee] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="block font-semibold text-[var(--green-dark)]">{name}</span>
                          <span className="shrink-0 rounded-full bg-[#eff3e9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--green)]">
                            OSM
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[var(--muted)]">{rest.join(",").trim()}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-5 text-xs font-medium text-[var(--muted)]">Or start from a Lahore neighbourhood</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {AREA_PRESETS.map((preset) => {
                const active = label === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    aria-pressed={active}
                    data-active={active}
                    onClick={() => jumpTo(preset.area.center, preset.name)}
                    className="group relative rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[var(--shadow-glass-sm)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] data-[active=true]:border-[var(--green)] data-[active=true]:bg-white data-[active=true]:shadow-[var(--shadow-glass-md)] data-[active=true]:ring-2 data-[active=true]:ring-[var(--green)]/40 motion-safe:transition-all"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--green-dark)]">
                      {preset.name}
                      {active && (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--green)] text-[10px] font-bold text-white" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">{preset.detail}</span>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold text-[var(--green-dark)]">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--green)] text-xs font-bold text-white">
                2
              </span>
              Choose a size
            </h2>
            <div className="mt-3">
              <SegmentedControl
                options={AREA_SIZE_OPTIONS}
                value={area.sizeKm}
                onChange={(v) => setArea((prev) => ({ ...prev, sizeKm: v }))}
                ariaLabel="Study area size"
                renderOption={(v) => (
                  <span>
                    {v} × {v} km
                  </span>
                )}
                className="w-full"
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {cells} cells of {GRID_CELL_SIZE_METERS} m. Larger areas take longer the first time they load.
            </p>

            {/* Action card */}
            <div className="relative mt-6 overflow-hidden rounded-2xl bg-[var(--green-dark)] p-5 text-white shadow-[0_20px_60px_rgba(18,62,42,0.3)] motion-safe:animate-glow-pulse">
              <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--lime)]/15 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lime)]">
                    Ready to analyse
                  </p>
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
                className="group relative mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-4 py-3 text-sm font-semibold text-[var(--green-dark)] shadow-md transition hover:bg-white disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {starting ? (
                  <>
                    <span
                      className="h-4 w-4 rounded-full border-2 border-[var(--green-dark)]/30 border-t-[var(--green-dark)] motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    Opening the analysis…
                  </>
                ) : (
                  <>
                    Analyse this area
                    <span aria-hidden="true" className="motion-safe:transition-transform motion-safe:group-hover:translate-x-1">
                      →
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="min-w-0">
            <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[var(--shadow-glass-lg)]">
              <div className="flex flex-col gap-1 border-b border-[var(--line)] px-5 py-4 sm:px-6">
                <h2 className="font-semibold tracking-[-0.02em]">Click the map to move the study area</h2>
                <p className="text-sm text-[var(--muted)]">
                  The shaded square is what gets analysed. It works anywhere OpenStreetMap has coverage.
                </p>
              </div>
              <div className="relative">
                <AreaPickerMap area={area} onPickCenter={pickCenter} recenterKey={recenterKey} />
                <p className="glass-panel pointer-events-none absolute left-4 top-4 z-[500] rounded-full px-3 py-1.5 text-xs font-medium text-[var(--green-dark)] shadow-md motion-safe:animate-fade-in">
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

        {/* ─── Methodology section ─── */}
        <section id="methodology" className="mt-16 grid gap-5 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div>
            <span className="eyebrow">Methodology</span>
            <h2 className="editorial-headline mt-3 text-3xl text-[var(--green-dark)] sm:text-4xl">
              Transparent scoring, explainable priorities.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              GreenGap scores every grid cell with a fixed weighted sum: <strong className="font-semibold text-[var(--green-dark)]">50%</strong> green-space scarcity, <strong className="font-semibold text-[var(--green-dark)]">30%</strong> building density, and{" "}
              <strong className="font-semibold text-[var(--green-dark)]">20%</strong> nearby schools and hospitals. When a layer is missing in the study area (for
              example no mapped schools), those weights are renormalised across the remaining factors so the 0–100 scale
              still makes sense. Scores are relative — the top-ranked cell is always the most underserved in that square.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              The scenario tool proposes a hypothetical <strong className="font-semibold text-[var(--green-dark)]">150 m</strong> green cluster at any cell and shows which
              scores would drop and which facilities fall within reach. It is a geographic coverage estimate for
              investigation — not a planting-suitability study or an engineering approval.
            </p>
          </div>

          <ul className="grid gap-3 self-start">
            {[
              {
                label: "Green-space scarcity",
                weight: "50%",
                detail: "Distance from each cell to the nearest mapped park, garden, pitch or grass.",
                tone: "bg-[var(--color-accent-red)]",
              },
              {
                label: "Building density",
                weight: "30%",
                detail: "Count of mapped building footprints inside the cell.",
                tone: "bg-[var(--color-accent-amber)]",
              },
              {
                label: "Schools & hospitals",
                weight: "20%",
                detail: "Count of mapped facilities within 400 m of the cell centre.",
                tone: "bg-[var(--color-accent-green)]",
              },
            ].map((row) => (
              <li
                key={row.label}
                className="glass-panel flex items-start gap-3 rounded-2xl p-4 shadow-[var(--shadow-glass-sm)]"
              >
                <span className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full ${row.tone}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="flex items-baseline justify-between gap-2 text-sm font-semibold text-[var(--green-dark)]">
                    <span>{row.label}</span>
                    <span className="shrink-0 rounded-full bg-[#eff3e9] px-2 py-0.5 text-xs font-bold text-[var(--green)]">
                      {row.weight}
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{row.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
