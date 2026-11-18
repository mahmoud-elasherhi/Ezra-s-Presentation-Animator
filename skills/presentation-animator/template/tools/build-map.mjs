// Builds data/map.json for components/map.js: country outlines (Natural Earth via world-atlas)
// inside a lon/lat box, projected with Mercator (y is stored as Mercator degrees).
//
//   node tools/build-map.mjs                       # default box: Europe, North Africa, Middle East
//   node tools/build-map.mjs -130,10,-55,60 110m   # lonMin,latMin,lonMax,latMax  [50m|110m]
import fs from 'node:fs';
import { feature } from 'topojson-client';

const [boxArg = '-28,6,68,73', res = '50m', out = 'data/map.json'] = process.argv.slice(2);
const [lon0, lat0, lon1, lat1] = boxArg.split(',').map(Number);
const topo = JSON.parse(fs.readFileSync(new URL(`../node_modules/world-atlas/countries-${res}.json`, import.meta.url)));
const merc = (lat) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const r3 = (v) => Math.round(v * 1000) / 1000;

const countries = [];
for (const f of feature(topo, topo.objects.countries).features) {
  if (!f.geometry) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const kept = [];
  for (const poly of polys) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [lon, lat] of poly[0]) (x0 = Math.min(x0, lon)), (x1 = Math.max(x1, lon)), (y0 = Math.min(y0, lat)), (y1 = Math.max(y1, lat));
    if (x1 < lon0 || x0 > lon1 || y1 < lat0 || y0 > lat1) continue;
    if (x1 - x0 > 300) continue; // rings that wrap the antimeridian
    kept.push(poly.map((ring) => ring.map(([lon, lat]) => [r3(lon), r3(merc(Math.max(-80, Math.min(84, lat))))])));
  }
  if (kept.length) countries.push({ name: f.properties.name, polys: kept });
}
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`../${out}`, import.meta.url), JSON.stringify(countries));
console.log(countries.length, 'countries →', out);
