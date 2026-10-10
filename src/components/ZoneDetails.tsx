"use client";

import { SCENARIO_RADIUS_METERS } from "@/lib/scenario";
import { COMPONENT_LABELS, FACILITY_RADIUS_METERS, priorityBand } from "@/lib/scoring";
import type { RankedCell, ScoreComponents, ScoreWeights } from "@/types";

interface ZoneDetailsProps {
  cell: RankedCell | null;
  scoredCells: number;
  weights: ScoreWeights;
  onSelectTop: () => void;
  /** A greening cluster is currently proposed at this cell. */
  isProposed: boolean;
  onToggleProposal: () => void;
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

function ScoreMeter({ score, color, scored }: { score: number; color: string; scored: boolean }) {
  const size = 76;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = scored ? Math.max(0, Math.min(100, score)) : 0;
  const offset = circ - (circ * pct) / 100;

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      aria-label={scored ? `Priority score ${score} out of 100` : "Not scored"}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        {scored && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500 motion-safe:ease-out"
          />
        )}
      </svg>
      <span className="absolute text-xl font-semibold text-[var(--green-dark)]">
        {scored ? score : "–"}
      </span>
    </div>
  );
}

export function ZoneDetails({ cell, scoredCells, weights, onSelectTop, isProposed, onToggleProposal }: ZoneDetailsProps) {
  if (!cell) {
    return (
      <section className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[var(--shadow-glass-md)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Zone details</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Click a grid cell on the map or pick one from the queue to see why it scored the way it did.
        </p>
        <button
          type="button"
          onClick={onSelectTop}
          className="mt-4 min-h-11 rounded-full bg-[var(--green-dark)] px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)]"
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
      className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[var(--shadow-glass-md)] motion-safe:animate-slide-up"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Zone details</p>
          <h2 className="mt-1 text-lg font-semibold">Cell {cell.id}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {isScored
              ? `Rank #${cell.rank} of ${scoredCells} scored`
              : "Not scored · nothing mapped in this cell"}
          </p>
          {isScored && (
            <span
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--green-dark)]"
              style={{ backgroundColor: band.color }}
            >
              {band.label} priority
            </span>
          )}
        </div>
        <ScoreMeter score={cell.score} color={band.color} scored={isScored} />
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
                <div
                  className="h-full rounded-full bg-[var(--green)] motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
                  style={{ width: `${value}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{rawLabel(key, cell)}</p>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onToggleProposal}
        aria-pressed={isProposed}
        className={`group mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)] ${
          isProposed
            ? "border border-[var(--line)] bg-white text-[var(--green-dark)] hover:bg-[#f6f7f1]"
            : "bg-[var(--green-dark)] text-white hover:bg-[var(--green)]"
        }`}
      >
        {isProposed ? (
          <>Remove proposed cluster</>
        ) : (
          <>
            <span aria-hidden="true">✚</span>
            Propose a {SCENARIO_RADIUS_METERS} m greening cluster here
          </>
        )}
      </button>

      <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
        Factor scores are normalised 0–100 relative to the other scored cells. Priority bands are relative too: Very
        high is the top 10% of scored cells.
      </p>
    </section>
  );
}
