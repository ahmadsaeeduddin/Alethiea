// Throwaway: exercises the landing page, /explore and both API routes on the dev server.
const base = "http://localhost:3000";

async function get(path, { redirect = "follow" } = {}) {
  const started = Date.now();
  const res = await fetch(`${base}${path}`, { redirect });
  const text = await res.text();
  return { status: res.status, ms: Date.now() - started, text, headers: res.headers };
}

const landing = await get("/");
console.log(`GET /                       -> ${landing.status} ${landing.ms}ms`);
console.log(`  has picker heading: ${landing.text.includes("Choose the area you want to study")}`);
console.log(`  has presets: ${["Gulberg", "Walled City", "Model Town", "Johar Town"].every((n) => landing.text.includes(n))}`);

const noParams = await get("/explore", { redirect: "manual" });
console.log(`GET /explore (no params)    -> ${noParams.status} (expect 3xx redirect to /)`);

const bad = await get("/api/area?lat=31.5&lng=74.3&size=99");
console.log(`GET /api/area (size=99)     -> ${bad.status} ${bad.text.slice(0, 90)}`);

const outside = await get("/api/area?lat=999&lng=74.3&size=2");
console.log(`GET /api/area (lat=999)     -> ${outside.status}`);

// Walled City, a different area from the committed Gulberg snapshot.
const wc = "lat=31.58260&lng=74.31410&size=1";
const first = await get(`/api/area?${wc}`);
const firstJson = JSON.parse(first.text);
const counts = {};
for (const f of firstJson.features ?? []) counts[f.properties.category] = (counts[f.properties.category] ?? 0) + 1;
console.log(`GET /api/area (Walled City) -> ${first.status} ${first.ms}ms cache=${first.headers.get("x-greengap-cache")}`);
console.log(`  bbox=${JSON.stringify(firstJson.metadata?.bbox)} features=${firstJson.features?.length}`);
console.log(`  categories=${JSON.stringify(counts)}`);

const second = await get(`/api/area?${wc}`);
console.log(`GET /api/area (again)       -> ${second.status} ${second.ms}ms cache=${second.headers.get("x-greengap-cache")}`);

const explore = await get(`/explore?${wc}&label=Walled%20City`);
console.log(`GET /explore (Walled City)  -> ${explore.status} ${explore.ms}ms`);
console.log(`  shows label: ${explore.text.includes("Walled City")}`);
console.log(`  shows size: ${explore.text.includes("1 \u00d7 1 km")}`);
console.log(`  has change-area link: ${explore.text.includes("Change area")}`);

const geo = await get("/api/geocode?q=Johar%20Town%20Lahore");
console.log(`GET /api/geocode            -> ${geo.status} ${geo.text.slice(0, 160)}`);
