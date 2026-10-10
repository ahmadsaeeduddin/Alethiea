import type { NextRequest } from "next/server";
import { areaFromParams, areaToBbox, bboxKey, MAX_AREA_SIZE_KM } from "@/lib/area";
import { readAreaCache, writeAreaCache } from "@/lib/areaCache";
import { fetchAreaFeatures } from "@/lib/osm";
import type { AreaFeatureCollection } from "@/types";

/**
 * GET /api/area?lat=&lng=&size=
 * Returns normalised OpenStreetMap features for the selected square study area.
 *
 * Overpass is queried server-side: public instances reject browser-origin requests and expect a
 * User-Agent. This endpoint is an unauthenticated read-only proxy for public OSM data, so it is
 * deliberately narrow — area size is capped and results are cached — but a public deployment
 * should still sit behind platform rate limiting.
 */

/** One Overpass run per area at a time, even if several clients ask together. */
const inFlight = new Map<string, Promise<AreaFeatureCollection>>();

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const area = areaFromParams({
    lat: params.get("lat") ?? undefined,
    lng: params.get("lng") ?? undefined,
    size: params.get("size") ?? undefined,
  });

  if (!area) {
    return Response.json(
      { error: `Invalid area. Provide lat, lng and a size between 0.5 and ${MAX_AREA_SIZE_KM} km.` },
      { status: 400 },
    );
  }

  const bbox = areaToBbox(area);
  const key = bboxKey(bbox);

  const cached = await readAreaCache(key);
  if (cached) {
    return Response.json(cached.data, {
      headers: { "Cache-Control": "no-store", "X-Greengap-Cache": cached.source },
    });
  }

  const pending =
    inFlight.get(key) ??
    fetchAreaFeatures(bbox, { onProgress: (message) => console.log(`[api/area] ${message}`) })
      .then(async (data) => {
        await writeAreaCache(key, data);
        return data;
      })
      .finally(() => inFlight.delete(key));
  inFlight.set(key, pending);

  try {
    const data = await pending;
    return Response.json(data, { headers: { "Cache-Control": "no-store", "X-Greengap-Cache": "miss" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[api/area] ${key} failed: ${message}`);
    return Response.json(
      { error: "OpenStreetMap data could not be loaded for this area right now. Please try again." },
      { status: 503 },
    );
  }
}
