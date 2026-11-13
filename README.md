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


## Clip scripting

Select an image, video or text clip, open Edit → Script, then insert or write a SnipScript. Apply it to preview the result; the same frame evaluation is used when exporting.

Example:

    set transform.y = sin(time * 2) * 0.04
    set transform.rotation = sin(time * 1.2) * 3

SnipScript is a restricted expression language, not JavaScript. It supports time (seconds from the clip start), duration, progress (0–1), pi, arithmetic, and a small set of math functions. Scripts currently override clip transforms non-destructively; the original transform and keyframe data remain intact. Audio, text styling and PaperCut scripting are not part of this first runtime.
