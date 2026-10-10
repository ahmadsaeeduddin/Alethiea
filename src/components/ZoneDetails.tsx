"use client";

import { COMPONENT_LABELS, FACILITY_RADIUS_METERS, priorityBand } from "@/lib/scoring";
import type { RankedCell, ScoreComponents, ScoreWeights } from "@/types";

interface ZoneDetailsProps {
  cell: RankedCell | null;
  scoredCells: number;
  weights: ScoreWeights;
  onSelectTop: () => void;
}

function rawLabel(key: keyof ScoreComponents, cell: RankedCell): string {
  const m = cell.metrics;
  switch (key) {
    case "greenScarcity":
      if (m.nearestGreenMeters === 0) return "Touches mapped green space";
      return Number.isFinite(m.nearestGreenMeters)
        ? `Nearest mapped green space ${Math.round(m.nearestGreenMeters)} m away`
        : "No mapped green space";
    case "buildingConcentration":
      return `${m.buildingCount} mapped building${m.buildingCount === 1 ? "" : "s"} in cell`;
    case "vulnerableFacilities":
      return `${m.facilityCount} within ${FACILITY_RADIUS_METERS} m`;
  }
}

export function ZoneDetails({ cell, scoredCells, weights, onSelectTop }: ZoneDetailsProps) {
  if (!cell) {
    return (
      <section className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Zone details</p>
        <p className="mt-2 text-sm text-[var(--muted)]">Click a grid cell on the map or pick one from the queue to see why it scored the way it did.</p>
        <button
          type="button"
          onClick={onSelectTop}
          className="mt-4 rounded-full bg-[var(--green-dark)] px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)]"
        >
          Inspect top priority
        </button>
      </section>
    );
  }

  const band = priorityBand(cell.priority);
  const isScored = cell.priority !== "unscored";
  const keys = (Object.keys(cell.components) as (keyof ScoreComponents)[]).filter((k) => weights[k] > 0);

  return (
    <section
      className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Zone details</p>
          <h2 className="mt-1 text-lg font-semibold">Cell {cell.id}</h2>
          <p className="text-xs text-[var(--muted)]">
            {isScored
              ? `Rank #${cell.rank} of ${scoredCells} scored · ${band.label} priority`
              : "Not scored · nothing mapped in this cell"}
          </p>
        </div>
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-semibold text-[var(--green-dark)]"
          style={{ backgroundColor: band.color }}
          aria-label={isScored ? `Priority score ${cell.score} out of 100` : "Not scored"}
        >
          {isScored ? cell.score : "–"}
        </div>
      </div>

      <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-[var(--green-dark)]">{cell.reason}</p>

      <ul className="mt-4 space-y-3">
        {keys.map((key) => {
          const value = cell.components[key];
          const weightPct = Math.round(weights[key] * 100);
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-[var(--green-dark)]">
                  {COMPONENT_LABELS[key]} <span className="font-normal text-[var(--muted)]">· {weightPct}% weight</span>
                </span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e7ece1]"
                role="meter"
                aria-label={COMPONENT_LABELS[key]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
              >
                <div className="h-full rounded-full bg-[var(--green)]" style={{ width: `${value}%` }} />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{rawLabel(key, cell)}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
        Factor scores are normalised 0–100 relative to the other scored cells. Priority bands are relative too: Very
        high is the top 10% of scored cells.
      </p>
    </section>
  );
}
