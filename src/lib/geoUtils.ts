import { centroid } from "@turf/turf";
import type { Geometry } from "geojson";
import type { GridCell, LngLat, MapCategory, MapFeature } from "@/types";

export const PILOT_CENTER = {
  latitude: 31.5204,
  longitude: 74.3587,
} as const;

/** [west, south, east, north] — keep in sync with scripts/fetch-osm.mjs */
export const PILOT_BBOX: [number, number, number, number] = [74.3481, 31.5114, 74.3693, 31.5294];

export const GRID_CELL_SIZE_METERS = 200;

const METERS_PER_DEGREE_LAT = 111_320;

export const GREEN_CATEGORIES: ReadonlySet<MapCategory> = new Set([
  "park",
  "garden",
  "pitch",
  "grass",
]);
export const FACILITY_CATEGORIES: ReadonlySet<MapCategory> = new Set(["school", "hospital"]);

/**
 * Builds a regular grid of ~200 m cells centred in the pilot bbox.
 * Rows are lettered from the north (A, B, …), columns numbered from the west (01, 02, …).
 */
export function createGrid(
  bbox: [number, number, number, number] = PILOT_BBOX,
  cellSizeMeters: number = GRID_CELL_SIZE_METERS,
): GridCell[] {
  const [west, south, east, north] = bbox;
  const midLat = (south + north) / 2;
  const latStep = cellSizeMeters / METERS_PER_DEGREE_LAT;
  const lngStep = cellSizeMeters / (METERS_PER_DEGREE_LAT * Math.cos((midLat * Math.PI) / 180));

  const cols = Math.max(1, Math.floor((east - west) / lngStep + 1e-6));
  const rows = Math.max(1, Math.floor((north - south) / latStep + 1e-6));
  const originLng = west + (east - west - cols * lngStep) / 2;
  const originLat = north - (north - south - rows * latStep) / 2;

  const cells: GridCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const minX = originLng + col * lngStep;
      const maxX = minX + lngStep;
      const maxY = originLat - row * latStep;
      const minY = maxY - latStep;
      cells.push({
        id: `${String.fromCharCode(65 + row)}-${String(col + 1).padStart(2, "0")}`,
        row,
        col,
        center: [(minX + maxX) / 2, (minY + maxY) / 2],
        geometry: {
          type: "Polygon",
          coordinates: [[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]],
        },
      });
    }
  }
  return cells;
}

/** Representative point for any feature geometry. */
export function featureCenter(geometry: Geometry): LngLat {
  if (geometry.type === "Point") return geometry.coordinates as LngLat;
  return centroid(geometry).geometry.coordinates as LngLat;
}

/** Axis-aligned bounds of a grid cell polygon: [minX, minY, maxX, maxY]. */
export function cellBounds(cell: Pick<GridCell, "geometry">): [number, number, number, number] {
  const ring = cell.geometry.coordinates[0];
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function splitFeatures(features: MapFeature[]) {
  return {
    green: features.filter((f) => GREEN_CATEGORIES.has(f.properties.category)),
    buildings: features.filter((f) => f.properties.category === "building"),
    facilities: features.filter((f) => FACILITY_CATEGORIES.has(f.properties.category)),
  };
}

/** Leaflet expects [lat, lng]. */
export const toLatLng = ([lng, lat]: LngLat): [number, number] => [lat, lng];
