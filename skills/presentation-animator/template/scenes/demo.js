// API tour, NOT a design to copy: every word on screen is a placeholder. It shows each
// building block once so you can see how the parts look and move together:
//   1 · the five card styles + links (solid, dashed threat probe)
//   2 · glyphs, icon cards, self-drawing check / cross
//   3 · camera travel to the dot globe + a decoding title
import { pchip, setCamera, start, look } from '../engine/kit.js';
import { createStage } from '../components/blocks.js';
import { makeGlobe } from '../components/globe.js';

const DURATION = 17;
const CHAPTERS = [
  // hold = the moment the chapter's last animation has landed (live mode stops there)
  { t: 0, hold: 4.6, name: 'Card styles' },
  { t: 4.8, hold: 8.2, name: 'Glyphs & icons' },
  { t: 8.6, hold: 14.6, name: 'Globe + title' },
];

const st = createStage({ z: 20 });

// ── 1 · card styles (placeholder labels = the style names)
st.card({ x: -520, y: 220, w: 380, style: 'net', title: 'net', sub: 'style', time: 0.4, entry: 'right' });
const hub = st.card({ x: 0, y: 220, w: 380, style: 'app', title: 'app', sub: 'style', time: 1.0, entry: 'left' });
st.card({ x: 520, y: 220, w: 380, style: 'data', title: 'data', sub: 'style', time: 1.6, entry: 'left' });
st.card({ x: -260, y: -60, w: 380, style: 'ghost', title: 'ghost', sub: 'style', time: 2.4, entry: 'top' });
st.card({ x: 260, y: -60, w: 380, style: 'threat', title: 'threat', sub: 'style', time: 3.2, entry: 'top' });
st.link([{ x: -330, y: 220 }, { x: -190, y: 220 }], { t0: 0.6, t1: 1.0, spacing: 120 });
st.link([{ x: 190, y: 220 }, { x: 330, y: 220 }], { t0: 1.2, t1: 1.6, spacing: 120 });
st.link([{ x: -60, y: 156 }, { x: -60, y: 80 }, { x: -260, y: 80 }, { x: -260, y: 4 }], { t0: 2.0, t1: 2.4, spacing: 140 });
st.link([{ x: 60, y: 156 }, { x: 60, y: 80 }, { x: 260, y: 80 }, { x: 260, y: 4 }], {
  t0: 2.8, t1: 3.2, dashed: true, arrow: false, color: '#A8525C', palette: ['#FF4D5E', '#FF4D5E', '#FF9AA4'], spacing: 60, speed: 1.1, die: 6,
});
hub.hits = [3.2]; // the hub pulses again when the probe lands

// ── 2 · glyphs + icon cards
['cloud', 'server', 'db', 'lock', 'shield', 'file', 'chat', 'person'].forEach((g, i) => st.glyph(g, { x: -665 + i * 190, y: -520, w: 110, h: 110, time: 5.0 + i * 0.12 }));
st.iconCard({ x: -470, y: -760, style: 'app', title: 'Icon card', sub: 'with a sub line', glyph: 'server', time: 6.0, entry: 'right' });
st.iconCard({ x: 0, y: -760, style: 'net', title: 'Icon card', glyph: 'key', time: 6.4, entry: 'top' });
st.iconCard({ x: 470, y: -760, style: 'data', title: 'Icon card', glyph: 'disk', time: 6.8, entry: 'left' });
st.icon('check', { x: -150, y: -900, time: 7.4 });
st.icon('cross', { x: -50, y: -900, color: '#FF6B78', time: 7.6 });
st.icon('lock', { x: 50, y: -900, color: '#9186F5', time: 7.8 });

// ── 3 · globe + title, somewhere else in the world so the camera has to travel
const GX = 3200;
const globe = await makeGlobe({
  x: GX,
  y: 0,
  revealFrom: [103.8, 1.3],
  hub: [103.8, 1.3],
  cities: [[139.7, 35.7], [151.2, -33.9], [72.9, 19.1], [127.0, 37.6], [121.0, 14.6], [55.3, 25.2], [36.8, -1.3], [115.9, -31.9], [-122.4, 37.8]],
  t: { body: 8.8, grid: 8.9, dots: 9.0, arcs: 10.4, stagger: 0.15 },
});
st.title({ text: 'PLACEHOLDER TITLE', accent: 'TITLE', x: GX, y: 0, z: globe.radius + 90, time: 12.2, size: 110 });

// ════════════════════════════════════════════════════════════════ camera
// [time, focusX, focusY, visible height, yaw°, pitch°, roll°] — PCHIP: holds stay perfectly still
const KEYS = [
  [0, 0, 90, 1500, -4, 4, 0],
  [4.6, 0, 70, 1400, 2, 4, 0],
  [5.4, 0, -650, 1300, 0, 5, 0],
  [8.2, 0, -650, 1260, 2, 4, 0],
  [9.2, 1900, -250, 2500, 0, 7, 0],
  [10.4, GX, 60, 2100, -10, 9, -1],
  [13.6, GX, 0, 1400, 0, 5, 0],
  [DURATION, GX, 0, 1380, 1, 5, 0],
];
const ch = (i) => pchip(KEYS.map((k) => k[0]), KEYS.map((k) => k[i]));
const cam = { x: ch(1), y: ch(2), h: ch(3), yaw: ch(4), pitch: ch(5), roll: ch(6) };

function update(T) {
  st.update(T);
  globe.setDim(T > 12 ? 1 - 0.35 * Math.min(1, (T - 12) / 1.0) : 1);
  globe.update(T);
  setCamera({ x: cam.x(T), y: cam.y(T), z: 0, h: cam.h(T), yaw: cam.yaw(T), pitch: cam.pitch(T), roll: cam.roll(T) }, T);
}

look.uCA.value = 0.006;
start({ update, duration: DURATION, chapters: CHAPTERS, exportName: 'demo-1080p60.mp4' });
