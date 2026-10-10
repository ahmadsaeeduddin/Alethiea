# GreenGap — Hackathon Build Plan

**Track:** Climate & Sustainability  
**Team:** Saeed, Saad, Muneeb, Daniyal  
**Timebox:** 150 minutes · 2 sprints  
**Stack:** Next.js (App Router), TypeScript, Tailwind CSS, React Leaflet, Turf.js  
**Data:** OpenStreetMap via Overpass Turbo → local GeoJSON  
**Launch sequence:** **Local first → tested MVP → Vercel deployment**

## 1. What we are building

**Problem:** Cities have limited greening budgets but lack a clear way to find neighborhoods most underserved by parks and greenery.

**GreenGap** is an interactive map for a **small ~2 km × 2 km Lahore pilot area**. It will:

1. Display existing mapped parks, gardens, buildings, schools, and hospitals.
2. Divide the study area into ~200 m grid cells and rank cells by need for greening.
3. Explain *why* a selected zone has its priority score.
4. Let a user propose a **hypothetical** greening cluster and view nearby cells/facilities within a 150 m planning radius.


## 3. Sprint 1 — Local Core MVP (minutes 0–75)

| Time | Milestone | Deliverable |
|---|---|---|
| **0–20 min** | **v0.1 — Local foundation** | Next.js runs on localhost; Lahore map visible; basic dashboard shell |
| **20–55 min** | **v0.5 — Local data + logic** | Saad's GeoJSON loads; parks/facilities show; Muneeb's scoring produces grid cell results |
| **55–75 min** | **v1.0 — Local MVP** | Priority heat grid, ranked cells, click-to-inspect zone details all work together |

**Sprint 1 done when:** A teammate can open the **local app**, see real Lahore geographic data, select a grid cell, and understand its rank. **Do not deploy before this milestone unless everything already works.**

## 4. Sprint 2 — Local Scenario → Production (minutes 75–150)

| Time | Milestone | Deliverable |
|---|---|---|
| **75–105 min** | **v1.5 — Local simulation** | Select priority cell → add hypothetical greening cluster → show 150 m coverage and nearby affected cells/facilities |
| **105–120 min** | **v2.0 — Local release candidate** | Before/after scenario panel, source labels, UX polish; verify no broken interactions |
| **120–135 min** | **v2.0 — Vercel production** | Merge stable `main`, deploy on Vercel, test public URL on another device |
| **135–150 min** | **Final freeze + pitch** | Fix only critical issues; rehearse a 2-minute demo; save screenshots as fallback |

**Sprint 2 done when:** The **deployed URL** reliably demonstrates the problem, scoring, proposed intervention, and its *hypothetical* geographic reach.

## 5. Project structure (main reference)

```text
greengap/
├── public/
│   └── data/
│       └── lahore.geojson          # Saad: cleaned OSM features
├── src/
│   ├── app/
│   │   ├── page.tsx                # Saeed: app composition
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── MapShell.tsx            # Saeed: client-side dynamic map import
│   │   ├── MapView.tsx             # Saeed: map and overlays
│   │   ├── Dashboard.tsx           # Daniyal: metrics / layout
│   │   ├── PriorityPanel.tsx       # Daniyal: ranked cells
│   │   └── ImpactComparison.tsx    # Daniyal: scenario summary
│   ├── lib/
│   │   ├── scoring.ts              # Muneeb: normalized priority scores
│   │   ├── geoUtils.ts             # Muneeb: geometry and grid
│   │   └── scenario.ts             # Muneeb: intervention coverage
│   └── types/
│       └── index.ts                # Shared: agreed data contracts
├── package.json
└── README.md
```

**Data contract:** GeoJSON features have a stable `id`, `geometry`, and `category` (`park`, `garden`, `building`, `school`, `hospital`). Ranked cells return `id`, `geometry`, `score` (0–100), component scores, and a short `reason`. Scenario output includes covered cell IDs, covered facility IDs, and illustrative coverage geometry.

## 6. Scoring and scenario rules

| Factor | Weight | Interpretation |
|---|---:|---|
| Green-space scarcity | 50% | Farther from mapped parks/gardens → higher need |
| Building concentration | 30% | More mapped buildings → higher score |
| Nearby schools/hospitals | 20% | More nearby vulnerable facilities → higher score |

Normalize each factor to **0–100**, then calculate the weighted score. These weights are **MVP assumptions**; building footprints do **not** equal population. If building data is incomplete, remove that factor and reweight transparently.

**Scenario:** Proposal point → 150 m illustrative radius → count covered grid cells and mapped facilities. This is **not** verified plantable land, public access, a measured cooling effect, or a claim about future tree survival.

## 7. Setup and releases

### Local setup — first

```bash
npx create-next-app@latest greengap --typescript --tailwind --eslint --app --src-dir --use-npm
cd greengap
npm install leaflet react-leaflet @types/leaflet @turf/turf
npm run dev
```

Open `http://localhost:3000`. **Leaflet must be client-side**: load `MapView` inside a `"use client"` `MapShell` via `next/dynamic` with `ssr: false`; provide an explicit map height.

### Deploy only after local v2.0 passes

1. Commit and merge stable work into `main` on GitHub.
2. Import the GitHub repository in **Vercel** (Next.js auto-detected; use Hobby tier for an eligible non-commercial hackathon project).
3. Deploy, then test the **public URL**: map tiles, GeoJSON load, rankings, scenario, mobile/desktop layout.
4. If v2.0 has blockers, **deploy the working v1.0 MVP** rather than risk an empty demo.

## 8. Final demo (2 minutes)

1. **Problem (20s):** Show that some mapped neighborhoods have poorer access to greenery.
2. **Priorities (40s):** Select a red/high-priority grid cell and explain its score.
3. **Action (40s):** Propose greening, show coverage radius and affected cells/facilities.
4. **Value (20s):** GreenGap helps planners **prioritize where to investigate planting**, before site-level feasibility checks.

**Golden rule:** **Real data + working local product → one stable Vercel release.** Skip optional features before compromising the core demo.
