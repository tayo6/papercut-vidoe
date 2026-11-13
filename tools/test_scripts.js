'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const defs = ['transform.x','transform.y','transform.scale','transform.rotation','transform.opacity'];
const E = {
  listProperties: clip => defs.filter(id => clip.kind !== 'audio'),
  evaluateProperties: (clip, time, overrides) => {
    const values = Object.assign({
      'transform.x': clip.tf.x, 'transform.y': clip.tf.y, 'transform.scale': clip.tf.s,
      'transform.rotation': clip.tf.r, 'transform.opacity': clip.tf.o
    }, overrides);
    return { transform: { x: values['transform.x'], y: values['transform.y'], scale: values['transform.scale'],
      rotation: values['transform.rotation'], opacity: values['transform.opacity'] }};
  }
};
const context = { window: { __snip: { E } }, isFinite, Math, Number, Object, String, TypeError, SyntaxError, WeakMap };
vm.runInNewContext(fs.readFileSync('src/e_script.js','utf8'), context);
const clip = { id: 'c1', kind: 'video', dur: 4, tf: {x:0,y:0,s:1,r:0,o:1}, scriptEnabled: true,
  scriptCode: 'set transform.y = sin(time * 2) * 0.04\nset transform.opacity = clamp(1 - progress, 0, 1)' };
const checked = E.compileScript(clip, clip.scriptCode);
assert.strictEqual(checked.statements, 2);
assert.deepStrictEqual(Array.from(checked.properties), ['transform.y','transform.opacity']);
const atZero = E.runClipScript(clip, 0);
assert(Math.abs(atZero.y) < 1e-9);
assert.strictEqual(atZero.opacity, 1);
const halfway = E.runClipScript(clip, 2);
assert(Math.abs(halfway.y - Math.sin(4) * 0.04) < 1e-9);
assert.strictEqual(halfway.opacity, 0.5);
assert.strictEqual(E.runClipScript(Object.assign({},clip,{scriptEnabled:false}), 2), null);
assert.throws(() => E.compileScript(clip, 'set window.location = 4'), /Line 1/);
assert.throws(() => E.compileScript(clip, 'set audio.volume = 1'), /not scriptable/);
assert.throws(() => E.compileScript(clip, 'set transform.x = fetch(1)'), /not allowed/);
assert.throws(() => E.compileScript(clip, 'set transform.x = time +'), /Expected a value/);
const badRuntime = Object.assign({}, clip, { scriptCode: 'set transform.x = 1 / (time - time)' });
assert.strictEqual(E.runClipScript(badRuntime, 1), null);
assert(/Division by zero/.test(E.getClipScriptError(badRuntime)));
console.log('SnipScript tests passed.');
