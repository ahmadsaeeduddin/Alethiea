// Throwaway: which Overpass endpoints answer a buildings query reliably right now?
const bbox = "31.57811,74.30883,31.58709,74.31937";
const body = `way["building"](${bbox});`;
const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const url of endpoints) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "GreenGap-hackathon/0.1" },
        body: new URLSearchParams({ data: `[out:json][timeout:120];(${body});out geom;` }),
        signal: AbortSignal.timeout(40000),
      });
      const text = await res.text();
      console.log(`${url} #${attempt} -> ${res.status} ${Date.now() - started}ms len=${text.length}`);
      if (res.ok) break;
    } catch (err) {
      console.log(`${url} #${attempt} -> THREW ${err.message} ${err.cause?.message ?? ""} ${Date.now() - started}ms`);
    }
    await sleep(3000);
  }
  await sleep(2000);
}
