(function () {
'use strict';
/* SnipScript v2: bounded expressions plus deterministic clip-local cues. */
var K=window.__snip,E=K.E,CACHE=new WeakMap(),PROJECT_CACHE=new WeakMap(),SCENE_CACHE=new WeakMap();
var ALLOWED={'transform.x':1,'transform.y':1,'transform.scale':1,'transform.rotation':1,'transform.opacity':1,'audio.volume':1,'audio.fadeIn':1,'audio.fadeOut':1,'text.fontSize':1,'text.color':1,'paper.enabled':1,'paper.edge':1,'paper.roughness':1,'paper.detail':1,'paper.grain':1,'paper.color':1,'paper.boil':1,'paper.boilFps':1,'paper.boilLoop':1,'paper.shadow':1,'paper.shadowBlur':1};
var PREC={'+':1,'-':1,'*':2,'/':2,'%':2,'^':3};
function finiteArgs(args,name){for(var i=0;i<args.length;i++)if(typeof args[i]!=='number'||!isFinite(args[i]))throw new TypeError(name+'() needs finite numbers.');}
function positivePeriod(value,name){if(!(value>0)||!isFinite(value))throw new RangeError(name+'() needs a period greater than zero.');}
function wrapped(value,min,max,name){if(!(max>min)||!isFinite(max-min))throw new RangeError(name+'() needs a maximum greater than its minimum.');var span=max-min;return min+(((value-min)%span)+span)%span;}
var ARITY={pow:2,clamp:3,lerp:3,rgb:3,smoothstep:3,smootherstep:3,wrap:3,pingpong:2,saw:2,triangle:2,step:2,pulse:3,remap:5};
var FUNCS={
 abs:Math.abs,min:Math.min,max:Math.max,sin:Math.sin,cos:Math.cos,tan:Math.tan,round:Math.round,floor:Math.floor,ceil:Math.ceil,sqrt:Math.sqrt,pow:Math.pow,sign:Math.sign,
 clamp:function(v,a,b){return Math.max(a,Math.min(b,v));},lerp:function(a,b,t){return a+(b-a)*Math.max(0,Math.min(1,t));},
 fract:function(v){return v-Math.floor(v);},
 smoothstep:function(a,b,v){if(a===b)return v<a?0:1;var t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);},
 smootherstep:function(a,b,v){if(a===b)return v<a?0:1;var t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);},
 wrap:function(v,a,b){return wrapped(v,a,b,'wrap');},
 pingpong:function(t,length){positivePeriod(length,'pingpong');var p=wrapped(t,0,2*length,'pingpong');return p<=length?p:2*length-p;},
 saw:function(t,period){positivePeriod(period,'saw');return wrapped(t,0,period,'saw')/period;},
 triangle:function(t,period){positivePeriod(period,'triangle');var p=wrapped(t,0,period,'triangle')/period;return p<0.5?p*2:2-p*2;},
 step:function(edge,v){return v<edge?0:1;},
 pulse:function(t,period,duty){positivePeriod(period,'pulse');if(duty<0||duty>1)throw new RangeError('pulse() duty must be between 0 and 1.');return wrapped(t,0,period,'pulse')/period<duty?1:0;},
 remap:function(v,inMin,inMax,outMin,outMax){if(inMin===inMax)throw new RangeError('remap() input range must not be zero.');return outMin+(v-inMin)/(inMax-inMin)*(outMax-outMin);},
 rgb:function(r,g,b){function hx(v){return Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0');}if(![r,g,b].every(function(v){return typeof v==='number'&&isFinite(v);}))throw new TypeError('rgb() needs three finite numbers.');return '#'+hx(r)+hx(g)+hx(b);}
};
function fail(n,s){throw new SyntaxError('Line '+n+': '+s);}
function parseTweenEase(source,line){
 var name=String(source==null?'smooth':source).trim().toLowerCase();
 if(['linear','in','out','inout','smooth'].indexOf(name)>=0||/^(sine|cubic|quart|quint|expo|circ|back|bounce|elastic)-(in|out|inout)$/.test(name))return name;
 var m=name.match(/^cubic-bezier\s*\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/i);
 if(!m)fail(line,'Use a built-in easing name or cubic-bezier(x1, y1, x2, y2).');
 var v=m.slice(1).map(Number);if(!v.every(function(x){return isFinite(x);}))fail(line,'Bezier control points must be finite numbers.');
 if(v[0]<0||v[0]>1||v[2]<0||v[2]>1)fail(line,'Bezier X control points must be between 0 and 1.');
 if(v[1]<-0.25||v[1]>1.25||v[3]<-0.25||v[3]>1.25)fail(line,'Bezier Y control points must be between -0.25 and 1.25.');
 return {type:'bezier',x1:v[0],y1:v[1],x2:v[2],y2:v[3]};
}
function tokens(s,line){var out=[],i=0,m,r,ch;while(i<s.length){ch=s.charAt(i);if(/\s/.test(ch)){i++;continue;}r=s.slice(i);
 if((m=r.match(/^#[0-9a-f]{6}/i))){out.push({type:'color',value:m[0].toLowerCase()});i+=m[0].length;}
 else if((m=r.match(/^(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:e[+-]?\d+)?/i))){out.push({type:'number',value:Number(m[0])});i+=m[0].length;}
 else if((m=r.match(/^[a-z_][a-z0-9_]*/i))){out.push({type:'name',value:m[0].toLowerCase()});i+=m[0].length;}
 else if('+-*/%^(),'.indexOf(ch)>=0){out.push({type:'op',value:ch});i++;}
 else fail(line,'Unexpected character "'+ch+'".');if(out.length>128)fail(line,'Expression is too long.');}return out;}
function parseExpr(s,line){var ts=tokens(s,line),at=0;
 function primary(depth){if(depth>32)fail(line,'Expression is nested too deeply.');var t=ts[at++],args=[],name;if(!t)fail(line,'Expected a value.');
  if(t.type==='number'||t.type==='color')return {type:t.type,value:t.value};
  if(t.type==='op'&&(t.value==='+'||t.value==='-'))return {type:'unary',op:t.value,right:primary(depth+1)};
  if(t.type==='op'&&t.value==='('){var inner=expr(0,depth+1);if(!ts[at]||ts[at++].value!==')')fail(line,'Missing closing parenthesis.');return inner;}
  if(t.type==='name'){name=t.value;if(name==='true'||name==='false')return {type:'boolean',value:name==='true'};if(ts[at]&&ts[at].value==='('){at++;if(!ts[at]||ts[at].value!==')')while(true){args.push(expr(0,depth+1));if(ts[at]&&ts[at].value===','){at++;continue;}break;}
   if(!ts[at]||ts[at++].value!==')')fail(line,'Missing closing parenthesis in function call.');if(!Object.prototype.hasOwnProperty.call(FUNCS,name))fail(line,'Function "'+name+'" is not allowed.');
   if(args.length<1||args.length>8)fail(line,'Functions need between 1 and 8 arguments.');
   if(Object.prototype.hasOwnProperty.call(ARITY,name)&&args.length!==ARITY[name])fail(line,name+'() needs '+ARITY[name]+' arguments.');
   if(['abs','sin','cos','tan','round','floor','ceil','sqrt','sign','fract'].indexOf(name)>=0&&args.length!==1)fail(line,name+'() needs 1 argument.');
   if(['min','max'].indexOf(name)>=0&&args.length<2)fail(line,name+'() needs at least 2 arguments.');
   return {type:'call',name:name,args:args};}
   if(['time','duration','progress','pi'].indexOf(name)<0)fail(line,'Variable "'+name+'" is not available.');return {type:'variable',name:name};}
  fail(line,'Expected a number, colour, variable or parenthesized expression.');}
 function expr(min,depth){var left=primary(depth),t,op,p,right;while((t=ts[at])&&t.type==='op'&&Object.prototype.hasOwnProperty.call(PREC,t.value)){op=t.value;p=PREC[op];if(p<min)break;at++;right=expr(p+(op==='^'?0:1),depth+1);left={type:'binary',op:op,left:left,right:right};}return left;}
 if(!ts.length)fail(line,'Expression is empty.');var ast=expr(0,0);if(at!==ts.length)fail(line,'Unexpected token "'+ts[at].value+'".');return ast;}
function evaluate(n,vars,depth){if(depth>40)throw new Error('Expression is nested too deeply.');var a,b,args,i;
 if(n.type==='number'||n.type==='color'||n.type==='boolean')return n.value;if(n.type==='variable')return n.name==='pi'?Math.PI:vars[n.name];
 if(n.type==='unary'){a=evaluate(n.right,vars,depth+1);if(typeof a!=='number')throw new TypeError('A colour cannot be used in arithmetic.');return n.op==='-'?-a:a;}
 if(n.type==='binary'){a=evaluate(n.left,vars,depth+1);b=evaluate(n.right,vars,depth+1);if(typeof a!=='number'||typeof b!=='number')throw new TypeError('Arithmetic needs numbers.');
  if(n.op==='+')return a+b;if(n.op==='-')return a-b;if(n.op==='*')return a*b;if(n.op==='/'){if(b===0)throw new Error('Division by zero.');return a/b;}if(n.op==='%'){if(b===0)throw new Error('Division by zero.');return a%b;}return Math.pow(a,b);}
 if(n.type==='call'){args=[];for(i=0;i<n.args.length;i++)args.push(evaluate(n.args[i],vars,depth+1));if(n.name!=='rgb')finiteArgs(args,n.name);return FUNCS[n.name].apply(null,args);}throw new Error('Unknown expression node.');}
function validValue(id,v,line){var d=E.getPropertyDef(id);if(!d)fail(line,'Unknown property "'+id+'".');if(d.type==='number'&&(typeof v!=='number'||!isFinite(v)))fail(line,'Property '+id+' needs a finite number.');if(d.type==='color'&&(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v)))fail(line,'Property '+id+' needs a hex colour or rgb() value.');if(d.type==='boolean'&&typeof v!=='boolean')fail(line,'Property '+id+' needs true or false.');return E.normalizeProperty(id,v);}
function parseProgram(clip,source,options){if(typeof source!=='string')throw new TypeError('Script must be text.');if(source.length>4096)throw new SyntaxError('Script is limited to 4,096 characters.');
 var maxTime=options&&options.maxTime!=null?Math.max(0,Number(options.maxTime)||0):Math.max(0,clip.dur||0),available=E.listProperties(clip).map(function(p){return p.id;}),lines=source.split(/\r?\n/),continuous=[],events=[],cids=Object.create(null),eids=Object.create(null),order=0;
 for(var i=0;i<lines.length;i++){var line=lines[i].trim();if(!line||line.charAt(0)==='#')continue;line=line.replace(/\/\/.*$/,'').trim();if(!line)continue;
  var cue=line.match(/^at\s+(\d+(?:\.\d*)?|\.\d+)\s*s?\s+(set|tween)\s+([a-z][a-z0-9.]*)\s*=\s*(.+)$/i),id,ast,mode,rhs,atTime,dur=0,ease='smooth',over;
  if(cue){atTime=Number(cue[1]);mode=cue[2].toLowerCase();id=cue[3].toLowerCase();rhs=cue[4];if(!isFinite(atTime)||atTime<0||atTime>maxTime+1e-6)fail(i+1,'Cue time must be between 0 and this clip’s duration.');
   if(mode==='tween'){over=rhs.match(/^(.+?)\s+over\s+(\d+(?:\.\d*)?|\.\d+)\s*s(?:\s+ease\s+(.+))?$/i);if(!over)fail(i+1,'Use: at 0.5s tween transform.scale = 1 over 0.4s ease out.');
    rhs=over[1];dur=Number(over[2]);ease=parseTweenEase(over[3]||'smooth',i+1);if(!isFinite(dur)||dur<=0||atTime+dur>maxTime+1e-6)fail(i+1,'Tween duration must be positive and end within the clip.');}
   ast=parseExpr(rhs,i+1);
  }else{var set=line.match(/^set\s+([a-z][a-z0-9.]*)\s*=\s*(.+)$/i);if(!set)fail(i+1,'Use: set transform.x = expression, or at 0.5s tween transform.scale = 1 over 0.4s ease out.');
   id=set[1].toLowerCase();ast=parseExpr(set[2],i+1);mode='continuous';}
  var requested=id,canonical=null;
  for(var ai=0;ai<available.length;ai++)if(String(available[ai]).toLowerCase()===requested.toLowerCase()){canonical=available[ai];break;}
  if(!canonical||!ALLOWED[canonical])fail(i+1,'Property "'+requested+'" is not scriptable on this clip.');
  id=canonical;
  if(mode==='tween'){var propertyDef=E.getPropertyDef(id);if(propertyDef&&propertyDef.type==='boolean')fail(i+1,'Boolean properties can only use set, not tween.');}
  if(mode==='continuous'){if(eids[id])fail(i+1,'Do not mix continuous and timed cues for '+id+'.');cids[id]=1;continuous.push({id:id,expression:ast,line:i+1});}
  else{if(cids[id])fail(i+1,'Do not mix continuous and timed cues for '+id+'.');eids[id]=1;events.push({id:id,expression:ast,line:i+1,at:atTime,mode:mode,duration:dur,ease:ease,order:order++});}
  if(continuous.length+events.length>32)fail(i+1,'A script can contain at most 32 statements.');}
 events.sort(function(a,b){return a.at-b.at||a.order-b.order;});return {continuous:continuous,events:events,statements:continuous.length+events.length,properties:Object.keys(cids).concat(Object.keys(eids))};}
function programFor(clip){var source=clip.scriptCode||'',old=CACHE.get(clip);if(old&&old.source===source&&old.program)return old.program;
 try{var p=parseProgram(clip,source);CACHE.set(clip,{source:source,program:p,error:''});return p;}catch(err){CACHE.set(clip,{source:source,program:null,error:err&&err.message?err.message:String(err)});throw err;}}
function varsAt(t,d){return {time:t,duration:d,progress:d>0?t/d:0};}
function evalTarget(st,t,d){return validValue(st.id,evaluate(st.expression,varsAt(t,d),0),st.line);}
function colorMix(a,b,k){var x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);function hx(v){return Math.round(v).toString(16).padStart(2,'0');}
 return '#'+hx((x>>16&255)+((y>>16&255)-(x>>16&255))*k)+hx((x>>8&255)+((y>>8&255)-(x>>8&255))*k)+hx((x&255)+((y&255)-(x&255))*k);}
function bounceOut(k){
 if(k<1/2.75)return 7.5625*k*k;
 if(k<2/2.75){k-=1.5/2.75;return 7.5625*k*k+0.75;}
 if(k<2.5/2.75){k-=2.25/2.75;return 7.5625*k*k+0.9375;}
 k-=2.625/2.75;return 7.5625*k*k+0.984375;
}
function familyOut(f,k){
 if(f==='sine')return Math.sin(k*Math.PI/2);
 if(f==='cubic')return 1-Math.pow(1-k,3);
 if(f==='quart')return 1-Math.pow(1-k,4);
 if(f==='quint')return 1-Math.pow(1-k,5);
 if(f==='expo')return k===1?1:1-Math.pow(2,-10*k);
 if(f==='circ')return Math.sqrt(Math.max(0,1-(k-1)*(k-1)));
 if(f==='back'){var c=1.70158;return 1+(c+1)*Math.pow(k-1,3)+c*Math.pow(k-1,2);}
 if(f==='bounce')return bounceOut(k);
 if(f==='elastic')return k===0||k===1?k:Math.pow(2,-10*k)*Math.sin((k*10-0.75)*(2*Math.PI/3))+1;
 return k;
}
function namedEase(f,mode,k){
 if(mode==='out')return familyOut(f,k);
 if(mode==='in')return 1-familyOut(f,1-k);
 return k<0.5?(1-namedEase(f,'out',1-2*k))/2:(1+namedEase(f,'out',2*k-1))/2;
}
E.easeProgress=function(ease,progress){
 var k=Number(progress);if(!isFinite(k))k=0;k=Math.max(0,Math.min(1,k));if(k===0||k===1)return k;
 if(ease==='linear')return k;
 if(ease==='in')return k*k;
 if(ease==='out')return 1-(1-k)*(1-k);
 if(ease==='inout')return k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
 if(ease==='smooth')return k*k*(3-2*k);
 var m=typeof ease==='string'&&ease.match(/^(sine|cubic|quart|quint|expo|circ|back|bounce|elastic)-(in|out|inout)$/);
 return m?namedEase(m[1],m[2],k):k*k*(3-2*k);
};
function bezierCoord(t,a,b){var u=1-t;return 3*u*u*t*a+3*u*t*t*b+t*t*t;}
E.cubicBezierProgress=function(curve,progress){
 if(!curve||typeof curve!=='object')throw new TypeError('A Bezier curve is required.');
 var x1=Number(curve.x1),y1=Number(curve.y1),x2=Number(curve.x2),y2=Number(curve.y2);
 if(![x1,y1,x2,y2].every(function(v){return isFinite(v);})||x1<0||x1>1||x2<0||x2>1||y1<-.25||y1>1.25||y2<-.25||y2>1.25)throw new RangeError('Bezier control points are outside the supported range.');
 var k=Number(progress);if(!isFinite(k))k=0;k=Math.max(0,Math.min(1,k));if(k===0||k===1)return k;
 var low=0,high=1,t=.5;for(var i=0;i<20;i++){t=(low+high)/2;if(bezierCoord(t,x1,x2)<k)low=t;else high=t;}
 return bezierCoord((low+high)/2,y1,y2);
};
function sampleTween(tw,t){var k=Math.max(0,Math.min(1,(t-tw.at)/tw.duration)),e=tw.ease&&typeof tw.ease==='object'?E.cubicBezierProgress(tw.ease,k):E.easeProgress(tw.ease,k);
 return typeof tw.from==='string'?colorMix(tw.from,tw.to,e):tw.from+(tw.to-tw.from)*e;}
function cueValue(clip,events,id,t,d){var started=false,current,active=null;for(var i=0;i<events.length;i++){var q=events[i];if(q.id!==id||q.at>t)continue;
 if(!started){current=E.getProperty(clip,id,q.at);started=true;}if(active)current=sampleTween(active,q.at);active=null;var target=evalTarget(q,q.at,d);
 if(q.mode==='set')current=target;else active={from:current,to:target,at:q.at,duration:q.duration,ease:q.ease};}
 if(!started)return undefined;return active?sampleTween(active,t):current;}
E.compileScript=function(clip,source){var p=parseProgram(clip,source);return {statements:p.statements,events:p.events.length,properties:p.properties.slice()};};
E.getClipScriptTargets=function(clip){if(!clip||!clip.scriptEnabled||!String(clip.scriptCode||'').trim())return [];try{return programFor(clip).properties.slice();}catch(e){return [];}};
E.hasClipScriptTarget=function(clip,id){return E.getClipScriptTargets(clip).indexOf(id)>=0;};
E.runClipScriptFrame=function(clip,time){if(!clip||clip.scriptEnabled!==true||!String(clip.scriptCode||'').trim())return null;try{
 var p=programFor(clip),d=Math.max(0,Number(clip.dur)||0),t=Math.max(0,Math.min(d,Number(time)||0)),vars=varsAt(t,d),overrides=Object.create(null);
 for(var i=0;i<p.continuous.length;i++){var st=p.continuous[i];overrides[st.id]=validValue(st.id,evaluate(st.expression,vars,0),st.line);}
 var processed=Object.create(null);
 for(var j=0;j<p.events.length;j++){var id=p.events[j].id;if(processed[id]||Object.prototype.hasOwnProperty.call(overrides,id))continue;processed[id]=1;var v=cueValue(clip,p.events,id,t,d);if(v!==undefined)overrides[id]=v;}
 if(!Object.keys(overrides).length)return null;var frame=E.evaluateProperties(clip,t,overrides);frame.scriptedValues=overrides;return frame;
 }catch(err){var cached=CACHE.get(clip);if(!cached||cached.source!==clip.scriptCode)cached={source:clip.scriptCode||'',program:null,error:''};cached.error=err&&err.message?err.message:String(err);CACHE.set(clip,cached);return null;}};
E.runClipScript=function(clip,time){var f=E.runClipScriptFrame(clip,time);return f?f.transform:null;};
E.getClipScriptError=function(clip){var c=clip&&CACHE.get(clip);return c&&c.source===(clip.scriptCode||'')?c.error:'';};

/* Project-level SnipScript: absolute project time, explicit clip targets, shared safe expressions. */
function parseProjectProgram(source,projectOverride){
 if(typeof source!=='string')throw new TypeError('Project script must be text.');
 if(source.length>8192)throw new SyntaxError('Project scripts are limited to 8,192 characters.');
 var project=projectOverride||E.proj,duration=0,lines=source.split(/\r?\n/),groups=Object.create(null),total=0,order=0;
 (project.clips||[]).forEach(function(clip){duration=Math.max(duration,(Number(clip.start)||0)+(Number(clip.dur)||0));});
 for(var i=0;i<lines.length;i++){
  var line=lines[i].trim();if(!line||line.charAt(0)==='#')continue;line=line.replace(/\/\/.*$/,'').trim();if(!line)continue;
  var timed=line.match(/^at\s+(\d+(?:\.\d*)?|\.\d+)\s*s?\s+clip\s+([a-z0-9_-]+)\s+(.+)$/i),plain=line.match(/^clip\s+([a-z0-9_-]+)\s+(.+)$/i),id=timed?timed[2]:plain?plain[1]:null,directive=timed?('at '+timed[1]+'s '+timed[3]):plain?plain[2]:null;
  if(!id)fail(i+1,'Use: clip <clip-id> set property = expression, or at 0s clip <clip-id> tween property = value over 1s ease out.');
  var clip=null;for(var ci=0;ci<(project.clips||[]).length;ci++)if(project.clips[ci].id===id){clip=project.clips[ci];break;}if(!clip&&project&&Array.isArray(project.clips)){var aliasKey=String(id).toLowerCase();for(var ai=0;ai<project.clips.length;ai++){var candidate=project.clips[ai];if(candidate.scriptAlias&&String(candidate.scriptAlias).toLowerCase()===aliasKey){clip=candidate;id=clip.id;break;}}}if(!clip)fail(i+1,'Unknown clip target "'+id+'".');
  var parsed;
  try{parsed=parseProgram(clip,directive,{maxTime:duration});}
  catch(err){var msg=err&&err.message?err.message:String(err);var lm=msg.match(/^Line \d+:\s*(.*)$/);fail(i+1,lm?lm[1]:msg);}
  var group=groups[id]||(groups[id]={clip:clip,continuous:[],events:[],continuousIds:Object.create(null),eventIds:Object.create(null),properties:[]});
  parsed.continuous.forEach(function(st){
   if(group.continuousIds[st.id]||group.eventIds[st.id])fail(i+1,'Do not repeat or mix continuous and timed cues for '+st.id+' on this clip.');
   st.line=i+1;group.continuousIds[st.id]=1;group.continuous.push(st);group.properties.push(st.id);
  });
  parsed.events.forEach(function(q){
   if(group.continuousIds[q.id])fail(i+1,'Do not mix continuous and timed cues for '+q.id+' on this clip.');
   q.line=i+1;q.order=order++;group.eventIds[q.id]=1;group.events.push(q);
   if(group.properties.indexOf(q.id)<0)group.properties.push(q.id);
  });
  total+=parsed.statements;if(total>128)fail(i+1,'A project script can contain at most 128 statements.');
 }
 Object.keys(groups).forEach(function(id){groups[id].events.sort(function(a,b){return a.at-b.at||a.order-b.order;});});
 return {groups:groups,statements:total,targets:Object.keys(groups),duration:duration};
}
function projectKey(project,source){
 return source+'\u001f'+E.end()+'\u001f'+project.clips.map(function(c){return [c.id,c.scriptAlias||'',c.kind,c.start,c.dur].join(':');}).join('|');
}
function projectProgramFor(){
 var project=E.proj,source=String(project.projectScriptCode||''),key=projectKey(project,source),old=PROJECT_CACHE.get(project);
 if(old&&old.key===key&&old.program)return old.program;
 try{var program=parseProjectProgram(source);PROJECT_CACHE.set(project,{key:key,source:source,program:program,error:''});return program;}
 catch(err){PROJECT_CACHE.set(project,{key:key,source:source,program:null,error:err&&err.message?err.message:String(err)});throw err;}
}
function projectCueValue(clip,events,id,time,duration){
 var started=false,current,active=null;
 for(var i=0;i<events.length;i++){
  var q=events[i];if(q.id!==id||q.at>time)continue;
  if(!started){var cueBase=arguments.length>5?arguments[5]:Number(clip.start)||0,localAt=Math.max(0,Math.min(Math.max(0,Number(clip.dur)||0),q.at-cueBase));current=E.getProperty(clip,id,localAt);started=true;}
  if(active)current=sampleTween(active,q.at);active=null;
  var target=evalTarget(q,q.at,duration);
  if(q.mode==='set')current=target;else active={from:current,to:target,at:q.at,duration:q.duration,ease:q.ease};
 }
 if(!started)return undefined;return active?sampleTween(active,time):current;
}
E.compileProjectScript=function(source){
 var p=parseProjectProgram(String(source==null?'':source));
 return {statements:p.statements,targets:p.targets.slice(),properties:p.targets.map(function(id){return {clipId:id,properties:p.groups[id].properties.slice()};})};
};
E.compileProjectScriptFor=function(source,project){
 var p=parseProjectProgram(String(source==null?'':source),project||E.proj);
 return {statements:p.statements,targets:p.targets.slice(),properties:p.targets.map(function(id){return {clipId:id,properties:p.groups[id].properties.slice()};})};
};
E.getProjectScriptTargets=function(clip){
 if(!E.proj||E.proj.projectScriptEnabled!==true||!clip)return [];
 try{var p=projectProgramFor(),g=p.groups[clip.id];return g?g.properties.slice():[];}catch(e){return [];}
};
E.hasProjectScriptTarget=function(clip,id){return E.getProjectScriptTargets(clip).indexOf(id)>=0;};
E.runProjectScriptFrame=function(clip,projectTime){
 if(!E.proj||E.proj.projectScriptEnabled!==true||!String(E.proj.projectScriptCode||'').trim()||!clip)return null;
 try{
  var p=projectProgramFor(),g=p.groups[clip.id];if(!g)return null;
  var duration=Math.max(0,E.end()),t=Math.max(0,Math.min(duration,Number(projectTime)||0)),local=Math.max(0,Math.min(Math.max(0,Number(clip.dur)||0),t-(Number(clip.start)||0))),vars=varsAt(t,duration),overrides=Object.create(null);
  for(var i=0;i<g.continuous.length;i++){var st=g.continuous[i];overrides[st.id]=validValue(st.id,evaluate(st.expression,vars,0),st.line);}
  var processed=Object.create(null);
  for(var j=0;j<g.events.length;j++){var id=g.events[j].id;if(processed[id]||Object.prototype.hasOwnProperty.call(overrides,id))continue;processed[id]=1;var v=projectCueValue(clip,g.events,id,t,duration);if(v!==undefined)overrides[id]=v;}
  if(!Object.keys(overrides).length)return null;
  var frame=E.evaluateProperties(clip,local,overrides);frame.scriptedValues=overrides;return frame;
 }catch(err){
  var project=E.proj,source=String(project.projectScriptCode||''),key=projectKey(project,source),old=PROJECT_CACHE.get(project);
  PROJECT_CACHE.set(project,{key:key,source:source,program:old&&old.key===key?old.program:null,error:err&&err.message?err.message:String(err)});
  return null;
 }
};
E.getProjectScriptError=function(){
 if(!E.proj)return '';var source=String(E.proj.projectScriptCode||''),old=PROJECT_CACHE.get(E.proj),key=projectKey(E.proj,source);
 return old&&old.key===key?old.error:'';
};


/* Scene-local SnipScript: each scene has its own clock and can target only its member clips. */
function sceneByRef(ref){
 if(!E.proj||!Array.isArray(E.proj.scenes))return null;
 for(var i=0;i<E.proj.scenes.length;i++){
  var scene=E.proj.scenes[i];
  if(scene===ref||(ref&&typeof ref==='object'&&scene.id===ref.id)||(typeof ref==='string'&&(scene.id===ref||String(scene.alias||'').toLowerCase()===ref.toLowerCase())))return scene;
 }
 return null;
}
function sceneClips(scene,projectOverride){
 var project=projectOverride||E.proj;
 return (project.clips||[]).filter(function(clip){
  return clip.sceneId===scene.id||(!clip.sceneId&&clip.sceneAlias&&String(clip.sceneAlias).toLowerCase()===String(scene.alias||'').toLowerCase());
 });
}
function parseSceneProgram(scene,source,projectOverride){
 if(typeof source!=='string')throw new TypeError('Scene script must be text.');
 if(source.length>8192)throw new SyntaxError('Scene scripts are limited to 8,192 characters.');
 var duration=Math.max(0,Number(scene.duration)||0),members=sceneClips(scene,projectOverride||E.proj),lines=source.split(/\r?\n/),groups=Object.create(null),total=0,order=0;
 for(var i=0;i<lines.length;i++){
  var line=lines[i].trim();if(!line||line.charAt(0)==='#')continue;line=line.replace(/\/\/.*$/,'').trim();if(!line)continue;
  var timed=line.match(/^at\s+(\d+(?:\.\d*)?|\.\d+)\s*s?\s+clip\s+([a-z0-9_-]+)\s+(.+)$/i),plain=line.match(/^clip\s+([a-z0-9_-]+)\s+(.+)$/i);
  var target=timed?timed[2]:plain?plain[1]:null,directive=timed?('at '+timed[1]+'s '+timed[3]):plain?plain[2]:null;
  if(!target)fail(i+1,'Use: clip <scene-clip-alias> set property = expression, or at 1s clip <scene-clip-alias> tween property = value over 0.5s ease out.');
  var clip=null,targetKey=target.toLowerCase();
  for(var j=0;j<members.length;j++){
   var candidate=members[j];
   if(candidate.id===target||(candidate.scriptAlias&&String(candidate.scriptAlias).toLowerCase()===targetKey)){clip=candidate;break;}
  }
  if(!clip)fail(i+1,'Unknown clip target "'+target+'" in scene "'+(scene.name||scene.alias)+'". Scene scripts can only target clips belonging to this scene.');
  var parsed;
  try{parsed=parseProgram(clip,directive,{maxTime:duration});}
  catch(err){var msg=err&&err.message?err.message:String(err),lm=msg.match(/^Line \d+:\s*(.*)$/);fail(i+1,lm?lm[1]:msg);}
  var group=groups[clip.id]||(groups[clip.id]={clip:clip,continuous:[],events:[],continuousIds:Object.create(null),eventIds:Object.create(null),properties:[]});
  parsed.continuous.forEach(function(st){
   if(group.continuousIds[st.id]||group.eventIds[st.id])fail(i+1,'Do not repeat or mix continuous and timed cues for '+st.id+' on this clip.');
   st.line=i+1;group.continuousIds[st.id]=1;group.continuous.push(st);group.properties.push(st.id);
  });
  parsed.events.forEach(function(q){
   if(group.continuousIds[q.id])fail(i+1,'Do not mix continuous and timed cues for '+q.id+' on this clip.');
   q.line=i+1;q.order=order++;group.eventIds[q.id]=1;group.events.push(q);
   if(group.properties.indexOf(q.id)<0)group.properties.push(q.id);
  });
  total+=parsed.statements;if(total>128)fail(i+1,'A scene script can contain at most 128 statements.');
 }
 Object.keys(groups).forEach(function(id){groups[id].events.sort(function(a,b){return a.at-b.at||a.order-b.order;});});
 return {groups:groups,statements:total,targets:Object.keys(groups),duration:duration};
}
function sceneKey(scene,source){
 return source+'\u001f'+(Number(scene.duration)||0)+'\u001f'+sceneClips(scene).map(function(c){
  return [c.id,c.scriptAlias||'',c.kind,c.start-(Number(scene.start)||0),c.dur].join(':');
 }).join('|');
}
function sceneProgramFor(scene){
 var source=String(scene.scriptCode||''),key=sceneKey(scene,source),old=SCENE_CACHE.get(scene);
 if(old&&old.key===key&&old.program)return old.program;
 try{var program=parseSceneProgram(scene,source);SCENE_CACHE.set(scene,{key:key,source:source,program:program,error:''});return program;}
 catch(err){SCENE_CACHE.set(scene,{key:key,source:source,program:null,error:err&&err.message?err.message:String(err)});throw err;}
}
E.compileSceneScript=function(sceneRef,source){
 var scene=sceneByRef(sceneRef);if(!scene)throw new Error('Choose a scene in the current project first.');
 var p=parseSceneProgram(scene,String(source==null?'':source));
 return {statements:p.statements,targets:p.targets.slice(),properties:p.targets.map(function(id){return {clipId:id,properties:p.groups[id].properties.slice()};})};
};
E.compileSceneScriptFor=function(scene,source,project){
 if(!scene)throw new Error('Choose a scene in the project first.');
 var p=parseSceneProgram(scene,String(source==null?'':source),project||E.proj);
 return {statements:p.statements,targets:p.targets.slice(),properties:p.targets.map(function(id){return {clipId:id,properties:p.groups[id].properties.slice()};})};
};
E.getSceneScriptTargets=function(clip){
 if(!clip||!E.proj)return [];
 var scene=sceneByRef(clip.sceneId||clip.sceneAlias);if(!scene||scene.scriptEnabled!==true||!String(scene.scriptCode||'').trim())return [];
 try{var p=sceneProgramFor(scene),g=p.groups[clip.id];return g?g.properties.slice():[];}catch(e){return [];}
};
E.hasSceneScriptTarget=function(clip,id){return E.getSceneScriptTargets(clip).indexOf(id)>=0;};
E.runSceneScriptFrame=function(sceneRef,clip,projectTime){
 var scene=sceneByRef(sceneRef);
 if(!scene||scene.scriptEnabled!==true||!String(scene.scriptCode||'').trim()||!clip)return null;
 try{
  if(sceneClips(scene).every(function(item){return item.id!==clip.id;}))return null;
  var p=sceneProgramFor(scene),g=p.groups[clip.id];if(!g)return null;
  var duration=Math.max(0,Number(scene.duration)||0),t=Math.max(0,Math.min(duration,(Number(projectTime)||0)-(Number(scene.start)||0)));
  var clipSceneStart=(Number(clip.start)||0)-(Number(scene.start)||0),local=Math.max(0,Math.min(Math.max(0,Number(clip.dur)||0),t-clipSceneStart)),vars=varsAt(t,duration),overrides=Object.create(null);
  for(var i=0;i<g.continuous.length;i++){var st=g.continuous[i];overrides[st.id]=validValue(st.id,evaluate(st.expression,vars,0),st.line);}
  var processed=Object.create(null);
  for(var j=0;j<g.events.length;j++){
   var id=g.events[j].id;if(processed[id]||Object.prototype.hasOwnProperty.call(overrides,id))continue;
   processed[id]=1;var v=projectCueValue(clip,g.events,id,t,duration,clipSceneStart);if(v!==undefined)overrides[id]=v;
  }
  if(!Object.keys(overrides).length)return null;
  var frame=E.evaluateProperties(clip,local,overrides);frame.scriptedValues=overrides;return frame;
 }catch(err){
  var source=String(scene.scriptCode||''),key=sceneKey(scene,source),old=SCENE_CACHE.get(scene);
  SCENE_CACHE.set(scene,{key:key,source:source,program:old&&old.key===key?old.program:null,error:err&&err.message?err.message:String(err)});
  return null;
 }
};
E.getSceneScriptError=function(sceneRef){
 var scene=sceneByRef(sceneRef);if(!scene)return '';
 var source=String(scene.scriptCode||''),old=SCENE_CACHE.get(scene),key=sceneKey(scene,source);
 return old&&old.key===key?old.error:'';
};


/* Unified project document: one versioned source owns scene layout and every SnipScript layer. */
function unifiedMediaId(ref){
 if(E.media&&E.media[ref])return ref;
 var ids=E.mediaList&&E.mediaList.length?E.mediaList:Object.keys(E.media||{}),matches=ids.filter(function(id){return E.media[id]&&String(E.media[id].name||'').toLowerCase()===String(ref||'').toLowerCase();});
 return matches.length===1?matches[0]:null;
}
function unifiedCandidate(raw,summary){
 var project=E.clone(E.proj),sceneByAlias=Object.create(null),rawClipByAlias=Object.create(null);
 if(!Array.isArray(project.scenes))project.scenes=[];
 (raw.scenes||[]).forEach(function(scene){(scene.clips||[]).forEach(function(clip){rawClipByAlias[String(clip.alias||'').toLowerCase()]=clip;});});
 (summary.scenes||[]).forEach(function(def){
  var key=String(def.alias).toLowerCase(),scene=project.scenes.find(function(item){return String(item.alias||'').toLowerCase()===key;});
  if(!scene)scene={id:'__unified_scene_'+key,alias:def.alias};
  scene.alias=def.alias;scene.name=def.name;scene.start=def.start;scene.duration=def.duration;
  var source=(raw.scenes||[]).find(function(item){return String(item.alias||'').toLowerCase()===key;});
  if(source&&Object.prototype.hasOwnProperty.call(source,'script')){scene.scriptCode=source.script;scene.scriptEnabled=!!String(source.script).trim();}
  var ix=project.scenes.findIndex(function(item){return item.id===scene.id;});
  if(ix<0)project.scenes.push(scene);else project.scenes[ix]=scene;
  sceneByAlias[key]=scene;
 });
 (summary.items||[]).forEach(function(def){
  var key=String(def.alias).toLowerCase(),source=rawClipByAlias[key],clip=project.clips.find(function(item){return String(item.scriptAlias||'').toLowerCase()===key;});
  if(!source)throw new Error('Missing source definition for clip "'+def.alias+'".');
  if(!clip){clip=E.newClip(def.kind,{dur:def.duration});clip.id='__unified_clip_'+key;}
  clip.kind=def.kind;clip.scriptAlias=def.alias;clip.start=def.start;clip.dur=def.duration;
  clip.name=source.name||source.content||def.alias;
  if(source.media!=null){var mediaId=unifiedMediaId(source.media);if(!mediaId)throw new Error('Media "'+source.media+'" could not be resolved for script validation.');clip.media=mediaId;}
  if(def.kind==='text'&&source.content!=null){if(!clip.text)clip.text=E.defText();clip.text.str=source.content;}
  if(def.scene){var scene=sceneByAlias[String(def.scene).toLowerCase()];clip.sceneAlias=def.scene;clip.sceneId=scene&&scene.id;}
  if(Object.prototype.hasOwnProperty.call(source,'script')){clip.scriptCode=source.script;clip.scriptEnabled=!!String(source.script).trim();}
  var ix=project.clips.findIndex(function(item){return item.id===clip.id;});
  if(ix<0)project.clips.push(clip);else project.clips[ix]=clip;
 });
 return project;
}
E.compileUnifiedProject=function(input){
 var source;
 try{source=typeof input==='string'?input:JSON.stringify(input);}catch(e){throw new SyntaxError('The unified project must be valid JSON data.');}
 if(!source||source.length>100000)throw new SyntaxError('Keep the unified project under 100 KB.');
 var raw;try{raw=JSON.parse(source);}catch(e2){throw new SyntaxError('Invalid unified project JSON: '+(e2.message||String(e2)));}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==3)throw new SyntaxError('A unified project must use version: 3.');
 var summary=E.previewProjectPlan(raw),candidate=unifiedCandidate(raw,summary),clipStatements=0,sceneStatements=0,projectStatements=0;
 (raw.scenes||[]).forEach(function(sceneDef){
  (sceneDef.clips||[]).forEach(function(clipDef){
   if(Object.prototype.hasOwnProperty.call(clipDef,'script')){
    var clip=candidate.clips.find(function(item){return String(item.scriptAlias||'').toLowerCase()===String(clipDef.alias).toLowerCase();});
    clipStatements+=E.compileScript(clip,clipDef.script).statements;
   }
  });
  if(Object.prototype.hasOwnProperty.call(sceneDef,'script')){
   var scene=candidate.scenes.find(function(item){return String(item.alias||'').toLowerCase()===String(sceneDef.alias).toLowerCase();});
   sceneStatements+=E.compileSceneScriptFor(scene,sceneDef.script,candidate).statements;
  }
 });
 if(Object.prototype.hasOwnProperty.call(raw,'script'))projectStatements=E.compileProjectScriptFor(raw.script,candidate).statements;
 summary.clipScriptStatements=clipStatements;summary.sceneScriptStatements=sceneStatements;summary.projectScriptStatements=projectStatements;
 summary.scriptStatements=clipStatements+sceneStatements+projectStatements;
 return summary;
};
E.applyUnifiedProject=function(input){
 var source=typeof input==='string'?input:JSON.stringify(input),check=E.compileUnifiedProject(source),raw=JSON.parse(source);
 var applied=E.applyProjectPlan(raw,source);
 applied.clipScriptStatements=check.clipScriptStatements;applied.sceneScriptStatements=check.sceneScriptStatements;
 applied.projectScriptStatements=check.projectScriptStatements;applied.scriptStatements=check.scriptStatements;
 return applied;
};


/* Timeline cue API. Cues are keyed by source line so marker drags edit the script itself. */
E.listClipScriptCues=function(clip){
 if(!clip||!String(clip.scriptCode||'').trim())return [];
 try{return parseProgram(clip,clip.scriptCode).events.map(function(q){
  return {line:q.line,at:q.at,mode:q.mode,property:q.id,duration:q.duration,end:q.at+q.duration};
 });}catch(e){return [];}
};
E.moveClipScriptCue=function(clip,lineNumber,nextTime){
 if(!clip)throw new TypeError('A clip is required.');
 if(typeof nextTime!=='number'||!isFinite(nextTime))throw new TypeError('Cue time must be finite.');
 var current=parseProgram(clip,clip.scriptCode||''),cue=null;
 for(var i=0;i<current.events.length;i++)if(current.events[i].line===lineNumber){cue=current.events[i];break;}
 if(!cue)throw new Error('The selected script cue no longer exists.');
 var max=Math.max(0,(Number(clip.dur)||0)-cue.duration),at=Math.round(Math.max(0,Math.min(max,nextTime))*100)/100;
 var lines=(clip.scriptCode||'').split(/\r?\n/),old=lines[lineNumber-1];
 var match=old&&old.match(/^(\s*at\s+)(\d+(?:\.\d*)?|\.\d+)(.*)$/i);
 if(!match)throw new Error('The selected line is not a timed cue.');
 lines[lineNumber-1]=match[1]+String(at)+match[3];
 var source=lines.join('\n'),program=parseProgram(clip,source);
 clip.scriptCode=source;CACHE.set(clip,{source:source,program:program,error:''});return at;
};

/* Project library: named, reusable scripts travel with project snapshots. */
function presetList(){
 if(!E.proj)throw new Error('Open a project before using the script library.');
 if(!Array.isArray(E.proj.scriptPresets))E.proj.scriptPresets=[];
 return E.proj.scriptPresets;
}
E.listScriptPresets=function(){return presetList().slice();};
E.getScriptPreset=function(id){
 var list=presetList();for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];return null;
};
E.saveScriptPreset=function(name,clip,source){
 name=String(name==null?'':name).trim();source=String(source==null?'':source);
 if(!clip)throw new TypeError('Select a clip before saving a script preset.');
 if(!name)throw new Error('Enter a name for this script preset.');
 if(name.length>48)throw new Error('Preset names are limited to 48 characters.');
 if(!source.trim())throw new Error('Write a script before saving it as a preset.');
 E.compileScript(clip,source);
 var list=presetList(),key=name.toLowerCase(),item=null;
 for(var i=0;i<list.length;i++)if(String(list[i].name||'').toLowerCase()===key){item=list[i];break;}
 if(item){item.name=name;item.kind=clip.kind;item.code=source;}
 else{
  if(list.length>=50)throw new Error('A project can contain up to 50 saved script presets.');
  item={id:E.uid('sp'),name:name,kind:clip.kind,code:source};list.push(item);
 }
 return item;
};
E.applyScriptPreset=function(id,clip){
 var item=E.getScriptPreset(id);if(!item)throw new Error('Choose a saved script preset first.');
 if(!clip)throw new TypeError('Select a clip before applying a script preset.');
 E.compileScript(clip,item.code);
 clip.scriptCode=item.code;clip.scriptEnabled=true;return true;
};
E.deleteScriptPreset=function(id){
 var list=presetList();for(var i=0;i<list.length;i++)if(list[i].id===id){list.splice(i,1);return true;}return false;
};
})();