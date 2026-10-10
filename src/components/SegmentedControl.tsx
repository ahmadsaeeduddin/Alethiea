"use client";

import type { KeyboardEvent, ReactNode } from "react";

interface SegmentedControlProps<T extends string | number> {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  renderOption: (value: T) => ReactNode;
  ariaLabel: string;
  className?: string;
}

/**
 * Pill-shaped segmented control with a sliding active highlight.
 * Semantically a WAI-ARIA radiogroup; arrow keys cycle, Home/End jump.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  renderOption,
  ariaLabel,
  className = "",
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(0, options.indexOf(value));
  const count = options.length;

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next !== null) {
      event.preventDefault();
      onChange(options[next]);
    }
  };

  // Pill geometry: inset-1 pins to the padded inner frame; width/translate computed in calc()
  // so the pill matches each option's content-box exactly.
  const pillStyle = {
    width: `calc((100% - 0.5rem) / ${count})`,
    transform: `translateX(calc(${activeIndex} * ((100% - 0.5rem) / ${count})))`,
  } as const;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative inline-grid auto-cols-fr grid-flow-col rounded-full border border-[var(--line)] bg-white/70 p-1 shadow-[var(--shadow-glass-sm)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-1 rounded-full bg-[var(--green-dark)] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none"
        style={pillStyle}
      />
      {options.map((opt, index) => {
        const active = value === opt;
        return (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt)}
            onKeyDown={(event) => handleKey(event, index)}
            className="relative z-[1] min-h-11 px-3 py-2 text-sm font-semibold text-[var(--green-dark)] aria-checked:text-white data-[active=true]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2 motion-safe:transition-colors"
          >
            {renderOption(opt)}
          </button>
        );
      })}
    </div>
  );
}
