# Engine: files, facts, reel anatomy

three.js plus hand-written GLSL, rendered at exactly 1920×1080 and 60 fps. The canvas is always that size; CSS only scales the preview. Every file opens with a usage comment, so read the file's head before using it.

## Files

| Path | What it is |
| --- | --- |
| `engine/kit.js` | Renderer, backdrop, bloom and grade, panels, cards, labels, links, camera, playback, live mode, MP4 export. Read it first. |
| `engine/shaders.js` | Core GLSL: `COMMON` (hash, value noise, fbm, SDFs), `PANEL_*` (cards), `LABEL_*` (decoding text), `LINK_*` (ribbons with packets), `ARROW_FRAG`, `SHIELD_FRAG`, `BG_*` (nebula, lattice), `DUST_*`, bloom and grade passes. |
| `engine/glyphs.js` | Line-art icons drawn into the text atlas, so they decode and bloom like text: `code cloud file share chat video ai plus browser server db cache disk key lock shield mail note kanban person can box clock thought truck warehouse store register shelf`. Add new ones the same way. |
| `engine/parts.js` | `makeIcon('check' \| 'cross' \| 'lock', color, size)`: icons that draw themselves stroke by stroke. |
| `components/blocks.js` | `createStage()` with `card`, `iconCard`, `glyph`, `icon`, `link`, `title` and one `update(T)`. Start here for most scenes. |
| `components/globe.js` | `makeGlobe()`: dot-matrix globe with rim glow, halo, graticule, coastlines, land-dot reveal, great-circle arcs into a hub, pulsing pins; `setDim()` pushes it back behind text. |
| `components/map.js` | `makeMap()`: dark Mercator map with country fills that light up (`highlight(name, colour, t)`); `proj(lon, lat)` places cards and links on it. |
| `effects/objects.js` | SDF object techniques: an object that cracks apart, spinning disks with states, a three-node diagram, an icon shader, a debris burst. |
| `effects/meters.js` | A hardware "slab" whose traces turn infected or safe; a three-step bar meter. |
| `effects/map.js` | Map fill and line shaders, a person marker. |
| `effects/paper.js` | The alternative paper-collage look. |
| `tools/build-globe.mjs` | Builds `data/globe.json` (land dots, coastlines). |
| `tools/build-map.mjs` | Builds `data/map.json` for a lon/lat box: `node tools/build-map.mjs lonMin,latMin,lonMax,latMax [50m\|110m]`. The shipped file covers Europe, North Africa and the Middle East; rebuild it for the talk's region. |
| `scenes/demo.js` | API tour: every building block once, with placeholder labels. |
| `show.html`, `serve.mjs` | The stitched presentation; the static server with `POST /save`. |

`effects/` are technique references: read them to see how a custom object is drawn as an SDF with HDR sparks, then write new objects for the topic the same way.

## Facts that break things when ignored

- **No depth buffer.** Draw order is `renderOrder`:

  | renderOrder | Layer |
  | --- | --- |
  | 0 | Backdrop |
  | 1 | Back dust |
  | 2–3 | Map |
  | 4–11 | Globe |
  | 20–21 | Links, arrows |
  | 30 | Panels |
  | 36 | Title band |
  | 40–41 | Labels, glyphs, rule |
  | 50 | Front dust |

  Transparent objects sharing a `renderOrder` are sorted by the distance of their bounding-sphere centre, so give overlapping layers distinct orders. A 3D object that must hide what is behind it does so **in the shader**, as the globe does with `hidden()` (a ray–sphere test against the camera).
- **Blending is premultiplied** for every `shaderMat`: output `vec4(rgb * a, a)` for normal blending and `vec4(rgb, 0.0)` for **additive** glow (most effects are additive).
- **`shaderMat(vert, frag, uniforms)`** adds the `uTime` uniform; the GLSL still has to **declare `uniform float uTime;`** to use it.
- **`quad(w, h, mat, order)`** makes a plane mesh. `PANEL_VERT` gives `vP`, the local position in world units, handy for SDFs.
- **Text:** `makeLabel(w, h, draw, colA, colB, seed, scale)` draws with canvas 2D into a texture at `scale` (default 4×) so it stays sharp under the camera; `line(ctx, text, x, y, font, channel, align, tracking)` is the helper.
- **`update(T)` is a pure function of `T`** (plus `uTime` for ambient motion). Build everything up front and derive every value from `T`; state accumulated per frame breaks seeking, chapter jumps and export.

## Anatomy of a reel

`<reel>.html` is a copy of `demo.html` with its module script pointed at `./scenes/<reel>.js`:

```js
import { pchip, setCamera, start, look } from '../engine/kit.js';
import { createStage } from '../components/blocks.js';

const DURATION = 30;
const CHAPTERS = [
  { t: 0,   hold: 4.2, name: '…' },   // hold = when this chapter's last animation has landed
  { t: 4.5, hold: 9.8, name: '…' },
];
const st = createStage({ z: 20 });
// … build every object up front, each with its entrance time on the timeline …
const KEYS = [/* [t, x, y, h, yaw, pitch, roll] */];
const ch = (i) => pchip(KEYS.map((k) => k[0]), KEYS.map((k) => k[i]));
const cam = { x: ch(1), y: ch(2), h: ch(3), yaw: ch(4), pitch: ch(5), roll: ch(6) };

function update(T) {
  st.update(T);
  setCamera({ x: cam.x(T), y: cam.y(T), z: 0, h: cam.h(T), yaw: cam.yaw(T), pitch: cam.pitch(T), roll: cam.roll(T) }, T);
}
look.uCA.value = 0.006;
start({ update, duration: DURATION, chapters: CHAPTERS, exportName: '<reel>-1080p60.mp4' });
```

**Chapters:** one chapter is one idea the speaker talks over; `name` shows in the HUD. Live playback holds at `hold`. Keep the gap between one chapter's `hold` and the next chapter's `t` short: it plays at 4× on the next press.

**`start()` options:** `update`, `duration`, `chapters`, `exportName`, plus `autoplay` (default true), `outro` and `fadeIn` (see [presenting.md](presenting.md#seamless-hand-overs)).

**Grade per reel:** `look` exposes `uBloom`, `uGrain`, `uCA`, `uVig`, `uFlat`; `backdrop` exposes the backdrop and dust materials (`backdrop.bg`, `backdrop.dust`).
