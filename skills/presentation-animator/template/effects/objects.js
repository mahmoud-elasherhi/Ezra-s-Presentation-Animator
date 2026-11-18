// Effect library: custom objects drawn as SDFs in the same visual language as
// engine/shaders.js (SDF shapes, HDR sparks into bloom). Examples of the technique:
// a storage stick that can crack apart, spinning disks, a three-part triangle diagram,
// status icons (check / cross / lock) and a particle burst.
import { COMMON } from '../engine/shaders.js';

// ───────────────────────────────────────────────────────────── USB stick
// Drawn twice per pixel (left and right fragment) so it can split along a
// noisy crack line. Uses PANEL_VERT (vP = local position in world units).

export const USB_FRAG = /* glsl */ `
uniform float uTime, uReveal, uData, uGlitch, uCrack, uBreak, uHeat, uDead, uSeed, uPulse;
uniform vec3 uFill, uStroke, uGlowCol, uHot, uSpark, uMetal;
varying vec2 vP;
${COMMON}
mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}
float crackX(float y) {
  return -30.0 + (vnoise(vec2(y * 0.09, 7.3)) - 0.5) * 46.0 + (vnoise(vec2(y * 0.4, 2.1)) - 0.5) * 12.0;
}
// rgb: premultiplied colour of the intact stick at q, a: coverage, d: distance to its outline
vec4 stick(vec2 q, float aa, out float d) {
  float dB = sdRoundBox(q - vec2(-45.0, 0.0), vec2(125.0, 56.0), 16.0);
  float dP = sdRoundBox(q - vec2(118.0, 0.0), vec2(42.0, 35.0), 5.0);
  d = min(dB, dP);
  float inB = 1.0 - smoothstep(-aa, aa, dB);
  float inP = (1.0 - smoothstep(-aa, aa, dP)) * (1.0 - inB);

  vec3 body = uFill * (1.0 + 0.5 * q.y / 112.0) + uStroke * exp(min(dB, 0.0) / 9.0) * 0.15;
  float tt = fract(uTime * 0.09 + uSeed) * 4.0 - 1.5;
  body += uStroke * exp(-pow(((q.x + q.y * 0.7) / 350.0 - tt) * 5.0, 2.0)) * 0.07;

  // stored data: 6 x 3 blocks that light up as uData fills
  vec2 g = (q - vec2(-88.0, -31.0)) / vec2(24.5, 20.6);
  vec2 gi = floor(g);
  float inGrid = step(0.0, g.x) * step(g.x, 6.0) * step(0.0, g.y) * step(g.y, 3.0);
  float bd = sdRoundBox((fract(g) - 0.5) * vec2(24.5, 20.6), vec2(9.5, 7.4), 2.2);
  float blk = (1.0 - smoothstep(-aa, aa, bd)) * inGrid;
  float idx = gi.x + gi.y * 6.0;
  float lit = smoothstep(idx / 18.0, (idx + 1.0) / 18.0, uData);
  float hsh = hash11(idx * 3.17 + 1.3);
  lit *= 1.0 - smoothstep(hsh * 0.6, hsh * 0.6 + 0.3, uDead);
  float fl = 0.72 + 0.28 * sin(uTime * 2.4 + idx * 1.9);
  fl *= mix(1.0, step(0.35, hash11(idx + floor(uTime * 22.0) * 0.37)), uGlitch);
  vec3 blockCol = mix(uGlowCol, uHot, clamp(uHeat + uGlitch * 0.6, 0.0, 1.0));
  body = mix(body, uFill * 0.4, blk * 0.9);
  body += blockCol * blk * lit * fl * 1.5;

  // activity LED
  vec2 lp = q - vec2(-150.0, 36.0);
  body += mix(uGlowCol, uHot, uHeat) * exp(-dot(lp, lp) / 12.0) * (0.55 + 0.45 * sin(uTime * 5.0)) * (1.0 - uDead) * 2.4;

  // metal plug with its two contact windows
  vec3 plug = uMetal * (0.8 + 0.5 * q.y / 70.0);
  float hole = max(abs(q.x - 126.0) - 10.0, abs(abs(q.y) - 14.0) - 5.5);
  plug *= 1.0 - 0.78 * (1.0 - smoothstep(-aa, aa, hole));

  float sA = 1.0 - smoothstep(0.8 - aa, 0.8 + aa, abs(d));
  vec3 sc = mix(uStroke, uHot, uHeat * 0.8) * (1.0 + uPulse * 2.5);
  vec3 col = body * inB + plug * inP;
  float a = max(inB, inP);
  col = col * (1.0 - sA) + sc * sA;
  a = a + sA * (1.0 - a);
  return vec4(col, a);
}

void main() {
  vec2 p = vP;
  float aa = max(fwidth(vP.x) + fwidth(vP.y), 1e-3) * 0.75;

  // under stress, horizontal slices of the stick jump sideways
  float row = floor(p.y / 9.0);
  float j = hash11(row * 1.31 + floor(uTime * 28.0) * 0.77) - 0.5;
  p.x += j * 16.0 * uGlitch * step(0.3, abs(j));

  // the two fragments drift and rotate apart as uBreak goes 0 → 1
  float b = uBreak;
  vec2 pivL = vec2(-120.0, 0.0);
  vec2 pivR = vec2(100.0, 0.0);
  vec2 qL = rot(0.075 * b) * (p - pivL - vec2(-10.0, -6.0) * b) + pivL;
  vec2 qR = rot(-0.11 * b) * (p - pivR - vec2(15.0, -12.0) * b) + pivR;
  float cL = crackX(qL.y);
  float cR = crackX(qR.y);
  float mL = 1.0 - smoothstep(-aa, aa, qL.x - cL);
  float mR = smoothstep(-aa, aa, qR.x - cR);
  float dL;
  float dR;
  vec4 sL = stick(qL, aa, dL);
  vec4 sR = stick(qR, aa, dR);
  vec3 col = sL.rgb * mL;
  float a = sL.a * mL;
  col += sR.rgb * mR * (1.0 - a);
  a += sR.a * mR * (1.0 - a);

  // dead: colour drains out
  float lum = dot(col, vec3(0.3, 0.5, 0.2));
  col = mix(col, vec3(lum) * 0.5, uDead * 0.85);

  // entrance: scan in from the left
  float rOn = step(0.0005, uReveal);
  float n = vnoise(vP * 0.05 + uSeed * 9.0);
  float wipe = uReveal * 1.5 - ((vP.x + 175.0) / 340.0 * 0.8 + n * 0.3);
  float rm = smoothstep(0.0, 0.1, wipe) * rOn;
  float front = exp(-abs(wipe - 0.02) * 30.0) * rOn * (1.0 - smoothstep(0.8, 1.0, uReveal));

  vec3 add = uSpark * front * a * 1.1;
  // hairline crack racing down before the split
  float crackOn = step(56.0 - 112.0 * uCrack, vP.y) * step(0.001, uCrack);
  float crackLine = exp(-abs(vP.x - crackX(vP.y)) / 1.3) * sL.a * crackOn * (1.0 - smoothstep(0.0, 0.3, b));
  add += mix(uSpark, uHot, 0.5) * crackLine * 3.2;
  // glowing fracture edges after the split
  float eL = exp(-abs(qL.x - cL) / 3.5) * sL.a * mL;
  float eR = exp(-abs(qR.x - cR) / 3.5) * sR.a * mR;
  add += uHot * (eL + eR) * uHeat * 3.0 * step(0.001, b);
  // soft halo while alive
  float dMin = min(dL + smoothstep(0.0, 30.0, qL.x - cL) * 1e3, dR + smoothstep(0.0, 30.0, cR - qR.x) * 1e3);
  vec3 halo = mix(uGlowCol, uHot, uHeat) * exp(-max(dMin, 0.0) / 14.0) * (1.0 - a) * (0.2 + uPulse * 0.8) * (1.0 - uDead);
  halo *= smoothstep(0.55, 1.0, uReveal);

  gl_FragColor = vec4((col + add) * rm + halo, a * rm);
}
`;

// ───────────────────────────────────────────────────────────── RAID disk

export const DISK_FRAG = /* glsl */ `
uniform float uTime, uReveal, uLevel, uBad, uPulse, uSeed, uWrite, uVerify;
uniform vec3 uFill, uStroke, uOk, uBadCol, uCheck;
varying vec2 vP;
${COMMON}
void main() {
  vec2 p = vP;
  float aa = max(fwidth(p.x) + fwidth(p.y), 1e-3) * 0.75;
  float d = sdRoundBox(p, vec2(46.0, 60.0), 9.0);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  vec3 col = uFill * (1.0 + 0.5 * p.y / 120.0) + uStroke * exp(min(d, 0.0) / 8.0) * 0.14;

  // eight data slabs filling from the bottom
  float gy = (p.y + 48.0) / 10.5;
  float gi = floor(gy);
  float inRows = step(0.0, gy) * step(gy, 8.0);
  float sd = sdRoundBox(vec2(p.x, (fract(gy) - 0.5) * 10.5), vec2(33.0, 3.6), 1.6);
  float slab = (1.0 - smoothstep(-aa, aa, sd)) * inRows;
  float lit = smoothstep(gi / 8.0, (gi + 1.0) / 8.0, uLevel);
  float headRow = exp(-pow((gy - uLevel * 8.0) * 1.1, 2.0)) * uWrite;
  vec3 sc = mix(uOk, uBadCol, uBad);
  float flick = mix(1.0, 0.5 + 0.5 * step(0.4, hash11(gi * 2.3 + floor(uTime * 24.0) * 0.61 + uSeed)), uBad);
  col = mix(col, uFill * 0.4, slab * 0.9);
  col += sc * slab * (lit * (0.8 + 0.2 * sin(uTime * 2.0 + gi * 1.3 + uSeed * 9.0)) + headRow * 1.8) * flick * 1.3;

  // integrity pass: a scan line climbs the disk and every slab it has checked flashes green
  float vOn = sin(3.14159265 * clamp(uVerify, 0.0, 1.0));
  float vy = mix(-56.0, 44.0, uVerify);
  float scanLine = exp(-abs(p.y - vy) / 2.0) * step(abs(p.x), 40.0);
  float checked = slab * (1.0 - smoothstep(vy - 12.0, vy + 2.0, p.y)) * exp(-max(vy - p.y, 0.0) / 30.0);
  col += uCheck * (scanLine * 2.4 + checked * 1.1) * vOn;

  // status LED + label strip
  vec2 lp = p - vec2(30.0, 49.0);
  col += sc * exp(-dot(lp, lp) / 7.0) * mix(0.8, 0.5 + 0.5 * sin(uTime * 16.0), uBad) * 2.6;
  float nb = sdRoundBox(p - vec2(-18.0, 49.0), vec2(16.0, 2.0), 1.0);
  col += uStroke * (1.0 - smoothstep(-aa, aa, nb)) * 0.35;

  float sA = 1.0 - smoothstep(0.8 - aa, 0.8 + aa, abs(d));
  vec3 stc = mix(uStroke, uBadCol, uBad) * (1.0 + uPulse * 2.5);
  vec3 rgb = col * inside * (1.0 - sA) + stc * sA;
  float a = inside + sA * (1.0 - inside);
  float og = exp(-max(d, 0.0) / 12.0) * (1.0 - inside) * (uPulse * 0.9 + uBad * (0.35 + 0.25 * sin(uTime * 16.0)));
  rgb += sc * og * 0.5;
  gl_FragColor = vec4(rgb, a) * uReveal;
}
`;

// ───────────────────────────────────────────────────────────── icons (check, cross, lock)
// Uses LABEL_VERT (vUv). Check and cross draw themselves stroke by stroke.

export const ICON_FRAG = /* glsl */ `
uniform float uIcon, uReveal, uTime, uGlow;
uniform vec3 uColor;
varying vec2 vUv;
${COMMON}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float aa = max(fwidth(p.x) + fwidth(p.y), 1e-4) * 0.75;
  float r = uReveal;
  float w = 0.095;
  float a = 0.0;
  if (uIcon < 0.5) {
    vec2 A = vec2(-0.52, 0.0);
    vec2 B = vec2(-0.14, -0.4);
    vec2 E = vec2(0.56, 0.44);
    float l1 = length(B - A);
    float l2 = length(E - B);
    float t1 = clamp(r * (l1 + l2) / l1, 0.001, 1.0);
    float t2 = clamp((r * (l1 + l2) - l1) / l2, 0.0, 1.0);
    float d = sdSeg(p, A, mix(A, B, t1));
    if (t2 > 0.0) d = min(d, sdSeg(p, B, mix(B, E, max(t2, 0.001))));
    a = (1.0 - smoothstep(w - aa, w + aa, d)) * step(0.001, r);
  } else if (uIcon < 1.5) {
    vec2 A = vec2(-0.44, 0.44);
    vec2 B = vec2(0.44, -0.44);
    vec2 E = vec2(0.44, 0.44);
    vec2 F = vec2(-0.44, -0.44);
    float t1 = clamp(r * 2.0, 0.001, 1.0);
    float t2 = clamp(r * 2.0 - 1.0, 0.0, 1.0);
    float d = sdSeg(p, A, mix(A, B, t1));
    if (t2 > 0.0) d = min(d, sdSeg(p, E, mix(E, F, max(t2, 0.001))));
    a = (1.0 - smoothstep(w - aa, w + aa, d)) * step(0.001, r);
  } else {
    float body = sdRoundBox(p - vec2(0.0, -0.24), vec2(0.5, 0.36), 0.1);
    vec2 sp = p - vec2(0.0, 0.12);
    float arc = max(abs(length(sp) - 0.32) - 0.075, -sp.y);
    float legs = min(sdSeg(p, vec2(-0.32, 0.13), vec2(-0.32, 0.06)), sdSeg(p, vec2(0.32, 0.13), vec2(0.32, 0.06))) - 0.075;
    float d = min(body, min(arc, legs));
    float hole = min(length(p - vec2(0.0, -0.18)) - 0.1, sdRoundBox(p - vec2(0.0, -0.31), vec2(0.035, 0.1), 0.03));
    a = (1.0 - smoothstep(-aa, aa, d)) * smoothstep(-aa, aa, hole) * r;
  }
  gl_FragColor = vec4(uColor * a * (1.0 + uGlow), a);
}
`;

// ───────────────────────────────────────────────────────────── CIA triad
// Three nodes (0 = top, 1 = bottom-left, 2 = bottom-right) joined by edges.
// Healthy edges carry circulating energy; an edge touching a failed node
// breaks into flickering red dashes.

export const TRIAD_FRAG = /* glsl */ `
uniform float uR, uTime, uFlow;
uniform vec3 uOn, uBad, uEdge, uPulse;
uniform vec3 uOk, uBadCol, uSpark;
varying vec2 vP;
${COMMON}
float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

void edgeDraw(vec2 p, vec2 a, vec2 b, float badA, float badB, float draw, float k, float aa,
              inout vec3 rgb, inout float alpha, inout vec3 add) {
  float len = length(b - a);
  vec2 dir = (b - a) / len;
  float inset = 33.0;
  float L = len - 2.0 * inset;
  vec2 pa = p - (a + dir * inset);
  float h = clamp(dot(pa, dir) / L, 0.0, 1.0);
  float d = length(pa - dir * h * L);
  float badE = max(badA, badB);
  vec3 col = mix(mix(uOk, uBadCol, badA), mix(uOk, uBadCol, badB), h);
  float on = step(0.001, draw);
  float front = draw * 1.03;
  float vis = (1.0 - smoothstep(front - 0.02, front, h)) * on;
  float lineA = 1.0 - smoothstep(0.9 - aa, 0.9 + aa, d);
  float dashes = step(fract(h * L / 13.0 - uTime * 0.4), 0.5);
  float flick = 0.55 + 0.45 * step(0.3, hash11(floor(uTime * 18.0) * 0.7 + k * 3.1));
  lineA *= mix(1.0, dashes * flick, badE) * vis;
  rgb = rgb * (1.0 - lineA) + col * mix(0.8, 0.6, badE) * lineA;
  alpha += lineA * (1.0 - alpha);
  float dl = fract(uTime * 0.16 - (k + h) / 3.0);
  float comet = exp(-dl * 16.0) + exp(-fract(dl + 0.5) * 16.0);
  add += mix(col, uSpark, 0.45) * comet * exp(-d * d / 5.0) * uFlow * (1.0 - badE) * vis * 2.4;
  float head = exp(-abs(h - front) * L / 9.0) * exp(-d / 2.4) * on * (1.0 - step(0.985, draw));
  add += uSpark * head * 3.0;
}

void nodeDraw(vec2 p, vec2 c, float on, float bad, float pulse, float aa,
              inout vec3 rgb, inout float alpha, inout vec3 add) {
  float d = length(p - c) - 26.0;
  vec3 col = mix(uOk, uBadCol, bad);
  on *= mix(1.0, 0.7 + 0.3 * step(0.25, hash11(floor(uTime * 14.0) * 0.83 + c.x)), bad);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float fa = inside * 0.94 * on;
  rgb = rgb * (1.0 - fa) + (vec3(0.010, 0.011, 0.018) + col * 0.13 * (1.0 + pulse * 2.0)) * fa;
  alpha += fa * (1.0 - alpha);
  float ra = (1.0 - smoothstep(0.9 - aa, 0.9 + aa, abs(d))) * on;
  rgb = rgb * (1.0 - ra) + col * (1.0 + pulse * 2.5) * ra;
  alpha += ra * (1.0 - alpha);
  add += col * exp(-max(d, 0.0) / 12.0) * (1.0 - inside) * (0.2 + pulse * 0.9) * on;
  float ring = exp(-pow((d - (1.0 - pulse) * 46.0) / 2.6, 2.0)) * pulse * pulse * step(0.0, d);
  add += col * ring * 1.5 * on;
}

void main() {
  vec2 p = vP;
  float aa = max(fwidth(p.x) + fwidth(p.y), 1e-3) * 0.75;
  vec2 v0 = vec2(0.0, uR);
  vec2 v1 = vec2(-0.8660254 * uR, -0.5 * uR);
  vec2 v2 = vec2(0.8660254 * uR, -0.5 * uR);
  vec3 rgb = vec3(0.0);
  float alpha = 0.0;
  vec3 add = vec3(0.0);

  float side = length(v1 - v0);
  float tri = min(min(cross2(v1 - v0, p - v0), cross2(v2 - v1, p - v1)), cross2(v0 - v2, p - v2)) / side;
  add += uOk * smoothstep(0.0, 2.0, tri) * uFlow * (0.016 + 0.035 * exp(-max(tri, 0.0) / 16.0));

  edgeDraw(p, v0, v1, uBad.x, uBad.y, uEdge.x, 0.0, aa, rgb, alpha, add);
  edgeDraw(p, v1, v2, uBad.y, uBad.z, uEdge.y, 1.0, aa, rgb, alpha, add);
  edgeDraw(p, v2, v0, uBad.z, uBad.x, uEdge.z, 2.0, aa, rgb, alpha, add);
  nodeDraw(p, v0, uOn.x, uBad.x, uPulse.x, aa, rgb, alpha, add);
  nodeDraw(p, v1, uOn.y, uBad.y, uPulse.y, aa, rgb, alpha, add);
  nodeDraw(p, v2, uOn.z, uBad.z, uPulse.z, aa, rgb, alpha, add);

  gl_FragColor = vec4(rgb + add, alpha);
}
`;

// ───────────────────────────────────────────────────────────── debris burst

export const BURST_VERT = /* glsl */ `
attribute vec3 aVel;
attribute float aSeed;
uniform float uT, uScale;
varying float vA;
varying float vT;
void main() {
  float t = max(uT, 0.0);
  float k = 1.0 - exp(-t * 1.5);
  vec3 p = position + aVel * k + vec3(0.0, -22.0 * t * t, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = mix(2.6, 0.9, clamp(t / 3.0, 0.0, 1.0)) * (0.5 + aSeed);
  gl_PointSize = clamp(size * uScale / max(-mv.z, 1.0) * 2.0, 1.0, 40.0);
  vA = step(0.0, uT) * exp(-t * (0.45 + aSeed * 0.9));
  vT = t;
  gl_Position = projectionMatrix * mv;
}
`;

export const BURST_FRAG = /* glsl */ `
uniform vec3 uHot, uCool;
varying float vA;
varying float vT;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float disc = 1.0 - smoothstep(0.5, 1.0, r);
  vec3 c = mix(uHot, uCool, smoothstep(0.2, 1.6, vT));
  gl_FragColor = vec4(c * disc * vA * 2.6, 0.0);
}
`;
