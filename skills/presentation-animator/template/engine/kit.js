// Shared engine: renderer, look (backdrop, bloom, grade),
// the panel / label / link building blocks, playback UI and the offline MP4 export.
// A scene module builds its objects with these and hands `start()` an update(T).
import * as THREE from 'three';
import * as SH from './shaders.js';

export { THREE, SH };

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const FOV = 28;
export const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const SPACING = 210; // world units between ambient packets
const FLOW = 0.5; // ambient packets per second passing a point

export const qs = new URLSearchParams(location.search);
export const canvas = document.getElementById('c');

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.autoClear = false;
renderer.setClearColor(0x000000, 1);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(FOV, W / H, 10, 30000);

// ════════════════════════════════════════════════════════════════ helpers
export const C = (hex) => new THREE.Color(hex);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const prog = (T, t0, dur) => clamp01((T - t0) / dur);
export const rad = THREE.MathUtils.degToRad;
export const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};

// Monotone cubic (PCHIP) through keyframes: smooth where values change,
// perfectly flat where they hold, never overshoots.
export function pchip(ts, ys) {
  const n = ts.length;
  const h = [];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = ts[i + 1] - ts[i];
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (T) => {
    if (T <= ts[0]) return ys[0];
    if (T >= ts[n - 1]) return ys[n - 1];
    let i = 0;
    while (T > ts[i + 1]) i++;
    const s = (T - ts[i]) / h[i];
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * ys[i] +
      (s3 - 2 * s2 + s) * h[i] * m[i] +
      (-2 * s3 + 3 * s2) * ys[i + 1] +
      (s3 - s2) * h[i] * m[i + 1]
    );
  };
}
export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const timeUniforms = [];
export function shaderMat(vertexShader, fragmentShader, uniforms) {
  uniforms.uTime = { value: 0 };
  timeUniforms.push(uniforms.uTime);
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
export function quad(w, h, mat, order = 30) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return mesh;
}

// ════════════════════════════════════════════════════════════════ palette
export const PAL = {
  blue: '#5BCEFA', // packet stream cycles blue → pink → white → pink
  pink: '#F5A9B8',
  white: '#FFFFFF',
  alert: '#FF4D5E',
  link: '#8D8B98',
};
export const STYLES = {
  net: { fill: '#3A3190', stroke: '#9186F5', title: '#E2DEFF', sub: '#B9B3F7', glow: '#8E82FF' },
  app: { fill: '#07503F', stroke: '#27B990', title: '#B4F1DD', sub: '#66D9B2', glow: '#2CE0AC' },
  data: { fill: '#3D3D3A', stroke: '#908F87', title: '#E6E4DA', sub: '#BDBBB2', glow: '#C9C7BC' },
  ghost: { fill: '#14141C', stroke: '#74747E', title: '#F4F4F6', sub: '#C2C2C8', glow: '#A0A0B0', fillAlpha: 0.35, dash: 11, glowAmt: 0 },
  threat: { fill: '#2A1016', stroke: '#C4505E', title: '#FFE3E6', sub: '#EE9BA5', glow: '#FF4D5E', fillAlpha: 0.6, dash: 11, glowAmt: 0.25 },
};

// ════════════════════════════════════════════════════════════════ text atlases
export const SANS = `"Inter", "SF Pro Display", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;
export const MONO = `"JetBrainsMono Nerd Font", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace`;
export const F_TITLE = `600 26px ${SANS}`;
export const F_SUB = `400 16px ${MONO}`;
export const F_TAG = `500 12px ${MONO}`;

export function textTexture(w, h, draw, scale = 4) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * scale);
  cv.height = Math.round(h * scale);
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  draw(ctx);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = maxAniso;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}
// channel 0 → red (title colour), channel 1 → green (sub colour)
export function line(ctx, text, x, y, font, channel = 0, align = 'center', tracking = 0) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${tracking}px`;
  ctx.fillStyle = channel ? '#00ff00' : '#ff0000';
  ctx.fillText(text, x, y);
}
export function makeLabel(w, h, draw, colA, colB, seed = 0.5, scale = 4) {
  const mat = shaderMat(SH.LABEL_VERT, SH.LABEL_FRAG, {
    uMap: { value: textTexture(w, h, draw, scale) },
    uColA: { value: C(colA) },
    uColB: { value: C(colB ?? colA) },
    uReveal: { value: 0 },
    uSeed: { value: seed },
    uOpacity: { value: 1 },
  });
  return { mesh: quad(w, h, mat, 40), mat };
}

// ════════════════════════════════════════════════════════════════ panels + cards
const PAD = 72; // room around each box for glow and impact rings
export function makePanel(o) {
  const P = 2 * (o.w + o.h);
  const dash = o.dash ? P / Math.round(P / o.dash) : 0; // whole number of dashes, no seam
  const mat = shaderMat(SH.PANEL_VERT, SH.PANEL_FRAG, {
    uSize: { value: new THREE.Vector2(o.w, o.h) },
    uRadius: { value: o.r },
    uSeed: { value: o.seed ?? 0.3 },
    uFill: { value: C(o.fill) },
    uFillAlpha: { value: o.fillAlpha ?? 0.97 },
    uStroke: { value: C(o.stroke) },
    uStrokeW: { value: o.strokeW ?? 1.6 },
    uGlowCol: { value: C(o.glow) },
    uSpark: { value: C('#FFFFFF') },
    uDash: { value: dash },
    uDashSpeed: { value: o.dashSpeed ?? 0.18 },
    uBorder: { value: 0 },
    uEntry: { value: o.entry ?? 0 },
    uFillRev: { value: 0 },
    uPulse: { value: 0 },
    uRing: { value: 1 },
    uGrid: { value: o.grid ?? 0 },
    uGlow: { value: o.glowAmt ?? 0.55 },
    uScan: { value: o.scan ?? 1.0 },
    uPulseGlow: { value: o.pulseGlow ?? 0.9 },
    uNoiseFreq: { value: o.noiseFreq ?? 0.05 },
    uNoiseAmp: { value: o.noiseAmp ?? 0.3 },
    uOpacity: { value: 1 },
  });
  return { mesh: quad(o.w + PAD * 2, o.h + PAD * 2, mat, o.order ?? 30), mat };
}
// Arc-length position (0..1) of a named point on a box outline; matches perim() in GLSL.
export function entryParam(w, h, where, offset = 0) {
  const P = 2 * (w + h);
  const s = { top: w / 2 + offset, right: w + h / 2, bottom: w + h + w / 2, left: 2 * w + h + h / 2 }[where];
  return s / P;
}

// A titled card in one of the diagram styles, already added to the scene.
export function makeCard(o) {
  const st = STYLES[o.style];
  const group = new THREE.Group();
  group.position.set(o.x, o.y, o.z ?? 0);
  const panel = makePanel({
    w: o.w,
    h: o.h,
    r: o.r ?? 14,
    seed: o.seed,
    fill: st.fill,
    fillAlpha: st.fillAlpha,
    stroke: st.stroke,
    glow: st.glow,
    dash: st.dash,
    glowAmt: st.glowAmt,
    entry: entryParam(o.w, o.h, o.entry || 'top'),
  });
  const gap = o.sub ? 1 : 0;
  const label = makeLabel(
    o.w,
    o.h,
    (ctx) => {
      line(ctx, o.title, o.w / 2, o.h / 2 - 18 * gap * (o.tight ?? 1), o.titleFont || F_TITLE, 0);
      if (o.sub) line(ctx, o.sub, o.w / 2, o.h / 2 + 21 * (o.tight ?? 1), o.subFont || F_SUB, 1, 'center', 0.2);
    },
    st.title,
    st.sub,
    o.seed
  );
  label.mesh.position.z = 5;
  group.add(panel.mesh, label.mesh);
  scene.add(group);
  return { group, panel, label, time: o.time ?? 0, hits: o.hits ?? [] };
}
// Standard entrance: outline draws, fill scans in, text decodes, one impact pulse.
// Extra `hits` (times) re-trigger the pulse + ring later on.
export function animateCard(card, T) {
  const u = card.panel.mat.uniforms;
  const t0 = card.time;
  u.uBorder.value = ease.out(prog(T, t0, 0.8));
  u.uFillRev.value = ease.inOut(prog(T, t0 + 0.08, 0.8));
  card.label.mat.uniforms.uReveal.value = ease.out(prog(T, t0 + 0.3, 0.8));
  let last = t0;
  for (const h of card.hits) if (T >= h) last = Math.max(last, h);
  u.uPulse.value = T >= t0 ? Math.exp(-(T - last) * 3.2) : 0;
  u.uRing.value = T >= t0 ? clamp01((T - last) / 0.95) : 1;
  card.group.visible = T >= t0;
  card.group.scale.setScalar(0.9 + 0.1 * ease.outBack(prog(T, t0, 0.7)));
}

// ════════════════════════════════════════════════════════════════ paths → ribbons
const unit = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
export function samplePath(pts, r = 0, step = 3) {
  // drop repeated points (a zero-length leg has no direction, which tore corners and arrows)
  pts = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 1e-6);
  // …and corners the path runs straight through (rounding those drew a half-circle loop)
  pts = pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1];
    const b = pts[i + 1];
    const cross = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x);
    const dot = (p.x - a.x) * (b.x - p.x) + (p.y - a.y) * (b.y - p.y);
    return Math.abs(cross) > 1e-6 || dot < 0;
  });
  const out = [];
  const push = (x, y) => {
    const l = out[out.length - 1];
    if (!l || Math.hypot(l.x - x, l.y - y) > 1e-6) out.push({ x, y });
  };
  const lineTo = (a, b) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(L / step));
    for (let i = 0; i <= n; i++) push(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n);
  };
  let start = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const corner = pts[i];
    if (i === pts.length - 1) {
      lineTo(start, corner);
      break;
    }
    const din = unit(corner.x - start.x, corner.y - start.y);
    const dout = unit(pts[i + 1].x - corner.x, pts[i + 1].y - corner.y);
    const A = { x: corner.x - din.x * r, y: corner.y - din.y * r };
    const B = { x: corner.x + dout.x * r, y: corner.y + dout.y * r };
    lineTo(start, A);
    const cx = A.x + dout.x * r;
    const cy = A.y + dout.y * r;
    const a0 = Math.atan2(A.y - cy, A.x - cx);
    let da = Math.atan2(B.y - cy, B.x - cx) - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const n = Math.max(6, Math.round((Math.abs(da) * r) / step));
    for (let k = 1; k <= n; k++) push(cx + Math.cos(a0 + (da * k) / n) * r, cy + Math.sin(a0 + (da * k) / n) * r);
    start = B;
  }
  let acc = 0;
  out.forEach((p, i) => {
    if (i) acc += Math.hypot(p.x - out[i - 1].x, p.y - out[i - 1].y);
    p.u = acc;
  });
  return { pts: out, length: acc };
}
const HALF_W = 24;
export function makeLink(path, o = {}) {
  const ext = 26;
  const src = path.pts;
  const first = unit(src[1].x - src[0].x, src[1].y - src[0].y);
  const lastT = unit(src[src.length - 1].x - src[src.length - 2].x, src[src.length - 1].y - src[src.length - 2].y);
  const pts = [
    { x: src[0].x - first.x * ext, y: src[0].y - first.y * ext, u: -ext },
    ...src,
    { x: src[src.length - 1].x + lastT.x * ext, y: src[src.length - 1].y + lastT.y * ext, u: path.length + ext },
  ];
  const pos = [];
  const aU = [];
  const aV = [];
  const aLevel = [];
  const idx = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const t = unit(b.x - a.x, b.y - a.y);
    for (const side of [-1, 1]) {
      pos.push(p.x - t.y * HALF_W * side, p.y + t.x * HALF_W * side, 0);
      aU.push(p.u);
      aV.push(side);
      aLevel.push(0);
    }
    if (i) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k, k - 1, k + 1);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1));
  geo.setAttribute('aLevel', new THREE.Float32BufferAttribute(aLevel, 1));
  geo.setIndex(idx);
  const pal = o.palette || [PAL.blue, PAL.pink, PAL.white];
  const mat = shaderMat(SH.LINK_VERT, SH.LINK_FRAG, {
    uLen: { value: path.length },
    uDraw: { value: 0 },
    uHalfW: { value: HALF_W },
    uLineW: { value: o.lineW ?? 1.7 },
    uFlow: { value: 0 },
    uSpeed: { value: o.speed ?? FLOW },
    uSpacing: { value: o.spacing ?? SPACING },
    uUOff: { value: o.uOff ?? 0 },
    uDashed: { value: o.dashed ? 1 : 0 },
    uHead: { value: 0 },
    uOpacity: { value: 1 },
    uDie: { value: o.die ?? 0 },
    uLevelZ: { value: 0 },
    uColor: { value: C(o.color || PAL.link) },
    uPalA: { value: C(pal[0]) },
    uPalB: { value: C(pal[1]) },
    uPalC: { value: C(pal[2]) },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  mesh.position.z = o.z ?? 0;
  scene.add(mesh);

  let arrow = null;
  if (o.arrow !== false) {
    const end = src[src.length - 1];
    const am = shaderMat(SH.PANEL_VERT, SH.ARROW_FRAG, { uColor: { value: C(o.color || PAL.link) }, uOpacity: { value: 0 } });
    arrow = quad(36, 36, am, 21);
    arrow.position.set(end.x, end.y, o.z ?? 0);
    arrow.rotation.z = Math.atan2(lastT.y, lastT.x);
    scene.add(arrow);
  }
  return { mesh, mat, arrow, path, t0: o.t0 ?? 0, t1: o.t1 ?? 0 };
}
// Draws the line between t0 and t1 with the hero packet at its tip, then lets packets flow.
export function animateLink(l, T, flow = 1) {
  const u = l.mat.uniforms;
  u.uDraw.value = ease.inOut(prog(T, l.t0, l.t1 - l.t0)) * l.path.length;
  u.uHead.value = T < l.t0 ? 0 : 1 - prog(T, l.t1, 0.45);
  u.uFlow.value = prog(T, l.t1 + 0.1, 0.9) * flow;
  l.mesh.visible = T >= l.t0;
  if (l.arrow) l.arrow.material.uniforms.uOpacity.value = prog(T, l.t1 - 0.08, 0.25);
}

// ════════════════════════════════════════════════════════════════ backdrop + dust
const bgMat = shaderMat(SH.BG_VERT, SH.BG_FRAG, {
  uFocus: { value: new THREE.Vector2() },
  uNebScale: { value: 0.0011 },
  uBase: { value: C('#0B0B11') },
  uColA: { value: C('#2A1F70').multiplyScalar(0.5) },
  uColB: { value: C('#0A3848').multiplyScalar(0.42) },
  uDot: { value: C('#4A4A5E') },
});
bgMat.transparent = false;
const bg = quad(16000, 16000, bgMat, 0);
bg.position.z = -700;
scene.add(bg);

function makeDust(count, zMin, zMax, order, intensity, seed) {
  const rnd = mulberry32(seed);
  const pos = [];
  const seeds = [];
  for (let i = 0; i < count; i++) {
    pos.push((rnd() - 0.5) * 4200, (rnd() - 0.5) * 3200, zMin + rnd() * (zMax - zMin));
    seeds.push(rnd());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const mat = shaderMat(SH.DUST_VERT, SH.DUST_FRAG, {
    uScale: { value: H / (2 * TAN) },
    uFocusZ: { value: 40 },
    uColA: { value: C(PAL.blue) },
    uColB: { value: C(PAL.pink) },
    uIntensity: { value: intensity },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = order;
  points.userData.base = intensity;
  scene.add(points);
  return points;
}
const dust = [makeDust(170, -640, -60, 1, 0.34, 11), makeDust(60, 420, 900, 50, 0.26, 23)];
// A scene with its own look (e.g. the paper-collage effects) can switch these off.
export const backdrop = { bg, dust };

// Orbit-style camera: look at (x, y, z) from `yaw`/`pitch` degrees, framing `h` world units of height.
export function setCamera({ x, y, z = 0, h, yaw = 0, pitch = 0, roll = 0 }, T = 0) {
  const fx = x + Math.sin(T * 0.31) * 5;
  const fy = y + Math.sin(T * 0.23 + 1.1) * 4;
  const ya = rad(yaw + 1.1 * Math.sin(T * 0.37));
  const pi = rad(pitch + 0.7 * Math.sin(T * 0.29 + 1.7));
  const ro = rad(roll);
  const dist = h / (2 * TAN);
  camera.position.set(fx + dist * Math.sin(ya) * Math.cos(pi), fy + dist * Math.sin(pi), z + dist * Math.cos(ya) * Math.cos(pi));
  camera.up.set(Math.sin(ro), Math.cos(ro), 0);
  camera.lookAt(fx, fy, z);
  bgMat.uniforms.uFocus.value.set(fx, fy);
  bgMat.uniforms.uNebScale.value = 0.0011 * Math.pow(600 / h, 0.6);
  for (const d of dust) d.material.uniforms.uIntensity.value = d.userData.base * Math.min(1, Math.max(0.28, 700 / h));
}

// ════════════════════════════════════════════════════════════════ post-processing
const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
const rtScene = new THREE.WebGLRenderTarget(W, H, rtOpts);
const MIPS = 7;
const mips = [];
for (let i = 0; i < MIPS; i++) {
  mips.push(new THREE.WebGLRenderTarget(Math.max(2, Math.round(W / 2 ** (i + 1))), Math.max(2, Math.round(H / 2 ** (i + 1))), rtOpts));
}
const fsGeo = new THREE.BufferGeometry();
fsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
fsGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const fsMesh = new THREE.Mesh(fsGeo);
fsMesh.frustumCulled = false;
const fsScene = new THREE.Scene();
fsScene.add(fsMesh);
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsMat = (fragmentShader, uniforms, extra = {}) =>
  new THREE.ShaderMaterial({ vertexShader: SH.FS_VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending, ...extra });

const downMat = fsMat(SH.DOWN_FRAG, {
  tSrc: { value: null },
  uTexel: { value: new THREE.Vector2() },
  uPrefilter: { value: 0 },
  uThreshold: { value: 0.95 },
  uKnee: { value: 0.45 },
});
const upMat = fsMat(
  SH.UP_FRAG,
  { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
  { blending: THREE.AdditiveBlending, transparent: true, premultipliedAlpha: true }
);
const finalMat = fsMat(SH.FINAL_FRAG, {
  tScene: { value: rtScene.texture },
  tBloom: { value: mips[0].texture },
  uBloom: { value: 1.25 / MIPS },
  uTime: { value: 0 },
  uFade: { value: 1 },
  uGrain: { value: 0.02 },
  uCA: { value: 0.008 },
  uVig: { value: 0.6 },
  uFlat: { value: 0 },
});
timeUniforms.push(finalMat.uniforms.uTime);
// Grade controls a scene may adjust: uBloom, uGrain, uCA (edge colour fringing), uVig (vignette), uFlat (1 = no highlight roll-off).
export const look = finalMat.uniforms;

function pass(mat, target, clear = true) {
  fsMesh.material = mat;
  renderer.setRenderTarget(target);
  if (clear) renderer.clear();
  renderer.render(fsScene, fsCam);
}

// ════════════════════════════════════════════════════════════════ run: playback, UI, export
// `outro` (optional, { t0, t1 }): in show.html, → at the end of the clip first plays this stretch
// of the timeline (the clip's own way out, e.g. a zoom into the next clip), then hands over.
// `fadeIn: false` skips the fade from black (for a clip that continues straight from the previous one).
export function start({ update, duration: DURATION, chapters: CHAPTERS, exportName, autoplay = true, outro = null, fadeIn = true }) {
  // A = the clock for ambient motion (packets, shimmer). It equals T except in live mode,
  // where it keeps running while the timeline holds at the end of a chapter.
  function renderAt(T, A = T) {
    for (const u of timeUniforms) u.value = A;
    update(T);
    finalMat.uniforms.uFade.value = fadeIn ? ease.inOut(prog(T, 0.05, 0.9)) : 1;

    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);

    // bloom: threshold + progressive downsample, then accumulate back up the chain
    let src = rtScene;
    for (let i = 0; i < MIPS; i++) {
      downMat.uniforms.tSrc.value = src.texture;
      downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      downMat.uniforms.uPrefilter.value = i === 0 ? 1 : 0;
      pass(downMat, mips[i]);
      src = mips[i];
    }
    for (let i = MIPS - 2; i >= 0; i--) {
      upMat.uniforms.tSrc.value = mips[i + 1].texture;
      upMat.uniforms.uTexel.value.set(1 / mips[i + 1].width, 1 / mips[i + 1].height);
      pass(upMat, mips[i], false);
    }
    pass(finalMat, null);
  }

  let T = Number(qs.get('t') || 0);
  // Live presenter mode (?live or L): every chapter plays once and then holds;
  // → / Space / Page Down / Enter (or a clicker) continues, ← / Page Up goes back.
  const embedded = qs.has('embed'); // running inside show.html
  // in show.html a sequence plays straight through and only stops at its very end
  const continuous = embedded || qs.has('continuous');
  let live = qs.has('live') || embedded;
  let suspended = embedded && qs.has('suspended');
  let ambient = 0;
  let playing = autoplay && !qs.has('paused') && !live;
  let exporting = false;
  let last = performance.now();
  let status = '';

  const $ = (id) => document.getElementById(id);
  const hud = { play: $('play'), time: $('time'), chapter: $('chapter'), bar: $('bar'), fill: $('fill'), exp: $('export') };
  if (qs.has('clean')) document.body.classList.add('clean');
  CHAPTERS.forEach((c) => {
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = `${(c.t / DURATION) * 100}%`;
    hud.bar.appendChild(tick);
  });
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
  };
  const chapterIndex = (time) => {
    let i = 0;
    CHAPTERS.forEach((c, k) => {
      if (time >= c.t - 1e-3) i = k;
    });
    return i;
  };
  function drawHud() {
    const shown = Math.min(T, DURATION);
    hud.time.textContent = `${fmt(shown)} / ${fmt(DURATION)}`;
    hud.fill.style.width = `${(shown / DURATION) * 100}%`;
    const ci = chapterIndex(T);
    hud.chapter.textContent = status || `${live ? 'LIVE · ' : ''}${ci + 1}/${CHAPTERS.length}  ${CHAPTERS[ci].name}`;
    hud.play.textContent = playing ? '❚❚' : '▶';
  }
  function seek(time) {
    T = Math.max(0, time);
    if (!exporting) renderAt(T, T + ambient);
    drawHud();
  }
  // Live mode stops at checkpoints. A chapter can set `hold`: the moment its last animation
  // has landed. The idle stretch after a hold is fast-forwarded (4×) on the next press,
  // so every press shows one idea and nothing waits on dead time.
  const nextStart = (ci) => (CHAPTERS[ci + 1] ? CHAPTERS[ci + 1].t : DURATION);
  const chapterEnd = (time) => {
    if (outroing) return outro.t1;
    if (continuous) return finalHold();
    const ci = chapterIndex(time);
    const c = CHAPTERS[ci];
    return c.hold != null && time < c.hold - 1e-3 ? c.hold : nextStart(ci);
  };
  const finalHold = () => CHAPTERS[CHAPTERS.length - 1].hold ?? DURATION;
  let rushUntil = 0;
  let outroing = false; // playing the outro stretch (see `outro`)
  function setLive(on) {
    live = on;
    document.body.classList.toggle('clean', on);
    document.body.style.cursor = on ? 'none' : '';
    status = on && !embedded ? 'Live: → / clicker next checkpoint · Space pause · ← back · L leaves' : '';
    if (on) setTimeout(() => (status = ''), 3000);
    drawHud();
  }
  function liveNext() {
    if (continuous) {
      // The clip plays straight through; → steps to the next chapter (keeping play / pause),
      // from the last chapter it lands on the end, and at the end it hands over to the next clip.
      const end = finalHold();
      const ci = chapterIndex(T);
      if (!playing && T - CHAPTERS[0].t < 0.05) {
        playing = true; // waiting at the very start (the show's first clip): → starts it
      } else if (T >= end - 2e-3) {
        if (outro && !outroing && T < outro.t0) {
          T = outro.t0; // play the clip's way out first; the next clip follows when it lands
          outroing = true;
          playing = true;
        } else if (embedded) parent.postMessage({ type: 'reel-next' }, '*');
      } else if (ci < CHAPTERS.length - 1) seek(CHAPTERS[ci + 1].t);
      else {
        playing = false;
        seek(end - 1e-3);
      }
      drawHud();
      return;
    }
    if (playing) {
      // impatient press: land on the end of what is playing
      if (T < rushUntil) T = rushUntil;
      T = chapterEnd(T) - 1e-3;
      playing = false;
      rushUntil = 0;
    } else {
      const ci = chapterIndex(T);
      const c = CHAPTERS[ci];
      const atHold = c.hold != null && T >= c.hold - 2e-3;
      if (ci === CHAPTERS.length - 1 && (atHold || T >= DURATION - 2e-3)) {
        if (embedded) parent.postMessage({ type: 'reel-next' }, '*'); // last checkpoint: next sequence
      } else {
        if (atHold) rushUntil = nextStart(ci);
        playing = true;
      }
    }
    drawHud();
  }
  function liveBack() {
    outroing = false;
    if (continuous) {
      // ← goes to the start of this chapter, or the previous one if it just started;
      // at the very start of the clip it hands back to the previous clip.
      const ci = chapterIndex(T);
      const into = T - CHAPTERS[ci].t;
      if (ci === 0 && into <= 0.6) {
        if (embedded) return parent.postMessage({ type: 'reel-prev' }, '*');
        return seek(CHAPTERS[0].t);
      }
      if (T >= finalHold() - 2e-3) playing = true; // the clip had finished: replay from there
      seek(into > 0.6 ? CHAPTERS[ci].t : CHAPTERS[ci - 1].t);
      return;
    }
    const ci = chapterIndex(T);
    if (embedded && ci === 0 && T - CHAPTERS[0].t <= 0.6) return parent.postMessage({ type: 'reel-prev' }, '*');
    T = T - CHAPTERS[ci].t > 0.6 || ci === 0 ? CHAPTERS[ci].t : CHAPTERS[ci - 1].t;
    rushUntil = 0;
    playing = true;
    drawHud();
  }
  const toggle = () => {
    if (exporting) return;
    if (!playing && T >= DURATION) T = 0;
    playing = !playing;
    drawHud();
  };
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!exporting && !suspended) {
      // Past the end the timeline holds its final pose while ambient motion keeps running.
      if (playing) {
        const rush = T < rushUntil;
        const end = rush ? Infinity : chapterEnd(T);
        T += dt * (rush ? 4 : 1);
        if (rush && T >= rushUntil) T = rushUntil; // through the idle stretch: carry on into the next chapter
        else if (live && T >= end - 1e-3) {
          T = end - 1e-3; // hold on the checkpoint
          playing = false;
          if (outroing) {
            outroing = false; // the outro has landed: hand over to the next clip
            if (embedded) parent.postMessage({ type: 'reel-next' }, '*');
          }
        }
      } else if (live) {
        ambient += dt; // held: the timeline waits, the packets keep flowing
      }
      renderAt(T, T + ambient);
      drawHud();
    }
    requestAnimationFrame(loop);
  }

  hud.play.addEventListener('click', toggle);
  hud.exp.addEventListener('click', () => exportMP4());
  hud.bar.addEventListener('pointerdown', (e) => {
    const move = (ev) => {
      const r = hud.bar.getBoundingClientRect();
      seek(clamp01((ev.clientX - r.left) / r.width) * DURATION);
    };
    move(e);
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    // live: → / clicker plays to the next checkpoint; Space just pauses / resumes where it is
    if (live && (k === 'ArrowRight' || k === 'PageDown' || k === 'Enter' || k === 'ArrowDown')) liveNext();
    else if (live && (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp')) liveBack();
    else if (k === 'l' || k === 'L') setLive(!live);
    else if (k === ' ') toggle();
    else if (k === 'ArrowRight') seek(e.shiftKey ? T + 1 : CHAPTERS[Math.min(CHAPTERS.length - 1, chapterIndex(T) + 1)].t);
    else if (k === 'ArrowLeft') {
      const ci = chapterIndex(T);
      seek(e.shiftKey ? T - 1 : T - CHAPTERS[ci].t > 0.6 ? CHAPTERS[ci].t : CHAPTERS[Math.max(0, ci - 1)].t);
    } else if (k === '.') {
      playing = false;
      seek(T + 1 / FPS);
    } else if (k === ',') {
      playing = false;
      seek(T - 1 / FPS);
    } else if (k >= '1' && k <= String(Math.min(9, CHAPTERS.length))) seek(CHAPTERS[Number(k) - 1].t);
    else if (k === 'r' || k === 'R') {
      playing = true;
      seek(0);
    } else if (k === 'h' || k === 'H') document.body.classList.toggle('clean');
    else if (k === 'f' || k === 'F') (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
    else if (k === 'e' || k === 'E') exportMP4();
    else return;
    e.preventDefault();
  }
  addEventListener('keydown', onKey);
  // Inside the stitched presentation (show.html) the page takes keys from its parent,
  // and asks it for the next / previous sequence at either end.
  addEventListener('message', (ev) => {
    const m = ev.data || {};
    if (m.type === 'key') onKey({ key: m.key, shiftKey: !!m.shiftKey, preventDefault() {} });
    else if (m.type === 'activate') {
      suspended = false;
      outroing = false;
      if (m.at === 'end') {
        T = finalHold() - 1e-3;
        rushUntil = 0;
        playing = false;
      } else if (m.at === 'start') {
        T = 0;
        rushUntil = 0;
        ambient = 0; // the ambient clock restarts too, so a clip always starts on the same frame
        playing = !!m.play;
      }
      last = performance.now();
    } else if (m.type === 'suspend') {
      suspended = true;
      playing = false;
    }
  });
  let idleTimer = 0;
  const wake = () => {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => playing && !exporting && document.body.classList.add('idle'), 2600);
  };
  addEventListener('pointermove', wake);
  addEventListener('keydown', wake);
  wake();
  if (live) setLive(true);

  // Offline export: steps the timeline one frame at a time (never drops a frame,
  // independent of how fast this machine is) and encodes H.264 into an MP4.
  const yieldChannel = new MessageChannel();
  const yieldToLoop = () =>
    new Promise((resolve) => {
      yieldChannel.port1.onmessage = () => resolve();
      yieldChannel.port2.postMessage(0);
    });

  async function exportMP4({ from = 0, to = DURATION, bitrate = 24e6, name = exportName, dir = '' } = {}) {
    if (exporting) return null;
    if (!('VideoEncoder' in window)) {
      status = 'This browser has no WebCodecs encoder — open the page in Brave or Chrome.';
      drawHud();
      return null;
    }
    exporting = true;
    playing = false;
    document.body.classList.remove('idle');
    const resumeAt = T;
    try {
      const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
      let config = null;
      for (const codec of ['avc1.64002A', 'avc1.640033', 'avc1.4D402A', 'avc1.42E02A']) {
        const cfg = { codec, width: W, height: H, bitrate, framerate: FPS, latencyMode: 'quality' };
        const res = await VideoEncoder.isConfigSupported(cfg).catch(() => null);
        if (res && res.supported) {
          config = cfg;
          break;
        }
      }
      if (!config) throw new Error('No H.264 encoder available in this browser.');

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: W, height: H, frameRate: FPS },
        fastStart: 'in-memory',
      });
      let failure = null;
      const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) });
      encoder.configure(config);

      const total = Math.round((to - from) * FPS);
      const micros = 1e6 / FPS;
      for (let i = 0; i < total; i++) {
        if (failure) throw failure;
        renderAt(from + i / FPS);
        const frame = new VideoFrame(canvas, { timestamp: Math.round(i * micros), duration: Math.round(micros) });
        encoder.encode(frame, { keyFrame: i % FPS === 0 });
        frame.close();
        while (encoder.encodeQueueSize > 6) await yieldToLoop();
        if (i % 6 === 0) {
          status = `Rendering frame ${i + 1} / ${total}`;
          T = from + i / FPS;
          drawHud();
          await yieldToLoop();
        }
      }
      await encoder.flush();
      if (failure) throw failure;
      muxer.finalize();
      const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });

      let where = '';
      try {
        const res = await fetch(`/save?name=${encodeURIComponent(name)}&dir=${encodeURIComponent(dir)}`, { method: 'POST', body: blob });
        if (!res.ok) throw new Error('save endpoint unavailable');
        where = (await res.json()).path;
      } catch {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        where = `Downloads/${name}`;
      }
      status = `Saved ${where} (${(blob.size / 1e6).toFixed(1)} MB, ${total} frames, ${config.codec})`;
      return { path: where, bytes: blob.size, frames: total, codec: config.codec };
    } catch (e) {
      status = `Export failed: ${e.message || e}`;
      console.error(e);
      return { error: String(e.message || e) };
    } finally {
      exporting = false;
      T = resumeAt;
      last = performance.now();
      drawHud();
      setTimeout(() => {
        status = '';
      }, 9000);
    }
  }

  window.reel = { seek, renderAt, exportMP4, CHAPTERS, DURATION, play: () => (playing = true), pause: () => (playing = false), get time() { return T; } };
  addEventListener('error', (e) => {
    const el = $('err');
    el.style.display = 'grid';
    el.textContent = `${e.message}\n${e.filename || ''}:${e.lineno || ''}`;
  });
  requestAnimationFrame(loop);
}
