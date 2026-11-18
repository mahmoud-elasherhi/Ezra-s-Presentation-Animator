# Style: look and motion

Dark, neon, glowing motion graphics meant to sit behind a live speaker. The colours live as hex in `engine/kit.js` (`PAL`, `STYLES`); this file says what each one means.

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| Backdrop base | `#0B0B11` | Near-black with a violet tint, never pure black. |
| Nebula A / B | `#2A1F70` ×0.5, `#0A3848` ×0.42 | Slow, domain-warped fbm in deep violet and teal. |
| Lattice dots | `#4A4A5E` | A 56-unit dot grid with "+" marks every 4 cells. |
| Packet palette | `#5BCEFA` blue → `#F5A9B8` pink → `#FFFFFF` white → pink | Every flowing thing cycles through these: packets on links, globe arcs, dust, the progress bar, the underline rule. |
| Alert | `#FF4D5E` (line `#A8525C`, soft `#FF9AA4`) | Threats, failures, probes. Sparingly. |
| Neutral link | `#8D8B98` | A link line before its packets flow. |
| Accent violet | `#8E82FF` | Halos, highlights, the second rim colour. |
| OK green | `#2CE0AC` | Checks and "good" states. |

**Card styles** (`STYLES`), each with fill, stroke, title, sub and glow colours:

| Style | Fill | Stroke | Title | Sub | Meaning |
| --- | --- | --- | --- | --- | --- |
| `net` | `#3A3190` | `#9186F5` | `#E2DEFF` | `#B9B3F7` | Infrastructure or the main actor (violet). |
| `app` | `#07503F` | `#27B990` | `#B4F1DD` | `#66D9B2` | Services and positive states (green). |
| `data` | `#3D3D3A` | `#908F87` | `#E6E4DA` | `#BDBBB2` | Storage and data (warm grey). |
| `ghost` | `#14141C` at 35% | `#74747E`, dashed | `#F4F4F6` | `#C2C2C8` | Comparisons, optional or secondary items. |
| `threat` | `#2A1016` at 60% | `#C4505E`, dashed | `#FFE3E6` | `#EE9BA5` | Attackers, risks, pressure. |

Give a style one meaning and keep it for the whole talk. To recolour a card live (e.g. "taken over" in red), lerp its `uStroke`, `uGlowCol` and `uFill` uniforms.

## Type

- **Sans** (titles): Inter → SF Pro Display → system-ui. Card titles `600 30–34px`, a hero card up to `700 48px`, big titles `700 110–130px` with tracking ≈ 0.13 em.
- **Mono** (subs, tags, ports, numbers): JetBrainsMono Nerd Font → JetBrains Mono → SF Mono. Subs `400 16–19px`, tags `500 12–15px`.
- A label texture has two channels: **title in red, sub in green**; the shader colours them with `uColA` / `uColB`. A big title can put one accent word in `colB` (`stage.title({ accent })`).

## Text

- **Minimal text.** A card says one thing in at most about four words, plus an optional short mono sub.
- **Labels, not sentences:** no headlines, question headings or paragraphs. The speaker talks; the reel still reads clearly with the sound off.
- **Numbers and ports in mono**, optionally in their own small table or badge.

## Finish (`look` uniforms)

- **Bloom:** 7-mip progressive bloom, threshold 0.95. Anything brighter than 1.0 glows, so packet heads, sparks and hot edges are written at 1.5–4× colour on purpose.
- **Grade:** `uGrain` 0.02, `uCA` (chromatic aberration) 0.005–0.008, `uVig` 0.6, gentle highlight roll-off. A reel fades in from black over its first 0.9 s.
- **Backdrop:** animated nebula, a dot lattice that breathes around the camera focus, two parallax dust layers (behind and in front).

## Motion language

Every element **arrives**:

| Element | Entrance | Timing |
| --- | --- | --- |
| Card | Outline draws both ways from its `entry` side (where the incoming link touches), fill scans in, text decodes left to right, an impact pulse and ring fire as scale settles 0.9 → 1.0 with overshoot. | 0.8 s; text from +0.3 s |
| Card hit | `card.hits = [t]` re-fires the pulse and ring when a packet or event lands. | 0.95 s ring |
| Link | A hero packet draws the line `t0 → t1` with a white-hot head, the arrow fades in at the end, ambient packets keep flowing. | 0.4–0.9 s |
| Threat probe | Dashed red link, fast (`speed` 1.1), `die` so packets fade before the target. | 0.6–1.0 s |
| Text decode | Per-row jitter and a noisy reveal front with a bright edge. | 0.8–1.15 s |
| Glyph / icon | Decodes like text; check and cross draw stroke by stroke. | 0.45–0.8 s |
| Map highlight | Fill lights up behind a noise front with a fine inner grid and a bright front line. | 0.9 s |
| Globe | Body and halo fade in, graticule draws, land dots flash white revealing outwards from a point, arcs launch staggered, pins pop with rings. | ≈ 5 s |
| Group | Siblings stagger 0.12–0.6 s apart. | |

**Easing:** `ease.out` for things landing, `ease.inOut` for fades and travel, `ease.outBack` only for a small overshoot on scale.

**Ambient life:** packets, shimmer, dust, halo hue and globe spin run on the **ambient clock** `uTime`, which keeps running while a live reel holds, so a held frame never looks frozen. Anything that should move during a hold reads `uTime` (in JS: `mat.uniforms.uTime.value`), not `T`.

## Camera

- Orbit rig: `setCamera({ x, y, z, h, yaw, pitch, roll }, T)`. `h` is the visible height in world units at the focus plane. Yaw stays within about ±16°, pitch 3–11°.
- `setCamera` adds a subtle sway on its own, so the camera always breathes.
- Keyframe with `pchip` (monotone cubic): repeating a key holds perfectly still with no overshoot.
- Typical moves: start wide and tilted, then settle; push in as detail appears; pull back to an overview; **travel to a new area of the world for a new idea** — lay ideas out in space rather than clearing the screen.
- An impact jolt: add `sin(T*93)*k` to the camera for 0.3 s.

## Depth

Links take a `level`; cards can sit at different z. Raising the z of layers while the camera orbits gives an exploded, layered view. Conventions: card plane `z ≈ 20`, map at −20, links at Z − 2, labels +5, glyphs +6, titles in front of a globe at `R + 90`.

## Alternative look

`effects/paper.js` holds an editorial paper-collage look (paper fibre, halftone, torn cut-outs, marker, scene wipe). The neon look is the default; reach for paper only when the user asks for it.
