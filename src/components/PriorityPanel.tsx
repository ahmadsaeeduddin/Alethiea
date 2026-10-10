"use client";

import { scoreBand } from "@/lib/scoring";
import type { RankedCell } from "@/types";

interface PriorityPanelProps {
  cells: RankedCell[];
  selectedCellId: string | null;
  onSelectCell: (id: string) => void;
  limit?: number;
}

export function PriorityPanel({ cells, selectedCellId, onSelectCell, limit = 8 }: PriorityPanelProps) {
  const top = cells.slice(0, limit);

  return (
    <section className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Priority queue</p>
          <h2 className="mt-1 font-semibold">Cells to investigate</h2>
        </div>
        <span className="rounded-full bg-[#edf4e8] px-2.5 py-1 text-xs font-semibold text-[var(--green)]">
          Top {top.length} of {cells.length}
        </span>
      </div>

      <ol className="mt-4 space-y-2">
        {top.map((cell) => {
          const band = scoreBand(cell.score);
          const active = cell.id === selectedCellId;
          return (
            <li key={cell.id}>
              <button
                type="button"
                onClick={() => onSelectCell(cell.id)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] ${
                  active ? "border-[var(--green)] bg-white" : "border-[var(--line)] bg-white/75 hover:bg-white"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eff3e9] text-sm font-semibold text-[var(--green-dark)]">
                  {cell.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">Cell {cell.id}</span>
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
        })}
      </ol>
    </section>
  );
}
