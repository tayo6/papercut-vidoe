(function () {
'use strict';
/* Video editor properties panel: transform, cut-out, animation, audio and text settings for the selected clip, project settings otherwise. */
var K = window.__snip, E = K.E, U = E.ui, h = U.h, $ = U.$, clamp = K.clamp;
var I = U.insp = {}, bound = [], uid = 0, tabName = 'basic', curKey = '', lastSel = null, lastTab = null, lastKind = null, building = false;

function gp(o, p) { var a = p.split('.'), v = o; for (var i = 0; i < a.length && v != null; i++) v = v[a[i]]; return v; }
function sp(o, p, val) { var a = p.split('.'), v = o; for (var i = 0; i < a.length - 1; i++) v = v[a[i]]; v[a[a.length - 1]] = val; }
function sec(t) { return h('div', { class: 'sec', text: t }); }
function hint(t) { return h('p', { class: 'hint', text: t }); }
function after(o, final) { U.live(); if (o.st) E.emit('project'); else if (o.kf && final) E.emit('project'); /* a new keyframe may have been added: redraw the timeline diamonds */ if (o.aud && final) E.emit('audio'); }
function round(x, d) { var k = Math.pow(10, d); return Math.round(x * k) / k; }

/* ---------- controls (each registers a sync function that reads the selected clip) ---------- */
function rng(o) {
  var sc = o.sc || 1, st = o.step * sc, dec = o.dec != null ? o.dec : (st >= 1 ? 0 : st >= 0.1 ? 1 : 2), id = 'ip' + (++uid), lo = round(o.min * sc, 4), hi = round(o.max * sc, 4);
  var inp = h('input', { type: 'range', id: id, min: lo, max: hi, step: round(st, 4) }), num = h('input', { type: 'number', class: 'num', min: lo, max: hi, step: round(st, 4), 'aria-label': o.l });
  function show() {
    var c = E.selClip(); if (!c) return; var v = o.property ? E.getProperty(c, o.property, E.localT(c)) : (o.kf ? E.tfAt(c, E.localT(c))[o.kf] : gp(c, o.p)); if (v == null) return; var x = v * sc;
    if (document.activeElement !== inp) inp.value = x; if (document.activeElement !== num) num.value = round(x, dec).toFixed(dec);
  }
  function write(x, final) { var c = E.selClip(); if (!c) return; var v = clamp(x, lo, hi) / sc; if (o.property) E.setProperty(c, o.property, v, { time: E.localT(c) }); else if (o.kf) E.setTf(c, o.kf, v, E.localT(c)); else sp(c, o.p, v); after(o, final); }
  inp.addEventListener('input', function () { write(+inp.value, false); num.value = round(+inp.value, dec).toFixed(dec); });
  inp.addEventListener('change', function () { write(+inp.value, true); E.commit(); });
  num.addEventListener('change', function () { var v = parseFloat(num.value); if (isNaN(v)) { show(); return; } write(clamp(v, lo, hi), true); E.commit(); show(); });
  bound.push(show); show();
  if (o.kf) return h('div', { class: 'pr kf' }, [h('label', { for: id, text: o.l }), inp, num, kfBtn(o.kf, o.l)]);
  return h('div', { class: 'pr' }, [h('label', { for: id, text: o.l }), inp, num]);
}
/* Keyframe diamond for one parameter: hollow = not animated, dotted = animated but no keyframe at the playhead, solid = keyframe here (click removes it). */
function kfBtn(p, label) {
  var b = h('button', { class: 'kfb', type: 'button', html: U.kfIcon(14) });
  b.addEventListener('click', function () { var c = E.selClip(); if (c) E.toggleKf(c, [p], E.localT(c)); });
  bound.push(function () {
    var c = E.selClip(); if (!c) return;
    var st = !E.isAnimated(c, p) ? 'off' : E.kfIndex(c, p, E.localT(c)) >= 0 ? 'on' : 'mid';
    b.setAttribute('data-st', st); b.setAttribute('aria-pressed', String(st === 'on'));
    var t = st === 'off' ? 'Add a keyframe for ' + label + ' at the playhead' : st === 'on' ? 'Remove the ' + label + ' keyframe at the playhead' : 'Add a ' + label + ' keyframe at the playhead';
    b.title = t; b.setAttribute('aria-label', t);
  }); bound[bound.length - 1]();
  return b;
}
function selc(o) {
  var id = 'ip' + (++uid), s = h('select', { class: 'es', id: id }, o.opts.map(function (q) { return h('option', { value: q[0], text: q[1] }); }));
  s.addEventListener('change', function () { var c = E.selClip(); if (!c) return; sp(c, o.p, o.num ? +s.value : s.value); after(o, true); E.commit(); });
  bound.push(function () { var c = E.selClip(); if (c) s.value = String(gp(c, o.p)); }); bound[bound.length - 1]();
  return h('div', { class: 'pr one' }, [h('label', { for: id, text: o.l }), s]);
}
function colr(o) {
  var id = 'ip' + (++uid), i = h('input', { type: 'color', id: id });
  i.addEventListener('input', function () { var c = E.selClip(); if (!c) return; sp(c, o.p, i.value); after(o, false); });
  i.addEventListener('change', function () { E.commit(); });
  bound.push(function () { var c = E.selClip(); if (c) { var v = gp(c, o.p); if (/^#[0-9a-f]{6}$/i.test(v) && document.activeElement !== i) i.value = v; } }); bound[bound.length - 1]();
  var kids = [h('label', { for: id, text: o.l }), h('div', { class: 'sw-row' }, [i].concat((o.sw || []).map(function (col) {
    return h('button', { class: 'sw', type: 'button', style: { background: col }, 'aria-label': 'Set ' + o.l + ' to ' + col, onclick: function () { var c = E.selClip(); if (!c) return; sp(c, o.p, col); i.value = col; after(o, true); E.commit(); } });
  })))];
  return h('div', { class: 'pr one' }, kids);
}
function chk(o) {
  var i = h('input', { type: 'checkbox' }), lab = h('label', { class: 'tog' }, [i, h('span', { text: o.l })]);
  i.addEventListener('change', function () { var c = E.selClip(); if (!c) return; sp(c, o.p, i.checked); after(o, true); E.commit(); });
  bound.push(function () { var c = E.selClip(); if (c) i.checked = !!gp(c, o.p); }); bound[bound.length - 1]();
  return lab;
}
function seg(o) {
  var w = h('div', { class: 'seg', role: 'group', 'aria-label': o.l }), bs = o.opts.map(function (q) {
    var b = h('button', { type: 'button', text: q[1], 'aria-pressed': 'false' });
    b.addEventListener('click', function () { var c = E.selClip(); if (!c) return; sp(c, o.p, q[0]); after(o, true); E.commit(); sync(); }); w.appendChild(b); return b;
  });
  bound.push(function () { var c = E.selClip(); if (!c) return; var v = gp(c, o.p); bs.forEach(function (b, k) { b.setAttribute('aria-pressed', String(o.opts[k][0] === v)); }); }); bound[bound.length - 1]();
  return h('div', { class: 'pr one' }, [h('label', { text: o.l }), w]);
}
function sb(text, fn, pressed) { var b = h('button', { class: 'sb', type: 'button', text: text, onclick: fn }); if (pressed != null) b.setAttribute('aria-pressed', String(pressed)); return b; }
function kv(k, v) { var b = h('b', { text: v }); return [h('div', { class: 'kv' }, [h('span', { text: k }), b]), b]; }
var SWATCH = K.PAPER_COLORS;

/* ---------- tabs ---------- */
function tabBasic(c, b) {
  b.appendChild(sec('Position and size'));
  b.appendChild(rng({ l: 'Scale', p: 'tf.s', kf: 's', property: 'transform.scale', min: 0.05, max: 4, step: 0.01, sc: 100, dec: 0 }));
  b.appendChild(rng({ l: 'Position X', p: 'tf.x', kf: 'x', property: 'transform.x', min: -1, max: 1, step: 0.005, sc: 100, dec: 1 }));
  b.appendChild(rng({ l: 'Position Y', p: 'tf.y', kf: 'y', property: 'transform.y', min: -1, max: 1, step: 0.005, sc: 100, dec: 1 }));
  b.appendChild(rng({ l: 'Rotate', p: 'tf.r', kf: 'r', property: 'transform.rotation', min: -180, max: 180, step: 1, dec: 0 }));
  if (c.kind !== 'text') b.appendChild(seg({ l: 'Fit', p: 'tf.fit', opts: [['fit', 'Fit'], ['fill', 'Fill']] }));
  var fx = sb('Flip horizontal', function () { var q = E.selClip(); if (q) { q.tf.fx = !q.tf.fx; U.live(); E.commit(); sync(); } }), fy = sb('Flip vertical', function () { var q = E.selClip(); if (q) { q.tf.fy = !q.tf.fy; U.live(); E.commit(); sync(); } });
  b.appendChild(h('div', { class: 'btn-row' }, [fx, fy, sb('Reset', function () { var q = E.selClip(); if (!q) return; var f = q.tf.fit; q.tf = E.defTf(); q.tf.fit = f; q.kf = E.defKf(); U.live(); E.commit(); E.emit('project'); sync(); })]));
  bound.push(function () { var q = E.selClip(); if (q) { fx.setAttribute('aria-pressed', String(!!q.tf.fx)); fy.setAttribute('aria-pressed', String(!!q.tf.fy)); } });
  b.appendChild(sec('Blend'));
  b.appendChild(rng({ l: 'Opacity', p: 'tf.o', kf: 'o', property: 'transform.opacity', min: 0, max: 1, step: 0.01, sc: 100, dec: 0 }));
  b.appendChild(hint('The diamond animates a setting: move the playhead, change the value, and it keyframes itself.'));
  b.appendChild(sec('Timing'));
  b.appendChild(durCtl());
  if (c.kind === 'video' || c.kind === 'audio') {
    var m = E.media[c.media], a = kv('Plays from', ''), z = kv('Source length', m ? E.fmtS(m.dur) : '');
    b.appendChild(a[0]); b.appendChild(z[0]);
    bound.push(function () { var q = E.selClip(); if (q) a[1].textContent = E.fmtS(q['in']) + ' to ' + E.fmtS(q['in'] + q.dur); });
    b.appendChild(hint('Drag the white handles at the ends of the clip on the timeline to trim it, or press S to split at the playhead.'));
  } else b.appendChild(hint('Drag the end of the clip on the timeline, or set the length here.'));
}
function durCtl() {
  var id = 'ip' + (++uid), inp = h('input', { type: 'range', id: id, step: 0.05 }), num = h('input', { type: 'number', class: 'num', step: 0.1, min: E.MIN, 'aria-label': 'Duration in seconds' });
  function maxDur(c) {
    var m = c.media && E.media[c.media], nb = E.neighbours(c), src = (c.kind === 'video' || c.kind === 'audio') && m, mx = Math.min(nb.hi - c.start, src ? m.dur - c['in'] : Infinity);
    return isFinite(mx) ? Math.max(mx, c.dur) : Math.max(30, c.dur);
  }
  function show() { var c = E.selClip(); if (!c) return; inp.min = E.MIN; inp.max = maxDur(c); if (document.activeElement !== inp) inp.value = c.dur; if (document.activeElement !== num) num.value = c.dur.toFixed(2); }
  inp.addEventListener('input', function () { var c = E.selClip(); if (c) { E.setDuration(c.id, +inp.value); num.value = c.dur.toFixed(2); } });
  inp.addEventListener('change', function () { E.commit(); });
  num.addEventListener('change', function () { var c = E.selClip(); if (c) { E.setDuration(c.id, parseFloat(num.value) || c.dur); E.commit(); show(); } });
  bound.push(show); show();
  return h('div', { class: 'pr' }, [h('label', { for: id, text: 'Duration' }), inp, num]);
}

function tabCut(c, b) {
  b.appendChild(chk({ l: 'Turn into paper cut-out', p: 'cut.on', st: true }));
  if (!c.cut.on) { b.appendChild(hint(c.kind === 'text' ? 'Cuts the letters out of paper with a torn or scissor-cut edge.' : c.kind === 'video' ? 'Gives the video a cut-paper frame with a torn or scissor-cut edge.' : 'Cuts the subject out of the photo and mounts it on paper with a torn or scissor-cut edge.')); b.appendChild(sec('Quick looks')); b.appendChild(looksRow()); return; }
  b.appendChild(sec('Quick looks')); b.appendChild(looksRow());
  b.appendChild(sec('Paper'));
  b.appendChild(selc({ l: 'Cut style', p: 'cut.style', opts: [['torn', 'Torn paper'], ['scissors', 'Scissor cut'], ['pinking', 'Pinking shears'], ['deckle', 'Deckle edge']] }));
  b.appendChild(selc({ l: 'Texture', p: 'cut.tex', opts: [['plain', 'Plain colour'], ['cardstock', 'Cardstock'], ['kraft', 'Kraft'], ['newsprint', 'Newsprint'], ['notebook', 'Notebook'], ['graph', 'Graph paper'], ['parchment', 'Parchment'], ['cardboard', 'Cardboard']] }));
  b.appendChild(colr({ l: 'Paper colour', p: 'cut.color', sw: SWATCH }));
  b.appendChild(rng({ l: 'Edge width', p: 'cut.edge', min: 0, max: 40, step: 1 }));
  b.appendChild(rng({ l: 'Roughness', p: 'cut.rough', min: 0, max: 100, step: 1 }));
  b.appendChild(rng({ l: 'Detail', p: 'cut.detail', min: 10, max: 100, step: 1 }));
  b.appendChild(rng({ l: 'Paper grain', p: 'cut.grain', min: 0, max: 100, step: 1 }));
  b.appendChild(sec('Shadow'));
  b.appendChild(rng({ l: 'Shadow', p: 'cut.shadow', min: 0, max: 60, step: 1 }));
  b.appendChild(rng({ l: 'Blur', p: 'cut.shBlur', min: 0, max: 40, step: 1 }));
  b.appendChild(sec('Stop-motion boil'));
  b.appendChild(rng({ l: 'Boil', p: 'cut.boil', min: 0, max: 10, step: 1 }));
  b.appendChild(rng({ l: 'Boil rate', p: 'cut.boilFps', min: 2, max: 24, step: 1 }));
  b.appendChild(rng({ l: 'Drawings', p: 'cut.boilLoop', min: 2, max: 8, step: 1 }));
  if (c.kind === 'image') {
    b.appendChild(sec('Background removal'));
    b.appendChild(chk({ l: 'Remove the photo background', p: 'cut.rm.on', st: true }));
    if (c.cut.rm.on) {
      b.appendChild(rng({ l: 'Tolerance', p: 'cut.rm.tol', min: 5, max: 140, step: 1 }));
      b.appendChild(rng({ l: 'Smooth edge', p: 'cut.rm.feather', min: 0, max: 6, step: 1 }));
      var n = c.cut.rm.wands.length;
      b.appendChild(h('div', { class: 'btn-row' }, [
        sb(U.wand ? 'Done picking' : 'Pick spots to remove', function () { U.setWand(!U.wand); }, U.wand),
        n ? sb('Undo last', function () { var q = E.selClip(); if (q && q.cut.rm.wands.length) { q.cut.rm.wands.pop(); E.dirty(); E.commit(); E.emit('project'); } }) : null,
        n ? sb('Clear', function () { var q = E.selClip(); if (q) { q.cut.rm.wands = []; E.dirty(); E.commit(); E.emit('project'); } }) : null]));
      b.appendChild(hint(U.wand ? 'Click a leftover patch of background on the preview to cut it away.' : 'The corners are removed automatically. Pick spots to cut away patches it missed' + (n ? ' (' + n + ' picked).' : '.')));
    }
  } else if (c.kind === 'video') b.appendChild(hint('Background removal works on photos. Videos keep their picture inside a paper frame.'));
}
function looksRow() {
  var r = h('div', { class: 'pills' }); U.LOOKS.forEach(function (l) { r.appendChild(h('button', { class: 'pill', type: 'button', text: l.name, onclick: function () { var q = E.selClip(); if (!q) return; Object.assign(q.cut, E.clone(l.cut), { on: true }); E.dirty(); E.commit(); E.emit('project'); } })); });
  return r;
}

function animGrid(c, which) {
  var g = h('div', { class: 'an-grid', role: 'group', 'aria-label': which === 'in' ? 'In animation' : which === 'out' ? 'Out animation' : 'Combo animation' });
  E.ANIMS[which].forEach(function (a) {
    var b = h('button', { class: 'an', type: 'button', text: a.name, 'aria-pressed': String(c.anim[which].t === a.id) });
    b.addEventListener('click', function () { var q = E.selClip(); if (!q) return; q.anim[which].t = a.id; if (which !== 'combo' && a.id !== 'none' && q.anim[which].d < 0.3) q.anim[which].d = 0.8; E.dirty(); E.commit(); E.emit('project'); if (a.id !== 'none') U.previewAnim(q, which); });
    g.appendChild(b);
  }); return g;
}

var MOTION_TRACKS = [
  { p: 'x', label: 'Position X', min: -1, max: 1, step: 0.005, dec: 3, viewSpan: 0.5 },
  { p: 'y', label: 'Position Y', min: -1, max: 1, step: 0.005, dec: 3, viewSpan: 0.5 },
  { p: 's', label: 'Scale', min: 0.03, max: 10, step: 0.01, dec: 2, viewSpan: 2 },
  { p: 'r', label: 'Rotation', min: -3600, max: 3600, step: 1, dec: 1, viewSpan: 180 },
  { p: 'o', label: 'Opacity', min: 0, max: 1, step: 0.01, dec: 2, viewSpan: 0.5 }
];
function motionEditor(c) {
  var root = h('div', { class: 'mke' }), lanes = h('div', { class: 'mke-lanes' });
  var detail = h('div', { class: 'mke-detail', 'aria-label': 'Selected keyframe controls' });
  var status = h('p', { class: 'hint mke-status', role: 'status', 'aria-live': 'polite' });
  var selected = null;
  var presetName = h('input', { class: 'ti', type: 'text', maxlength: 48, placeholder: 'e.g. Gentle drift', 'aria-label': 'Motion preset name' });
  var presetSelect = h('select', { class: 'ti', 'aria-label': 'Saved project motion presets' });
  function setStatus(msg) { status.textContent = msg || ''; }
  function currentKey() {
    if (!selected || !c.kf || !c.kf[selected.p]) return null;
    var index = E.kfIndex(c, selected.p, selected.t);
    return index < 0 ? null : { index: index, key: c.kf[selected.p][index] };
  }
  function changed(message) {
    E.emit('project'); E.dirty(); E.commit(); U.live();
    if (message) setStatus(message);
    render();
  }
  function valueDomain(info, keys) {
    if (!keys.length) return { min: info.min, max: info.max };
    var lo = Infinity, hi = -Infinity;
    keys.forEach(function (key) { lo = Math.min(lo, key.v); hi = Math.max(hi, key.v); });
    var centre = (lo + hi) / 2, span = Math.max(info.viewSpan, hi - lo), pad = span * 0.16;
    lo = centre - span / 2 - pad; hi = centre + span / 2 + pad;
    if (lo < info.min) { hi += info.min - lo; lo = info.min; }
    if (hi > info.max) { lo -= hi - info.max; hi = info.max; }
    lo = Math.max(info.min, lo); hi = Math.min(info.max, hi);
    if (hi - lo < 1e-6) return { min: info.min, max: info.max };
    return { min: lo, max: hi };
  }
  function valueY(value, domain) {
    var span = Math.max(1e-6, domain.max - domain.min);
    return 90 - clamp((value - domain.min) / span, 0, 1) * 80;
  }
  function lanePoints(keys, domain) {
    return keys.map(function (key) {
      var x = clamp(key.t / Math.max(0.001, c.dur), 0, 1) * 100;
      return x.toFixed(2) + ',' + valueY(key.v, domain).toFixed(2);
    }).join(' ');
  }
  function renderLanes() {
    lanes.textContent = '';
    MOTION_TRACKS.forEach(function (info) {
      var row = h('div', { class: 'mke-lane' });
      var label = h('span', { class: 'mke-label', text: info.label });
      var track = h('div', { class: 'mke-track', role: 'group', 'aria-label': info.label + ' keyframes',
        title: 'Horizontal position = time. Vertical position = value.' });
      var keys = c.kf && c.kf[info.p] || [];
      var domain = valueDomain(info, keys);
      var graph = h('div', { class: 'mke-graph', 'aria-hidden': 'true' });
      graph.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline class="mke-value-path" points="' + lanePoints(keys, domain) + '" /></svg>';
      var graphPath = graph.querySelector('polyline');
      track.appendChild(graph);
      keys.forEach(function (key) {
        var pct = clamp(key.t / Math.max(0.001, c.dur), 0, 1) * 100;
        var yPct = valueY(key.v, domain);
        var active = selected && selected.p === info.p && Math.abs(selected.t - key.t) <= E.KF_EPS;
        var marker = h('button', { class: 'mke-dot' + (active ? ' active' : ''), type: 'button',
          style: { left: pct + '%', top: yPct + '%' }, title: info.label + ' · ' + key.t.toFixed(2) + 's · ' + key.v,
          'aria-label': 'Select ' + info.label + ' keyframe at ' + key.t.toFixed(2) + ' seconds, value ' + key.v + '. Drag horizontally to retime or vertically to change value.',
          'aria-pressed': String(!!active), html: U.kfIcon(11) });
        var suppressPointerClick = false, laneDrag = null;
        marker.addEventListener('click', function (e) {
          if (suppressPointerClick && e.detail !== 0) { suppressPointerClick = false; return; }
          selected = { p: info.p, t: key.t }; E.pause(); E.seek(c.start + key.t); render();
        });
        marker.addEventListener('pointerdown', function (e) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          var rect = track.getBoundingClientRect(); if (!rect.width || !rect.height) return;
          suppressPointerClick = false;
          laneDrag = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, time: key.t, startTime: key.t, value: key.v,
            rect: rect, domain: domain, moved: false };
          E.pause();
          if (marker.setPointerCapture) { try { marker.setPointerCapture(e.pointerId); } catch (err) {} }
          e.stopPropagation();
        });
        marker.addEventListener('pointermove', function (e) {
          var d = laneDrag; if (!d || d.pid !== e.pointerId) return;
          var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
          if (!d.moved && Math.sqrt(dx * dx + dy * dy) < 4) return;
          d.moved = true;
          var targetTime = Math.round(clamp(d.startTime + (dx / d.rect.width) * c.dur, 0, c.dur) * 100) / 100;
          var got = E.movePropertyKfTime(c, info.p, d.time, targetTime);
          d.time = got;
          var valueSpan = Math.max(1e-6, d.domain.max - d.domain.min);
          var targetValue = d.value - (dy / Math.max(1, d.rect.height * 0.8)) * valueSpan;
          targetValue = Math.round(targetValue / info.step) * info.step;
          targetValue = clamp(Number(targetValue.toFixed(info.dec)), info.min, info.max);
          try { E.setPropertyKfValue(c, info.p, got, targetValue); } catch (err) {}
          marker.style.left = (got / Math.max(0.001, c.dur) * 100) + '%';
          marker.style.top = valueY(targetValue, d.domain) + '%';
          marker.title = info.label + ' · ' + got.toFixed(2) + 's · ' + targetValue;
          marker.setAttribute('aria-label', 'Select ' + info.label + ' keyframe at ' + got.toFixed(2) + ' seconds, value ' + targetValue + '. Drag horizontally to retime or vertically to change value.');
          if (graphPath) graphPath.setAttribute('points', lanePoints(keys, domain));
          E.dirty();
          e.preventDefault();
        });
        function finishLaneDrag(e) {
          var d = laneDrag; if (!d || d.pid !== e.pointerId) return;
          laneDrag = null;
          if (marker.releasePointerCapture && marker.hasPointerCapture && marker.hasPointerCapture(e.pointerId)) {
            try { marker.releasePointerCapture(e.pointerId); } catch (err) {}
          }
          if (!d.moved) return;
          suppressPointerClick = true;
          selected = { p: info.p, t: d.time };
          E.emit('project'); E.dirty(); E.commit();
          render();
          E.seek(c.start + d.time);
        }
        marker.addEventListener('pointerup', finishLaneDrag);
        marker.addEventListener('pointercancel', finishLaneDrag);
        track.appendChild(marker);
      });
      var add = h('button', { class: 'mke-add', type: 'button', text: '+',
        title: 'Add ' + info.label + ' keyframe at the playhead',
        'aria-label': 'Add ' + info.label + ' keyframe at the playhead' });
      add.addEventListener('click', function () {
        try {
          var key = E.addKf(c, info.p, E.localT(c));
          selected = { p: info.p, t: key.t };
          E.pause(); E.seek(c.start + key.t);
          changed('Keyframe added or selected.');
        } catch (err) { setStatus(err.message || String(err)); }
      });
      row.appendChild(label); row.appendChild(track); row.appendChild(add); lanes.appendChild(row);
    });
  }
  function renderDetail() {
    detail.textContent = '';
    var found = currentKey();
    if (!found) {
      detail.appendChild(hint('Select a diamond above or tap + beside a property to add a keyframe at the playhead.'));
      return;
    }
    var info = MOTION_TRACKS.filter(function (x) { return x.p === selected.p; })[0];
    var key = found.key, idx = found.index;
    var time = h('input', { class: 'num', type: 'number', min: 0, max: c.dur, step: 0.01, 'aria-label': 'Keyframe time in seconds' });
    time.value = key.t.toFixed(2);
    var value = h('input', { class: 'num', type: 'number', min: info.min, max: info.max, step: info.step, 'aria-label': info.label + ' keyframe value' });
    value.value = String(round(key.v, info.dec));
    var ease = h('select', { class: 'es', 'aria-label': 'Easing to next keyframe' }, [
      h('option', { value: 'ease', text: 'Smooth' }),
      h('option', { value: 'lin', text: 'Linear' }),
      h('option', { value: 'hold', text: 'Hold' }),
      h('option', { value: 'bezier', text: 'Custom Bezier' })
    ]);
    var curvePanel = h('div', { class: 'mke-bezier-panel' });
    var curveView = h('div', { class: 'mke-bezier-curve', role: 'img' });
    var curveInputs = {
      x1: h('input', { class: 'num', type: 'number', min: 0, max: 1, step: 0.01, 'aria-label': 'Bezier first control X' }),
      y1: h('input', { class: 'num', type: 'number', min: -0.25, max: 1.25, step: 0.01, 'aria-label': 'Bezier first control Y' }),
      x2: h('input', { class: 'num', type: 'number', min: 0, max: 1, step: 0.01, 'aria-label': 'Bezier second control X' }),
      y2: h('input', { class: 'num', type: 'number', min: -0.25, max: 1.25, step: 0.01, 'aria-label': 'Bezier second control Y' })
    };
    function curveFor(k) {
      if (k && k.e && typeof k.e === 'object' && k.e.type === 'bezier') return E.normalizeKfEase(k.e);
      return { type: 'bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
    }
    function readCurve() {
      var raw = [curveInputs.x1.value, curveInputs.y1.value, curveInputs.x2.value, curveInputs.y2.value];
      if (raw.some(function (v) { return String(v).trim() === ''; })) throw new Error('Enter four finite Bezier control values.');
      return E.normalizeKfEase({ type: 'bezier', x1: Number(raw[0]), y1: Number(raw[1]), x2: Number(raw[2]), y2: Number(raw[3]) });
    }
    function paintCurve(curve) {
      var points = [];
      for (var i = 0; i <= 40; i++) {
        var x = i / 40, y = E.cubicBezierProgress(curve, x);
        points.push((10 + x * 180).toFixed(2) + ',' + (65 - y * 44).toFixed(2));
      }
      var p1x = 10 + curve.x1 * 180, p1y = 65 - curve.y1 * 44, p2x = 10 + curve.x2 * 180, p2y = 65 - curve.y2 * 44;
      var controls = '<path class="mke-bezier-arms" d="M10 65L' + p1x.toFixed(2) + ' ' + p1y.toFixed(2) + ' M190 21L' + p2x.toFixed(2) + ' ' + p2y.toFixed(2) + '" />' +
        '<circle class="mke-bezier-handle" data-mke-handle="1" cx="' + p1x.toFixed(2) + '" cy="' + p1y.toFixed(2) + '" r="6" />' +
        '<circle class="mke-bezier-handle" data-mke-handle="2" cx="' + p2x.toFixed(2) + '" cy="' + p2y.toFixed(2) + '" r="6" />';
      curveView.innerHTML = '<svg viewBox="0 0 200 78" aria-hidden="true" focusable="false">' +
        '<path class="mke-bezier-chart-grid" d="M10 10H190 M10 43H190 M10 76H190 M10 10V76 M100 10V76 M190 10V76" />' +
        '<path class="mke-bezier-guide" d="M10 65L190 21" />' + controls +
        '<polyline class="mke-bezier-line" points="' + points.join(' ') + '" /></svg>';
      curveView.setAttribute('aria-label', 'Custom cubic Bezier easing curve. Drag either control point or use the four numeric fields.');
    }
    function updateInputs(curve) {
      curveInputs.x1.value = String(curve.x1); curveInputs.y1.value = String(curve.y1);
      curveInputs.x2.value = String(curve.x2); curveInputs.y2.value = String(curve.y2);
    }
    function writeCurve(commit) {
      try {
        var curve = readCurve(), latest = currentKey();
        if (!latest) throw new Error('The selected keyframe no longer exists.');
        E.updateKf(c, selected.p, latest.index, { e: curve });
        E.dirty(); U.live(); paintCurve(curve);
        if (commit) { E.emit('project'); E.commit(); setStatus('Custom Bezier curve updated.'); render(); }
      } catch (err) { setStatus(err.message || String(err)); }
    }
    var curveDrag = 0;
    function curveFromPointer(e) {
      var svg = curveView.querySelector('svg'); if (!svg) return;
      var rect = svg.getBoundingClientRect(); if (!rect.width || !rect.height) return;
      var scale = Math.min(rect.width / 200, rect.height / 78); if (!scale) return;
      var drawW = 200 * scale, drawH = 78 * scale, offsetX = (rect.width - drawW) / 2, offsetY = (rect.height - drawH) / 2;
      var sx = clamp((e.clientX - rect.left - offsetX) / scale, 10, 190);
      var sy = clamp((e.clientY - rect.top - offsetY) / scale, 10, 76);
      var x = Math.round(clamp((sx - 10) / 180, 0, 1) * 1000) / 1000;
      var y = Math.round(clamp((65 - sy) / 44, -0.25, 1.25) * 1000) / 1000;
      curveInputs['x' + curveDrag].value = String(x);
      curveInputs['y' + curveDrag].value = String(y);
      writeCurve(false);
    }
    curveView.addEventListener('pointerdown', function (e) {
      var handle = e.target && e.target.getAttribute && e.target.getAttribute('data-mke-handle');
      if (handle !== '1' && handle !== '2') return;
      curveDrag = Number(handle);
      if (curveView.setPointerCapture) { try { curveView.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault();
    });
    curveView.addEventListener('pointermove', function (e) { if (curveDrag) { curveFromPointer(e); e.preventDefault(); } });
    function endCurveDrag(e) {
      if (!curveDrag) return;
      curveDrag = 0;
      if (curveView.releasePointerCapture && curveView.hasPointerCapture && curveView.hasPointerCapture(e.pointerId)) { try { curveView.releasePointerCapture(e.pointerId); } catch (err) {} }
      writeCurve(true);
    }
    curveView.addEventListener('pointerup', endCurveDrag);
    curveView.addEventListener('pointercancel', endCurveDrag);
    Object.keys(curveInputs).forEach(function (name) { curveInputs[name].addEventListener('change', function () { writeCurve(true); }); });
    function showCurvePanel() {
      var isBezier = ease.value === 'bezier';
      curvePanel.hidden = !isBezier;
      if (isBezier) { var curve = curveFor(key); updateInputs(curve); paintCurve(curve); }
    }
    ease.value = key.e && typeof key.e === 'object' && key.e.type === 'bezier' ? 'bezier' : (key.e || 'ease');
    function save(patch) {
      try {
        var result = E.updateKf(c, selected.p, idx, patch);
        selected.t = result.t;
        changed('Keyframe updated.');
      } catch (err) { setStatus(err.message || String(err)); renderDetail(); }
    }
    time.addEventListener('change', function () { save({ t: Number(time.value) }); });
    value.addEventListener('change', function () { save({ v: Number(value.value) }); });
    ease.addEventListener('change', function () {
      if (ease.value === 'bezier') save({ e: curveFor(key) });
      else save({ e: ease.value });
    });
    var jump = sb('Jump to keyframe', function () { var q = currentKey(); if (q) { E.pause(); E.seek(c.start + q.key.t); } });
    var remove = sb('Delete keyframe', function () {
      var q = currentKey(); if (!q) return;
      E.deleteKf(c, selected.p, q.index); selected = null; changed('Keyframe deleted.');
    });
    detail.appendChild(h('div', { class: 'mke-fields' }, [
      h('div', { class: 'mke-field' }, [h('label', { text: 'Time (seconds)' }), time]),
      h('div', { class: 'mke-field' }, [h('label', { text: info.label + ' value' }), value]),
      h('div', { class: 'mke-field' }, [h('label', { text: 'Easing to next' }), ease])
    ]));
    curvePanel.appendChild(hint('Drag either control point to shape the motion between this keyframe and the next one. Control X is 0–1; control Y is -0.25–1.25.'));
    curvePanel.appendChild(curveView);
    curvePanel.appendChild(h('div', { class: 'mke-bezier-grid' }, [
      h('label', { class: 'mke-field' }, [h('span', { text: 'Control X1' }), curveInputs.x1]),
      h('label', { class: 'mke-field' }, [h('span', { text: 'Control Y1' }), curveInputs.y1]),
      h('label', { class: 'mke-field' }, [h('span', { text: 'Control X2' }), curveInputs.x2]),
      h('label', { class: 'mke-field' }, [h('span', { text: 'Control Y2' }), curveInputs.y2])
    ]));
    curvePanel.appendChild(hint('The curve affects the segment starting at this keyframe. The last keyframe has no following segment.'));
    detail.appendChild(curvePanel);
    detail.appendChild(h('div', { class: 'mke-actions' }, [jump, remove]));
    showCurvePanel();
  }
  function refreshPresets() {
    var old = presetSelect.value, list = E.listMotionPresets ? E.listMotionPresets() : [];
    presetSelect.textContent = '';
    presetSelect.appendChild(h('option', { value: '', text: list.length ? 'Choose a saved motion…' : 'No saved motions yet', disabled: true }));
    list.forEach(function (p) {
      presetSelect.appendChild(h('option', { value: p.id, text: p.name + ' (' + p.keyframes + ' keys)' }));
    });
    presetSelect.value = list.some(function (p) { return p.id === old; }) ? old : '';
  }
  presetSelect.addEventListener('change', function () {
    var item = E.getMotionPreset(presetSelect.value); if (item) presetName.value = item.name;
  });
  var savePreset = sb('Save / update', function () {
    try {
      var item = E.saveMotionPreset(presetName.value, c);
      refreshPresets(); presetSelect.value = item.id;
      E.dirty(); E.emit('project'); E.commit();
      setStatus('Saved "' + item.name + '" to this project. It can be applied to another visual clip.');
    } catch (err) { setStatus(err.message || String(err)); }
  });
  var applyPreset = sb('Apply to clip', function () {
    try {
      if (!presetSelect.value) throw new Error('Choose a saved motion preset first.');
      E.applyMotionPreset(presetSelect.value, c);
      selected = null; changed('Motion preset applied to this clip.');
    } catch (err) { setStatus(err.message || String(err)); }
  });
  var deletePreset = sb('Delete preset', function () {
    if (!presetSelect.value || !E.deleteMotionPreset(presetSelect.value)) return;
    refreshPresets(); E.dirty(); E.emit('project'); E.commit();
    setStatus('Motion preset deleted from this project.');
  });
  function render() { renderLanes(); renderDetail(); refreshPresets(); }
  root.appendChild(lanes);
  root.appendChild(detail);
  root.appendChild(hint('Drag a keyframe horizontally to retime it or vertically to change its value. Select a marker for exact time, value and easing controls.'));
  root.appendChild(h('div', { class: 'mke-presets' }, [
    h('strong', { text: 'Project motion library' }),
    hint('Save these keyframe tracks once, then apply them to other image, video or text clips.'),
    presetName, presetSelect,
    h('div', { class: 'script-actions' }, [savePreset, applyPreset, deletePreset])
  ]));
  root.appendChild(status);
  bound.push(render);
  render();
  return root;
}

function tabAnim(c, b) {
  var a = c.anim, maxD = Math.max(0.2, Math.min(4, c.dur));
  b.appendChild(sec('In')); b.appendChild(animGrid(c, 'in'));
  if (a['in'].t !== 'none') b.appendChild(rng({ l: 'Duration', p: 'anim.in.d', min: 0.1, max: maxD, step: 0.05, st: true, dec: 2 }));
  b.appendChild(sec('Out')); b.appendChild(animGrid(c, 'out'));
  if (a.out.t !== 'none') b.appendChild(rng({ l: 'Duration', p: 'anim.out.d', min: 0.1, max: maxD, step: 0.05, st: true, dec: 2 }));
  b.appendChild(sec('Combo (keeps going)')); b.appendChild(animGrid(c, 'combo'));
  if (a.combo.t !== 'none') b.appendChild(rng({ l: 'Speed', p: 'anim.combo.sp', min: 0.2, max: 3, step: 0.05, dec: 2 }));
  if (a['in'].t === 'unfold' || a.out.t === 'fold') {
    b.appendChild(sec('Paper fold'));
    b.appendChild(selc({ l: 'Opens', p: 'anim.fold.dir', opts: [['lr', 'Left to right'], ['rl', 'Right to left'], ['tb', 'Top to bottom'], ['bt', 'Bottom to top'], ['ctr', 'From the centre']] }));
    b.appendChild(selc({ l: 'Columns', p: 'anim.fold.cols', num: true, opts: [1, 2, 3, 4, 5, 6].map(function (n) { return [n, String(n)]; }) }));
    b.appendChild(selc({ l: 'Rows', p: 'anim.fold.rows', num: true, opts: [1, 2, 3, 4].map(function (n) { return [n, String(n)]; }) }));
    b.appendChild(rng({ l: 'Flap overlap', p: 'anim.fold.over', min: 0, max: 100, step: 1 }));
    b.appendChild(rng({ l: 'Camera tilt', p: 'anim.fold.tilt', min: 0, max: 40, step: 1 }));
    b.appendChild(rng({ l: 'Paper flex', p: 'anim.fold.bend', min: 0, max: 100, step: 1 }));
    b.appendChild(rng({ l: 'Crease marks', p: 'anim.fold.crease', min: 0, max: 100, step: 1 }));
    if (!c.cut.on) b.appendChild(hint('Paper fold uses the cut-out paper, so it is drawn even with the cut-out switched off.'));
  }
  b.appendChild(sec('Keyframe tracks'));
  b.appendChild(hint('Create and edit transform keyframes in separate lanes. Changes update the preview and export.'));
  b.appendChild(motionEditor(c));
  b.appendChild(h('div', { class: 'btn-row' }, [sb('Preview in', function () { var q = E.selClip(); if (q) U.previewAnim(q, 'in'); }), sb('Preview out', function () { var q = E.selClip(); if (q) U.previewAnim(q, 'out'); })]));
}

function tabAudio(c, b) {
  var m = c.media && E.media[c.media];
  b.appendChild(sec('Volume'));
  b.appendChild(rng({ l: 'Volume', p: 'vol', min: 0, max: 2, step: 0.01, sc: 100, dec: 0, aud: true }));
  var fmax = 10;
  b.appendChild(rng({ l: 'Fade in', p: 'fadeIn', min: 0, max: fmax, step: 0.05, dec: 2, aud: true }));
  b.appendChild(rng({ l: 'Fade out', p: 'fadeOut', min: 0, max: fmax, step: 0.05, dec: 2, aud: true }));
  b.appendChild(chk({ l: 'Mute this clip', p: 'mute', aud: true }));
  if (c.kind === 'video' && m && !m.buffer) b.appendChild(hint('Reading the sound of this video\u2026'));
  else if (c.kind === 'video' && m && m.buffer && m.buffer.duration < 0.01) b.appendChild(hint('This video has no sound.'));
  if (c.kind === 'audio') {
    b.appendChild(sec('Timing')); b.appendChild(durCtl());
    var a = kv('Plays from', ''), z = kv('Source length', m ? E.fmtS(m.dur) : ''); b.appendChild(a[0]); b.appendChild(z[0]);
    bound.push(function () { var q = E.selClip(); if (q) a[1].textContent = E.fmtS(q['in']) + ' to ' + E.fmtS(q['in'] + q.dur); });
    b.appendChild(hint('Drag the handles on the ends of the sound clip to trim it.'));
  }
}


function tabScript(c, b) {
  b.appendChild(sec('SnipScript'));
  b.appendChild(hint('Create continuous animations or timed events for this clip. Try pingpong, triangle, pulse, smoothstep and remap for expressive motion; timed tweens support sine, cubic, quart, quint, expo, circ, back, bounce, elastic and custom Bezier easing. Cues run deterministically in preview and export. This is not JavaScript and has no browser or network access.'));
  var ta = h('textarea', { class: 'ti script-code', rows: 10, spellcheck: 'false', 'aria-label': 'SnipScript code' });
  ta.value = c.scriptCode || '';
  var status = h('p', { class: 'hint script-status', role: 'status', 'aria-live': 'polite' });
  status.textContent = c.scriptEnabled ? 'Script is enabled.' : 'Script is disabled. Apply a script to enable it.';
  var example = sb('Insert example', function () {
    if (c.kind === 'audio') {
      ta.value = '# Fade and pulse the clip volume\nat 0s set audio.volume = 0.8\nat 0.5s tween audio.volume = 0.55 over 1s ease inout\nat 2s tween audio.volume = 0.9 over 0.5s ease out';
    } else if (c.kind === 'text') {
      ta.value = '# Animate type size and colour\nat 0s set text.fontSize = 90\nat 0.4s tween text.fontSize = 140 over 0.5s ease out\nset text.color = rgb(255, 190, 65)';
    } else {
      ta.value = '# Float while the paper edge changes\nset transform.y = sin(time * 2) * 0.025\nat 0s set transform.scale = 0.8\nat 0.5s tween transform.scale = 1 over 0.5s ease out\nat 0s set paper.edge = 10\nat 0.6s tween paper.edge = 40 over 0.5s ease inout';
    }
    renderCueList();
    status.textContent = 'Example inserted. Select Check script, then Apply & enable.';
  });
  var check = sb('Check script', function () {
    try {
      var result = E.compileScript(E.selClip() || c, ta.value);
      status.textContent = 'Valid: ' + result.statements + ' statement(s), ' + result.properties.length + ' property target(s).';
    } catch (err) { status.textContent = err.message || String(err); }
  });
  var apply = sb('Apply & enable', function () {
    var q = E.selClip(); if (!q || q.id !== c.id) return;
    try {
      E.compileScript(q, ta.value);
      q.scriptCode = ta.value; q.scriptEnabled = true;
      E.dirty(); E.commit(); E.emit('project');
      status.textContent = 'Script applied and enabled. It will run in preview and export.';
      U.toast('SnipScript enabled for this clip.');
    } catch (err) { status.textContent = err.message || String(err); }
  });
  var disable = sb('Disable script', function () {
    var q = E.selClip(); if (!q || q.id !== c.id) return;
    q.scriptEnabled = false; E.dirty(); E.commit(); E.emit('project');
    status.textContent = 'Script disabled. Your code is still saved on this clip.';
  });


  /* Visual editor for the clip's timed set/tween cues. Code remains the source of truth. */
  var cueEditor = h('div', { class: 'script-cue-editor' });
  cueEditor.appendChild(sec('Visual cue editor'));
  cueEditor.appendChild(hint('Build timed events without writing the cue syntax. Add or edit a cue here, then use Apply & enable to run the updated script.'));
  var cueTime = h('input', { class: 'ti', type: 'number', min: 0, max: c.dur, step: 0.01, value: round(E.localT(c), 2), 'aria-label': 'Cue time in seconds' });
  var cueMode = h('select', { class: 'ti', 'aria-label': 'Cue action' }, [
    h('option', { value: 'set', text: 'Set value (instant)' }),
    h('option', { value: 'tween', text: 'Tween value (animate)' })
  ]);
  var cueTarget = h('select', { class: 'ti', 'aria-label': 'Cue property' });
  var cueValue = h('input', { class: 'ti', type: 'text', placeholder: 'Enter a number or #RRGGBB', 'aria-label': 'Cue target value' });
  var cueDuration = h('input', { class: 'ti', type: 'number', min: 0.01, max: c.dur, step: 0.01, value: Math.min(0.5, Math.max(0.01, c.dur)), 'aria-label': 'Tween duration in seconds' });
  var cueEase = h('select', { class: 'ti', 'aria-label': 'Tween easing' }, [
    h('option', { value: 'smooth', text: 'Smooth' }),
    h('option', { value: 'linear', text: 'Linear' }),
    h('option', { value: 'in', text: 'Ease in' }),
    h('option', { value: 'out', text: 'Ease out' }),
    h('option', { value: 'inout', text: 'Ease in and out' }),
    h('option', { value: 'custom', text: 'Custom Bezier' })
  ]);
  var cueEaseInfo = {
    custom: { label: 'Custom Bezier', description: 'Adjust the four control points to shape the motion.' },
    smooth: { label: 'Smooth', description: 'A gradual start and finish.' },
    linear: { label: 'Linear', description: 'Moves at a constant speed.' },
    'in': { label: 'Ease in', description: 'Starts gently, then accelerates.' },
    out: { label: 'Ease out', description: 'Starts quickly, then settles.' },
    inout: { label: 'Ease in / out', description: 'Starts gently, speeds up, then settles.' }
  };
  var cueCurveCaption = h('span', { class: 'script-easing-caption' });
  var cueCurve = h('div', { class: 'script-easing-curve', role: 'img' });
  var cueCurvePanel = h('div', { class: 'script-easing-panel' }, [
    h('div', { class: 'script-easing-head' }, [h('strong', { text: 'Curve preview' }), cueCurveCaption]),
    cueCurve
  ]);
  var cueBezierInputs = {
    x1: h('input', { class: 'ti', type: 'number', min: 0, max: 1, step: 0.01, value: 0.25, 'aria-label': 'Bezier first control X' }),
    y1: h('input', { class: 'ti', type: 'number', min: -0.25, max: 1.25, step: 0.01, value: 0.1, 'aria-label': 'Bezier first control Y' }),
    x2: h('input', { class: 'ti', type: 'number', min: 0, max: 1, step: 0.01, value: 0.25, 'aria-label': 'Bezier second control X' }),
    y2: h('input', { class: 'ti', type: 'number', min: -0.25, max: 1.25, step: 0.01, value: 1, 'aria-label': 'Bezier second control Y' })
  };
  var cueBezierGrid = h('div', { class: 'script-bezier-grid' }, [
    cueField('Control X1', cueBezierInputs.x1),cueField('Control Y1', cueBezierInputs.y1),
    cueField('Control X2', cueBezierInputs.x2),cueField('Control Y2', cueBezierInputs.y2)
  ]);
  function readBezierCurve() {
    var raw=[cueBezierInputs.x1.value,cueBezierInputs.y1.value,cueBezierInputs.x2.value,cueBezierInputs.y2.value];
    if(raw.some(function(v){return String(v).trim()==='';}))throw new Error('Enter four finite Bezier control values.');
    var curve={x1:Number(raw[0]),y1:Number(raw[1]),x2:Number(raw[2]),y2:Number(raw[3])};
    if(![curve.x1,curve.y1,curve.x2,curve.y2].every(function(v){return isFinite(v);}))throw new Error('Enter four finite Bezier control values.');
    if(curve.x1<0||curve.x1>1||curve.x2<0||curve.x2>1)throw new Error('Bezier X values must be between 0 and 1.');
    if(curve.y1<-.25||curve.y1>1.25||curve.y2<-.25||curve.y2>1.25)throw new Error('Bezier Y values must be between -0.25 and 1.25.');
    return curve;
  }
  var cueBezierDrag = 0;
  function renderEaseCurve() {
    var ease = cueEase.value, info = cueEaseInfo[ease] || cueEaseInfo.smooth, points = [], curve=null, controls='';
    if(ease==='custom'){try{curve=readBezierCurve();}catch(e){curve={x1:.25,y1:.1,x2:.25,y2:1};}}
    for (var i = 0; i <= 40; i++) {
      var x = i / 40, y = ease==='custom' ? E.cubicBezierProgress(curve,x) : E.easeProgress(ease,x);
      points.push((10 + x * 180).toFixed(2) + ',' + (65 - y * 44).toFixed(2));
    }
    if(ease==='custom'){
      var p1x=10+curve.x1*180,p1y=65-curve.y1*44,p2x=10+curve.x2*180,p2y=65-curve.y2*44;
      controls='<path class="script-bezier-arms" d="M10 65L'+p1x.toFixed(2)+' '+p1y.toFixed(2)+' M190 21L'+p2x.toFixed(2)+' '+p2y.toFixed(2)+'" />'+
        '<circle class="script-bezier-handle" data-bezier-handle="1" cx="'+p1x.toFixed(2)+'" cy="'+p1y.toFixed(2)+'" r="6" />'+
        '<circle class="script-bezier-handle" data-bezier-handle="2" cx="'+p2x.toFixed(2)+'" cy="'+p2y.toFixed(2)+'" r="6" />';
    }
    cueCurve.innerHTML = '<svg viewBox="0 0 200 78" aria-hidden="true" focusable="false">' +
      '<path class="script-easing-grid" d="M10 10H190 M10 43H190 M10 76H190 M10 10V76 M100 10V76 M190 10V76" />' +
      '<path class="script-easing-guide" d="M10 65L190 21" />' + controls +
      '<polyline class="script-easing-line" points="' + points.join(' ') + '" />' +
      '</svg>';
    cueCurveCaption.textContent = info.label + ' · ' + info.description;
    cueCurve.setAttribute('aria-label', info.label + ' easing curve. ' + info.description + (ease==='custom' ? ' Drag either control point or edit the numeric fields.' : ''));
  }
  function updateBezierFromPointer(e) {
    var svg=cueCurve.querySelector('svg');if(!svg)return;
    var rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return;
    /* SVG viewBox uses xMidYMid meet; account for any letterboxing in the visible box. */
    var scale=Math.min(rect.width/200,rect.height/78);if(!scale)return;
    var drawW=200*scale,drawH=78*scale,offsetX=(rect.width-drawW)/2,offsetY=(rect.height-drawH)/2;
    var sx=clamp((e.clientX-rect.left-offsetX)/scale,10,190);
    var sy=clamp((e.clientY-rect.top-offsetY)/scale,10,76);
    var x=Math.round(clamp((sx-10)/180,0,1)*1000)/1000;
    var y=Math.round(clamp((65-sy)/44,-.25,1.25)*1000)/1000;
    var suffix=String(cueBezierDrag);
    cueBezierInputs['x'+suffix].value=String(x);
    cueBezierInputs['y'+suffix].value=String(y);
    renderEaseCurve();
  }
  cueCurve.addEventListener('pointerdown',function(e){
    if(cueEase.value!=='custom')return;
    var handle=e.target&&e.target.getAttribute&&e.target.getAttribute('data-bezier-handle');
    if(handle!=='1'&&handle!=='2')return;
    cueBezierDrag=Number(handle);
    if(cueCurve.setPointerCapture){try{cueCurve.setPointerCapture(e.pointerId);}catch(err){}}
    e.preventDefault();
  });
  cueCurve.addEventListener('pointermove',function(e){if(!cueBezierDrag)return;updateBezierFromPointer(e);e.preventDefault();});
  function endBezierDrag(e){
    if(!cueBezierDrag)return;cueBezierDrag=0;
    if(cueCurve.releasePointerCapture&&cueCurve.hasPointerCapture&&cueCurve.hasPointerCapture(e.pointerId)){try{cueCurve.releasePointerCapture(e.pointerId);}catch(err){}}
    renderEaseCurve();
  }
  cueCurve.addEventListener('pointerup',endBezierDrag);
  cueCurve.addEventListener('pointercancel',endBezierDrag);
  Object.keys(cueBezierInputs).forEach(function(key){cueBezierInputs[key].addEventListener('input',function(){if(!cueBezierDrag)renderEaseCurve();});});
  var cueDurationField = h('label', { class: 'script-cue-field' }, [h('span', { text: 'Duration (seconds)' }), cueDuration]);
  var cueEaseField = h('label', { class: 'script-cue-field' }, [h('span', { text: 'Easing' }), cueEase]);
  var cueTweenPresets = [
    { name: 'Quick pop', duration: 0.24, ease: 'out', note: 'A quick move that settles smoothly.' },
    { name: 'Soft settle', duration: 0.65, ease: 'smooth', note: 'A calm start and finish.' },
    { name: 'Gentle drift', duration: 0.9, ease: 'inout', note: 'A gradual start, faster middle and soft finish.' },
    { name: 'Steady move', duration: 0.5, ease: 'linear', note: 'Constant speed throughout.' }
  ];
  var cuePresetPanel = h('div', { class: 'script-tween-presets' });
  cuePresetPanel.appendChild(h('div', { class: 'script-tween-presets-title', text: 'Quick tween presets' }));
  cueTweenPresets.forEach(function (preset) {
    var button = sb(preset.name, function () {
      var at = Number(cueTime.value), remaining = c.dur - at;
      if (!isFinite(at) || at < 0 || remaining < 0.01) {
        status.textContent = 'Move the cue time earlier to make room for a tween.';
        return;
      }
      var duration = Math.floor(Math.min(preset.duration, remaining) * 100) / 100;
      if (duration < 0.01) { status.textContent = 'There is not enough clip time for this tween.'; return; }
      cueMode.value = 'tween';
      cueDuration.value = duration.toFixed(2);
      cueEase.value = preset.ease;
      updateCueMode();
      status.textContent = preset.name + ' selected. Choose a target value, then add or update the cue.';
    });
    button.title = preset.note;
    cuePresetPanel.appendChild(button);
  });
  var cueEditingLine = 0;
  function cueField(label, input) {
    return h('label', { class: 'script-cue-field' }, [h('span', { text: label }), input]);
  }
  var cueProperties = E.listProperties(c).filter(function (p) { return p.type === 'number' || p.type === 'color'; });
  cueProperties.forEach(function (p) { cueTarget.appendChild(h('option', { value: p.id, text: p.label + '  ·  ' + p.id })); });
  var preferredTarget = c.kind === 'audio' ? 'audio.volume' : c.kind === 'text' ? 'text.fontSize' : 'transform.scale';
  if (cueProperties.some(function (p) { return p.id === preferredTarget; })) cueTarget.value = preferredTarget;
  function cueDef() { return E.getPropertyDef(cueTarget.value); }
  function fillCueValue() {
    var def = cueDef(), time = Number(cueTime.value), current = def ? E.getProperty(c, def.id, isFinite(time) ? time : 0) : null;
    cueValue.value = current == null ? (def && def.type === 'color' ? '#ffffff' : '1') : String(current);
    cueValue.placeholder = def && def.type === 'color' ? '#RRGGBB colour' : 'Number';
  }
  function updateCueMode() {
    var tween = cueMode.value === 'tween';
    cueDurationField.hidden = !tween;
    cueEaseField.hidden = !tween;
    cuePresetPanel.hidden = !tween;
    cueCurvePanel.hidden = !tween;
    cueBezierGrid.hidden = !tween || cueEase.value !== 'custom';
    renderEaseCurve();
  }
  cueTarget.addEventListener('change', fillCueValue);
  cueMode.addEventListener('change', updateCueMode);
  cueEase.addEventListener('change', updateCueMode);
  Object.keys(cueBezierInputs).forEach(function(key){cueBezierInputs[key].addEventListener('input',renderEaseCurve);});
  var cueAtPlayhead = sb('Use playhead', function () { cueTime.value = String(round(E.localT(c), 2)); fillCueValue(); });
  var cueAdd = sb('Add cue', function () { writeVisualCue(); });
  var cueCancel = sb('Cancel edit', function () { resetVisualCue(); });
  function readCueLine(lineNumber) {
    var raw = (ta.value || '').split(/\r?\n/)[lineNumber - 1] || '';
    var clean = raw.replace(/\/\/.*$/, '').trim();
    var m = clean.match(/^at\s+(\d+(?:\.\d*)?|\.\d+)\s*s?\s+(set|tween)\s+([a-z][a-z0-9.]*)\s*=\s*(.+)$/i);
    if (!m) return null;
    var data = { at: Number(m[1]), mode: m[2].toLowerCase(), property: m[3], value: m[4], duration: 0, ease: 'smooth' };
    if (data.mode === 'tween') {
      var tw = data.value.match(/^(.+?)\s+over\s+(\d+(?:\.\d*)?|\.\d+)\s*s(?:\s+ease\s+(.+))?$/i);
      if (!tw) return null;
      data.value = tw[1]; data.duration = Number(tw[2]);
      var spec=(tw[3]||'smooth').trim().toLowerCase(), custom=spec.match(/^cubic-bezier\s*\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/i);
      if(custom){data.ease='custom';data.bezier={x1:Number(custom[1]),y1:Number(custom[2]),x2:Number(custom[3]),y2:Number(custom[4])};}
      else data.ease=spec;
    }
    return data;
  }
  var cueList = h('div', { class: 'script-cue-list', role: 'list', 'aria-label': 'Timed script cues' });
  function renderCueList() {
    cueList.textContent = '';
    var sourceClip = Object.assign({}, c, { scriptCode: ta.value });
    var cues = E.listClipScriptCues ? E.listClipScriptCues(sourceClip) : [];
    if (!cues.length) {
      cueList.appendChild(h('p', { class: 'hint script-cue-empty', text: ta.value.trim() ? 'No valid timed cues found. Check the script syntax above.' : 'No timed cues yet. Use the controls above to add your first event.' }));
      return;
    }
    cues.forEach(function (q) {
      var data = readCueLine(q.line);
      var prop = E.getPropertyDef(q.property), label = prop ? prop.label : q.property;
      var detail = data ? data.value : '';
      var summary = h('div', { class: 'script-cue-summary' }, [
        h('strong', { text: round(q.at, 2).toFixed(2) + 's  ·  ' + (q.mode === 'tween' ? 'Tween' : 'Set') }),
        h('span', { text: label + '  →  ' + detail })
      ]);
      var jump = sb('Jump', function () { E.pause(); E.seek(c.start + q.at); });
      var edit = sb('Edit', function () {
        if (!data) { status.textContent = 'This cue uses syntax the visual editor cannot unpack. Edit its line in the code editor.'; return; }
        cueEditingLine = q.line;
        cueTime.value = String(data.at);
        cueMode.value = data.mode;
        cueTarget.value = data.property;
        cueValue.value = data.value;
        cueDuration.value = data.duration ? String(data.duration) : '0.5';
        cueEase.value = data.ease;
        if(data.bezier){Object.keys(cueBezierInputs).forEach(function(key){cueBezierInputs[key].value=String(data.bezier[key]);});}
        updateCueMode();
        cueAdd.textContent = 'Update cue';
        cueCancel.hidden = false;
        status.textContent = 'Editing the cue at line ' + q.line + '. Save the change or cancel.';
        cueTime.focus();
      });
      var remove = sb('Remove', function () {
        var lines = (ta.value || '').split(/\r?\n/);
        if (q.line > 0 && q.line <= lines.length) lines[q.line - 1] = '';
        ta.value = lines.join('\n');
        if (cueEditingLine === q.line) resetVisualCue();
        renderCueList();
        status.textContent = 'Cue removed from the script draft. Apply & enable to save the change.';
      });
      cueList.appendChild(h('div', { class: 'script-cue-row', role: 'listitem' }, [
        summary,
        h('div', { class: 'script-cue-actions' }, [jump, edit, remove])
      ]));
    });
  }
  function resetVisualCue() {
    cueEditingLine = 0;
    cueTime.value = String(round(E.localT(c), 2));
    cueMode.value = 'set';
    cueEase.value = 'smooth';
    cueBezierInputs.x1.value='0.25';cueBezierInputs.y1.value='0.1';cueBezierInputs.x2.value='0.25';cueBezierInputs.y2.value='1';
    updateCueMode();
    fillCueValue();
    cueAdd.textContent = 'Add cue';
    cueCancel.hidden = true;
  }
  function writeVisualCue() {
    var prop = cueTarget.value, def = cueDef(), at = Number(cueTime.value), raw = String(cueValue.value || '').trim();
    if (!def) { status.textContent = 'Choose a supported property.'; return; }
    if (!isFinite(at) || at < 0 || at > c.dur) { status.textContent = 'Cue time must be within this clip.'; return; }
    if (!raw) { status.textContent = 'Enter a target value.'; return; }
    var value;
    try {
      if (def.type === 'number') {
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) throw new Error('The visual editor accepts a number here. Use the code editor for expressions.');
        value = String(E.normalizeProperty(prop, Number(raw)));
      } else {
        if (!/^#[0-9a-f]{6}$/i.test(raw)) throw new Error('Choose a six-digit hex colour such as #ffcc00.');
        value = E.normalizeProperty(prop, raw);
      }
      var mode = cueMode.value, duration = Number(cueDuration.value), ease = cueEase.value;
      var line = 'at ' + round(at, 2) + 's ' + mode + ' ' + prop + ' = ' + value;
      if (mode === 'tween') {
        if (!isFinite(duration) || duration <= 0 || at + duration > c.dur + 1e-6) throw new Error('Tween duration must be positive and finish before this clip ends.');
        if(ease==='custom'){var curve=readBezierCurve();function fmt(v){return String(Math.round(v*1000)/1000);}ease='cubic-bezier('+fmt(curve.x1)+', '+fmt(curve.y1)+', '+fmt(curve.x2)+', '+fmt(curve.y2)+')';}
        line += ' over ' + round(duration, 2) + 's ease ' + ease;
      }
      var lines = (ta.value || '').split(/\r?\n/), candidate;
      if (cueEditingLine) {
        if (cueEditingLine < 1 || cueEditingLine > lines.length) throw new Error('The cue being edited no longer exists.');
        lines[cueEditingLine - 1] = line;
        candidate = lines.join('\n');
      } else {
        candidate = (ta.value || '') + ((ta.value && !/\n$/.test(ta.value)) ? '\n' : '') + line;
      }
      E.compileScript(c, candidate);
      ta.value = candidate;
      var updated = cueEditingLine ? 'Cue updated' : 'Cue added';
      resetVisualCue();
      renderCueList();
      status.textContent = updated + '. Apply & enable to run the updated script.';
    } catch (err) {
      status.textContent = err && err.message ? err.message : String(err);
    }
  }
  cueEditor.appendChild(h('div', { class: 'script-cue-grid' }, [
    cueField('At (seconds)', cueTime),
    cueField('Action', cueMode),
    cueField('Property', cueTarget),
    cueField('Target value', cueValue),
    cueDurationField,
    cueEaseField
  ]));
  cueEditor.appendChild(hint('For a tween, choose its duration and easing. The visual value field accepts numbers and six-digit hex colours; use the code editor for expressions.'));
  cueEditor.appendChild(cuePresetPanel);
  cueEditor.appendChild(cueBezierGrid);
  cueEditor.appendChild(cueCurvePanel);
  cueEditor.appendChild(hint('Custom Bezier: drag either point on the curve. The four numeric fields remain available for precise adjustments.'));
  cueEditor.appendChild(h('div', { class: 'script-actions' }, [cueAtPlayhead, cueAdd, cueCancel]));
  cueCancel.hidden = true;
  cueEditor.appendChild(cueList);
  cueTime.addEventListener('change', fillCueValue);
  cueValue.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); writeVisualCue(); } });
  ta.addEventListener('input', renderCueList);
  updateCueMode();
  fillCueValue();
  renderCueList();

  var library = h('div', { class: 'script-library' });
  library.appendChild(sec('Project script library'));
  library.appendChild(hint('Save named scripts in this project, then load or apply them to other compatible clips. Updating a name replaces that preset.'));
  var presetName = h('input', { class: 'ti', type: 'text', maxlength: 48, placeholder: 'e.g. Gentle float', 'aria-label': 'Script preset name' });
  var presetSelect = h('select', { class: 'ti', 'aria-label': 'Saved project scripts' });
  function refreshPresets(selectedId) {
    var list = E.listScriptPresets ? E.listScriptPresets() : [];
    presetSelect.textContent = '';
    presetSelect.appendChild(h('option', { value: '', text: list.length ? 'Choose a saved script…' : 'No saved scripts yet', disabled: true }));
    list.forEach(function (p) {
      presetSelect.appendChild(h('option', { value: p.id, text: p.name + ' (' + p.kind + ')' }));
    });
    presetSelect.value = selectedId || '';
  }
  function selectedPreset() { return E.getScriptPreset ? E.getScriptPreset(presetSelect.value) : null; }
  presetSelect.addEventListener('change', function () {
    var p = selectedPreset(); if (p) presetName.value = p.name;
  });
  var savePreset = sb('Save / update', function () {
    var q = E.selClip(); if (!q || q.id !== c.id) return;
    try {
      var p = E.saveScriptPreset(presetName.value, q, ta.value);
      refreshPresets(p.id);
      E.dirty(); E.emit('project'); E.commit();
      status.textContent = 'Saved "' + p.name + '" to this project (' + E.listScriptPresets().length + ' total).';
      U.toast('Script preset saved to project.');
    } catch (err) { status.textContent = err.message || String(err); }
  });
  var loadPreset = sb('Load into editor', function () {
    var p = selectedPreset(); if (!p) { status.textContent = 'Choose a saved script first.'; return; }
    ta.value = p.code; presetName.value = p.name; renderCueList();
    status.textContent = 'Loaded "' + p.name + '". Check it, then apply it to this clip.';
  });
  var applyPreset = sb('Apply selected', function () {
    var q = E.selClip(), p = selectedPreset(); if (!q || q.id !== c.id) return;
    if (!p) { status.textContent = 'Choose a saved script first.'; return; }
    try {
      E.applyScriptPreset(p.id, q); ta.value = p.code; presetName.value = p.name; renderCueList();
      E.dirty(); E.emit('project'); E.commit();
      status.textContent = 'Applied "' + p.name + '" and enabled it on this clip.';
      U.toast('Script preset applied.');
    } catch (err) { status.textContent = err.message || String(err); }
  });
  var deletePreset = sb('Delete selected', function () {
    var p = selectedPreset(); if (!p) { status.textContent = 'Choose a saved script first.'; return; }
    if (!E.deleteScriptPreset(p.id)) return;
    E.dirty(); E.emit('project'); E.commit(); refreshPresets('');
    status.textContent = 'Deleted "' + p.name + '" from this project.';
  });
  library.appendChild(presetName);
  library.appendChild(presetSelect);
  library.appendChild(h('div', { class: 'script-actions' }, [savePreset, loadPreset, applyPreset, deletePreset]));
  refreshPresets('');
  b.appendChild(h('div', { class: 'script-actions' }, [example, check, apply, disable]));
  b.appendChild(ta);
  b.appendChild(cueEditor);
  b.appendChild(library);
  b.appendChild(status);
  b.appendChild(sec('Available values'));
  b.appendChild(hint('time = seconds since this clip starts; duration = clip length in seconds; progress = 0 to 1; pi = π.'));
  b.appendChild(hint('Targets on this clip: ' + E.listProperties(c).map(function (p) { return p.id; }).join(', ') + '.'));
  b.appendChild(hint('Math: sin, cos, tan, abs, min, max, clamp, lerp, round, floor, ceil, sqrt, pow, sign and rgb. Cues: at 0.5s set property = value; at 1s tween property = value over 0.5s ease out.'));
}

var labelT = 0;
function tabText(c, b) {
  b.appendChild(sec('Content'));
  var ta = h('textarea', { class: 'ti', rows: 3, 'aria-label': 'Text', maxlength: 400 });
  ta.addEventListener('input', function () { var q = E.selClip(); if (!q || !q.text) return; q.text.str = ta.value; U.live(); clearTimeout(labelT); labelT = setTimeout(function () { E.emit('project'); }, 250); });
  ta.addEventListener('change', function () { E.commit(); });
  bound.push(function () { var q = E.selClip(); if (q && q.text && document.activeElement !== ta) ta.value = q.text.str; }); bound[bound.length - 1]();
  b.appendChild(ta);
  var T = c.text;
  b.appendChild(sec('Style'));
  if (!T.ransom) b.appendChild(selc({ l: 'Font', p: 'text.font', opts: E.TEXT_FONTS.map(function (f) { return [f, f]; }) }));
  b.appendChild(rng({ l: 'Size', p: 'text.size', min: 20, max: 400, step: 1 }));
  if (!T.ransom) {
    b.appendChild(colr({ l: 'Colour', p: 'text.color', sw: ['#ffffff', '#111111', '#ffd92e', '#e8491a', '#2b5fc4', '#2f8f5b'] }));
    b.appendChild(chk({ l: 'Bold (where the font has it)', p: 'text.bold' }));
  }
  b.appendChild(seg({ l: 'Align', p: 'text.align', opts: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']] }));
  if (!T.ransom) b.appendChild(rng({ l: 'Letter gap', p: 'text.ls', min: -5, max: 40, step: 1 }));
  b.appendChild(rng({ l: 'Line height', p: 'text.lh', min: 0.8, max: 2, step: 0.05, dec: 2 }));
  if (!T.ransom) {
    b.appendChild(sec('Outline and shadow'));
    b.appendChild(rng({ l: 'Outline', p: 'text.strokeW', min: 0, max: 30, step: 1 }));
    b.appendChild(colr({ l: 'Outline colour', p: 'text.strokeC', sw: ['#000000', '#ffffff', '#e8491a'] }));
    b.appendChild(chk({ l: 'Drop shadow', p: 'text.shadow' }));
    b.appendChild(sec('Background box'));
    b.appendChild(chk({ l: 'Show a box behind the text', p: 'text.box', st: true }));
    if (T.box) {
      b.appendChild(colr({ l: 'Box colour', p: 'text.boxC', sw: ['#101010', '#ffffff', '#f4ecd8', '#e8491a'] }));
      b.appendChild(rng({ l: 'Padding', p: 'text.boxPad', min: 0, max: 80, step: 1 }));
      b.appendChild(rng({ l: 'Corner', p: 'text.boxR', min: 0, max: 60, step: 1 }));
    }
  }
  b.appendChild(sec('Magazine letters'));
  b.appendChild(chk({ l: 'Ransom-note scraps', p: 'text.ransom', st: true }));
  b.appendChild(hint('Each letter gets its own scrap of paper, font and colour. Pair it with the Stop-motion pop animation.'));
}

var BGS = [['mat', 'Cutting mat'], ['paper', 'Kraft paper'], ['gradient', 'Gradient'], ['green', 'Green screen']];
function tabProject(c, b) {
  b.appendChild(sec('Project'));
  var nm = h('input', { class: 'ti', type: 'text', maxlength: 60, 'aria-label': 'Project name' });
  nm.addEventListener('input', function () { E.proj.name = nm.value || 'Untitled'; $('edName').value = E.proj.name; });
  bound.push(function () { if (document.activeElement !== nm) nm.value = E.proj.name; }); bound[bound.length - 1]();
  b.appendChild(h('div', { class: 'pr one' }, [h('label', { text: 'Name' }), nm]));
  b.appendChild(sec('Frame shape'));
  var rg = h('div', { class: 'btn-row', role: 'group', 'aria-label': 'Frame shape' }), rb = Object.keys(E.RATIOS).map(function (k) { var x = sb(k, function () { E.setRatio(k); sync(); }); rg.appendChild(x); return [k, x]; });
  b.appendChild(rg);
  bound.push(function () { rb.forEach(function (q) { q[1].setAttribute('aria-pressed', String(q[0] === E.proj.ratio)); }); }); bound[bound.length - 1]();
  b.appendChild(sec('Background'));
  var sws = h('div', { class: 'sw-row' }), bc = h('input', { type: 'color', 'aria-label': 'Background colour' });
  ['#111111', '#ffffff'].concat(K.PAPER_COLORS).forEach(function (col) { sws.appendChild(h('button', { class: 'sw', type: 'button', style: { background: col }, 'aria-label': 'Background ' + col, onclick: function () { setBg({ type: 'color', color: col }); } })); });
  bc.addEventListener('input', function () { E.proj.bg = { type: 'color', color: bc.value }; E.dirty(); }); bc.addEventListener('change', function () { E.commit(); sync(); });
  sws.appendChild(bc); b.appendChild(sws);
  var pr = h('div', { class: 'btn-row' }), pb = BGS.map(function (q) { var x = sb(q[1], function () { setBg({ type: q[0] }); }); pr.appendChild(x); return [q[0], x]; });
  b.appendChild(pr);
  bound.push(function () { var t = E.proj.bg.type; pb.forEach(function (q) { q[1].setAttribute('aria-pressed', String(q[0] === t)); }); if (E.proj.bg.type === 'color' && /^#[0-9a-f]{6}$/i.test(E.proj.bg.color)) bc.value = E.proj.bg.color; }); bound[bound.length - 1]();
  b.appendChild(hint('The background shows behind every clip. Add a photo on the bottom track to use a picture instead.'));

  b.appendChild(sec('Project animation script'));
  b.appendChild(hint('Animate several clips from one shared project clock. Each line targets a clip by ID; project time starts at 0 and runs to the end of the timeline.'));
  var projectTargets = h('select', { class: 'es', 'aria-label': 'Choose a clip to target' });
  function refreshProjectTargets() {
    projectTargets.textContent = '';
    E.proj.clips.forEach(function (q) { projectTargets.appendChild(h('option', { value: q.id, text: (q.name || q.kind) + ' · ' + q.id })); });
    projectTargets.disabled = !E.proj.clips.length;
  }
  var projectCode = h('textarea', { class: 'ti script-code', rows: 8, spellcheck: 'false', 'aria-label': 'Project SnipScript code' });
  projectCode.value = E.proj.projectScriptCode || '';
  var projectStatus = h('p', { class: 'hint script-status', role: 'status', 'aria-live': 'polite' });
  function projectInsert(text) {
    var old = projectCode.value || '';
    projectCode.value = (old && !old.endsWith('\n') ? old + '\n' : old) + text;
    projectCode.focus(); projectCode.setSelectionRange(projectCode.value.length, projectCode.value.length);
    projectStatus.textContent = 'Script added to the draft. Check it, then Apply & enable.';
  }
  var insertTarget = h('button', { class: 'eb', type: 'button', text: 'Insert continuous target', onclick: function () {
    if (!projectTargets.value) { projectStatus.textContent = 'Add a clip to the timeline first.'; return; }
    projectInsert('clip ' + projectTargets.value + ' set transform.y = sin(time * 2) * 0.04');
  } });
  var insertTween = h('button', { class: 'eb', type: 'button', text: 'Insert tween example', onclick: function () {
    if (!projectTargets.value) { projectStatus.textContent = 'Add a clip to the timeline first.'; return; }
    projectInsert('at 0s clip ' + projectTargets.value + ' set transform.scale = 0.7\nat 0.25s clip ' + projectTargets.value + ' tween transform.scale = 1 over 0.6s ease out');
  } });
  var checkProject = h('button', { class: 'eb', type: 'button', text: 'Check project script', onclick: function () {
    try {
      var result = E.compileProjectScript(projectCode.value);
      projectStatus.textContent = 'Valid: ' + result.statements + ' statements across ' + result.targets.length + ' clips.';
    } catch (err) { projectStatus.textContent = err.message || String(err); }
  } });
  var applyProject = h('button', { class: 'eb acc', type: 'button', text: 'Apply & enable', onclick: function () {
    try {
      E.compileProjectScript(projectCode.value);
      E.proj.projectScriptCode = projectCode.value; E.proj.projectScriptEnabled = true;
      E.dirty(); E.commit(); E.emit('project');
      projectStatus.textContent = 'Project script enabled. It runs in preview and video export.';
      U.toast('Project SnipScript enabled.');
    } catch (err) { projectStatus.textContent = err.message || String(err); }
  } });
  var disableProject = h('button', { class: 'eb', type: 'button', text: 'Disable', onclick: function () {
    E.proj.projectScriptEnabled = false; E.dirty(); E.commit(); E.emit('project');
    projectStatus.textContent = 'Project script disabled. The code is still saved.';
  } });
  refreshProjectTargets();
  bound.push(function () {
    refreshProjectTargets();
    if (document.activeElement !== projectCode) projectCode.value = E.proj.projectScriptCode || '';
    projectStatus.textContent = E.proj.projectScriptEnabled ? 'Project script is enabled.' : 'Project script is disabled. Apply & enable to run it.';
  });
  b.appendChild(projectTargets);
  b.appendChild(projectCode);
  b.appendChild(h('div', { class: 'script-actions' }, [insertTarget, insertTween, checkProject, applyProject, disableProject]));
  b.appendChild(projectStatus);
  b.appendChild(hint('Examples: clip c1 set transform.y = sin(time * 2) * 0.04, or at 1s clip c1 tween transform.scale = 1 over 0.5s ease out. Project variables: time, duration, progress and pi. Targets support transform.*, paper.*, text.* and audio.* when available on that clip.'));

  b.appendChild(sec('Info'));
  var a = kv('Length', ''), z = kv('Clips', ''), y = kv('Size', ''); b.appendChild(a[0]); b.appendChild(z[0]); b.appendChild(y[0]);
  bound.push(function () { a[1].textContent = E.fmt(E.end(), true); z[1].textContent = String(E.proj.clips.length); y[1].textContent = E.proj.w + ' x ' + E.proj.h; }); bound[bound.length - 1]();
  b.appendChild(hint('Select a clip on the timeline or on the preview to edit it here.'));
}
function setBg(bg) { E.proj.bg = bg; E.dirty(); E.commit(); sync(); }

/* ---------- build, sync ---------- */
function tabsFor(c) {
  if (!c) return [['proj', 'Project', 'film']];
  if (c.kind === 'audio') return [['audio', 'Audio', 'vol'], ['script', 'Script', 'code']];
  var t = c.kind === 'text' ? [['text', 'Text', 'text'], ['basic', 'Layout', 'sliders']] : [['basic', 'Video', 'video']];
  t.push(['cut', 'Cutout', 'scissors'], ['anim', 'Animation', 'sparkle'], ['script', 'Script', 'code']); if (c.kind === 'video') t.push(['audio', 'Audio', 'vol']); return t;
}
function keyOf() {
  var c = E.selClip(); if (!c) return 'none';
  var m = c.media && E.media[c.media];
  var presets = E.listScriptPresets ? E.listScriptPresets().map(function (p) { return [p.id, p.name, p.kind, p.code].join(':'); }).join(';') : '';
  var project = E.proj || {};
  var projectTargets = (project.clips || []).map(function (q) { return [q.id, q.name, q.kind].join(':'); }).join(';');
  return [c.id, c.kind, c.cut.on, c.cut.rm && c.cut.rm.on, c.cut.rm && c.cut.rm.wands.length, c.text && c.text.ransom, c.text && c.text.box, c.anim['in'].t, c.anim.out.t, c.anim.combo.t !== 'none', c.scriptEnabled ? 1 : 0, c.scriptCode || '', presets, m && m.buffer ? 1 : 0, U.wand ? 1 : 0, project.projectScriptEnabled ? 1 : 0, project.projectScriptCode || '', projectTargets].join('|');
}
function build() {
  if (building) return; building = true;
  try {
    var c = E.selClip(), list = tabsFor(c), tl = $('inspTabs'), body = $('inspBody');
    if (U.wand && (!c || c.kind !== 'image' || !c.cut.on || tabName !== 'cut')) { U.wand = false; $('edStage').classList.remove('wand'); }
    if (c && c.kind !== lastKind) tabName = list[0][0];
    var tn = list.some(function (t) { return t[0] === tabName; }) ? tabName : list[0][0]; if (c) { tabName = tn; lastKind = c.kind; }
    var keep = (c ? c.id : null) === lastSel && tn === lastTab ? body.scrollTop : 0;
    tl.textContent = ''; body.textContent = ''; bound = [];
    tl.hidden = !c;
    list.forEach(function (t) { tl.appendChild(h('button', { class: 'et', type: 'button', role: 'tab', 'aria-selected': 'false', html: U.ic(t[2], 18) + '<span>' + t[1] + '</span>', onclick: function () { tabName = t[0]; build(); } })); });
    list.forEach(function (t, i) { tl.children[i].setAttribute('aria-selected', String(t[0] === tn)); });
    ({ proj: tabProject, basic: tabBasic, cut: tabCut, anim: tabAnim, audio: tabAudio, text: tabText, script: tabScript })[tn](c, body);
    body.scrollTop = keep; lastSel = c ? c.id : null; lastTab = tn; curKey = keyOf();
  } finally { building = false; }
}
function sync() { for (var i = 0; i < bound.length; i++) bound[i](); }
I.build = build; I.sync = sync;
var syncSoon = U.raf1(sync);
function onProject() { if (keyOf() !== curKey) build(); else syncSoon(); }
E.on('sel', build);
E.on('project', onProject);
E.on('audio', onProject);
E.on('wand', build);
E.on('live', syncSoon);
E.on('time', function () { var c = E.selClip(); if (c && E.hasKf(c)) syncSoon(); }); /* animated values follow the playhead */
E.on('opened', build);
build();
})();
