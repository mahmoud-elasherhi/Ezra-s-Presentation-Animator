// Dark flat map (Mercator): country fills with faint borders that fade in, and a highlight
// that lights a country up behind a noisy front (with a fine grid inside it).
//
//   const map = await makeMap({ center: [lon, lat], k: 34 });
//   map.highlight('Some Country', '#2CE0AC', 3.0);   // name as in data/map.json, colour, start time
//   const [x, y] = map.proj(lon, lat);              // world position of a place (for cards, links)
//   // in update(T): map.update(T)
//
// Needs data/map.json (node tools/build-map.mjs <box>). Country names come from Natural Earth.
import { THREE, C, prog, ease, shaderMat, scene } from '../engine/kit.js';
import * as SM from '../effects/map.js';

const merc = (lat) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * @param {object} o
 * @param {[number, number]} [o.center=[17, 41]]  lon/lat placed at world (0, 0)
 * @param {number} [o.k=34]   world units per degree (longitude)
 * @param {number} [o.z=-20]  depth of the map plane (cards usually sit at z≈20 above it)
 * @param {number} [o.fadeIn=0.3]  time the map starts fading in
 */
export async function makeMap(o = {}) {
  const data = o.data ?? (await (await fetch(o.dataUrl ?? './data/map.json')).json());
  const [lon0, lat0] = o.center ?? [17, 41];
  const K = o.k ?? 34;
  const M0 = merc(lat0);
  const fadeIn = o.fadeIn ?? 0.3;
  const proj = (lon, lat) => [(lon - lon0) * K, (merc(lat) - M0) * K];

  const group = new THREE.Group();
  group.position.z = o.z ?? -20;
  scene.add(group);
  const fills = {};
  const mats = [];
  const borderPos = [];
  let seed = 0;
  for (const c of data) {
    const shapes = c.polys.map((rings) => {
      const toV = (r) => r.map(([lon, my]) => new THREE.Vector2((lon - lon0) * K, (my - M0) * K));
      const shape = new THREE.Shape(toV(rings[0]));
      for (let i = 1; i < rings.length; i++) shape.holes.push(new THREE.Path(toV(rings[i])));
      for (const r of rings) {
        for (let i = 1; i < r.length; i++) borderPos.push((r[i - 1][0] - lon0) * K, (r[i - 1][1] - M0) * K, 0, (r[i][0] - lon0) * K, (r[i][1] - M0) * K, 0);
      }
      return shape;
    });
    const mat = shaderMat(SM.MAP_VERT, SM.MAP_FILL_FRAG, {
      uBase: { value: C('#16161E') },
      uHi: { value: C('#8E82FF') },
      uMix: { value: 0 },
      uOpacity: { value: 0 },
      uSeed: { value: (seed++ * 0.618) % 1 },
    });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapes), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    group.add(mesh);
    fills[c.name] = { mat, base: null, t0: Infinity, dur: 0.9 };
    mats.push(mat);
  }
  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
  const borderMat = shaderMat(SM.MAP_VERT, SM.MAP_LINE_FRAG, { uColor: { value: C('#3C3C4C') }, uOpacity: { value: 0 } });
  const borders = new THREE.LineSegments(borderGeo, borderMat);
  borders.frustumCulled = false;
  borders.renderOrder = 3;
  group.add(borders);

  return {
    group,
    proj,
    names: Object.keys(fills),
    /** Light a country up from time t0 (re-call to change colour/time). */
    highlight(name, color, t0, dur = 0.9) {
      const f = fills[name];
      if (!f) throw new Error(`No country "${name}" in the map data. Try one of: ${Object.keys(fills).slice(0, 12).join(', ')}…`);
      f.mat.uniforms.uHi.value.set(color);
      f.t0 = t0;
      f.dur = dur;
    },
    /** Direct access to a country's uniforms (uHi colour, uMix 0..1) for custom effects. */
    uniforms: (name) => fills[name]?.mat.uniforms,
    update(T) {
      const op = ease.inOut(prog(T, fadeIn, 1.0));
      for (const m of mats) m.uniforms.uOpacity.value = op;
      borderMat.uniforms.uOpacity.value = op;
      for (const f of Object.values(fills)) if (f.t0 !== Infinity) f.mat.uniforms.uMix.value = ease.inOut(prog(T, f.t0, f.dur));
    },
  };
}
