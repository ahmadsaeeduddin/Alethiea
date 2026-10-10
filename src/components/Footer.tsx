import Link from "next/link";

const TECH_STACK = [
  { label: "Next.js 16", href: "https://nextjs.org/" },
  { label: "React 19", href: "https://react.dev/" },
  { label: "Tailwind v4", href: "https://tailwindcss.com/" },
  { label: "Leaflet", href: "https://leafletjs.com/" },
  { label: "Turf.js", href: "https://turfjs.org/" },
  { label: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
];

export function Footer() {
  return (
    <footer
      id="footer"
      className="relative mt-20 border-t border-[var(--line)] bg-[var(--green-dark)] text-white"
    >
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {/* Brand & purpose */}
        <div className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl text-[var(--lime)]"
            >
              ◒
            </span>
            <p className="text-lg font-semibold tracking-[-0.03em]">GreenGap</p>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/70">
            An explainable urban greening prioritization tool. We rank every 200 m block by scarcity, density, and
            nearby public facilities, so cities can target investigation where it may matter most.
          </p>
        </div>

        {/* Methodology */}
        <div id="methodology-footer">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lime)]">Methodology</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
            <li>50% green-space scarcity</li>
            <li>30% building density</li>
            <li>20% schools &amp; hospitals</li>
            <li>Weights renormalise when a layer is missing</li>
            <li>Scenarios test a 150 m hypothetical cluster</li>
          </ul>
        </div>

        {/* Attribution */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lime)]">Data attribution</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
            <li>
              Map data ©{" "}
              <a
                className="underline decoration-white/40 underline-offset-2 hover:text-white"
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap contributors
              </a>{" "}
              under ODbL.
            </li>
            <li>
              Place search by{" "}
              <a
                className="underline decoration-white/40 underline-offset-2 hover:text-white"
                href="https://nominatim.openstreetmap.org/"
                target="_blank"
                rel="noreferrer"
              >
                Nominatim
              </a>
              .
            </li>
            <li className="text-white/60">
              Scores reflect mapped features to guide site investigation, not civil-engineering approval.
            </li>
          </ul>
        </div>

        {/* Tech stack */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lime)]">Built with</p>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {TECH_STACK.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2.5 py-1 font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              href="/"
              className="text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
            >
              Change area
            </Link>
            <Link
              href="/explore"
              className="text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
            >
              Live analysis
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} GreenGap · an open prototype for urban greening prioritization.</p>
          <p>
            Scores guide investigation. They do not replace site surveys, planting-suitability studies, or engineering
            approval.
          </p>
        </div>
      </div>
    </footer>
  );
}
