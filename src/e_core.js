(function () {
'use strict';
/* Video editor: project model, tracks, clips, editing operations, undo/redo. No DOM in here. */
var K = window.__snip, clamp = K.clamp;
var E = K.E = {};
var L = {};
E.on = function (ev, fn) { (L[ev] = L[ev] || []).push(fn); };
E.emit = function (ev, a) { var l = L[ev]; if (l) for (var i = 0; i < l.length; i++) l[i](a); };

E.RATIOS = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1000, 1000], '4:5': [880, 1100], '4:3': [1200, 900], '3:4': [900, 1200], '21:9': [1400, 600] };
E.MIN = 0.1;
var seq = 0;
E.uid = function (p) { return p + (++seq); };
E.media = {}; E.mediaList = [];
E.t = 0; E.sel = null; E.playing = false; E.needsRender = true;
E.dirty = function () { E.needsRender = true; };
function clone(o) { return JSON.parse(JSON.stringify(o)); }
E.clone = clone;

/* ---------- defaults ---------- */
E.defTf = function () { return { x: 0, y: 0, s: 1, r: 0, o: 1, fx: false, fy: false, fit: 'fit' }; };
E.defAnim = function () { return { 'in': { t: 'none', d: 0.7 }, out: { t: 'none', d: 0.7 }, combo: { t: 'none', sp: 1 }, fold: { dir: 'lr', cols: 3, rows: 2, over: 40, tilt: 18, bend: 50, crease: 55 } }; };
E.defCut = function () { return { on: false, style: 'torn', tex: 'plain', edge: 14, rough: 45, detail: 55, grain: 40, color: '#fbf7ee', boil: 3, boilFps: 8, boilLoop: 3, shadow: 20, shBlur: 14, rm: { on: true, tol: 46, feather: 2, wands: [] } }; };
E.defText = function () { return { str: 'Your text', font: 'Anton', size: 120, color: '#ffffff', bold: false, align: 'center', ls: 0, lh: 1.1, strokeW: 0, strokeC: '#000000', shadow: true, box: false, boxC: '#000000', boxPad: 22, boxR: 14, ransom: false }; };
E.newClip = function (kind, o) {
  var c = { id: E.uid('c'), kind: kind, media: null, name: '', row: null, start: 0, dur: 4, 'in': 0, tf: E.defTf(), anim: E.defAnim(), cut: E.defCut(), vol: 1, fadeIn: 0, fadeOut: 0, mute: false };
  if (kind === 'text') c.text = E.defText();
  if (o) for (var k in o) c[k] = o[k];
  return c;
};
E.rowKind = function (clip) { return clip.kind === 'audio' ? 'a' : 'v'; };

/* ---------- project ---------- */
E.newProject = function (ratio) {
  ratio = E.RATIOS[ratio] ? ratio : '16:9';
  var d = E.RATIOS[ratio];
  E.proj = { name: 'Untitled', ratio: ratio, w: d[0], h: d[1], bg: { type: 'color', color: '#111111' }, rows: [], clips: [] };
  E.proj.rows.push({ id: E.uid('r'), kind: 'v', hide: false, mute: false }, { id: E.uid('r'), kind: 'a', hide: false, mute: false });
  E.t = 0; E.sel = null; E.playing = false;
  E.resetHistory(); E.emit('project'); E.emit('sel'); E.dirty();
};
E.setRatio = function (key) {
  if (!E.RATIOS[key]) return;
  var d = E.RATIOS[key]; E.proj.ratio = key; E.proj.w = d[0]; E.proj.h = d[1];
  E.emit('project'); E.dirty(); E.commit();
};
E.clipById = function (id) { var cs = E.proj.clips; for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i]; return null; };
E.rowById = function (id) { var rs = E.proj.rows; for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i]; return null; };
E.selClip = function () { return E.sel ? E.clipById(E.sel) : null; };
E.rowClips = function (rowId) { return E.proj.clips.filter(function (c) { return c.row === rowId; }).sort(function (a, b) { return a.start - b.start; }); };
E.end = function () { var m = 0; E.proj.clips.forEach(function (c) { m = Math.max(m, c.start + c.dur); }); return m; };
E.duration = function () { return E.end(); };
E.select = function (id) { id = id || null; if (E.sel === id) return; E.sel = id; E.emit('sel'); E.dirty(); };
E.hasContent = function () { return E.proj.clips.length > 0; };
E.clipAt = function (rowId, T) {
  var cs = E.proj.clips;
  for (var i = 0; i < cs.length; i++) if (cs[i].row === rowId && cs[i].start <= T + 1e-9 && T < cs[i].start + cs[i].dur - 1e-9) return cs[i];
  return null;
};

/* ---------- rows ---------- */
E.addRow = function (kind, where) {
  var r = { id: E.uid('r'), kind: kind, hide: false, mute: false }, rs = E.proj.rows;
  if (kind === 'v') { if (where === 'bottom') { var li = -1; rs.forEach(function (x, i) { if (x.kind === 'v') li = i; }); rs.splice(li + 1, 0, r); } else rs.unshift(r); }
  else { if (where === 'top') { var fi = rs.findIndex(function (x) { return x.kind === 'a'; }); rs.splice(fi < 0 ? rs.length : fi, 0, r); } else rs.push(r); }
  return r;
};
E.tidy = function () {
  var P = E.proj, used = {};
  P.clips.forEach(function (c) { used[c.row] = 1; });
  ['v', 'a'].forEach(function (k) {
    var rs = P.rows.filter(function (r) { return r.kind === k; }), keep = k === 'v' ? rs[rs.length - 1] : rs[0];
    P.rows = P.rows.filter(function (r) { return r.kind !== k || used[r.id] || r === keep; });
  });
  P.rows = P.rows.filter(function (r) { return r.kind === 'v'; }).concat(P.rows.filter(function (r) { return r.kind === 'a'; }));
  if (!P.rows.some(function (r) { return r.kind === 'v'; })) P.rows.unshift({ id: E.uid('r'), kind: 'v', hide: false, mute: false });
  if (!P.rows.some(function (r) { return r.kind === 'a'; })) P.rows.push({ id: E.uid('r'), kind: 'a', hide: false, mute: false });
};

/* Nearest free start time for a clip of length dur in a row (other clips cannot overlap). */
E.freeStart = function (rowId, start, dur, ignoreId) {
  var cs = E.rowClips(rowId).filter(function (c) { return c.id !== ignoreId; }), gaps = [], prev = 0;
  cs.forEach(function (c) { if (c.start - prev >= dur - 1e-6) gaps.push([prev, c.start]); prev = Math.max(prev, c.start + c.dur); });
  gaps.push([prev, Infinity]);
  var best = 0, bc = Infinity;
  gaps.forEach(function (g) { var s = clamp(start, g[0], g[1] - dur), cost = Math.abs(s - start); if (cost < bc - 1e-9) { bc = cost; best = s; } });
  return Math.max(0, best);
};
/* Neighbour limits (prev end, next start) of a clip inside its row. */
E.neighbours = function (c) {
  var lo = 0, hi = Infinity;
  E.rowClips(c.row).forEach(function (o) {
    if (o.id === c.id) return;
    if (o.start + o.dur <= c.start + 1e-6) lo = Math.max(lo, o.start + o.dur);
    else if (o.start >= c.start + c.dur - 1e-6) hi = Math.min(hi, o.start);
  });
  return { lo: lo, hi: hi };
};

/* Where does a new clip go? Visual media is appended on the main track, or goes on an overlay track when the playhead sits inside a clip. */
E.placeNew = function (kind, dur, start) {
  var P = E.proj, k = kind === 'audio' ? 'a' : 'v', rows = P.rows.filter(function (r) { return r.kind === k; });
  if (!P.clips.length) start = 0;
  start = Math.max(0, start);
  if (k === 'v') {
    var main = rows[rows.length - 1], inside = E.rowClips(main.id).some(function (c) { return start > c.start + 0.05 && start < c.start + c.dur - 0.05; });
    if (!inside && kind !== 'text') return { row: main.id, start: E.freeStart(main.id, start, dur) };
    for (var i = rows.length - 1; i >= 0; i--) { if (Math.abs(E.freeStart(rows[i].id, start, dur) - start) < 1e-6) return { row: rows[i].id, start: start }; }
    return { row: E.addRow('v', 'top').id, start: start };
  }
  for (var j = 0; j < rows.length; j++) { if (Math.abs(E.freeStart(rows[j].id, start, dur) - start) < 1e-6) return { row: rows[j].id, start: start }; }
  return { row: E.addRow('a', 'bottom').id, start: start };
};

/* ---------- user-level operations (each one is an undo step) ---------- */
function done(sel) { E.tidy(); if (sel !== undefined) { E.sel = sel; } E.emit('project'); E.emit('sel'); E.dirty(); E.commit(); }
E.addMedia = function (mid, o) {
  o = o || {};
  var m = E.media[mid]; if (!m) return null;
  var kind = m.kind, dur = kind === 'image' ? (m.defDur || 4) : m.dur || 4;
  var c = E.newClip(kind, { media: mid, name: m.name, dur: dur });
  if (m.fill) c.tf.fit = 'fill';
  var pl = o.row ? { row: o.row, start: E.freeStart(o.row, o.start != null ? o.start : E.t, dur) } : E.placeNew(kind, dur, o.start != null ? o.start : E.t);
  c.row = pl.row; c.start = pl.start;
  E.proj.clips.push(c); done(c.id);
  return c;
};
E.addText = function (preset) {
  var c = E.newClip('text', { name: 'Text', dur: 3 });
  if (preset) {
    if (preset.text) Object.assign(c.text, clone(preset.text));
    if (preset.cut) Object.assign(c.cut, clone(preset.cut));
    if (preset.anim) { c.anim['in'] = Object.assign(c.anim['in'], clone(preset.anim['in'] || {})); }
    if (preset.name) c.name = preset.name;
  }
  var pl = E.placeNew('text', c.dur, E.t); c.row = pl.row; c.start = pl.start;
  E.proj.clips.push(c); done(c.id);
  return c;
};
/* rowSpec: a row id, or 'new-top' / 'new-bottom'. Live variants skip the history step so drags stay cheap. */
E.moveClip = function (id, rowSpec, start, live) {
  var c = E.clipById(id); if (!c) return;
  var k = E.rowKind(c), rid = rowSpec;
  if (rowSpec === 'new-top') rid = E.addRow(k, 'top').id; else if (rowSpec === 'new-bottom') rid = E.addRow(k, 'bottom').id;
  var row = E.rowById(rid); if (!row || row.kind !== k) rid = c.row;
  c.row = rid; c.start = E.freeStart(rid, Math.max(0, start), c.dur, c.id);
  if (!live) done(c.id); else { E.tidy(); }
};
/* side: 'l' or 'r'; t: the timeline time the edge is dragged to. */
E.trimClip = function (id, side, t, live) {
  var c = E.clipById(id); if (!c) return;
  var nb = E.neighbours(c), m = c.media ? E.media[c.media] : null, src = (c.kind === 'video' || c.kind === 'audio') && m;
  if (side === 'l') {
    var ns = clamp(t, Math.max(nb.lo, src ? c.start - c['in'] : 0), c.start + c.dur - E.MIN), d = ns - c.start;
    c.start = ns; c.dur -= d; if (src) c['in'] += d;
  } else {
    var maxEnd = Math.min(nb.hi, src ? c.start + (m.dur - c['in']) : Infinity), ne = clamp(t, c.start + E.MIN, maxEnd);
    c.dur = ne - c.start;
  }
  if (!live) done(c.id); else E.dirty();
};
E.setDuration = function (id, dur) {
  var c = E.clipById(id); if (!c) return;
  var nb = E.neighbours(c), m = c.media ? E.media[c.media] : null, src = (c.kind === 'video' || c.kind === 'audio') && m;
  var maxEnd = Math.min(nb.hi, src ? c.start + (m.dur - c['in']) : Infinity);
  c.dur = clamp(dur, E.MIN, maxEnd - c.start); E.emit('project'); E.dirty();
};
E.splitClip = function (id, t) {
  var c = E.clipById(id); if (!c) return null;
  if (t <= c.start + 0.05 || t >= c.start + c.dur - 0.05) return null;
  var b = clone(c); b.id = E.uid('c');
  var d = t - c.start;
  b.start = t; b.dur = c.dur - d; if (c.kind === 'video' || c.kind === 'audio') b['in'] = c['in'] + d;
  c.dur = d;
  c.anim.out.t = 'none'; b.anim['in'].t = 'none'; c.fadeOut = 0; b.fadeIn = 0;
  E.proj.clips.push(b);
  return b;
};
E.splitAtPlayhead = function () {
  var T = E.t, sel = E.selClip(), targets = sel ? [sel] : E.proj.clips.filter(function (c) { return T > c.start + 0.05 && T < c.start + c.dur - 0.05; }), made = null;
  targets.forEach(function (c) { var b = E.splitClip(c.id, T); if (b) made = made || b; });
  if (made) done(sel ? made.id : E.sel); else E.emit('toast', 'Move the playhead over a clip to split it.');
  return made;
};
E.deleteClip = function (id) {
  var i = E.proj.clips.findIndex(function (c) { return c.id === id; }); if (i < 0) return;
  E.proj.clips.splice(i, 1); done(E.sel === id ? null : E.sel);
};
E.duplicateClip = function (id) {
  var c = E.clipById(id); if (!c) return null;
  var b = clone(c); b.id = E.uid('c');
  var s = E.freeStart(c.row, c.start + c.dur, c.dur);
  if (Math.abs(s - (c.start + c.dur)) > 1e-6) { b.row = E.addRow(E.rowKind(c), E.rowKind(c) === 'v' ? 'top' : 'bottom').id; b.start = c.start; } else b.start = s;
  E.proj.clips.push(b); done(b.id); return b;
};
E.setRowFlag = function (rowId, flag) {
  var r = E.rowById(rowId); if (!r) return; r[flag] = !r[flag];
  E.emit('project'); E.dirty(); E.commit();
};

/* ---------- history ---------- */
var H = { undo: [], redo: [], cur: '' };
function snapP() { return JSON.stringify(E.proj); }
E.resetHistory = function () { H.undo = []; H.redo = []; H.cur = snapP(); E.emit('history'); };
E.commit = function () {
  var s = snapP(); if (s === H.cur) return;
  H.undo.push(H.cur); if (H.undo.length > 120) H.undo.shift();
  H.redo = []; H.cur = s; E.emit('history');
};
function restore(s) {
  E.proj = JSON.parse(s); H.cur = s;
  if (E.sel && !E.clipById(E.sel)) E.sel = null;
  E.emit('project'); E.emit('sel'); E.emit('history'); E.dirty();
}
E.undo = function () { if (!H.undo.length) return; H.redo.push(H.cur); restore(H.undo.pop()); };
E.redo = function () { if (!H.redo.length) return; H.undo.push(H.cur); restore(H.redo.pop()); };
E.canUndo = function () { return H.undo.length > 0; };
E.canRedo = function () { return H.redo.length > 0; };

/* ---------- formatting ---------- */
E.fmt = function (t, withFrames) {
  t = Math.max(0, t || 0); var m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * 30 + 1e-4);
  var p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return p(m) + ':' + p(s) + (withFrames ? ':' + p(f) : '');
};
E.fmtS = function (t) { return (Math.round(t * 10) / 10).toFixed(1) + 's'; };

E.newProject('16:9');
})();
