import type { NextRequest } from "next/server";
import { areaFromParams, areaToBbox, bboxKey, MAX_AREA_SIZE_KM } from "@/lib/area";
import { readAreaCache, writeAreaCache } from "@/lib/areaCache";
import { fetchAreaFeatures } from "@/lib/osm";
import type { AreaFeatureCollection, AreaStreamEvent, Bbox, OsmQueryEvent } from "@/types";

/**
 * GET /api/area?lat=&lng=&size=[&stream=1]
 * Returns normalised OpenStreetMap features for the selected square study area.
 * With stream=1 the response is NDJSON (one AreaStreamEvent per line) so the page can show
 * live loading steps; the last line is either a `result` or an `error`.
 *
 * Overpass is queried server-side: public instances reject browser-origin requests and expect a
 * User-Agent. This endpoint is an unauthenticated read-only proxy for public OSM data, so it is
 * deliberately narrow — area size is capped and results are cached — but a public deployment
 * should still sit behind platform rate limiting.
 */

const LOAD_FAILED = "OpenStreetMap data could not be loaded for this area right now. Please try again.";

interface Job {
  promise: Promise<AreaFeatureCollection>;
  /** Progress so far, replayed to requests that join mid-way. */
  events: OsmQueryEvent[];
  listeners: Set<(event: OsmQueryEvent) => void>;
}

/** One Overpass run per area at a time, even if several clients ask together. */
const inFlight = new Map<string, Job>();

function jobFor(key: string, bbox: Bbox): Job {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const events: OsmQueryEvent[] = [];
  const listeners = new Set<(event: OsmQueryEvent) => void>();
  const promise = fetchAreaFeatures(bbox, {
    onProgress: (message) => console.log(`[api/area] ${message}`),
    onQuery: (event) => {
      events.push(event);
      for (const listener of listeners) listener(event);
    },
  })
    .then(async (data) => {
      await writeAreaCache(key, data);
      return data;
    })
    .finally(() => inFlight.delete(key));

  const job = { promise, events, listeners };
  inFlight.set(key, job);
  return job;
}

function streamArea(key: string, bbox: Bbox): Response {
  const encoder = new TextEncoder();
  let release = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: AreaStreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };

      const cached = await readAreaCache(key);
      send({ type: "cache", hit: Boolean(cached) });
      if (cached) {
        send({ type: "result", data: cached.data });
        controller.close();
        return;
      }

      const job = jobFor(key, bbox);
      const forward = (event: OsmQueryEvent) => send({ type: "query", ...event });
      job.events.forEach(forward);
      job.listeners.add(forward);
      release = () => {
        open = false;
        job.listeners.delete(forward);
      };

      try {
        send({ type: "result", data: await job.promise });
      } catch (err) {
        console.error(`[api/area] ${key} failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        send({ type: "error", message: LOAD_FAILED });
      } finally {
        job.listeners.delete(forward);
        if (open) controller.close();
        open = false;
      }
    },
    // The visitor left: stop forwarding, but let the job finish so the area still gets cached.
    cancel() {
      release();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

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

  if (params.get("stream") === "1") return streamArea(key, bbox);

  const cached = await readAreaCache(key);
  if (cached) {
    return Response.json(cached.data, {
      headers: { "Cache-Control": "no-store", "X-Greengap-Cache": cached.source },
    });
  }

  try {
    const data = await jobFor(key, bbox).promise;
    return Response.json(data, { headers: { "Cache-Control": "no-store", "X-Greengap-Cache": "miss" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[api/area] ${key} failed: ${message}`);
    return Response.json({ error: LOAD_FAILED }, { status: 503 });
  }
}
