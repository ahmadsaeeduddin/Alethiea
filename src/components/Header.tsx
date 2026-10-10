"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { StatusPill } from "@/components/StatusPill";

const NAV_LINKS = [
  { href: "/#overview", label: "Overview" },
  { href: "/#presets", label: "Presets" },
  { href: "/#methodology", label: "Methodology" },
  { href: "/explore", label: "Live analysis" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const onExplore = pathname?.startsWith("/explore") ?? false;

  const action = onExplore
    ? { href: "/", label: "Change area" }
    : { href: "#presets", label: "Jump to presets" };

  const isLinkActive = (href: string) => {
    if (href === "/explore") return onExplore;
    if (href.startsWith("/#")) return !onExplore;
    return false;
  };

  return (
    <>
      <header className="glass-nav sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--green-dark)] text-xl text-[var(--lime)] shadow-sm motion-safe:animate-glow-pulse motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-12"
            >
              ◒
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold tracking-[-0.03em] text-[var(--green-dark)]">
                GreenGap
              </span>
              <span className="eyebrow !text-[10px]">Urban greening priority</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const active = isLinkActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`relative rounded-full px-3 py-2 text-sm font-medium transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] ${
                        active ? "text-[var(--green-dark)]" : "text-[var(--muted)] hover:text-[var(--green-dark)]"
                      }`}
                    >
                      {link.label}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[var(--green)]"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            <StatusPill compact className="hidden sm:inline-flex" />
            <Link
              href={action.href}
              className="hidden min-h-11 items-center gap-1.5 rounded-full bg-[var(--green-dark)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)] md:inline-flex"
            >
              {action.label}
              <span aria-hidden="true" className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5">
                →
              </span>
            </Link>

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Open navigation"
              aria-controls="mobile-nav"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileNavDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
