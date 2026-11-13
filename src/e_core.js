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
/* Keyframes: per clip, per transform parameter, a list of { t, v, e } sorted by t. t is seconds from the clip's start,
   v the value, e how it eases towards the next keyframe: 'ease' (smooth), 'lin' (linear) or 'hold' (jump). An empty list means the parameter is not animated and the plain value in clip.tf is used. */
E.KF_PARAMS = ['x', 'y', 's', 'r', 'o'];
E.KF_EPS = 0.02;
E.kfEase = 'ease';
E.defKf = function () { return { x: [], y: [], s: [], r: [], o: [] }; };
E.defAnim = function () { return { 'in': { t: 'none', d: 0.7 }, out: { t: 'none', d: 0.7 }, combo: { t: 'none', sp: 1 }, fold: { dir: 'lr', cols: 3, rows: 2, over: 40, tilt: 18, bend: 50, crease: 55 } }; };
E.defCut = function () { return { on: false, style: 'torn', tex: 'plain', edge: 14, rough: 45, detail: 55, grain: 40, color: '#fbf7ee', boil: 3, boilFps: 8, boilLoop: 3, shadow: 20, shBlur: 14, rm: { on: true, tol: 46, feather: 2, wands: [] } }; };
E.defText = function () { return { str: 'Your text', font: 'Anton', size: 120, color: '#ffffff', bold: false, align: 'center', ls: 0, lh: 1.1, strokeW: 0, strokeC: '#000000', shadow: true, box: false, boxC: '#000000', boxPad: 22, boxR: 14, ransom: false }; };
E.newClip = function (kind, o) {
  var c = { id: E.uid('c'), kind: kind, media: null, name: '', row: null, start: 0, dur: 4, 'in': 0, tf: E.defTf(), kf: E.defKf(), anim: E.defAnim(), cut: E.defCut(), vol: 1, fadeIn: 0, fadeOut: 0, mute: false };
  if (kind === 'text') c.text = E.defText();
  if (o) for (var k in o) c[k] = o[k];
  return c;
};
E.rowKind = function (clip) { return clip.kind === 'audio' ? 'a' : 'v'; };

/* ---------- project ---------- */
E.newProject = function (ratio) {
  ratio = E.RATIOS[ratio] ? ratio : '16:9';
  var d = E.RATIOS[ratio];
  E.proj = { name: 'Untitled', ratio: ratio, w: d[0], h: d[1], bg: { type: 'color', color: '#111111' }, rows: [], clips: [], scriptPresets: [], motionPresets: [] };
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
    c.start = ns; c.dur -= d; if (src) c['in'] += d; shiftKf(c, -d);
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
/* ---------- keyframes ---------- */
function bezierCoord(t, a, b) { var u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t; }
E.cubicBezierProgress = function (curve, progress) {
  if (!curve || typeof curve !== 'object') throw new TypeError('A Bezier curve is required.');
  var x1 = Number(curve.x1), y1 = Number(curve.y1), x2 = Number(curve.x2), y2 = Number(curve.y2);
  if (![x1, y1, x2, y2].every(function (v) { return isFinite(v); }) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1 || y1 < -0.25 || y1 > 1.25 || y2 < -0.25 || y2 > 1.25) throw new RangeError('Bezier control points are outside the supported range.');
  var k = Number(progress); if (!isFinite(k)) k = 0; k = clamp(k, 0, 1);
  if (k === 0 || k === 1) return k;
  var low = 0, high = 1, t = 0.5;
  for (var i = 0; i < 20; i++) { t = (low + high) / 2; if (bezierCoord(t, x1, x2) < k) low = t; else high = t; }
  return bezierCoord((low + high) / 2, y1, y2);
};
function normaliseKfEase(e) {
  if (e === 'ease' || e === 'lin' || e === 'hold') return e;
  if (!e || typeof e !== 'object' || (e.type && e.type !== 'bezier')) throw new TypeError('Choose Smooth, Linear, Hold or a custom Bezier curve.');
  var curve = { type: 'bezier', x1: Number(e.x1), y1: Number(e.y1), x2: Number(e.x2), y2: Number(e.y2) };
  if (![curve.x1, curve.y1, curve.x2, curve.y2].every(function (v) { return isFinite(v); })) throw new TypeError('Bezier control points must be finite numbers.');
  if (curve.x1 < 0 || curve.x1 > 1 || curve.x2 < 0 || curve.x2 > 1) throw new RangeError('Bezier X control points must be between 0 and 1.');
  if (curve.y1 < -0.25 || curve.y1 > 1.25 || curve.y2 < -0.25 || curve.y2 > 1.25) throw new RangeError('Bezier Y control points must be between -0.25 and 1.25.');
  return curve;
}
E.normalizeKfEase = normaliseKfEase;
function copyKfEase(e) { var n = normaliseKfEase(e == null ? 'ease' : e); return typeof n === 'object' ? E.clone(n) : n; }
function easeU(u, e) {
  if (e && typeof e === 'object') return E.cubicBezierProgress(e, u);
  return e === 'hold' ? 0 : e === 'lin' ? u : u * u * (3 - 2 * u);
}
function evalKf(a, t) {
  var n = a.length; if (t <= a[0].t) return a[0].v; if (t >= a[n - 1].t) return a[n - 1].v;
  var i = 1; while (i < n - 1 && a[i].t <= t) i++;
  var p = a[i - 1], q = a[i], d = q.t - p.t; if (d < 1e-6) return q.v;
  return p.v + (q.v - p.v) * easeU((t - p.t) / d, p.e);
}
E.hasKf = function (c) { var k = c && c.kf; if (!k) return false; for (var i = 0; i < 5; i++) if (k[E.KF_PARAMS[i]] && k[E.KF_PARAMS[i]].length) return true; return false; };
E.isAnimated = function (c, p) { return !!(c && c.kf && c.kf[p] && c.kf[p].length); };
/* The clip's time at the playhead, kept inside the clip. */
E.localT = function (c) { return clamp(E.t - c.start, 0, c.dur); };
/* The clip's transform at lt seconds after its start, with keyframes applied. */
E.tfAt = function (c, lt) {
  var tf = c.tf, o = { x: tf.x, y: tf.y, s: tf.s, r: tf.r, o: tf.o, fx: tf.fx, fy: tf.fy, fit: tf.fit }, k = c.kf;
  if (k) for (var i = 0; i < 5; i++) { var p = E.KF_PARAMS[i], a = k[p]; if (a && a.length) o[p] = evalKf(a, lt); }
  return o;
};
E.kfIndex = function (c, p, lt) { var a = c.kf && c.kf[p]; if (!a) return -1; for (var i = 0; i < a.length; i++) if (Math.abs(a[i].t - lt) <= E.KF_EPS) return i; return -1; };
function kfInsert(a, k) { var i = 0; while (i < a.length && a[i].t < k.t) i++; a.splice(i, 0, k); }
/* Set a parameter. An animated parameter gets a keyframe at lt (or its keyframe there is updated); otherwise the plain value changes. No history step: callers commit. */
E.setTf = function (c, p, v, lt) {
  var a = c.kf && c.kf[p];
  if (a && a.length) { var i = E.kfIndex(c, p, lt); if (i >= 0) a[i].v = v; else kfInsert(a, { t: lt, v: v, e: copyKfEase(E.kfEase) }); }
  else c.tf[p] = v;
};
/* Diamond button: add a keyframe at lt for each parameter in ps, or remove them when all already have one there. */
E.toggleKf = function (c, ps, lt) {
  if (!c.kf) c.kf = E.defKf();
  var all = ps.every(function (p) { return E.kfIndex(c, p, lt) >= 0; }), cur = E.tfAt(c, lt);
  ps.forEach(function (p) {
    var a = c.kf[p], i = E.kfIndex(c, p, lt);
    if (all) { var gone = a.splice(i, 1)[0]; if (!a.length) c.tf[p] = gone.v; }
    else if (i < 0) kfInsert(a, { t: lt, v: cur[p], e: copyKfEase(E.kfEase) });
  });
  E.emit('project'); E.dirty(); E.commit();
};
/* Stop animating a parameter and keep the value it has at lt. */
E.clearKf = function (c, ps, lt) {
  var cur = E.tfAt(c, lt); ps.forEach(function (p) { if (c.kf && c.kf[p] && c.kf[p].length) { c.tf[p] = cur[p]; c.kf[p] = []; } });
  E.emit('project'); E.dirty(); E.commit();
};
/* Times (seconds from clip start) that carry at least one keyframe, ascending and merged. */
E.kfTimes = function (c) {
  var ts = []; if (!c.kf) return ts;
  E.KF_PARAMS.forEach(function (p) { (c.kf[p] || []).forEach(function (k) { if (!ts.some(function (t) { return Math.abs(t - k.t) <= E.KF_EPS; })) ts.push(k.t); }); });
  return ts.sort(function (a, b) { return a - b; });
};
/* Slide every keyframe at time `from` to time `to` (dragging a diamond on the timeline). Returns the time actually used. */
E.moveKfTime = function (c, from, to) {
  if (!c.kf) return from;
  var blocked = E.kfTimes(c).some(function (t) { return Math.abs(t - from) > E.KF_EPS && Math.abs(t - to) <= E.KF_EPS; });
  if (blocked) return from;
  E.KF_PARAMS.forEach(function (p) { var a = c.kf[p]; if (!a) return; a.forEach(function (k) { if (Math.abs(k.t - from) <= E.KF_EPS) k.t = to; }); a.sort(function (x, y) { return x.t - y.t; }); });
  return to;
};
/* Move one keyframe on one property lane without moving other properties at the same timestamp. */
E.movePropertyKfTime = function (c, p, from, to) {
  var a = c && c.kf && c.kf[p];
  if (!a || !a.length || E.KF_PARAMS.indexOf(p) < 0) return from;
  var index = E.kfIndex(c, p, from);
  if (index < 0) return from;
  to = Number(to);
  if (!isFinite(to)) return a[index].t;
  to = clamp(to, 0, c.dur);
  var blocked = a.some(function (key, i) { return i !== index && Math.abs(key.t - to) <= E.KF_EPS; });
  if (blocked) return a[index].t;
  a[index].t = to;
  a.sort(function (x, y) { return x.t - y.t; });
  return to;
};
/* Set how keyframes at lt ease towards the next one. With none there, only the default for new keyframes changes. */
E.setKfEase = function (c, lt, e) {
  e = copyKfEase(e); E.kfEase = e; var hit = false;
  if (c && c.kf) E.KF_PARAMS.forEach(function (p) { var i = E.kfIndex(c, p, lt); if (i >= 0) { c.kf[p][i].e = copyKfEase(e); hit = true; } });
  if (hit) { E.emit('project'); E.dirty(); E.commit(); }
};

/* Add, edit and remove an individual property keyframe. These operations are
   deliberately separate from moveKfTime, which moves a whole timestamp group. */
E.addKf = function (c, p, lt) {
  if (!c || E.KF_PARAMS.indexOf(p) < 0) throw new TypeError('Choose a supported transform track.');
  if (!c.kf) c.kf = E.defKf();
  lt = Number(lt);
  if (!isFinite(lt)) throw new TypeError('Keyframe time must be a number.');
  lt = clamp(lt, 0, c.dur);
  var existing = E.kfIndex(c, p, lt);
  if (existing >= 0) return { t: c.kf[p][existing].t, v: c.kf[p][existing].v, e: c.kf[p][existing].e };
  var key = { t: lt, v: E.tfAt(c, lt)[p], e: copyKfEase(E.kfEase) };
  kfInsert(c.kf[p], key);
  return { t: key.t, v: key.v, e: key.e };
};
E.updateKf = function (c, p, index, patch) {
  if (!c || E.KF_PARAMS.indexOf(p) < 0 || !c.kf || !c.kf[p] || !c.kf[p][index]) throw new Error('The selected keyframe no longer exists.');
  patch = patch || {};
  var a = c.kf[p], key = a[index];
  if (patch.t != null) {
    var t = Number(patch.t);
    if (!isFinite(t)) throw new TypeError('Keyframe time must be a number.');
    t = clamp(t, 0, c.dur);
    if (a.some(function (other, i) { return i !== index && Math.abs(other.t - t) <= E.KF_EPS; })) throw new Error('This track already has a keyframe at that time.');
    key.t = t;
  }
  if (patch.v != null) {
    var v = Number(patch.v), limits = { x: [-1, 1], y: [-1, 1], s: [0.03, 10], r: [-3600, 3600], o: [0, 1] }[p];
    if (!isFinite(v) || v < limits[0] || v > limits[1]) throw new RangeError('Keyframe value is outside the supported range for this track.');
    key.v = v;
  }
  if (patch.e != null) {
    key.e = copyKfEase(patch.e);
  }
  a.sort(function (x, y) { return x.t - y.t; });
  return { t: key.t, v: key.v, e: key.e };
};
/* Set one property's keyframe value by its local time. */
E.setPropertyKfValue = function (c, p, lt, value) {
  var index = E.kfIndex(c, p, lt);
  if (index < 0) throw new Error('The selected keyframe no longer exists.');
  return E.updateKf(c, p, index, { v: value });
};
E.deleteKf = function (c, p, index) {
  var a = c && c.kf && c.kf[p];
  if (!a || index < 0 || index >= a.length) return false;
  var gone = a.splice(index, 1)[0];
  if (!a.length) c.tf[p] = gone.v;
  return true;
};

/* Project-level motion presets store only transform keyframes, not clip media or layout. */
function motionPresetList() {
  if (!E.proj) throw new Error('Open a project before using the motion library.');
  if (!Array.isArray(E.proj.motionPresets)) E.proj.motionPresets = [];
  return E.proj.motionPresets;
}
E.listMotionPresets = function () { return motionPresetList().slice(); };
E.getMotionPreset = function (id) {
  var list = motionPresetList();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
};
E.saveMotionPreset = function (name, clip) {
  name = String(name == null ? '' : name).trim();
  if (!clip || ['image', 'video', 'text'].indexOf(clip.kind) < 0) throw new TypeError('Select an image, video or text clip before saving a motion preset.');
  if (!name) throw new Error('Enter a name for this motion preset.');
  if (name.length > 48) throw new Error('Preset names are limited to 48 characters.');
  if (!E.hasKf(clip)) throw new Error('Add at least one keyframe before saving a motion preset.');
  var tracks = E.defKf(), count = 0, maxTime = 0;
  E.KF_PARAMS.forEach(function (p) {
    tracks[p] = (clip.kf[p] || []).map(function (k) {
      return { t: Number(k.t), v: Number(k.v), e: copyKfEase(k.e) };
    }).filter(function (k) { return isFinite(k.t) && isFinite(k.v) && k.t >= 0; }).sort(function (a, b) { return a.t - b.t; });
    count += tracks[p].length;
    tracks[p].forEach(function (k) { maxTime = Math.max(maxTime, k.t); });
  });
  if (!count) throw new Error('Add at least one valid keyframe before saving a motion preset.');
  var list = motionPresetList(), key = name.toLowerCase(), item = null;
  for (var i = 0; i < list.length; i++) if (String(list[i].name || '').toLowerCase() === key) { item = list[i]; break; }
  if (item) { item.name = name; item.tracks = tracks; item.keyframes = count; item.duration = maxTime; }
  else {
    if (list.length >= 50) throw new Error('A project can contain up to 50 saved motion presets.');
    item = { id: E.uid('mp'), name: name, tracks: tracks, keyframes: count, duration: maxTime };
    list.push(item);
  }
  return item;
};
E.applyMotionPreset = function (id, clip) {
  var item = E.getMotionPreset(id);
  if (!item) throw new Error('Choose a saved motion preset first.');
  if (!clip || ['image', 'video', 'text'].indexOf(clip.kind) < 0) throw new TypeError('Motion presets can be applied to image, video or text clips.');
  var tracks = item.tracks || {}, longest = 0;
  E.KF_PARAMS.forEach(function (p) { (tracks[p] || []).forEach(function (k) { longest = Math.max(longest, Number(k.t) || 0); }); });
  if (longest > clip.dur + E.KF_EPS) throw new Error('This motion preset is longer than the selected clip. Extend the clip first.');
  var copy = E.defKf();
  E.KF_PARAMS.forEach(function (p) {
    copy[p] = (tracks[p] || []).map(function (k) { return { t: Number(k.t), v: Number(k.v), e: copyKfEase(k.e) }; }).sort(function (a, b) { return a.t - b.t; });
  });
  clip.kf = copy;
  return true;
};
E.deleteMotionPreset = function (id) {
  var list = motionPresetList();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) { list.splice(i, 1); return true; }
  return false;
};
/* The clip is cut at d seconds: b is a copy made from c. Each animated parameter gets a keyframe at the cut so the motion carries on unbroken. */
function splitKf(c, b, d) {
  E.KF_PARAMS.forEach(function (p) {
    var a = c.kf && c.kf[p]; if (!a || !a.length) return;
    var v = evalKf(a, d), ease = 'ease', i;
    for (i = 0; i < a.length; i++) if (a[i].t <= d) ease = copyKfEase(a[i].e);
    c.kf[p] = a.filter(function (k) { return k.t < d - E.KF_EPS; }).concat([{ t: d, v: v, e: copyKfEase(ease) }]);
    b.kf[p] = [{ t: 0, v: v, e: copyKfEase(ease) }].concat(a.filter(function (k) { return k.t > d + E.KF_EPS; }).map(function (k) { return { t: k.t - d, v: k.v, e: copyKfEase(k.e) }; }));
  });
}
/* The clip's left edge moved by d seconds: keep keyframes at the same moment of the timeline. */
function shiftKf(c, d) {
  if (!c.kf || !d) return;
  E.KF_PARAMS.forEach(function (p) { (c.kf[p] || []).forEach(function (k) { k.t += d; }); });
}

/* ---------- typed timing (timestamp boxes) ---------- */
/* Reads "12", "12.5", "1:05", "1:05.25" or "0:01:05" as seconds; returns null when it is not a time. */
E.parseTime = function (s) {
  s = String(s == null ? '' : s).trim().replace(/,/g, '.').replace(/s$/i, '');
  if (!s || !/^\d*\.?\d*(:\d*\.?\d*){0,2}$/.test(s)) return null;
  var p = s.split(':'), v = 0, i;
  for (i = 0; i < p.length; i++) { var n = p[i] === '' ? 0 : parseFloat(p[i]); if (isNaN(n)) return null; v = v * 60 + n; }
  return isFinite(v) ? v : null;
};
/* Shows seconds as m:ss.cc, e.g. 65.25 -> 1:05.25 */
E.fmtT = function (t) {
  t = Math.max(0, t || 0); var cs = Math.round(t * 100), m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c;
};
/* Move a clip so it starts at t (its length stays the same). It lands in the nearest free gap of its row. Returns the start it really got. */
E.setStart = function (id, t) {
  var c = E.clipById(id); if (!c) return null;
  c.start = E.freeStart(c.row, Math.max(0, t), c.dur, c.id);
  done(c.id); return c.start;
};
/* Trim the right edge so the clip ends at timeline time t. */
E.setEnd = function (id, t) {
  var c = E.clipById(id); if (!c) return null;
  E.trimClip(id, 'r', t, false); return c.start + c.dur;
};
/* Video and sound clips: choose which part of the source plays. The clip keeps its place on the timeline; its length follows the range. */
E.setSourceRange = function (id, tin, tout) {
  var c = E.clipById(id), m = c && c.media ? E.media[c.media] : null;
  if (!c || !m || !(c.kind === 'video' || c.kind === 'audio')) return null;
  var nb = E.neighbours(c), oldOut = c['in'] + c.dur, ni = tin == null ? c['in'] : tin, no = tout == null ? oldOut : tout;
  ni = clamp(ni, 0, Math.max(0, m.dur - E.MIN));
  no = clamp(no, ni + E.MIN, m.dur);
  if (isFinite(nb.hi)) no = Math.min(no, ni + (nb.hi - c.start));
  c['in'] = ni; c.dur = Math.max(E.MIN, no - ni);
  done(c.id); return { 'in': c['in'], out: c['in'] + c.dur };
};
E.splitClip = function (id, t) {
  var c = E.clipById(id); if (!c) return null;
  if (t <= c.start + 0.05 || t >= c.start + c.dur - 0.05) return null;
  var b = clone(c); b.id = E.uid('c');
  var d = t - c.start;
  b.start = t; b.dur = c.dur - d; if (c.kind === 'video' || c.kind === 'audio') b['in'] = c['in'] + d;
  splitKf(c, b, d);
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
