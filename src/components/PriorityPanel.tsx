"use client";

import { useState } from "react";
import { priorityBand } from "@/lib/scoring";
import type { PriorityLevel, RankedCell } from "@/types";

interface PriorityPanelProps {
  cells: RankedCell[];
  selectedCellId: string | null;
  onSelectCell: (id: string) => void;
  limit?: number;
  /** Current hovered cell, drawn as an outline on the map. */
  hoveredCellId?: string | null;
  onHoverCell?: (id: string | null) => void;
}

const FILTERS: { key: "all" | PriorityLevel; label: string }[] = [
  { key: "all", label: "All" },
  { key: "very-high", label: "Critical" },
  { key: "high", label: "High" },
  { key: "moderate", label: "Moderate" },
];

export function PriorityPanel({
  cells,
  selectedCellId,
  onSelectCell,
  limit = 10,
  hoveredCellId = null,
  onHoverCell,
}: PriorityPanelProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const filtered = filter === "all" ? cells : cells.filter((c) => c.priority === filter);
  const top = filtered.slice(0, limit);

  return (
    <section className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[var(--shadow-glass-md)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Priority queue</p>
          <h2 className="mt-1 font-semibold">Cells to investigate</h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#edf4e8] px-2.5 py-1 text-xs font-semibold text-[var(--green)]">
          {top.length} of {cells.length}
        </span>
      </div>

      {/* Filter chips */}
      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by priority">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] ${
                active
                  ? "border-[var(--green-dark)] bg-[var(--green-dark)] text-white"
                  : "border-[var(--line)] bg-white/70 text-[var(--muted)] hover:text-[var(--green-dark)]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <ol className="mt-4 space-y-2">
        {top.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-[var(--line)] bg-white/50 p-4 text-xs text-[var(--muted)]">
            No cells in this band.
          </li>
        ) : (
          top.map((cell) => {
            const band = priorityBand(cell.priority);
            const active = cell.id === selectedCellId;
            const hovered = cell.id === hoveredCellId;
            return (
              <li key={cell.id}>
                <button
                  type="button"
                  onClick={() => onSelectCell(cell.id)}
                  onMouseEnter={() => onHoverCell?.(cell.id)}
                  onMouseLeave={() => onHoverCell?.(null)}
                  onFocus={() => onHoverCell?.(cell.id)}
                  onBlur={() => onHoverCell?.(null)}
                  aria-pressed={active}
                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] ${
                    active
                      ? "border-[var(--green)] bg-white shadow-[var(--shadow-glass-md)]"
                      : hovered
                        ? "border-[var(--green)]/50 bg-white"
                        : "border-[var(--line)] bg-white/75 hover:bg-white"
                  }`}
                >
                  {/* Priority accent bar */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ backgroundColor: band.color }}
                  />
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eff3e9] text-sm font-semibold text-[var(--green-dark)]">
                    {cell.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">Cell {cell.id}</span>
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--green-dark)]"
                        style={{ backgroundColor: band.color }}
                      >
                        {band.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{cell.reason}</span>
                  </span>
                  <span
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--green-dark)]"
                    style={{ backgroundColor: band.color }}
                    title={`${band.label} priority`}
                  >
                    {cell.score}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ol>
    </section>
  );
}
