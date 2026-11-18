# Presentation animator

A Claude Code skill for building **motion-graphic reels that replace PowerPoint slides**: dark, neon, glowing animations made with three.js and hand-written GLSL, rendered at 1920×1080 and 60 fps. Each reel plays in the browser chapter by chapter, holding on every idea while you talk, and a presentation clicker steps through it. Reels can also be exported to MP4.

You describe your talk; Claude plans one reel per section and one chapter per point, builds the scenes in this style, checks the frames and stitches everything into one full-screen show.

## Install

**As a plugin** (from a clone or a git URL):

```
/plugin marketplace add <path-or-git-url-of-this-repo>
/plugin install presentation-animator@presentation-animator
```

**Or as a plain skill:** copy `skills/presentation-animator/` into `~/.claude/skills/` (all your projects) or into a project's `.claude/skills/`.

## Use

Ask Claude for animated slides or a presentation reel, e.g. *"Make motion-graphic slides for my talk on how DNS works; here are my points: …"*. The skill copies its template into your project, runs `npm install` and a small local server, and opens the reels in the browser.

Requirements: Node.js 18+ and a Chromium-based browser (Chrome, Edge, Brave) for MP4 export.

## What's inside

```
skills/presentation-animator/
  SKILL.md            the workflow Claude follows
  references/         style guide, engine notes, presenting and export
  template/           the engine, components, effects, data tools and a demo reel
```

Open `template/demo.html` (after `npm install` and `node serve.mjs` in `template/`) to see every building block once.

## Credits

Map and globe data: [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas). Rendering: [three.js](https://threejs.org/). MP4 muxing: [mp4-muxer](https://github.com/Vanilagy/mp4-muxer).
