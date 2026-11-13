# Snipwork (papercut video)

Paper cut-out animation lab and a timeline video editor that runs entirely in the browser. No server, no uploads.

- **Effects lab:** paper cut-out, paper unfold, magazine letters, newspaper, match cut, text morph, word orbit. Export PNG, GIF, MP4 or WebM.
- **Video editor:** import photos, clips and music, trim on a timeline, transform on the preview, pick animations, add cut-out effects, export MP4 or WebM (WebCodecs, with a real-time recording fallback).

## Run it

Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari), or use the GitHub Pages site once enabled.

## Develop

Sources are in `src/`. Rebuild the single-file page with:

    python3 tools/build.py src index.html

## Credits

MP4 and WebM muxing by [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) and [webm-muxer](https://github.com/Vanilagy/webm-muxer) (MIT), bundled in `src/v_*.js`.


## SnipScript v2

Select an image, video, text or audio clip, then open Edit → Script. SnipScript is a restricted expression language, not JavaScript. It cannot access the DOM, network, storage, imports or arbitrary browser APIs.

Continuous expressions run on every frame:

    set transform.y = sin(time * 2) * 0.04
    set text.color = rgb(255, 128, 0)

Timed events and tweens run against the clip's local timeline:

    at 0s set transform.scale = 0.7
    at 0.5s tween transform.scale = 1 over 0.4s ease out
    at 1s tween paper.edge = 45 over 0.5s ease inout

Available variables: time (seconds since the clip starts), duration, progress (0–1), and pi. Math functions include sin, cos, tan, abs, min, max, clamp, lerp, round, floor, ceil, sqrt, pow, sign, and rgb.

Supported targets depend on clip type:
- Image/video: transform.x, transform.y, transform.scale, transform.rotation, transform.opacity, paper.edge, paper.roughness.
- Text: the visual targets above, plus text.fontSize and text.color.
- Audio/video sound: audio.volume, audio.fadeIn, audio.fadeOut.

Scripts evaluate without modifying original keyframe tracks or base clip properties. Preview and export use the same visual renderer; audio script curves are sampled into live and offline audio gain envelopes.
