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

export interface RankingResult {
  cells: RankedCell[];
  weights: ScoreWeights;
  /** Notes about reweighting or data gaps, shown to users. */
  notes: string[];
}

export interface ScenarioResult {
  coveredCellIds: string[];
  coveredFacilityIds: string[];
  coverageGeometry: Polygon;
}
