"use client";

import type { MapFeature, ScenarioResult } from "@/types";

interface ImpactComparisonProps {
  scenario: ScenarioResult;
  cellId: string;
  facilities: MapFeature[];
  onClear: () => void;
  limit?: number;
}

// One hue, two validated shades: lighter (hollow) = before, darker (filled) = after.
const BEFORE_COLOR = "#7fa98a";
const AFTER_COLOR = "#1f6b45";

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

export function ImpactComparison({ scenario, cellId, facilities, onClear, limit = 6 }: ImpactComparisonProps) {
  const reached = facilities.filter((f) => scenario.coveredFacilityIds.includes(f.properties.id));
  const gainPoints = (scenario.greenCoverAfter - scenario.greenCoverBefore) * 100;
  const changes = scenario.cellChanges.slice(0, limit);
  const hidden = scenario.cellChanges.length - changes.length;

  return (
    <section
      className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Proposed greening · hypothetical</p>
          <h2 className="mt-1 font-semibold">
            {scenario.radiusMeters} m cluster at cell {cellId}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--green-dark)] hover:bg-[#f6f7f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
        >
          Clear
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3">
        <p className="text-xs font-medium text-[var(--muted)]">Mapped green cover in the pilot area</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--green-dark)]">
          {percent(scenario.greenCoverBefore)} <span className="text-[var(--muted)]" aria-label="to">→</span>{" "}
          {percent(scenario.greenCoverAfter)}
        </p>
        <p className="mt-0.5 text-xs font-semibold text-[var(--green)]">+{gainPoints.toFixed(1)} percentage points</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/80 px-4 py-3">
          <p className="text-xs font-medium text-[var(--muted)]">High-priority cells reached</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--green-dark)]">
            {scenario.highPriorityCellsCovered}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">of {scenario.coveredCellIds.length} cells touched</p>
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-3">
          <p className="text-xs font-medium text-[var(--muted)]">Schools & hospitals within {scenario.radiusMeters} m</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--green-dark)]">{reached.length}</p>
          <p className="mt-0.5 break-words text-xs text-[var(--muted)]">
            {reached.length
              ? reached.map((f) => f.properties.name ?? (f.properties.category === "school" ? "School" : "Hospital")).join(", ")
              : "None mapped"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Priority score, 0–100</h3>
          <p className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 bg-white" style={{ borderColor: BEFORE_COLOR }} aria-hidden="true" />
              Before
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: AFTER_COLOR }} aria-hidden="true" />
              After
            </span>
          </p>
        </div>

        {changes.length ? (
          <ul className="mt-3 space-y-3">
            {changes.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-xs"
                title={`Cell ${c.id}: ${c.before} before, ${c.after} after`}
              >
                <span className="font-semibold text-[var(--green-dark)]">{c.id}</span>
                <span
                  className="relative h-3"
                  role="img"
                  aria-label={`Cell ${c.id} priority score ${c.before} before, ${c.after} after`}
                >
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--line)]" />
                  <span
                    className="absolute top-1/2 h-0.5 -translate-y-1/2"
                    style={{ left: `${c.after}%`, width: `${c.before - c.after}%`, backgroundColor: BEFORE_COLOR }}
                  />
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
                    style={{ left: `${c.before}%`, borderColor: BEFORE_COLOR }}
                  />
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                    style={{ left: `${c.after}%`, backgroundColor: AFTER_COLOR }}
                  />
                </span>
                <span className="text-right tabular-nums text-[var(--green-dark)]">
                  {c.before} → <span className="font-semibold">{c.after}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            No scored cell would change: everything within reach is already close to mapped green space.
          </p>
        )}
        {hidden > 0 && <p className="mt-2 text-xs text-[var(--muted)]">+{hidden} more cells with smaller drops</p>}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
        Hypothetical geographic coverage only. It does not assess planting suitability or predict cooling benefits.
      </p>
    </section>
  );
}
