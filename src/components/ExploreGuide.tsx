"use client";

import { SCENARIO_RADIUS_METERS } from "@/lib/scenario";

interface ExploreGuideProps {
  hasSelection: boolean;
  hasProposal: boolean;
}

/** Three-step walkthrough that tracks where the visitor is in the explore flow. */
export function ExploreGuide({ hasSelection, hasProposal }: ExploreGuideProps) {
  const steps = [
    {
      title: "Pick a zone",
      body: "Click a coloured cell on the map, or a row in the priority queue.",
      done: hasSelection,
    },
    {
      title: "Propose greening",
      body: `Drop a hypothetical ${SCENARIO_RADIUS_METERS} m green cluster on the selected zone.`,
      done: hasProposal,
    },
    {
      title: "Compare before and after",
      body: "See which scores fall, which schools or hospitals it reaches, and how green cover changes.",
      done: false,
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <section className="rounded-[28px] bg-[var(--green-dark)] p-6 text-white shadow-[0_20px_60px_rgba(18,62,42,0.18)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lime)]">How to use GreenGap</p>
      <h2 className="mt-2 text-xl font-semibold leading-tight tracking-[-0.03em]">
        Find where more green could matter most.
      </h2>
      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          return (
            <li
              key={step.title}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex gap-3 rounded-2xl px-3 py-2.5 transition ${isCurrent ? "bg-white/10" : ""}`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  step.done
                    ? "bg-[var(--lime)] text-[var(--green-dark)]"
                    : isCurrent
                      ? "bg-white text-[var(--green-dark)]"
                      : "border border-white/30 text-white/60"
                }`}
                aria-hidden="true"
              >
                {step.done ? "✓" : index + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${step.done || isCurrent ? "text-white" : "text-white/60"}`}>
                  {step.title}
                  {step.done && <span className="sr-only"> (done)</span>}
                </span>
                <span className={`mt-0.5 block text-xs leading-5 ${isCurrent ? "text-white/80" : "text-white/50"}`}>
                  {step.body}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
