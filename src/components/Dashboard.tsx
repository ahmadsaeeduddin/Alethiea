import { MapShell } from "@/components/MapShell";

const metrics = [
  { label: "Pilot area", value: "4 km²", detail: "Lahore study zone" },
  { label: "Analysis grid", value: "~200 m", detail: "Comparable cells" },
  { label: "Planning radius", value: "150 m", detail: "Illustrative reach" },
];

const priorities = [
  { id: "A-07", area: "Northwest cell", status: "Awaiting data" },
  { id: "B-04", area: "Central cell", status: "Awaiting data" },
  { id: "C-09", area: "Southeast cell", status: "Awaiting data" },
];

export function Dashboard() {
  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <header className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-[var(--panel)] px-5 py-5 shadow-[0_18px_60px_rgba(39,65,43,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--green-dark)] text-xl text-[var(--lime)] shadow-sm" aria-hidden="true">
            ◒
          </div>
          <div>
            <p className="text-xl font-semibold tracking-[-0.04em]">GreenGap</p>
            <p className="text-sm text-[var(--muted)]">Lahore urban greening explorer</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--green-dark)] sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Foundation · v0.1
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <article key={metric.label} className="rounded-3xl border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--green-dark)]">{metric.value}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{metric.detail}</p>
              </article>
            ))}
          </div>

          <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_20px_60px_rgba(39,65,43,0.1)]">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h1 className="font-semibold tracking-[-0.02em]">Lahore pilot map</h1>
                <p className="mt-0.5 text-sm text-[var(--muted)]">Explore the initial 2 × 2 km study area.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-[var(--muted)]">
                <span className="rounded-full bg-[#edf4e8] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#4b8f55]" />Parks</span>
                <span className="rounded-full bg-[#f2f1ed] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#8a938b]" />Buildings</span>
                <span className="rounded-full bg-[#fff2de] px-3 py-1.5"><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#dc8d2d]" />Priority</span>
              </div>
            </div>
            <MapShell />
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <section className="rounded-[28px] bg-[var(--green-dark)] p-6 text-white shadow-[0_20px_60px_rgba(18,62,42,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lime)]">Mission</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.04em]">Find the places where more green could matter most.</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">GreenGap combines green-space scarcity, building concentration, and nearby public facilities into an explainable priority score.</p>
          </section>

          <section className="rounded-[28px] border border-white/80 bg-[var(--panel)] p-5 shadow-[0_12px_36px_rgba(39,65,43,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Priority queue</p>
                <h2 className="mt-1 font-semibold">Cells to investigate</h2>
              </div>
              <span className="rounded-full bg-[#edf4e8] px-2.5 py-1 text-xs font-semibold text-[var(--green)]">Preview</span>
            </div>

            <div className="mt-4 space-y-2">
              {priorities.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/75 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eff3e9] text-sm font-semibold text-[var(--green-dark)]">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.area}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{item.id} · {item.status}</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                </div>
              ))}
            </div>

            <p className="mt-4 rounded-2xl bg-[#f6f7f1] px-4 py-3 text-xs leading-5 text-[var(--muted)]">Rankings will activate when the local Lahore GeoJSON and scoring logic are connected in v0.5.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
