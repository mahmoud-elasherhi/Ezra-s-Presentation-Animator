# Presenting, hand-overs, export, checking

## A single reel page

- **Keys:** Space play/pause · ← → previous/next chapter (Shift: ±1 s) · 1–9 jump to a chapter · `,` `.` one frame back/forward · R restart · H hide the HUD · F fullscreen · E export MP4 · L toggle live mode.
- **Live mode** (`?live`, or L): each chapter plays to its `hold` and waits; → / PageDown / Enter (what a presentation clicker sends) plays the next chapter, ← goes back.
- **URL flags:** `?t=12.5` start at 12.5 s · `?paused` start paused · `?clean` hide the UI · `?continuous` the show's behaviour on a single page.

## The show (`show.html`)

`ORDER` lists the reel pages in talk order (with `?params` if a reel takes any). Each reel runs in its own iframe:

- A reel plays straight through to its last `hold` and waits there.
- → starts a reel waiting at its start, steps to the next chapter while it plays, and at the end hands over to the next reel. ← goes back a chapter, or to the previous reel from a reel's first chapter.
- Space pauses (the arrows keep the pause); 1–9 jump to chapters; F fullscreen.
- Going forward, the next reel fades in over the last frame of the previous one; going back, the current reel fades away.

## Seamless hand-overs

For one reel to flow into the next without a cut (e.g. a title over a globe that zooms down into the first scene's map):

1. **The outgoing reel** passes `outro: { t0, t1 }` to `start()` and animates the way out on the timeline between `t0` and `t1` (its last chapter's `hold` is `t0`). In the show, → at the end plays the outro, and the next reel takes over when it lands.
2. **The incoming reel** takes a flag in its `ORDER` entry (e.g. `scene.html?seamless`, read with `qs.has('seamless')`), starts already in its opening state when the flag is set, and passes `fadeIn: false`.
3. **Match the frames.** The last frame of the outro has to equal the first frame of the next reel: same camera (`setCamera` sway included, which depends on `T`), same object positions and scale, same ambient time (the incoming reel starts with `uTime` at 0, so the outgoing reel drives its ambient uniforms with `T − t1` near the end). Render both frames and diff them: a mean pixel difference around 1–2 (on 0–255) is invisible; anything that shifts reads as a jump.

## Export

Press E, or run `await reel.exportMP4({ from, to, name })` in the console. It renders every frame offline (never drops a frame) and encodes H.264 at about 24 Mbit/s, silent. With `serve.mjs` running the file lands in `renders/`; without a server it downloads. Export needs WebCodecs, so use Chrome or another Chromium browser.

## Checking frames

`window.reel` exposes `seek`, `renderAt`, `pause`, `play`, `exportMP4`, `CHAPTERS`, `DURATION`, `time`. Render a still instead of watching playback:

```js
reel.pause(); reel.seek(T); reel.renderAt(T);
const b = await new Promise((r) => document.getElementById('c').toBlob(r, 'image/jpeg', 0.85));
await fetch(`/save?name=check-${T}.jpg`, { method: 'POST', body: b });   // → renders/check-T.jpg
```

Read the saved image to look at it. Real-time playback needs a visible browser tab (`requestAnimationFrame` pauses in hidden ones); stills work either way.

What to look for: text over busy areas (add a `band`, or `setDim` the globe), overlaps when z-levels change, arrows landing exactly on card edges (card edge ± 64 for links), anything that pops in, anything frozen during a hold.
