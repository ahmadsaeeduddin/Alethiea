# GreenGap Frontend Redesign — Implementation Plan

Source of truth for *what* to build:
- `c:\Users\Daniyal\Desktop\New folder\Alethiea\DESIGN.md` (§ 3.A-H, § 4 functional checklist).
- `c:\Users\Daniyal\Desktop\New folder\Alethiea\.agents\tasks\greengap-redesign-2026-10-10\design.md` (authoritative technical design, including the trailing "Iteration-3 patch" with 7 NITs).

**Off-limits — zero changes, not even formatting:** `src\lib\scoring.ts`, `src\lib\scenario.ts`, `src\lib\area.ts`, `src\lib\areaCache.ts`, `src\lib\geoUtils.ts`, `src\lib\osm.ts`, `src\types\index.ts`, `src\app\api\area\route.ts`, `src\app\api\geocode\route.ts`.

**URL contract (preserved verbatim, iteration-3 NIT #3):** on-wire params are `lat`, `lng`, `size`, `label`. `areaToParams` emits `size: String(sizeKm)`; `areaFromParams` reads `params.size`. The in-memory `AreaSelection` property stays `sizeKm`.

**Verification commands (PowerShell, run from repo root):**
```
cd "c:\Users\Daniyal\Desktop\New folder\Alethiea"
npm run typecheck ; npm run lint
```
The final step also runs `npm run build`. Each item below is independently verifiable; do not advance past a failing item.

**Motion gate:** every `.animate-*` class and every hover/transform must sit inside the existing `motion-safe:` / `motion-reduce:transition-none` wrappers already enforced by `src\app\globals.css`. Add only the two keyframes the design doc specifies (`pulse-dot`, `marquee-sheen`); do not invent extras. Dark mode via `prefers-color-scheme` only — no manual toggle.

---

## Chunk A — Design tokens and global shell

- [ ] 1. Append the design-system additions to `src\app\globals.css` **after** `@import "tailwindcss";` and **before** the existing `:root` block. Add exactly: the Tailwind v4 `@theme { … }` block (surfaces, brand, priority accents `--color-accent-red/amber/green`, status colors, type scale, elevations) per design.md "1. Tailwind v4 `@theme` block"; append `@keyframes pulse-dot` and `@keyframes marquee-sheen` to the existing keyframes block; append `.animate-pulse-dot` and `.animate-sheen` **inside** the existing `@media (prefers-reduced-motion: no-preference)` block and append both class names to the no-op list under `@media (prefers-reduced-motion: reduce)`; append `.glass-nav` (plus `prefers-color-scheme: dark` override), `.editorial-headline`, `.eyebrow`, `.accent-bar-critical`, `.accent-bar-moderate`, `.accent-bar-lower`. Do **not** add any `.focus-ring`, `.brand-badge`, `.animate-slide-in-right`, or `slide-in-right` keyframe (iteration-2 NITs #4, #5, #6). Preserve every existing `:root` variable, keyframe, utility and `delay-*` class verbatim.
      Files: `src\app\globals.css`
      Verify: `cd "c:\Users\Daniyal\Desktop\New folder\Alethiea" ; npm run typecheck ; npm run lint` — both pass.

- [ ] 2. Create `src\components\OsmStatusContext.tsx` as a `"use client"` module exporting `OsmStatus` (`"idle" | "streaming" | "ready" | "error"`), `OsmStatusProvider`, and `useOsmStatus`. The Provider holds `useState<OsmStatus>("idle")` and returns `<Ctx.Provider value={useMemo(() => ({ status, set: setStatus }), [status])}>` so the `set` callback identity is stable (iteration-1 finding #5). Default `useContext` value is `{ status: "idle", set: () => {} }` so consumers outside a Provider are safe.
      Files: `src\components\OsmStatusContext.tsx` (new)
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 3. Create `src\components\StatusPill.tsx` as a `"use client"` component. Call `useOsmStatus()`; render `<span role="status" aria-live="polite" className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5 text-xs font-medium">` with an inner `aria-hidden="true"` dot colored from `--color-status-ready|streaming|error`. States: `ready` → green dot + `motion-safe:animate-pulse-dot` + "Live OpenStreetMap data"; `streaming` → amber + `motion-safe:animate-pulse-dot` + "Streaming OSM…"; `error` → red static + "Data unavailable"; `idle` → green static + "Live OpenStreetMap". No nested sr-only live region (iteration-2 NIT #8).
      Files: `src\components\StatusPill.tsx` (new)
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 4. Create `src\components\SegmentedControl.tsx` as a generic `"use client"` component with the prop surface in design.md "SegmentedControl.tsx geometry": `options`, `value`, `onChange`, `renderOption`, `ariaLabel`, `className?`. Root is `<div role="radiogroup" aria-label={ariaLabel}>` (iteration-3 NIT #4 — **radiogroup, not group**). Inner sliding pill: a sibling `<span aria-hidden="true">` with `inset-1`, `width: calc((100% - 0.5rem) / N)`, `transform: translateX(calc(${activeIndex} * ((100% - 0.5rem) / ${N})))`, and `motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none`. Each option button is `<button type="button" role="radio" aria-checked={value === opt} data-active={value === opt} className="relative z-[1] min-h-11 px-3 py-2 text-sm font-semibold aria-checked:text-white data-[active=true]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2">`. Keyboard: `ArrowLeft` / `ArrowRight` cycle, `Home` / `End` jump to first/last. If `value` is not in `options`, `activeIndex = 0`. No internal state.
      Files: `src\components\SegmentedControl.tsx` (new)
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 5. Create `src\components\MobileNavDrawer.tsx` as a `"use client"` component. SSR mount gate: `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []); if (!mounted || !open) return null;` then `createPortal(<DrawerBody …/>, document.body)` (iteration-1 finding #7). Backdrop: `fixed inset-0 z-[60] bg-black/40` with `opacity-0 → opacity-100 transition-opacity`. Sheet: `fixed inset-y-0 right-0 z-[70] w-[86vw] max-w-sm` with `translate-x-full → translate-x-0 transition-transform duration-300 ease-out motion-reduce:transition-none` (iteration-3 MEDIUM #1 confirms z-indices and iteration-2 NIT #4 confirms CSS transition rather than keyframe). Root carries `role="dialog" aria-modal="true" aria-labelledby="mobile-nav-title"`. First child inside DrawerBody is `<h2 id="mobile-nav-title" className="sr-only">GreenGap navigation</h2>` (iteration-2 MEDIUM #2). Focus trap: snapshot `document.activeElement` on open, focus the first focusable child, cycle Tab/Shift+Tab across `querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')` within the drawer, Esc → `onClose`, restore focus on close. Body scroll lock: `document.body.style.overflow = "hidden"` on open; restore in effect cleanup. Add a comment next to the `querySelectorAll` selector stating: "Drawer contents are limited to `<a>`, `<button>`, and `[tabindex]`; introducing `<input>` / `<select>` / `<textarea>` requires widening this selector." (iteration-3 NIT #9). Contents in order: title (sr-only) → visible brand (`◒` + wordmark) → links Overview/Presets/Methodology/Live Analysis (`min-h-11`) → `<StatusPill />` → secondary CTA mirroring Header's right-cluster action → top-right icon-only Close button with `aria-label="Close navigation"` (44×44).
      Files: `src\components\MobileNavDrawer.tsx` (new)
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 6. Create `src\components\Header.tsx` as a `"use client"` sticky glass navigation per design.md "Header anatomy". Root `<header className="sticky top-0 z-50 glass-nav">`; inner `<div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">`. Brand badge is a `<Link href="/">` with `grid place-items-center h-10 w-10 rounded-2xl bg-[var(--green-dark)] text-[var(--lime)] motion-safe:transition-transform motion-safe:hover:rotate-6 motion-safe:animate-glow-pulse`, next to `<div>GreenGap<span className="eyebrow">Urban greening priority</span></div>`. Desktop `<nav className="hidden md:flex">` with links Overview (`/#overview`), Presets (`/#presets`), Methodology (`/#methodology`), Live Analysis (`/explore`); active route (via `usePathname()`) gets `after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:bg-[var(--green)]` + `aria-current="page"`. Right cluster: `<StatusPill />` + a pathname-driven CTA: on `/explore` → `<Link href="/">Change area</Link>`, otherwise → `<Link href="#presets">Jump to presets</Link>` (iteration-1 finding #6). Mobile hamburger: `md:hidden` button, 44×44, `aria-label="Open navigation"` (iteration-2 NIT #12), `aria-expanded={open}`, `aria-controls="mobile-nav"`, toggles a `useState(open, setOpen)` passed into `<MobileNavDrawer open={open} onClose={() => setOpen(false)} />` mounted at the end of the header.
      Files: `src\components\Header.tsx` (new)
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 7. Create `src\components\Footer.tsx` as a server component (no `"use client"`) per design.md "Footer anatomy". Root `<footer role="contentinfo">`. Four-column grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 …`): (1) brand + mission + methodology link; (2) OSM contributors (ODbL) + Nominatim + Overpass attribution; (3) scientific disclaimer; (4) tech-stack badges (`rounded-full border border-[var(--line)] bg-white/60 px-2.5 py-1 text-[11px]` text-only: Next.js 16, React 19, Tailwind v4, Leaflet, Turf.js) + external GitHub repo link with `rel="noopener noreferrer" target="_blank"`. Bottom row on `bg-[var(--green-dark)] text-white/80`.
      Files: `src\components\Footer.tsx` (new)
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 8. Edit `src\app\layout.tsx` to import `Header`, `Footer`, `OsmStatusProvider` and render `<body>…<OsmStatusProvider><Header /><main id="main">{children}</main><Footer /></OsmStatusProvider></body>`. Keep metadata, Geist fonts, and the leaflet CSS import unchanged. Do not add `"use client"` to the layout (server component — the Provider carries the client boundary).
      Files: `src\app\layout.tsx`
      Verify: `npm run typecheck ; npm run lint` pass. Expect a transient second-`<main>` lint/a11y note until Chunks B and C convert the page roots; this is acceptable because `next build` does not fail on it. (Chunk B item 10 and Chunk C item 11 remove the inner `<main>` elements.)

---

## Chunk B — Landing page redesign (`/`)

- [ ] 9. In `src\components\AreaPicker.tsx`, delete the inline `<header className="mb-8 flex items-center justify-between gap-4">…</header>` block entirely (the global `<Header />` now owns the brand + status).
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 10. In `src\components\AreaPicker.tsx`, change the root element from `<main className="mx-auto min-h-screen max-w-[1400px] …">` to `<div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">` so the global `<main id="main">` from `layout.tsx` remains the single landmark (iteration-1 finding #3). Every existing child, state, hook, effect, handler (`useRouter`, `useState<AreaSelection>`, debounced geocode fetch, `jumpTo`, `pickCenter`, `start`, `cellsFor`, `isValidArea`), prop, and import stays verbatim.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass. Dev smoke: landing page renders under the global Header, no console errors.

- [ ] 11. In `src\components\AreaPicker.tsx`, replace the existing `<section className="mb-8 max-w-3xl">…</section>` with the hero `<section id="overview" className="relative isolate overflow-hidden rounded-[32px] hero-gradient px-6 py-14 sm:px-10 sm:py-20 lg:py-24">` from design.md "Landing page redesign" point 2 — includes `.eyebrow` tag "For urban climate resilience", `.editorial-headline` H1 with the color-split span, the **verbatim preserved** body paragraph ("Cities have limited greening budgets. GreenGap scores every 200 m block by green-space scarcity, building density and nearby schools and hospitals, then lets you test where a new green space would help."), and three `FloatingStatPill` chips ("200 m / Spatial grid", "OSM live / Overpass + Nominatim", "Explainable / 50 / 30 / 20 scoring"). Define `FloatingStatPill` inline as a local function with classes `rounded-full border border-white/70 bg-white/70 backdrop-blur px-4 py-2 shadow-[var(--shadow-glass-sm)] motion-safe:animate-float`. Entrance animations: `motion-safe:animate-fade-in` on eyebrow, `motion-safe:animate-slide-up` on H1, `motion-safe:animate-slide-up delay-100` on paragraph, `motion-safe:animate-slide-up delay-200` on pills.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 12. In `src\components\AreaPicker.tsx`, restyle the existing 3-step `<ol>` inline (not a new component — iteration-1 NIT #11). Each `<li>` becomes `rounded-3xl border border-white/80 bg-[var(--panel)] p-5 shadow-[var(--shadow-glass-sm)] motion-safe:transition-all motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--shadow-glass-lg)] motion-safe:animate-slide-up` with staggered `delay-100 / 200 / 300`. Numbered badge gets `motion-safe:animate-glow-pulse`. Steps 2 and 3 add a sibling connector line via `before:absolute before:top-1/2 before:-left-1.5 before:h-px before:w-3 before:bg-[var(--line)]` at `sm:` breakpoint. Step copy unchanged.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 13. In `src\components\AreaPicker.tsx`, add `id="presets"` to the controls panel `<section>` (and ensure the Lahore preset tile grid sits within it). Restyle the preset-tile buttons: each `<button>` keeps its existing `onClick={() => jumpTo(preset.area.center, preset.name)}` and `aria-pressed={active}` but adds `data-active={active}` attribute (iteration-3 NIT #7) and swaps the active-state classes to `data-[active=true]:ring-2 data-[active=true]:ring-[var(--green)] data-[active=true]:ring-offset-2 data-[active=true]:bg-white data-[active=true]:shadow-sm` with `motion-safe:transition-all motion-safe:hover:-translate-y-0.5`. The micro-badge `preset.detail` text already renders — keep it.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 14. In `src\components\AreaPicker.tsx`, replace the existing size-selector `<div role="group" aria-label="Study area size">` block with `<SegmentedControl value={area.sizeKm} options={AREA_SIZE_OPTIONS} onChange={(v) => setArea((prev) => ({ ...prev, sizeKm: v }))} ariaLabel="Study area size" renderOption={(v) => \`${v} × ${v} km\`} />`. Preserve the `AREA_SIZE_OPTIONS` import from `@/lib/area`. The informational paragraph (`{cells} cells of {GRID_CELL_SIZE_METERS} m…`) stays as-is immediately below.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; the three options still invoke `setArea` producing exactly `{sizeKm: 1|2|3}`.

- [ ] 15. In `src\components\AreaPicker.tsx`, enhance the search input region (do not change the `useEffect` debounce or `/api/geocode` fetch): add a Clear button (`×`) when `query.length > 0` with `aria-label="Clear search"` that calls `setQuery("")` (`min-h-11 min-w-11` touch target); render an inline spinner (`motion-safe:animate-spin`) inside the input while `searchState === "searching"`; add `motion-safe:animate-slide-down` to the hits `<ul>` and keyboard navigation (`ArrowDown` / `ArrowUp` / `Enter`) via a `useRef<HTMLUListElement>` and `onKeyDown` on both the input and the hit `<li>` buttons that moves native DOM focus — no new state. Each hit button keeps its existing `onClick={() => jumpTo([hit.lng, hit.lat], name)}`.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 16. In `src\components\AreaPicker.tsx`, restyle the Ready-to-analyse CTA card: wrap in `rounded-3xl bg-[var(--green-dark)] p-5 text-white motion-safe:animate-glow-pulse group`; the submit button adds `motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5` on the `→` glyph. `onClick={start}` and `disabled={starting}` and spinner remain exactly as-is.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; clicking Analyse still calls `router.push('/explore?lat=…&lng=…&size=…&label=…')` with on-wire `size` (iteration-3 NIT #3).

- [ ] 17. In `src\components\AreaPicker.tsx`, upgrade the map section wrapper to `rounded-[32px] border border-white/80 bg-white shadow-[var(--shadow-glass-lg)]`. Restyle the floating instruction pill ("⌖ Click anywhere to centre the square here") with `.glass-panel` chrome + `motion-safe:animate-fade-in`.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 18. In `src\components\AreaPicker.tsx`, insert a `<section id="methodology">` card above the closing root `</div>` containing a verbatim two-paragraph methodology explainer: paragraph 1 covers the 50 / 30 / 20 weights (green-space scarcity / building density / nearby schools and hospitals) referenced from `src\lib\scoring.ts` (do **not** import or edit `scoring.ts`; the text is descriptive only). Paragraph 2 covers the 150 m scenario tool with a planting-suitability disclaimer that the score reflects mapped features to guide site investigation, not civil engineering approval (iteration-3 NIT #8). Style the card with `rounded-[28px] glass-panel p-6 motion-safe:animate-slide-up`.
      Files: `src\components\AreaPicker.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 19. Edit `src\components\AreaPickerMap.tsx` only to add a sibling overlay inside the outer `<div>`: `<div className="pointer-events-none absolute inset-0 rounded-[inherit] z-[400]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.6)" }} aria-hidden="true" />` and set the outer `<div>`'s classes to include `rounded-[inherit] overflow-hidden`. Props (`area`, `onPickCenter`, `recenterKey`), Leaflet config, `MapContainer`, `TileLayer`, `Rectangle`, `ClickToPick`, `FitSelection`, `ZoomControl` — all unchanged.
      Files: `src\components\AreaPickerMap.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; clicking the map still centers the study square.

---

## Chunk C — Explore dashboard redesign (`/explore`, desktop first)

- [ ] 20. In `src\components\Dashboard.tsx`, expand the React import list to include `useRef, useSyncExternalStore` and import `useOsmStatus` from `@/components/OsmStatusContext` (iteration-3 NIT #6 import-diff). Preserve every existing state hook (`reloadKey`, `layersOn`, `result`, `progress`, `elapsed`, `selection`), every memo (`bbox`, `query`, `requestKey`, `load`, `loadProgress`, `elapsedSeconds`, `features`, `scoredFeatures`, `scoring`, `layers`, `ranking`), the streaming `useEffect`, and every callback (`selectCell`, `toggleProposal`, `clearProposal`, `retry`). Add a module-scope `useIsDesktop` hook per iteration-3 NIT #5: declare `subscribe` and `getSnapshot` at module scope so `window.matchMedia("(min-width: 768px)")` is bound once, not on every render. `getServerSnap = () => true` (desktop SSR default). The hook returns `useSyncExternalStore(subscribe, getSnapshot, getServerSnap)`.
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 21. In `src\components\Dashboard.tsx`, add two new states: `const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);` (iteration-1 finding #2) and destructure `const { set: setOsmStatus } = useOsmStatus();`. Add the writer effect: `useEffect(() => { if (load.status === "error") setOsmStatus("error"); else if (load.status === "loading" || scoring) setOsmStatus("streaming"); else setOsmStatus("ready"); }, [load.status, scoring, setOsmStatus]);` and the unmount reset: `useEffect(() => () => setOsmStatus("idle"), [setOsmStatus]);` (iteration-1 finding #14).
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; navigating `/` → `/explore` → `/` shows the pill return to idle.

- [ ] 22. In `src\components\Dashboard.tsx`, replace the inline `<header className="mb-5 flex flex-col gap-4 rounded-[28px] …">` block with a compact page-summary row: `<div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow text-[var(--green)]">Greening priorities</p><h1 className="editorial-headline text-2xl text-[var(--green-dark)] sm:text-3xl truncate max-w-[40ch]">{label}</h1><p className="mt-0.5 text-sm text-[var(--muted)]">{area.sizeKm} × {area.sizeKm} km · {formatCenter(area.center)}</p></div></div>`. The "Change area" CTA is now owned by `<Header />`.
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 23. In `src\components\Dashboard.tsx`, change the root element from `<main className="mx-auto …">` to `<div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">` (iteration-1 finding #3).
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 24. In `src\components\Dashboard.tsx`, update the `Skeleton` helper to `return <span className={\`block rounded-lg bg-[#e3eadf] animate-shimmer ${className}\`} aria-hidden="true" />;` so under `prefers-reduced-motion: reduce` the Tailwind `#e3eadf` background still paints a solid block while under `no-preference` the gated `.animate-shimmer` gradient overrides it (iteration-2 HIGH #1 / iteration-1 NIT #9).
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 25. In `src\components\Dashboard.tsx`, restyle the metric cards: wrap each with `rounded-3xl bg-[var(--color-surface-glass)] backdrop-blur border border-[var(--line)] shadow-[var(--shadow-glass-md)] relative overflow-hidden before:absolute before:inset-y-4 before:left-0 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-[var(--green)] before:to-[var(--lime)] motion-safe:animate-slide-up`, staggered via `delay-100 / 200 / 300 / 400`. Inline 20 px SVG icon per card (trees / grid / pin). Keep every data expression (`metric.value`, `metric.detail`, `top`, `priorityBand(top.priority).color`, `scoredCount`, `schools`, `hospitals`) and the top-priority button's `onClick={() => selectCell(top.id)}` verbatim. Add `motion-safe:animate-pop-in` keyed on `top?.id` for the top-priority score chip when `top` first exists.
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 26. In `src\components\Dashboard.tsx`, extract the layer-toggle chip row into an inline `<LayerDock mode="floating" | "strip" />` sub-component colocated in the same file (not a new file). `mode="floating"` renders `absolute top-4 right-4 z-[500]` with each row as a 36×20 toggle switch (`role="switch" aria-checked={on}`) + swatch + label; `mode="strip"` renders the current horizontal chip bar with `min-h-11` touch targets. Keep the `LAYER_TOGGLES` constant, `layersOn` state, `setLayersOn` setter, `disabled={!ready}` and `aria-pressed` semantics verbatim. On desktop, use `mode="floating"` positioned inside the map `<section>`; on narrow screens the strip is used in Chunk D.
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; toggling any layer still mutates `layersOn`.

- [ ] 27. In `src\components\Dashboard.tsx`, upgrade the map `<section>` chrome to `rounded-[32px] border border-white/80 bg-white shadow-[var(--shadow-glass-lg)] overflow-hidden`. In the error branch, make the panel `glass-panel` over `bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.08),transparent_60%)]`. Keep the "Try again" / "Pick another area" copy and handlers.
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; error path still renders and `retry` still bumps `reloadKey`.

- [ ] 28. In `src\components\Dashboard.tsx`, trim the inline `<footer className="mt-3 …">` block to drop the `© OpenStreetMap contributors` phrase (now owned by the global `<Footer />`, iteration-1 finding #16); render only `metadata.source`, fetched timestamp, and the `ranking.notes` list inside a thin `glass-panel` card. The `<aside>` on desktop keeps `md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto`. Pass new props to `<PriorityPanel>`: `hoveredCellId={hoveredCellId}` and `onHoverCell={setHoveredCellId}`.
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 29. Edit `src\components\MapView.tsx`. Expand the React import list to `useDeferredValue, useEffect, useMemo, useState` (iteration-2 NIT #7). Add `hoveredCellId?: string | null;` to `MapViewProps`. Add a module-level constant `const PRIORITY_CHROME_HEX = { critical: "#c62f2f", moderate: "#f2a93b", lower: "#7fb87f" } as const;` and a helper `function groupedChrome(level: PriorityLevel): string | null` returning the critical hex for `very-high | high`, moderate for `moderate`, lower for `low | very-low`, `null` for `unscored` (iteration-1 finding #13). Render a single additional dashed outline `<Polygon>` wrapped in a `useMemo` + `useDeferredValue` on `hoveredCellId`, only when `hoveredCell && hoveredCell.id !== selectedCellId`, with `pathOptions={{ color: groupedChrome(hoveredCell.priority) ?? "#123e2a", weight: 2, dashArray: "4 4", fill: false, interactive: false }}`. Restyle the hint pill (add `rounded-2xl shadow-[var(--shadow-glass-lg)] motion-safe:animate-fade-in`) and the legend dock (apply `glass-panel rounded-2xl shadow-[var(--shadow-glass-md)]`). Every existing handler, `PanToSelection`, polygon click, tooltip, scenario rendering, facility marker, zoom control is preserved verbatim.
      Files: `src\components\MapView.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; cell click still calls `onSelectCell(cell.id)`; the hovered polygon is non-interactive.

- [ ] 30. Edit `src\components\MapShell.tsx` to update only the dynamic-import `loading` fallback element to `<div className="map-loading-backdrop grid h-[520px] place-items-center text-sm font-medium text-[var(--muted)] rounded-[inherit] lg:h-[600px]">Drawing the priority map…</div>`. The dynamic import, prop forwarding, and SSR flag remain unchanged — the new `hoveredCellId` prop threads automatically through `MapViewProps`.
      Files: `src\components\MapShell.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 31. Edit `src\components\PriorityPanel.tsx` to add two optional props: `hoveredCellId?: string | null;` and `onHoverCell?: (id: string | null) => void;`. Each row calls `onHoverCell?.(cell.id)` on `onMouseEnter` / `onFocus` and `onHoverCell?.(null)` on `onMouseLeave` / `onBlur` (iteration-1 finding #2). Add a 4-px left accent bar colored by priority (`.accent-bar-critical` for very-high/high, `.accent-bar-moderate` for moderate, `.accent-bar-lower` for low/very-low; unscored → no bar). The authoritative band color on each row's score chip still comes from `priorityBand(cell.priority).color` — do not substitute. Add a filter/sort toolbar above the `<ol>` using two `<SegmentedControl>` instances: filter `["all", "critical", "moderate"]` (default `"all"`), sort `["rank", "score"]` (default `"rank"`). Apply the filter and sort via a local `useMemo` over the already-ranked `cells` prop; the `limit` prop still caps display. Make the `<ol>` wrapper `overflow-y-auto max-h-[32rem] scroll-smooth motion-reduce:scroll-auto`. Row entrance uses `motion-safe:animate-slide-up` with `style={{ animationDelay: \`${index * 40}ms\` }}`.
      Files: `src\components\PriorityPanel.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; default filter + sort yields the same ordered list as today when `limit=8`.

- [ ] 32. Edit `src\components\LoadingSteps.tsx` — logic preserved (`applyStreamEvent`, `INITIAL_PROGRESS`, `stepsFor`, `StepIcon`, `active` derivation, `aria-live` region). Add `motion-safe:animate-slide-up` and `shadow-[var(--shadow-glass-xl)]` to the outer card. Add a sheen overlay on top of the progress-line fill using `after:absolute after:inset-0 after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)] motion-safe:after:animate-sheen`. Add `motion-safe:animate-pulse-dot` on the leading dot inside the elapsed-timer pill.
      Files: `src\components\LoadingSteps.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 33. Edit `src\components\ZoneDetails.tsx` — logic preserved (`cell`, `scoredCells`, `weights`, `onSelectTop`, `isProposed`, `onToggleProposal`, `rawLabel`, `COMPONENT_LABELS`, `priorityBand`, `SCENARIO_RADIUS_METERS`, `FACILITY_RADIUS_METERS`). Replace the existing `h-14 w-14` score square with an inline `<svg viewBox="0 0 36 36">` radial meter: track circle `stroke-[#e7ece1]`, foreground arc with `stroke-dasharray` = circumference and `stroke-dashoffset` = `(100 - cell.score) / 100 * circumference`, arc color = `priorityBand(cell.priority).color`, centered `<text>` for the score. Unscored → dash. Change component bars (keep `role="meter"` and all `aria-*`) to a gradient fill `bg-gradient-to-r from-[var(--green)] to-[var(--lime)]` over a `bg-[#e7ece1]/60 backdrop-blur-sm` track. Make the "Propose a 150 m greening cluster here" CTA prominent with a `before:` pseudo-element running `motion-safe:animate-sheen` on hover. Keep `aria-pressed={isProposed}` and the toggle label swap. Entrance: `motion-safe:animate-fade-in` on the whole section.
      Files: `src\components\ZoneDetails.tsx`
      Verify: `npm run typecheck ; npm run lint` pass; the Propose button still calls `onToggleProposal`.

- [ ] 34. Edit `src\components\ImpactComparison.tsx` — logic preserved (`scenario`, `cellId`, `facilities`, `onClear`, `limit=6`, the `useEffect` with reduced-motion `scrollIntoView`, `BEFORE_COLOR` / `AFTER_COLOR`, `percent`, `cellChanges.slice(0, limit)`, the `reached` filter). Each of the three summary stat tiles gets a thin gradient accent and `motion-safe:animate-pop-in` keyed on `cellId`. Dumbbell chart entries stagger with inline `style={{ animationDelay: \`${i * 60}ms\` }}` and `motion-safe:animate-slide-up`. Swap the Clear button to an icon-button variant (× glyph + "Clear" text) at the top-right.
      Files: `src\components\ImpactComparison.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 35. Edit `src\components\ExploreGuide.tsx` — logic preserved (`steps` derivation from `hasSelection` / `hasProposal`, `current` index, `SCENARIO_RADIUS_METERS` reference). Replace the solid dark card with `rounded-[28px] bg-gradient-to-br from-[var(--green-dark)] to-[#0b2a1b] text-white shadow-[var(--shadow-glass-xl)]`. Apply `.animate-gradient-shift` to a `::before` background mask. Each `<li>` keeps its `aria-current` semantics.
      Files: `src\components\ExploreGuide.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

---

## Chunk D — Mobile responsive (<768 px)

- [ ] 36. Create `src\components\MobileExploreTabs.tsx` as a `"use client"` component with props `{ mapSlot, prioritySlot, inspectorSlot, selectedCell, scenario, requestKey, counts }`. Own `useState<"map"|"priority"|"inspector">("map")`. Markup per design.md "MobileExploreTabs.tsx": the single mounted `<div role="tabpanel" id={\`panel-${active}\`} aria-labelledby={\`tab-${active}\`} key={active} className="motion-safe:animate-fade-in">` renders `{active === "map" && mapSlot}` / `{active === "priority" && prioritySlot}` / `{active === "inspector" && inspectorSlot}` — exactly one branch at a time so `mapSlot`'s `MapContainer` is single-mount. Sticky bottom `<nav role="tablist" aria-label="Dashboard view" className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--line)] bg-[var(--color-surface-glass)] backdrop-blur-md shadow-[0_-8px_24px_rgba(39,65,43,0.08)]">`. Each tab button is `<button type="button" role="tab" id={\`tab-${id}\`} {...(isActive ? { "aria-controls": \`panel-${id}\` } : {})} aria-selected={isActive} tabIndex={isActive ? 0 : -1} onClick={() => setActive(id)} className="min-h-11 min-w-11 flex-1 …">` — `aria-controls` on the active tab only (iteration-3 MEDIUM #2 Option A); roving tabindex (active 0, inactive -1). Keyboard: ArrowLeft/ArrowRight cycle, Home/End jump, Enter/Space activate. Content wrapper is `pb-20` so the sticky bar never covers content.
      Files: `src\components\MobileExploreTabs.tsx` (new)
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 37. In `src\components\MobileExploreTabs.tsx`, add two independent auto-switch latches (iteration-1 finding #8): `didAutoSwitchOnSelectRef` and `didAutoSwitchOnProposeRef`. Reset both to `false` in a `useEffect` keyed on `requestKey`. One effect gated on `selectedCell` sets active = `"inspector"` the first time per request-key when `selectedCell` becomes truthy; a parallel effect gated on `scenario` does the same for first proposal.
      Files: `src\components\MobileExploreTabs.tsx`
      Verify: `npm run typecheck ; npm run lint` pass.

- [ ] 38. In `src\components\Dashboard.tsx`, extract the three dashboard regions into local variables `mapCard`, `inspectorStack`, `priorityCard` (using the existing hooks and derived values) per design.md "Mobile responsive strategy" code block. Compute `const isDesktop = useIsDesktop();`. Render exactly one subtree: when `isDesktop` render the existing `<section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">…</section>` with `mapCard` on the left and the `<aside>` on the right (inspectorStack above `priorityCard`); otherwise render `<MobileExploreTabs mapSlot={mapCard} prioritySlot={priorityCard} inspectorSlot={inspectorStack} selectedCell={selectedCell} scenario={scenario} requestKey={requestKey} counts={{ cells: cells.length, scored: scoredCount, hasInspector: Boolean(selectedCell) }} />`. Never render both subtrees simultaneously (iteration-1 finding #1).
      Files: `src\components\Dashboard.tsx`
      Verify: `npm run typecheck ; npm run lint` pass. Dev smoke at viewport width 375 px shows the tab bar; at 1280 px shows the desktop grid; resizing across 768 px flips the layout cleanly without duplicate `MapContainer` mounts.

---

## Chunk E — Final verification

- [ ] 39. Run the full project verification from the repo root: `cd "c:\Users\Daniyal\Desktop\New folder\Alethiea" ; npm run typecheck ; npm run lint ; npm run build`. All three must succeed with no new warnings. Then execute DESIGN.md § 4.4 functional checklist in a browser at 375 / 768 / 1440 px: landing search returns hits and updates bbox; preset buttons change location; size selector produces `size=1|2|3` on-wire; `Analyse this area` navigates to `/explore?lat=…&lng=…&size=…&label=…`; explore streams data, StatusPill transitions `streaming → ready`, cell click opens the inspector, Propose 150 m creates a scenario, ImpactComparison renders, mobile drawer traps focus and closes on Esc, mobile tabs auto-switch to Inspector exactly once per area on first selection and once on first proposal.
      Files: none (verification only)
      Verify: all three npm commands exit 0; manual functional checklist all green.

---

## Preservation audit (run before signing off)

- [ ] 40. Confirm **zero** modifications (no formatting, no imports, no whitespace) to each off-limits file by inspecting `git diff` for each path listed at the top of this plan.
      Files: `src\lib\scoring.ts`, `src\lib\scenario.ts`, `src\lib\area.ts`, `src\lib\areaCache.ts`, `src\lib\geoUtils.ts`, `src\lib\osm.ts`, `src\lib\osm.ts`, `src\types\index.ts`, `src\app\api\area\route.ts`, `src\app\api\geocode\route.ts`
      Verify: `cd "c:\Users\Daniyal\Desktop\New folder\Alethiea" ; git diff --stat src\lib src\types src\app\api` reports no changes to any of those paths.
