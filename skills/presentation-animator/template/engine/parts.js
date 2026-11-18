// Small building blocks shared by the later sequences.
import { SH, C, shaderMat, quad } from './kit.js';
import * as SX from '../effects/objects.js';

// Status glyph drawn by ICON_FRAG; check and cross draw themselves stroke by stroke.
export function makeIcon(kind, color, size, glow = 0.5) {
  const mat = shaderMat(SH.LABEL_VERT, SX.ICON_FRAG, {
    uIcon: { value: { check: 0, cross: 1, lock: 2 }[kind] },
    uReveal: { value: 0 },
    uGlow: { value: glow },
    uColor: { value: C(color) },
  });
  return { mesh: quad(size, size, mat, 41), mat };
}
