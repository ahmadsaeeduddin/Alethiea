import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";

export type MapCategory =
  | "park"
  | "garden"
  | "pitch"
  | "grass"
  | "building"
  | "school"
  | "hospital";

export interface MapFeatureProperties {
  id: string;
  category: MapCategory;
  name?: string;
}

export type MapFeature = Feature<Geometry, MapFeatureProperties>;

export interface LahoreFeatureCollection extends FeatureCollection<Geometry, MapFeatureProperties> {
  /** Provenance written by scripts/fetch-osm.mjs */
  metadata?: {
    source: string;
    bbox: [number, number, number, number];
    fetchedAt: string;
  };
}

/** [longitude, latitude] — GeoJSON order */
export type LngLat = [number, number];

export interface GridCell {
  id: string;
  row: number;
  col: number;
  geometry: Polygon;
  center: LngLat;
}

export interface ScoreComponents {
  greenScarcity: number;
  buildingConcentration: number;
  vulnerableFacilities: number;
}

/** Raw, un-normalized measurements behind each component score. */
export interface CellMetrics {
  nearestGreenMeters: number;
  buildingCount: number;
  facilityCount: number;
}

/** Relative priority band. "unscored" cells have no mapped building, school or hospital. */
export type PriorityLevel = "very-high" | "high" | "moderate" | "low" | "very-low" | "unscored";

export interface RankedCell {
  id: string;
  geometry: Polygon;
  center: LngLat;
  score: number;
  rank: number;
  priority: PriorityLevel;
  components: ScoreComponents;
  metrics: CellMetrics;
  reason: string;
}

export type ScoreWeights = ScoreComponents;

/** [min, max] of a raw factor across scored cells, used to scale it to 0–100. */
export type FactorRange = [min: number, max: number];

export interface RankingResult {
  cells: RankedCell[];
  weights: ScoreWeights;
  /** Raw-factor range behind each component, so scenarios can re-score on the same scale. */
  ranges: Record<keyof ScoreComponents, FactorRange>;
  /** Notes about reweighting or data gaps, shown to users. */
  notes: string[];
}

/** A scored cell whose priority score would drop under a proposed greening cluster. */
export interface CellScoreChange {
  id: string;
  before: number;
  after: number;
  /** Priority band before the intervention. */
  priority: PriorityLevel;
}

/** Hypothetical geographic coverage of a proposed greening cluster — not planting suitability or cooling. */
export interface ScenarioResult {
  center: LngLat;
  radiusMeters: number;
  coverageGeometry: Polygon;
  coveredCellIds: string[];
  coveredFacilityIds: string[];
  /** Largest score drop first. */
  cellChanges: CellScoreChange[];
  /** Covered cells currently in the Very high or High band. */
  highPriorityCellsCovered: number;
  /** Mapped green area as a share of the pilot area, 0–1. */
  greenCoverBefore: number;
  greenCoverAfter: number;
}
