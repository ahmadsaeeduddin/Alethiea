# Design Review — GreenGap Frontend Visual Redesign (iteration 3)

Reviewer context: this is a fresh, standalone read of `design.md`. Where the document claims the current source behaves in a specific way, those claims were verified against the actual source (`src/app/globals.css`, `src/app/layout.tsx`, `src/components/{AreaPicker,Dashboard,MapView,MapShell,PriorityPanel,ImpactComparison}.tsx`, `src/lib/{area,scoring}.ts`, `src/types/index.ts`, `package.json`).

## Verdict (mechanical)

- HIGH: 0
- MEDIUM: 2
- NIT: 7
- Result: **CHANGES_REQUESTED** (MEDIUM > 0).

The design is strong overall. It covers DESIGN.md § 3.A–H with a concrete file-mapping table, honours every preservation constraint, adds no runtime dependency, and converges on sensible resolutions for every prior finding. The two MEDIUM items are specific, local, and easy to patch.

---

## Findings

### 1. MEDIUM — `MobileNavDrawer` z-index is unspecified, likely sits under the sticky Header and the bottom tab bar

Location: "Mobile drawer (`src/components/MobileNavDrawer.tsx`)" section and the `MobileExploreTabs` section.

What the design says:
- Header: `sticky top-0 z-50 glass-nav`.
- MobileExploreTabs bottom bar: `fixed bottom-0 inset-x-0 z-40 ...`.
- Drawer sheet: `Full-height right-aligned sheet, w-[86vw] max-w-sm, translate-x-full → translate-x-0 ...` — no `z-*` utility given.
- Drawer backdrop: `fixed inset-0 bg-black/40` — no `z-*` utility given.

Problem: the drawer is portaled to `document.body` (sibling of the Header, not a descendant). Without an explicit stacking value the drawer and its backdrop paint at the default `z-auto`, which under the sticky `z-50` Header will render the drawer *behind* the Header bar. On `/explore` on mobile, the drawer would also collide with the `z-40` bottom tab bar — the bar would still receive clicks through the backdrop. Both are real, user-visible defects.

Concrete fix: pin the drawer and its backdrop above everything that could stack over them. In the "Mobile drawer" section add explicit utilities:

```tsx
<div
  // backdrop
  className="fixed inset-0 z-[60] bg-black/40 opacity-0 transition-opacity data-[open=true]:opacity-100 motion-reduce:transition-none"
  data-open={open}
/>
<aside
  role="dialog" aria-modal="true" aria-labelledby="mobile-nav-title"
  className="fixed inset-y-0 right-0 z-[70] w-[86vw] max-w-sm translate-x-full
             bg-white shadow-[var(--shadow-glass-xl)] transition-transform duration-300 ease-out
             data-[open=true]:translate-x-0 motion-reduce:transition-none"
  data-open={open}
>...</aside>
```

Values can be any pair strictly greater than `z-50` and `z-40` with the drawer above the backdrop. Add a one-line note in the Mobile responsive strategy section that confirms the drawer stacks above the MobileExploreTabs bottom bar.

---

### 2. MEDIUM — `MobileExploreTabs` tab buttons point `aria-controls` at tabpanel IDs that are not in the DOM

Location: "MobileExploreTabs.tsx" markup sketch.

What the design says: only the active tab's panel is rendered (critical to the single-mounted-`MapContainer` invariant), with `id={\`panel-${active}\`}`. The three tab buttons each carry `aria-controls={\`panel-${id}\`}` where `id` is the button's own tab id (map / priority / inspector).

Problem: when `active === "map"`, only `#panel-map` exists in the DOM. The `tab-priority` and `tab-inspector` buttons declare `aria-controls="panel-priority"` and `"panel-inspector"` — references to elements that do not exist. ARIA Authoring Practices Guide requires `aria-controls` on a `role="tab"` to reference the tabpanel it controls. Screen readers can emit a "no target" warning and users who try to jump from tab to panel land nowhere.

Concrete fix: pick one of the two canonical resolutions and spell it out.

Option A (lazy-render, drop controls on inactive tabs):

```tsx
<button
  role="tab"
  id={`tab-${id}`}
  aria-selected={active === id}
  aria-controls={active === id ? `panel-${id}` : undefined}
  tabIndex={active === id ? 0 : -1}
  onClick={() => setActive(id)}
>...</button>
```

Option B (always-render three tabpanels, hide inactive ones with the `hidden` attribute and skip mounting their slots):

```tsx
{(["map","priority","inspector"] as const).map((id) => (
  <div
    key={id}
    role="tabpanel"
    id={`panel-${id}`}
    aria-labelledby={`tab-${id}`}
    hidden={active !== id}
  >
    {active === id ? slots[id] : null /* preserves single-mount for mapSlot */}
  </div>
))}
```

Option B keeps every `aria-controls` reference valid without mounting the heavy slot subtree twice; option A keeps the current single-panel markup. Either is acceptable, but the design must commit.

---

### 3. NIT — URL contract wording in the Overview says `sizeKm` but the real URL param is `size`

Location: Overview paragraph: `the URL contract (lat, lng, sizeKm, label)`. Mirrored in the "Invariants and ownership" row.

Verified against `src/lib/area.ts`: `areaToParams` serialises as `size: String(sizeKm)` and `areaFromParams` reads `params.size`. The URL param name is `size`, not `sizeKm`; `sizeKm` is the in-memory property name on `AreaSelection`.

Fix: in the Overview and the Invariants table, change `sizeKm` to `size` when describing the URL contract (keep `sizeKm` when describing the `AreaSelection` type). This is a doc-accuracy change only; the code path (`areaToParams(area)` preserved verbatim) is unaffected.

---

### 4. NIT — `SegmentedControl` wrapper uses `role="group"` while describing WAI-ARIA radiogroup semantics

Location: "SegmentedControl.tsx geometry" section.

The design says each option is `role="radio" aria-checked={...}` and the keyboard behaviour matches WAI-ARIA radiogroup (`ArrowLeft`/`Right`/`Home`/`End`). The wrapper, however, is `role="group"`. The container of a radio set should be `role="radiogroup"` (so screen readers announce the composite and group arrow navigation), not the weaker `role="group"`.

Fix: change the wrapper to `role="radiogroup"`:

```tsx
<div role="radiogroup" aria-label={ariaLabel} className="relative inline-grid auto-cols-fr grid-flow-col rounded-full border border-[var(--line)] bg-white/70 p-1 shadow-[var(--shadow-glass-sm)]">
```

---

### 5. NIT — `useIsDesktop` creates fresh `subscribe` and `getSnapshot` closures on every Dashboard render

Location: "Single mounted subtree per viewport" `useIsDesktop` listing.

```ts
function useIsDesktop() {
  const subscribe = (cb: () => void) => { /* new fn each call */ };
  const getSnapshot = () => window.matchMedia("(min-width: 768px)").matches; // new fn + new MQL each call
  ...
}
```

`useSyncExternalStore` compares `subscribe` identity across renders; a new reference triggers `removeEventListener` + `addEventListener` on every render. Dashboard re-renders dozens of times during streaming, so the matchMedia listener is torn down and reattached per event. Correct behaviour, wasteful implementation. `getSnapshot` similarly allocates a MediaQueryList each invocation.

Fix: lift the subscribe/getSnapshot to module scope (or memoise with `useCallback` + a module-level MQL):

```ts
const DESKTOP_MQL = typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)") : null;
const subscribeDesktop = (cb: () => void) => {
  DESKTOP_MQL?.addEventListener("change", cb);
  return () => DESKTOP_MQL?.removeEventListener("change", cb);
};
const getDesktopSnapshot = () => DESKTOP_MQL?.matches ?? true;
const getDesktopServerSnapshot = () => true;

function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getDesktopServerSnapshot);
}
```

---

### 6. NIT — Dashboard import diff is not called out

Location: "Edit: `src/components/Dashboard.tsx`" section.

The design introduces two new imports in Dashboard that are not currently present:
- `useSyncExternalStore` from `react` (for `useIsDesktop`).
- `useOsmStatus` from `@/components/OsmStatusContext`.

For symmetry with the MapView "import list expands to …" note (iteration-2 NIT #7), add one line in the Dashboard edit section:

> The React import list expands to `useCallback, useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore`. A new import `import { useOsmStatus } from "@/components/OsmStatusContext"` is added.

---

### 7. NIT — Preset tile active-state Tailwind variant is written inconsistently with the rest of the document

Location: AreaPicker "Preset tiles" bullet uses `data-active:ring-2 data-active:ring-[var(--green)] data-active:ring-offset-2`. The SegmentedControl section uses the explicit `data-[active=true]:text-white` form.

Tailwind v4's documented syntax is `data-[attr]` or `data-[attr=value]`. The bare `data-active:` form is not standard without a per-project `theme.data` entry. Pick one form and spell it the same way everywhere, and show the attribute wiring on the button (`data-active={active}` or `data-[active=true]`).

Suggested replacement:

```tsx
<button
  type="button"
  aria-pressed={active}
  data-active={active}
  onClick={() => jumpTo(preset.area.center, preset.name)}
  className="group rounded-2xl border px-3 py-2.5 text-left transition hover:bg-white
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]
             data-[active=true]:ring-2 data-[active=true]:ring-[var(--green)]
             data-[active=true]:ring-offset-2 ..."
>
```

---

### 8. NIT — Methodology card copy is left as a hint ("two-paragraph explainer: scoring weights 50/30/20 and the 150 m scenario — descriptive text only")

Location: AreaPicker visual change #9 ("Add section anchors").

The design relies on `#methodology` for the Header nav, so this card has to exist. Its copy is specified only as a hint. Decide the copy now (it is user-facing, light prose, trivial to lock down) so the implementer does not improvise. A one-shot verbatim block, same approach the hero body copy got (iteration-2 NIT #3), closes the loop.

Suggested:

```tsx
<section id="methodology" className="...">
  <p className="eyebrow">Methodology</p>
  <h2 className="editorial-headline ...">How the score is built</h2>
  <p>
    Each 200 m cell is scored 0–100 from three mapped factors: green-space scarcity
    (50%), building concentration (30%), and nearby schools and hospitals within 400 m
    (20%). Factors without any mapped data in the area are dropped and the remaining
    weights are re-normalised, so a cell is never scored on evidence that does not exist.
  </p>
  <p>
    The "Propose a 150 m green cluster" tool simulates planting a hypothetical green
    space of 150 m radius at the selected cell. It recomputes nearest-green distance for
    affected cells and reports the before/after score drop — it does not assess planting
    suitability, land availability, or cooling impact.
  </p>
</section>
```

---

### 9. NIT — Drawer focus-trap selector list is narrow; call that out explicitly

Location: "Mobile drawer" section.

`querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')` is correct given the drawer only renders links, buttons, and the StatusPill. But the design should add one line that explicitly makes this assumption part of the drawer contract ("drawer contents must only be `<a>`, `<button>`, or `[tabindex]`; adding `<input>` requires widening the selector"), so a future contributor who drops an `<input>` into the drawer does not quietly break Tab cycling.

---

## Verified assumptions

Each of the following claims in the design was spot-checked against actual source and verified:

- `.animate-shimmer` is declared only inside `@media (prefers-reduced-motion: no-preference)` in `src/app/globals.css` (lines 108–112); the `(reduce)` block only sets `animation: none !important`. The design's resolution of iteration-2 HIGH #1 (`block rounded-lg bg-[#e3eadf] animate-shimmer`) therefore paints the solid Tailwind background under reduced motion and the gradient under no-preference. Confirmed.
- Existing keyframes `fade-in`, `slide-up`, `slide-down`, `shimmer`, `float`, `glow-pulse`, `gradient-shift`, `pop-in` and matching `.animate-*` utilities exist and are gated by the motion-safe / motion-reduce media-query pair. Confirmed.
- `PriorityLevel` is `"very-high" | "high" | "moderate" | "low" | "very-low" | "unscored"` in `src/types/index.ts`. The design's `groupedChrome` mapping covers all six values and returns `null` for `"unscored"`. Confirmed.
- `AREA_SIZE_OPTIONS = [1, 2, 3] as const` in `src/lib/area.ts`. The `SegmentedControl<T extends string | number>` signature with `options: readonly T[]` accepts this without widening. Confirmed.
- `MapViewProps` is exported from `src/components/MapView.tsx`; `MapShell(props: MapViewProps) => <MapView {...props} />` auto-threads any new optional prop. The design's claim that adding `hoveredCellId?: string | null` to `MapViewProps` requires no `MapShell.tsx` edit is correct. Confirmed.
- Current Dashboard inline `<header>` and AreaPicker inline `<header>` both exist and both get deleted per the design; the single `<main id="main">` in RootLayout plus `<div>` roots in both page components yields exactly one `<main>` per document. Confirmed.
- `AreaFeatureCollection.metadata` is `{ source, bbox, fetchedAt }` in `src/types/index.ts`; the dashboard inline footer's `load.data.metadata.source + fetchedAt` references are valid. Confirmed.
- `priorityBand(cell.priority).color` is read-only in `src/lib/scoring.ts`; the design does not modify it. Confirmed.
- `scenario.ts` and `scoring.ts` are not edited (the design does not list them under any file-edit section). URL contract (`lat`, `lng`, `size`, `label`) is preserved because `areaToParams` is kept verbatim. Confirmed.
- `package.json` does not add any new runtime dependency — no `framer-motion`, `focus-trap-react`, `headlessui`, `radix`, etc. Confirmed.
- `OsmStatusProvider` wraps `{children}` with a memoised value (`useMemo(() => ({ status, set: setStatus }), [status])`). React's `useState` setter identity is stable, so Dashboard's `useEffect(..., [load.status, scoring, setOsmStatus])` dep list is stable and will not loop. Confirmed.
- Server-component `Footer` nested inside the `"use client"` `OsmStatusProvider` is a supported pattern in React 19 / Next.js 16 (server component streamed as `children` through the client Provider). Confirmed by the Provider implementation shown in the design.
- `createPortal(..., document.body)` guarded by `mounted` + `open` avoids the "`document` undefined" SSR error. Confirmed.
- `useDeferredValue` is already used in Dashboard; reusing it in MapView for `hoveredCellId` is consistent with existing patterns. Confirmed.

## Unverified / wrong assumptions

- **"URL contract (`lat`, `lng`, `sizeKm`, `label`)"** — wrong. The URL param is `size`, not `sizeKm`. See finding #3.
- **`role="group"` for a radio set with full radiogroup keyboard semantics** — weaker than correct. Should be `role="radiogroup"`. See finding #4.
- **`useSyncExternalStore` subscribe reference stability** — the design silently assumes React will tolerate the fresh closure each render; it does, but at a cost. See finding #5.
- **`aria-controls` on a `role="tab"` can reference a tabpanel that is not currently mounted** — ARIA correctness assumption is false. See finding #2.
- **Portaled drawer stacks above sticky `z-50` Header without an explicit `z-*`** — false. See finding #1.
- **Tailwind v4 accepts bare `data-active:` without a value and without a `theme.data` entry** — not documented. The design uses both `data-active:` (preset tiles) and `data-[active=true]:` (SegmentedControl) interchangeably. See finding #7.
