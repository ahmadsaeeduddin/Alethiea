import { area, bboxPolygon, booleanIntersects, circle, distance, featureCollection, intersect, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { containsPoint, featureCenter, splitFeatures } from "@/lib/geoUtils";
import { calculatePriorityScore, scaleFactor } from "@/lib/scoring";
import type { Bbox, CellScoreChange, LngLat, MapFeature, RankingResult, ScenarioResult } from "@/types";

export const SCENARIO_RADIUS_METERS = 150;

type Areal = Feature<Polygon | MultiPolygon>;

function isAreal(f: MapFeature): f is MapFeature & Areal {
  return f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon";
}

/** Area (m²) of the shapes inside the study area, counting overlaps once. */
function areaInside(shapes: Areal[], studyArea: Areal): number {
  try {
    const clipped = shapes
      .map((s) => intersect(featureCollection([s, studyArea])))
      .filter((s): s is Areal => s !== null);
    if (clipped.length === 0) return 0;
    const merged = clipped.length === 1 ? clipped[0] : union(featureCollection(clipped));
    return merged ? area(merged) : 0;
  } catch {
    // Malformed OSM rings can break polygon clipping; a plain sum may double-count overlaps.
    return shapes.reduce((sum, s) => sum + area(s), 0);
  }
}

/**
 * Treats a circle of `radiusMeters` around `center` as new green space and re-scores the cells
 * it brings closer to greenery, on the original ranking's scale so other cells do not shift.
 * Returns null when `center` is outside the ranked study area.
 * This is hypothetical geographic coverage only, not planting suitability or cooling benefit.
 */
export function simulateIntervention(
  center: LngLat,
  ranking: RankingResult,
  features: MapFeature[],
  radiusMeters: number = SCENARIO_RADIUS_METERS,
): ScenarioResult | null {
  const bbox: Bbox = ranking.bbox;
  if (!containsPoint(bbox, center)) return null;

  const studyArea = bboxPolygon(bbox) as Areal;
  const coverage = circle(center, radiusMeters, { units: "meters", steps: 64 });
  const { green, facilities } = splitFeatures(features);

  const coveredCells = ranking.cells.filter((cell) => booleanIntersects(cell.geometry, coverage));
  const coveredIds = new Set(coveredCells.map((cell) => cell.id));

  const cellChanges: CellScoreChange[] = [];
  for (const cell of ranking.cells) {
    if (cell.priority === "unscored") continue;
    // Same rule as scoring: a cell touching green space is 0 m away, otherwise measure to the edge.
    const toCluster = coveredIds.has(cell.id)
      ? 0
      : Math.max(0, distance(cell.center, center, { units: "meters" }) - radiusMeters);
    if (toCluster >= cell.metrics.nearestGreenMeters) continue;

    const greenScarcity = Math.round(scaleFactor(toCluster, ranking.ranges.greenScarcity));
    const after = calculatePriorityScore({ ...cell.components, greenScarcity }, ranking.weights);
    if (after < cell.score) cellChanges.push({ id: cell.id, before: cell.score, after, priority: cell.priority });
  }
  cellChanges.sort((a, b) => b.before - b.after - (a.before - a.after) || a.id.localeCompare(b.id));

  const greenShapes = green.filter(isAreal);
  const totalArea = area(studyArea);

  return {
    center,
    radiusMeters,
    coverageGeometry: coverage.geometry,
    coveredCellIds: coveredCells.map((cell) => cell.id),
    coveredFacilityIds: facilities
      .filter((f) => distance(center, featureCenter(f.geometry), { units: "meters" }) <= radiusMeters)
      .map((f) => f.properties.id),
    cellChanges,
    highPriorityCellsCovered: coveredCells.filter((c) => c.priority === "very-high" || c.priority === "high").length,
    greenCoverBefore: Math.min(1, areaInside(greenShapes, studyArea) / totalArea),
    greenCoverAfter: Math.min(1, areaInside([...greenShapes, coverage], studyArea) / totalArea),
  };
}
