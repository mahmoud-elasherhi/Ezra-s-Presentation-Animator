// Dot-matrix globe: dark body with a fresnel rim, billboard atmosphere halo, graticule,
// coastlines, land dots that reveal outwards from a point, and great-circle arcs (rows of
// round points) with packets flowing into a hub. Turns on the ambient clock, so it keeps
// moving while a live clip holds.
//
//   const globe = await makeGlobe({ x: 0, y: 0, radius: 430, hub: [lon, lat], cities: [[lon, lat], …] });
//   // in update(T): globe.update(T);   optional: globe.setDim(0.65) to push it back behind text
//
// Needs data/globe.json (node tools/build-globe.mjs). There is no depth buffer in this
// engine, so everything the sphere blocks is faded in the shaders (`hidden()`).
import { THREE, SH, C, prog, ease, shaderMat, quad, PAL, H, TAN, scene, camera } from '../engine/kit.js';

const HIDDEN = /* glsl */ `
uniform float uOcc;
uniform vec3 uCenter;
float hidden(vec3 wp) {
  vec3 ro = cameraPosition - uCenter;
  vec3 rd = (wp - uCenter) - ro;
  float L = length(rd);
  rd /= L;
  float b = dot(ro, rd);
  float disc = b * b - (dot(ro, ro) - uOcc * uOcc);
  if (disc < 0.0) return 0.0;
  return smoothstep(0.0, 24.0, L - (-b - sqrt(disc)));
}
`;
const BODY_VERT = /* glsl */ `
varying vec3 vN, vV;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const BODY_FRAG = /* glsl */ `
uniform vec3 uBase, uRimA, uRimB;
uniform float uOpacity;
varying vec3 vN, vV;
void main() {
  vec3 n = normalize(vN);
  float f = 1.0 - max(dot(n, normalize(vV)), 0.0);
  float light = 0.55 + 0.45 * dot(n, normalize(vec3(-0.5, 0.7, 0.6)));
  vec3 rim = mix(uRimA, uRimB, 0.5 + 0.5 * n.y);
  vec3 c = uBase * light + rim * (pow(f, 3.0) * 0.9 + pow(f, 9.0) * 1.6);
  gl_FragColor = vec4(c, 1.0) * uOpacity;
}
`;
const HALO_FRAG = /* glsl */ `
uniform vec3 uColA, uColB;
uniform float uR, uOpacity, uTime;
varying vec2 vP;
void main() {
  float d = length(vP);
  float x = (d - uR) / uR;
  float g = exp(-max(x, 0.0) * 9.0) * smoothstep(-0.04, 0.0, x) * 0.55 + exp(-max(x, 0.0) * 2.4) * 0.12;
  vec3 c = mix(uColA, uColB, 0.5 + 0.5 * sin(atan(vP.y, vP.x) + uTime * 0.15));
  gl_FragColor = vec4(c * g * uOpacity, 0.0);
}
`;
const dotVert = (R) => /* glsl */ `
attribute float aReveal, aSeed;
uniform float uScale, uReveal, uSize, uDim, uTime;
uniform vec3 uColA, uColB, uColC;
varying vec3 vCol;
varying float vA;
${HIDDEN}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * w;
  float k = uReveal - aReveal;
  float on = smoothstep(0.0, 0.02, k);
  float flash = exp(-max(k, 0.0) * 28.0) * on;
  vec3 rel = w.xyz - uCenter;
  float facing = dot(normalize(rel), normalize(cameraPosition - w.xyz));
  float vis = mix(1.0, 0.06, hidden(w.xyz)) * mix(0.35, 1.0, smoothstep(0.0, 0.45, facing));
  float tw = 0.8 + 0.2 * sin(uTime * (0.6 + aSeed) + aSeed * 60.0);
  float g = clamp(rel.y / ${R.toFixed(1)} * 0.5 + 0.5 + (aSeed - 0.5) * 0.3, 0.0, 1.0);
  vec3 col = g > 0.5 ? mix(uColB, uColA, (g - 0.5) * 2.0) : mix(uColC, uColB, g * 2.0);
  vCol = mix(col, vec3(1.0), flash) * (1.0 + flash * 2.0);
  vA = on * vis * tw * uDim;
  gl_PointSize = uSize * (1.0 + flash * 1.4) * uScale / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
const DOT_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vCol * smoothstep(0.5, 0.25, d) * vA, 0.0);
}
`;
const LINE_VERT = /* glsl */ `
attribute float aReveal;
uniform float uReveal, uBack;
varying float vA;
${HIDDEN}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vA = step(aReveal, uReveal) * mix(1.0, uBack, hidden(w.xyz));
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() { gl_FragColor = vec4(uColor * vA * uOpacity, 0.0); }
`;
const ARC_VERT = /* glsl */ `
attribute float aU, aLen, aT0, aDur, aIdx;
uniform float uT, uScale, uDim, uTime;
uniform vec3 uColA, uColB, uColC;
varying vec3 vCol;
varying float vA;
${HIDDEN}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * w;
  float p = clamp((uT - aT0) / aDur, 0.0, 1.0);
  float head = p * p * (3.0 - 2.0 * p);
  float drawn = step(aU, head) * step(0.0001, p);
  float live = 1.0 - step(0.999, p);
  float hot = exp(-max((head - aU) * aLen, 0.0) / 16.0) * live;
  float s = aU * aLen / 150.0 - uTime * 0.85 + aIdx * 0.37;
  float pk = exp(-fract(s) * 7.0) * smoothstep(0.0, 0.6, uT - aT0 - aDur);
  float ci = mod(floor(s), 3.0);
  vec3 pc = ci < 0.5 ? uColA : (ci < 1.5 ? uColB : uColC);
  vCol = vec3(0.42, 0.40, 0.55) * 0.55 + pc * pk * 1.6 + vec3(1.0) * hot * 2.2;
  vA = drawn * mix(1.0, 0.05, hidden(w.xyz)) * uDim;
  gl_PointSize = (2.6 + 2.2 * hot + 1.6 * pk) * uScale / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
const PIN_VERT = /* glsl */ `
attribute float aT0, aHub;
uniform float uT, uScale, uDim, uTime;
varying float vP, vA, vHub, vAge;
${HIDDEN}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * w;
  vAge = uT - aT0;
  vP = fract(max(uTime - aT0, 0.0) / (aHub > 0.5 ? 1.6 : 2.8) + aT0 * 0.13);
  vHub = aHub;
  vA = step(0.0, vAge) * (1.0 - hidden(w.xyz)) * uDim;
  gl_PointSize = (aHub > 0.5 ? 120.0 : 70.0) * uScale / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
const PIN_FRAG = /* glsl */ `
uniform vec3 uColA, uColB;
varying float vP, vA, vHub, vAge;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(0.13, 0.07, d) * (vHub > 0.5 ? 1.6 : 1.0);
  float pop = clamp(vAge / 0.4, 0.0, 1.0);
  float ring = exp(-abs(d - vP) * 36.0) * (1.0 - vP) * 0.9;
  float land = exp(-abs(d - pop) * 18.0) * (1.0 - pop) * 1.5;
  gl_FragColor = vec4(mix(uColA, uColB, vHub) * (core * (0.6 + 0.4 * pop) + ring + land) * vA, 0.0);
}
`;

const toXYZ = (lon, lat, r) => {
  const a = THREE.MathUtils.degToRad(lon);
  const b = THREE.MathUtils.degToRad(lat);
  return new THREE.Vector3(r * Math.cos(b) * Math.sin(a), r * Math.sin(b), r * Math.cos(b) * Math.cos(a));
};
const geo = (attrs) => {
  const g = new THREE.BufferGeometry();
  for (const [name, arr, n] of attrs) g.setAttribute(name, new THREE.Float32BufferAttribute(arr, n));
  return g;
};
const add = (parent, obj, order) => {
  obj.renderOrder = order;
  obj.frustumCulled = false;
  parent.add(obj);
  return obj;
};

/**
 * @param {object} o
 * @param {number} [o.x=0] @param {number} [o.y=0] @param {number} [o.z=0]  centre in world units
 * @param {number} [o.radius=430]
 * @param {[number, number]} [o.revealFrom=[0, 20]]  lon/lat the land dots spread out from
 * @param {number} [o.faceLon]   longitude that faces the camera when the reveal starts (default: revealFrom)
 * @param {number} [o.spin=0.045]  radians per second on the ambient clock (0 = still)
 * @param {[number, number]} [o.hub]  lon/lat every arc flies into (omit for no arcs)
 * @param {[number, number][]} [o.cities=[]]  lon/lat arc origins
 * @param {object} [o.t]  timeline: { body, grid, dots, arcs, stagger }
 * @param {object} [o.colors]  { a, b, c } dot / packet colours (default: palette blue, pink, white)
 */
export async function makeGlobe(o = {}) {
  const R = o.radius ?? 430;
  const t = { body: 0.15, grid: 0.25, dots: 0.35, arcs: 1.7, stagger: 0.17, ...(o.t || {}) };
  const { dots, coast } = o.data ?? (await (await fetch(o.dataUrl ?? './data/globe.json')).json());
  const revealFrom = o.revealFrom ?? [0, 20];
  const faceLon = o.faceLon ?? revealFrom[0];
  const spinRate = o.spin ?? 0.045;
  const col = o.colors ?? { a: PAL.blue, b: PAL.pink, c: PAL.white };

  const center = { value: new THREE.Vector3(o.x ?? 0, o.y ?? 0, o.z ?? 0) };
  const uScale = { value: H / (2 * TAN) };
  const uT = { value: 0 };
  const COL = { uColA: { value: C(col.a) }, uColB: { value: C(col.b) }, uColC: { value: C(col.c) } };
  const occ = (r) => ({ uOcc: { value: r }, uCenter: center });
  const origin = toXYZ(revealFrom[0], revealFrom[1], 1);
  const reveal = (v) => Math.acos(Math.min(1, v.clone().normalize().dot(origin))) / Math.PI;

  const root = new THREE.Group();
  root.position.copy(center.value);
  scene.add(root);
  const tilt = new THREE.Group();
  tilt.rotation.set(o.tilt ?? 0.36, 0, o.roll ?? 0.08);
  root.add(tilt);
  const spin = new THREE.Group();
  tilt.add(spin);

  const haloMat = shaderMat(SH.PANEL_VERT, HALO_FRAG, { uColA: { value: C(col.a) }, uColB: { value: C('#8E82FF') }, uR: { value: R * 1.012 }, uOpacity: { value: 0 } });
  const halo = add(root, quad(R * 4.4, R * 4.4, haloMat), 4);
  const bodyMat = shaderMat(BODY_VERT, BODY_FRAG, { uBase: { value: C('#0B0A18') }, uRimA: { value: C(col.a).multiplyScalar(0.55) }, uRimB: { value: C('#8E82FF').multiplyScalar(0.6) }, uOpacity: { value: 0 } });
  bodyMat.side = THREE.FrontSide;
  add(root, new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), bodyMat), 5);

  // graticule: parallels every 20°, meridians every 30°
  const gp = [];
  const gr = [];
  const seg = (a, b, ra, rb) => (gp.push(a.x, a.y, a.z, b.x, b.y, b.z), gr.push(ra, rb));
  for (let lat = -60; lat <= 60; lat += 20) for (let lon = -180; lon < 180; lon += 3) seg(toXYZ(lon, lat, R * 1.002), toXYZ(lon + 3, lat, R * 1.002), (lon + 180) / 360, (lon + 183) / 360);
  for (let lon = -180; lon < 180; lon += 30) for (let lat = -80; lat < 80; lat += 3) seg(toXYZ(lon, lat, R * 1.002), toXYZ(lon, lat + 3, R * 1.002), (80 - lat) / 160, (77 - lat) / 160);
  const gridMat = shaderMat(LINE_VERT, LINE_FRAG, { uColor: { value: C('#3A3670') }, uOpacity: { value: 0 }, uReveal: { value: 0 }, uBack: { value: 0.12 }, ...occ(R * 0.985) });
  add(spin, new THREE.LineSegments(geo([['position', gp, 3], ['aReveal', gr, 1]]), gridMat), 6);

  // coastlines
  const cp = [];
  const cr = [];
  for (const ring of coast) {
    for (let i = 2; i < ring.length; i += 2) {
      const a = toXYZ(ring[i - 2], ring[i - 1], R * 1.003);
      const b = toXYZ(ring[i], ring[i + 1], R * 1.003);
      cp.push(a.x, a.y, a.z, b.x, b.y, b.z);
      cr.push(reveal(a) * 0.85, reveal(b) * 0.85);
    }
  }
  const coastMat = shaderMat(LINE_VERT, LINE_FRAG, { uColor: { value: C('#7C74E0') }, uOpacity: { value: 0 }, uReveal: { value: 0 }, uBack: { value: 0 }, ...occ(R * 0.985) });
  add(spin, new THREE.LineSegments(geo([['position', cp, 3], ['aReveal', cr, 1]]), coastMat), 7);

  // land dots
  const dp = [];
  const dr = [];
  const ds = [];
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < dots.length; i += 2) {
    const v = toXYZ(dots[i], dots[i + 1], R * 1.004);
    dp.push(v.x, v.y, v.z);
    dr.push(reveal(v) * 0.85 + rnd() * 0.12);
    ds.push(rnd());
  }
  const dotMat = shaderMat(dotVert(R), DOT_FRAG, { ...COL, uScale, uReveal: { value: 0 }, uSize: { value: o.dotSize ?? 4.4 }, uDim: { value: 1 }, ...occ(R * 0.985) });
  add(spin, new THREE.Points(geo([['position', dp, 3], ['aReveal', dr, 1], ['aSeed', ds, 1]]), dotMat), 8);

  // arcs into the hub, raised in proportion to their length
  let arcMat = null;
  let pinMat = null;
  if (o.hub) {
    const A = { pos: [], u: [], len: [], t0: [], dur: [], idx: [] };
    const P = { pos: [], t0: [], hub: [] };
    const hubV = toXYZ(o.hub[0], o.hub[1], 1);
    (o.cities ?? []).forEach(([lon, lat], i) => {
      const a = toXYZ(lon, lat, 1);
      const ang = Math.acos(Math.min(1, a.dot(hubV)));
      if (ang < 1e-3) return;
      const lift = R * (0.08 + 0.24 * (ang / Math.PI));
      const pts = [];
      for (let k = 0; k <= 200; k++) {
        const f = k / 200;
        const v = a.clone().multiplyScalar(Math.sin((1 - f) * ang) / Math.sin(ang)).addScaledVector(hubV, Math.sin(f * ang) / Math.sin(ang));
        pts.push(v.multiplyScalar(R * 1.004 + lift * Math.sin(Math.PI * f)));
      }
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
      const L = cum[cum.length - 1];
      const t0 = t.arcs + i * t.stagger;
      const dur = 0.75 + 0.5 * (ang / Math.PI);
      const n = Math.ceil(L / 3.2);
      for (let j = 0, k = 1; j <= n; j++) {
        const d = (j / n) * L;
        while (k < cum.length - 1 && cum[k] < d) k++;
        const v = pts[k - 1].clone().lerp(pts[k], (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1));
        A.pos.push(v.x, v.y, v.z);
        A.u.push(j / n);
        A.len.push(L);
        A.t0.push(t0);
        A.dur.push(dur);
        A.idx.push(i);
      }
      const c = a.clone().multiplyScalar(R * 1.006);
      P.pos.push(c.x, c.y, c.z);
      P.t0.push(t0 - 0.05);
      P.hub.push(0);
    });
    const h = hubV.clone().multiplyScalar(R * 1.006);
    P.pos.push(h.x, h.y, h.z);
    P.t0.push(t.arcs + 0.9);
    P.hub.push(1);
    arcMat = shaderMat(ARC_VERT, DOT_FRAG, { ...COL, uT, uScale, uDim: { value: 1 }, ...occ(R) });
    add(spin, new THREE.Points(geo([['position', A.pos, 3], ['aU', A.u, 1], ['aLen', A.len, 1], ['aT0', A.t0, 1], ['aDur', A.dur, 1], ['aIdx', A.idx, 1]]), arcMat), 10);
    pinMat = shaderMat(PIN_VERT, PIN_FRAG, { uColA: { value: C(col.b) }, uColB: { value: C('#FFFFFF') }, uT, uScale, uDim: { value: 1 }, ...occ(R * 0.985) });
    add(spin, new THREE.Points(geo([['position', P.pos, 3], ['aT0', P.t0, 1], ['aHub', P.hub, 1]]), pinMat), 11);
  }

  let dim = 1;
  return {
    root,
    radius: R,
    /** 1 = full brightness; ~0.65 pushes the globe back behind a title */
    setDim(k) {
      dim = k;
    },
    update(T) {
      const amb = bodyMat.uniforms.uTime.value; // ambient clock (keeps running while a clip holds)
      uT.value = T;
      spin.rotation.y = THREE.MathUtils.degToRad(-faceLon) + (amb - t.dots - 1.2) * spinRate;
      const body = ease.inOut(prog(T, t.body, 1.2));
      bodyMat.uniforms.uOpacity.value = body;
      haloMat.uniforms.uOpacity.value = body;
      gridMat.uniforms.uOpacity.value = 0.9 * body;
      gridMat.uniforms.uReveal.value = ease.inOut(prog(T, t.grid, 1.8));
      const rv = ease.inOut(prog(T, t.dots, 2.4)) * 1.02;
      dotMat.uniforms.uReveal.value = rv;
      coastMat.uniforms.uReveal.value = rv;
      coastMat.uniforms.uOpacity.value = 0.55 * body;
      dotMat.uniforms.uDim.value = dim;
      if (arcMat) arcMat.uniforms.uDim.value = 0.4 + 0.6 * dim;
      if (pinMat) pinMat.uniforms.uDim.value = dim;
      root.visible = T >= t.body - 0.05;
      halo.quaternion.copy(camera.quaternion); // billboard
    },
  };
}
