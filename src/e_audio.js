(function () {
'use strict';
/* Video editor audio: scheduled playback of clips (trim, volume, fades), library preview and the offline mixdown used for export. */
var K = window.__snip, E = K.E, clamp = K.clamp;
var A = E.aud = {}, ctx = null, master = null, monitor = null, recDest = null, srcs = [], pv = null;

A.ensure = function () {
  if (!ctx) {
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ctx = new C(); master = ctx.createGain(); monitor = ctx.createGain(); master.connect(monitor); monitor.connect(ctx.destination);
    recDest = ctx.createMediaStreamDestination(); master.connect(recDest);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};
A.recStream = function () { A.ensure(); return recDest ? recDest.stream : null; };
A.monitor = function (on) { A.ensure(); if (monitor) monitor.gain.value = on ? 1 : 0; };

/* Gain envelope of a clip: volume with linear fade in and out, as (local time, gain) points. */
function envPoints(c) {
  var d = c.dur, fi = Math.min(c.fadeIn || 0, d), fo = Math.min(c.fadeOut || 0, Math.max(0, d - fi)), v = c.vol;
  var pts = [[0, fi > 0 ? 0 : v]];
  if (fi > 0) pts.push([fi, v]);
  if (fo > 0) pts.push([d - fo, v]);
  pts.push([d, fo > 0 ? 0 : v]);
  return pts;
}
function envAt(pts, x) {
  for (var i = 1; i < pts.length; i++) {
    if (x <= pts[i][0] || i === pts.length - 1) { var a = pts[i - 1], b = pts[i], k = b[0] === a[0] ? 1 : clamp((x - a[0]) / (b[0] - a[0]), 0, 1); return a[1] + (b[1] - a[1]) * k; }
  }
  return pts[pts.length - 1][1];
}
function applyEnv(gp, c, tStart, rel) {
  var pts = envPoints(c); gp.setValueAtTime(envAt(pts, rel), tStart + rel);
  for (var i = 0; i < pts.length; i++) if (pts[i][0] > rel + 1e-6) gp.linearRampToValueAtTime(pts[i][1], tStart + pts[i][0]);
}
function hasScriptAudio(c) {
  var ids = ['audio.volume', 'audio.fadeIn', 'audio.fadeOut'];
  return ids.some(function (id) {
    return (E.hasClipScriptTarget && E.hasClipScriptTarget(c, id)) ||
      (E.hasSceneScriptTarget && E.hasSceneScriptTarget(c, id)) ||
      (E.hasProjectScriptTarget && E.hasProjectScriptTarget(c, id));
  });
}
function applyScriptEnv(gp, c, when, rel, span) {
  var count = Math.max(2, Math.min(18001, Math.ceil(span * 30) + 1)), curve = new Float32Array(count);
  for (var i = 0; i < count; i++) {
    var local = rel + span * i / (count - 1), frame = E.runClipScriptFrame ? E.runClipScriptFrame(c, local) : null;
    var scene = E.proj.scenes && E.proj.scenes.find(function (item) { return item.id === c.sceneId; });
    var sceneFrame = scene && E.runSceneScriptFrame ? E.runSceneScriptFrame(scene, c, c.start + local) : null;
    var projectFrame = E.runProjectScriptFrame ? E.runProjectScriptFrame(c, c.start + local) : null;
    var changes = Object.assign({}, frame && frame.scriptedValues || {}, sceneFrame && sceneFrame.scriptedValues || {}, projectFrame && projectFrame.scriptedValues || {});
    var vol = Object.prototype.hasOwnProperty.call(changes, 'audio.volume') ? changes['audio.volume'] : c.vol;
    var fi = Object.prototype.hasOwnProperty.call(changes, 'audio.fadeIn') ? changes['audio.fadeIn'] : c.fadeIn;
    var fo = Object.prototype.hasOwnProperty.call(changes, 'audio.fadeOut') ? changes['audio.fadeOut'] : c.fadeOut;
    var fadeIn = Math.min(Math.max(0, fi || 0), c.dur), fadeOut = Math.min(Math.max(0, fo || 0), Math.max(0, c.dur - fadeIn));
    var gain = Math.max(0, vol || 0);
    if (fadeIn > 0 && local < fadeIn) gain *= local / fadeIn;
    if (fadeOut > 0 && local > c.dur - fadeOut) gain *= Math.max(0, (c.dur - local) / fadeOut);
    curve[i] = isFinite(gain) ? gain : 0;
  }
  gp.setValueCurveAtTime(curve, when, Math.max(0.005, span));
}
A.clips = function () {
  return E.proj.clips.filter(function (c) {
    if (c.kind !== 'audio' && c.kind !== 'video') return false;
    var m = E.media[c.media]; if (!m || !m.buffer) return false;
    var r = E.rowById(c.row); return r && !r.mute && !c.mute && (c.vol > 0 || hasScriptAudio(c));
  });
};
A.hasAudio = function () { return A.clips().length > 0; };

A.stop = function () {
  var list = srcs; srcs = [];
  if (!ctx) return;
  var t = ctx.currentTime;
  list.forEach(function (o) {
    try { o.g.gain.cancelScheduledValues(t); o.g.gain.setTargetAtTime(0, t, 0.008); o.s.stop(t + 0.05); } catch (e) { /* already stopped */ }
    setTimeout(function () { try { o.s.disconnect(); o.g.disconnect(); } catch (e) { /* gone */ } }, 120);
  });
};
A.start = function (T) {
  var a = A.ensure(); if (!a) return; A.stop();
  var now = a.currentTime + 0.05;
  A.clips().forEach(function (c) {
    var m = E.media[c.media], ce = c.start + c.dur; if (ce <= T + 0.01) return;
    var rel = Math.max(0, T - c.start), when = now + Math.max(0, c.start - T), off = c['in'] + rel, dur = Math.min(c.dur - rel, m.buffer.duration - off);
    if (dur <= 0.005) return;
    var s = a.createBufferSource(); s.buffer = m.buffer; var g = a.createGain(); s.connect(g); g.connect(master);
    if (hasScriptAudio(c)) applyScriptEnv(g.gain, c, when, rel, dur); else applyEnv(g.gain, c, when - rel, rel);
    s.start(when, off, dur); srcs.push({ s: s, g: g });
  });
};
A.refresh = function () { if (E.playing) A.start(E.t); };

/* Library preview of one sound. */
A.preview = function (m, onEnd) {
  var a = A.ensure(); if (!a || !m.buffer) return false;
  A.stopPreview();
  var s = a.createBufferSource(); s.buffer = m.buffer; var g = a.createGain(); g.gain.value = 0.9; s.connect(g); g.connect(master);
  s.onended = function () { if (pv && pv.s === s) { pv = null; if (onEnd) onEnd(); } };
  s.start(); pv = { s: s, id: m.id, onEnd: onEnd }; return true;
};
A.stopPreview = function () { if (pv) { var o = pv; pv = null; try { o.s.onended = null; o.s.stop(); } catch (e) { /* done */ } if (o.onEnd) o.onEnd(); } };
A.previewId = function () { return pv ? pv.id : null; };

/* Whole-project mixdown to a stereo AudioBuffer (null when there is no audio). */
A.mix = async function (dur, sr) {
  var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) return null;
  sr = sr || 44100;
  var oc = new OC(2, Math.max(1, Math.ceil(dur * sr)), sr), any = false;
  A.clips().forEach(function (c) {
    if (c.start >= dur) return;
    var m = E.media[c.media], cd = Math.min(c.dur, dur - c.start, m.buffer.duration - c['in']); if (cd <= 0.005) return;
    var s = oc.createBufferSource(); s.buffer = m.buffer; var g = oc.createGain(); s.connect(g); g.connect(oc.destination);
    if (hasScriptAudio(c)) applyScriptEnv(g.gain, c, c.start, 0, cd); else applyEnv(g.gain, c, c.start, 0);
    s.start(c.start, c['in'], cd); any = true;
  });
  if (!any) return null;
  return oc.startRendering();
};
})();
