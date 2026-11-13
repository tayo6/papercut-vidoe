(function () {
'use strict';
/* Allow-listed property registry shared by editor controls and future clip scripts. */
var K = window.__snip, E = K.E;
var DEFS = [
  { id:'transform.x', label:'Position X', group:'Transform', type:'number', kinds:['image','video','text'], path:['tf','x'], keyframe:'x', min:-1, max:1, step:0.005 },
  { id:'transform.y', label:'Position Y', group:'Transform', type:'number', kinds:['image','video','text'], path:['tf','y'], keyframe:'y', min:-1, max:1, step:0.005 },
  { id:'transform.scale', label:'Scale', group:'Transform', type:'number', kinds:['image','video','text'], path:['tf','s'], keyframe:'s', min:0.03, max:10, step:0.01 },
  { id:'transform.rotation', label:'Rotation', group:'Transform', type:'number', kinds:['image','video','text'], path:['tf','r'], keyframe:'r', min:-3600, max:3600, step:1 },
  { id:'transform.opacity', label:'Opacity', group:'Transform', type:'number', kinds:['image','video','text'], path:['tf','o'], keyframe:'o', min:0, max:1, step:0.01 },
  { id:'audio.volume', label:'Volume', group:'Audio', type:'number', kinds:['audio','video'], path:['vol'], min:0, max:2, step:0.01 },
  { id:'audio.fadeIn', label:'Fade in', group:'Audio', type:'number', kinds:['audio','video'], path:['fadeIn'], min:0, max:60, step:0.01 },
  { id:'audio.fadeOut', label:'Fade out', group:'Audio', type:'number', kinds:['audio','video'], path:['fadeOut'], min:0, max:60, step:0.01 },
  { id:'text.fontSize', label:'Font size', group:'Text', type:'number', kinds:['text'], path:['text','size'], min:1, max:2000, step:1 },
  { id:'text.color', label:'Text colour', group:'Text', type:'color', kinds:['text'], path:['text','color'] },
  { id:'paper.edge', label:'Paper edge', group:'PaperCut', type:'number', kinds:['image','video','text'], path:['cut','edge'], min:0, max:100, step:1 },
  { id:'paper.roughness', label:'Paper roughness', group:'PaperCut', type:'number', kinds:['image','video','text'], path:['cut','rough'], min:0, max:100, step:1 }
];
var BY_ID = Object.create(null);
DEFS.forEach(function (d) { BY_ID[d.id] = d; });
function supports(c,d) { return !!(c && d && d.kinds.indexOf(c.kind) !== -1); }
function read(c,path) { var v=c; for(var i=0;i<path.length && v!=null;i++) v=v[path[i]]; return v; }
function write(c,path,value) { var v=c; for(var i=0;i<path.length-1;i++){ if(!v[path[i]] || typeof v[path[i]]!=='object') v[path[i]]={}; v=v[path[i]]; } v[path[path.length-1]]=value; }
function timeOf(c,t) { if(typeof t!=='number' || !isFinite(t)) t=E.localT(c); return K.clamp(t,0,Math.max(0,c.dur||0)); }
function normalize(d,value) {
  if(d.type==='number'){ var n=Number(value); if(!isFinite(n)) throw new TypeError(d.id+' requires a finite number'); return K.clamp(n,d.min,d.max); }
  if(d.type==='color'){ if(typeof value!=='string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new TypeError(d.id+' requires a six-digit hex colour'); return value.toLowerCase(); }
  throw new TypeError('Unsupported property type: '+d.type);
}
E.PROPERTY_DEFS=DEFS.slice();
E.getPropertyDef=function(id){ var d=BY_ID[id]; if(!d)return null; return {id:d.id,label:d.label,group:d.group,type:d.type,kinds:d.kinds.slice(),keyframe:d.keyframe||null,min:d.min,max:d.max,step:d.step}; };
E.listProperties=function(c){ return DEFS.filter(function(d){return supports(c,d);}).map(function(d){var x=E.getPropertyDef(d.id);x.animated=!!(d.keyframe&&E.isAnimated(c,d.keyframe));return x;}); };
E.normalizeProperty=function(id,value){var d=BY_ID[id];if(!d)throw new TypeError('Unknown property: '+id);return normalize(d,value);};
E.getProperty=function(c,id,time){var d=BY_ID[id];if(!supports(c,d))return undefined;return d.keyframe?E.tfAt(c,timeOf(c,time))[d.keyframe]:read(c,d.path);};
/* Writes follow existing editor semantics: animated transforms update/create a keyframe;
   unanimated transforms update the base value. {base:true} always targets the base value. */
E.setProperty=function(c,id,value,options){
  var d=BY_ID[id],o=options||{};if(!supports(c,d))throw new TypeError('Property '+id+' is not available on this clip.');
  value=normalize(d,value);
  if(d.keyframe && o.base!==true && E.isAnimated(c,d.keyframe)) E.setTf(c,d.keyframe,value,timeOf(c,o.time));
  else write(c,d.path,value);
  if(o.commit===true){E.emit('project');E.dirty();E.commit();}
  return value;
};
/* Produces detached, validated values for a future sandbox. It never mutates the clip. */
E.evaluateProperties=function(c,time,overrides){
  if(!c)throw new TypeError('A clip is required');time=timeOf(c,time);
  var values={},tf=E.tfAt(c,time);
  DEFS.forEach(function(d){if(supports(c,d))values[d.id]=d.keyframe?tf[d.keyframe]:read(c,d.path);});
  if(overrides)Object.keys(overrides).forEach(function(id){var d=BY_ID[id];if(!supports(c,d))throw new TypeError('Property '+id+' is not available on this clip.');values[id]=normalize(d,overrides[id]);});
  return {clipId:c.id,kind:c.kind,time:time,values:values,
    transform:{x:values['transform.x'],y:values['transform.y'],scale:values['transform.scale'],rotation:values['transform.rotation'],opacity:values['transform.opacity'],flipX:!!tf.fx,flipY:!!tf.fy,fit:tf.fit},
    audio:values['audio.volume']==null?null:{volume:values['audio.volume'],fadeIn:values['audio.fadeIn'],fadeOut:values['audio.fadeOut'],muted:!!c.mute},
    text:c.text?{content:c.text.str,fontSize:values['text.fontSize'],color:values['text.color'],align:c.text.align}:null,
    paper:c.cut?{enabled:!!c.cut.on,edge:values['paper.edge'],roughness:values['paper.roughness']}:null};
};
})();