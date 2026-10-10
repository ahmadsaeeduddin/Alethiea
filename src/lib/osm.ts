/**
 * Server-side OpenStreetMap loader. Queries the Overpass API for one bounding box and
 * normalises the result to the shared data contract:
 *   { id, category: park | garden | pitch | grass | building | school | hospital, name? }
 *
 * Runs in the /api/area route handler and in scripts/fetch-osm.mjs. Never import it into a
 * Client Component: public Overpass instances block browser-origin requests.
 */
import type { Geometry, MultiPolygon, Point, Polygon } from "geojson";
import type { AreaFeatureCollection, Bbox, MapCategory, MapFeature, MapFeatureProperties } from "@/types";

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL), via Overpass API";

const PRIMARY = "https://overpass-api.de/api/interpreter";
const MIRRORS = ["https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

/**
 * Attempt plan for a single query. The main instance is by far the most reliable, so it is retried
 * with backoff before falling back to mirrors, which are often unreachable.
 */
const ATTEMPT_PLAN: { url: string; waitMs: number }[] = [
  { url: PRIMARY, waitMs: 0 },
  { url: PRIMARY, waitMs: 3000 },
  { url: MIRRORS[0], waitMs: 0 },
  { url: PRIMARY, waitMs: 6000 },
  { url: MIRRORS[1], waitMs: 0 },
];

/** Overpass allows only a couple of query slots per client IP; pause between queries. */
const QUERY_GAP_MS = 1200;

const USER_AGENT = "GreenGap-hackathon/0.1 (urban greening priority explorer)";

/** Split into small queries: public Overpass servers often time out on one large request. */
function queriesFor([west, south, east, north]: Bbox): Record<string, string> {
  const bbox = [south, west, north, east].join(",");
  return {
    green:
      `way["leisure"~"^(park|garden|pitch|recreation_ground)$"](${bbox});` +
      `relation["leisure"~"^(park|garden|pitch|recreation_ground)$"](${bbox});` +
      `way["landuse"~"^(grass|recreation_ground|village_green)$"](${bbox});` +
      `way["natural"~"^(grassland|scrub|wood)$"](${bbox});`,
    facilities:
      `nwr["amenity"~"^(school|college|university|kindergarten|hospital|clinic)$"](${bbox});` +
      `nwr["healthcare"="hospital"](${bbox});`,
    buildings: `way["building"](${bbox});`,
  };
}

const wrap = (body: string) => `[out:json][timeout:120];(${body});out geom;`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const round = (n: number) => Math.round(n * 1e6) / 1e6;
type Coord = [number, number];
const toCoord = (p: { lat: number; lon: number }): Coord => [round(p.lon), round(p.lat)];
const sameCoord = (a: Coord, b: Coord) => a[0] === b[0] && a[1] === b[1];

// "school" covers education, "hospital" covers healthcare. Some Lahore schools and clinics are
// only mapped as named buildings, so names are checked too.
const SCHOOL_AMENITY = /^(school|college|university|kindergarten)$/;
const HEALTH_AMENITY = /^(hospital|clinic)$/;
const SCHOOL_NAME = /\b(school|college|academy|university)\b/i;
const HEALTH_NAME = /\b(hospital|medical cent(er|re)|clinic)\b/i;

type Tags = Record<string, string | undefined>;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Tags;
  lat?: number;
  lon?: number;
  geometry?: { lat: number; lon: number }[];
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[];
}

export function categorize(tags: Tags = {}): MapCategory | null {
  const name = tags.name ?? tags["name:en"] ?? "";
  if (HEALTH_AMENITY.test(tags.amenity ?? "") || tags.healthcare === "hospital" || tags.building === "hospital" || HEALTH_NAME.test(name))
    return "hospital";
  if (SCHOOL_AMENITY.test(tags.amenity ?? "") || tags.building === "school" || SCHOOL_NAME.test(name)) return "school";
  if (tags.leisure === "park") return "park";
  if (tags.leisure === "garden") return "garden";
  // Sports pitches and mown/rough grass are real greenery for an access measure, and in dense
  // Lahore they outnumber tagged parks. Omitting them skews nearestGreenMeters, so they are kept
  // as distinct categories rather than relabelled as parks.
  if (tags.leisure === "pitch") return "pitch";
  if (tags.leisure === "recreation_ground" || tags.landuse === "recreation_ground") return "park";
  if (tags.landuse === "grass" || tags.landuse === "village_green") return "grass";
  if (tags.natural === "grassland" || tags.natural === "scrub" || tags.natural === "wood") return "grass";
  if (tags.building) return "building";
  return null;
}

/** Joins open way segments into closed rings (needed for multipolygon relations). */
function stitchRings(segments: Coord[][]): Coord[][] {
  const rings: Coord[][] = [];
  const pending = segments.map((s) => [...s]);
  while (pending.length) {
    let ring = pending.shift()!;
    let extended = true;
    while (!sameCoord(ring[0], ring[ring.length - 1]) && extended) {
      extended = false;
      for (let i = 0; i < pending.length; i++) {
        const seg = pending[i];
        const end = ring[ring.length - 1];
        if (sameCoord(seg[0], end)) ring = ring.concat(seg.slice(1));
        else if (sameCoord(seg[seg.length - 1], end)) ring = ring.concat([...seg].reverse().slice(1));
        else continue;
        pending.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (ring.length >= 4 && sameCoord(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

function toGeometry(el: OverpassElement, category: MapCategory): Geometry | null {
  const isFacility = category === "school" || category === "hospital";

  if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
    return { type: "Point", coordinates: [round(el.lon), round(el.lat)] } satisfies Point;
  }

  if (el.type === "way" && el.geometry?.length) {
    const coords = el.geometry.map(toCoord);
    if (coords.length >= 4 && sameCoord(coords[0], coords[coords.length - 1])) {
      return { type: "Polygon", coordinates: [coords] } satisfies Polygon;
    }
    return isFacility ? ({ type: "Point", coordinates: coords[0] } satisfies Point) : null;
  }

  if (el.type === "relation" && el.members?.length) {
    const outer = el.members
      .filter((m) => m.type === "way" && m.role !== "inner" && m.geometry?.length)
      .map((m) => m.geometry!.map(toCoord));
    const rings = stitchRings(outer);
    if (rings.length === 1) return { type: "Polygon", coordinates: [rings[0]] } satisfies Polygon;
    if (rings.length > 1) return { type: "MultiPolygon", coordinates: rings.map((r) => [r]) } satisfies MultiPolygon;
    if (isFacility && el.bounds) {
      const { minlat, minlon, maxlat, maxlon } = el.bounds;
      return {
        type: "Point",
        coordinates: [round((minlon + maxlon) / 2), round((minlat + maxlat) / 2)],
      } satisfies Point;
    }
  }

  return null;
}

export interface FetchOptions {
  signal?: AbortSignal;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Give up on the whole area after this long, so a caller never waits indefinitely. */
  budgetMs?: number;
  onProgress?: (message: string) => void;
}

async function runQuery(
  name: string,
  body: string,
  options: FetchOptions,
  deadline: number,
): Promise<OverpassElement[]> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  let lastError: unknown;

  for (const [index, step] of ATTEMPT_PLAN.entries()) {
    if (step.waitMs) await sleep(step.waitMs);
    if (Date.now() > deadline) break;

    const signals = [AbortSignal.timeout(timeoutMs)];
    if (options.signal) signals.push(options.signal);

    try {
      options.onProgress?.(`[${name}] ${step.url} (try ${index + 1}/${ATTEMPT_PLAN.length})`);
      const res = await fetch(step.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({ data: wrap(body) }),
        signal: AbortSignal.any(signals),
        cache: "no-store",
      });
      // 429 means the endpoint's query slots are busy; back off before trying anywhere else.
      if (res.status === 429) {
        await sleep(3000);
        throw new Error("HTTP 429 (rate limited)");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
      if (json.remark?.includes("runtime error")) throw new Error(json.remark);
      return json.elements ?? [];
    } catch (err) {
      if (options.signal?.aborted) throw err;
      lastError = err;
      options.onProgress?.(`  failed: ${describeError(err)}`);
    }
  }

  throw new Error(`Overpass API did not answer the ${name} query: ${describeError(lastError)}`);
}

/** `fetch` wraps transport problems in an opaque "fetch failed"; the cause has the detail. */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause;
  const detail = cause instanceof Error ? cause.message : cause ? String(cause) : "";
  return detail ? `${err.message} (${detail})` : err.message;
}

/** Converts raw Overpass elements to the shared contract, dropping duplicates. */
export function normalizeElements(elements: OverpassElement[]): MapFeature[] {
  const seen = new Set<string>();
  const features: MapFeature[] = [];

  for (const el of elements) {
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    const category = categorize(el.tags);
    if (!category) continue;
    const geometry = toGeometry(el, category);
    if (!geometry) continue;

    // Facilities are often mapped twice (a POI node plus a named building); keep one.
    const name = el.tags?.name;
    if ((category === "school" || category === "hospital") && name) {
      const key = `${category}:${name.trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }

    seen.add(id);
    const properties: MapFeatureProperties = { id, category };
    if (name) properties.name = name;
    features.push({ type: "Feature", id, geometry, properties });
  }

  return features;
}

/**
 * Fetches and normalises every GreenGap feature inside `bbox`. Throws if Overpass is unreachable.
 * Queries run one at a time: Overpass allows only a couple of concurrent slots per client IP and
 * answers parallel requests with HTTP 429.
 */
export async function fetchAreaFeatures(bbox: Bbox, options: FetchOptions = {}): Promise<AreaFeatureCollection> {
  const deadline = Date.now() + (options.budgetMs ?? 120_000);
  const elements: OverpassElement[] = [];

  for (const [index, [name, body]] of Object.entries(queriesFor(bbox)).entries()) {
    if (index > 0) await sleep(QUERY_GAP_MS);
    elements.push(...(await runQuery(name, body, options, deadline)));
  }

  return {
    type: "FeatureCollection",
    metadata: { source: OSM_ATTRIBUTION, bbox, fetchedAt: new Date().toISOString() },
    features: normalizeElements(elements),
  };
}
