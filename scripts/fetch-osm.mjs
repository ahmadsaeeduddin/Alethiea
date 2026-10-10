// Fetches OpenStreetMap features for the GreenGap pilot area from the Overpass API
// and writes them to public/data/lahore.geojson using the shared data contract:
//   { id, category: park | garden | pitch | grass | building | school | hospital, name? }
//
// Usage: npm run data:fetch

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Must stay in sync with PILOT_BOUNDS in src/lib/geoUtils.ts (south, west, north, east)
const BBOX = [31.5114, 74.3481, 31.5294, 74.3693];

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const bbox = BBOX.join(",");
// Split into small queries: public Overpass servers often time out on one large request.
const QUERIES = {
  green:
    `way["leisure"~"^(park|garden|pitch|recreation_ground)$"](${bbox});` +
    `relation["leisure"~"^(park|garden|pitch|recreation_ground)$"](${bbox});` +
    `way["landuse"~"^(grass|recreation_ground|village_green)$"](${bbox});` +
    `way["natural"~"^(grassland|scrub|wood)$"](${bbox});`,
  facilities: `nwr["amenity"~"^(school|college|university|kindergarten|hospital|clinic)$"](${bbox});nwr["healthcare"="hospital"](${bbox});`,
  buildings: `way["building"](${bbox});`,
};
const wrap = (body) => `[out:json][timeout:120];(${body});out geom;`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const round = (n) => Math.round(n * 1e6) / 1e6;
const toCoord = (p) => [round(p.lon), round(p.lat)];
const sameCoord = (a, b) => a[0] === b[0] && a[1] === b[1];

// "school" = education facilities; "hospital" = healthcare facilities.
// Some Lahore schools/clinics are only mapped as named buildings, so names are also checked.
const SCHOOL_AMENITY = /^(school|college|university|kindergarten)$/;
const HEALTH_AMENITY = /^(hospital|clinic)$/;
const SCHOOL_NAME = /\b(school|college|academy|university)\b/i;
const HEALTH_NAME = /\b(hospital|medical cent(er|re)|clinic)\b/i;

function categorize(tags = {}) {
  const name = tags.name ?? tags["name:en"] ?? "";
  if (HEALTH_AMENITY.test(tags.amenity ?? "") || tags.healthcare === "hospital" || tags.building === "hospital" || HEALTH_NAME.test(name)) return "hospital";
  if (SCHOOL_AMENITY.test(tags.amenity ?? "") || tags.building === "school" || SCHOOL_NAME.test(name)) return "school";
  if (tags.leisure === "park") return "park";
  if (tags.leisure === "garden") return "garden";
  // Sports pitches and mown/rough grass are real greenery for an access
  // measure, and in this bbox they outnumber tagged parks. Omitting them
  // skews nearestGreenMeters, so they are kept as distinct categories
  // rather than being relabelled as parks.
  if (tags.leisure === "pitch") return "pitch";
  if (tags.leisure === "recreation_ground" || tags.landuse === "recreation_ground") return "park";
  if (tags.landuse === "grass" || tags.landuse === "village_green") return "grass";
  if (tags.natural === "grassland" || tags.natural === "scrub" || tags.natural === "wood") return "grass";
  if (tags.building) return "building";
  return null;
}

// Joins open way segments into closed rings (needed for multipolygon relations).
function stitchRings(segments) {
  const rings = [];
  const pending = segments.map((s) => [...s]);
  while (pending.length) {
    let ring = pending.shift();
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

function toGeometry(el, category) {
  const isFacility = category === "school" || category === "hospital";

  if (el.type === "node") {
    return { type: "Point", coordinates: [round(el.lon), round(el.lat)] };
  }

  if (el.type === "way" && el.geometry?.length) {
    const coords = el.geometry.map(toCoord);
    if (coords.length >= 4 && sameCoord(coords[0], coords[coords.length - 1])) {
      return { type: "Polygon", coordinates: [coords] };
    }
    return isFacility ? { type: "Point", coordinates: coords[0] } : null;
  }

  if (el.type === "relation" && el.members?.length) {
    const outer = el.members
      .filter((m) => m.type === "way" && m.role !== "inner" && m.geometry?.length)
      .map((m) => m.geometry.map(toCoord));
    const rings = stitchRings(outer);
    if (rings.length === 1) return { type: "Polygon", coordinates: [rings[0]] };
    if (rings.length > 1) return { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
    if (isFacility && el.bounds) {
      const { minlat, minlon, maxlat, maxlon } = el.bounds;
      return { type: "Point", coordinates: [round((minlon + maxlon) / 2), round((minlat + maxlat) / 2)] };
    }
  }

  return null;
}

async function fetchOverpass(name, body) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        console.log(`[${name}] querying ${url} (attempt ${attempt + 1}) …`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "GreenGap-hackathon/0.1 (OSM data fetch for Lahore pilot)",
          },
          body: new URLSearchParams({ data: wrap(body) }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.remark?.includes("runtime error")) throw new Error(json.remark);
        return json.elements ?? [];
      } catch (err) {
        lastError = err;
        console.warn(`  failed: ${err.message}`);
      }
    }
    await sleep(5000 * (attempt + 1));
  }
  throw lastError;
}

const elements = [];
for (const [name, body] of Object.entries(QUERIES)) {
  elements.push(...(await fetchOverpass(name, body)));
}

const seen = new Set();
const features = [];
const counts = {};

for (const el of elements) {
  const id = `${el.type}/${el.id}`;
  if (seen.has(id)) continue;
  const category = categorize(el.tags);
  if (!category) continue;
  const geometry = toGeometry(el, category);
  if (!geometry) continue;

  // Facilities are often mapped twice (a POI node plus a named building); keep one.
  if ((category === "school" || category === "hospital") && el.tags?.name) {
    const key = `${category}:${el.tags.name.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
  }

  seen.add(id);
  counts[category] = (counts[category] ?? 0) + 1;
  const properties = { id, category };
  if (el.tags?.name) properties.name = el.tags.name;
  features.push({ type: "Feature", id, geometry, properties });
}

const collection = {
  type: "FeatureCollection",
  metadata: {
    source: "© OpenStreetMap contributors (ODbL), via Overpass API",
    bbox: BBOX,
    fetchedAt: new Date().toISOString(),
  },
  features,
};

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../public/data/lahore.geojson");
await writeFile(out, JSON.stringify(collection));
console.log(`Wrote ${features.length} features to ${out}`);
console.table(counts);
