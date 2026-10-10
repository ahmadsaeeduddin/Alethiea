# GreenGap Frontend Visual Redesign — Technical Design

## Overview

This design executes a pure visual + interaction redesign of the GreenGap (Alethiea) Next.js app. It introduces two global surfaces (sticky glassmorphic Header, polished Footer), elevates the landing hero and area picker, reskins the map shells and the full `/explore` dashboard, and adds a `<768px` tab switcher for the three dashboard panes. Every change is CSS- and markup-level: no scoring weights (`src/lib/scoring.ts`), scenario geometry (`src/lib/scenario.ts`), Overpass streaming contract (`src/app/api/area/route.ts`), Nominatim proxy (`src/app/api/geocode/route.ts`), geographic utilities (`src/lib/area.ts`, `src/lib/geoUtils.ts`, `src/lib/osm.ts`, `src/lib/areaCache.ts`), type contracts (`src/types/index.ts`), nor the URL contract (`lat`, `lng`, `size`, `label` — note the on-wire param is `size`, serialised by `areaToParams` in `src/lib/area.ts`; the in-memory `AreaSelection` property is `sizeKm`) is touched. Those files are off-limits for this task and are referenced only to source read-only values (band colors, scenario radius, etc.).

The look is: glassmorphic surfaces over a soft green hero gradient; editorial, high-contrast tracking-tight headlines; motion that is subtle (fade/slide/shimmer, hover lifts) and always gated through the existing `motion-safe:` / `motion-reduce:` keyframes already present in `src/app/globals.css`. The priority chrome is driven by a single palette — critical red, moderate amber, lower light-green — exposed as CSS variables and consumed by both `PriorityPanel` row accents and `MapView` polygon chrome, while the authoritative band color continues to come from `priorityBand(cell.priority).color` (owned by `src/lib/scoring.ts`, untouched).

## Technology stack (locked)

- Next.js 16 App Router, React 19, TypeScript 6 — unchanged.
- Tailwind CSS v4 via `@tailwindcss/postcss` — the single source of styling. A `@theme` token block is added to `src/app/globals.css`.
- Leaflet 1.9 + React-Leaflet 5 (SSR disabled via `next/dynamic`) — unchanged. Only container chrome and overlay elements are redesigned.
- Dark mode: Tailwind v4's default `prefers-color-scheme` strategy. `dark:` variants in the Header (`dark:bg-[#123e2a]/80`) react to the OS media query. No manual toggle is added — that would be scope creep.
- **No new runtime dependencies.** All motion uses the existing keyframes in `globals.css` (`fade-in`, `slide-up`, `slide-down`, `shimmer`, `float`, `glow-pulse`, `gradient-shift`, `pop-in`) plus Tailwind transition utilities. framer-motion was considered and rejected: every effect called for by DESIGN.md § 3.H is already expressible with the existing CSS, and adding a 50 KB dep for staggered list entrances is not justified.
- Focus trap and Esc-close for the mobile drawer are implemented inline with `useEffect` + native DOM APIs — no `focus-trap-react`.
- Icons used today in the UI (`◒`, inline `<svg>` for the search glyph, `⌖`, `✓`, `▾`, `⚠`) are kept as glyphs/inline SVG. No icon library is added.

Rejected alternatives, briefly:

- **framer-motion / `motion`**: rejected (bundle cost; existing keyframes cover all required animations).
- **Headless UI / Radix**: rejected (adds a dep purely for a drawer; `useEffect` focus trap + `aria-*` attributes satisfy accessibility requirements with ~40 lines of code).
- **CSS `:has()` for segmented-control slider**: feasible but Safari 15 lacks support; we use a sibling `<span>` whose `translate-x` is computed from the active index — deterministic, no measurement, and SSR-safe.
- **Manual dark-mode toggle**: rejected (scope creep; the Header spec only calls for dark surface classes that read correctly in OS dark mode).

## Design tokens and global CSS additions

Edit: `src/app/globals.css`.

The existing `:root` variables, animation keyframes, utility classes (`animate-*`, `glass-panel`, `hero-gradient`, `map-loading-backdrop`), and staggered `delay-*` classes **are preserved verbatim**. The following are added at the top of the file, after `@import "tailwindcss";` and before the existing `:root` block.

### 1. Tailwind v4 `@theme` block

```css
@theme {
  /* Surfaces */
  --color-surface: #f3f5ec;              /* mirrors --background */
  --color-surface-raised: #ffffff;
  --color-surface-glass: rgba(255, 255, 252, 0.78);
  --color-surface-glass-dark: rgba(18, 62, 42, 0.78);
  --color-line: #dfe5d7;
  --color-line-strong: #c5d1b7;

  /* Brand */
  --color-ink: #18251c;                  /* mirrors --foreground */
  --color-ink-muted: #68746b;            /* mirrors --muted */
  --color-brand: #1f6b45;                /* mirrors --green */
  --color-brand-dark: #123e2a;           /* mirrors --green-dark */
  --color-brand-lime: #bde77e;           /* mirrors --lime */

  /* Priority accents (critical / moderate / lower). Chrome use only.
     The authoritative band fill still comes from priorityBand() in src/lib/scoring.ts. */
  --color-accent-red: #c62f2f;
  --color-accent-amber: #f2a93b;
  --color-accent-green: #7fb87f;         /* light green for "lower priority" chrome */

  /* Status (OSM pill) */
  --color-status-ready: #22c55e;
  --color-status-streaming: #f59e0b;
  --color-status-error: #ef4444;

  /* Editorial type scale */
  --font-display: var(--font-geist-sans), "Inter", system-ui, sans-serif;
  --tracking-display: -0.045em;
  --tracking-eyebrow: 0.14em;

  /* Elevations */
  --shadow-glass-sm: 0 10px 30px rgba(39, 65, 43, 0.05);
  --shadow-glass-md: 0 12px 36px rgba(39, 65, 43, 0.08);
  --shadow-glass-lg: 0 20px 60px rgba(39, 65, 43, 0.12);
  --shadow-glass-xl: 0 24px 70px rgba(18, 62, 42, 0.18);
}
```

The dual-naming (CSS variable **and** mirrored legacy variable in `:root`) is deliberate: existing components already use `var(--line)`, `var(--panel)`, `var(--green)`, `var(--green-dark)`, `var(--lime)`, `var(--muted)` — those are kept untouched so no component edit is forced to churn its color strings. New tokens (`--color-accent-red/amber/green`, `--color-status-*`, `--color-surface-glass*`) are what the redesign consumes. Any new Tailwind utility class like `bg-surface-glass`, `text-accent-red`, `ring-accent-green` resolves against the `@theme` block automatically under Tailwind v4.

### 2. New keyframes and utilities (appended to the existing keyframes block)

The existing file already defines `fade-in`, `slide-up`, `slide-down`, `shimmer`, `float`, `glow-pulse`, `gradient-shift`, `pop-in` plus matching `.animate-*` classes under `@media (prefers-reduced-motion: no-preference)` and no-op overrides under `@media (prefers-reduced-motion: reduce)`. We add two more (iteration-2 NIT #4: `slide-in-right` was dropped because the drawer uses a CSS transition, not an animation — see MobileNavDrawer):

```css
@keyframes pulse-dot {
  0%, 100% { transform: scale(1);   opacity: 1;   }
  50%      { transform: scale(1.35); opacity: 0.6; }
}

@keyframes marquee-sheen {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(120%);  }
}
```

Add the matching `.animate-pulse-dot` and `.animate-sheen` under the existing `@media (prefers-reduced-motion: no-preference)` block and append them to the no-op list under `@media (prefers-reduced-motion: reduce)`. **Every new `.animate-*` class is gated by the same media query pair that already protects the file.** No animation is applied outside that gate.

### 3. New utility classes

```css
.glass-nav {
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  background: var(--color-surface-glass);
  border-bottom: 1px solid var(--color-line);
}

@media (prefers-color-scheme: dark) {
  .glass-nav {
    background: var(--color-surface-glass-dark);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

.editorial-headline {
  font-family: var(--font-display);
  letter-spacing: var(--tracking-display);
  line-height: 1.02;
}

.eyebrow {
  font-size: 0.6875rem;         /* 11px */
  font-weight: 600;
  letter-spacing: var(--tracking-eyebrow);
  text-transform: uppercase;
  color: var(--muted);
}

/* Priority accent swatch, used as a 3-px left bar on PriorityPanel rows and
   as a hairline stroke on map polygon selection chrome. */
.accent-bar-critical  { background: var(--color-accent-red);   }
.accent-bar-moderate  { background: var(--color-accent-amber); }
.accent-bar-lower     { background: var(--color-accent-green); }
```

The existing `.glass-panel` and `.hero-gradient` classes are preserved and reused by new components.

**Focus rings (iteration-2 NIT #6)**: focus-visible styling is standardised on Tailwind utilities applied inline at each interactive element — `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]` for buttons / links / inputs; the SegmentedControl option buttons use the same classes against the segmented control's own padded background. A single `.focus-ring` utility was considered but rejected because the Tailwind form is already applied in every component sketch, so introducing a parallel class name invites drift between the two approaches. No `.focus-ring` CSS is added to globals.css.

## Component tree changes

Current tree:

```
RootLayout
└── <body>{children}</body>

/       : children = <AreaPicker />              (page.tsx is a thin wrapper)
/explore: children = <Dashboard area label />    (explore/page.tsx reads URL params)
```

Redesigned tree:

```
RootLayout (src/app/layout.tsx)
└── <body>
    ├── <OsmStatusProvider>                     NEW context, src/components/OsmStatusContext.tsx
    │   ├── <Header />                          NEW, src/components/Header.tsx (sticky, glass-nav)
    │   ├── <main id="main">{children}</main>
    │   └── <Footer />                          NEW, src/components/Footer.tsx
    └── (MobileNavDrawer is portaled inside <Header />)

/        children:
└── <AreaPicker />  (restyled; its old inline <header> is removed, now owned by Header; root `<main>` → `<div>`)
    ├── Hero section (editorial headline + hero-gradient background + floating stat pills)   INLINE JSX
    ├── 3-step journey <ol>                     INLINE JSX (not a new component — NIT #11)
    ├── Controls panel:
    │   ├── <SearchField />                     INLINE (JSX refactor; no new file)
    │   ├── Preset tile grid                    INLINE
    │   ├── <SegmentedControl />                NEW, src/components/SegmentedControl.tsx
    │   └── Action CTA card                     INLINE
    └── Map shell wrapping <AreaPickerMap />    (round frame + floating pill overlay)

/explore children:
└── <Dashboard /> (restyled; old inline <header> removed; publishes stream status into
                   OsmStatusContext; holds hoveredCellId; root `<main>` → `<div>`)
    │  Dashboard decides via useSyncExternalStore(matchMedia('(min-width:768px)'))
    │  which of these two layouts to render — never both:
    │
    ├── Desktop layout (isDesktop === true):
    │   ├── <MetricCards /> row                 INLINE JSX (shimmer skeletons when loading)
    │   ├── Map card (inline <section>):
    │   │   ├── <LayerDock mode="floating" />   INLINE sub-component in Dashboard.tsx
    │   │   └── <MapShell /> → <MapView />      (receives hoveredCellId; refreshed overlays)
    │   └── <aside md:sticky md:top-20>
    │       ├── <ExploreGuide />
    │       ├── <ZoneDetails />
    │       ├── <ImpactComparison /> (when scenario !== null)
    │       └── <PriorityPanel onHoverCell={setHoveredCellId} />
    │
    └── Mobile layout (isDesktop === false):
        └── <MobileExploreTabs>                 NEW, src/components/MobileExploreTabs.tsx
              (owns tab state Map/Priority/Inspector; the active tab is the only
               branch that renders its slot, so there is still only one <MapView />
               in the document at any moment)
```

New files (all under `src/components/`):

| File | Purpose |
| --- | --- |
| `Header.tsx` | Sticky glass nav: brand, desktop links, OSM status pill, quick action, mobile hamburger. |
| `Footer.tsx` | Brand/purpose, OSM/Nominatim attribution, scientific disclaimer, tech-stack/open-source links. |
| `MobileNavDrawer.tsx` | Slide-in right sheet (`translate-x-full → translate-x-0`), focus trap, Esc close, backdrop opacity fade. |
| `StatusPill.tsx` | Subscribes to `OsmStatusContext`; renders a pulsing dot + label (ready / streaming / error). |
| `SegmentedControl.tsx` | Generic pill-shaped 2–4-option control with sliding active pill. Used by AreaPicker size selector and `MobileExploreTabs`. |
| `MobileExploreTabs.tsx` | `role="tablist"` sticky-bottom switcher between Map / Priority / Inspector slots. |
| `OsmStatusContext.tsx` | Tiny React Context: `{ status: "idle" \| "streaming" \| "ready" \| "error"; set(status) }`. |

### Client-boundary spec (findings #4, #5)

`src/app/layout.tsx` is a server component (no `"use client"` directive) and must remain one — Next.js only allows `generateMetadata` and route-level async in server layouts. React Context Providers, however, must be client components. The design uses a dedicated `"use client"` module to bridge the two:

```tsx
// src/components/OsmStatusContext.tsx
"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type OsmStatus = "idle" | "streaming" | "ready" | "error";

interface OsmStatusContextValue {
  status: OsmStatus;
  set: (status: OsmStatus) => void;
}

const DEFAULT: OsmStatusContextValue = { status: "idle", set: () => {} };
const Ctx = createContext<OsmStatusContextValue>(DEFAULT);

export function OsmStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<OsmStatus>("idle");
  // Finding #5: memoise so the value object identity is stable across renders
  // where `status` has not changed. `setStatus` from useState is already stable,
  // so the dep list is correct: identity changes exactly when `status` changes.
  const value = useMemo<OsmStatusContextValue>(() => ({ status, set: setStatus }), [status]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOsmStatus() {
  return useContext(Ctx);
}
```

Why memoise: consumers destructure `{ set }` and use it in effect dep arrays (see Dashboard point 2). Without `useMemo`, the Provider would hand consumers a fresh object every render, their effects would see a "new" dependency every render, and the Dashboard status-publishing effect would churn (write back → re-render → write back …). With `useMemo` the value only changes when `status` changes, and `setStatus` is referentially stable by React's own guarantees — so depending on `osm.set` is correct and stable.

**Default value**: `set: () => {}` is a no-op so a component using `useOsmStatus()` outside of a Provider (e.g., in isolation during tests) does not throw.

Client boundary layout:

- `src/components/OsmStatusContext.tsx` — `"use client"` (declared above).
- `src/components/Header.tsx` — `"use client"` (uses `useState` for drawer open/closed, `usePathname` for active-link marking, mounts `MobileNavDrawer`).
- `src/components/StatusPill.tsx` — `"use client"` (calls `useOsmStatus()`).
- `src/components/MobileNavDrawer.tsx` — `"use client"` (uses `useState`, `useEffect`, `createPortal`).
- `src/components/Footer.tsx` — **server component**. It renders static markup (brand text, attribution, open-source links, badges) and has no interactivity. It does not need the status context, so it is placed *outside* the Provider's children chain for interactivity, but structurally it still sits inside `<OsmStatusProvider>` because the Provider wraps all three (Header, main, Footer) in `layout.tsx` for simplicity. Nesting a server component inside a client Provider is allowed by React 19 / Next.js 16: the server component is serialised and streamed through the client Provider as children — no `"use client"` boundary is forced on `Footer.tsx`.

`src/app/layout.tsx` (edited):

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OsmStatusProvider } from "@/components/OsmStatusContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { /* unchanged */ };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <OsmStatusProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </OsmStatusProvider>
      </body>
    </html>
  );
}
```

The layout itself has no `"use client"` directive; the client surface is confined to `OsmStatusProvider`, `Header`, and (transitively through `children`) `AreaPicker` / `Dashboard`, each of which already carries its own `"use client"` directive today. The `<main id="main">` element is the one and only `<main>` in the document — both `AreaPicker` and `Dashboard` root to `<div>` after this change (findings #3).

## Header anatomy (`src/components/Header.tsx`)

Sticky glass navigation that replaces the inline `<header>` currently rendered inside `AreaPicker.tsx` and `Dashboard.tsx`.

```
<header class="sticky top-0 z-50 glass-nav">
  <div class="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
    [Brand mark]                       [Desktop nav]                 [Right cluster]
    <Link href="/">                    <nav class="hidden md:flex">   <StatusPill />
      <span [brand classes below]>       Overview                     {pathname === "/explore"
        ◒                                Presets                        ? <Link href="/">Change area</Link>
      </span>                            Methodology                    : <Link href="/#presets">Jump to presets</Link>}
      <div>                              Live Analysis                 <button md:hidden
        GreenGap                       </nav>                            aria-label="Open navigation"
        <span class="eyebrow">                                           aria-expanded={open}
          Urban greening priority                                        aria-controls="mobile-nav"
        </span>                                                          onClick={() => setOpen(true)}>
      </div>                                                           <HamburgerIcon />
    </Link>                                                          </button>
  </div>
  <MobileNavDrawer open={open} onClose={() => setOpen(false)} />
</header>
```

Iteration-2 NIT #5: the sketch does not tag the brand glyph with a `.brand-badge` class name; the actual Tailwind classes are the sole spec and are listed in the Behaviours bullet below. No `.brand-badge` utility is added to globals.css.

Behaviours:

- **Brand badge**: `grid place-items-center h-10 w-10 rounded-2xl bg-[var(--green-dark)] text-[var(--lime)]` with `motion-safe:transition-transform motion-safe:hover:rotate-6 motion-safe:animate-glow-pulse`. The badge is a `<Link href="/">` — functionally identical to the current "GreenGap home" link in Dashboard, so no logic is lost.
- **Nav links**: `Overview`, `Presets`, `Methodology` all point to `/#overview`, `/#presets`, `/#methodology` (section anchors added to `AreaPicker.tsx`). `Live Analysis` points to `/explore`. The active link is highlighted with an `aria-current="page"` style (`after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:bg-[var(--green)]`). Route detection uses `usePathname()`. From `/explore`, clicking Overview/Presets/Methodology navigates to home and scrolls — this is standard browser behaviour for `#` anchors across routes with Next.js.
- **StatusPill**: see "Status pill" below.
- **Right-side quick action (finding #6)**: `usePathname()`-driven. On `/explore` it is `<Link href="/">Change area</Link>` (matches the behaviour of the current Dashboard inline header, so no feature regression). On `/`, previous drafts proposed `Open live analysis →` with no params, but `/explore` would then `redirect("/")` and bounce the user back — a visible UX regression. Instead, on `/` the right-cluster CTA is `<Link href="#presets">Jump to presets</Link>`, which smooth-scrolls to the preset tile grid where the user actually makes the next choice. This is a real, useful shortcut, costs nothing, and does not require a cross-route area store. Implementation: `const pathname = usePathname(); const action = pathname === "/explore" ? { href: "/", label: "Change area" } : { href: "#presets", label: "Jump to presets" };`.
- **Mobile hamburger**: 44×44 px touch target, `aria-controls="mobile-nav"`, `aria-expanded={open}`, `aria-label="Open navigation"` (NIT #12 — this exact string is used in the JSX sketch above and in every other section that mentions it). Opens `MobileNavDrawer`.

Status pill (`src/components/StatusPill.tsx`):

```
status === "ready"    → green dot (motion-safe:animate-pulse-dot), label "Live OpenStreetMap data"
status === "streaming"→ amber dot (motion-safe:animate-pulse-dot), label "Streaming OSM…"
status === "error"    → red   dot (static),                        label "Data unavailable"
status === "idle"     → green dot (static),                        label "Live OpenStreetMap"
```

Dot colors use `--color-status-ready / streaming / error`. The pill is `rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5 text-xs font-medium`. The pill wrapper carries `role="status" aria-live="polite"` so screen readers announce transitions; the visible dot is `aria-hidden="true"` and the text label is the announced string (iteration-2 NIT #8: no inner sr-only live region is nested inside — a single live region prevents double announcements on screen readers that treat `role="status"` as an implicit `aria-live="polite"` container).

Mobile drawer (`src/components/MobileNavDrawer.tsx`):

- Full-height right-aligned sheet, `fixed inset-y-0 right-0 z-[70] w-[86vw] max-w-sm`, `translate-x-full → translate-x-0` with `transition-transform duration-300 ease-out` (CSS, respects `motion-reduce` via `motion-reduce:transition-none`).
- Backdrop: `fixed inset-0 z-[60] bg-black/40` with `opacity-0 → opacity-100` fade.
- **Stacking rationale (iteration-3 MEDIUM #1)**: the backdrop at `z-[60]` and the sheet at `z-[70]` sit strictly above both the sticky Header (`z-50`) and the mobile tab bar (`z-40`). The drawer is portaled to `document.body`, so without explicit `z-*` the browser would stack it in document order — behind both the Header and the bottom tab bar. Pinning `z-[60]` / `z-[70]` keeps the drawer visually and interactively dominant when open.
- **SSR mount gate (finding #7)**: `createPortal(..., document.body)` must not be called during server render because `document` is undefined. The component uses a mount guard:

  ```tsx
  "use client";
  import { useEffect, useState } from "react";
  import { createPortal } from "react-dom";

  export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null; // SSR + first client paint: nothing to render yet
    if (!open)    return null; // closed state: no DOM nodes to focus-trap over
    return createPortal(<DrawerBody onClose={onClose} />, document.body);
  }
  ```

  This also keeps the drawer out of the DOM entirely when closed, which simplifies the focus-trap effect and body-scroll-lock cleanup (they only run while open).

- **Focus trap**: on open, snapshot `document.activeElement`, focus the drawer's first focusable child; on close, restore focus. A `keydown` listener handles `Tab` / `Shift+Tab` by cycling through `querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')` within the drawer, and `Escape` triggers `onClose`.
- Body scroll lock: `document.body.style.overflow = "hidden"` while open; restored on unmount via effect cleanup.
- Contains, in source order (iteration-2 MEDIUM #2):
  1. `<h2 id="mobile-nav-title" className="sr-only">GreenGap navigation</h2>` — the accessible name that `aria-labelledby` resolves to. The drawer root is `<aside role="dialog" aria-modal="true" aria-labelledby="mobile-nav-title">`.
  2. Brand (`◒` + "GreenGap" wordmark), visible, mirrors the Header brand.
  3. Nav links: Overview / Presets / Methodology / Live Analysis (large, 48 px rows, 44+ px touch targets).
  4. `<StatusPill />`.
  5. Secondary CTA that mirrors the Header's right-cluster action (`Change area` on `/explore`, `Jump to presets` on `/`).
  6. A `Close navigation` icon-only button in the top-right corner (`aria-label="Close navigation"`, 44×44 target).
- The hamburger trigger's `aria-label` is `"Open navigation"` (NIT #12 — consistent with the Header JSX sketch and the Accessibility section).

## SegmentedControl.tsx geometry (NIT #10)

```ts
interface SegmentedControlProps<T extends string | number> {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  renderOption: (value: T) => React.ReactNode;   // required
  ariaLabel: string;                             // required (wrapper role="group" aria-label)
  className?: string;
}
```

Rendering model:

- Root: `<div role="group" aria-label={ariaLabel} className="relative inline-grid auto-cols-fr grid-flow-col rounded-full border border-[var(--line)] bg-white/70 p-1 shadow-[var(--shadow-glass-sm)]">`.
- Sliding pill: a sibling `<span aria-hidden="true" />` positioned absolutely inside the root. Iteration-2 NIT #9: because the root carries `p-1` (0.25 rem) padding, the absolute pill's reference box (the containing block's padding box) is wider than the grid cells' content box by `2 × 0.25rem = 0.5rem`. A naive `width: ${100 / N}%` + `translateX(${activeIndex * 100}%)` therefore under-shoots the first option and overshoots the last by up to 4 px per side on narrow mobile viewports. The pill is pinned to the padding and computes against the inner width:
  - `inset-1` (sets `top: 0.25rem; right: 0.25rem; bottom: 0.25rem; left: 0.25rem` so the pill's reference frame matches the grid-cell content box after padding is removed).
  - Inline style: `width: calc((100% - 0.5rem) / ${options.length})` — `100%` is the padding box; subtracting `0.5rem` removes the horizontal padding; dividing by `N` gives one grid-cell's content-box width exactly.
  - Inline style: `transform: translateX(calc(${activeIndex} * ((100% - 0.5rem) / ${options.length})))` — translate is specified in the pill's own frame as a `calc` using the same cell width, so the pill lands exactly over cell `activeIndex`. Note: `translateX(…%)` on an element whose width is itself a `calc` is reliable in modern browsers (the percentage resolves against the element's own used width), but spelling the translate as a `calc` of the same cell width expression is the belt-and-braces form and matches the SSR-safe no-measurement requirement.
  - Classes: `absolute rounded-full bg-[var(--green-dark)] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none` (the `top-/right-/bottom-/left-1` are replaced by `inset-1`).
- Each option button: `<button type="button" role="radio" aria-checked={value === opt} data-active={value === opt} onClick={() => onChange(opt)} className="relative z-[1] min-h-11 px-3 py-2 text-sm font-semibold aria-checked:text-white data-[active=true]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2">`. The `relative z-[1]` lifts the labels above the sliding pill so the text is readable against the pill colour; active label text colour is driven by `aria-checked:text-white` with `data-[active=true]:text-white` as a belt-and-braces fallback should the project's Tailwind v4 config not emit `aria-checked:*` for any reason (both selectors target the same element, so neither double-paints).
- `activeIndex = options.indexOf(value)`; if the value is not in `options`, `activeIndex = 0` and the pill parks under the first option. The `onChange` is a pure prop callback — no internal state.
- Keyboard: `ArrowLeft` / `ArrowRight` on a focused option cycles `value` through `options`; `Home` / `End` jump to first / last. This matches WAI-ARIA radiogroup semantics.

Mobile targets: `min-h-11` plus `px-3` gives ≥44 px vertical touch targets. On ≥3-option configurations the control stays single-row because `inline-grid auto-cols-fr` lets each column shrink evenly.

This component is used in two places:

1. `AreaPicker.tsx` size selector: `options={AREA_SIZE_OPTIONS}` (`[1, 2, 3] as const` from `src/lib/area.ts`, which is off-limits), `renderOption={(v) => \`${v} × ${v} km\`}`, `ariaLabel="Study area size"`.
2. `PriorityPanel.tsx` filter toolbar: `options={["all", "critical", "moderate"] as const}`, `renderOption` returns a short label, `ariaLabel="Filter priority rows"`. The sort toggle (`By score` / `By rank`) uses the same component with `options={["rank", "score"] as const}`.

The mobile tab bar (`MobileExploreTabs`) does **not** reuse `<SegmentedControl>` because it needs `role="tablist"`, badges, and icons — the segmented control is a radiogroup, not a tablist, and overloading one component to express both roles would hurt both.

## Footer anatomy (`src/components/Footer.tsx`)

Four-column grid on desktop (`sm:grid-cols-2 lg:grid-cols-4`), stacks to one column on mobile. The entire footer is `role="contentinfo"`.

```
──────────────────────────────────────────────────────────────────────────
GreenGap           Data & attribution      Scientific notice     Open source
──────────────────────────────────────────────────────────────────────────
Brand badge        OpenStreetMap           Scores reflect        GitHub repo
Mission statement  contributors (ODbL)     mapped features       Next.js 16
Methodology link   Nominatim geocoding     to guide site         React 19
                   Overpass API            investigation, not    Tailwind v4
                                           civil engineering     Leaflet
                                           approval.             Turf.js
──────────────────────────────────────────────────────────────────────────
© GreenGap · built on open data           Terms  Privacy  Methodology
```

- "Methodology" and the three `/` anchors are plain `<Link href="/#methodology">` etc.
- Open-source links: external anchors with `rel="noopener noreferrer" target="_blank"`.
- Tech-stack items render as small `rounded-full border border-[var(--line)] bg-white/60 px-2.5 py-1 text-[11px]` badges; they are text-only (no logos) to avoid new dependencies.
- Background: a soft `bg-[var(--green-dark)] text-white/80` block on the bottom row, with a lighter card body above it. Uses existing CSS tokens.

## Landing page redesign (`/`)

### Edit: `src/app/page.tsx`

Unchanged (`<AreaPicker />` wrapper is correct — the layout now provides Header/Footer).

### Edit: `src/components/AreaPicker.tsx`

Logic preserved verbatim:

- `useRouter`, `useState<AreaSelection>(DEFAULT_AREA)`, `useState<string>` for `label`, `recenterKey`, `query`, `starting`, and the `search` object (with `term`, `hits`, `failed`).
- The 450 ms debounced `useEffect` that calls `/api/geocode?q=…` with `AbortController`, computed `searchState`, `jumpTo`, `pickCenter`, `start` → `router.push('/explore?...')` with `areaToParams(area)` and `label`.
- `cellsFor(area.sizeKm)` and `cells` memo.
- `isValidArea` guard before `router.push`.

Visual changes:

1. **Convert root `<main>` to `<div>` (finding #3)**: AreaPicker currently renders `<main className="mx-auto …">` as its root. The new global layout owns the single `<main id="main">` landmark, so the AreaPicker root changes to `<div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1400px] …">` (the `min-h-screen` is relaxed to subtract the Header's 4rem height). The landing page now has exactly one `<main>`, satisfying Lighthouse / axe. The inline `<header class="mb-8 flex ...">` block inside this root is also deleted — the global Header owns brand + status pill; the "Urban greening priority explorer" eyebrow moves into the Header.
2. **Hero section** wraps the H1 in a new container:
   ```tsx
   <section id="overview" className="relative isolate overflow-hidden rounded-[32px] hero-gradient px-6 py-14 sm:px-10 sm:py-20 lg:py-24">
     <p className="eyebrow motion-safe:animate-fade-in">For urban climate resilience</p>
     <h1 className="editorial-headline mt-3 text-4xl text-[var(--green-dark)] sm:text-6xl lg:text-7xl motion-safe:animate-slide-up">
       See where a neighbourhood <span className="text-[var(--green)]">needs greenery most.</span>
     </h1>
     {/* Iteration-2 NIT #3: body copy preserved verbatim from today's AreaPicker hero paragraph. */}
     <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] motion-safe:animate-slide-up delay-100">
       Cities have limited greening budgets. GreenGap scores every 200 m block by green-space scarcity, building
       density and nearby schools and hospitals, then lets you test where a new green space would help.
     </p>
     <div className="mt-8 flex flex-wrap gap-3 motion-safe:animate-slide-up delay-200">
       <FloatingStatPill label="200 m" sub="Spatial grid" />
       <FloatingStatPill label="OSM live" sub="Overpass + Nominatim" />
       <FloatingStatPill label="Explainable" sub="50 / 30 / 20 scoring" />
     </div>
   </section>
   ```
   `FloatingStatPill` is a tiny `function` local to the file: `rounded-full border border-white/70 bg-white/70 backdrop-blur px-4 py-2 shadow-[var(--shadow-glass-sm)] motion-safe:animate-float`. The float animation is already defined in globals.css; staggered via `delay-*` utility classes already present.
3. **3-step journey**: existing `<ol className="mb-8 grid gap-3 sm:grid-cols-3">` is replaced inline (no new component — finding #11) by an `<ol>` whose children are cards with:
   - `rounded-3xl border border-white/80 bg-[var(--panel)] p-5 shadow-[var(--shadow-glass-sm)] motion-safe:transition-all motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--shadow-glass-lg)] motion-safe:animate-slide-up`
   - staggered `delay-100 / 200 / 300`,
   - a numbered badge with `motion-safe:animate-glow-pulse` on the active step,
   - A connecting line between cards on `sm:` via a pseudo-element: `before:absolute before:top-1/2 before:-left-1.5 before:h-px before:w-3 before:bg-[var(--line)]` on steps 2 and 3. The step copy is unchanged.
4. **Search field** (`#place-search`): keep the input, keep the debounce, keep the dropdown. Add:
   - Floating label animation using existing `peer` Tailwind trick (`peer-placeholder-shown:...`),
   - Clear button (`×`) when `query.length > 0`, `aria-label="Clear search"`,
   - Spinner inside the input while `searchState === "searching"` (reused `motion-safe:animate-spin` border trick already present elsewhere),
   - Dropdown `<ul>` gets `motion-safe:animate-slide-down` and `max-h-56 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-1 shadow-[var(--shadow-glass-md)]`,
   - Keyboard navigation: `ArrowDown` / `ArrowUp` move focus between hit rows; `Enter` on a hit calls `jumpTo(...)` (same handler already there). A new `useRef<HTMLUListElement>` + `onKeyDown` on the input and the `<li>` buttons manage focus; no state change, pure DOM focus.
5. **Preset tiles**: replace the two-column `grid grid-cols-2 gap-2` with the same grid but each tile becomes a glass card with hover elevation and an active indicator ring: `data-active:ring-2 data-active:ring-[var(--green)] data-active:ring-offset-2`. Micro-badges show the preset's `detail` text, already present.
6. **Study area size selector**: replaced by `<SegmentedControl value={area.sizeKm} options={AREA_SIZE_OPTIONS} onChange={(v) => setArea(prev => ({...prev, sizeKm: v}))} ariaLabel="Study area size" renderOption={(v) => `${v} × ${v} km`} />`. See the "SegmentedControl.tsx" spec below for the pill geometry formula.
7. **Action CTA card**: wrapped in `rounded-3xl bg-[var(--green-dark)] p-5 text-white motion-safe:animate-glow-pulse`. The button keeps its existing `onClick={start}`, `disabled={starting}`, and spinner behaviour. On hover, the arrow `→` shifts right 2 px (`motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5`).
8. **Map section**: the surrounding `<section>` becomes `rounded-[32px] border border-white/80 bg-white shadow-[var(--shadow-glass-lg)]` and the inner `<AreaPickerMap>` is wrapped so the floating instruction pill ("⌖ Click anywhere to centre the square here") gets a `glass-panel` finish and the `motion-safe:animate-fade-in` entrance.
9. Add section anchor IDs: `id="overview"` on the hero, `id="presets"` on the controls panel, `id="methodology"` on a short new methodology card inserted above the footer (two-paragraph explainer: scoring weights 50/30/20 and the 150 m scenario — descriptive text only, no logic). These anchors back the Header nav links.

### Edit: `src/components/AreaPickerMap.tsx`

- Props and handlers unchanged (`area`, `onPickCenter`, `recenterKey`), Leaflet config unchanged (`MapContainer bounds zoomControl={false} className="z-0 cursor-crosshair"`, `TileLayer`, `Rectangle`, `ClickToPick`, `FitSelection`, `ZoomControl position="bottomright"`).
- Outer `<div>` height classes bumped to `rounded-[inherit] overflow-hidden` so the parent's `rounded-[32px]` frame clips the tiles cleanly.
- The floating instruction pill currently lives in the parent (`AreaPicker.tsx`); we leave it in the parent so parent-only overlays keep working. We only add a subtle inner frame shadow via `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.6)` on a sibling overlay div with `pointer-events-none` and `z-[400]`.

## Explore dashboard redesign (`/explore`)

### Edit: `src/app/explore/page.tsx`

Unchanged. Still reads `searchParams`, calls `areaFromParams`, `redirect("/")` on missing area, resolves `label` from params or `formatCenter(area.center)`, renders `<Dashboard area label />`.

### Edit: `src/components/Dashboard.tsx`

Logic — the entire NDJSON stream reader, `requestKey` state tagging, `applyStreamEvent`, `useDeferredValue` for `scoredFeatures`, `simulateIntervention` invocation, `rankCells`, `splitFeatures`, timers, `retry` / `clearProposal` / `toggleProposal` / `selectCell` callbacks, `metrics` derivation, `layersOn` state — is **preserved verbatim**.

Visual + structural changes:

1. **Delete the inline `<header className="mb-5 flex flex-col gap-4 rounded-[28px] ...">` block.** The sticky Header now provides brand, label, status, and the "Change area" action. The in-page title (`{label}` + size + center) moves into a new, compact "page summary" row at the top of `<main>`:
   ```tsx
   <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
     <div>
       <p className="eyebrow text-[var(--green)]">Greening priorities</p>
       <h1 className="editorial-headline text-2xl text-[var(--green-dark)] sm:text-3xl">{label}</h1>
       <p className="mt-0.5 text-sm text-[var(--muted)]">{area.sizeKm} × {area.sizeKm} km · {formatCenter(area.center)}</p>
     </div>
     {/* intentionally no CTA here — Header owns the Change area action */}
   </div>
   ```
2. **Publish stream status (findings #5, #14)**: destructure the setter from the context so the effect's dependency list contains only stable values (`setStatus` from `useState` is referentially stable; the memoised `set` returned by the Provider — see the OsmStatusContext spec below — is also stable).

   ```tsx
   const { set: setOsmStatus } = useOsmStatus();

   useEffect(() => {
     if (load.status === "error")                   setOsmStatus("error");
     else if (load.status === "loading" || scoring) setOsmStatus("streaming");
     else                                           setOsmStatus("ready");
   }, [load.status, scoring, setOsmStatus]);

   // Reset to idle on unmount so navigating back to "/" does not leave the
   // Header pill reading "Live OpenStreetMap data" while nothing is streaming.
   useEffect(() => {
     return () => setOsmStatus("idle");
   }, [setOsmStatus]);
   ```

   Because `setOsmStatus` is stable (see "OsmStatusContext.tsx" spec below), the first effect fires only when `load.status` or `scoring` actually change — no churn, no infinite loop. The Header's StatusPill reads this and the dot colour matches. The unmount cleanup fixes finding #14: without it, after `/explore` finishes and the user navigates to `/`, the pill would still read `ready`.
3. **Metric cards** (`metrics.map`): each card gets:
   - `rounded-3xl bg-[var(--color-surface-glass)] backdrop-blur border border-[var(--line)] shadow-[var(--shadow-glass-md)]`,
   - A left vertical gradient accent `before:absolute before:inset-y-4 before:left-0 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-[var(--green)] before:to-[var(--lime)]`,
   - A small SVG icon (inline, 20 px) per card: trees for "Mapped green spaces", grid for "Analysis grid", pin for "Facilities". All inline SVGs — no icon library.
   - Loading state (iteration-1 NIT #9 + iteration-2 HIGH #1): the existing `<Skeleton>` currently renders `block rounded-lg bg-[#e3eadf] motion-safe:animate-pulse ${className}`. The `.animate-shimmer` utility in `globals.css` is defined **entirely inside** `@media (prefers-reduced-motion: no-preference)` — the `background: linear-gradient(…)` and `background-size: 200% 100%` declarations live inside that gate, and the reduced-motion block only sets `animation: none !important`. Under a reduced-motion preference the utility therefore paints no background at all, so dropping `bg-[#e3eadf]` from the Skeleton would make it transparent for reduced-motion users. The design keeps the base fill as a Tailwind arbitrary utility and lets the keyframe-driven gradient override it only while the animation gate is active. Resulting Skeleton class: `block rounded-lg bg-[#e3eadf] animate-shimmer ${className}`. Under `no-preference`, the `.animate-shimmer` rule applies and its `background: linear-gradient(...)` overrides the Tailwind `background-color: #e3eadf` on the paint path, giving the animated shimmer. Under `reduce`, the `.animate-shimmer` rule's background declarations are not applied (they live inside the `no-preference` media query), so only the Tailwind `background-color: #e3eadf` paints — a solid, visible `#e3eadf` fill identical to today's loading block. No `motion-safe:` prefix is needed on the class name because the shimmer utility is already gated by its own media-query sibling inside `globals.css`. No globals.css diff is needed for this fix; the Skeleton `className` carries both utilities and the browser's cascade resolves the branches correctly.
   - Entrance: `motion-safe:animate-slide-up delay-100 / 200 / 300 / 400` staggered.
4. **Top-priority card**: same button, same `onClick={() => selectCell(top.id)}`, same `priorityBand(top.priority).color` fill on the score chip. Add `motion-safe:transition-all motion-safe:hover:-translate-y-0.5` and `motion-safe:animate-pop-in` on the score chip when `top` first becomes available (keyed on `top?.id`).
5. **Layer dock**: the chip-row toggles currently sit inside the map card header. Keep the data (`LAYER_TOGGLES`, `layersOn`, `setLayersOn`) exactly as-is. Change the chrome:
   - On `md+`: render as a floating glass dock positioned over the top-right of the map (`absolute top-4 right-4 z-[500]`), with each row being a toggle switch: `role="switch" aria-checked={on}` with a 36×20 track and sliding knob. Swatch + label on the left, switch on the right. 2 px border on `data-off` rows uses `border-dashed border-[var(--line)]`.
   - On `<md`: render it as a horizontal scrollable chip strip above the map, essentially the current layout but with chip-sized touch targets (`min-h-11`) so each chip is thumb-friendly.
   - Both forms are produced by the same `<LayerDock mode="floating"|"strip" />` sub-component colocated in `Dashboard.tsx` (not a new file — it's a 30-line internal component). The `disabled={!ready}` behaviour and `aria-pressed` are preserved.
6. **Map card frame**: outer `<section>` becomes `rounded-[32px] border border-white/80 bg-white shadow-[var(--shadow-glass-lg)]`. The inner map viewport inherits the radius.
7. **Error block**: keeps copy, but the panel becomes `glass-panel` over a radial red tint `bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.08),transparent_60%)]`. "Try again" and "Pick another area" buttons unchanged.
8. **Side column** on desktop (`md+`): kept as `<aside>` with `md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto` so the right column scrolls independently while the map stays visible. On `<md` the entire layout is replaced by `<MobileExploreTabs>` (single-tree branch, see "Mobile responsive strategy"); `<aside>` is **not** rendered on `<md`, which is what guarantees a single Leaflet mount.
9. **Footer under dashboard**: the current inline `<footer className="mt-3 ...">` prose stays, but **drops the "© OpenStreetMap contributors" ODbL phrase** because the new global `<Footer />` (DESIGN.md § 3.F) owns the attribution block. The inline footer now shows only data-source metadata (`load.data.metadata.source` + fetched timestamp) and the `ranking.notes` list, inside a thin `glass-panel` card. Finding #16: duplicate ODbL text is deliberately removed; two `<footer>` elements per page are still fine (one is contextual, the other is page-chrome).
10. **Lift `hoveredCellId` into Dashboard (finding #2)**: a new `useState<string | null>(null)` is added at Dashboard scope, right next to the existing `selection` state. The setter is passed to `PriorityPanel` as `onHoverCell`; the value is passed to the `MapView` component (via `MapShell`'s pass-through props) as `hoveredCellId`. The state is **not** tagged with `requestKey` because an area change already resets the ranked cell list, so a stale hovered ID points to nothing and the `cells.find` in MapView returns `undefined` → no polygon is rendered — correct by construction. No effect is needed; the state only lives for the duration of a mouse-over.
11. **Convert root `<main>` to `<div>` (finding #3)**: Dashboard currently renders `<main className="mx-auto …">` as its root. Because the new global layout wraps `{children}` in `<main id="main">`, the Dashboard root changes to `<div className="mx-auto …">`. All other classes, children, and semantics are preserved. The dashboard remains an exactly-one-`<main>` document.

### Edit: `src/components/MapView.tsx`

Logic (handlers, Leaflet config, `PanToSelection`, polygon rendering, click→select, tooltips, scenario rendering, facility markers, zoom control) is **unchanged**. The polygon fill still comes from `priorityBand(cell.priority).color` which is owned by `scoring.ts`.

Iteration-2 NIT #7: the React import list expands to `useDeferredValue, useEffect, useMemo, useState` (today the file imports only `useEffect, useState`). The two new hooks are consumed by the hovered-cell outline block in point 4 below.

Prop surface additions (new `hoveredCellId`; `LayerVisibility` and other props untouched):

```ts
export interface MapViewProps {
  // …existing fields unchanged…
  /** Cell ID currently hovered in the PriorityPanel. Non-interactive map chrome only. */
  hoveredCellId?: string | null;
}
```

The redesign only touches three overlays and adds one extra outline polygon:

1. **Hint pill** (currently `absolute left-4 top-4 ... bg-white/92 ... backdrop-blur`): gains `rounded-2xl shadow-[var(--shadow-glass-lg)] motion-safe:animate-fade-in`, keeps copy and `aria-live="polite"`.
2. **Legend dock** (bottom-left): same `useState(legendOpen)` toggle. The dock becomes `glass-panel rounded-2xl shadow-[var(--shadow-glass-md)]`. Each `<li>` row gets a hover highlight and a small `motion-safe:animate-fade-in delay-*` on initial reveal.
3. **Selected-cell outline**: keeps `color: "#123e2a", weight: 3.5, fill: false, interactive: false` exactly. We additionally emit a thin coloured ring using the priority accent **as a hex literal** (not a CSS variable) via a second `<Polygon>` with 1 px stroke. Finding #13: Leaflet writes stroke colours into SVG attributes and sometimes canvas `fillStyle`; `var(--color-accent-*)` is not reliably resolved on those fast paths. The mapping is a module-level constant inside `MapView.tsx`:

   ```ts
   const PRIORITY_CHROME_HEX = {
     critical: "#c62f2f",
     moderate: "#f2a93b",
     lower:    "#7fb87f",
   } as const;

   function groupedChrome(level: PriorityLevel): string | null {
     if (level === "very-high" || level === "high")     return PRIORITY_CHROME_HEX.critical;
     if (level === "moderate")                           return PRIORITY_CHROME_HEX.moderate;
     if (level === "low"       || level === "very-low") return PRIORITY_CHROME_HEX.lower;
     return null; // unscored → no chrome ring
   }
   ```

   The CSS `--color-accent-*` tokens remain the single source of truth for all HTML surfaces (PriorityPanel accent bars, filter chips, etc.); the hex constant in `MapView.tsx` is their SVG mirror. Both are declared with the same values and reviewed together as a two-line audit.

4. **Hovered-cell outline (new, finding #2)**: a single additional `<Polygon>` is rendered when `hoveredCellId` matches one of `cells`:

   ```tsx
   const deferredHovered = useDeferredValue(hoveredCellId ?? null);
   const hoveredCell = useMemo(
     () => (deferredHovered ? cells.find((c) => c.id === deferredHovered) ?? null : null),
     [deferredHovered, cells],
   );

   {hoveredCell && hoveredCell.id !== selectedCellId && (
     <Polygon
       positions={hoveredCell.geometry.coordinates[0].map((p) => toLatLng(p as [number, number]))}
       pathOptions={{
         color: groupedChrome(hoveredCell.priority) ?? "#123e2a",
         weight: 2,
         dashArray: "4 4",
         fill: false,
         interactive: false, // critical: pointer-events must not reach this layer
       }}
     />
   )}
   ```

   Design notes:
   - **One polygon, not N**: the number of mounted react-leaflet nodes stays constant across every hover event; only the hovered polygon's `positions` change. This mirrors the pattern already used for `selected` in `MapView.tsx` and avoids re-rendering the ~100 grid cells on every mouse move.
   - **`useDeferredValue`**: hover changes are low-priority; React can skip intermediate values if hovers fire faster than frames. The file already uses `useDeferredValue` for `scoredFeatures` on the Dashboard — reusing the same primitive here is consistent.
   - **`interactive: false`**: Leaflet must not route pointer events to this layer; the base grid polygons remain the click target.
   - **Skip when hovered === selected**: avoids visual noise (the selected polygon's dark outline already marks it).

### Edit: `src/components/MapShell.tsx`

The component is a thin dynamic-import wrapper: `MapShell(props) => <MapView {...props} />`. Its prop type is `MapViewProps`, so adding `hoveredCellId?: string | null` to `MapViewProps` automatically threads the prop through — no edit needed to `MapShell.tsx` beyond the visual change below.

Visual-only change: the `loading` fallback becomes:
```tsx
<div className="map-loading-backdrop grid h-[520px] place-items-center text-sm font-medium text-[var(--muted)] rounded-[inherit] lg:h-[600px]">
  Drawing the priority map…
</div>
```
`rounded-[inherit]` lets the parent frame clip. No prop or dynamic-import change.

### Edit: `src/components/PriorityPanel.tsx`

Logic kept (same `cells`, `selectedCellId`, `onSelectCell`, `limit=8`, `priorityBand`). Prop surface expands by two optional props so the panel can drive map chrome without lifting ranked data elsewhere:

```ts
interface PriorityPanelProps {
  cells: RankedCell[];
  selectedCellId: string | null;
  hoveredCellId?: string | null;              // read, for row-level highlight parity
  onSelectCell: (id: string) => void;
  onHoverCell?: (id: string | null) => void;  // write, used by map chrome in Dashboard → MapView
  limit?: number;
}
```

Both new props are optional so the component remains usable in isolation (storybook / tests) without a Dashboard parent.

1. **Priority color tags** (Red / Amber / Light green): a 4-px left accent bar on each row, driven by cell priority. Mapping:
   - `priority === "very-high" || priority === "high"` → `.accent-bar-critical` (`--color-accent-red`)
   - `priority === "moderate"` → `.accent-bar-moderate` (`--color-accent-amber`)
   - `priority === "low" || priority === "very-low"` → `.accent-bar-lower` (`--color-accent-green`)
   - `priority === "unscored"` → no bar
   This is chrome only; the authoritative band color on the score chip still comes from `priorityBand(cell.priority).color`.
2. **Hover ↔ map correlation (DESIGN.md § 3.E, finding #2)**: each row calls `onHoverCell(cell.id)` on `onMouseEnter` / `onFocus` and `onHoverCell(null)` on `onMouseLeave` / `onBlur`. Dashboard holds the `hoveredCellId` state (see Dashboard point 10) and passes it down to `MapView`, which renders exactly one additional dashed outline polygon over the hovered cell (see MapView point 4). The panel also uses the same prop to scale and translate its own row accent bar (`motion-safe:transition-transform`) so the panel-side feedback is consistent with the map-side ring. Focus-based hover (via `onFocus`/`onBlur`) ensures keyboard users get the same correlation.
3. **Filter / sort controls**: a small toolbar above the `<ol>` with a `<SegmentedControl>` offering `All / Critical / Moderate` and a sort toggle `By score / By rank`. Both operate on a local `useMemo` filter of the already-ranked `cells` prop — no re-scoring. Default: `All, By rank`, which produces the exact same list the panel renders today. The `limit` prop still caps display.
4. **Smooth scroll**: `overflow-y-auto max-h-[32rem]` with `scroll-smooth` and `motion-reduce:scroll-auto`.
5. **List entrance**: `motion-safe:animate-slide-up delay-100` staggered on each row (via `style={{ animationDelay: `${index * 40}ms` }}`), gated by the existing media query in globals.css.

### Edit: `src/components/ZoneDetails.tsx`

Logic preserved: `cell`, `scoredCells`, `weights`, `onSelectTop`, `isProposed`, `onToggleProposal`, `rawLabel`, `COMPONENT_LABELS`, `priorityBand`, `SCENARIO_RADIUS_METERS`, `FACILITY_RADIUS_METERS`.

Visual:

1. **Score display**: the current `h-14 w-14` square becomes a **radial meter**: an inline `<svg viewBox="0 0 36 36">` with two `<circle>` elements — one track (`stroke-[#e7ece1]`), one arc (`stroke-dasharray` set to the circumference, `stroke-dashoffset` computed from `(100 - cell.score)` of the circumference). The score number sits centred via `<text>` inside the SVG. Arc color = `priorityBand(cell.priority).color`. Fully static SVG, no dep. Unscored cells render a dash.
2. **Component bars**: existing `role="meter"` bars kept, but the fill becomes a gradient `bg-gradient-to-r from-[var(--green)] to-[var(--lime)]` and the bar track becomes `bg-[#e7ece1]/60 backdrop-blur-sm`. All `aria-*` attributes preserved.
3. **"Propose a 150 m greening cluster here" button**: becomes a prominent CTA with a subtle sheen on hover (`before:` pseudo-element with `motion-safe:animate-sheen` gated on `hover`). Toggle semantics (`aria-pressed={isProposed}` and label swap) unchanged.
4. Entrance: `motion-safe:animate-fade-in` on the whole section.

### Edit: `src/components/ImpactComparison.tsx`

Logic preserved: `scenario`, `cellId`, `facilities`, `onClear`, `limit=6`, the `useEffect` that `scrollIntoView`s with reduced-motion detection, `BEFORE_COLOR` / `AFTER_COLOR`, `percent`, the `cellChanges.slice(0, limit)` list, the `reached` filter.

Visual:

1. The three summary stat tiles (green cover before→after, high-priority cells reached, facilities within radius) each get a thin gradient accent and `motion-safe:animate-pop-in` on mount (keyed on `cellId` so switching proposals re-animates).
2. The dumbbell chart (before/after dots on a horizontal track) is kept — it is already a bespoke, dependency-free visualization. Row entrance is staggered `animation-delay: ${i * 60}ms`, gated by `motion-safe:animate-slide-up`.
3. "Clear" button swapped for a subtle icon-button variant (× glyph + "Clear" text) at the top-right.

### Edit: `src/components/LoadingSteps.tsx`

Logic preserved: `applyStreamEvent`, `INITIAL_PROGRESS`, `QueryProgress`, `StepStatus`, `stepsFor`, `StepIcon`, `active` derivation, `aria-live` region.

Visual:

1. The outer card gains `motion-safe:animate-slide-up` entrance and `shadow-[var(--shadow-glass-xl)]`.
2. The progress line already uses `transition-[width] duration-500 ease-out`. We add a shimmer overlay on top of the fill: `after:absolute after:inset-0 after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)] motion-safe:after:animate-marquee-sheen`. Reduced-motion still disables it because `.animate-marquee-sheen` is gated.
3. The elapsed-timer pill is already present (`{elapsedSeconds}s`); we add `motion-safe:animate-pulse-dot` on the leading dot inside it to signal liveness.
4. Each active step's icon keeps its existing spinner (`motion-safe:animate-spin`), already correct.

### Edit: `src/components/ExploreGuide.tsx`

Logic preserved (`steps` derivation from `hasSelection` / `hasProposal`, `current` index, `SCENARIO_RADIUS_METERS` reference).

Visual: swap the solid dark card for a `rounded-[28px] bg-gradient-to-br from-[var(--green-dark)] to-[#0b2a1b] text-white shadow-[var(--shadow-glass-xl)]` with a subtle animated glow using `.animate-gradient-shift` (already in globals.css) applied to a `::before` background mask. Each `<li>` keeps its `aria-current` and `role="step"`-equivalent markup.

## Mobile responsive strategy (<768px)

The design brief requires that on viewports below `md` (Tailwind's default 768 px breakpoint), the three dashboard panes (Map, Priority Queue, Zone Inspector) are not stacked in a long scroll but switched via a tab/sheet pattern. The desktop (≥md) grid is **untouched** — the two-column `xl:grid-cols-[minmax(0,1fr)_380px]` keeps working.

### Single mounted subtree per viewport (critical)

The two layouts (desktop grid and mobile tabs) are **never both mounted at the same time**. Rendering `mapSlot` under two parents would mount two Leaflet `MapContainer` instances (double tile fetch, duplicated `scrollIntoView` effects, zero-size map behind `display:none` until the viewport crosses the breakpoint). The branch is decided in JS via a `matchMedia` subscription so exactly one tree exists at any moment.

A tiny hook, local to `Dashboard.tsx` (not a new file — a few lines before the component body):

```ts
function useIsDesktop() {
  const subscribe = (cb: () => void) => {
    const mql = window.matchMedia("(min-width: 768px)");
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  };
  const getSnapshot   = () => window.matchMedia("(min-width: 768px)").matches;
  const getServerSnap = () => true; // SSR default: desktop → avoids initial-paint flash of a mobile shell on wide screens
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnap);
}
```

Why desktop is the SSR default: Next.js runs the dashboard on the server; without a request-time viewport, picking either default is a guess. Desktop was chosen because the dashboard's primary device target is laptop/desktop, and because the first hydration frame on a narrow viewport is already masked by the `LoadingSteps` card while the OSM stream completes — the layout flip (desktop → mobile) lands under that card, so no map re-mount is observable.

Implementation inside `Dashboard.tsx` (preserving every existing hook, state, callback, and derived value above this point):

```tsx
// ─── slots built from existing derived values ───
const mapCard = (
  <section className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[var(--shadow-glass-lg)]">
    {/* existing LayerDock + MapShell|LoadingSteps|error branch, unchanged */}
  </section>
);
const inspectorStack = (
  <>
    <ExploreGuide hasSelection={selectedCell !== null} hasProposal={scenario !== null} />
    {ready && ranking ? (
      <>
        <ZoneDetails {...zoneDetailsProps} />
        {scenario && proposalCell && (
          <ImpactComparison {...impactProps} />
        )}
      </>
    ) : /* existing ready/error fallbacks */ null}
  </>
);
const priorityCard = ready && ranking
  ? <PriorityPanel cells={cells} selectedCellId={selectedCellId} hoveredCellId={hoveredCellId} onSelectCell={selectCell} onHoverCell={setHoveredCellId} />
  : null;

const isDesktop = useIsDesktop();

return (
  <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
    {/* page summary row — see Dashboard.tsx point 1 */}
    …
    {isDesktop ? (
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">{mapCard}{/* inline provenance footer */}</div>
        <aside className="flex flex-col gap-5 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
          {inspectorStack}
          {priorityCard}
        </aside>
      </section>
    ) : (
      <MobileExploreTabs
        mapSlot={mapCard}
        prioritySlot={priorityCard}
        inspectorSlot={inspectorStack}
        selectedCell={selectedCell}
        scenario={scenario}
        requestKey={requestKey}
        counts={{ cells: cells.length, scored: scoredCount, hasInspector: Boolean(selectedCell) }}
      />
    )}
  </div>
);
```

The `md:hidden` / `hidden md:grid` Tailwind-only pattern is **not** used; both layouts rendering simultaneously is exactly what finding #1 called out.

### MobileExploreTabs.tsx

Owns `useState<"map"|"priority"|"inspector">("map")` (default to Map). The component only mounts when `!isDesktop`, so when it unmounts on a resize to desktop its tab state is deliberately discarded and the desktop grid shows all three panes at once (correct behaviour: desktop users do not need a tab pointer).

Markup:

```tsx
<div className="pb-20">
  <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}
       key={active} className="motion-safe:animate-fade-in">
    {active === "map"       && mapSlot}
    {active === "priority"  && prioritySlot}
    {active === "inspector" && inspectorSlot}
  </div>
  <nav role="tablist" aria-label="Dashboard view"
       className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--line)]
                  bg-[var(--color-surface-glass)] backdrop-blur-md
                  shadow-[0_-8px_24px_rgba(39,65,43,0.08)]">
    {(["map", "priority", "inspector"] as const).map((id) => {
      const isActive = active === id;
      return (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          // aria-controls only on the active tab — the other panels are not in the
          // DOM, so pointing at their IDs would reference non-existent elements
          // (iteration-3 MEDIUM #2). Inactive tabs omit the attribute entirely.
          {...(isActive ? { "aria-controls": `panel-${id}` } : {})}
          aria-selected={isActive}
          tabIndex={isActive ? 0 : -1}
          onClick={() => setActive(id)}
          className="min-h-11 min-w-11 flex-1 … (icon + label + optional badge)"
        >
          {/* icon + label + optional badge */}
        </button>
      );
    })}
  </nav>
</div>
```

Only the active tabpanel is mounted (preserves the single-mount invariant for `mapSlot`'s `MapContainer`). `aria-controls` is set exclusively on the active tab because only the active `panel-${id}` element exists in the DOM; the inactive tabs omit `aria-controls` entirely (iteration-3 MEDIUM #2 — this is Option A from the review). `tabIndex` follows the WAI-ARIA roving-tab-index pattern: active tab is `0`, inactive tabs are `-1`.

Because `active === "map"` is the only branch that renders `mapSlot`, only one `MapContainer` ever exists — the one in whichever tab is active. Switching to Priority and back causes a Leaflet remount, which is acceptable on mobile (same cost as switching browser tabs, and the dashboard has one `MapShell` instance either way).

**Two independent auto-switch latches** (finding #8):

```tsx
const didAutoSwitchOnSelectRef  = useRef(false);
const didAutoSwitchOnProposeRef = useRef(false);

// Reset both when the study area changes so a new area restarts the latches.
useEffect(() => {
  didAutoSwitchOnSelectRef.current  = false;
  didAutoSwitchOnProposeRef.current = false;
}, [requestKey]);

useEffect(() => {
  if (selectedCell && !didAutoSwitchOnSelectRef.current) {
    setActive("inspector");
    didAutoSwitchOnSelectRef.current = true;
  }
}, [selectedCell]);

useEffect(() => {
  if (scenario && !didAutoSwitchOnProposeRef.current) {
    setActive("inspector");
    didAutoSwitchOnProposeRef.current = true;
  }
}, [scenario]);
```

A single ref cannot gate two independent first-time events; the two-ref pattern makes "first selection" and "first proposal" each fire once per area.

### Other mobile notes

- Reused `<SegmentedControl>` is **not** used for the tab bar because the mobile tab bar needs icons + badges + `role="tablist"` semantics, which differ from the pill segment pattern on the landing page.
- Keyboard navigation inside the tablist: `ArrowLeft` / `ArrowRight` cycle focus between the three tabs; `Home` / `End` jump to first / last; `Enter` / `Space` activate (equivalent to click).
- Touch targets everywhere ≥44×44 px: enforced via `min-h-11 min-w-11` on tab buttons, the Header hamburger, and the search Clear button.
- The sticky bottom bar never covers content thanks to `pb-20` on the panel wrapper.

Landing-page mobile (`/`): the `AreaPicker` already stacks naturally. Changes needed:

- The map viewport height caps at `h-[380px]` on `<sm`, `h-[460px]` on `sm`, `h-[560px]` on `lg` — already in `AreaPickerMap.tsx`, kept.
- The sticky controls panel does not become a bottom sheet; it stacks above the map on mobile. This matches current behaviour and remains thumb-friendly after the touch-target bump.
- Pinch-to-zoom is enabled by default by Leaflet and we do not change `MapContainer` props, so this requirement (3.D) is satisfied by preservation.

## Error handling

| Failure | Recoverable? | Behaviour |
| --- | --- | --- |
| `/api/geocode` request fails (network, 5xx, aborted). | Recoverable. | Existing `catch` sets `search = { term, hits: [], failed: true }`; UI shows "Place search is unavailable right now. Click the map instead." Preserved verbatim. No new error log at the component level. The console.warn remains for developer diagnostics. |
| `/api/geocode` returns 0 hits. | Not an error. | Existing `noResults` path shows "No places found for 'X'. Try a broader name, or click the map." Preserved. |
| `/api/area?stream=1` streaming errors (non-OK response, stream closes early, event `type === "error"`). | Recoverable via `retry` button. | Existing path: `result = { status: "error", message }`. UI renders the error block with "Try again" (increments `reloadKey`) and "Pick another area". StatusPill in the Header switches to `error` (red dot). We add no new behaviour here; the existing message surfacing is kept exactly. |
| `useOsmStatus()` called outside provider. | Recoverable. | `OsmStatusContext` defaults to `{ status: "idle", set: () => {} }` so `<StatusPill>` and components that call `.set(...)` are safe even if the provider is accidentally dropped. The provider wraps `{children}` in `layout.tsx` so this is purely defensive. |
| MobileNavDrawer: focus trap finds no focusable elements (shouldn't happen; drawer always has close button + links). | Defensive. | If the focusable list is empty, drawer still closes on Esc; Tab does nothing. No logged error. |
| MobileExploreTabs: active tab's `content` throws during render. | Fatal to the dashboard. | Not caught locally; relies on Next.js error boundary (`app/error.tsx` if added later). Not in scope. |
| Reduced-motion user preference. | Not an error. | Every `motion-safe:animate-*` and `motion-safe:transition-*` is a no-op under `prefers-reduced-motion: reduce` thanks to the keyframe gating already in `globals.css`. The `ImpactComparison` `scrollIntoView` already checks the media query. |
| Dark OS theme on a browser without `backdrop-filter`. | Degrades gracefully. | `glass-nav` and `glass-panel` fall back to the solid `background` RGBA (already set as the base `background` value in both selectors). No blur, but readable surfaces. |

Validation of external input:

- `AreaPicker` search `query`: handled by the existing debounce + 3-character minimum guard (`term.length < 3`). No change.
- `AreaPicker` size selector: constrained to `AREA_SIZE_OPTIONS = [1, 2, 3]` (owned by `src/lib/area.ts`, untouched). `<SegmentedControl>` only emits values from this array.
- `start()` guard: `isValidArea(area)` already protects `router.push`. Unchanged.
- `/explore` URL params: validated by `areaFromParams` (owned by `src/lib/area.ts`, untouched) and `redirect("/")` on failure. Unchanged.

## Invariants and ownership

| Invariant | Owner (unchanged) |
| --- | --- |
| Priority band labels, colors, and hints (`PRIORITY_BANDS`, `priorityBand`). | `src/lib/scoring.ts` — redesign reads values; off-limits for edit. |
| 50/30/20 scoring weights. | `src/lib/scoring.ts` — off-limits. |
| 150 m scenario cluster geometry and radius (`SCENARIO_RADIUS_METERS`). | `src/lib/scenario.ts` — off-limits. |
| Bounding-box math, bbox cache keys, URL param serialization (`areaToParams` emits `lat`, `lng`, `size`; `areaFromParams` reads `params.size`). | `src/lib/area.ts` — off-limits. |
| GeoJSON ↔ Leaflet coordinate translation (`toLatLng`, `toLatLngBounds`, `featureCenter`, `splitFeatures`). | `src/lib/geoUtils.ts` — off-limits. |
| Overpass stream contract (`AreaStreamEvent` shape, NDJSON framing). | `src/app/api/area/route.ts` + `src/types/index.ts` — off-limits. |
| Nominatim proxy contract (`GeocodeHit`). | `src/app/api/geocode/route.ts` + `src/types/index.ts` — off-limits. |
| Dashboard request-key state partitioning (`requestKey = \`${query}#${reloadKey}\``). | `Dashboard.tsx` — preserved verbatim; new UI reads derived values. |
| OSM status broadcast. | New `OsmStatusContext.tsx`; writer is `Dashboard.tsx`, reader is `StatusPill.tsx`. |

## Accessibility

- Every icon-only button (`Open navigation`, `Close navigation`, `Clear search`, legend toggle, layer-dock switches on `md+`, mobile tab buttons, `Clear` on ImpactComparison) carries an explicit `aria-label` and (where appropriate) `aria-expanded` / `aria-pressed` / `aria-controls`.
- Focus rings (iteration-2 NIT #6): standardised on Tailwind utilities applied inline — `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]` on buttons, links, inputs, and SegmentedControl option buttons. No `.focus-ring` utility is defined; every sketch in this document uses the Tailwind form directly, keeping ring colour and offset in a single place (the utility string).
- Mobile drawer (iteration-2 MEDIUM #2):
  - `<aside role="dialog" aria-modal="true" aria-labelledby="mobile-nav-title">`.
  - `DrawerBody` renders `<h2 id="mobile-nav-title" className="sr-only">GreenGap navigation</h2>` as its first child; `aria-labelledby` resolves to this element so the dialog has a non-empty accessible name.
  - Focus trap scoped to the drawer, Esc closes.
  - Focus restored to the triggering hamburger on close.
  - Body scroll lock while open.
- Mobile tabs: `role="tablist" / tab / tabpanel`, `aria-selected`, `aria-controls`, `tabIndex=-1` on inactive panels (none in this design since only the active panel is rendered), arrow-key navigation (`ArrowLeft` / `ArrowRight`) to move focus between tabs.
- Status pill: a single live region on the wrapper — `role="status" aria-live="polite"` with the human-readable label as the pill's text child; the coloured dot is `aria-hidden="true"`. No nested sr-only live region (iteration-2 NIT #8).
- Reduced motion: enforced at the CSS layer (globals.css) and respected by in-component code (`ImpactComparison.scrollIntoView`).
- Minimum touch target 44×44 px on all primary mobile interactions via Tailwind `min-h-11 min-w-11`.

## Testability

- **Unit testable (no test runner currently configured in `package.json`)**: `applyStreamEvent`, `stepsFor`, `priorityBand`, scoring utilities, scenario geometry, `areaFromParams` / `areaToParams`, `isValidArea`. The redesign does not alter any of these functions and does not require new tests. If a test runner is added later, the OsmStatusContext reducer is pure and trivially testable (`set(status) → state.status`).
- **Component-level**: `SegmentedControl`, `MobileExploreTabs`, `MobileNavDrawer`, `StatusPill` are each pure presentational components whose state is a single `useState` or a prop. They can be mounted in isolation (e.g., with `@testing-library/react` if introduced) without network, Leaflet, or router.
- **Integration-level**: the Dashboard stream path, map interactions, and `/api/area` streaming are already exercised end-to-end by the existing verification plan (`npm run build`, DESIGN.md § 4 functional checklist). The redesign does not change the integration contract; running the DESIGN.md § 4 checklist proves no regression.
- **Visual regression**: manual smoke test at 375 / 768 / 1440 px via DevTools (DESIGN.md § 4.4 last point). Snapshot tests are out of scope.

## Edge cases

- **`/explore` with no results**: existing `ready` branch "OpenStreetMap has no mapped features in this square" copy is kept inside the aside; on mobile it moves into the Inspector tab.
- **Streaming completes but `ranking` is `null`** (empty `scoredFeatures` after `useDeferredValue`): preserved logic renders the empty-state aside card. StatusPill transitions to `ready` because `load.status === "ready"` and `!scoring`.
- **User toggles all four map layers off**: current `hint` in `MapView` already handles the `!layers.grid` case; preserved.
- **A cell is selected, then the user picks a new area**: `requestKey` changes, `selection` resets via its tagged-key reader. Preserved. Mobile tabs do not auto-switch on area change because `selectedCell` is `null` across the key change.
- **Proposal + area switch**: `scenario` becomes `null` because `proposalCell` resets. Mobile tabs stay on whatever tab the user had.
- **Prefers-color-scheme flips mid-session**: `glass-nav` dark surface responds via the CSS media query. No JS listener needed.
- **Nav anchor on `/explore`**: `href="/#presets"` navigates to home then scrolls. Browser-native behaviour; no shim.
- **Very long preset or label strings**: `truncate` is kept on the Dashboard page-summary row; the Header brand/label area is capped at `max-w-[40ch]` with `truncate`.
- **Keyboard-only user on the landing page**: tabs through Header → Hero link → 3-step cards (buttons? they are `<li>`s in current code — kept as `<li>` since the hero steps are informational, not actionable) → search → preset tiles → segmented control → CTA → map (focus goes to the first Leaflet focusable). Order is natural source order.

## DESIGN.md § 1–3 requirement → file edit mapping

Section 1 is context (framework / routes); no code impact. Sections 2 and 4 are preservation constraints and verification steps enforced across every edit below.

### § 3.A — Navigation, Header & Interactive Menu

| Requirement | File(s) |
| --- | --- |
| Sticky glassmorphic navigation header, `backdrop-blur-md bg-white/80 dark:bg-[#123e2a]/80 border-b border-[var(--line)]`. | NEW `src/components/Header.tsx`; `.glass-nav` utility added to `src/app/globals.css`. |
| Brand mark with micro-glow / hover rotation / pulse on `◒`, bold typography, category tag. | `src/components/Header.tsx` using `.animate-glow-pulse` + `motion-safe:hover:rotate-6`. |
| Desktop nav links Overview / Presets / Methodology / Live Analysis — smooth scroll or route. | `src/components/Header.tsx`; corresponding `id="overview"`, `id="presets"`, `id="methodology"` anchors added in `src/components/AreaPicker.tsx`. |
| Mobile slide-out drawer with `translate-x` + backdrop opacity. | NEW `src/components/MobileNavDrawer.tsx` using a CSS transition on `translate-x-full → translate-x-0` with `transition-transform duration-300 ease-out motion-reduce:transition-none` and a sibling backdrop `transition-opacity`. No globals.css diff is needed for the drawer motion (iteration-2 NIT #4: a `slide-in-right` keyframe was dropped from the globals.css additions because the drawer uses a transition rather than a keyframe animation; no consumer referenced `.animate-slide-in-right`). |
| OSM status pill: pulsing dot, green/amber/red. | NEW `src/components/StatusPill.tsx` + NEW `src/components/OsmStatusContext.tsx`; `@keyframes pulse-dot` + `.animate-pulse-dot` added to `src/app/globals.css`; writer effect added to `src/components/Dashboard.tsx`. |
| Quick action buttons: `Change Area` → done (Header right-cluster CTA on `/explore` is `<Link href="/">Change area</Link>`, replacing the inline Dashboard button). `Explore Preset` → done (on `/` the right-cluster CTA is `<Link href="#presets">Jump to presets</Link>`, which scrolls to the preset tile grid — see finding #6). `Reset View` → **deferred** (NIT #15): there is no existing camera-reset handler on `MapView.tsx` to reskin; introducing one would be a new behavioural feature (new state, new fit-bounds call, new button), which is out of scope for a visual redesign. `Change area` provides a complete reset by returning to the picker. | `src/components/Header.tsx` (pathname-driven right-cluster CTA); landing-page anchor `#presets` added in `src/components/AreaPicker.tsx`. |

### § 3.B — Landing Page Hero (`/`)

| Requirement | File(s) |
| --- | --- |
| Editorial typography with high-contrast hierarchy and tagline. | `src/components/AreaPicker.tsx` hero `<section>`; `.editorial-headline` + `.eyebrow` utilities added to `src/app/globals.css`. |
| Ambient background motion: animated radial / organic / grid gradients. | `src/components/AreaPicker.tsx` using the existing `.hero-gradient` class (already animates `gradient-shift`). |
| Floating stats pills (200 m grid, OSM live, Explainable scoring). | `src/components/AreaPicker.tsx` with inline `FloatingStatPill` using `.animate-float`. |
| 3-step journey with card aesthetics, icon glow, hover elevations, connecting lines. | `src/components/AreaPicker.tsx` restyled `<ol>`. |

### § 3.C — Area Picker & Search Controls

| Requirement | File(s) |
| --- | --- |
| Modern search bar with floating label, clear button, spinner, keyboard nav. | `src/components/AreaPicker.tsx` (restyled input + inline Clear button + ArrowKey handler). |
| Nominatim dropdown with fade-in, typography, badge markers. | `src/components/AreaPicker.tsx` (dropdown `<ul>` with `.animate-slide-down`). |
| Lahore preset tiles with active ring, micro-badges, click animations. | `src/components/AreaPicker.tsx` restyled preset grid. |
| Study area size selector: pill-shaped segmented control with sliding highlight. | NEW `src/components/SegmentedControl.tsx`; wired in `src/components/AreaPicker.tsx`. |
| Glowing action card + spinner CTA + arrow hover. | `src/components/AreaPicker.tsx` CTA block using `.animate-glow-pulse` and `motion-safe:group-hover:translate-x-0.5`. |

### § 3.D — Map Container & Viewports

| Requirement | File(s) |
| --- | --- |
| Rounded, elevated map frames with inner shadow and frosted controls. | `src/components/AreaPicker.tsx` (map section wrapper); `src/components/Dashboard.tsx` (map card); `src/components/MapShell.tsx` (loading fallback radius). |
| Floating instruction pills with blur and shadows. | `src/components/AreaPicker.tsx` (over AreaPickerMap); `src/components/MapView.tsx` hint overlay restyled; `.glass-panel` reused. |
| Floating layer-visibility dock with swatches + toggle switches. | `src/components/Dashboard.tsx` inline `<LayerDock>` sub-component (two visual modes). |
| Smooth cursor + pinch-to-zoom. | Preserved: `cursor-crosshair` in `AreaPickerMap.tsx`, default Leaflet touchZoom in `MapView.tsx`. No change needed. |

### § 3.E — Analysis Dashboard (`/explore`)

| Requirement | File(s) |
| --- | --- |
| Metric cards with glassmorphism, gradient accent, icons, shimmer loaders. | `src/components/Dashboard.tsx` metric row + updated `Skeleton` using `.animate-shimmer`. |
| LoadingSteps as animated telemetry card with checkmarks, timer pill, progress line. | `src/components/LoadingSteps.tsx` chrome polish; `@keyframes marquee-sheen` + `.animate-sheen` added to `src/app/globals.css`. |
| PriorityPanel: scrollable ranked list, priority tags (Red/Amber/Light green), hover↔map correlation, filter/sort. | `src/components/PriorityPanel.tsx` restyled with accent bars, local filter/sort toolbar, hovered-row scaling. `.accent-bar-*` utilities added to `src/app/globals.css`. (Full hover-to-map correlation is backlogged, see below.) |
| ZoneDetails: radial/bar score meter + bar breakdown + explainable bullets + "Propose 150 m" trigger. | `src/components/ZoneDetails.tsx` restyled; inline SVG radial meter; reasoning bullets already present. |
| ImpactComparison: delta meters, score reductions, facility impact. | `src/components/ImpactComparison.tsx` polished chrome; dumbbell chart preserved. |

### § 3.F — Comprehensive Footer

| Requirement | File(s) |
| --- | --- |
| Brand + mission; OSM/Nominatim attribution; scientific disclaimer; tech-stack + open-source links. | NEW `src/components/Footer.tsx`, rendered in `src/app/layout.tsx` so both routes include it. |

### § 3.G — Responsive UI/UX

| Requirement | File(s) |
| --- | --- |
| `<768px`: stacked map + controls; bottom sheet / tab switcher between Map / Priority / Inspector; 44×44 touch targets; thumb-friendly search + presets. | NEW `src/components/MobileExploreTabs.tsx`; wiring in `src/components/Dashboard.tsx`; touch-target bumps in `src/components/Header.tsx` (hamburger), `src/components/AreaPicker.tsx` (presets, Clear, CTA), and `src/components/MobileExploreTabs.tsx`. |
| Tablet + desktop balanced multi-column with sticky map + independent scroll. | `src/components/Dashboard.tsx` keeps `xl:grid-cols-[minmax(0,1fr)_380px]`; `<aside>` gets `md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto` so the right column scrolls independently while the map stays visible. The map card itself stays in flow (not sticky) — matches current behaviour and avoids layout-shift when the Leaflet container resizes. |

### § 3.H — Motion & Animation Standards

| Requirement | File(s) |
| --- | --- |
| `transition-all duration-300 ease-out`, hover lifts (`motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg`), staggered entrances (`animate-fade-in`, `animate-slide-up`), shimmer skeletons during streaming, `motion-safe:` / `motion-reduce:` gating everywhere. | Applied in every redesigned component (AreaPicker, Dashboard, Header, Footer, MobileNavDrawer, MobileExploreTabs, PriorityPanel, ZoneDetails, ImpactComparison, LoadingSteps, ExploreGuide, SegmentedControl). The gating is enforced centrally by the `@media (prefers-reduced-motion: no-preference)` / `(reduce)` blocks already in `src/app/globals.css`; new keyframes `pulse-dot` and `marquee-sheen` are added inside those same blocks (the drawer uses a `transition-transform` CSS transition rather than a keyframe animation — iteration-2 NIT #4). |

## Backlog (deliberate deferrals)
- **"Reset View" quick action** in the Header: not currently a feature of the dashboard (there is no camera-reset handler to reskin); adding one would be a new behavioural feature (new state, new fit-bounds call, new button), which is out of scope for a visual redesign. `Change area` provides a complete reset.
- **Manual light/dark theme toggle**: the design relies on `prefers-color-scheme`. A toggle would need a persistence layer and theme provider — scope creep per the constraints.
- **Snapshot / visual regression tests**: no test runner is configured in `package.json`. Introducing one is out of scope.

## Verification (DESIGN.md § 4)

After implementation, run from the repo root (`c:\Users\Daniyal\Desktop\New folder\Alethiea`), using PowerShell `;` separators:

```
npm run typecheck ; npm run lint ; npm run build
```

Then exercise the DESIGN.md § 4.4 functional checklist in a browser at 375 / 768 / 1440 px:

1. `/`: place search → updated bbox; preset buttons → location change; size selector 1×1 / 2×2 / 3×3; `Analyse this area →` → `/explore?lat=…&lng=…&size=…&label=…`.
2. `/explore`: streaming progress visible, map grid renders, cell click selects + opens inspector, `Propose 150 m` creates scenario, ImpactComparison renders, StatusPill reflects streaming → ready, Change area returns home.
3. Mobile (<768 px): MobileNavDrawer opens / closes / traps focus / Esc; MobileExploreTabs switches Map ↔ Priority ↔ Inspector; auto-switch to Inspector happens exactly once per session on first selection and once on first proposal.
4. Reduced-motion: all `.animate-*` effects become no-ops; `scrollIntoView` uses `behavior: "auto"`.

## Responses to design review findings

Each row records how the finding was resolved. Every finding is **addressed** in this revision; nothing is backlogged or ignored.

| # | Severity | Title | Resolution |
| --- | --- | --- | --- |
| 1 | HIGH | Mobile tab switcher mounts the heavy slot subtree twice | Addressed. Replaced the `hidden md:grid` + `md:hidden` dual tree with a `useSyncExternalStore(matchMedia('(min-width:768px)'))` hook (local to `Dashboard.tsx`) that returns a single boolean; Dashboard renders **either** the desktop grid **or** `<MobileExploreTabs>` — never both. SSR default is desktop. See the revised "Mobile responsive strategy (<768px)" section and the updated component tree diagram. |
| 2 | HIGH | PriorityPanel ↔ map hover correlation dropped to the backlog | Addressed. Lifted `hoveredCellId: string \| null` into `Dashboard.tsx`, added optional `hoveredCellId` / `onHoverCell` props to `PriorityPanel`, and added optional `hoveredCellId` prop to `MapViewProps`. `MapView` renders exactly one extra `<Polygon>` for the hovered cell (dashed, priority-chrome hex, `interactive: false`), wrapped in `useDeferredValue` for hover-thrash protection. Count of mounted react-leaflet nodes is unchanged. Backlog bullet removed. See Dashboard point 10, PriorityPanel point 2, MapView point 4. |
| 3 | MEDIUM | Nested `<main>` elements once Header is in RootLayout | Addressed by option (b). `AreaPicker.tsx` and `Dashboard.tsx` convert their root from `<main>` to `<div>` (new AreaPicker point 1, new Dashboard point 11). The global `layout.tsx` carries the single `<main id="main">`, so each page has exactly one `<main>`. |
| 4 | MEDIUM | OsmStatusContext used from a server-component layout without a client-boundary spec | Addressed. New "Client-boundary spec (findings #4, #5)" sub-section under "New files" explicitly declares `OsmStatusContext.tsx` as `"use client"`, names the `OsmStatusProvider` and `useOsmStatus` exports, lists which components below carry `"use client"` (Header, StatusPill, MobileNavDrawer) and which do not (Footer — server component), and shows the full `layout.tsx` rewrite that imports and wraps `<OsmStatusProvider>`. |
| 5 | MEDIUM | Dashboard status-publishing effect depends on `osm`; context stability unspecified | Addressed. The Provider wraps its value in `useMemo(() => ({ status, set: setStatus }), [status])` so the object identity is stable across renders where `status` is unchanged. Dashboard now destructures `const { set: setOsmStatus } = useOsmStatus()` and depends on `setOsmStatus` (stable) in the effect dep list. No churn, no infinite loop. See Dashboard point 2 and the OsmStatusContext spec. |
| 6 | MEDIUM | Header "Open live analysis" quick action on `/` is a dead-end | Addressed via option (b). On `/`, the right-cluster CTA is `<Link href="#presets">Jump to presets</Link>` — a smooth-scroll shortcut to the preset tile grid, not a cross-route bounce. On `/explore`, it remains `<Link href="/">Change area</Link>`. See the revised "Behaviours" bullet under Header anatomy, and the explicit § 3.A mapping row. |
| 7 | MEDIUM | MobileNavDrawer `createPortal` without SSR / mount gate | Addressed. The drawer now uses a `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);` guard; `createPortal(..., document.body)` is only called after mount **and** when `open === true`. See the revised "Mobile drawer" paragraph. |
| 8 | MEDIUM | MobileExploreTabs auto-switch guard uses a single `useRef<boolean>` | Addressed. Two refs: `didAutoSwitchOnSelectRef` (gated on `selectedCell`) and `didAutoSwitchOnProposeRef` (gated on `scenario`), both reset to `false` when `requestKey` changes. First-selection and first-proposal are now independent latches. See the revised "MobileExploreTabs.tsx" sub-section. |
| 9 | NIT | Skeleton restyle collides with `.animate-shimmer`'s own background | Addressed. The Skeleton className drops `bg-[#e3eadf]` entirely when `.animate-shimmer` is applied; the shimmer utility's own gradient (anchored on the same `#e3eadf` stop) becomes both the animated paint and the reduced-motion fallback. Spelled out in Dashboard point 3. |
| 10 | NIT | SegmentedControl sliding-pill geometry not formally specified | Addressed. New "SegmentedControl.tsx geometry (NIT #10)" section defines pill width `= 100 / optionCount%`, translate `= activeIndex * 100%` (percent of pill's own width), required `renderOption` and `ariaLabel` props, `role="group"` on the wrapper, and keyboard semantics. |
| 11 | NIT | `<StepJourney />` named in the tree but implemented inline | Addressed. The tree diagram now shows the 3-step journey as inline JSX ("not a new component — NIT #11"); no `StepJourney.tsx` is created. |
| 12 | NIT | Mobile hamburger `aria-label` inconsistent | Addressed. Standardised to `"Open navigation"` in the Header JSX sketch, the "Mobile hamburger" bullet, the Mobile drawer sub-section, and the Accessibility section. |
| 13 | NIT | Leaflet `pathOptions.color` using CSS variable is not guaranteed | Addressed. Introduced a `PRIORITY_CHROME_HEX` module-level constant inside `MapView.tsx` with hex literals (`#c62f2f` / `#f2a93b` / `#7fb87f`); the hex is passed to both the selected-cell accent ring and the new hover-outline polygon. CSS `--color-accent-*` tokens remain the single source of truth for HTML surfaces. See MapView point 3 and point 4. |
| 14 | NIT | StatusPill shows stale `ready` state on `/` after returning from `/explore` | Addressed. Added a Dashboard unmount cleanup effect: `useEffect(() => () => setOsmStatus("idle"), [setOsmStatus])`. On navigating away from `/explore` the status returns to `"idle"` and the Header pill resets. See Dashboard point 2. |
| 15 | NIT | "Reset View" deferral not explicit in § 3.A mapping row | Addressed. The § 3.A row now explicitly lists `Change Area` (done), `Explore Preset` (done — `#presets` anchor shortcut), and `Reset View` (deferred — no existing camera-reset handler on `MapView.tsx`, introducing one would touch map behaviour). The backlog entry is kept for traceability. |
| 16 | NIT | Dashboard inline `<footer>` duplicates the global `<Footer />`'s ODbL attribution | Addressed. Dashboard point 9 now explicitly states the inline `<footer>` drops the ODbL phrase; only the global `<Footer />` (DESIGN.md § 3.F) carries OSM / Nominatim attribution. The dashboard inline footer keeps only `metadata.source` + fetched timestamp + ranking notes. |

No new runtime dependencies were introduced in resolving these findings. No off-limits file (`src/lib/scoring.ts`, `src/lib/scenario.ts`, `src/lib/area.ts`, `src/lib/geoUtils.ts`, `src/lib/osm.ts`, `src/lib/areaCache.ts`, `src/types/index.ts`, `src/app/api/area/route.ts`, `src/app/api/geocode/route.ts`) is modified. The URL contract (`lat`, `lng`, `sizeKm`, `label`) is preserved.

## Responses to design review iteration 2

Second-pass review (`design-review.json`, `design-review.md`) raised 1 HIGH, 1 MEDIUM, and 7 NITs. Every finding is addressed in-place in this document; no finding is backlogged or ignored.

| # | Severity | Title | Resolution |
| --- | --- | --- | --- |
| 1 | HIGH | Skeleton with `.animate-shimmer` paints nothing under `prefers-reduced-motion: reduce` | Addressed via the reviewer's option (a). The Skeleton className is specified as `block rounded-lg bg-[#e3eadf] animate-shimmer ${className}`. Under `no-preference` the `.animate-shimmer` rule inside the gated media query applies and its `background: linear-gradient(…)` overrides the Tailwind `background-color: #e3eadf` to produce the moving gradient. Under `reduce` the `.animate-shimmer` rule's background declarations do not apply (they live inside the `no-preference` gate), so the Tailwind `background-color: #e3eadf` paints as a solid block identical to today's loading fallback. No globals.css diff. The incorrect "the gradient background still paints" assertion from iteration 1 is removed. See the revised Dashboard point 3. |
| 2 | MEDIUM | `MobileNavDrawer` `aria-labelledby="mobile-nav-title"` references an undefined element | Addressed. `DrawerBody` now renders `<h2 id="mobile-nav-title" className="sr-only">GreenGap navigation</h2>` as its first child; the drawer root carries `role="dialog" aria-modal="true" aria-labelledby="mobile-nav-title"`. The title element is enumerated in both the Mobile drawer anatomy section and the Accessibility section so the implementer wires the two together. |
| 3 | NIT | Hero body paragraph copy left as `…` placeholder | Addressed. The hero `<section>` snippet in the AreaPicker edit now carries the exact body copy preserved verbatim from today's AreaPicker hero paragraph: *"Cities have limited greening budgets. GreenGap scores every 200 m block by green-space scarcity, building density and nearby schools and hospitals, then lets you test where a new green space would help."* A code comment inside the snippet marks the preservation explicitly. |
| 4 | NIT | `@keyframes slide-in-right` and `.animate-slide-in-right` defined but never used | Addressed by dropping the keyframe and utility. The redesigned "New keyframes and utilities" subsection now adds only two keyframes (`pulse-dot`, `marquee-sheen`) and two matching utilities (`.animate-pulse-dot`, `.animate-sheen`). The drawer motion is a CSS transition on `translate-x-full → translate-x-0` with `transition-transform duration-300 ease-out motion-reduce:transition-none`, as spelled out in the Mobile drawer anatomy section and in the § 3.A mapping row. No globals.css diff is needed for the drawer motion. |
| 5 | NIT | Header JSX sketch uses `class="brand-badge"` with no `.brand-badge` utility defined | Addressed by removing the `brand-badge` class name from the sketch. The Behaviours bullet below the sketch remains the sole spec for the brand glyph (`grid place-items-center h-10 w-10 rounded-2xl bg-[var(--green-dark)] text-[var(--lime)]` + `motion-safe:transition-transform motion-safe:hover:rotate-6 motion-safe:animate-glow-pulse`). No `.brand-badge` CSS is added to globals.css; an iteration-2 note under the sketch records this explicitly. |
| 6 | NIT | `.focus-ring` utility defined but sketches use ad-hoc `focus-visible:ring-*` Tailwind utilities | Addressed by picking the Tailwind-utilities approach consistently everywhere. The `.focus-ring` + `.focus-ring:focus-visible` block is removed from the globals.css additions. Every interactive element in the design uses `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]` applied inline. The Accessibility section is updated to reflect this choice; the SegmentedControl option-button class string now spells the full ring utility set. |
| 7 | NIT | MapView import diff for `useDeferredValue` / `useMemo` not called out | Addressed. The MapView edit section now carries a one-line import-diff note: *"The React import list expands to `useDeferredValue, useEffect, useMemo, useState`."* The two new hooks are consumed by the hovered-cell outline block (point 4). |
| 8 | NIT | `StatusPill` doubles `role="status"` and inner `aria-live` sr-only region | Addressed by picking a single live region on the wrapper. The pill is `<span role="status" aria-live="polite" className="rounded-full border …">` with the human-readable text as the only announced content; the coloured dot is `aria-hidden="true"`. The nested sr-only live region is dropped. The Status pill bullet and the Accessibility section are updated to agree. |
| 9 | NIT | SegmentedControl pill-width math vs. `inline-grid auto-cols-fr p-1` padding | Addressed by anchoring the pill with `inset-1` so its reference box becomes the padding-adjusted inner frame, and computing the pill width as `calc((100% - 0.5rem) / N)` so it matches the grid cell content box exactly. The translate is spelled out as `translateX(calc(activeIndex * ((100% - 0.5rem) / N)))` to keep the math SSR-safe and no-measurement. The SegmentedControl geometry section carries the full `calc` form. |

**Review's unverified assumptions**: the review flagged a few items for sanity-check at implementation time. These are not findings but worth recording here:

- **`aria-checked:text-white` under Tailwind v4**: the SegmentedControl option-button `className` now carries `aria-checked:text-white data-[active=true]:text-white` with a matching `data-active={value === opt}` attribute, so if the project's Tailwind config emits only one of the two variants the active label still flips to white. Implementation note: no behaviour change if both variants emit; one is a belt-and-braces fallback.
- **`<Footer />` server component inside `<OsmStatusProvider>` client component**: `OsmStatusProvider.tsx` returns `<Ctx.Provider value={value}>{children}</Ctx.Provider>` verbatim, which is the exact pattern that permits server components to be streamed through a client Provider as children in React 19 / Next.js 16. The reviewer's unverified concern is dispatched by the Provider implementation already in this document.
- **`requestKey` string identity across renders**: the design keeps `requestKey = \`${query}#${reloadKey}\`` as an inline string template; React compares strings by value in `useEffect` dep arrays, so re-renders where neither `query` nor `reloadKey` has changed do not fire the dep. The MobileExploreTabs latches depend on this invariant; no `useMemo` should be introduced around `requestKey` for the sake of "stability".
- **"Reset View" deferral rationale**: the review correctly observes that MapView is already being edited in this redesign (hovered-cell outline polygon) so "touching map behaviour" is not a hard constraint. The actual rationale for deferring Reset View is that there is no existing camera-reset handler to reskin and introducing one would be a new behavioural feature — out of scope for a visual redesign. The § 3.A mapping row is updated to use that language rather than "adjacent to off-limits logic".

No new runtime dependencies were introduced in resolving the iteration-2 findings. No off-limits file (`src/lib/scoring.ts`, `src/lib/scenario.ts`, `src/lib/area.ts`, `src/lib/geoUtils.ts`, `src/lib/osm.ts`, `src/lib/areaCache.ts`, `src/types/index.ts`, `src/app/api/area/route.ts`, `src/app/api/geocode/route.ts`) is modified. The URL contract (`lat`, `lng`, `sizeKm`, `label`) is preserved.

## Iteration-3 patch (applied by orchestrator before planner)

The iteration-3 review returned CHANGES_REQUESTED (2 MEDIUM, 7 NIT, 0 HIGH). The two MEDIUM blockers plus one functionally-material NIT were patched directly into this document:

- **MEDIUM #1 — MobileNavDrawer z-index**: resolved. The drawer backdrop now carries `fixed inset-0 z-[60] bg-black/40` and the sheet carries `fixed inset-y-0 right-0 z-[70] w-[86vw] max-w-sm`. Stacks strictly above the sticky Header (`z-50`) and the mobile tab bar (`z-40`). Rationale captured inline in the Mobile drawer section.
- **MEDIUM #2 — MobileExploreTabs `aria-controls` points at unmounted panels**: resolved via the review's Option A. The inactive tab buttons omit `aria-controls` entirely; only the active tab carries `aria-controls={`panel-${id}`}` because only the active `panel-${id}` is mounted. `tabIndex` follows the roving-tab-index pattern (active = `0`, inactive = `-1`). Markup sketch updated.
- **NIT #3 — URL-param name**: resolved. The on-wire URL param is `size` (serialised by `areaToParams(area)` in `src/lib/area.ts` → `URLSearchParams({ lat, lng, size: String(sizeKm) })` and read in `areaFromParams` as `params.size`). The in-memory `AreaSelection` property is `sizeKm`. The Overview sentence and the Invariants-and-ownership row now distinguish the two. All other `sizeKm` references in this document refer to the in-memory property (correct) and remain.

The remaining 7 NITs are **acknowledged** and will be addressed by the implementer during the build loop; they are small, mechanical, and the implement-and-review loop is the right venue for them (versus another design-loop iteration):

- NIT #4 — SegmentedControl wrapper `role="group"` → `role="radiogroup"` (option buttons already `role="radio"`).
- NIT #5 — `useIsDesktop` subscribe/getSnapshot lifted to module scope so `addEventListener` / `removeEventListener` run once, not on every Dashboard render.
- NIT #6 — Dashboard import-diff one-liner noting the expanded React imports and the new `useOsmStatus` import.
- NIT #7 — Preset tile active state standardises on `data-[active=true]:…` with `data-active={active}` attribute wiring (matches SegmentedControl form).
- NIT #8 — Methodology card copy locked to a verbatim two-paragraph block covering 50/30/20 weights + the 150 m scenario tool with planting-suitability disclaimer. Exact wording lives in the iteration-3 review doc; the implementer will paste it verbatim.
- NIT #9 — Drawer focus-trap selector contract documented: contents are limited to `<a>`, `<button>`, or elements with `[tabindex]`; introducing `<input>` / `<select>` / `<textarea>` into the drawer requires widening the `querySelectorAll` selector.

No off-limits file is modified by any iteration-3 fix. The on-wire URL contract (`lat`, `lng`, `size`, `label`) is preserved verbatim — the correction is purely a documentation accuracy fix.
