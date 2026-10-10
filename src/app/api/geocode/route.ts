import type { NextRequest } from "next/server";
import type { GeocodeHit } from "@/types";

/**
 * GET /api/geocode?q=
 * Thin server-side proxy for OpenStreetMap Nominatim place search, used by the landing page to
 * jump to a neighbourhood. Proxied because Nominatim requires an identifying User-Agent and
 * limits clients to about one request per second.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; hits: GeocodeHit[] }>();

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return Response.json({ hits: [] as GeocodeHit[] });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Response.json({ hits: hit.hits });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "GreenGap-hackathon/0.1 (urban greening priority explorer)",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[];
    const hits: GeocodeHit[] = raw
      .map((r) => ({ label: r.display_name ?? "", lat: Number(r.lat), lng: Number(r.lon) }))
      .filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng));

    cache.set(key, { at: Date.now(), hits });
    return Response.json({ hits });
  } catch (err) {
    console.error(`[api/geocode] "${q}" failed: ${err instanceof Error ? err.message : "unknown"}`);
    return Response.json({ error: "Place search is unavailable. Click the map to pick a centre instead." }, { status: 503 });
  }
}
