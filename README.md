# GreenGap

GreenGap is an explainable urban-greening prioritization tool. It helps planners identify neighborhoods that appear underserved by parks and greenery, understand why a zone ranks highly, and decide where further site-level investigation should begin.

The application works with any configurable pilot area. The current workflow divides an approximately 2 × 2 km study area into roughly 200 m grid cells and ranks them using real OpenStreetMap data.

## Problem we address

Cities often have limited greening budgets and incomplete information about where new parks, trees, or small green interventions could be most valuable. Existing maps show individual features, but they do not clearly answer:

- Which parts of a neighborhood have the poorest access to mapped greenery?
- Which underserved zones also contain concentrated development?
- Which zones are close to schools and hospitals?
- Why does one zone rank above another?

GreenGap turns available geographic data into a transparent priority map. It is intended to guide investigation, not automatically approve a planting location.

## How it works

### 1. Collect local map data

The extraction script queries the OpenStreetMap Overpass API for the configured bounding box. It collects:

- Parks and gardens
- Building footprints
- Schools, colleges, and universities
- Hospitals and clinics

Dense building requests are divided into smaller tiles to reduce public API timeouts. The responses are converted into a local GeoJSON feature collection, deduplicated, and saved under `public/data/`.

The deployed application reads this local dataset instead of contacting Overpass from every visitor's browser. This makes the experience faster, reproducible, and suitable for static deployment.

### 2. Generate the analysis grid

The configured study area is divided into approximately 200 × 200 metre cells. Each cell receives a stable identifier such as `A-01`, `A-02`, or `B-01`.

### 3. Measure each cell

GreenGap calculates three measurements for every cell:

| Factor | Raw measurement | Weight |
|---|---|---:|
| Green-space scarcity | Distance from the cell centre to the nearest mapped park or garden | 50% |
| Building concentration | Number of mapped building centres inside the cell | 30% |
| Vulnerable facilities | Schools and hospitals within 400 m of the cell centre | 20% |

Each measurement is normalized from 0 to 100 relative to the other cells in the same pilot area.

```text
priority score =
  green-space scarcity × 0.50
  + building concentration × 0.30
  + nearby facilities × 0.20
```

If an entire factor is missing from the source data, GreenGap removes that factor and transparently rebalances the remaining weights.

### 4. Explain the ranking

The application sorts cells from highest to lowest priority and displays:

- A colored priority grid
- Existing green spaces and mapped buildings
- Schools and hospitals
- A ranked list of cells
- The selected cell's score and rank
- Component scores and raw measurements
- A short explanation of the main reasons behind the score

## What has been solved

- A configurable geographic pilot area
- Automated OpenStreetMap extraction with API fallbacks
- Local GeoJSON generation and provenance metadata
- Approximately 200 m grid generation
- Normalized and weighted priority scoring
- Missing-data reweighting
- Priority color bands and rankings
- Interactive map layers
- Cell selection and score explanations
- Responsive dashboard layout
- Static production builds suitable for Vercel
- Continuous integration for type-checking, linting, and builds

## Planned greening scenario

The next feature will let a user place a hypothetical greening cluster inside a selected cell. GreenGap will draw a 150 m illustrative radius and report:

- Grid cells intersecting the proposed coverage area
- Schools and hospitals within the radius
- A before-and-after planning summary

This scenario will represent geographic reach only. It will not claim that land is plantable, publicly accessible, approved for development, or guaranteed to produce a measured cooling effect.

## Configure another area

To analyze a different neighborhood:

1. Choose an approximately 2 × 2 km bounding box.
2. Update `PILOT_CENTER` and `PILOT_BBOX` in `src/lib/geoUtils.ts`.
3. Update the extraction `BBOX` in `scripts/fetch-osm.mjs`.
4. Update any user-facing location label.
5. Generate a fresh dataset:

```powershell
npm run data:fetch
```

The grid and rankings are recalculated automatically when the application loads the new data.

## Local setup

Requires Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```powershell
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
public/data/          Extracted local GeoJSON dataset
scripts/              OpenStreetMap extraction tools
src/app/              Next.js routes, metadata, and global styles
src/components/       Dashboard, map, rankings, and zone details
src/lib/              Grid, geometry, scoring, and scenario logic
src/types/            Shared geographic data contracts
```

## Important limitations

- OpenStreetMap coverage can be incomplete or uneven.
- Building footprints are not a measurement of population.
- A high-priority cell is a recommendation for further investigation, not proof that planting is feasible.
- Scoring weights are transparent MVP assumptions, not empirically calibrated policy values.
- Site ownership, utilities, soil conditions, accessibility, and legal permissions require separate assessment.

See [GreenGap_Hackathon_Plan.md](./GreenGap_Hackathon_Plan.md) for the original MVP milestones and release plan.
