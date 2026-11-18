// Effect library: a dark map (country fills that light up behind a noisy front)
// and small person markers.
import { COMMON } from '../engine/shaders.js';

export const MAP_VERT = /* glsl */ `
varying vec2 vL;
void main() {
  vL = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const MAP_FILL_FRAG = /* glsl */ `
uniform vec3 uBase, uHi;
uniform float uMix, uOpacity, uTime, uSeed;
varying vec2 vL;
${COMMON}
void main() {
  float n = vnoise(vL * 0.012 + uSeed * 7.0);
  float k = uMix * 1.3 - n * 0.3;
  float m = smoothstep(0.0, 0.18, k);
  float live = step(0.001, uMix) * (1.0 - step(0.999, uMix));
  float front = exp(-abs(k - 0.09) * 22.0) * live;
  vec2 g = abs(fract(vL / 22.0 - 0.5) - 0.5) * 22.0;
  float grid = 1.0 - smoothstep(0.0, 1.1, min(g.x, g.y));
  float shimmer = 0.85 + 0.15 * sin(uTime * 1.3 + vL.x * 0.01 + vL.y * 0.007);
  vec3 lit = uHi * (0.28 + 0.22 * grid) * shimmer;
  vec3 c = mix(uBase, lit, m) + uHi * front * 1.6;
  gl_FragColor = vec4(c, 1.0) * uOpacity;
}
`;

export const MAP_LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity, uTime;
void main() {
  gl_FragColor = vec4(uColor, 1.0) * uOpacity;
}
`;

// Person marker (head + shoulders) with a soft glow. Uses PANEL_VERT (vP in world units).
export const PERSON_FRAG = /* glsl */ `
uniform vec2 uSize;
uniform vec3 uColor;
uniform float uOpacity, uGlow, uTime, uSeed;
varying vec2 vP;
${COMMON}
void main() {
  vec2 p = vP / uSize.y;
  float head = length(p - vec2(0.0, 0.2)) - 0.17;
  float body = sdRoundBox(p - vec2(0.0, -0.27), vec2(0.3, 0.2), 0.17);
  float d = min(head, body) * uSize.y;
  float aa = max(fwidth(d), 1e-3);
  float a = 1.0 - smoothstep(-aa, aa, d);
  float breathe = 0.85 + 0.15 * sin(uTime * 2.0 + uSeed * 20.0);
  vec3 glow = uColor * exp(-max(d, 0.0) / 9.0) * (1.0 - a) * uGlow * breathe;
  gl_FragColor = vec4(uColor * a + glow, a) * uOpacity;
}
`;
