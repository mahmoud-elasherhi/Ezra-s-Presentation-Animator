// All GLSL for the reel. Everything that moves on screen is drawn by one of these
// programs: no textures except the text atlases, no built-in three.js materials.

export const COMMON = /* glsl */ `
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
`;

// ───────────────────────────────────────────────────────────── panels (cards + frames)
// One SDF program draws every box in the diagram: service cards, the dashed
// VLAN / microVM frames, the solid host frame and the legend swatches.

export const PANEL_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const PANEL_FRAG = /* glsl */ `
uniform vec2 uSize;
uniform float uRadius, uTime, uSeed;
uniform vec3 uFill, uStroke, uGlowCol, uSpark;
uniform float uFillAlpha, uStrokeW, uDash, uDashSpeed;
uniform float uBorder, uEntry, uFillRev, uPulse, uRing, uGrid, uGlow, uScan, uOpacity, uPulseGlow, uNoiseFreq, uNoiseAmp;
varying vec2 vP;
${COMMON}

// Arc length along the box outline, clockwise from the top-left corner.
float perim(vec2 p, vec2 b) {
  vec2 q = clamp(p, -b, b);
  vec2 d = b - abs(q);
  float w = 2.0 * b.x;
  float h = 2.0 * b.y;
  float s;
  if (d.y < d.x) {
    s = q.y > 0.0 ? (q.x + b.x) : (w + h + (b.x - q.x));
  } else {
    s = q.x > 0.0 ? (w + (b.y - q.y)) : (2.0 * w + h + (q.y + b.y));
  }
  return s;
}

void main() {
  vec2 b = uSize * 0.5;
  float d = sdRoundBox(vP, b, uRadius);
  float aa = max(fwidth(d), 1e-3);
  float inside = 1.0 - smoothstep(-aa, aa, d);

  // Border grows in both directions from the point where the incoming link enters.
  float P = 2.0 * (uSize.x + uSize.y);
  float s = perim(vP, b);
  float rel = abs(mod(s - uEntry * P + 0.5 * P, P) - 0.5 * P) / (0.5 * P);
  float bFront = uBorder * 1.04;
  float bOn = step(0.0005, uBorder);
  float bMask = (1.0 - smoothstep(bFront - 0.012, bFront, rel)) * bOn;
  float bDone = smoothstep(0.9, 1.0, uBorder);

  // Fill materialises behind a noisy scan front.
  float fOn = step(0.0005, uFillRev);
  float y01 = 0.5 - vP.y / uSize.y;
  float n = vnoise(vP * uNoiseFreq + uSeed * 13.7);
  float wipe = uFillRev * 1.5 - (y01 * 0.8 + n * uNoiseAmp);
  float fMask = smoothstep(0.0, 0.1, wipe) * fOn;
  float fFront = exp(-abs(wipe - 0.02) * 30.0) * fOn * (1.0 - smoothstep(0.8, 1.0, uFillRev));

  vec3 fc = uFill * (1.0 + 0.55 * vP.y / uSize.y);
  float rim = exp(min(d, 0.0) / 9.0);
  fc += uStroke * rim * 0.15;
  float bandPos = (vP.x + vP.y * 0.7) / (uSize.x * 1.4);
  float tt = fract(uTime * 0.09 + uSeed * 0.731) * 4.0 - 1.5;
  float sheen = exp(-pow((bandPos - tt) * 5.0, 2.0));
  fc += uStroke * sheen * 0.07;
  if (uGrid > 0.0) {
    vec2 g = abs(fract(vP / 40.0 - 0.5) - 0.5) * 40.0;
    float gl = 1.0 - smoothstep(0.0, aa * 1.3, min(g.x, g.y) - 0.35);
    fc += uStroke * gl * uGrid;
  }
  fc += uGlowCol * uPulse * 0.28;
  float fillA = inside * fMask * uFillAlpha;

  // Stroke: solid or marching dashes, with a highlight circling the outline.
  float sA = 1.0 - smoothstep(uStrokeW * 0.5 - aa, uStrokeW * 0.5 + aa, abs(d));
  if (uDash > 0.0) {
    float dt = fract(s / uDash - uTime * uDashSpeed);
    float dw = clamp(fwidth(s) / uDash, 0.0, 0.2);
    sA *= smoothstep(0.0, dw, dt) * (1.0 - smoothstep(0.56, 0.56 + dw, dt));
  }
  sA *= bMask;
  float sp = fract(s / P - uTime * 0.045 - uSeed);
  float spot = exp(-pow(min(sp, 1.0 - sp) * P / 70.0, 2.0)) * bDone;
  vec3 sc = uStroke * (1.0 + spot * 1.5 + uPulse * 2.6);

  float headD = abs(rel - bFront) * 0.5 * P;
  float head = exp(-headD / 16.0) * exp(-abs(d) / 2.4) * bOn * (1.0 - bDone);

  // Emissive extras: halo, impact ring, scan line.
  float outside = 1.0 - inside;
  float og = exp(-max(d, 0.0) / 14.0) * outside * (uGlow * bDone * (0.6 + 0.4 * spot) + uPulse * uPulseGlow);
  float ringR = uRing * 50.0;
  float ring = exp(-pow((d - ringR) / (1.6 + uRing * 4.0), 2.0));
  ring *= pow(1.0 - uRing, 2.5) * step(uRing, 0.999) * step(0.0, d) * uPulseGlow;
  vec3 add = uGlowCol * (og * 0.35 + ring * 1.3);
  add += uSpark * head * 3.6;
  add += uSpark * fFront * inside * uScan;

  vec3 rgb = fc * fillA * (1.0 - sA) + sc * sA + add;
  float a = fillA + sA * (1.0 - fillA);
  gl_FragColor = vec4(rgb, a) * uOpacity;
}
`;

// ───────────────────────────────────────────────────────────── text
// Text is rasterised once into a 2-channel atlas (R = title, G = sub line) and
// revealed here with a jittery left-to-right decode.

export const LABEL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LABEL_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColA, uColB;
uniform float uReveal, uTime, uSeed, uOpacity;
varying vec2 vUv;
${COMMON}
void main() {
  float r = uReveal;
  float live = step(0.001, r) * (1.0 - step(0.999, r));
  float row = floor(vUv.y * 10.0);
  float jit = (hash11(row * 1.7 + uSeed * 7.3 + floor(uTime * 30.0) * 0.91) - 0.5) * 0.05 * (1.0 - r) * live;
  vec2 tx = texture2D(uMap, vUv + vec2(jit, 0.0)).rg;
  float n = hash11(floor(vUv.x * 48.0) * 0.37 + uSeed * 3.1 + floor(uTime * 20.0) * 0.13) * 0.1;
  float edge = r * 1.45 - 0.12;
  float x = vUv.x + n * live;
  float m = (1.0 - smoothstep(edge - 0.06, edge, x)) * step(0.001, r);
  float fr = exp(-abs(x - edge) * 22.0) * live;
  vec3 c = uColA * tx.r + uColB * tx.g;
  float a = clamp(tx.r + tx.g, 0.0, 1.0) * m * uOpacity;
  gl_FragColor = vec4(c * m * uOpacity * (1.0 + fr * 4.0), a);
}
`;

// ───────────────────────────────────────────────────────────── links (ribbons with packets)
// A ribbon along each path. vU is arc length in world units, vV runs -1..1 across.
// The shader draws the line, the hero packet that lays it down, and the ambient
// packet stream that keeps flowing afterwards.

export const LINK_VERT = /* glsl */ `
attribute float aU;
attribute float aV;
attribute float aLevel;
uniform float uLevelZ;
varying float vU;
varying float vV;
void main() {
  vU = aU;
  vV = aV;
  vec3 p = position;
  p.z += aLevel * uLevelZ;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const LINK_FRAG = /* glsl */ `
uniform float uLen, uDraw, uHalfW, uLineW, uTime, uFlow, uSpeed, uSpacing, uUOff, uDashed, uHead, uOpacity, uDie;
uniform vec3 uColor, uPalA, uPalB, uPalC;
varying float vU;
varying float vV;
void main() {
  float dist = abs(vV) * uHalfW;
  float aa = max(fwidth(dist), 1e-3);
  float within = step(0.0, vU) * step(vU, uLen);
  float core = (1.0 - smoothstep(uLineW * 0.5 - aa, uLineW * 0.5 + aa, dist)) * within;
  float on = step(0.001, uDraw);
  float drawn = (1.0 - smoothstep(uDraw - 2.0, uDraw, vU)) * on;
  float dash = 1.0;
  if (uDashed > 0.5) {
    float dt = fract(vU / 11.0 - uTime * 0.9);
    dash = step(dt, 0.55);
  }
  float a = core * drawn * dash;
  vec3 col = uColor * a;

  // Ambient packets: comets spaced uSpacing apart, coloured by index.
  float ph = (vU + uUOff) / uSpacing - uTime * uSpeed;
  float id = floor(ph);
  float f = fract(ph);
  float du = (f - 0.8) * uSpacing;
  float tail = du < 0.0 ? exp(du / 30.0) : exp(-du * du / 5.0);
  float across = exp(-dist * dist / 5.5);
  float ends = smoothstep(0.0, 14.0, vU) * (1.0 - smoothstep(uLen - 12.0 - uDie, uLen - 1.0, vU));
  float k = mod(id, 4.0);
  vec3 pc = k < 0.5 ? uPalA : (k < 1.5 ? uPalB : (k < 2.5 ? uPalC : uPalB));
  float halo = exp(-(du * du * 0.5 + dist * dist) / 60.0);
  col += pc * (tail * across * 2.6 + halo * 0.5) * ends * drawn * uFlow * within;

  // Hero packet: rides the front of the line while it is being drawn.
  float hd = vU - uDraw;
  float ht = hd < 0.0 ? exp(hd / 80.0) : exp(-hd * hd / 8.0);
  float hcore = ht * exp(-dist * dist / 7.0);
  float hhalo = exp(-(hd * hd + dist * dist) / 120.0);
  vec3 hc = mix(uPalC, uPalB, smoothstep(4.0, 50.0, -hd));
  hc = mix(hc, uPalA, smoothstep(50.0, 150.0, -hd));
  col += (hc * hcore * 4.5 + uPalC * hhalo * 2.0) * uHead * on * step(-1.0, vU);

  gl_FragColor = vec4(col, a) * uOpacity;
}
`;

// ───────────────────────────────────────────────────────────── arrow heads

export const ARROW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity, uTime;
varying vec2 vP;
${COMMON}
void main() {
  float d = min(sdSeg(vP, vec2(0.0), vec2(-9.5, 7.0)), sdSeg(vP, vec2(0.0), vec2(-9.5, -7.0)));
  float aa = max(fwidth(d), 1e-3);
  float a = (1.0 - smoothstep(1.0 - aa, 1.0 + aa, d)) * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}
`;

// ───────────────────────────────────────────────────────────── firewall shield
// Hex-cell barrier that lights up where Home LAN traffic hits the VLAN boundary.

export const SHIELD_FRAG = /* glsl */ `
uniform float uTime, uHit, uActive;
uniform vec3 uColor;
varying vec2 vP;
float hexEdge(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  g = abs(g);
  return 0.5 - max(g.x, dot(g, normalize(r)));
}
void main() {
  vec2 p = vP;
  float e = hexEdge(p / 15.0);
  float line = 1.0 - smoothstep(0.02, 0.07, e);
  float strip = exp(-pow(p.y / 17.0, 2.0));
  float ax = abs(p.x);
  float ring = exp(-pow((ax - uHit * 190.0) / 30.0, 2.0)) * (1.0 - uHit);
  float core = exp(-length(p * vec2(1.0, 1.6)) / 16.0) * pow(1.0 - uHit, 2.0);
  float rest = exp(-pow(p.x / 95.0, 2.0)) * 0.16;
  float v = strip * (line * (rest + ring * 1.6) + ring * 0.12) + core * 1.4;
  gl_FragColor = vec4(uColor * v * 2.2 * uActive, 0.0);
}
`;

// ───────────────────────────────────────────────────────────── backdrop

export const BG_VERT = /* glsl */ `
varying vec2 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const BG_FRAG = /* glsl */ `
uniform float uTime;
uniform vec2 uFocus;
uniform float uNebScale;
uniform vec3 uBase, uColA, uColB, uDot;
varying vec2 vW;
${COMMON}
void main() {
  vec2 p = vW;

  // Slow domain-warped nebula.
  vec2 q = p * uNebScale;
  float w1 = fbm(q + vec2(uTime * 0.010, -uTime * 0.007));
  float w2 = fbm(q * 1.9 + w1 * 1.6 + vec2(-uTime * 0.008, uTime * 0.005) + 4.2);
  vec3 neb = mix(uColA, uColB, smoothstep(0.3, 0.7, w2)) * smoothstep(0.25, 0.85, w1 * 0.6 + w2 * 0.6);
  vec3 col = uBase + neb;

  // Dot lattice that breathes outward from wherever the camera is looking.
  float cell = 56.0;
  vec2 g = p / cell;
  vec2 gi = floor(g + 0.5);
  vec2 gf = (g - gi) * cell;
  float dd = length(gf);
  float aa = max(fwidth(dd), 1e-3);
  float rad = 1.7;
  float dotA = (1.0 - smoothstep(rad - aa, rad + aa, dd)) * min(1.0, rad * rad / (aa * aa));

  vec2 mg = p / (cell * 4.0);
  vec2 mi = floor(mg + 0.5);
  vec2 mf = (mg - mi) * cell * 4.0;
  float plus = min(max(abs(mf.x) - 7.0, abs(mf.y) - 0.6), max(abs(mf.y) - 7.0, abs(mf.x) - 0.6));
  float aap = max(fwidth(plus), 1e-3);
  float plusA = 1.0 - smoothstep(-aap, aap, plus);

  float wave = 0.5 + 0.5 * sin(length(p - uFocus) * 0.008 - uTime * 0.9);
  float tw = 0.55 + 0.45 * vnoise(gi * 0.37 + uTime * 0.15);
  col += uDot * (dotA * (0.35 + 0.65 * wave * tw) + plusA * 0.9);

  gl_FragColor = vec4(col, 1.0);
}
`;

// ───────────────────────────────────────────────────────────── dust (bokeh motes)

export const DUST_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime, uScale, uFocusZ;
varying float vA;
varying float vSeed;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.07 + aSeed * 40.0) * 46.0;
  p.y += cos(uTime * 0.05 + aSeed * 23.0) * 34.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float coc = 1.4 + abs(p.z - uFocusZ) * 0.013;
  float px = coc * uScale / max(-mv.z, 1.0);
  gl_PointSize = clamp(px * 2.0, 1.5, 96.0);
  float tw = 0.5 + 0.5 * sin(uTime * (0.3 + aSeed) + aSeed * 90.0);
  vA = tw * min(1.0, 12.0 / (px * px + 1.0));
  vSeed = aSeed;
  gl_Position = projectionMatrix * mv;
}
`;

export const DUST_FRAG = /* glsl */ `
uniform vec3 uColA, uColB;
uniform float uIntensity;
varying float vA;
varying float vSeed;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float disc = 1.0 - smoothstep(0.6, 1.0, r);
  vec3 c = mix(uColA, uColB, step(0.5, fract(vSeed * 7.0)));
  gl_FragColor = vec4(c * disc * vA * uIntensity, 0.0);
}
`;

// ───────────────────────────────────────────────────────────── post-processing
// HDR scene → 13-tap downsample chain → tent upsample (bloom) → grade.

export const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uPrefilter, uThreshold, uKnee;
varying vec2 vUv;
vec3 S(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = S(vec2(-2.0, 2.0));
  vec3 b = S(vec2(0.0, 2.0));
  vec3 c = S(vec2(2.0, 2.0));
  vec3 d = S(vec2(-2.0, 0.0));
  vec3 e = S(vec2(0.0, 0.0));
  vec3 f = S(vec2(2.0, 0.0));
  vec3 g = S(vec2(-2.0, -2.0));
  vec3 h = S(vec2(0.0, -2.0));
  vec3 i = S(vec2(2.0, -2.0));
  vec3 j = S(vec2(-1.0, 1.0));
  vec3 k = S(vec2(1.0, 1.0));
  vec3 l = S(vec2(-1.0, -1.0));
  vec3 m = S(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    col *= max(soft, br - uThreshold) / max(br, 1e-4);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 t = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv - vec2(t.x, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv - vec2(0.0, t.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + t).rgb;
  c += texture2D(tSrc, vUv - t).rgb;
  c += texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb;
  gl_FragColor = vec4(c / 16.0, 1.0);
}
`;

export const FINAL_FRAG = /* glsl */ `
uniform sampler2D tScene, tBloom;
uniform float uBloom, uTime, uFade, uGrain, uCA, uVig, uFlat;
varying vec2 vUv;
${COMMON}
vec3 shoulder(vec3 x) {
  vec3 a = vec3(0.62);
  return mix(x, a + (1.0 - a) * (1.0 - exp(-(x - a) / (1.0 - a))), step(a, x));
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
void main() {
  vec2 c = vUv - 0.5;
  vec2 off = c * dot(c, c) * uCA;
  vec3 col = vec3(texture2D(tScene, vUv + off).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - off).b);
  vec3 bl = vec3(texture2D(tBloom, vUv + off).r, texture2D(tBloom, vUv).g, texture2D(tBloom, vUv - off).b);
  col += bl * uBloom;
  float vig = 1.0 - uVig * smoothstep(0.28, 0.98, length(c * vec2(1.0, 0.82)) * 1.45);
  col *= vig * uFade;
  col = toSRGB(mix(shoulder(col), col, uFlat));
  // Triangular film grain; also dithers the dark gradients so they survive H.264.
  float g = hash21(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(913.0, 517.0))
          + hash21(gl_FragCoord.xy * 1.37 + fract(uTime * 3.17) * vec2(311.0, 733.0)) - 1.0;
  col += g * uGrain;
  gl_FragColor = vec4(col, 1.0);
}
`;
