'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const types={'transform.x':'number','transform.y':'number','transform.scale':'number','transform.rotation':'number','transform.opacity':'number','audio.volume':'number','audio.fadeIn':'number','audio.fadeOut':'number','text.fontSize':'number','text.color':'color','paper.enabled':'boolean','paper.edge':'number','paper.roughness':'number','paper.detail':'number','paper.grain':'number','paper.color':'color','paper.boil':'number','paper.boilFps':'number','paper.boilLoop':'number','paper.shadow':'number','paper.shadowBlur':'number'};
const E={
 listProperties:c=>Object.keys(types).filter(id=>id.startsWith('audio.')?['audio','video'].includes(c.kind):id.startsWith('text.')?c.kind==='text':id.startsWith('paper.')?['image','video','text'].includes(c.kind):['image','video','text'].includes(c.kind)).map(id=>({id,type:types[id]})),
 getPropertyDef:id=>types[id]?{id,type:types[id]}:null,
 normalizeProperty:(id,v)=>{if(types[id]==='boolean'){if(typeof v!=='boolean')throw new TypeError('bad boolean');return v;}if(types[id]==='number'){if(typeof v!=='number'||!isFinite(v))throw new TypeError('bad number');return Math.max(id==='transform.x'||id==='transform.y'?-1:0,Math.min(id==='transform.x'||id==='transform.y'?1:id==='audio.volume'?2:2000,v));}if(types[id]==='color'&&typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))return v.toLowerCase();throw new TypeError('bad property value');},
 getProperty:(c,id,t)=>c.values[id],
 evaluateProperties:(c,t,o)=>{const values=Object.assign({},c.values,o);return {values,transform:{x:values['transform.x'],y:values['transform.y'],scale:values['transform.scale'],rotation:values['transform.rotation'],opacity:values['transform.opacity']},audio:{volume:values['audio.volume'],fadeIn:values['audio.fadeIn'],fadeOut:values['audio.fadeOut']},text:{fontSize:values['text.fontSize'],color:values['text.color']},paper:{enabled:values['paper.enabled'],edge:values['paper.edge'],roughness:values['paper.roughness'],detail:values['paper.detail'],grain:values['paper.grain'],color:values['paper.color'],boil:values['paper.boil'],boilFps:values['paper.boilFps'],boilLoop:values['paper.boilLoop'],shadow:values['paper.shadow'],shadowBlur:values['paper.shadowBlur']}};}
};
const context={window:{__snip:{E}},isFinite,Math,Number,Object,String,TypeError,SyntaxError,WeakMap};vm.runInNewContext(fs.readFileSync('src/e_script.js','utf8'),context);
assert.strictEqual(E.easeProgress('linear',0.25),0.25);
assert.strictEqual(E.easeProgress('in',0.25),0.0625);
assert.strictEqual(E.easeProgress('out',0.25),0.4375);
assert.strictEqual(E.easeProgress('inout',0.25),0.125);
assert.strictEqual(E.easeProgress('smooth',0.25),0.15625);
assert.strictEqual(E.easeProgress('linear',-1),0);
assert.strictEqual(E.easeProgress('linear',2),1);
const standardBezier={x1:0.25,y1:0.1,x2:0.25,y2:1};
assert(Math.abs(E.cubicBezierProgress(standardBezier,0.5)-0.8024024)<1e-5);
for(let sample=0;sample<=20;sample++){
 const time=sample/20, value=E.cubicBezierProgress(standardBezier,time);
 assert(value>=0&&value<=1,`Bezier output should stay in range at ${time}`);
 if(sample>0)assert(value>=E.cubicBezierProgress(standardBezier,(sample-1)/20),`Standard easing should be monotonic at ${time}`);
}
assert.strictEqual(E.cubicBezierProgress(standardBezier,0),0);
assert.strictEqual(E.cubicBezierProgress(standardBezier,1),1);
assert.throws(()=>E.cubicBezierProgress({x1:1.2,y1:0,x2:0.2,y2:1},0.5),/outside the supported range/);
const base={'transform.x':0,'transform.y':0,'transform.scale':1,'transform.rotation':0,'transform.opacity':1,'audio.volume':1,'audio.fadeIn':0,'audio.fadeOut':0,'text.fontSize':120,'text.color':'#ffffff','paper.enabled':false,'paper.edge':14,'paper.roughness':45,'paper.detail':55,'paper.grain':40,'paper.color':'#000000','paper.boil':0,'paper.boilFps':8,'paper.boilLoop':3,'paper.shadow':20,'paper.shadowBlur':14};
const clip={id:'c1',kind:'video',dur:4,values:Object.assign({},base),scriptEnabled:true,scriptCode:'set transform.y = sin(time * 2) * 0.04\nset transform.opacity = clamp(1 - progress, 0, 1)'};
let c=E.compileScript(clip,clip.scriptCode);assert.strictEqual(c.statements,2);assert.strictEqual(c.events,0);
let f=E.runClipScriptFrame(clip,0);assert(Math.abs(f.transform.y)<1e-9);assert.strictEqual(f.transform.opacity,1);
f=E.runClipScriptFrame(clip,2);assert(Math.abs(f.transform.y-Math.sin(4)*0.04)<1e-9);assert.strictEqual(f.transform.opacity,0.5);
const cues=Object.assign({},clip,{scriptCode:'at 0s set transform.scale = 0.5\nat 1s tween transform.scale = 1 over 1s ease out'});
assert.strictEqual(E.compileScript(cues,cues.scriptCode).events,2);assert.strictEqual(E.runClipScriptFrame(cues,0.5).transform.scale,0.5);
const movedCues=Object.assign({},cues,{scriptCode:cues.scriptCode});
const listed=E.listClipScriptCues(movedCues);assert.strictEqual(listed.length,2);assert.strictEqual(listed[1].line,2);
assert.strictEqual(E.moveClipScriptCue(movedCues,2,1.5),1.5);assert(movedCues.scriptCode.includes('at 1.5s tween transform.scale'));
assert.strictEqual(E.listClipScriptCues(movedCues)[1].at,1.5);assert.strictEqual(listed[1].mode,'tween');assert.strictEqual(listed[1].property,'transform.scale');assert.strictEqual(listed[1].end,2);
assert.throws(()=>E.moveClipScriptCue(movedCues,99,2),/no longer exists/);
assert(Math.abs(E.runClipScriptFrame(cues,1.5).transform.scale-0.875)<1e-9);assert.strictEqual(E.runClipScriptFrame(cues,2).transform.scale,1);
const tx=Object.assign({},clip,{kind:'text',scriptCode:'set text.fontSize = 180\nset text.color = rgb(255, 128, 0)'});
assert.strictEqual(E.compileScript(tx,tx.scriptCode).statements,2);f=E.runClipScriptFrame(tx,1);if(!f)throw new Error('Text script runtime error: '+E.getClipScriptError(tx));assert.strictEqual(f.text.fontSize,180);assert.strictEqual(f.text.color,'#ff8000');
const paper=Object.assign({},clip,{kind:'image',scriptCode:'at 0s set paper.edge = 10\nat 1s tween paper.edge = 50 over 1s ease linear'});
assert.strictEqual(E.runClipScriptFrame(paper,0.5).paper.edge,10);assert.strictEqual(E.runClipScriptFrame(paper,1.5).paper.edge,30);
const paperControls=Object.assign({},clip,{kind:'image',scriptCode:['at 0s set paper.enabled = true','at 0s set paper.edge = 12','at 0s set paper.roughness = 60','at 0s set paper.detail = 75','at 0s set paper.grain = 65','at 0s tween paper.color = #ffffff over 1s ease linear','at 0s set paper.boil = 5','at 0s set paper.boilFps = 12','at 0s set paper.boilLoop = 6','at 0s set paper.shadow = 35','at 0s set paper.shadowBlur = 16','at 1s set paper.enabled = false'].join('\n')});
assert.strictEqual(E.compileScript(paperControls,paperControls.scriptCode).statements,12);
f=E.runClipScriptFrame(paperControls,0.5);assert(f,'Papercut script should evaluate: '+E.getClipScriptError(paperControls));
assert.strictEqual(f.paper.enabled,true);assert.strictEqual(f.paper.edge,12);assert.strictEqual(f.paper.roughness,60);assert.strictEqual(f.paper.detail,75);assert.strictEqual(f.paper.grain,65);assert.strictEqual(f.paper.color,'#808080');assert.strictEqual(f.paper.boil,5);assert.strictEqual(f.paper.boilFps,12);assert.strictEqual(f.paper.boilLoop,6);assert.strictEqual(f.paper.shadow,35);assert.strictEqual(f.paper.shadowBlur,16);
assert.strictEqual(E.runClipScriptFrame(paperControls,1.5).paper.enabled,false);
assert.throws(()=>E.compileScript(paperControls,'at 0s tween paper.enabled = true over 1s'),/Boolean properties can only use set/);
const aud=Object.assign({},clip,{kind:'audio',scriptCode:'set audio.volume = 0.5 + sin(time) * 0.2'});
assert(Math.abs(E.runClipScriptFrame(aud,Math.PI/2).audio.volume-0.7)<1e-9);
const audCue=Object.assign({},clip,{kind:'audio',scriptCode:'at 0s set audio.volume = 0.2\nat 1s tween audio.volume = 1 over 1s ease linear'});
assert.strictEqual(E.runClipScriptFrame(audCue,0.5).audio.volume,0.2);
assert(Math.abs(E.runClipScriptFrame(audCue,1.5).audio.volume-0.6)<1e-9);
assert.throws(()=>E.compileScript(clip,'set window.location = 4'),/Line 1/);assert.throws(()=>E.compileScript(clip,'set text.fontSize = 180'),/not scriptable/);
assert.throws(()=>E.compileScript(clip,'set transform.x = fetch(1)'),/not allowed/);assert.throws(()=>E.compileScript(clip,'set transform.x = time +'),/Expected a value/);
assert.throws(()=>E.compileScript(clip,'set transform.x = 1\nat 1s set transform.x = 2'),/Do not mix/);
assert.throws(()=>E.compileScript(clip,'at 3.8s tween transform.scale = 2 over 1s'),/end within the clip/);
const bezierTween=Object.assign({},clip,{scriptCode:'at 0s tween transform.scale = 2 over 1s ease cubic-bezier(0.25, 0.1, 0.25, 1)'});
assert.strictEqual(E.compileScript(bezierTween,bezierTween.scriptCode).events,1);
assert(Math.abs(E.runClipScriptFrame(bezierTween,0.5).transform.scale-1.8024024)<1e-5);
assert.throws(()=>E.compileScript(clip,'at 0s tween transform.scale = 2 over 1s ease cubic-bezier(1.2, 0, 0.2, 1)'),/X control points must be between 0 and 1/);
assert.throws(()=>E.compileScript(clip,'at 0s tween transform.scale = 2 over 1s ease cubic-bezier(0.2, 2, 0.8, 1)'),/Y control points must be between -0.25 and 1.25/);
const bad=Object.assign({},clip,{scriptCode:'set transform.x = 1 / (time - time)'});
assert.strictEqual(E.runClipScriptFrame(bad,1),null);assert(/Division by zero/.test(E.getClipScriptError(bad)));
let presetSeq=0;
E.uid=prefix=>prefix+(++presetSeq);
E.proj={scriptPresets:[]};
const videoPreset=E.saveScriptPreset('Video Float',clip,cues.scriptCode);
const textPreset=E.saveScriptPreset('Text Pop',tx,tx.scriptCode);
assert.strictEqual(E.listScriptPresets().length,2);
assert.strictEqual(E.getScriptPreset(videoPreset.id).name,'Video Float');
assert.throws(()=>E.applyScriptPreset(textPreset.id,clip),/not scriptable/);
assert.strictEqual(E.applyScriptPreset(videoPreset.id,clip),true);
assert.strictEqual(clip.scriptEnabled,true);
assert.strictEqual(clip.scriptCode,cues.scriptCode);
const updatedPreset=E.saveScriptPreset('video float',clip,'set transform.x = 0.25');
assert.strictEqual(updatedPreset.id,videoPreset.id);
assert.strictEqual(E.listScriptPresets().length,2);
assert.strictEqual(E.getScriptPreset(videoPreset.id).code,'set transform.x = 0.25');
assert.strictEqual(E.deleteScriptPreset(textPreset.id),true);
assert.strictEqual(E.deleteScriptPreset(textPreset.id),false);
assert.strictEqual(E.listScriptPresets().length,1);
console.log('SnipScript v2, project library, easing and custom Bezier tests passed.');
