# GreenGap

GreenGap is a climate-planning prototype that highlights Lahore neighborhoods that may be underserved by parks and greenery. The current v0.1 foundation includes a responsive dashboard shell and a Leaflet map centered on the Lahore pilot area.

## Local setup

Requires Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```powershell
npm run lint
npm run typecheck
npm run build
```

## Project structure

```text
public/data/          Local GeoJSON datasets
src/app/             Next.js App Router pages and global styles
src/components/      Map and dashboard UI
src/lib/             Scoring, geometry, and scenario logic
src/types/           Shared data contracts
```

See [GreenGap_Hackathon_Plan.md](./GreenGap_Hackathon_Plan.md) for the complete MVP plan, assumptions, and release sequence.
