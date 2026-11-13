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
vm.runInNewContext(fs.readFileSync('src/e_script.js', 'utf8'), sandbox);
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
  version: 3,
  clips: [{ alias: 'wrong-version', type: 'text', content: 'Text', start: 0, duration: 2 }]
}, /version: 1 for a flat clip plan or version: 2 for a scene plan/);
rejectsWithoutMutation({
  version: 1,
  clips: [{ alias: 'bad-alias!', type: 'text', content: 'Text', start: 0, duration: 2 }]
}, /alias must start with a letter/);
rejectsWithoutMutation({ version: 1, clips: [{ alias: 'c123', type: 'text', content: 'Text', start: 0, duration: 2 }] }, /automatically generated clip ID/);

E.newProject('16:9');
const defaultVisual = E.proj.rows.find(row => row.kind === 'v');
const occupied = E.newClip('image', { name: 'Manual clip', row: defaultVisual.id, start: 0, dur: 3 });
E.proj.clips.push(occupied);
rejectsWithoutMutation({
  version: 1,
  clips: [{ alias: 'conflict', type: 'text', content: 'Conflict', start: 2, duration: 2 }]
}, /overlaps/);


/* Scene plans use absolute scene positions and local clip offsets. */
E.newProject('16:9');
const scenePlan = {
  version: 2,
  tracks: [
    { name: 'Visuals', kind: 'video' },
    { name: 'Dialogue', kind: 'audio' }
  ],
  scenes: [
    {
      alias: 'intro',
      name: 'Intro',
      start: 0,
      duration: 4,
      clips: [
        { alias: 'intro-title', type: 'text', content: 'Welcome', track: 'Visuals', start: 0, duration: 3 },
        { alias: 'intro-music', media: 'song', track: 'Dialogue', start: 0, duration: 4 }
      ]
    },
    {
      alias: 'main',
      name: 'Main Scene',
      start: 4,
      duration: 5,
      clips: [
        { alias: 'hero-scene-shot', media: 'hero', track: 'Visuals', start: 0.5, duration: 4 }
      ]
    },
    {
      alias: 'outro',
      name: 'Outro',
      start: 9,
      duration: 3,
      clips: [
        { alias: 'outro-title', type: 'text', content: 'Thank you', track: 'Visuals', start: 0, duration: 3 }
      ]
    }
  ]
};
const previewScenes = E.previewProjectPlan(scenePlan);
assert.equal(previewScenes.version, 2);
assert.equal(previewScenes.scenesToCreate, 3);
assert.equal(previewScenes.scenesToUpdate, 0);
assert.equal(previewScenes.scenes.length, 3);
assert.equal(previewScenes.clipsToCreate, 4);
assert.equal(previewScenes.items.find(item => item.alias === 'hero-scene-shot').start, 4.5);
assert.equal(E.proj.scenes.length, 0, 'Scene preview must not mutate project metadata.');
const sceneApply = E.applyProjectPlan(scenePlan);
assert.equal(E.proj.scenes.length, 3);
const introScene = E.proj.scenes.find(scene => scene.alias === 'intro');
const mainScene = E.proj.scenes.find(scene => scene.alias === 'main');
assert(introScene && mainScene);
assert.equal(introScene.name, 'Intro');
assert.equal(introScene.duration, 4);
const introTitle = E.proj.clips.find(clip => clip.scriptAlias === 'intro-title');
const introMusic = E.proj.clips.find(clip => clip.scriptAlias === 'intro-music');
const heroSceneShot = E.proj.clips.find(clip => clip.scriptAlias === 'hero-scene-shot');
assert.equal(introTitle.start, 0);
assert.equal(introTitle.sceneId, introScene.id);
assert.equal(introTitle.sceneAlias, 'intro');
assert.equal(introMusic.row, E.proj.rows.find(row => row.scriptName === 'Dialogue').id);
assert.equal(heroSceneShot.start, 4.5);
assert.equal(heroSceneShot.sceneId, mainScene.id);
assert.equal(sceneApply.scenesToCreate, 3);
assert.equal(E.proj.clips.length, 4);
const introSceneId = introScene.id;
E.applyProjectPlan(scenePlan);
assert.equal(E.proj.scenes.length, 3, 'Reapplying a scene plan must not duplicate scenes.');
assert.equal(E.proj.scenes.find(scene => scene.alias === 'intro').id, introSceneId);
assert.equal(E.proj.clips.length, 4, 'Reapplying a scene plan must not duplicate clips.');
E.undo();
assert.equal(E.proj.clips.length, 0);
assert.equal(E.proj.scenes.length, 0);

E.applyProjectPlan(scenePlan);
const shiftedScenes = JSON.parse(JSON.stringify(scenePlan));
shiftedScenes.scenes[1].start = 5;
shiftedScenes.scenes[2].start = 10;
const shiftedResult = E.applyProjectPlan(shiftedScenes);
assert.equal(shiftedResult.scenesToCreate, 0);
assert.equal(shiftedResult.scenesToUpdate, 3);
assert.equal(E.proj.scenes.find(scene => scene.alias === 'main').start, 5);
assert.equal(E.proj.clips.find(clip => clip.scriptAlias === 'hero-scene-shot').start, 5.5);
assert.equal(E.proj.clips.find(clip => clip.scriptAlias === 'outro-title').start, 10);
assert.equal(E.proj.clips.length, 4);
E.undo();
assert.equal(E.proj.scenes.find(scene => scene.alias === 'main').start, 4);
assert.equal(E.proj.clips.find(clip => clip.scriptAlias === 'hero-scene-shot').start, 4.5);
assert.equal(E.proj.clips.find(clip => clip.scriptAlias === 'outro-title').start, 9);

rejectsWithoutMutation({
  version: 2,
  tracks: [],
  scenes: [{ alias: 'too-short', name: 'Too short', start: 0, duration: 2, clips: [
    { alias: 'too-long', type: 'text', content: 'Too long', duration: 3 }
  ] }]
}, /fit inside scene/);
rejectsWithoutMutation({
  version: 2,
  tracks: [],
  scenes: [
    { alias: 'same-scene', name: 'First', start: 0, duration: 2, clips: [{ alias: 'a', type: 'text', content: 'A', duration: 2 }] },
    { alias: 'same-scene', name: 'Duplicate', start: 2, duration: 2, clips: [{ alias: 'b', type: 'text', content: 'B', duration: 2 }] }
  ]
}, /Scene aliases must be unique/);
rejectsWithoutMutation({
  version: 2,
  tracks: [],
  scenes: [{ alias: 'empty-scene', name: 'Empty', start: 0, duration: 2, clips: [] }]
}, /must contain at least one clip/);


/* Unified version 3 documents validate and apply structure plus all animation layers together. */
E.newProject('16:9');
const unifiedPlan = {
  version: 3,
  tracks: [{ name: 'Unified Visuals', kind: 'video' }],
  script: 'clip unified-title set transform.opacity = 0.85',
  scenes: [{
    alias: 'unified-intro', name: 'Unified Intro', start: 0, duration: 3,
    script: 'clip unified-title set transform.y = sin(time) * 0.1',
    clips: [{
      alias: 'unified-title', type: 'text', content: 'Unified',
      track: 'Unified Visuals', start: 0, duration: 3,
      script: 'at 0s set transform.scale = 0.5\nat 1s tween transform.scale = 1 over 1s ease out'
    }]
  }]
};
const beforeUnifiedPreview = JSON.stringify(E.proj);
const unifiedCheck = E.compileUnifiedProject(unifiedPlan);
assert.equal(JSON.stringify(E.proj), beforeUnifiedPreview, 'Unified validation must not mutate the project.');
assert.equal(unifiedCheck.scenes.length, 1);
assert.equal(unifiedCheck.items.length, 1);
assert.equal(unifiedCheck.clipScriptStatements, 2);
assert.equal(unifiedCheck.sceneScriptStatements, 1);
assert.equal(unifiedCheck.projectScriptStatements, 1);
assert.equal(unifiedCheck.scriptStatements, 4);
const unifiedApply = E.applyUnifiedProject(unifiedPlan);
assert.equal(E.proj.clips.length, 1);
assert.equal(E.proj.scenes.length, 1);
assert.equal(E.proj.projectBundleCode, JSON.stringify(unifiedPlan));
assert.equal(E.proj.projectScriptEnabled, true);
const unifiedClip = E.proj.clips.find(clip => clip.scriptAlias === 'unified-title');
const unifiedScene = E.proj.scenes.find(scene => scene.alias === 'unified-intro');
assert.equal(unifiedClip.scriptEnabled, true);
assert.equal(unifiedScene.scriptEnabled, true);
assert.equal(unifiedApply.scriptStatements, 4);
let unifiedFrame = E.runClipScriptFrame(unifiedClip, 0);
assert.equal(unifiedFrame.transform.scale, 0.5);
unifiedFrame = E.runClipScriptFrame(unifiedClip, 2);
assert(Math.abs(unifiedFrame.transform.scale - 1) < 1e-9);
unifiedFrame = E.runSceneScriptFrame(unifiedScene, unifiedClip, 1);
assert(Math.abs(unifiedFrame.transform.y - Math.sin(1) * 0.1) < 1e-9);
unifiedFrame = E.runProjectScriptFrame(unifiedClip, 1);
assert.equal(unifiedFrame.transform.opacity, 0.85);
assert.equal(E.canUndo(), true);
E.undo();
assert.equal(E.proj.clips.length, 0, 'A unified project apply must be a single undo step.');
assert.equal(E.proj.scenes.length, 0);
assert.equal(E.proj.projectBundleCode, undefined);

const badUnified = JSON.parse(JSON.stringify(unifiedPlan));
badUnified.script = 'clip not-a-real-clip set transform.x = 1';
const beforeBadUnified = JSON.stringify(E.proj);
assert.throws(() => E.compileUnifiedProject(badUnified), /Unknown clip target/);
assert.equal(JSON.stringify(E.proj), beforeBadUnified, 'Invalid scripts must not mutate the project.');
assert.throws(() => E.applyUnifiedProject(badUnified), /Unknown clip target/);
assert.equal(JSON.stringify(E.proj), beforeBadUnified, 'Failed unified apply must leave the project unchanged.');

console.log('Script-driven project plan validation, preview, apply, aliases and undo tests passed.');
