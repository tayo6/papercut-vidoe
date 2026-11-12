(function () {
'use strict';
/* Bar above the timeline for the selected clip: typed Start, End, Duration, Trim in and Trim out, and keyframe controls for position, scale, rotation and opacity. */
var K = window.__snip, E = K.E, U = E.ui, h = U.h, $ = U.$;
var empty = $('tbEmpty'), gT = $('tbTime'), gK = $('tbKf'), syncs = [];

/* ---------- a box you type a time into: 12.5, 1:05 or 1:05.25 ---------- */
/* Enter or leaving the box applies it, Esc puts the old value back, Up and Down nudge by 0.1 s (Shift: 1 s). */
function timeBox(o) {
  var inp = h('input', { type: 'text', class: 'tbox', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': o.l + ' (minutes:seconds.hundredths)', placeholder: '0:00.00' });
  var wrap = h('label', { class: 'tb-t', title: o.tip || '' }, [h('span', { text: o.l }), inp]);
  function show() {
    var c = E.selClip(); if (!c) return;
    wrap.hidden = !!(o.only && !o.only(c)); if (wrap.hidden || document.activeElement === inp) return;
    inp.value = E.fmtT(o.get(c));
  }
  function apply() {
    var c = E.selClip(); if (!c) return; var v = E.parseTime(inp.value);
    if (v == null) { E.emit('toast', 'Type a time like 12.5, 1:05 or 1:05.25.'); inp.value = E.fmtT(o.get(c)); return; }
    o.set(c, v);
    var q = E.selClip(); if (!q) return;
    var got = o.get(q);
    if (Math.abs(got - v) > 0.011) E.emit('toast', o.l + ' set to ' + E.fmtT(got) + ', the closest time that fits.');
    inp.value = E.fmtT(got); if (o.seek) E.seek(o.seek(q));
  }
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); apply(); inp.select(); }
    else if (e.key === 'Escape') { var c = E.selClip(); if (c) inp.value = E.fmtT(o.get(c)); inp.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); var c2 = E.selClip(); if (!c2) return;
      var cur = E.parseTime(inp.value); if (cur == null) cur = o.get(c2);
      inp.value = E.fmtT(Math.max(0, cur + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 1 : 0.1))); apply();
    }
    e.stopPropagation(); /* keep Space, S and Delete from reaching the editor shortcuts while typing */
  });
  inp.addEventListener('change', apply);
  inp.addEventListener('focus', function () { setTimeout(function () { try { inp.select(); } catch (er) { /* fine */ } }, 0); });
  inp.addEventListener('blur', show);
  syncs.push(show);
  return wrap;
}
var isSrc = function (c) { return (c.kind === 'video' || c.kind === 'audio') && !!(c.media && E.media[c.media]); };
var endSeek = function (q) { return Math.max(q.start, q.start + q.dur - 0.034); };
gT.appendChild(timeBox({ l: 'Start', tip: 'Where the clip begins on the timeline', get: function (c) { return c.start; }, set: function (c, v) { E.setStart(c.id, v); }, seek: function (q) { return q.start; } }));
gT.appendChild(timeBox({ l: 'End', tip: 'Where the clip ends on the timeline', get: function (c) { return c.start + c.dur; }, set: function (c, v) { E.setEnd(c.id, v); }, seek: endSeek }));
gT.appendChild(timeBox({ l: 'Length', tip: 'How long the clip lasts', get: function (c) { return c.dur; }, set: function (c, v) { E.setDuration(c.id, v); E.commit(); }, seek: endSeek }));
gT.appendChild(timeBox({ l: 'Trim in', tip: 'Where in the source the clip starts playing', only: isSrc, get: function (c) { return c['in']; }, set: function (c, v) { E.setSourceRange(c.id, v, null); }, seek: function (q) { return q.start; } }));
gT.appendChild(timeBox({ l: 'Trim out', tip: 'Where in the source the clip stops playing', only: isSrc, get: function (c) { return c['in'] + c.dur; }, set: function (c, v) { E.setSourceRange(c.id, null, v); }, seek: endSeek }));

/* ---------- keyframes ---------- */
var GROUPS = [['Position', ['x', 'y']], ['Scale', ['s']], ['Rotate', ['r']], ['Opacity', ['o']]];
gK.appendChild(h('span', { class: 'tb-lab', text: 'Keyframes' }));
GROUPS.forEach(function (g) {
  var b = h('button', { class: 'kfc', type: 'button', html: U.kfIcon(13) + '<span>' + g[0] + '</span>' });
  b.addEventListener('click', function () { var c = E.selClip(); if (c) E.toggleKf(c, g[1], E.localT(c)); });
  gK.appendChild(b);
  syncs.push(function () {
    var c = E.selClip(); if (!c) return; var lt = E.localT(c);
    var anim = g[1].some(function (p) { return E.isAnimated(c, p); }), here = g[1].every(function (p) { return E.kfIndex(c, p, lt) >= 0; });
    var st = here ? 'on' : anim ? 'mid' : 'off', tip = st === 'on' ? 'Remove the ' + g[0].toLowerCase() + ' keyframe at the playhead' : 'Add a ' + g[0].toLowerCase() + ' keyframe at the playhead';
    b.setAttribute('data-st', st); b.setAttribute('aria-pressed', String(st === 'on')); b.title = tip; b.setAttribute('aria-label', tip);
  });
});
function jump(dir) {
  var c = E.selClip(); if (!c) return; var lt = E.localT(c), ts = E.kfTimes(c).filter(function (t) { return t >= 0 && t <= c.dur + 1e-6; }), to = null, i;
  if (dir < 0) { for (i = ts.length - 1; i >= 0; i--) if (ts[i] < lt - E.KF_EPS) { to = ts[i]; break; } }
  else { for (i = 0; i < ts.length; i++) if (ts[i] > lt + E.KF_EPS) { to = ts[i]; break; } }
  if (to == null) { E.emit('toast', dir < 0 ? 'No earlier keyframe.' : 'No later keyframe.'); return; }
  E.pause(); E.seek(c.start + to);
}
var prev = h('button', { class: 'kfn', type: 'button', title: 'Previous keyframe', 'aria-label': 'Previous keyframe', text: '‹' });
var next = h('button', { class: 'kfn', type: 'button', title: 'Next keyframe', 'aria-label': 'Next keyframe', text: '›' });
prev.addEventListener('click', function () { jump(-1); }); next.addEventListener('click', function () { jump(1); });
gK.appendChild(prev); gK.appendChild(next);
var ease = h('select', { class: 'es kfe', 'aria-label': 'How keyframes at the playhead ease into the next one', title: 'Easing from the keyframe at the playhead to the next one (also used for new keyframes)' },
  [['ease', 'Smooth'], ['lin', 'Linear'], ['hold', 'Hold']].map(function (q) { return h('option', { value: q[0], text: q[1] }); }));
ease.addEventListener('change', function () { var c = E.selClip(); if (c) E.setKfEase(c, E.localT(c), ease.value); });
gK.appendChild(ease);
var clear = h('button', { class: 'kfx', type: 'button', title: 'Stop animating this clip (keeps the values at the playhead)', 'aria-label': 'Clear all keyframes', text: 'Clear' });
clear.addEventListener('click', function () { var c = E.selClip(); if (c) E.clearKf(c, E.KF_PARAMS, E.localT(c)); });
gK.appendChild(clear);
syncs.push(function () {
  var c = E.selClip(); if (!c) return; var any = E.hasKf(c);
  clear.hidden = !any; prev.disabled = next.disabled = !any;
  if (document.activeElement !== ease) { var lt = E.localT(c), e0 = null; E.KF_PARAMS.forEach(function (p) { var i = E.kfIndex(c, p, lt); if (i >= 0 && e0 == null) e0 = c.kf[p][i].e; }); ease.value = e0 || E.kfEase; }
});

/* ---------- keep it in step with the selection and the playhead ---------- */
function refresh() {
  var c = E.selClip();
  empty.hidden = !!c; gT.hidden = !c; gK.hidden = !c || c.kind === 'audio';
  if (c) for (var i = 0; i < syncs.length; i++) syncs[i]();
}
var soon = U.raf1(refresh);
E.on('sel', refresh); E.on('project', refresh); E.on('opened', refresh);
E.on('time', soon); E.on('live', soon);
refresh();
})();
