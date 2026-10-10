import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";

export type MapCategory = "park" | "garden" | "building" | "school" | "hospital";

export interface MapFeatureProperties {
  id: string;
  category: MapCategory;
  name?: string;
}

export type MapFeature = Feature<Geometry, MapFeatureProperties>;
export type LahoreFeatureCollection = FeatureCollection<Geometry, MapFeatureProperties>;

export interface ScoreComponents {
  greenScarcity: number;
  buildingConcentration: number;
  vulnerableFacilities: number;
}

export interface RankedCell {
  id: string;
  geometry: Polygon;
  score: number;
  components: ScoreComponents;
  reason: string;
}

export interface ScenarioResult {
  coveredCellIds: string[];
  coveredFacilityIds: string[];
  coverageGeometry: Polygon;
}
