(function () {
'use strict';
/* SnipScript v2: bounded expressions plus deterministic clip-local cues. */
var K=window.__snip,E=K.E,CACHE=new WeakMap();
var ALLOWED={'transform.x':1,'transform.y':1,'transform.scale':1,'transform.rotation':1,'transform.opacity':1,'audio.volume':1,'audio.fadeIn':1,'audio.fadeOut':1,'text.fontSize':1,'text.color':1,'paper.edge':1,'paper.roughness':1};
var PREC={'+':1,'-':1,'*':2,'/':2,'%':2,'^':3};
var FUNCS={
 abs:Math.abs,min:Math.min,max:Math.max,sin:Math.sin,cos:Math.cos,tan:Math.tan,round:Math.round,floor:Math.floor,ceil:Math.ceil,sqrt:Math.sqrt,pow:Math.pow,sign:Math.sign,
 clamp:function(v,a,b){return Math.max(a,Math.min(b,v));},lerp:function(a,b,t){return a+(b-a)*Math.max(0,Math.min(1,t));},
 rgb:function(r,g,b){function hx(v){return Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0');}if(![r,g,b].every(function(v){return typeof v==='number'&&isFinite(v);}))throw new TypeError('rgb() needs three finite numbers.');return '#'+hx(r)+hx(g)+hx(b);}
};
function fail(n,s){throw new SyntaxError('Line '+n+': '+s);}
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
  if(t.type==='name'){name=t.value;if(ts[at]&&ts[at].value==='('){at++;if(!ts[at]||ts[at].value!==')')while(true){args.push(expr(0,depth+1));if(ts[at]&&ts[at].value===','){at++;continue;}break;}
   if(!ts[at]||ts[at++].value!==')')fail(line,'Missing closing parenthesis in function call.');if(!Object.prototype.hasOwnProperty.call(FUNCS,name))fail(line,'Function "'+name+'" is not allowed.');
   if(args.length<1||args.length>8)fail(line,'Functions need between 1 and 8 arguments.');if(name==='clamp'&&args.length!==3)fail(line,'clamp() needs 3 arguments.');
   if((name==='pow'||name==='lerp')&&args.length!==(name==='pow'?2:3))fail(line,name+'() needs '+(name==='pow'?2:3)+' arguments.');
   if(name==='rgb'&&args.length!==3)fail(line,'rgb() needs 3 arguments.');if(['abs','sin','cos','tan','round','floor','ceil','sqrt','sign'].indexOf(name)>=0&&args.length!==1)fail(line,name+'() needs 1 argument.');
   return {type:'call',name:name,args:args};}
   if(['time','duration','progress','pi'].indexOf(name)<0)fail(line,'Variable "'+name+'" is not available.');return {type:'variable',name:name};}
  fail(line,'Expected a number, colour, variable or parenthesized expression.');}
 function expr(min,depth){var left=primary(depth),t,op,p,right;while((t=ts[at])&&t.type==='op'&&Object.prototype.hasOwnProperty.call(PREC,t.value)){op=t.value;p=PREC[op];if(p<min)break;at++;right=expr(p+(op==='^'?0:1),depth+1);left={type:'binary',op:op,left:left,right:right};}return left;}
 if(!ts.length)fail(line,'Expression is empty.');var ast=expr(0,0);if(at!==ts.length)fail(line,'Unexpected token "'+ts[at].value+'".');return ast;}
function evaluate(n,vars,depth){if(depth>40)throw new Error('Expression is nested too deeply.');var a,b,args,i;
 if(n.type==='number'||n.type==='color')return n.value;if(n.type==='variable')return n.name==='pi'?Math.PI:vars[n.name];
 if(n.type==='unary'){a=evaluate(n.right,vars,depth+1);if(typeof a!=='number')throw new TypeError('A colour cannot be used in arithmetic.');return n.op==='-'?-a:a;}
 if(n.type==='binary'){a=evaluate(n.left,vars,depth+1);b=evaluate(n.right,vars,depth+1);if(typeof a!=='number'||typeof b!=='number')throw new TypeError('Arithmetic needs numbers.');
  if(n.op==='+')return a+b;if(n.op==='-')return a-b;if(n.op==='*')return a*b;if(n.op==='/'){if(b===0)throw new Error('Division by zero.');return a/b;}if(n.op==='%'){if(b===0)throw new Error('Division by zero.');return a%b;}return Math.pow(a,b);}
 if(n.type==='call'){args=[];for(i=0;i<n.args.length;i++)args.push(evaluate(n.args[i],vars,depth+1));return FUNCS[n.name].apply(null,args);}throw new Error('Unknown expression node.');}
function validValue(id,v,line){var d=E.getPropertyDef(id);if(!d)fail(line,'Unknown property "'+id+'".');if(d.type==='number'&&(typeof v!=='number'||!isFinite(v)))fail(line,'Property '+id+' needs a finite number.');if(d.type==='color'&&(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v)))fail(line,'Property '+id+' needs a hex colour or rgb() value.');return E.normalizeProperty(id,v);}
function parseProgram(clip,source){if(typeof source!=='string')throw new TypeError('Script must be text.');if(source.length>4096)throw new SyntaxError('Script is limited to 4,096 characters.');
 var available=E.listProperties(clip).map(function(p){return p.id;}),lines=source.split(/\r?\n/),continuous=[],events=[],cids=Object.create(null),eids=Object.create(null),order=0;
 for(var i=0;i<lines.length;i++){var line=lines[i].trim();if(!line||line.charAt(0)==='#')continue;line=line.replace(/\/\/.*$/,'').trim();if(!line)continue;
  var cue=line.match(/^at\s+(\d+(?:\.\d*)?|\.\d+)\s*s?\s+(set|tween)\s+([a-z][a-z0-9.]*)\s*=\s*(.+)$/i),id,ast,mode,rhs,atTime,dur=0,ease='smooth',over;
  if(cue){atTime=Number(cue[1]);mode=cue[2].toLowerCase();id=cue[3].toLowerCase();rhs=cue[4];if(!isFinite(atTime)||atTime<0||atTime>Math.max(0,clip.dur||0)+1e-6)fail(i+1,'Cue time must be between 0 and this clip’s duration.');
   if(mode==='tween'){over=rhs.match(/^(.+?)\s+over\s+(\d+(?:\.\d*)?|\.\d+)\s*s(?:\s+ease\s+(linear|in|out|inout|smooth))?$/i);if(!over)fail(i+1,'Use: at 0.5s tween transform.scale = 1 over 0.4s ease out.');
    rhs=over[1];dur=Number(over[2]);ease=(over[3]||'smooth').toLowerCase();if(!isFinite(dur)||dur<=0||atTime+dur>Math.max(0,clip.dur||0)+1e-6)fail(i+1,'Tween duration must be positive and end within the clip.');}
   ast=parseExpr(rhs,i+1);
  }else{var set=line.match(/^set\s+([a-z][a-z0-9.]*)\s*=\s*(.+)$/i);if(!set)fail(i+1,'Use: set transform.x = expression, or at 0.5s tween transform.scale = 1 over 0.4s ease out.');
   id=set[1].toLowerCase();ast=parseExpr(set[2],i+1);mode='continuous';}
  var requested=id,canonical=null;
  for(var ai=0;ai<available.length;ai++)if(String(available[ai]).toLowerCase()===requested.toLowerCase()){canonical=available[ai];break;}
  if(!canonical||!ALLOWED[canonical])fail(i+1,'Property "'+requested+'" is not scriptable on this clip.');
  id=canonical;
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
function sampleTween(tw,t){var k=Math.max(0,Math.min(1,(t-tw.at)/tw.duration)),e=k;if(tw.ease==='in')e=k*k;else if(tw.ease==='out')e=1-(1-k)*(1-k);else if(tw.ease==='inout')e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;else if(tw.ease==='smooth')e=k*k*(3-2*k);
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
})();