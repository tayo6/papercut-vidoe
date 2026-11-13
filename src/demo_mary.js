(function () {
'use strict';
/* Built-in, media-free papercut lyric showcase. */
var E = window.__snip.E;
E.MARY_DEMO = {
  "version": 3,
  "tracks": [
    {
      "name": "Mary Lyrics A",
      "kind": "video"
    },
    {
      "name": "Mary Lyrics B",
      "kind": "video"
    },
    {
      "name": "Paper Bursts A",
      "kind": "video"
    },
    {
      "name": "Paper Bursts B",
      "kind": "video"
    }
  ],
  "script": "clip mary-burst-1 set transform.rotation = sin(time * 4.4 + 0.40) * 13\nclip mary-burst-1 set transform.scale = 0.92 + abs(sin(time * 5.2 + 0.40)) * 0.18\nclip mary-burst-2 set transform.rotation = sin(time * 4.4 + 1.13) * 13\nclip mary-burst-2 set transform.scale = 0.92 + abs(sin(time * 5.2 + 1.13)) * 0.18\nclip mary-burst-3 set transform.rotation = sin(time * 4.4 + 1.86) * 13\nclip mary-burst-3 set transform.scale = 0.92 + abs(sin(time * 5.2 + 1.86)) * 0.18\nclip mary-burst-4 set transform.rotation = sin(time * 4.4 + 2.59) * 13\nclip mary-burst-4 set transform.scale = 0.92 + abs(sin(time * 5.2 + 2.59)) * 0.18\nclip mary-burst-5 set transform.rotation = sin(time * 4.4 + 3.32) * 13\nclip mary-burst-5 set transform.scale = 0.92 + abs(sin(time * 5.2 + 3.32)) * 0.18\nclip mary-burst-6 set transform.rotation = sin(time * 4.4 + 4.05) * 13\nclip mary-burst-6 set transform.scale = 0.92 + abs(sin(time * 5.2 + 4.05)) * 0.18\nclip mary-burst-7 set transform.rotation = sin(time * 4.4 + 4.78) * 13\nclip mary-burst-7 set transform.scale = 0.92 + abs(sin(time * 5.2 + 4.78)) * 0.18\nclip mary-burst-8 set transform.rotation = sin(time * 4.4 + 5.51) * 13\nclip mary-burst-8 set transform.scale = 0.92 + abs(sin(time * 5.2 + 5.51)) * 0.18",
  "scenes": [
    {
      "alias": "scene-01",
      "name": "The Little Lamb",
      "start": 0,
      "duration": 6.8,
      "script": "clip mary-lyric-1 set transform.x = sin(time * 1.9 + 0.40) * 0.026\nclip mary-lyric-1 set transform.y = cos(time * 2.7 + 0.40) * 0.024\nclip mary-burst-1 set transform.x = 0.34 + sin(time * 2.4 + 0.40) * 0.045\nclip mary-burst-1 set transform.y = -0.25 + cos(time * 3.2 + 0.40) * 0.05\nclip mary-lyric-1 set paper.boil = 9\nclip mary-lyric-1 set paper.boilFps = 22\nclip mary-lyric-1 set paper.boilLoop = 8\nclip mary-burst-1 set paper.boil = 8\nclip mary-burst-1 set paper.boilFps = 20\nclip mary-burst-1 set paper.boilLoop = 8",
      "clips": [
        {
          "alias": "mary-lyric-1",
          "type": "text",
          "name": "Lyric 1",
          "content": "Mary had a little lamb,\nIts fleece was white as snow;",
          "track": "Mary Lyrics A",
          "start": 0,
          "duration": 6.8,
          "properties": {
            "text.fontSize": 76,
            "text.color": "#252331",
            "paper.enabled": true,
            "paper.edge": 58,
            "paper.roughness": 96,
            "paper.detail": 98,
            "paper.grain": 84,
            "paper.color": "#f0d9b4",
            "paper.boil": 9,
            "paper.boilFps": 22,
            "paper.boilLoop": 8,
            "paper.shadow": 56,
            "paper.shadowBlur": 30
          },
          "script": "at 0s set transform.opacity = 0\nat 0s set transform.scale = 0.14\nat 0s set transform.rotation = -28\nat 0.06s tween transform.opacity = 1 over 0.42s ease cubic-bezier(0.2, 1.22, 0.32, 1)\nat 0.06s tween transform.scale = 1.16 over 0.82s ease elastic-out\nat 0.9s tween transform.scale = 1 over 0.42s ease back-out\nat 0.06s tween transform.rotation = 0 over 0.98s ease elastic-out"
        },
        {
          "alias": "mary-burst-1",
          "type": "text",
          "name": "Paper burst 1",
          "content": "BAA!",
          "track": "Paper Bursts A",
          "start": 1.1,
          "duration": 5.7,
          "properties": {
            "text.fontSize": 166,
            "text.color": "#fffaf0",
            "paper.enabled": true,
            "paper.edge": 72,
            "paper.roughness": 100,
            "paper.detail": 96,
            "paper.grain": 88,
            "paper.color": "#ed6a4e",
            "paper.boil": 8,
            "paper.boilFps": 20,
            "paper.boilLoop": 8,
            "paper.shadow": 58,
            "paper.shadowBlur": 32
          },
          "script": "at 0s set transform.opacity = 0\nat 0.08s tween transform.opacity = 1 over 0.32s ease bounce-out\nat 4.7s tween transform.opacity = 0 over 0.55s ease cubic-in"
        }
      ]
    },
    {
      "alias": "scene-02",
      "name": "Everywhere",
      "start": 5.8,
      "duration": 6.8,
      "transitionIn": {
        "type": "crossfade",
        "duration": 1
      },
      "script": "clip mary-lyric-2 set transform.x = sin(time * 1.9 + 1.13) * 0.026\nclip mary-lyric-2 set transform.y = cos(time * 2.7 + 1.13) * 0.024\nclip mary-burst-2 set transform.x = -0.34 + sin(time * 2.4 + 1.13) * 0.045\nclip mary-burst-2 set transform.y = 0.25 + cos(time * 3.2 + 1.13) * 0.05\nclip mary-lyric-2 set paper.boil = 9\nclip mary-lyric-2 set paper.boilFps = 22\nclip mary-lyric-2 set paper.boilLoop = 8\nclip mary-burst-2 set paper.boil = 8\nclip mary-burst-2 set paper.boilFps = 20\nclip mary-burst-2 set paper.boilLoop = 8",
      "clips": [
        {
          "alias": "mary-lyric-2",
          "type": "text",
          "name": "Lyric 2",
          "content": "And everywhere that Mary went,\nThe lamb was sure to go.",
          "track": "Mary Lyrics B",
          "start": 0,
          "duration": 6.8,
          "properties": {
            "text.fontSize": 76,
            "text.color": "#252331",
            "paper.enabled": true,
            "paper.edge": 58,
            "paper.roughness": 96,
            "paper.detail": 98,
            "paper.grain": 84,
            "paper.color": "#d8eadc",
            "paper.boil": 9,
            "paper.boilFps": 22,
            "paper.boilLoop": 8,
            "paper.shadow": 56,
            "paper.shadowBlur": 30
          },
          "script": "at 0s set transform.opacity = 0\nat 0s set transform.scale = 0.14\nat 0s set transform.rotation = 25\nat 0.06s tween transform.opacity = 1 over 0.42s ease cubic-bezier(0.2, 1.22, 0.32, 1)\nat 0.06s tween transform.scale = 1.16 over 0.82s ease bounce-out\nat 0.9s tween transform.scale = 1 over 0.42s ease back-out\nat 0.06s tween transform.rotation = 0 over 0.98s ease back-out"
        },
        {
          "alias": "mary-burst-2",
          "type": "text",
          "name": "Paper burst 2",
          "content": "FOLLOW!",
          "track": "Paper Bursts B",
          "start": 1.1,
          "duration": 5.7,
          "properties": {
            "text.fontSize": 166,
            "text.color": "#fffaf0",
            "paper.enabled": true,
            "paper.edge": 72,
            "paper.roughness": 100,
            "paper.detail": 96,
            "paper.grain": 88,
            "paper.color": "#d49b2d",
            "paper.boil": 8,
            "paper.boilFps": 20,
            "paper.boilLoop": 8,
            "paper.shadow": 58,
            "paper.shadowBlur": 32
          },
          "script": "at 0s set transform.opacity = 0\nat 0.08s tween transform.opacity = 1 over 0.32s ease bounce-out\nat 4.7s tween transform.opacity = 0 over 0.55s ease cubic-in"
        }
      ]
    },
    {
      "alias": "scene-03",
      "name": "School Day",
      "start": 11.6,
      "duration": 6.8,
      "transitionIn": {
        "type": "crossfade",
        "duration": 1
      },
      "script": "clip mary-lyric-3 set transform.x = sin(time * 1.9 + 1.86) * 0.026\nclip mary-lyric-3 set transform.y = cos(time * 2.7 + 1.86) * 0.024\nclip mary-burst-3 set transform.x = 0.34 + sin(time * 2.4 + 1.86) * 0.045\nclip mary-burst-3 set transform.y = -0.25 + cos(time * 3.2 + 1.86) * 0.05\nclip mary-lyric-3 set paper.boil = 9\nclip mary-lyric-3 set paper.boilFps = 22\nclip mary-lyric-3 set paper.boilLoop = 8\nclip mary-burst-3 set paper.boil = 8\nclip mary-burst-3 set paper.boilFps = 20\nclip mary-burst-3 set paper.boilLoop = 8",
      "clips": [
        {
          "alias": "mary-lyric-3",
          "type": "text",
          "name": "Lyric 3",
          "content": "It followed her to school one day,\nWhich was against the rule;",
          "track": "Mary Lyrics A",
          "start": 0,
          "duration": 6.8,
          "properties": {
            "text.fontSize": 76,
            "text.color": "#252331",
            "paper.enabled": true,
            "paper.edge": 58,
            "paper.roughness": 96,
            "paper.detail": 98,
            "paper.grain": 84,
            "paper.color": "#e5d9f4",
            "paper.boil": 9,
            "paper.boilFps": 22,
            "paper.boilLoop": 8,
            "paper.shadow": 56,
            "paper.shadowBlur": 30
          },
          "script": "at 0s set transform.opacity = 0\nat 0s set transform.scale = 0.14\nat 0s set transform.rotation = -28\nat 0.06s tween transform.opacity = 1 over 0.42s ease cubic-bezier(0.2, 1.22, 0.32, 1)\nat 0.06s tween transform.scale = 1.16 over 0.82s ease back-out\nat 0.9s tween transform.scale = 1 over 0.42s ease back-out\nat 0.06s tween transform.rotation = 0 over 0.98s ease elastic-out"
        },
        {
          "alias": "mary-burst-3",
          "type": "text",
          "name": "Paper burst 3",
          "content": "SCHOOL!",
          "track": "Paper Bursts A",
          "start": 1.1,
          "duration": 5.7,
          "properties": {
            "text.fontSize": 166,
            "text.color": "#fffaf0",
            "paper.enabled": true,
            "paper.edge": 72,
            "paper.roughness": 100,
            "paper.detail": 96,
            "paper.grain": 88,
            "paper.color": "#6b75bd",
            "paper.boil": 8,
            "paper.boilFps": 20,
            "paper.boilLoop": 8,
            "paper.shadow": 58,
            "paper.shadowBlur": 32
          },
          "script": "at 0s set transform.opacity = 0\nat 0.08s tween transform.opacity = 1 over 0.32s ease bounce-out\nat 4.7s tween transform.opacity = 0 over 0.55s ease cubic-in"
        }
      ]
    },
    {
      "alias": "scene-04",
      "name": "The Big Laugh",
      "start": 17.4,
      "duration": 6.8,
      "transitionIn": {
        "type": "crossfade",
        "duration": 1
      },
      "script": "clip mary-lyric-4 set transform.x = sin(time * 1.9 + 2.59) * 0.026\nclip mary-lyric-4 set transform.y = cos(time * 2.7 + 2.59) * 0.024\nclip mary-burst-4 set transform.x = -0.34 + sin(time * 2.4 + 2.59) * 0.045\nclip mary-burst-4 set transform.y = 0.25 + cos(time * 3.2 + 2.59) * 0.05\nclip mary-lyric-4 set paper.boil = 9\nclip mary-lyric-4 set paper.boilFps = 22\nclip mary-lyric-4 set paper.boilLoop = 8\nclip mary-burst-4 set paper.boil = 8\nclip mary-burst-4 set paper.boilFps = 20\nclip mary-burst-4 set paper.boilLoop = 8",
      "clips": [
        {
          "alias": "mary-lyric-4",
          "type": "text",
          "name": "Lyric 4",
          "content": "It made the children laugh and play,\nTo see a lamb at school.",
          "track": "Mary Lyrics B",
          "start": 0,
          "duration": 6.8,
          "properties": {
            "text.fontSize": 76,
            "text.color": "#252331",
            "paper.enabled": true,
            "paper.edge": 58,
            "paper.roughness": 96,
            "paper.detail": 98,
            "paper.grain": 84,
            "paper.color": "#f1d2c4",
            "paper.boil": 9,
            "paper.boilFps": 22,
            "paper.boilLoop": 8,
            "paper.shadow": 56,
            "paper.shadowBlur": 30
          },
          "script": "at 0s set transform.opacity = 0\nat 0s set transform.scale = 0.14\nat 0s set transform.rotation = 25\nat 0.06s tween transform.opacity = 1 over 0.42s ease cubic-bezier(0.2, 1.22, 0.32, 1)\nat 0.06s tween transform.scale = 1.16 over 0.82s ease cubic-bezier(0.18, 1.24, 0.32, 1)\nat 0.9s tween transform.scale = 1 over 0.42s ease back-out\nat 0.06s tween transform.rotation = 0 over 0.98s ease back-out"
        },
        {
          "alias": "mary-burst-4",
          "type": "text",
          "name": "Paper burst 4",
          "content": "HA-HA!",
          "track": "Paper Bursts B",
          "start": 1.1,
          "duration": 5.7,
          "properties": {
            "text.fontSize": 166,
            "text.color": "#fffaf0",
            "paper.enabled": true,
            "paper.edge": 72,
            "paper.roughness": 100,
            "paper.detail": 96,
            "paper.grain": 88,
            "paper.color": "#3c9a83",
            "paper.boil": 8,
            "paper.boilFps": 20,
            "paper.boilLoop": 8,
            "paper.shadow": 58,
            "paper.shadowBlur": 32
          },
          "script": "at 0s set transform.opacity = 0\nat 0.08s tween transform.opacity = 1 over 0.32s ease bounce-out\nat 4.7s tween transform.opacity = 0 over 0.55s ease cubic-in"
        }
      ]
    },
    {
      "alias": "scene-05",
      "name": "Sent Away",
      "start": 23.2,
      "duration": 6.8,
      "transitionIn": {
        "type": "crossfade",
        "duration": 1
      },
      "script": "clip mary-lyric-5 set transform.x = sin(time * 1.9 + 3.32) * 0.026\nclip mary-lyric-5 set transform.y = cos(time * 2.7 + 3.32) * 0.024\nclip mary-burst-5 set transform.x = 0.34 + sin(time * 2.4 + 3.32) * 0.045\nclip mary-burst-5 set transform.y = -0.25 + cos(time * 3.2 + 3.32) * 0.05\nclip mary-lyric-5 set paper.boil = 9\nclip mary-lyric-5 set paper.boilFps = 22\nclip mary-lyric-5 set paper.boilLoop = 8\nclip mary-burst-5 set paper.boil = 8\nclip mary-burst-5 set paper.boilFps = 20\nclip mary-burst-5 set paper.boilLoop = 8",
      "clips": [
        {
          "alias": "mary-lyric-5",
          "type": "text",
          "name": "Lyric 5",
          "content": "And so the teacher turned it out,\nBut still it lingered near,",
          "track": "Mary Lyrics A",
          "start": 0,
          "duration": 6.8,
          "properties": {
            "text.fontSize": 76,
            "text.color": "#252331",
            "paper.enabled": true,
            "paper.edge": 58,
            "paper.roughness": 96,
            "paper.detail": 98,
            "paper.grain": 84,
            "paper.color": "#d7e7f5",
            "paper.boil": 9,
            "paper.boilFps": 22,
            "paper.boilLoop": 8,
            "paper.shadow": 56,
            "paper.shadowBlur": 30
          },
          "script": "at 0s set transform.opacity = 0\nat 0s set transform.scale = 0.14\nat 0s set transform.rotation = -28\nat 0.06s tween transform.opacity = 1 over 0.42s ease cubic-bezier(0.2, 1.22, 0.32, 1)\nat 0.06s tween transform.scale = 1.16 over 0.82s ease expo-out\nat 0.9s tween transform.scale = 1 over 0.42s ease back-out\nat 0.06s tween transform.rotation = 0 over 0.98s ease elastic-out"
        },
        {
          "alias": "mary-burst-5",
          "type": "text",
          "name": "Paper burst 5",
          "content": "WAIT!",
          "track": "Paper Bursts A",
          "start": 1.1,
          "duration": 5.7,
          "properties": {
            "text.fontSize": 166,
            "text.color": "#fffaf0",
            "paper.enabled": true,
            "paper.edge": 72,
            "paper.roughness": 100,
            "paper.detail": 96,
            "paper.grain": 88,
            "paper.color": "#d75c69",
            "paper.boil": 8,
            "paper.boilFps": 20,
            "paper.boilLoop": 8,
            "paper.shadow": 58,
            "paper.shadowBlur": 32
          },
          "script": "at 0s set transform.opacity = 0\nat 0.08s tween transform.opacity = 1 over 0.32s ease bounce-out\nat 4.7s tween transform.opacity = 0 over 0.55s ease cubic-in"
        }
      ]
    },
    {
      "alias": "scene-06",
      "name": "Patient Wait",
      "start": 29,
      "duration": 6.8,
      "transitionIn": {
        "type": "crossfade",
        "duration": 1
      },
      "script": "clip mary-lyric-6 set transform.x = sin(time * 1.9 + 4.05) * 0.026\nclip mary-lyric-6 set transform.y = cos(time * 2.7 + 4.05) * 0.024\nclip mary-burst-6 set transform.x = -0.34 + sin(time * 2.4 + 4.05) * 0.045\nclip mary-burst-6 set transform.y = 0.25 + cos(time * 3.2 + 4.05) * 0.05\nclip mary-lyric-6 set paper.boil = 9\nclip mary-lyric-6 set paper.boilFps = 22\nclip mary-lyric-6 set paper.boilLoop = 8\nclip mary-burst-6 set paper.boil = 8\nclip mary-burst-6 set paper.boilFps = 20\nclip mary-burst-6 set paper.boilLoop = 8",
      "clips": [
        {
          "alias": "mary-lyric-6",
          "type": "text",
          "name": "Lyric 6",
          "content": "And waited patiently about,\nTill Mary did appear.",
          "track": "Mary Lyrics B",
          "start": 0,
          "duration": 6.8,
          "properties": {
            "text.fontSize": 76,
            "text.color": "#252331",
            "paper.enabled": true,
            "paper.edge": 58,
            "paper.roughness": 96,
            "paper.detail": 98,
            "paper.grain": 84,
            "paper.color": "#e9dfb8",
            "paper.boil": 9,
            "paper.boilFps": 22,
            "paper.boilLoop": 8,
            "paper.shadow": 56,
            "paper.shadowBlur": 30
          },
          "script": "at 0s set transform.opacity = 0\nat 0s set transform.scale = 0.14\nat 0s set transform.rotation = 25\nat 0.06s tween transform.opacity = 1 over 0.42s ease cubic-bezier(0.2, 1.22, 0.32, 1)\nat 0.06s tween transform.scale = 1.16 over 0.82s ease circ-out\nat 0.9s tween transform.scale = 1 over 0.42s ease back-out\nat 0.06s tween transform.rotation = 0 over 0.98s ease back-out"
        },
        {
          "alias": "mary-burst-6",
          "type": "text",
          "name": "Paper burst 6",
          "content": "THERE!",
          "track": "Paper Bursts B",
          "start": 1.1,
          "duration": 5.7,
          "properties": {
            "text.fontSize": 166,
            "text.color": "#fffaf0",
            "paper.enabled": true,
            "paper.edge": 72,
            "paper.roughness": 100,
            "paper.detail": 96,
            "paper.grain": 88,
            "paper.color": "#3f88ad",
            "paper.boil": 8,
            "paper.boilFps": 20,
            "paper.boilLoop": 8,
            "paper.shadow": 58,
            "paper.shadowBlur": 32
          },
          "script": "at 0s set transform.opacity = 0\nat 0.08s tween transform.opacity = 1 over 0.32s ease bounce-out\nat 4.7s tween transform.opacity = 0 over 0.55s ease cubic-in"
        }
      ]
    },
    {
      "alias": "scene-07",
      "name": "The Question",
      "start": 34.8,
      "duration": 6.8,
      "transitionIn": {
        "type": "crossfade",
        "duration": 1
      },
      "script": "clip mary-lyric-7 set transform.x = sin(time * 1.9 + 4.78) * 0.026\nclip mary-lyric-7 set transform.y = cos(time * 2.7 + 4.78) * 0.024\nclip mary-burst-7 set transform.x = 0.34 + sin(time * 2.4 + 4.78) * 0.045\nclip mary-burst-7 set transform.y = -0.25 + cos(time * 3.2 + 4.78) * 0.05\nclip mary-lyric-7 set paper.boil = 9\nclip mary-lyric-7 set paper.boilFps = 22\nclip mary-lyric-7 set paper.boilLoop = 8\nclip mary-burst-7 set paper.boil = 8\nclip mary-burst-7 set paper.boilFps = 20\nclip mary-burst-7 set paper.boilLoop = 8",
      "clips": [
        {
          "alias": "mary-lyric-7",
          "type": "text",
          "name": "Lyric 7",
          "content": "\"Why does the lamb love Mary so?\"\nThe eager children cry;",
          "track": "Mary Lyrics A",
          "start": 0,
          "duration": 6.8,
          "properties": {
            "text.fontSize": 76,
            "text.color": "#252331",
            "paper.enabled": true,
            "paper.edge": 58,
            "paper.roughness": 96,
            "paper.detail": 98,
            "paper.grain": 84,
            "paper.color": "#f0d5e7",
            "paper.boil": 9,
            "paper.boilFps": 22,
            "paper.boilLoop": 8,
            "paper.shadow": 56,
            "paper.shadowBlur": 30
          },
          "script": "at 0s set transform.opacity = 0\nat 0s set transform.scale = 0.14\nat 0s set transform.rotation = -28\nat 0.06s tween transform.opacity = 1 over 0.42s ease cubic-bezier(0.2, 1.22, 0.32, 1)\nat 0.06s tween transform.scale = 1.16 over 0.82s ease quint-out\nat 0.9s tween transform.scale = 1 over 0.42s ease back-out\nat 0.06s tween transform.rotation = 0 over 0.98s ease elastic-out"
        },
        {
          "alias": "mary-burst-7",
          "type": "text",
          "name": "Paper burst 7",
          "content": "WHY?",
          "track": "Paper Bursts A",
          "start": 1.1,
          "duration": 5.7,
          "properties": {
            "text.fontSize": 166,
            "text.color": "#fffaf0",
            "paper.enabled": true,
            "paper.edge": 72,
            "paper.roughness": 100,
            "paper.detail": 96,
            "paper.grain": 88,
            "paper.color": "#a85eaa",
            "paper.boil": 8,
            "paper.boilFps": 20,
            "paper.boilLoop": 8,
            "paper.shadow": 58,
            "paper.shadowBlur": 32
          },
          "script": "at 0s set transform.opacity = 0\nat 0.08s tween transform.opacity = 1 over 0.32s ease bounce-out\nat 4.7s tween transform.opacity = 0 over 0.55s ease cubic-in"
        }
      ]
    },
    {
      "alias": "scene-08",
      "name": "The Answer",
      "start": 40.6,
      "duration": 6.8,
      "transitionIn": {
        "type": "crossfade",
        "duration": 1
      },
      "script": "clip mary-lyric-8 set transform.x = sin(time * 1.9 + 5.51) * 0.026\nclip mary-lyric-8 set transform.y = cos(time * 2.7 + 5.51) * 0.024\nclip mary-burst-8 set transform.x = -0.34 + sin(time * 2.4 + 5.51) * 0.045\nclip mary-burst-8 set transform.y = 0.25 + cos(time * 3.2 + 5.51) * 0.05\nclip mary-lyric-8 set paper.boil = 9\nclip mary-lyric-8 set paper.boilFps = 22\nclip mary-lyric-8 set paper.boilLoop = 8\nclip mary-burst-8 set paper.boil = 8\nclip mary-burst-8 set paper.boilFps = 20\nclip mary-burst-8 set paper.boilLoop = 8",
      "clips": [
        {
          "alias": "mary-lyric-8",
          "type": "text",
          "name": "Lyric 8",
          "content": "\"Why, Mary loves the lamb, you know,\"\nThe teacher did reply.",
          "track": "Mary Lyrics B",
          "start": 0,
          "duration": 6.8,
          "properties": {
            "text.fontSize": 76,
            "text.color": "#252331",
            "paper.enabled": true,
            "paper.edge": 58,
            "paper.roughness": 96,
            "paper.detail": 98,
            "paper.grain": 84,
            "paper.color": "#d6e8dc",
            "paper.boil": 9,
            "paper.boilFps": 22,
            "paper.boilLoop": 8,
            "paper.shadow": 56,
            "paper.shadowBlur": 30
          },
          "script": "at 0s set transform.opacity = 0\nat 0s set transform.scale = 0.14\nat 0s set transform.rotation = 25\nat 0.06s tween transform.opacity = 1 over 0.42s ease cubic-bezier(0.2, 1.22, 0.32, 1)\nat 0.06s tween transform.scale = 1.16 over 0.82s ease cubic-bezier(0.25, 1.2, 0.35, 1)\nat 0.9s tween transform.scale = 1 over 0.42s ease back-out\nat 0.06s tween transform.rotation = 0 over 0.98s ease back-out"
        },
        {
          "alias": "mary-burst-8",
          "type": "text",
          "name": "Paper burst 8",
          "content": "LOVE!",
          "track": "Paper Bursts B",
          "start": 1.1,
          "duration": 5.7,
          "properties": {
            "text.fontSize": 166,
            "text.color": "#fffaf0",
            "paper.enabled": true,
            "paper.edge": 72,
            "paper.roughness": 100,
            "paper.detail": 96,
            "paper.grain": 88,
            "paper.color": "#568b58",
            "paper.boil": 8,
            "paper.boilFps": 20,
            "paper.boilLoop": 8,
            "paper.shadow": 58,
            "paper.shadowBlur": 32
          },
          "script": "at 0s set transform.opacity = 0\nat 0.08s tween transform.opacity = 1 over 0.32s ease bounce-out\nat 4.7s tween transform.opacity = 0 over 0.55s ease cubic-in"
        }
      ]
    }
  ]
};
})();
