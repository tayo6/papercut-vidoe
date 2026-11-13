'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = {
  window: {
    __snip: {
      clamp: (value, min, max) => Math.max(min, Math.min(max, value))
    }
  }
};
vm.runInNewContext(fs.readFileSync('src/e_core.js', 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync('src/e_props.js', 'utf8'), sandbox);
const E = sandbox.window.__snip.E;

E.media = {
  hero: { id: 'hero', kind: 'image', name: 'Hero photo', defDur: 4, fill: false },
  song: { id: 'song', kind: 'audio', name: 'Music bed', dur: 12 },
  duplicateA: { id: 'duplicateA', kind: 'image', name: 'Same name', defDur: 4 },
  duplicateB: { id: 'duplicateB', kind: 'image', name: 'Same name', defDur: 4 }
};
E.mediaList = ['hero', 'song', 'duplicateA', 'duplicateB'];

const plan = {
  version: 1,
  tracks: [
    { name: 'Main Visuals', kind: 'video' },
    { name: 'Music', kind: 'audio' }
  ],
  clips: [
    {
      alias: 'hero-shot',
      media: 'hero',
      track: 'Main Visuals',
      start: 0,
      duration: 4,
      properties: { 'transform.scale': 1.2, 'paper.enabled': true, 'paper.edge': 26 }
    },
    {
      alias: 'opening-title',
      type: 'text',
      content: 'Papercut',
      track: 'Main Visuals',
      start: 4,
      duration: 2,
      properties: { 'text.fontSize': 150, 'text.color': '#ff8800' }
    },
    {
      alias: 'music-bed',
      media: 'song',
      track: 'Music',
      start: 0,
      duration: 6,
      properties: { 'audio.volume': 0.7 }
    }
  ]
};

const beforePreview = JSON.stringify(E.proj);
const preview = E.previewProjectPlan(plan);
assert.equal(JSON.stringify(E.proj), beforePreview, 'Preview must not mutate the project.');
assert.equal(preview.tracksToCreate, 2);
assert.equal(preview.tracksToReuse, 0);
assert.equal(preview.clipsToCreate, 3);
assert.equal(preview.clipsToUpdate, 0);
assert.equal(preview.timelineEnd, 6);
assert.equal(preview.items[1].alias, 'opening-title');

const applied = E.applyProjectPlan(plan, JSON.stringify(plan));
assert.equal(E.proj.clips.length, 3);
assert.equal(applied.clipsToCreate, 3);
assert.equal(E.proj.projectPlanCode, JSON.stringify(plan));
const visualRow = E.proj.rows.find(row => row.scriptName === 'Main Visuals');
const audioRow = E.proj.rows.find(row => row.scriptName === 'Music');
assert(visualRow && audioRow);
const hero = E.proj.clips.find(clip => clip.scriptAlias === 'hero-shot');
const title = E.proj.clips.find(clip => clip.scriptAlias === 'opening-title');
const music = E.proj.clips.find(clip => clip.scriptAlias === 'music-bed');
assert.equal(hero.row, visualRow.id);
assert.equal(hero.tf.s, 1.2);
assert.equal(hero.cut.on, true);
assert.equal(hero.cut.edge, 26);
assert.equal(title.text.str, 'Papercut');
assert.equal(title.text.size, 150);
assert.equal(title.text.color, '#ff8800');
assert.equal(music.row, audioRow.id);
assert.equal(music.vol, 0.7);
assert.equal(E.canUndo(), true);

const heroId = hero.id;
E.applyProjectPlan(plan, JSON.stringify(plan));
assert.equal(E.proj.clips.length, 3, 'Reapplying a plan must not duplicate its aliases.');
assert.equal(E.proj.clips.find(clip => clip.scriptAlias === 'hero-shot').id, heroId);
E.undo();
assert.equal(E.proj.clips.length, 0, 'An unchanged reapply must not create a second history step.');

E.applyProjectPlan(plan);
const movedPlan = JSON.parse(JSON.stringify(plan));
movedPlan.clips[0].start = 0.5;
movedPlan.clips[0].duration = 3.5;
const moved = E.applyProjectPlan(movedPlan);
assert.equal(E.proj.clips.length, 3);
assert.equal(E.proj.clips.find(clip => clip.scriptAlias === 'hero-shot').start, 0.5);
assert.equal(moved.clipsToCreate, 0);
assert.equal(moved.clipsToUpdate, 3);
E.undo();
assert.equal(E.proj.clips.find(clip => clip.scriptAlias === 'hero-shot').start, 0);
E.undo();
assert.equal(E.proj.clips.length, 0, 'A complete plan apply must be a single undo step.');

function rejectsWithoutMutation(candidate, pattern) {
  const snapshot = JSON.stringify(E.proj);
  assert.throws(() => E.previewProjectPlan(candidate), pattern);
  assert.equal(JSON.stringify(E.proj), snapshot);
}
rejectsWithoutMutation({
  version: 1,
  clips: [
    { alias: 'one', type: 'text', content: 'One', start: 0, duration: 5 },
    { alias: 'two', type: 'text', content: 'Two', start: 4, duration: 2 }
  ]
}, /overlaps/);
rejectsWithoutMutation({
  version: 1,
  clips: [{ alias: 'missing', media: 'not-imported', start: 0, duration: 2 }]
}, /not imported/);
rejectsWithoutMutation({
  version: 1,
  clips: [{ alias: 'wrong-lane', media: 'song', track: 'Not a track', start: 0, duration: 2 }]
}, /unknown named track/);
rejectsWithoutMutation({
  version: 1,
  clips: [{ alias: 'bad-property', type: 'text', content: 'Text', start: 0, duration: 2, properties: { 'audio.volume': 1 } }]
}, /not available on text clips/);
rejectsWithoutMutation({
  version: 1,
  clips: [{ alias: 'ambiguous', media: 'Same name', start: 0, duration: 2 }]
}, /ambiguous/);
rejectsWithoutMutation({
  version: 2,
  clips: [{ alias: 'wrong-version', type: 'text', content: 'Text', start: 0, duration: 2 }]
}, /version: 1/);
rejectsWithoutMutation({
  version: 1,
  clips: [{ alias: 'bad-alias!', type: 'text', content: 'Text', start: 0, duration: 2 }]
}, /alias must start with a letter/);

E.newProject('16:9');
const defaultVisual = E.proj.rows.find(row => row.kind === 'v');
const occupied = E.newClip('image', { name: 'Manual clip', row: defaultVisual.id, start: 0, dur: 3 });
E.proj.clips.push(occupied);
rejectsWithoutMutation({
  version: 1,
  clips: [{ alias: 'conflict', type: 'text', content: 'Conflict', start: 2, duration: 2 }]
}, /overlaps/);

console.log('Script-driven project plan validation, preview, apply, aliases and undo tests passed.');
