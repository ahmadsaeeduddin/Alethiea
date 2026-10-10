/**
 * Dev utility: snapshots the OpenStreetMap features for one study area to a GeoJSON file.
 * The app itself loads areas live through /api/area; this is for offline inspection and for
 * checking what the data contract looks like.
 *
 * Usage:
 *   npm run data:fetch                                  # default Gulberg pilot
 *   npm run data:fetch -- --lat 31.5826 --lng 74.3141 --size 2 --out public/data/walled-city.geojson
 *
 * Shares its logic with the app by importing src/lib/osm.ts directly (Node strips the types).
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { areaToBbox, DEFAULT_AREA } from "../src/lib/area.ts";
import { fetchAreaFeatures } from "../src/lib/osm.ts";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key) args[key] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const area = {
  center: [Number(args.lng ?? DEFAULT_AREA.center[0]), Number(args.lat ?? DEFAULT_AREA.center[1])],
  sizeKm: Number(args.size ?? DEFAULT_AREA.sizeKm),
};
const bbox = areaToBbox(area);

console.log(`Fetching ${area.sizeKm} × ${area.sizeKm} km around ${area.center[1]}, ${area.center[0]} …`);
const collection = await fetchAreaFeatures(bbox, { attempts: 3, onProgress: (m) => console.log(m) });

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..", args.out ?? "public/data/lahore.geojson");
await writeFile(out, JSON.stringify(collection));

const counts = {};
for (const f of collection.features) {
  counts[f.properties.category] = (counts[f.properties.category] ?? 0) + 1;
}
console.log(`Wrote ${collection.features.length} features to ${out}`);
console.table(counts);
