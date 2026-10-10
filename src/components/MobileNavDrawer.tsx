"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { StatusPill } from "@/components/StatusPill";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NAV_LINKS = [
  { href: "/#overview", label: "Overview" },
  { href: "/#presets", label: "Presets" },
  { href: "/#methodology", label: "Methodology" },
  { href: "/explore", label: "Live analysis" },
] as const;

// Module-scope client-mount detector — no setState-in-effect needed.
const subscribeMount = () => () => {};
const getMountSnapshot = () => true;
const getMountServerSnapshot = () => false;

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const mounted = useSyncExternalStore(subscribeMount, getMountSnapshot, getMountServerSnapshot);
  const sheetRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Focus trap + Esc close + body scroll lock. Only runs while drawer is open.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;

    // Focus the first focusable element (close button).
    const focusables = () =>
      Array.from(
        sheet?.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const first = focusables()[0];
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const action = pathname?.startsWith("/explore")
    ? { href: "/", label: "Change area" }
    : { href: "#presets", label: "Jump to presets" };

  if (!mounted || !open) return null;

  return createPortal(
    <div role="presentation">
      {/* Backdrop — z-[60] above sticky Header (z-50) and bottom tab bar (z-40). */}
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/40 motion-safe:animate-fade-in"
      />
      {/* Sheet — z-[70] above the backdrop. */}
      <aside
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
        className="fixed inset-y-0 right-0 z-[70] flex w-[86vw] max-w-sm translate-x-0 flex-col gap-6 bg-[var(--background)] p-5 shadow-[0_30px_80px_rgba(18,62,42,0.3)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
      >
        <h2 id="mobile-nav-title" className="sr-only">
          GreenGap navigation
        </h2>

        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--green-dark)] text-xl text-[var(--lime)]"
            >
              ◒
            </span>
            <span className="text-lg font-semibold tracking-[-0.03em] text-[var(--green-dark)]">
              GreenGap
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] bg-white text-xl text-[var(--green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
          >
            ×
          </button>
        </div>

        <nav aria-label="Primary">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="flex min-h-11 items-center rounded-2xl px-3 py-3 text-base font-semibold text-[var(--green-dark)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <StatusPill />
          <Link
            href={action.href}
            onClick={onClose}
            className="flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--green-dark)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)]"
          >
            {action.label}
          </Link>
          <p className="text-[11px] leading-5 text-[var(--muted)]">
            Map data © OpenStreetMap contributors (ODbL).
          </p>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
