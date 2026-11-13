#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E={KF_EPS:0.02,defKf:()=>({x:[],y:[],s:[],r:[],o:[]}),localT:c=>0,
 isAnimated:(c,p)=>!!(c.kf&&c.kf[p]&&c.kf[p].length),
 tfAt(c,t){const out={...c.tf};for(const p of ['x','y','s','r','o']){const a=c.kf[p]||[];if(!a.length)continue;if(t<=a[0].t){out[p]=a[0].v;continue;}if(t>=a[a.length-1].t){out[p]=a[a.length-1].v;continue;}let i=1;while(a[i].t<t)i++;const l=a[i-1],r=a[i],u=(t-l.t)/(r.t-l.t);out[p]=l.v+(r.v-l.v)*u;}return out;},
 kfIndex(c,p,t){return (c.kf[p]||[]).findIndex(k=>Math.abs(k.t-t)<=this.KF_EPS);},
 setTf(c,p,v,t){const a=c.kf[p]||(c.kf[p]=[]),i=this.kfIndex(c,p,t);if(i>=0)a[i].v=v;else{a.push({t,v,e:'ease'});a.sort((x,y)=>x.t-y.t);}},
 emit(){},dirty(){},commit(){}
};
const sandbox={window:{__snip:{E,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}}};
vm.runInNewContext(fs.readFileSync('src/e_props.js','utf8'),sandbox);
const clip={id:'a',kind:'image',dur:4,tf:{x:0,y:0,s:1,r:0,o:1,fx:false,fy:false,fit:'fit'},kf:E.defKf(),cut:{on:true,edge:12,rough:45,detail:55,grain:40,color:'#fbf7ee',boil:3,boilFps:8,boilLoop:3,shadow:20,shBlur:14}};
assert.equal(E.getProperty(clip,'transform.x',0),0);
E.setProperty(clip,'transform.x',0.4);assert.equal(clip.tf.x,0.4);
clip.kf.x.push({t:1,v:0.2,e:'lin'},{t:2,v:0.8,e:'lin'});
E.setProperty(clip,'transform.x',0.6,{time:2});assert.equal(E.getProperty(clip,'transform.x',2),0.6);
const snap=E.evaluateProperties(clip,2,{'transform.x':0.9});
assert.equal(snap.transform.x,0.9);assert.equal(clip.tf.x,0.4);
assert.equal(E.listProperties(clip).some(x=>x.id==='paper.detail'),true);
assert.equal(E.getProperty(clip,'paper.enabled'),true);
E.setProperty(clip,'paper.enabled',false);assert.equal(clip.cut.on,false);
E.setProperty(clip,'paper.detail',78);assert.equal(clip.cut.detail,78);
E.setProperty(clip,'paper.color','#e6d7b8');assert.equal(clip.cut.color,'#e6d7b8');
E.setProperty(clip,'paper.shadowBlur',18);assert.equal(clip.cut.shBlur,18);
assert.throws(()=>E.setProperty(clip,'paper.enabled',1),/true or false/);
const paperFrame={scriptedValues:{'paper.enabled':true,'paper.edge':30,'paper.color':'#ffffff'},paper:{enabled:true,edge:30,color:'#ffffff'}};
const scripted=E.applyScriptedProperties(clip,paperFrame);
assert.equal(scripted.cut.on,true);assert.equal(scripted.cut.edge,30);assert.equal(scripted.cut.color,'#ffffff');
assert.equal(clip.cut.on,false);assert.equal(clip.cut.edge,12);
assert.equal(E.listProperties(clip).some(x=>x.id==='audio.volume'),false);
const audio={id:'b',kind:'audio',dur:8,vol:1,fadeIn:0,fadeOut:0,mute:false,tf:clip.tf,kf:E.defKf(),cut:{on:false}};
E.setProperty(audio,'audio.volume',1.4);assert.equal(E.getProperty(audio,'audio.volume'),1.4);
assert.throws(()=>E.setProperty(audio,'transform.x',0.3),/not available/);
const txt={id:'c',kind:'text',dur:2,text:{str:'Hi',size:120,color:'#ffffff',align:'center'},tf:clip.tf,kf:E.defKf(),cut:clip.cut};
E.setProperty(txt,'text.fontSize',180);assert.equal(txt.text.size,180);
assert.throws(()=>E.setProperty(txt,'text.color','red'),/six-digit/);
console.log('Shared property API tests passed.');
