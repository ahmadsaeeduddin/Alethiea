import type { AreaSelection, Bbox, LngLat } from "@/types";

/** Square sizes a user can analyse, in km per side. */
export const AREA_SIZE_OPTIONS = [1, 2, 3] as const;
export const DEFAULT_AREA_SIZE_KM = 2;

/** Largest side we will ask Overpass for, in km. Guards the API route against huge queries. */
export const MAX_AREA_SIZE_KM = 3;
export const MIN_AREA_SIZE_KM = 0.5;

const METERS_PER_DEGREE_LAT = 111_320;

/** The Gulberg pilot used through Sprint 1, kept as the landing-page default. */
export const DEFAULT_AREA: AreaSelection = {
  center: [74.3587, 31.5204],
  sizeKm: DEFAULT_AREA_SIZE_KM,
};

/** Recognisable starting points for the demo. */
export const AREA_PRESETS: { name: string; detail: string; area: AreaSelection }[] = [
  { name: "Gulberg", detail: "Commercial core, original pilot", area: DEFAULT_AREA },
  { name: "Walled City", detail: "Dense historic fabric", area: { center: [74.3141, 31.5826], sizeKm: 2 } },
  { name: "Model Town", detail: "Planned grid with a central park", area: { center: [74.3251, 31.4847], sizeKm: 2 } },
  { name: "Johar Town", detail: "Newer western suburb", area: { center: [74.2728, 31.4697], sizeKm: 2 } },
];

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Square bbox of `sizeKm` per side centred on `center`: [west, south, east, north]. */
export function areaToBbox({ center: [lng, lat], sizeKm }: AreaSelection): Bbox {
  const halfLat = (sizeKm * 1000) / 2 / METERS_PER_DEGREE_LAT;
  const halfLng = halfLat / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  return [round6(lng - halfLng), round6(lat - halfLat), round6(lng + halfLng), round6(lat + halfLat)];
}

export function bboxCenter([west, south, east, north]: Bbox): LngLat {
  return [(west + east) / 2, (south + north) / 2];
}

/** Stable cache key for a bbox. */
export const bboxKey = (bbox: Bbox) => bbox.map((n) => n.toFixed(5)).join(",");

export function isValidArea(area: AreaSelection | null): area is AreaSelection {
  if (!area) return false;
  const [lng, lat] = area.center;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -85 &&
    lat <= 85 &&
    Number.isFinite(area.sizeKm) &&
    area.sizeKm >= MIN_AREA_SIZE_KM &&
    area.sizeKm <= MAX_AREA_SIZE_KM
  );
}

/** Reads an area from URL search params. Returns null when they are missing or out of range. */
export function areaFromParams(params: {
  lat?: string | string[];
  lng?: string | string[];
  size?: string | string[];
}): AreaSelection | null {
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const lat = Number(first(params.lat));
  const lng = Number(first(params.lng));
  const sizeKm = first(params.size) === undefined ? DEFAULT_AREA_SIZE_KM : Number(first(params.size));
  const area = { center: [lng, lat] as LngLat, sizeKm };
  return isValidArea(area) ? area : null;
}

export function areaToParams({ center: [lng, lat], sizeKm }: AreaSelection): URLSearchParams {
  return new URLSearchParams({ lat: lat.toFixed(5), lng: lng.toFixed(5), size: String(sizeKm) });
}

/** e.g. "31.5204° N, 74.3587° E" */
export function formatCenter([lng, lat]: LngLat): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;
}
