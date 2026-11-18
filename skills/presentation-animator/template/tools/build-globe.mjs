// Builds data/globe.json for components/globe.js: coastlines (Natural Earth 1:110m via
// world-atlas) as [lon, lat] rings, and land dots on an even (Fibonacci) sphere grid.
// Run: node tools/build-globe.mjs
import fs from 'node:fs';
import { feature } from 'topojson-client';

const topo = JSON.parse(fs.readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);
const r2 = (v) => Math.round(v * 100) / 100;

const polys = [];
for (const f of land.features) {
  const g = f.geometry;
  for (const p of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) polys.push(p);
}

// Rings that cross the antimeridian are unwrapped (longitude made continuous) for the inside
// test, and points are tested at lon and lon ± 360. Antarctica circles the pole and is skipped.
const unwrap = (ring) => {
  let off = 0;
  return ring.map(([lon, lat], i) => {
    if (i) {
      const d = lon - ring[i - 1][0];
      if (d > 180) off -= 360;
      else if (d < -180) off += 360;
    }
    return [lon + off, lat];
  });
};
const prepared = polys.filter((p) => p[0].some(([, lat]) => lat > -60)).map((poly) => poly.map(unwrap));
function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const onLand = (lon, lat) =>
  prepared.some((poly) => {
    for (const x of [lon, lon + 360, lon - 360]) {
      if (inRing(poly[0], x, lat) && !poly.slice(1).some((h) => inRing(h, x, lat))) return true;
    }
    return false;
  });

const N = 26000;
const dots = [];
const GOLD = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (2 * (i + 0.5)) / N;
  const lat = (Math.asin(y) * 180) / Math.PI;
  if (lat < -58) continue; // no Antarctica
  let lon = (((i * GOLD * 180) / Math.PI) % 360) - 180;
  if (onLand(lon, lat)) dots.push(r2(lon), r2(lat));
}

const coast = polys.flatMap((p) => p).filter((ring) => ring.some(([, lat]) => lat > -58)).map((ring) => ring.flatMap(([lon, lat]) => [r2(lon), r2(lat)]));
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../data/globe.json', import.meta.url), JSON.stringify({ dots, coast }));
console.log(dots.length / 2, 'land dots,', coast.length, 'coast rings,', coast.reduce((n, r) => n + r.length / 2, 0), 'coast points');
