import { centroid } from "@turf/turf";
import type { Geometry } from "geojson";
import { areaToBbox, DEFAULT_AREA } from "@/lib/area";
import type { Bbox, GridCell, LngLat, MapCategory, MapFeature } from "@/types";

/** Bounds of the default Gulberg pilot, used when no area is selected. */
export const DEFAULT_BBOX: Bbox = areaToBbox(DEFAULT_AREA);

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
 * Builds a regular grid of ~200 m cells centred in `bbox`.
 * Rows are lettered from the north (A, B, …), columns numbered from the west (01, 02, …).
 */
export function createGrid(bbox: Bbox = DEFAULT_BBOX, cellSizeMeters: number = GRID_CELL_SIZE_METERS): GridCell[] {
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
        id: `${rowLabel(row)}-${String(col + 1).padStart(2, "0")}`,
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

/** A, B, … Z, AA, AB, … so large grids keep unique labels. */
function rowLabel(row: number): string {
  let label = "";
  for (let n = row; ; n = Math.floor(n / 26) - 1) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    if (n < 26) return label;
  }
}

/** Representative point for any feature geometry. */
export function featureCenter(geometry: Geometry): LngLat {
  if (geometry.type === "Point") return geometry.coordinates as LngLat;
  return centroid(geometry).geometry.coordinates as LngLat;
}

/** Axis-aligned bounds of a grid cell polygon: [minX, minY, maxX, maxY]. */
export function cellBounds(cell: Pick<GridCell, "geometry">): Bbox {
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

export function containsPoint([west, south, east, north]: Bbox, [lng, lat]: LngLat): boolean {
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/** Leaflet expects [lat, lng]. */
export const toLatLng = ([lng, lat]: LngLat): [number, number] => [lat, lng];

/** Leaflet bounds for a bbox: [[south, west], [north, east]]. */
export const toLatLngBounds = ([west, south, east, north]: Bbox): [[number, number], [number, number]] => [
  [south, west],
  [north, east],
];
