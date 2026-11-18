---
name: presentation-animator
description: Builds motion-graphic reels that replace PowerPoint slides — dark neon three.js/GLSL animations at 1920×1080, 60 fps, presented live in the browser with clicker keys and exportable to MP4. Use when someone wants animated slides, a presentation reel, a talk visual, or motion graphics to speak over.
---

# Presentation animator

Each **reel** is one browser page that plays an animation in **chapters**: it plays one idea, holds on the finished frame while the speaker talks, and continues on the next key press. `show.html` stitches the reels into one full-screen presentation. The speaker does the talking; the reel is the visual, so it carries almost no text.

Everything you need is in this skill folder:

- `template/` — the engine, components and a demo reel. Copy it into the user's project.
- [references/style.md](references/style.md) — palette, card styles, type, text rules, motion language, camera. Read it before designing anything.
- [references/engine.md](references/engine.md) — engine facts, the API, the anatomy of a reel. Read it before writing a scene.
- [references/presenting.md](references/presenting.md) — keys, `show.html`, hand-overs between reels, MP4 export, frame checks.

## 1 · Set up the project

1. Copy `template/` into the user's project, into a folder of its own (e.g. `reels/`), unless one already holds a copy (it has `engine/kit.js`).
2. In that folder run `npm install`, then start the server: `node serve.mjs 5299` (static server plus `POST /save`, which writes into `renders/`).
3. Open `http://localhost:5299/demo.html` in a Chromium browser and confirm the demo plays.

Done when the demo renders frames without console errors.

## 2 · Plan the talk

Ask for the talk's content if the user hasn't given it: the topic, the points they will make, roughly how long. Then write a plan and show it to the user before building:

- One **reel** per section of the talk; a reel usually runs 20–60 s.
- One **chapter** per idea the speaker says, 3–7 per reel. Each chapter gets a visual metaphor drawn from the topic (a pipeline, a lock that breaks, a queue, a scale, a map region, a layered stack), a short card wording of at most about four words, and a camera move.
- Optionally a title reel first: the talk's title over an ambient visual (e.g. the globe) to speak over while starting.

Done when the user has agreed to the reel list and each reel's chapters.

## 3 · Build each reel

For each reel:

1. Copy `demo.html` to `<reel>.html` and point its `<script src>` at `./scenes/<reel>.js`.
2. Write `scenes/<reel>.js` following [references/engine.md](references/engine.md): build every object up front with its entrance time, keyframe the camera with `pchip`, and call `start({ update, duration, chapters, exportName })`.
3. Invent objects for this topic. Lay the ideas out across space and travel the camera between them; vary the layout from reel to reel (grids, radial, stacks, maps, globes). `scenes/demo.js` and `effects/` show the techniques only; their objects and layout belong to the demo.
4. Keep the house style from [references/style.md](references/style.md) constant: palette, glow, type, entrances, packet flow, ambient life, minimal text.

## 4 · Check every reel

Render stills instead of watching playback (see [references/presenting.md](references/presenting.md#checking-frames)). A reel is done when you have looked at the frame at every chapter's `hold` and halfway through each entrance, and every one passes:

- text reads clearly (over busy areas it sits on a `band`, or the background dims);
- nothing overlaps, and links land on card edges;
- every element arrives with an entrance; held frames still move (ambient clock);
- the camera frames the whole idea with margin at 16:9.

Show the user the key frames, iterate on their feedback, and delete the check images afterwards.

## 5 · Assemble the show

Add each reel page to `ORDER` in `show.html`, in talk order. Walk through it with the user's keys in mind: → starts a reel waiting at its start, steps chapter by chapter, and hands over to the next reel at the end. For a reel that should flow straight into the next one (a zoom from a title into the first scene), use `outro` and `fadeIn: false` as described in [references/presenting.md](references/presenting.md#seamless-hand-overs).

Export MP4s only when the user asks for video files; the live show runs from the browser.
