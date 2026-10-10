import { booleanIntersects, distance, pointToPolygonDistance } from "@turf/turf";
import type { MultiPolygon, Polygon } from "geojson";
import { cellBounds, createGrid, featureCenter, splitFeatures } from "@/lib/geoUtils";
import type {
  CellMetrics,
  GridCell,
  MapFeature,
  RankedCell,
  RankingResult,
  ScoreComponents,
  ScoreWeights,
} from "@/types";

/** MVP assumptions from the plan — not empirically calibrated. */
export const BASE_WEIGHTS: ScoreWeights = {
  greenScarcity: 0.5,
  buildingConcentration: 0.3,
  vulnerableFacilities: 0.2,
};

/** Schools/hospitals within this distance of a cell centre count as "nearby". */
export const FACILITY_RADIUS_METERS = 400;

export const COMPONENT_LABELS: Record<keyof ScoreComponents, string> = {
  greenScarcity: "Green-space scarcity",
  buildingConcentration: "Building concentration",
  vulnerableFacilities: "Nearby schools & hospitals",
};

export function calculatePriorityScore(components: ScoreComponents, weights: ScoreWeights = BASE_WEIGHTS): number {
  const score =
    components.greenScarcity * weights.greenScarcity +
    components.buildingConcentration * weights.buildingConcentration +
    components.vulnerableFacilities * weights.vulnerableFacilities;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/** Min–max normalise to 0–100. A flat factor (no variation) scores 0 everywhere. */
function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return values.map(() => 0);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

function isAreal(geometry: MapFeature["geometry"]): geometry is Polygon | MultiPolygon {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
}

function measureCell(
  cell: GridCell,
  green: MapFeature[],
  buildingCenters: [number, number][],
  facilityCenters: [number, number][],
): CellMetrics {
  let nearestGreenMeters = Number.POSITIVE_INFINITY;
  for (const g of green) {
    if (booleanIntersects(cell.geometry, g.geometry)) {
      nearestGreenMeters = 0;
      break;
    }
    const d = isAreal(g.geometry)
      ? pointToPolygonDistance(cell.center, g.geometry, { units: "meters" })
      : distance(cell.center, featureCenter(g.geometry), { units: "meters" });
    nearestGreenMeters = Math.min(nearestGreenMeters, Math.max(0, d));
  }

  const [minX, minY, maxX, maxY] = cellBounds(cell);
  const buildingCount = buildingCenters.filter(([x, y]) => x >= minX && x < maxX && y >= minY && y < maxY).length;

  const facilityCount = facilityCenters.filter(
    (p) => distance(cell.center, p, { units: "meters" }) <= FACILITY_RADIUS_METERS,
  ).length;

  return { nearestGreenMeters, buildingCount, facilityCount };
}

function describe(components: ScoreComponents, metrics: CellMetrics, weights: ScoreWeights): string {
  const contributions = (Object.keys(components) as (keyof ScoreComponents)[])
    .filter((k) => weights[k] > 0)
    .map((k) => ({ key: k, value: components[k] * weights[k], raw: components[k] }))
    .sort((a, b) => b.value - a.value);

  const lead = contributions[0];
  const headline =
    !lead || lead.raw < 50
      ? "Lower relative need"
      : {
          greenScarcity: "Far from mapped green space",
          buildingConcentration: "Dense mapped building cover",
          vulnerableFacilities: "Close to schools/hospitals",
        }[lead.key];

  const green =
    metrics.nearestGreenMeters === 0
      ? "touches a mapped park"
      : Number.isFinite(metrics.nearestGreenMeters)
        ? `nearest park ${Math.round(metrics.nearestGreenMeters / 10) * 10} m`
        : "no mapped parks";
  const buildings = `${metrics.buildingCount} mapped building${metrics.buildingCount === 1 ? "" : "s"}`;
  const facilities = `${metrics.facilityCount} school/hospital${metrics.facilityCount === 1 ? "" : "s"} within ${FACILITY_RADIUS_METERS} m`;

  return `${headline}: ${green}, ${buildings}, ${facilities}.`;
}

/**
 * Splits the pilot area into ~200 m cells and ranks them by greening need.
 * Factors with no mapped data are dropped and the remaining weights re-normalised.
 */
export function rankCells(features: MapFeature[], grid: GridCell[] = createGrid()): RankingResult {
  const { green, buildings, facilities } = splitFeatures(features);
  const buildingCenters = buildings.map((f) => featureCenter(f.geometry));
  const facilityCenters = facilities.map((f) => featureCenter(f.geometry));

  const metrics = grid.map((cell) => measureCell(cell, green, buildingCenters, facilityCenters));

  const notes: string[] = [];
  const weights: ScoreWeights = { ...BASE_WEIGHTS };
  if (green.length === 0) {
    weights.greenScarcity = 0;
    notes.push("No parks or gardens are mapped here, so green-space scarcity was excluded.");
  }
  if (buildings.length === 0) {
    weights.buildingConcentration = 0;
    notes.push("No buildings are mapped here, so building concentration was excluded.");
  }
  if (facilities.length === 0) {
    weights.vulnerableFacilities = 0;
    notes.push("No schools or hospitals are mapped here, so that factor was excluded.");
  }
  const total = weights.greenScarcity + weights.buildingConcentration + weights.vulnerableFacilities;
  if (total > 0 && total < 1) {
    weights.greenScarcity /= total;
    weights.buildingConcentration /= total;
    weights.vulnerableFacilities /= total;
  }

  const finiteMax = Math.max(0, ...metrics.map((m) => m.nearestGreenMeters).filter(Number.isFinite));
  const scarcity = normalize(metrics.map((m) => (Number.isFinite(m.nearestGreenMeters) ? m.nearestGreenMeters : finiteMax)));
  const density = normalize(metrics.map((m) => m.buildingCount));
  const vulnerable = normalize(metrics.map((m) => m.facilityCount));

  const cells = grid.map((cell, i): Omit<RankedCell, "rank"> => {
    const components: ScoreComponents = {
      greenScarcity: Math.round(scarcity[i]),
      buildingConcentration: Math.round(density[i]),
      vulnerableFacilities: Math.round(vulnerable[i]),
    };
    return {
      id: cell.id,
      geometry: cell.geometry,
      center: cell.center,
      components,
      metrics: metrics[i],
      score: calculatePriorityScore(components, weights),
      reason: describe(components, metrics[i], weights),
    };
  });

  const ranked = cells
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.components.greenScarcity - a.components.greenScarcity ||
        a.id.localeCompare(b.id),
    )
    .map((cell, index) => ({ ...cell, rank: index + 1 }));

  return { cells: ranked, weights, notes };
}

export interface ScoreBand {
  min: number;
  label: string;
  color: string;
}

/** Ordered high → low. */
export const SCORE_BANDS: ScoreBand[] = [
  { min: 80, label: "Very high", color: "#c62f2f" },
  { min: 60, label: "High", color: "#e8692f" },
  { min: 40, label: "Moderate", color: "#f2a93b" },
  { min: 20, label: "Low", color: "#f4dc7a" },
  { min: 0, label: "Very low", color: "#cfe3b4" },
];

export function scoreBand(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}
