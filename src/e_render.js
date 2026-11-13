(function () {
'use strict';
/* Video editor renderer: one function draws a frame of the project at time T.
   Preview and export both use it. Also holds the animation library and the transport clock. */
var K = window.__snip, E = K.E, M = K.M, mkCanvas = K.mkCanvas, clamp = K.clamp, lerp = K.lerp, PI = Math.PI;
var TS = 2; /* text canvases are drawn at this multiple of the design size */

/* ---------- easing ---------- */
function eOut(k) { k = clamp(k, 0, 1); return 1 - Math.pow(1 - k, 3); }
function eIn(k) { k = clamp(k, 0, 1); return k * k * k; }
function eIO(k) { k = clamp(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
function outBack(k) { k = clamp(k, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }
function bounceOut(k) {
  k = clamp(k, 0, 1); var n = 7.5625, d = 2.75;
  if (k < 1 / d) return n * k * k; if (k < 2 / d) { k -= 1.5 / d; return n * k * k + 0.75; } if (k < 2.5 / d) { k -= 2.25 / d; return n * k * k + 0.9375; } k -= 2.625 / d; return n * k * k + 0.984375;
}
function h1(i, s) { return K.hash2(i, s || 1, 77); }

/* ---------- animation library ----------
   Every entry changes the clip's draw state st: alpha a, scale s (sx, sy stretch), offsets dx/dy as a fraction of the frame,
   rotation in radians, torn reveal amount, or a paper fold. k runs 0..1 over the animation. */
var IN = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Fade in', fn: function (st, k) { st.a *= eOut(k); } },
  { id: 'zoom', name: 'Pop in', fn: function (st, k) { st.s *= lerp(0.2, 1, outBack(k)); st.a *= clamp(k * 4, 0, 1); } },
  { id: 'grow', name: 'Zoom in', fn: function (st, k) { st.s *= lerp(0.55, 1, eOut(k)); st.a *= clamp(k * 2.5, 0, 1); } },
  { id: 'shrink', name: 'Zoom from big', fn: function (st, k) { st.s *= lerp(1.7, 1, eOut(k)); st.a *= clamp(k * 2.5, 0, 1); } },
  { id: 'slideL', name: 'Slide from left', fn: function (st, k) { st.dx -= (1 - eOut(k)) * 0.75; st.a *= clamp(k * 3, 0, 1); } },
  { id: 'slideR', name: 'Slide from right', fn: function (st, k) { st.dx += (1 - eOut(k)) * 0.75; st.a *= clamp(k * 3, 0, 1); } },
  { id: 'slideU', name: 'Slide from top', fn: function (st, k) { st.dy -= (1 - eOut(k)) * 0.75; st.a *= clamp(k * 3, 0, 1); } },
  { id: 'slideD', name: 'Slide from bottom', fn: function (st, k) { st.dy += (1 - eOut(k)) * 0.75; st.a *= clamp(k * 3, 0, 1); } },
  { id: 'spin', name: 'Spin in', fn: function (st, k) { var e = eOut(k); st.rot -= (1 - e) * PI * 1.2; st.s *= lerp(0.1, 1, e); st.a *= clamp(k * 3, 0, 1); } },
  { id: 'drop', name: 'Drop in', fn: function (st, k) { st.dy -= (1 - bounceOut(k)) * 0.85; st.a *= clamp(k * 8, 0, 1); } },
  { id: 'flip', name: 'Flip in', fn: function (st, k) { st.sx *= Math.max(0.001, Math.abs(Math.cos((1 - eOut(k)) * PI / 2))); st.a *= clamp(k * 5, 0, 1); } },
  { id: 'tear', name: 'Torn reveal', fn: function (st, k) { st.tear = eIO(k); } },
  { id: 'unfold', name: 'Paper unfold', paper: true },
  { id: 'stop', name: 'Stop-motion pop', fn: function (st, k, o) {
    var n = Math.max(1, Math.floor(k * o.dur * 8)), kk = n / Math.max(1, Math.floor(o.dur * 8));
    st.s *= lerp(0.35, 1, outBack(kk)); st.rot += (h1(n, 3) - 0.5) * 0.18 * (1 - kk); st.a *= k > 0.001 ? 1 : 0;
  } }
];
var OUT = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Fade out', fn: function (st, k) { st.a *= 1 - eIn(k); } },
  { id: 'zoom', name: 'Shrink away', fn: function (st, k) { st.s *= lerp(1, 0.15, eIn(k)); st.a *= 1 - clamp((k - 0.4) / 0.6, 0, 1); } },
  { id: 'grow', name: 'Zoom out', fn: function (st, k) { st.s *= lerp(1, 1.6, eIn(k)); st.a *= 1 - eIn(k); } },
  { id: 'slideL', name: 'Slide to left', fn: function (st, k) { st.dx -= eIn(k) * 0.75; st.a *= 1 - clamp((k - 0.5) / 0.5, 0, 1); } },
  { id: 'slideR', name: 'Slide to right', fn: function (st, k) { st.dx += eIn(k) * 0.75; st.a *= 1 - clamp((k - 0.5) / 0.5, 0, 1); } },
  { id: 'slideU', name: 'Slide to top', fn: function (st, k) { st.dy -= eIn(k) * 0.75; st.a *= 1 - clamp((k - 0.5) / 0.5, 0, 1); } },
  { id: 'slideD', name: 'Slide to bottom', fn: function (st, k) { st.dy += eIn(k) * 0.75; st.a *= 1 - clamp((k - 0.5) / 0.5, 0, 1); } },
  { id: 'spin', name: 'Spin out', fn: function (st, k) { var e = eIn(k); st.rot += e * PI * 1.2; st.s *= lerp(1, 0.1, e); st.a *= 1 - clamp((k - 0.5) / 0.5, 0, 1); } },
  { id: 'fall', name: 'Fall away', fn: function (st, k) { var e = eIn(k); st.dy += e * e * 1.1; st.rot += e * 0.5; st.a *= 1 - clamp((k - 0.7) / 0.3, 0, 1); } },
  { id: 'flip', name: 'Flip out', fn: function (st, k) { st.sx *= Math.max(0.001, Math.abs(Math.cos(eIn(k) * PI / 2))); st.a *= 1 - clamp((k - 0.8) / 0.2, 0, 1); } },
  { id: 'tear', name: 'Torn exit', fn: function (st, k) { st.tear = 1 - eIO(k); } },
  { id: 'fold', name: 'Paper fold away', paper: true },
  { id: 'stop', name: 'Stop-motion out', fn: function (st, k, o) {
    var n = Math.floor(k * o.dur * 8), tot = Math.max(1, Math.floor(o.dur * 8)), kk = n / tot;
    st.s *= lerp(1, 0.35, kk * kk); st.rot += (h1(n, 5) - 0.5) * 0.18 * kk; st.a *= k > 0.995 ? 0 : 1;
  } }
];
var COMBO = [
  { id: 'none', name: 'None' },
  { id: 'pulse', name: 'Heartbeat', fn: function (st, t) { st.s *= 1 + 0.07 * Math.pow(Math.max(0, Math.sin(t * 2 * PI * 1.1)), 2); } },
  { id: 'breathe', name: 'Breathe', fn: function (st, t) { st.s *= 1 + 0.045 * Math.sin(t * 1.5); } },
  { id: 'sway', name: 'Swing', fn: function (st, t) { st.rot += 0.13 * Math.sin(t * 2.2); } },
  { id: 'wobble', name: 'Wobble', fn: function (st, t) { st.sx *= 1 + 0.05 * Math.sin(t * 7); st.sy *= 1 - 0.05 * Math.sin(t * 7); st.rot += 0.04 * Math.sin(t * 5); } },
  { id: 'float', name: 'Float', fn: function (st, t) { st.dy += 0.025 * Math.sin(t * 1.6); st.dx += 0.012 * Math.sin(t * 1.1); st.rot += 0.03 * Math.sin(t * 1.3); } },
  { id: 'spin', name: 'Rotate', fn: function (st, t) { st.rot += t * 0.9; } },
  { id: 'shake', name: 'Shake', fn: function (st, t) { var n = Math.floor(t * 24); st.dx += (h1(n, 1) - 0.5) * 0.014; st.dy += (h1(n, 2) - 0.5) * 0.014; st.rot += (h1(n, 3) - 0.5) * 0.03; } },
  { id: 'flicker', name: 'Flicker', fn: function (st, t) { st.a *= h1(Math.floor(t * 12), 9) > 0.3 ? 1 : 0.45; } },
  { id: 'hop', name: 'Stop-motion hop', fn: function (st, t) { var q = Math.floor(t * 8) / 8; st.dy -= Math.abs(Math.sin(q * 3.2)) * 0.06; st.rot += Math.sin(q * 2.2) * 0.07; } },
  { id: 'jelly', name: 'Jelly', fn: function (st, t) { st.sx *= 1 + 0.07 * Math.sin(t * 6); st.sy *= 1 - 0.07 * Math.sin(t * 6 + 0.4); } }
];
E.ANIMS = { 'in': IN, out: OUT, combo: COMBO };
function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
var TAIL = 0.7;

function animState(c, lt) {
  var an = c.anim, st = { a: 1, s: 1, sx: 1, sy: 1, dx: 0, dy: 0, rot: 0, tear: -1, fold: null }, dur = c.dur;
  var ai = an['in'], ao = an.out, di = ai.t !== 'none' ? Math.min(ai.d, dur) : 0, dO = ao.t !== 'none' ? Math.min(ao.d, dur) : 0, f;
  if (di + dO > dur) { f = dur / (di + dO); di *= f; dO *= f; }
  if (di > 0 && lt < di) {
    var a = find(IN, ai.t);
    if (a && a.paper) st.fold = { p: clamp(lt / di, 0, 1), dir: 1, tc: lt, T: di, tail: 0 };
    else if (a && a.fn) a.fn(st, clamp(lt / di, 0, 1), { dur: di });
  } else if (di > 0 && ai.t === 'unfold' && lt < di + TAIL && !(dO > 0 && lt > dur - dO)) {
    st.fold = { p: 1, dir: 0, tc: lt, T: di, tail: (lt - di) / TAIL };
  }
  if (dO > 0 && lt > dur - dO) {
    var b = find(OUT, ao.t), k = clamp((lt - (dur - dO)) / dO, 0, 1);
    if (b && b.paper) st.fold = { p: 1 - k, dir: -1, tc: lt - (dur - dO), T: dO, tail: 0 };
    else if (b && b.fn) b.fn(st, k, { dur: dO });
  }
  var cm = an.combo;
  if (cm.t !== 'none') { var g = find(COMBO, cm.t); if (g && g.fn) g.fn(st, lt * (cm.sp || 1)); }
  return st;
}
E.animState = animState;

/* ---------- caches ---------- */
var PC = K.lru(24), RECTS = {}, VS = {}, LAY = {};
function layerCanvas(w, h) {
  var key = w + 'x' + h, c = LAY[key];
  if (!c) { var ks = Object.keys(LAY); if (ks.length > 3) delete LAY[ks[0]]; c = LAY[key] = mkCanvas(w, h); }
  var x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.shadowColor = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h); return c;
}
function paperOf(c, T, subj, subjKey, withBack, extra) {
  var cut = c.cut, lt = T - c.start, v = cut.boil > 0 ? Math.floor(lt * cut.boilFps + 1e-6) % Math.max(2, cut.boilLoop) : 0;
  var key = [subjKey, cut.style, cut.tex, cut.edge, cut.rough, cut.detail, cut.grain, cut.color, cut.boil, v, withBack ? 1 : 0].join('|'), hit = PC.get(key);
  if (hit) return hit;
  var o = { key: 'e|' + subjKey, variant: v, style: cut.style, tex: cut.tex, edge: cut.edge, rough: cut.rough, detail: cut.detail, grain: cut.grain, color: cut.color, boil: cut.boil, withBack: withBack, scale: Math.max(subj.width, subj.height) / 800 };
  if (extra) for (var q in extra) o[q] = extra[q];
  return PC.set(key, K.cutout(subj, o));
}

/* ---------- video elements ---------- */
var VID = {};
function videoFor(c) {
  var r = VID[c.id];
  if (r && r.mid === c.media) return r.el;
  var m = E.media[c.media], v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = m.url; v.addEventListener('seeked', E.dirty); v.addEventListener('loadeddata', E.dirty);
  VID[c.id] = { el: v, mid: c.media }; return v;
}
function noop() { }
/* Keep each video clip's element on the right frame. While playing they run; while paused they seek. */
E.syncVideos = function (T) {
  E.proj.clips.forEach(function (c) {
    if (c.kind !== 'video' || !E.media[c.media]) return;
    var inR = T >= c.start - 0.001 && T < c.start + c.dur, pre = !inR && T < c.start && T > c.start - 0.7;
    if (!inR && !pre && !VID[c.id]) return;
    var v = videoFor(c), target = c['in'] + clamp(T - c.start, 0, c.dur);
    if (inR && E.playing) {
      if (v.paused) { if (Math.abs(v.currentTime - target) > 0.05) v.currentTime = target; var p = v.play(); if (p && p.catch) p.catch(noop); }
      else if (Math.abs(v.currentTime - target) > 0.35) v.currentTime = target;
    } else {
      if (!v.paused) v.pause();
      var want = pre ? c['in'] : inR ? target : null;
      if (want != null && Math.abs(v.currentTime - want) > 0.03) v.currentTime = want;
    }
  });
};
E.pauseVideos = function () { for (var k in VID) if (!VID[k].el.paused) VID[k].el.pause(); };
E.pruneVideos = function () { for (var k in VID) if (!E.clipById(k)) { VID[k].el.removeAttribute('src'); VID[k].el.load(); delete VID[k]; } };
/* Frame-exact seek for export: resolves when every active video shows frame T (ms: give up waiting after this long). */
E.seekVideos = function (T, ms) {
  var jobs = [];
  E.proj.clips.forEach(function (c) {
    if (c.kind !== 'video' || !E.media[c.media] || !(T >= c.start - 1e-6 && T < c.start + c.dur)) return;
    var v = videoFor(c), target = c['in'] + T - c.start;
    if (v.readyState >= 2 && Math.abs(v.currentTime - target) < 0.0005) return;
    jobs.push(new Promise(function (res) {
      var to = setTimeout(function () { v.removeEventListener('seeked', ok); res(); }, ms || 2500); function ok() { clearTimeout(to); v.removeEventListener('seeked', ok); res(); }
      v.addEventListener('seeked', ok); if (!v.paused) v.pause(); v.currentTime = target;
    }));
  });
  return Promise.all(jobs);
};
/* Make sure every video clip's element has loaded its first frame (export starts from a cold element). */
E.prepVideos = function () {
  var jobs = [];
  E.proj.clips.forEach(function (c) {
    if (c.kind !== 'video' || !E.media[c.media]) return;
    var v = videoFor(c); if (v.readyState >= 2) return;
    jobs.push(new Promise(function (res) {
      var to = setTimeout(function () { v.removeEventListener('loadeddata', ok); res(); }, 10000); function ok() { clearTimeout(to); v.removeEventListener('loadeddata', ok); res(); }
      v.addEventListener('loadeddata', ok);
    }));
  });
  return Promise.all(jobs);
};

/* ---------- what is drawn for a clip, and how big ---------- */
/* Returns { img, w, h (drawn size in img px), k (media px per img px), ox, oy (offset of img centre from media centre, media px), mw, mh (media size), paper, back } */
function sourceOf(c, T, needPaper, withBack) {
  var m = c.media ? E.media[c.media] : null, cut = c.cut, r;
  if (c.kind === 'text') {
    var tc = E.textCanvas(c);
    if (!needPaper) return { img: tc, w: tc.width, h: tc.height, k: 1, ox: 0, oy: 0, mw: tc.width, mh: tc.height, text: true };
    var pp = paperOf(c, T, tc, 't|' + JSON.stringify(c.text) + E.proj.w, withBack);
    return { img: pp, w: pp.width, h: pp.height, k: 1, ox: 0, oy: 0, mw: tc.width, mh: tc.height, paper: true, back: pp.back, text: true };
  }
  if (!m) return null;
  if (c.kind === 'image') {
    var cw = m.canvas.width, ch = m.canvas.height;
    if (!needPaper) return { img: m.canvas, w: cw, h: ch, k: 1, ox: 0, oy: 0, mw: cw, mh: ch };
    var sj = E.subjectOf(m, cut.rm), nb = sj.nb || { x: 0, y: 0, w: 1, h: 1 }, pa = paperOf(c, T, sj, 'i|' + E.rmKey(m, cut.rm), withBack);
    return { img: pa, w: pa.width, h: pa.height, k: cw * nb.w / sj.width, ox: ((nb.x + nb.w / 2) - 0.5) * cw, oy: ((nb.y + nb.h / 2) - 0.5) * ch, mw: cw, mh: ch, paper: true, back: pa.back };
  }
  if (c.kind === 'video') {
    var v = videoFor(c), vw = m.w, vh = m.h;
    if (!needPaper) return v.readyState >= 2 ? { img: v, w: vw, h: vh, k: 1, ox: 0, oy: 0, mw: vw, mh: vh, video: true } : null;
    var s = Math.min(1, 720 / Math.max(vw, vh)), sw = Math.round(vw * s), sh = Math.round(vh * s), rk = sw + 'x' + sh;
    var rect = RECTS[rk]; if (!rect) { rect = RECTS[rk] = mkCanvas(sw, sh); var rx = rect.getContext('2d'); rx.fillStyle = '#fff'; rx.fillRect(0, 0, sw, sh); }
    var pf = paperOf(c, T, rect, 'v|' + rk, withBack, { noArt: true }), sc = VS[c.id];
    if (!sc || sc.width !== pf.width || sc.height !== pf.height) sc = VS[c.id] = mkCanvas(pf.width, pf.height);
    var x = sc.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, sc.width, sc.height); x.drawImage(pf, 0, 0);
    if (v.readyState >= 2) { x.save(); x.shadowColor = 'rgba(0,0,0,.38)'; x.shadowBlur = 5 * (sw / 800 > 1 ? sw / 800 : 1); x.shadowOffsetY = 2; x.drawImage(v, pf.pad, pf.pad, sw, sh); x.restore(); }
    x.globalCompositeOperation = 'destination-in'; x.drawImage(pf, 0, 0); x.globalCompositeOperation = 'source-over';
    sc.pad = pf.pad; sc.back = pf.back;
    return { img: sc, w: sc.width, h: sc.height, k: vw / sw, ox: 0, oy: 0, mw: vw, mh: vh, paper: true, back: pf.back, video: true };
  }
  return null;
}
E.needsPaper = function (c, st) { return !!(c.kind !== 'audio' && (c.cut.on || (st && st.fold))); };
function baseScale(c, src, w, h) {
  if (c.kind === 'text') return w / (E.proj.w * TS);
  var fill = c.tf.fit === 'fill';
  return fill ? Math.max(w / src.mw, h / src.mh) : Math.min(w / src.mw, h / src.mh);
}
/* Box the clip occupies on a w x h frame, for the on-canvas handles: centre, size, rotation (static transform only). */
E.boxOf = function (c, w, h, T) {
  var lt = T == null ? E.localT(c) : T - c.start;
  var frame = scriptedFrame(c, T);
  c = scriptedClip(c, frame);
  var needPaper = c.cut.on, src;
  try { src = sourceOf(c, c.start, needPaper, false); } catch (e) { src = null; }
  if (!src) { var m = c.media && E.media[c.media]; if (!m) return null; src = { w: m.w || 100, h: m.h || 100, k: 1, ox: 0, oy: 0, mw: m.w || 100, mh: m.h || 100, img: null }; }
  var tf = E.tfAt(c, lt);
  if (frame && frame.transform) { tf.x = frame.transform.x; tf.y = frame.transform.y; tf.s = frame.transform.scale; tf.r = frame.transform.rotation; tf.o = frame.transform.opacity; }
  var s = baseScale(c, src, w, h) * tf.s, rot = tf.r * PI / 180;
  var ox = src.ox * s * (tf.fx ? -1 : 1), oy = src.oy * s * (tf.fy ? -1 : 1), cr = Math.cos(rot), sr = Math.sin(rot);
  var padPx = src.paper && src.img && src.img.pad ? src.img.pad : 0;
  return { cx: w / 2 + tf.x * w + ox * cr - oy * sr, cy: h / 2 + tf.y * h + ox * sr + oy * cr, bw: (src.w - padPx * 2) * src.k * s, bh: (src.h - padPx * 2) * src.k * s, rot: rot };
};

function scriptedFrame(c, T) {
  var timelineTime = T == null ? E.t : T, lt = timelineTime - c.start, values = Object.create(null), local = E.runClipScriptFrame ? E.runClipScriptFrame(c, lt) : null, project = E.runProjectScriptFrame ? E.runProjectScriptFrame(c, timelineTime) : null;
  if (local && local.scriptedValues) Object.keys(local.scriptedValues).forEach(function (id) { values[id] = local.scriptedValues[id]; });
  if (project && project.scriptedValues) Object.keys(project.scriptedValues).forEach(function (id) { values[id] = project.scriptedValues[id]; });
  if (!Object.keys(values).length) return null;
  var frame = E.evaluateProperties(c, lt, values); frame.scriptedValues = values; return frame;
}
function scriptedClip(c, frame) {
  return E.applyScriptedProperties ? E.applyScriptedProperties(c, frame) : c;
}

function drawBG(ctx, w, h, T) {
  var b = E.proj.bg;
  if (b.type === 'color') { ctx.fillStyle = b.color; ctx.fillRect(0, 0, w, h); } else M.drawBG(ctx, w, h, T, b.type);
}
function tearPath(ctx, hw, hh, e, edge) {
  var x0 = -hw * 1.08 + e * hw * 2.16, pts = [], n = 48, i, y;
  for (i = 0; i <= n; i++) { y = -hh * 1.05 + i / n * hh * 2.1; pts.push([x0 + K.fbm(y * 0.03, e * 2.7, 17) * hh * 0.1 + K.vnoise(y * 0.35, 3, 9) * hh * 0.012, y]); }
  ctx.beginPath(); ctx.moveTo(-hw * 1.3, -hh * 1.1);
  for (i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineTo(-hw * 1.3, hh * 1.1); ctx.closePath();
  if (edge) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
}

function drawClip(ctx, w, h, c, T) {
  var lt = T - c.start, frame = scriptedFrame(c, T);
  c = scriptedClip(c, frame);
  var st = animState(c, lt), tf = E.tfAt(c, lt), cut = c.cut;
  if (frame && frame.transform) { tf.x = frame.transform.x; tf.y = frame.transform.y; tf.s = frame.transform.scale; tf.r = frame.transform.rotation; tf.o = frame.transform.opacity; }
  var needPaper = E.needsPaper(c, st), src = sourceOf(c, T, needPaper, !!st.fold);
  if (!src) return;
  var base = baseScale(c, src, w, h), s = base * tf.s * st.s;
  var alpha = clamp(tf.o * st.a, 0, 1), rot = tf.r * PI / 180 + st.rot;
  if (alpha < 0.002 || s <= 0) return;
  var cx = w / 2 + (tf.x + st.dx) * w, cy = h / 2 + (tf.y + st.dy) * h, fxm = tf.fx ? -1 : 1, fym = tf.fy ? -1 : 1;
  var cr = Math.cos(rot), sr = Math.sin(rot), ox = src.ox * s * st.sx * fxm, oy = src.oy * s * st.sy * fym;
  var sd = cut.shadow, bl = cut.shBlur;
  if (st.fold && src.paper && M.foldDraw) {
    var fo = c.anim.fold, tail = st.fold.tail || 0, target = ctx, lay = null;
    if (alpha < 0.999) { lay = layerCanvas(w, h); target = lay.getContext('2d'); }
    M.foldDraw(target, w, h, {
      img: src.img, back: src.back || src.img, p: st.fold.p, dir: st.fold.dir, tc: st.fold.tc, T: st.fold.T, C: fo.cols, R: fo.rows, dirKey: fo.dir, over: fo.over / 100, bend: fo.bend, distort: 0, tilt: fo.tilt,
      crease: fo.crease / 100 * (1 - K.smooth(0, 0.8, tail)), sc: s * src.k, rot: rot, cx: cx + ox * cr - oy * sr, cy: cy + ox * sr + oy * cr, flipX: tf.fx, flipY: tf.fy, shadow: sd, shBlur: bl
    });
    if (lay) { ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lay, 0, 0); ctx.restore(); }
    return;
  }
  var img = src.img, iw = src.video && !src.paper ? src.w : img.width, ih = src.video && !src.paper ? src.h : img.height;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(fxm * st.sx, fym * st.sy); ctx.scale(s, s); ctx.translate(src.ox, src.oy); ctx.scale(src.k, src.k);
  if (src.paper && sd > 0) {
    var ds = s * src.k;
    ctx.shadowColor = 'rgba(0,0,0,' + (0.25 + Math.min(0.35, sd / 150)).toFixed(2) + ')'; ctx.shadowBlur = bl * ds; ctx.shadowOffsetX = sd * 0.35 * ds; ctx.shadowOffsetY = sd * 0.55 * ds;
  }
  if (st.tear >= 0 && st.tear < 1) { tearPath(ctx, iw / 2, ih / 2, st.tear, false); ctx.clip(); }
  ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  if (st.tear > 0 && st.tear < 1) {
    ctx.shadowColor = 'transparent'; tearPath(ctx, iw / 2, ih / 2, st.tear, true); ctx.strokeStyle = 'rgba(255,251,240,.95)'; ctx.lineWidth = Math.max(2, ih * 0.012); ctx.lineJoin = 'round'; ctx.stroke();
  }
  ctx.restore();
}

/* Draw the project at time T into ctx (w x h pixels). */
E.render = function (ctx, w, h, T) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowColor = 'rgba(0,0,0,0)';
  drawBG(ctx, w, h, T);
  var rows = E.proj.rows;
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i]; if (r.kind !== 'v' || r.hide) continue;
    var c = E.clipAt(r.id, T); if (c) drawClip(ctx, w, h, c, T);
  }
};
/* Topmost clip under a point of the w x h frame, or null. */
E.hitTest = function (px, py, w, h, T) {
  var rows = E.proj.rows;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]; if (r.kind !== 'v' || r.hide) continue;
    var c = E.clipAt(r.id, T); if (!c) continue;
    var b = E.boxOf(c, w, h, T); if (!b) continue;
    var dx = px - b.cx, dy = py - b.cy, cr = Math.cos(-b.rot), sr = Math.sin(-b.rot), lx = dx * cr - dy * sr, ly = dx * sr + dy * cr;
    if (Math.abs(lx) <= b.bw / 2 && Math.abs(ly) <= b.bh / 2) return c;
  }
  return null;
};

/* ---------- transport ---------- */
E.play = function () {
  var end = E.end(); if (E.playing || end <= 0) return;
  if (E.t >= end - 0.03) E.t = 0;
  E.playing = true; E.pt0 = performance.now(); E.pT0 = E.t; E.aud.start(E.t); E.emit('play'); E.emit('time'); E.dirty();
};
E.pause = function () {
  if (!E.playing) return;
  E.playing = false; E.aud.stop(); E.pauseVideos(); E.emit('play'); E.dirty();
};
E.toggle = function () { if (E.playing) E.pause(); else E.play(); };
E.seek = function (t) {
  t = clamp(t, 0, Math.max(0, E.end()));
  E.t = t;
  if (E.playing) { E.pt0 = performance.now(); E.pT0 = t; E.aud.start(t); }
  E.emit('time'); E.dirty();
};
E.tick = function (now) {
  if (!E.playing) return;
  var t = E.pT0 + (now - E.pt0) / 1000, end = E.end();
  if (t >= end) { E.t = end; E.pause(); E.emit('time'); E.emit('ended'); return; }
  E.t = t; E.emit('time'); E.dirty();
};
E.on('project', function () { if (E.playing) { if (E.end() <= 0) E.pause(); } E.pruneVideos(); if (E.t > E.end()) { E.t = E.end(); E.emit('time'); } });
})();
