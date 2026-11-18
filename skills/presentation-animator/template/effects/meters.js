// Effect library: a hardware "slab" that stacks sit on, and comparison meters (bars).
// and the three-step comparison meters. Both use PANEL_VERT (vP = local position).
import { COMMON } from '../engine/shaders.js';

// ───────────────────────────────────────────────────────────── hardware slab
// A strip of circuit board: traces with signals running along them, a CPU, RAM.
// uInfect spreads a breach outward from uOrigin; uSafe turns the board green.

export const HARDWARE_FRAG = /* glsl */ `
uniform float uTime, uReveal, uInfect, uSafe, uPulse, uSeed;
uniform vec2 uOrigin, uSize;
uniform vec3 uFill, uStroke, uTrace, uBad, uGood, uSpark;
varying vec2 vP;
${COMMON}
void main() {
  vec2 p = vP;
  vec2 b = uSize * 0.5;
  float aa = max(fwidth(p.x) + fwidth(p.y), 1e-3) * 0.75;
  float d = sdRoundBox(p, b, 10.0);
  float inside = 1.0 - smoothstep(-aa, aa, d);

  // breach front
  float on = step(0.001, uInfect);
  float dist = length((p - uOrigin) * vec2(1.0, 2.0)) + (vnoise(p * 0.07 + uSeed * 5.0) - 0.5) * 70.0;
  float reach = uInfect * (uSize.x + 140.0);
  float inf = (1.0 - smoothstep(reach - 26.0, reach, dist)) * on;
  float front = exp(-abs(dist - reach) / 8.0) * on * (1.0 - smoothstep(0.8, 1.0, uInfect));
  vec3 tc = mix(mix(uTrace, uGood, uSafe), uBad, inf);

  vec3 col = uFill * (1.0 + 0.5 * p.y / uSize.y) + uStroke * exp(min(d, 0.0) / 9.0) * 0.14;

  // traces: horizontal lanes broken into segments, with a via at each segment end
  float lane = 7.5;
  float ry = p.y / lane + 0.5;
  float ri = floor(ry);
  float fy = (fract(ry) - 0.5) * lane;
  float cw = 24.0;
  float rx = p.x / cw + hash11(ri * 1.7 + uSeed * 3.0);
  float ci = floor(rx);
  float fx = fract(rx) * cw;
  float hC = step(0.45, hash21(vec2(ci, ri) + uSeed * 17.0));
  float hL = step(0.45, hash21(vec2(ci - 1.0, ri) + uSeed * 17.0));
  float hR = step(0.45, hash21(vec2(ci + 1.0, ri) + uSeed * 17.0));
  float lineA = (1.0 - smoothstep(0.5 - aa, 0.5 + aa, abs(fy))) * hC;
  float viaL = (1.0 - smoothstep(1.6 - aa, 1.6 + aa, length(vec2(fx, fy)))) * hC * (1.0 - hL);
  float viaR = (1.0 - smoothstep(1.6 - aa, 1.6 + aa, length(vec2(fx - cw, fy)))) * hC * (1.0 - hR);
  float dir = hash11(ri * 5.3 + uSeed) > 0.5 ? 1.0 : -1.0;
  float pu = fract(p.x / 170.0 * dir - uTime * (0.2 + 0.35 * hash11(ri * 3.3 + 1.0)) + hash11(ri * 7.7));
  float signal = exp(-pow((pu - 0.5) * 10.0, 2.0)) * lineA;

  // CPU on the right, RAM sticks on the left
  vec2 q = p - vec2(b.x - 62.0, 0.0);
  float dc = sdRoundBox(q, vec2(19.0), 4.0);
  float chipIn = 1.0 - smoothstep(-aa, aa, dc);
  float chipEdge = 1.0 - smoothstep(0.7 - aa, 0.7 + aa, abs(dc));
  float core = 1.0 - smoothstep(-aa, aa, sdRoundBox(q, vec2(8.0), 2.0));
  vec2 aq = abs(q);
  float along = aq.x > aq.y ? q.y : q.x;
  float outer = max(aq.x, aq.y);
  float pins = step(20.5, outer) * step(outer, 25.0) * step(abs(fract(along / 6.0 + 0.5) - 0.5), 0.2) * step(abs(along), 16.0);
  float rxm = p.x + b.x - 38.0;
  float ridx = floor(rxm / 13.0 + 0.5);
  float dr = sdRoundBox(vec2(rxm - ridx * 13.0, p.y), vec2(3.6, 20.0), 1.5);
  float ram = (1.0 - smoothstep(-aa, aa, dr)) * step(-0.5, ridx) * step(ridx, 2.5);

  // keep the middle calm for the label, stay clear of the rim and the components
  float tm = mix(0.2, 1.0, smoothstep(100.0, 150.0, abs(p.x)));
  tm *= 1.0 - smoothstep(-7.0, -2.0, d);
  tm *= smoothstep(5.0, 11.0, dc) * smoothstep(24.0, 32.0, abs(p.x + b.x - 51.0));
  float flick = mix(1.0, 0.55 + 0.45 * step(0.3, hash11(ri + floor(uTime * 20.0) * 0.37)), inf);
  col += tc * (lineA * 0.42 + (viaL + viaR) * 0.8 + signal * 2.2) * tm * flick;
  col = mix(col, uFill * 0.35, chipIn * 0.95);
  col += tc * (chipEdge * 0.9 + core * (0.8 + 0.5 * sin(uTime * 3.0)) * 1.3 + pins * 0.7 * (1.0 - chipIn)) * flick;
  col = mix(col, uFill * 0.5 + tc * 0.35 * (0.8 + 0.2 * sin(uTime * 2.0 + ridx * 2.0)), ram * 0.9);
  col += uBad * front * 2.6;

  float sA = 1.0 - smoothstep(0.8 - aa, 0.8 + aa, abs(d));
  float taken = max(inf, on * smoothstep(0.35, 0.9, uInfect));
  vec3 sc = mix(mix(uStroke, uGood, uSafe), uBad, taken) * (1.0 + uPulse * 2.5);

  // entrance: scan in from the left
  float rOn = step(0.0005, uReveal);
  float n = vnoise(vP * 0.05 + uSeed * 9.0);
  float wipe = uReveal * 1.5 - ((vP.x + b.x) / uSize.x * 0.8 + n * 0.3);
  float rm = smoothstep(0.0, 0.1, wipe) * rOn;
  float scan = exp(-abs(wipe - 0.02) * 30.0) * rOn * (1.0 - smoothstep(0.8, 1.0, uReveal));

  vec3 rgb = col * inside * (1.0 - sA) + sc * sA + uSpark * scan * inside;
  float a = inside + sA * (1.0 - inside);
  float alarm = smoothstep(0.2, 1.0, uInfect) * (0.4 + 0.2 * sin(uTime * 14.0));
  vec3 gc = mix(mix(uTrace, uGood, uSafe), uBad, step(0.2, uInfect));
  vec3 halo = gc * exp(-max(d, 0.0) / 14.0) * (1.0 - inside) * (uPulse * 0.9 + alarm + uSafe * 0.4) * 0.5;
  halo *= smoothstep(0.55, 1.0, uReveal);
  gl_FragColor = vec4(rgb * rm + halo, a * rm);
}
`;

// ───────────────────────────────────────────────────────────── three-step meter

export const BAR_FRAG = /* glsl */ `
uniform float uLevel, uReveal, uTime;
uniform vec3 uColor, uDim;
varying vec2 vP;
${COMMON}
void main() {
  vec2 p = vP;
  float aa = max(fwidth(p.x) + fwidth(p.y), 1e-3) * 0.75;
  vec3 col = vec3(0.0);
  float a = 0.0;
  vec3 add = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float cx = (float(i) - 1.0) * 36.0;
    float ds = sdRoundBox(p - vec2(cx, 0.0), vec2(15.0, 5.0), 2.5);
    float inS = 1.0 - smoothstep(-aa, aa, ds);
    float edge = 1.0 - smoothstep(0.6 - aa, 0.6 + aa, abs(ds));
    float lit = clamp(uLevel - float(i), 0.0, 1.0);
    float fillM = inS * (1.0 - smoothstep(30.0 * lit - 0.5, 30.0 * lit + 0.5, p.x - cx + 15.0)) * step(0.001, lit);
    float tip = exp(-abs(p.x - cx + 15.0 - 30.0 * lit) / 2.0) * inS * step(0.001, lit) * (1.0 - step(0.999, lit));
    col = col * (1.0 - max(fillM, edge)) + uColor * fillM * 1.2 + uDim * edge * (1.0 - fillM);
    a = max(a, max(fillM, edge * 0.9));
    add += uColor * exp(-max(ds, 0.0) / 6.0) * (1.0 - inS) * lit * 0.35 + vec3(1.0) * tip * 1.5;
  }
  gl_FragColor = vec4(col + add, a) * uReveal;
}
`;
