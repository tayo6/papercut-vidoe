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
    at 1.5s tween transform.rotation = 12 over 0.4s ease back-out

Continuous motion can loop or pulse with the clip clock:

    set transform.x = pingpong(time, 2) * 0.2 - 0.1
    set transform.y = sin(time * 3) * 0.04
    set transform.opacity = pulse(time, 1, 0.7)

Timed tween easing supports `linear`, `in`, `out`, `inout`, `smooth`, `sine-in/out/inout`, `cubic-in/out/inout`, `quart-in/out/inout`, `quint-in/out/inout`, `expo-in/out/inout`, `circ-in/out/inout`, `back-in/out/inout`, `bounce-in/out/inout`, `elastic-in/out/inout`, and custom `cubic-bezier(x1, y1, x2, y2)` curves. Back and elastic easings can overshoot their target, which is useful for expressive movement.

Available variables: time (seconds since the clip starts), duration, progress (0–1), and pi. Math functions include sin, cos, tan, abs, min, max, clamp, lerp, fract, wrap, pingpong, saw, triangle, step, pulse, smoothstep, smootherstep, remap, round, floor, ceil, sqrt, pow, sign, and rgb. These helpers make repeating, back-and-forth, pulsing and eased expression-based motion possible without adding visual keyframes. Boolean literals `true` and `false` are supported for discrete switches; boolean properties use `set`, not `tween`.

Papercut can be switched on and shaped by script, including its colour, detail, grain, boil and shadow:

    at 0s set paper.enabled = true
    at 0.2s tween paper.edge = 32 over 0.6s ease out
    at 0.3s tween paper.grain = 75 over 0.8s ease inout
    at 1s tween paper.color = #e6d7b8 over 0.5s ease linear
    at 2s set paper.enabled = false

Supported targets depend on clip type:
- Image/video: transform.x, transform.y, transform.scale, transform.rotation, transform.opacity, and all `paper.*` targets.
- Text: the visual targets above, plus text.fontSize and text.color.
- Audio/video sound: audio.volume, audio.fadeIn, audio.fadeOut.

Papercut targets: `paper.enabled`, `paper.edge`, `paper.roughness`, `paper.detail`, `paper.grain`, `paper.color`, `paper.boil`, `paper.boilFps`, `paper.boilLoop`, `paper.shadow`, and `paper.shadowBlur`. Cut style and texture choices remain project/clip settings.

Scripts evaluate without modifying original keyframe tracks or base clip properties. Preview and export use the same visual renderer; audio script curves are sampled into live and offline audio gain envelopes.


## Project-level SnipScript

Open the Project tab with no clip selected to edit one script for the whole timeline. Project scripts use absolute project time and can target multiple clips by their IDs. Use the clip picker to insert a target, then check and apply the script:

    at 0s clip c1 set transform.scale = 0.7
    at 0.25s clip c1 tween transform.scale = 1 over 0.6s ease out
    clip c2 set transform.y = sin(time * 2) * 0.04
    at 1s clip c3 tween paper.edge = 40 over 0.5s ease inout

`at` times refer to the project timeline, not the target clip's local time. Project expressions use `time`, `duration` and `progress` for the whole project. Project scripts can coordinate visual, papercut, text and audio properties across clips. When both project and clip scripts write the same property, the project script takes precedence. Project scripts run in preview and video export; audio properties are sampled into the live and offline audio mix.
