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
  b.appendChild(hint('Create continuous animations or timed events for this clip. Cues and tweens run deterministically in preview and export. This is not JavaScript and has no browser or network access.'));
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
    ta.value = p.code; presetName.value = p.name;
    status.textContent = 'Loaded "' + p.name + '". Check it, then apply it to this clip.';
  });
  var applyPreset = sb('Apply selected', function () {
    var q = E.selClip(), p = selectedPreset(); if (!q || q.id !== c.id) return;
    if (!p) { status.textContent = 'Choose a saved script first.'; return; }
    try {
      E.applyScriptPreset(p.id, q); ta.value = p.code; presetName.value = p.name;
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
  var presets = E.listScriptPresets ? E.listScriptPresets().map(function (p) { return [p.id, p.name, p.kind, p.code].join(':'); }).join(';') : '';\n  return [c.id, c.kind, c.cut.on, c.cut.rm && c.cut.rm.on, c.cut.rm && c.cut.rm.wands.length, c.text && c.text.ransom, c.text && c.text.box, c.anim['in'].t, c.anim.out.t, c.anim.combo.t !== 'none', c.scriptEnabled ? 1 : 0, c.scriptCode || '', presets, m && m.buffer ? 1 : 0, U.wand ? 1 : 0].join('|');
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
