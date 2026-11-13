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



## Unified project script (version 3)

The Project tab now has one unified project-script editor. A version 3 document can declare named tracks, scenes, clips and all three SnipScript animation scopes in one JSON source. The root script is the project-wide clock, a scene's script uses that scene's clock, and a clip's script uses that clip's local clock. Each script is still the same restricted SnipScript language described below; the document does not execute JavaScript.

Example:

    {
      "version": 3,
      "tracks": [
        { "name": "Visuals", "kind": "video" }
      ],
      "script": "clip hero set transform.opacity = 1",
      "scenes": [
        {
          "alias": "intro",
          "name": "Intro",
          "start": 0,
          "duration": 4,
          "script": "clip hero set transform.y = sin(time * 2) * 0.03",
          "clips": [
            {
              "alias": "hero",
              "media": "IMPORTED_MEDIA_ID",
              "track": "Visuals",
              "start": 0,
              "duration": 4,
              "script": "at 0s set transform.scale = 0.8\nat 0.4s tween transform.scale = 1 over 0.6s ease out"
            }
          ]
        }
      ]
    }

Use a text clip with type "text" and a content field instead of media when needed. Media must be imported into the editor first and referenced by its Media ID. Validate entire project checks the structure, media, clip scripts, scene scripts and project script without changing the timeline. Apply project script applies the structure and all scripts as one undoable change. The older version 1/2 plan documents and separate clip/scene/project script editors remain supported.


### Bringing scripts into Snipwork

The Unified Project Script editor supports .snip files (JSON content), as well as ordinary copy and paste. Use **Import .snip file** to load a script as a draft, **Copy script** to move it between ChatGPT and Snipwork, or **Download .snip file** to keep the current draft. Importing never changes the timeline. Run **Validate entire project** before applying. **Apply & Preview** validates, applies one undoable project change and starts playback from the beginning. You can also apply without starting playback. Media files remain separate: import them into the Media library first, then use their current Media IDs in the script.

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

Open the Project tab with no clip selected to edit one script for the whole timeline. Project scripts use absolute project time and can target multiple clips by their IDs or the stable aliases assigned in Script-driven Project Builder. Use the clip picker to insert a target, then check and apply the script:

    at 0s clip c1 set transform.scale = 0.7
    at 0.25s clip c1 tween transform.scale = 1 over 0.6s ease out
    clip c2 set transform.y = sin(time * 2) * 0.04
    at 1s clip c3 tween paper.edge = 40 over 0.5s ease inout

`at` times refer to the project timeline, not the target clip's local time. Project expressions use `time`, `duration` and `progress` for the whole project. Project scripts can coordinate visual, papercut, text and audio properties across clips. When both project and clip scripts write the same property, the project script takes precedence. Project scripts run in preview and video export; audio properties are sampled into the live and offline audio mix.


## Script-driven Project Builder

Open the Project tab and use **Script-driven Project Builder** to create and arrange clips with a versioned JSON plan. This is a declarative plan, not JavaScript: the editor validates every track, media reference, timing value, overlap and property before changing the timeline. **Validate plan** only previews a summary; **Apply plan** makes one undoable change.

The first version uses media already imported into the browser editor. The panel lists each imported Media ID. A clip can reference that ID (recommended) or an unambiguous media name. Named visual and audio tracks are created once and reused by name. Each clip has a stable alias; applying the same plan again updates those clips instead of duplicating them. Project SnipScript can target those clips by alias (for example, `clip hero-shot set transform.y = sin(time * 2) * 0.04`) as well as by generated clip ID.

Example (text only):

    {
      "version": 1,
      "tracks": [
        { "name": "Main Visuals", "kind": "video" }
      ],
      "clips": [
        {
          "alias": "opening-title",
          "type": "text",
          "content": "Your title",
          "track": "Main Visuals",
          "start": 0,
          "duration": 3,
          "properties": {
            "transform.scale": 1,
            "paper.enabled": true,
            "paper.edge": 24
          }
        }
      ]
    }

To create a clip from imported media, replace the text clip with an entry such as:

    { "alias": "hero-shot", "media": "MEDIA_ID", "track": "Main Visuals", "start": 3, "duration": 4 }

The track kind "video" declares a visual lane (images, video and text can use it); "audio" declares an audio lane. Clip times are absolute project seconds. A lane cannot contain overlapping clips. Supported initial properties are the same allow-listed transform, text, audio and papercut properties exposed by the editor. Version 1 flat plans create and update clips and named tracks; use version 2 scene plans below to organize clips into scenes. Importing files, deleting content by omission and arbitrary JavaScript execution are deliberately outside the builder's scope.


## Scene-based Project Plans

Version 2 project plans describe complete scenes. Each scene has a stable alias, a display name, an absolute timeline start and a duration. Clips nested inside a scene use the start field as a scene-relative offset; the editor converts that to absolute project time when applying the plan. Shared named tracks can hold multiple scenes, text and visual layers, and independent audio lanes.

Example structure:

    {
      "version": 2,
      "tracks": [
        { "name": "Visuals", "kind": "video" },
        { "name": "Music", "kind": "audio" }
      ],
      "scenes": [
        {
          "alias": "intro",
          "name": "Intro",
          "start": 0,
          "duration": 5,
          "clips": [
            {
              "alias": "intro-title",
              "type": "text",
              "content": "Welcome",
              "track": "Visuals",
              "start": 0,
              "duration": 3
            },
            {
              "alias": "intro-music",
              "media": "MEDIA_ID",
              "track": "Music",
              "start": 0,
              "duration": 5
            }
          ]
        },
        {
          "alias": "main",
          "name": "Main Scene",
          "start": 5,
          "duration": 8,
          "clips": [
            {
              "alias": "hero-shot",
              "media": "VIDEO_MEDIA_ID",
              "track": "Visuals",
              "start": 0.5,
              "duration": 6
            }
          ]
        }
      ]
    }

When the main scene start changes from 5 to 7, its nested clip starts at 7.5 seconds automatically. Reapplying the plan updates matching scene and clip aliases without duplicating them. The Project inspector includes a scene navigator, and the timeline shows clickable scene blocks that move the playhead to each scene's start.

Version 1 flat plans remain supported. Version 2 scenes currently organize and position existing imported media and text clips; transitions, scene templates and deleting content by omission are later extensions. Each scene also has its own SnipScript editor, with scene-relative time, duration and progress variables. Scene scripts can target only their own clips by stable alias. The execution order is clip script, then scene script, then project-wide script; the project-wide script has final priority.


## Scene-local SnipScript

Select a scene in the Project panel's **Scene-local animation script** section. Each scene has a separate saved script, with its own enable/disable state. The language is the same restricted SnipScript used by clips and projects, but its clock starts at the scene's start time.

    # These expressions use the scene clock, not the full project clock.
    clip hero-shot set transform.y = sin(time * 2) * 0.04
    at 0s clip hero-shot set transform.scale = 0.7
    at 0.25s clip hero-shot tween transform.scale = 1 over 0.6s ease out
    at 1s clip hero-shot tween paper.edge = 42 over 0.5s ease inout

Inside a scene script, time is elapsed seconds since that scene began, duration is the scene duration, and progress runs from 0 to 1 over that scene. A scene script can address only clips assigned to that scene. It can animate transforms, text, audio and papercut properties; the same restricted expression, easing and validation rules apply.

Scripts are layered in this order: **clip script → scene script → project-wide script**. A later layer overrides an earlier layer when both write the same property. Scene scripts run in preview, video export and audio rendering. Disabling a scene script preserves its code in the project.
