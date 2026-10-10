import { booleanIntersects, distance, pointToPolygonDistance } from "@turf/turf";
import type { MultiPolygon, Polygon } from "geojson";
import { cellBounds, createGrid, DEFAULT_BBOX, featureCenter, splitFeatures } from "@/lib/geoUtils";
import type {
  Bbox,
  CellMetrics,
  FactorRange,
  GridCell,
  LngLat,
  MapFeature,
  PriorityLevel,
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

const UNSCORED_REASON =
  "Not scored: no buildings, schools or hospitals are mapped in this cell, and OpenStreetMap coverage here may be incomplete.";

export function calculatePriorityScore(components: ScoreComponents, weights: ScoreWeights = BASE_WEIGHTS): number {
  const score =
    components.greenScarcity * weights.greenScarcity +
    components.buildingConcentration * weights.buildingConcentration +
    components.vulnerableFacilities * weights.vulnerableFacilities;

  return Math.round(Math.min(100, Math.max(0, score)));
}

function rangeOf(values: number[]): FactorRange {
  return values.length ? [Math.min(...values), Math.max(...values)] : [0, 0];
}

/** Min–max scale to 0–100, clamped. A flat factor (no variation) scores 0 everywhere. */
export function scaleFactor(value: number, [min, max]: FactorRange): number {
  if (max - min < 1e-9) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function isAreal(geometry: MapFeature["geometry"]): geometry is Polygon | MultiPolygon {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
}

interface CellMeasurement {
  metrics: CellMetrics;
  /** A building, school or hospital is mapped inside the cell. */
  hasMappedActivity: boolean;
}

function measureCell(
  cell: GridCell,
  green: MapFeature[],
  buildingCenters: LngLat[],
  facilityCenters: LngLat[],
): CellMeasurement {
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
  const inCell = ([x, y]: LngLat) => x >= minX && x < maxX && y >= minY && y < maxY;
  const buildingCount = buildingCenters.filter(inCell).length;

  const facilityCount = facilityCenters.filter(
    (p) => distance(cell.center, p, { units: "meters" }) <= FACILITY_RADIUS_METERS,
  ).length;

  return {
    metrics: { nearestGreenMeters, buildingCount, facilityCount },
    hasMappedActivity: buildingCount > 0 || facilityCenters.some(inCell),
  };
}

function describe(
  components: ScoreComponents,
  metrics: CellMetrics,
  weights: ScoreWeights,
  priority: PriorityLevel,
): string {
  const contributions = (Object.keys(components) as (keyof ScoreComponents)[])
    .filter((k) => weights[k] > 0)
    .map((k) => ({ key: k, value: components[k] * weights[k], raw: components[k] }))
    .sort((a, b) => b.value - a.value);

  const lead = contributions[0];
  const headline =
    !lead || lead.raw < 50
      ? priority === "very-high" || priority === "high"
        ? "Several factors combine"
        : "Lower relative need"
      : {
          greenScarcity: "Far from mapped green space",
          buildingConcentration: "Dense mapped building cover",
          vulnerableFacilities: "Close to schools/hospitals",
        }[lead.key];

  const green =
    metrics.nearestGreenMeters === 0
      ? "touches mapped green space"
      : Number.isFinite(metrics.nearestGreenMeters)
        ? `nearest green space ${Math.round(metrics.nearestGreenMeters / 10) * 10} m`
        : "no mapped green space";
  const buildings = `${metrics.buildingCount} mapped building${metrics.buildingCount === 1 ? "" : "s"}`;
  const facilities = `${metrics.facilityCount} ${metrics.facilityCount === 1 ? "school/hospital" : "schools/hospitals"} within ${FACILITY_RADIUS_METERS} m`;

  return `${headline}: ${green}, ${buildings}, ${facilities}.`;
}

/**
 * Splits the selected study area into ~200 m cells and ranks them by greening need.
 * Factors with no mapped data are dropped and the remaining weights re-normalised.
 * Cells with no mapped building, school or hospital are left unscored rather than ranked on
 * green-space distance alone, because OSM coverage in Lahore is incomplete.
 */
export function rankCells(
  features: MapFeature[],
  bbox: Bbox = DEFAULT_BBOX,
  grid: GridCell[] = createGrid(bbox),
): RankingResult {
  const { green, buildings, facilities } = splitFeatures(features);
  const buildingCenters = buildings.map((f) => featureCenter(f.geometry));
  const facilityCenters = facilities.map((f) => featureCenter(f.geometry));

  const measured = grid.map((cell) => measureCell(cell, green, buildingCenters, facilityCenters));
  const metrics = measured.map((m) => m.metrics);
  const scoredMetrics = measured.filter((m) => m.hasMappedActivity).map((m) => m.metrics);

  const notes: string[] = [];
  const weights: ScoreWeights = { ...BASE_WEIGHTS };
  if (green.length === 0) {
    weights.greenScarcity = 0;
    notes.push("No green spaces are mapped here, so green-space scarcity was excluded.");
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

  const unscoredCount = grid.length - scoredMetrics.length;
  if (unscoredCount > 0) {
    notes.push(
      `${unscoredCount} of ${grid.length} cells have no mapped buildings, schools or hospitals, so they are shown grey and not scored.`,
    );
  }

  // Ranges come from scored cells only, so unmapped cells cannot stretch the scale.
  const finiteMax = Math.max(0, ...metrics.map((m) => m.nearestGreenMeters).filter(Number.isFinite));
  const greenDistance = (m: CellMetrics) => (Number.isFinite(m.nearestGreenMeters) ? m.nearestGreenMeters : finiteMax);
  const greenRange = rangeOf(scoredMetrics.map(greenDistance));
  const buildingRange = rangeOf(scoredMetrics.map((m) => m.buildingCount));
  const facilityRange = rangeOf(scoredMetrics.map((m) => m.facilityCount));

  const cells = grid.map((cell, i) => {
    const m = metrics[i];
    const isScored = measured[i].hasMappedActivity;
    const components: ScoreComponents = {
      greenScarcity: Math.round(scaleFactor(greenDistance(m), greenRange)),
      buildingConcentration: Math.round(scaleFactor(m.buildingCount, buildingRange)),
      vulnerableFacilities: Math.round(scaleFactor(m.facilityCount, facilityRange)),
    };
    return {
      id: cell.id,
      geometry: cell.geometry,
      center: cell.center,
      components,
      metrics: m,
      score: isScored ? calculatePriorityScore(components, weights) : 0,
      isScored,
    };
  });

  cells.sort(
    (a, b) =>
      Number(b.isScored) - Number(a.isScored) ||
      b.score - a.score ||
      b.components.greenScarcity - a.components.greenScarcity ||
      a.id.localeCompare(b.id),
  );

  // Tied scores share the band of the highest-ranked cell in the tie.
  let tieStart = 0;
  const ranked = cells.map(({ isScored, ...cell }, index): RankedCell => {
    if (index > 0 && cell.score !== cells[index - 1].score) tieStart = index;
    if (!isScored) return { ...cell, rank: index + 1, priority: "unscored", reason: UNSCORED_REASON };
    const priority = levelForShare(tieStart / scoredMetrics.length);
    return { ...cell, rank: index + 1, priority, reason: describe(cell.components, cell.metrics, weights, priority) };
  });

  const ranges = { greenScarcity: greenRange, buildingConcentration: buildingRange, vulnerableFacilities: facilityRange };
  return { bbox, cells: ranked, weights, ranges, notes };
}

export interface PriorityBand {
  level: PriorityLevel;
  label: string;
  color: string;
  /** Legend hint, e.g. "top 10%". */
  hint: string;
  /** A scored cell takes the first band where the share of scored cells ranked above it is below this. */
  maxShare?: number;
}

/**
 * Ordered high → low, then unscored. Bands are relative to the scored cells so the most
 * underserved cells always stand out; the 0–100 score itself stays the plain weighted sum.
 */
export const PRIORITY_BANDS: PriorityBand[] = [
  { level: "very-high", label: "Very high", color: "#c62f2f", hint: "top 10%", maxShare: 0.1 },
  { level: "high", label: "High", color: "#e8692f", hint: "top 25%", maxShare: 0.25 },
  { level: "moderate", label: "Moderate", color: "#f2a93b", hint: "top 50%", maxShare: 0.5 },
  { level: "low", label: "Low", color: "#f4dc7a", hint: "top 75%", maxShare: 0.75 },
  { level: "very-low", label: "Very low", color: "#cfe3b4", hint: "bottom 25%", maxShare: 1 },
  { level: "unscored", label: "Not scored", color: "#c3c8c4", hint: "nothing mapped" },
];

function levelForShare(share: number): PriorityLevel {
  return PRIORITY_BANDS.find((b) => b.maxShare !== undefined && share < b.maxShare)?.level ?? "very-low";
}

export function priorityBand(level: PriorityLevel): PriorityBand {
  return PRIORITY_BANDS.find((b) => b.level === level) ?? PRIORITY_BANDS[PRIORITY_BANDS.length - 1];
}
