'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const types={'transform.x':'number','transform.y':'number','transform.scale':'number','transform.rotation':'number','transform.opacity':'number','audio.volume':'number','audio.fadeIn':'number','audio.fadeOut':'number','text.fontSize':'number','text.color':'color','paper.edge':'number','paper.roughness':'number'};
const E={
 listProperties:c=>Object.keys(types).filter(id=>id.startsWith('audio.')?['audio','video'].includes(c.kind):id.startsWith('text.')?c.kind==='text':id.startsWith('paper.')?['image','video','text'].includes(c.kind):['image','video','text'].includes(c.kind)),
 getPropertyDef:id=>types[id]?{id,type:types[id]}:null,
 normalizeProperty:(id,v)=>types[id]==='number'?Math.max(id==='transform.x'||id==='transform.y'?-1:0,Math.min(id==='transform.x'||id==='transform.y'?1:id==='audio.volume'?2:2000,Number(v))):(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():(()=>{throw new TypeError('bad colour');})()),
 getProperty:(c,id,t)=>c.values[id],
 evaluateProperties:(c,t,o)=>{const values=Object.assign({},c.values,o);return {values,transform:{x:values['transform.x'],y:values['transform.y'],scale:values['transform.scale'],rotation:values['transform.rotation'],opacity:values['transform.opacity']},audio:{volume:values['audio.volume'],fadeIn:values['audio.fadeIn'],fadeOut:values['audio.fadeOut']},text:{fontSize:values['text.fontSize'],color:values['text.color']},paper:{edge:values['paper.edge'],roughness:values['paper.roughness']}};}
};
const context={window:{__snip:{E}},isFinite,Math,Number,Object,String,TypeError,SyntaxError,WeakMap};vm.runInNewContext(fs.readFileSync('src/e_script.js','utf8'),context);
const base={'transform.x':0,'transform.y':0,'transform.scale':1,'transform.rotation':0,'transform.opacity':1,'audio.volume':1,'audio.fadeIn':0,'audio.fadeOut':0,'text.fontSize':120,'text.color':'#ffffff','paper.edge':14,'paper.roughness':45};
const clip={id:'c1',kind:'video',dur:4,values:Object.assign({},base),scriptEnabled:true,scriptCode:'set transform.y = sin(time * 2) * 0.04\nset transform.opacity = clamp(1 - progress, 0, 1)'};
let c=E.compileScript(clip,clip.scriptCode);assert.strictEqual(c.statements,2);assert.strictEqual(c.events,0);
let f=E.runClipScriptFrame(clip,0);assert(Math.abs(f.transform.y)<1e-9);assert.strictEqual(f.transform.opacity,1);
f=E.runClipScriptFrame(clip,2);assert(Math.abs(f.transform.y-Math.sin(4)*0.04)<1e-9);assert.strictEqual(f.transform.opacity,0.5);
const cues=Object.assign({},clip,{scriptCode:'at 0s set transform.scale = 0.5\nat 1s tween transform.scale = 1 over 1s ease out'});
assert.strictEqual(E.compileScript(cues,cues.scriptCode).events,2);assert.strictEqual(E.runClipScriptFrame(cues,0.5).transform.scale,0.5);
assert(Math.abs(E.runClipScriptFrame(cues,1.5).transform.scale-0.875)<1e-9);assert.strictEqual(E.runClipScriptFrame(cues,2).transform.scale,1);
const tx=Object.assign({},clip,{kind:'text',scriptCode:'set text.fontSize = 180\nset text.color = rgb(255, 128, 0)'});
f=E.runClipScriptFrame(tx,1);assert.strictEqual(f.text.fontSize,180);assert.strictEqual(f.text.color,'#ff8000');
const paper=Object.assign({},clip,{kind:'image',scriptCode:'at 0s set paper.edge = 10\nat 1s tween paper.edge = 50 over 1s ease linear'});
assert.strictEqual(E.runClipScriptFrame(paper,0.5).paper.edge,10);assert.strictEqual(E.runClipScriptFrame(paper,1.5).paper.edge,30);
const aud=Object.assign({},clip,{kind:'audio',scriptCode:'set audio.volume = 0.5 + sin(time) * 0.2'});
assert(Math.abs(E.runClipScriptFrame(aud,Math.PI/2).audio.volume-0.7)<1e-9);
const audCue=Object.assign({},clip,{kind:'audio',scriptCode:'at 0s set audio.volume = 0.2\nat 1s tween audio.volume = 1 over 1s ease linear'});
assert.strictEqual(E.runClipScriptFrame(audCue,0.5).audio.volume,0.2);
assert(Math.abs(E.runClipScriptFrame(audCue,1.5).audio.volume-0.6)<1e-9);
assert.throws(()=>E.compileScript(clip,'set window.location = 4'),/Line 1/);assert.throws(()=>E.compileScript(clip,'set audio.volume = 1'),/not scriptable/);
assert.throws(()=>E.compileScript(clip,'set transform.x = fetch(1)'),/not allowed/);assert.throws(()=>E.compileScript(clip,'set transform.x = time +'),/Expected a value/);
assert.throws(()=>E.compileScript(clip,'set transform.x = 1\nat 1s set transform.x = 2'),/Do not mix/);
assert.throws(()=>E.compileScript(clip,'at 3.8s tween transform.scale = 2 over 1s'),/end within the clip/);
const bad=Object.assign({},clip,{scriptCode:'set transform.x = 1 / (time - time)'});
assert.strictEqual(E.runClipScriptFrame(bad,1),null);assert(/Division by zero/.test(E.getClipScriptError(bad)));
console.log('SnipScript v2 tests passed.');
