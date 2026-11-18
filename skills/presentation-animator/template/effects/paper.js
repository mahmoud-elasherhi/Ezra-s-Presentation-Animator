// Effect library: an editorial paper-collage look (alternative style, not the default).
// rasterised to mask textures (R = shape, G = ink detail, B = stroke progress)
// and everything about how they look — paper fibre, halftone, torn edges, drop
// shadow, marker ink, draw-on — happens here.
import { COMMON } from '../engine/shaders.js';

// ───────────────────────────────────────────────────────────── paper backdrop
export const PAPER_VERT = /* glsl */ `
varying vec2 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const PAPER_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime, uDark;
varying vec2 vW;
${COMMON}
void main() {
  vec2 p = vW;
  float fib = fbm(p * vec2(0.012, 0.11)) * 0.6 + fbm(p * vec2(0.09, 0.02) + 7.0) * 0.4;
  float blot = fbm(p * 0.0016 + 3.0);
  float grain = vnoise(p * 0.9);
  float speck = step(0.988, hash21(floor(p * 0.45)));
  vec3 col = uColor * (0.92 + 0.11 * fib) * (0.95 + 0.08 * blot) * (0.985 + 0.03 * grain);
  col = mix(col * (1.0 - 0.07 * speck), col + 0.02 * speck, uDark);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ───────────────────────────────────────────────────────────── cut-outs, type, strokes
// Uses LABEL_VERT (vUv).
export const CUT_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor, uInk, uHalfCol;
uniform vec2 uSize, uShadowOff, uWipe;
uniform float uTime, uSeed, uOpacity, uReveal, uDraw, uUseParam, uShadow, uRough, uFiber, uHalftone, uFlash;
varying vec2 vUv;
${COMMON}
void main() {
  vec4 m = texture2D(uMap, vUv);
  vec2 wp = vUv * uSize;
  float a = m.r;

  // torn edge: threshold a blurred copy of the mask against noise
  if (uRough > 0.0) {
    float soft = texture2D(uMap, vUv, 2.5).r;
    float n = vnoise(wp * 0.22 + uSeed * 31.0) - 0.5 + (vnoise(wp * 0.7 + uSeed * 11.0) - 0.5) * 0.5;
    a = smoothstep(0.42, 0.58, soft + n * uRough);
  }
  // hand-drawn strokes draw themselves along the progress stored in B
  if (uUseParam > 0.5) {
    float prm = m.b / max(m.r, 0.02);
    a *= (1.0 - smoothstep(uDraw * 1.04 - 0.012, uDraw * 1.04, prm)) * step(0.001, uDraw);
  }
  // entrance: directional wipe with a slightly ragged front, or a plain fade
  if (dot(uWipe, uWipe) > 0.0) {
    float s = dot(vUv - 0.5, uWipe) + 0.5;
    float n2 = vnoise(wp * 0.05 + uSeed * 3.0) * 0.08;
    a *= 1.0 - smoothstep(uReveal * 1.12 - 0.03, uReveal * 1.12, s + n2);
  } else {
    a *= uReveal;
  }

  // paper body
  float fib = fbm(wp * vec2(0.02, 0.16) + uSeed * 9.0);
  vec3 col = uColor * (1.0 - uFiber * (0.16 * fib + 0.06 * vnoise(wp * 0.9)));
  // 45° dot screen, heavier toward the bottom-right
  if (uHalftone > 0.0) {
    vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * wp / 7.0;
    float dd = length(fract(hp) - 0.5);
    float tone = clamp((vUv.x - vUv.y) * 0.5 + 0.5, 0.0, 1.0) * uHalftone;
    float dotA = 1.0 - smoothstep(tone * 0.5 - 0.06, tone * 0.5 + 0.06, dd);
    col = mix(col, uHalfCol, dotA * step(0.03, tone));
  }
  col = mix(col, uInk, m.g);
  col = mix(col, vec3(1.0), uFlash);

  float sh = texture2D(uMap, vUv - uShadowOff, 3.0).r * uShadow * uReveal;
  float alpha = a + sh * (1.0 - a);
  gl_FragColor = vec4(col * a, alpha) * uOpacity;
}
`;

// ───────────────────────────────────────────────────────────── highlighter bar
// Uses PANEL_VERT (vP = local position).
export const MARKER_FRAG = /* glsl */ `
uniform vec2 uSize;
uniform vec3 uColor;
uniform float uProg, uSeed, uOpacity, uTime;
varying vec2 vP;
${COMMON}
void main() {
  vec2 p = vP;
  vec2 b = uSize * 0.5;
  float streak = vnoise(vec2(p.x * 0.02, p.y * 0.5) + uSeed * 7.0);
  float edgeY = b.y - 3.0 - vnoise(vec2(p.x * 0.06, uSeed * 5.0 + sign(p.y) * 3.0)) * 5.0;
  float inY = 1.0 - smoothstep(edgeY - 1.5, edgeY + 1.5, abs(p.y));
  float x01 = (p.x + b.x) / uSize.x;
  float front = uProg * 1.06 - 0.03 + (vnoise(vec2(p.y * 0.25, uSeed * 3.0)) - 0.5) * 0.03;
  float inX = (1.0 - smoothstep(front - 0.01, front, x01)) * smoothstep(0.0, 0.012, x01 - vnoise(vec2(p.y * 0.3, uSeed)) * 0.012);
  float a = inY * inX * (0.84 + 0.16 * streak) * step(0.001, uProg);
  gl_FragColor = vec4(uColor * a, a) * uOpacity;
}
`;

// ───────────────────────────────────────────────────────────── map land
export const LAND_VERT = /* glsl */ `
varying vec2 vL;
void main() {
  vL = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LAND_FRAG = /* glsl */ `
uniform vec3 uColor, uHi, uHalfCol;
uniform float uMix, uTime, uSeed, uOpacity, uHatch;
varying vec2 vL;
${COMMON}
void main() {
  float fib = fbm(vL * vec2(0.03, 0.2));
  float n = vnoise(vL * 0.02 + uSeed * 10.0);
  float m = smoothstep(0.0, 0.25, uMix * 1.25 - n * 0.25);
  vec3 base = uColor * (1.0 - 0.1 * fib);
  vec3 hi = uHi * (1.0 - 0.08 * fib);
  vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * vL / 6.0;
  float dd = length(fract(hp) - 0.5);
  hi = mix(hi, uHalfCol, (1.0 - smoothstep(0.16, 0.22, dd)) * uHatch);
  gl_FragColor = vec4(mix(base, hi, m), 1.0) * uOpacity;
}
`;

export const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity, uTime;
void main() {
  gl_FragColor = vec4(uColor, 1.0) * uOpacity;
}
`;

// ───────────────────────────────────────────────────────────── scene wipe
// A slanted paper band sweeps across; the cut happens while it covers the frame.
export const WIPE_FRAG = /* glsl */ `
uniform float uP, uSeed, uTime;
uniform vec3 uColA, uColB;
varying vec2 vUv;
${COMMON}
void main() {
  float s = vUv.x + (1.0 - vUv.y) * 0.22 + (vnoise(vec2(vUv.y * 9.0, uSeed)) - 0.5) * 0.03;
  float lead = -0.12 + uP * 2.95;
  float trail = lead - 1.48;
  float body = step(trail, s) * step(s, lead);
  float stripe = step(lead - 0.07, s) * step(s, lead) + step(trail, s) * step(s, trail + 0.07);
  float on = step(0.001, uP) * step(uP, 0.999);
  vec3 c = mix(uColA, uColB, clamp(stripe, 0.0, 1.0));
  c *= 0.93 + 0.1 * fbm(vUv * vec2(40.0, 300.0));
  gl_FragColor = vec4(c, 1.0) * body * on;
}
`;

// ───────────────────────────────────────────────────────────── going viral
// Dots multiplying outward from one point, exponentially. Uses PANEL_VERT.
export const VIRAL_FRAG = /* glsl */ `
uniform float uT, uSeed, uOpacity, uTime, uMaxR;
uniform vec3 uColor;
varying vec2 vP;
${COMMON}
void main() {
  vec2 p = vP;
  float cell = 34.0;
  vec2 gi = floor(p / cell);
  vec2 jit = vec2(hash21(gi + uSeed), hash21(gi + 17.0 + uSeed));
  vec2 c = (gi + 0.25 + jit * 0.5) * cell;
  float dist = length(c);
  float has = step(hash21(gi * 1.7 + 5.0), 0.6) * (1.0 - smoothstep(uMaxR * 0.8, uMaxR, dist));
  float reached = log(dist / 26.0 + 1.0) / 1.15;
  float age = uT - reached;
  float k = clamp(age / 0.22, 0.0, 1.0);
  float pop = k * (1.0 + 0.7 * (1.0 - k));
  float r = (3.0 + 5.5 * hash21(gi + 3.3)) * pop;
  float d = length(p - c) - r;
  float aa = max(fwidth(d), 1e-3);
  float dotA = (1.0 - smoothstep(-aa, aa, d)) * step(0.0, age) * has;
  float R = 26.0 * (exp(uT * 1.15) - 1.0);
  float ring = exp(-pow((length(p) - R) / 9.0, 2.0)) * 0.5 * step(0.01, uT) * (1.0 - smoothstep(uMaxR * 0.7, uMaxR, R));
  float a = clamp(dotA + ring, 0.0, 1.0);
  gl_FragColor = vec4(uColor * a, a) * uOpacity;
}
`;
