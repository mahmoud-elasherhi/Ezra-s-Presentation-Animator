// Ready-made building blocks on top of engine/kit.js. A "stage" collects everything you
// create and animates it all with one call per frame:
//
//   const st = createStage({ z: 20 });
//   const a = st.card({ x: -400, y: 0, style: 'net', title: 'Alpha', sub: 'detail', time: 0.6 });
//   const b = st.iconCard({ x: 400, y: 0, style: 'app', title: 'Beta', glyph: 'server', time: 1.6, entry: 'left' });
//   st.link([{ x: -190, y: 0 }, { x: 210, y: 0 }], { t0: 1.1, t1: 1.6 });
//   st.title({ text: 'TWO WORDS', accent: 'WORDS', y: 0, z: 500, time: 3.5 });
//   // in update(T): st.update(T);
//
// Times are in seconds on the clip's timeline. Every object has an entrance; nothing pops in.
import {
  THREE, SH, C, prog, ease, shaderMat, quad, makePanel, makeLabel, makeCard, animateCard, entryParam, samplePath, makeLink, animateLink,
  line, PAL, STYLES, SANS, MONO, scene,
} from '../engine/kit.js';
import { makeGlyph } from '../engine/glyphs.js';
import { makeIcon } from '../engine/parts.js';

// Soft dark ellipse that sits between a busy background and a title (normal blend, alpha only).
const BAND_FRAG = /* glsl */ `
uniform vec2 uSize;
uniform float uOpacity;
varying vec2 vP;
void main() {
  vec2 q = vP / (uSize * 0.5);
  gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.0, 1.0, length(q))) * uOpacity);
}
`;
// Hairline that draws out from the centre with a hot white tip; flag colours from the centre out.
const RULE_FRAG = /* glsl */ `
uniform vec2 uSize;
uniform float uReveal, uOpacity;
uniform vec3 uColA, uColB, uColC;
varying vec2 vP;
void main() {
  float ax = abs(vP.x / (uSize.x * 0.5));
  float m = 1.0 - smoothstep(uReveal - 0.04, uReveal, ax);
  float y = exp(-abs(vP.y) * 0.9);
  float edge = exp(-abs(ax - uReveal) * 40.0) * (1.0 - step(0.999, uReveal));
  vec3 c = ax < 0.2 ? uColC : (ax < 0.6 ? uColB : uColA);
  c = mix(c, vec3(1.0), edge);
  float fade = 1.0 - smoothstep(0.75, 1.0, ax);
  gl_FragColor = vec4(c * y * (m * fade + edge * 2.0) * uOpacity, 0.0);
}
`;

export function createStage({ z: Z = 20 } = {}) {
  const cards = [];
  const links = [];
  const glyphs = [];
  const icons = [];
  const titles = [];
  let seed = 0;
  const nextSeed = () => (seed = (seed + 0.137) % 1);

  /** Centered card: { x, y, w=440, h=128, style, title, sub, time, entry, titleFont, subFont, hits } */
  function card(o) {
    const c = makeCard({ z: Z, w: 440, h: 128, titleFont: `600 34px ${SANS}`, subFont: `400 18px ${MONO}`, tight: 0.95, seed: nextSeed(), ...o });
    c.hits = o.hits ?? [];
    cards.push(c);
    return c;
  }

  /** Card with a glyph on the left and left-aligned text: { x, y, w, h, style, title, sub, glyph, time, entry } */
  function iconCard({ x, y, w = 420, h = 112, style, title, sub, glyph: name, time, entry = 'left', hits = [] }) {
    const st = STYLES[style];
    const s = nextSeed();
    const group = new THREE.Group();
    group.position.set(x, y, Z);
    scene.add(group);
    const panel = makePanel({ w, h, r: 14, seed: s, fill: st.fill, fillAlpha: st.fillAlpha, stroke: st.stroke, glow: st.glow, dash: st.dash, glowAmt: st.glowAmt, entry: entryParam(w, h, entry) });
    const tx = 100;
    const lw = w - tx - 14;
    const label = makeLabel(
      lw,
      h,
      (ctx) => {
        line(ctx, title, 2, sub ? h / 2 - 15 : h / 2, `600 30px ${SANS}`, 0, 'left');
        if (sub) line(ctx, sub, 2, h / 2 + 19, `400 17px ${MONO}`, 1, 'left', 0.2);
      },
      st.title,
      st.sub,
      s
    );
    label.mesh.position.set(-w / 2 + tx + lw / 2, 0, 5);
    group.add(panel.mesh, label.mesh);
    const c = { group, panel, label, time, hits };
    if (name) {
      const g = makeGlyph(name, 64, 64, st.title, `#${C(st.fill).multiplyScalar(1.8).getHexString()}`, 1.4, s);
      g.mesh.position.set(-w / 2 + 54, 0, 6);
      group.add(g.mesh);
      glyphs.push({ g, time: time + 0.25, dur: 0.6 });
    }
    cards.push(c);
    return c;
  }

  /** Free-standing glyph (see engine/glyphs.js GLYPHS for names). */
  function glyph(name, { x, y, w = 120, h = 120, line: lineCol = '#E2DEFF', fill = '#3A3190', time, dur = 0.8, glow = 1.35, z = 4 }) {
    const g = makeGlyph(name, w, h, lineCol, fill, glow, nextSeed());
    g.mesh.position.set(x, y, Z + z);
    scene.add(g.mesh);
    const e = { g, time, dur };
    glyphs.push(e);
    return e;
  }

  /** Check / cross / lock that draws itself stroke by stroke. */
  function icon(kind, { x, y, size = 40, color = '#2CE0AC', time, dur = 0.45, glow = 0.8 }) {
    const i = makeIcon(kind, color, size, glow);
    i.mesh.position.set(x, y, Z + 6);
    scene.add(i.mesh);
    const e = { i, time, dur };
    icons.push(e);
    return e;
  }

  /**
   * Link along a polyline (rounded corners). Drawn between t0 and t1 by a hero packet,
   * then ambient packets keep flowing. o: { t0, t1, r=22, dashed, arrow=true, color, palette,
   * spacing, speed, die, flow=1, uOff }
   */
  function link(pts, o = {}) {
    const l = makeLink(samplePath(pts, o.r ?? 22), { z: Z - 2, lineW: 2.4, ...o });
    links.push([l, o.flow ?? 1]);
    return l;
  }

  /**
   * Big title that decodes left to right: { text, accent?, x=0, y=0, z, time, size=124,
   * colA='#F6F4FF', colB=PAL.blue, band=true, rule=true }. `accent` (a substring of text)
   * is drawn in colB.
   */
  function title(o) {
    const size = o.size ?? 124;
    const track = o.track ?? Math.round(size * 0.13);
    const font = `700 ${size}px ${SANS}`;
    const m = document.createElement('canvas').getContext('2d');
    m.font = font;
    m.letterSpacing = `${track}px`;
    const wAll = m.measureText(o.text).width;
    const TW = Math.ceil(wAll + size);
    const TH = Math.ceil(size * 1.6);
    const z = o.z ?? Z + 60;
    const at = o.accent ? o.text.indexOf(o.accent) : -1;
    const lab = makeLabel(
      TW,
      TH,
      (ctx) => {
        const x0 = (TW - wAll) / 2;
        ctx.font = font;
        ctx.letterSpacing = `${track}px`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const parts = at < 0 ? [[o.text, 0]] : [[o.text.slice(0, at), 0], [o.accent, 1], [o.text.slice(at + o.accent.length), 0]];
        let x = x0;
        for (const [s, ch] of parts) {
          if (!s) continue;
          ctx.fillStyle = ch ? '#00ff00' : '#ff0000';
          ctx.fillText(s, x, TH / 2 + size * 0.03);
          x += m.measureText(s).width;
        }
      },
      o.colA ?? '#F6F4FF',
      o.colB ?? PAL.blue,
      nextSeed(),
      3
    );
    lab.mesh.position.set((o.x ?? 0) + track / 2, o.y ?? 0, z);
    scene.add(lab.mesh);
    let band = null;
    if (o.band !== false) {
      const bm = shaderMat(SH.PANEL_VERT, BAND_FRAG, { uSize: { value: new THREE.Vector2(TW * 1.25, size * 4.2) }, uOpacity: { value: 0 } });
      band = quad(TW * 1.25, size * 4.2, bm, 36);
      band.position.set(o.x ?? 0, o.y ?? 0, z - 30);
      scene.add(band);
    }
    let rule = null;
    if (o.rule !== false) {
      const RW = wAll * 0.9;
      const rm = shaderMat(SH.PANEL_VERT, RULE_FRAG, {
        uColA: { value: C(PAL.blue) }, uColB: { value: C(PAL.pink) }, uColC: { value: C(PAL.white) },
        uSize: { value: new THREE.Vector2(RW, 12) }, uReveal: { value: 0 }, uOpacity: { value: 1 },
      });
      rule = quad(RW, 12, rm, 41);
      rule.position.set(o.x ?? 0, (o.y ?? 0) - size * 0.74, z);
      scene.add(rule);
    }
    const e = { lab, band, rule, time: o.time ?? 0, bandTime: (o.time ?? 0) - 0.25 };
    titles.push(e);
    return e;
  }

  function update(T) {
    for (const c of cards) animateCard(c, T);
    for (const [l, flow] of links) animateLink(l, T, flow);
    for (const e of glyphs) e.g.mat.uniforms.uReveal.value = ease.out(prog(T, e.time, e.dur));
    for (const e of icons) e.i.mat.uniforms.uReveal.value = ease.out(prog(T, e.time, e.dur));
    for (const e of titles) {
      const tr = prog(T, e.time, 1.15);
      e.lab.mat.uniforms.uReveal.value = tr;
      e.lab.mesh.scale.setScalar(1.05 - 0.05 * ease.out(tr));
      if (e.band) e.band.material.uniforms.uOpacity.value = 0.55 * ease.inOut(prog(T, e.bandTime, 1.0));
      if (e.rule) e.rule.material.uniforms.uReveal.value = ease.out(prog(T, e.time + 0.75, 0.9));
    }
  }

  return { Z, card, iconCard, glyph, icon, link, title, update, cards, links };
}
