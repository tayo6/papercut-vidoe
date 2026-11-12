(function () {
'use strict';
/* Video editor interface: shell, preview player with on-canvas handles, media library, transport, shortcuts. */
var K = window.__snip, E = K.E, clamp = K.clamp, U = E.ui = {};
var $ = U.$ = function (id) { return document.getElementById(id); };

/* ---------- tiny DOM helper and icons ---------- */
U.h = function (tag, a, kids) {
  var el = document.createElement(tag);
  if (a) for (var k in a) {
    var v = a[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
};
var h = U.h;
var IC = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>', pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>', redo: '<path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3"/>',
  split: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5L20 18M8.5 16.5L20 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
  vol: '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/>',
  magnet: '<path d="M6 3v8a6 6 0 0012 0V3h-4v8a2 2 0 01-4 0V3zM6 7h4M14 7h4"/>', chev: '<path d="M15 5l-7 7 7 7"/>',
  export: '<path d="M12 3v12M7 8l5-5 5 5M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>', skip: '<path d="M6 5v14M19 5.5v13L9 12z"/>', film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  zin: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/>', zout: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5M8 11h6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>', scissors: '<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8 7.5L20 17M8 16.5L20 7"/>',
  wand: '<path d="M4 20L15 9M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6z"/>', fliph: '<path d="M12 3v18M8 7L3 17h5zM16 7l5 10h-5z"/>', flipv: '<path d="M3 12h18M7 8l10-5v5zM7 16l10 5v-5z"/>'
};
U.kfIcon = function (s) { s = s || 14; return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true"><path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" stroke-width="2.4" stroke-linejoin="round"/></svg>'; };
U.ic = function (n, s) { s = s || 18; return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; };
function fillIcons(root) { Array.prototype.forEach.call((root || $('ed')).querySelectorAll('[data-ic]'), function (el) { if (!el.getAttribute('data-done')) { el.insertAdjacentHTML('afterbegin', U.ic(el.getAttribute('data-ic'), el.classList.contains('em-ic') ? 24 : 18)); el.setAttribute('data-done', '1'); } }); }
U.fillIcons = fillIcons;

var toastT = 0;
U.toast = function (msg) { if (!$('expModal').hidden) return; /* the export dialog has its own message line */ var t = $('edToast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3200); };
E.on('toast', U.toast);
U.live = function () { E.dirty(); E.emit('live'); };
function raf1(fn) { var p = 0; return function () { if (p) return; p = requestAnimationFrame(function () { p = 0; fn(); }); }; }
U.raf1 = raf1;
U.dur = function (t) { if (t < 2) return (Math.round(t * 10) / 10).toFixed(1) + 's'; t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); };

/* ---------- preview player ---------- */
var cv = U.cv = $('edCanvas'), cx = cv.getContext('2d'), stage = $('edStage'), wrap = $('edStageWrap'), box = $('edBox');
function sizeCanvas() {
  var s = Math.min(1, 960 / Math.max(E.proj.w, E.proj.h)), w = Math.round(E.proj.w * s), hh = Math.round(E.proj.h * s);
  if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
}
U.fit = function () {
  sizeCanvas();
  var r = wrap.getBoundingClientRect(), aw = Math.max(60, r.width - 28), ah = Math.max(60, r.height - 28), ar = cv.width / cv.height, w = Math.min(aw, ah * ar);
  stage.style.width = Math.floor(w) + 'px'; stage.style.height = Math.floor(w / ar) + 'px'; E.dirty();
};
if (window.ResizeObserver) new ResizeObserver(function () { if (K.editorOn) U.fit(); }).observe(wrap);
window.addEventListener('resize', function () { if (K.editorOn) U.fit(); });

var warned = false;
function draw() {
  try {
    E.syncVideos(E.t);
    E.render(cx, cv.width, cv.height, E.t);
  } catch (e) { if (!warned) { warned = true; U.toast('A frame could not be drawn: ' + (e && e.message || e)); } if (window.console) console.error(e); }
  updateBox();
}
function loop(now) {
  if (!K.editorOn) { U.raf = 0; return; }
  U.raf = requestAnimationFrame(loop);
  E.tick(now);
  if (U.stopAt != null && E.playing && E.t >= U.stopAt) { U.stopAt = null; E.pause(); }
  if (U.busy) return;
  if (E.needsRender) { E.needsRender = false; draw(); }
}

/* ---------- on-canvas handles ---------- */
function updateBox() {
  var c = E.selClip(), f = stage.clientWidth / cv.width, row = c && E.rowById(c.row);
  if (!c || c.kind === 'audio' || !row || row.hide || E.t < c.start - 1e-6 || E.t >= c.start + c.dur) { box.hidden = true; return; }
  var b = E.boxOf(c, cv.width, cv.height); if (!b) { box.hidden = true; return; }
  box.hidden = false;
  var s = box.style; s.width = Math.max(8, b.bw * f) + 'px'; s.height = Math.max(8, b.bh * f) + 'px'; s.left = b.cx * f + 'px'; s.top = b.cy * f + 'px'; s.transform = 'translate(-50%,-50%) rotate(' + b.rot + 'rad)';
}
function frameXY(e) { var r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
function insideBox(c, p) {
  if (E.t < c.start || E.t >= c.start + c.dur) return false;
  var b = E.boxOf(c, cv.width, cv.height); if (!b) return false;
  var dx = p.x - b.cx, dy = p.y - b.cy, cr = Math.cos(-b.rot), sr = Math.sin(-b.rot), lx = dx * cr - dy * sr, ly = dx * sr + dy * cr;
  return Math.abs(lx) <= b.bw / 2 + 4 && Math.abs(ly) <= b.bh / 2 + 4;
}
/* where a point of the frame lands on the original photo, 0..1 (for the background picker) */
function imageUV(c, p) {
  var m = E.media[c.media], w = cv.width, hh = cv.height, tf = E.tfAt(c, E.localT(c)), s = (tf.fit === 'fill' ? Math.max(w / m.w, hh / m.h) : Math.min(w / m.w, hh / m.h)) * tf.s, rot = tf.r * Math.PI / 180;
  var dx = p.x - (w / 2 + tf.x * w), dy = p.y - (hh / 2 + tf.y * hh), cr = Math.cos(-rot), sr = Math.sin(-rot), lx = dx * cr - dy * sr, ly = dx * sr + dy * cr;
  if (tf.fx) lx = -lx; if (tf.fy) ly = -ly;
  return [lx / (m.w * s) + 0.5, ly / (m.h * s) + 0.5];
}
U.wand = false;
U.setWand = function (on) { U.wand = !!on; stage.classList.toggle('wand', U.wand); E.emit('wand'); };
function guides(gx, gy) { $('gdV').hidden = !gx; $('gdH').hidden = !gy; }
var drag = null;
stage.addEventListener('pointerdown', function (e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (U.busy) return;
  var p = frameXY(e), c = E.selClip(), hd = e.target.closest ? e.target.closest('.hd') : null, w = cv.width, hh = cv.height;
  if (U.wand && c && c.kind === 'image' && c.cut.on) {
    var uv = imageUV(c, p);
    if (uv[0] >= 0 && uv[0] <= 1 && uv[1] >= 0 && uv[1] <= 1) { c.cut.rm.wands.push([uv[0], uv[1]]); E.dirty(); E.commit(); E.emit('project'); U.toast('Removed that area. Click more spots, or press Done.'); }
    else U.toast('Click on the photo itself.');
    return;
  }
  if (hd && c) {
    var tv = E.tfAt(c, E.localT(c));
    drag = { mode: hd.getAttribute('data-h'), id: c.id, lt: E.localT(c), tf0: tv, cen: { x: w / 2 + tv.x * w, y: hh / 2 + tv.y * hh }, p0: p };
    drag.r0 = Math.max(8, Math.hypot(p.x - drag.cen.x, p.y - drag.cen.y)); drag.a0 = Math.atan2(p.y - drag.cen.y, p.x - drag.cen.x);
  } else {
    var hit = (c && insideBox(c, p)) ? c : E.hitTest(p.x, p.y, w, hh, E.t);
    if (!hit) { E.select(null); return; }
    if (hit.id !== E.sel) E.select(hit.id);
    drag = { mode: 'm', id: hit.id, lt: E.localT(hit), tf0: E.tfAt(hit, E.localT(hit)), x0: e.clientX, y0: e.clientY };
  }
  drag.moved = false; try { stage.setPointerCapture(e.pointerId); } catch (er) { /* not capturable */ }
  e.preventDefault();
});
stage.addEventListener('pointermove', function (e) {
  if (!drag) return;
  var c = E.clipById(drag.id); if (!c) return;
  var w = cv.width, hh = cv.height, p = frameXY(e), t0 = drag.tf0, lt = drag.lt, gx = false, gy = false; /* animated values get a keyframe at the playhead; plain ones just change */
  if (drag.mode === 'm') {
    var r = stage.getBoundingClientRect(), dx = (e.clientX - drag.x0) * cv.width / r.width, dy = (e.clientY - drag.y0) * cv.height / r.height;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    var nx = t0.x + dx / w, ny = t0.y + dy / hh;
    if (Math.abs(nx) < 0.012) { nx = 0; gx = true; } if (Math.abs(ny) < 0.012) { ny = 0; gy = true; }
    E.setTf(c, 'x', nx, lt); E.setTf(c, 'y', ny, lt);
  } else if (drag.mode === 's') {
    E.setTf(c, 's', clamp(t0.s * Math.hypot(p.x - drag.cen.x, p.y - drag.cen.y) / drag.r0, 0.03, 10), lt);
  } else {
    var a = Math.atan2(p.y - drag.cen.y, p.x - drag.cen.x), deg = t0.r + (a - drag.a0) * 180 / Math.PI;
    deg = ((deg + 180) % 360 + 360) % 360 - 180; var q = Math.round(deg / 45) * 45; if (Math.abs(deg - q) < 4) deg = q; E.setTf(c, 'r', deg, lt);
  }
  drag.moved = true; guides(gx, gy); U.live();
});
function endDrag() { if (!drag) return; var m = drag.moved; drag = null; guides(false, false); if (m) { E.commit(); E.emit('live'); E.emit('project'); } }
stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);

/* ---------- transport ---------- */
function setPlayIcon() { $('edPlay').innerHTML = U.ic(E.playing ? 'pause' : 'play', 20); $('edPlay').setAttribute('aria-label', E.playing ? 'Pause' : 'Play'); }
function setTimeText() { $('edTime').textContent = E.fmt(E.t, true); $('edTotal').textContent = E.fmt(E.end(), true); }
$('edPlay').addEventListener('click', function () { if (!E.hasContent()) { U.toast('Add something to the timeline first.'); return; } U.stopAt = null; E.toggle(); });
$('edStart').addEventListener('click', function () { E.seek(0); });
var muted = false;
function setMute(m, apply) { muted = m; if (apply) E.aud.monitor(!m); $('edMute').innerHTML = U.ic(m ? 'mute' : 'vol', 18); $('edMute').setAttribute('aria-pressed', String(m)); $('edMute').setAttribute('aria-label', m ? 'Unmute preview' : 'Mute preview'); }
$('edMute').addEventListener('click', function () { setMute(!muted, true); });
E.on('play', function () { setPlayIcon(); if (E.playing) E.aud.stopPreview(); });
E.on('time', function () { setTimeText(); });
E.on('ended', function () { U.stopAt = null; });

var rs = $('edRatio');
Object.keys(E.RATIOS).forEach(function (k) { rs.appendChild(h('option', { value: k, text: k })); });
rs.addEventListener('change', function () { E.setRatio(rs.value); });

/* undo / redo / name / export */
function histBtns() { ['edUndo', 'tlUndo'].forEach(function (i) { $(i).disabled = !E.canUndo(); }); ['edRedo', 'tlRedo'].forEach(function (i) { $(i).disabled = !E.canRedo(); }); }
E.on('history', histBtns);
['edUndo', 'tlUndo'].forEach(function (i) { $(i).addEventListener('click', function () { E.undo(); }); });
['edRedo', 'tlRedo'].forEach(function (i) { $(i).addEventListener('click', function () { E.redo(); }); });
$('edName').addEventListener('input', function () { E.proj.name = $('edName').value || 'Untitled'; });
$('edBack').addEventListener('click', function () { U.close(); });

function onProject() {
  if (E.proj.ratio !== rs.value) rs.value = E.proj.ratio;
  if (document.activeElement !== $('edName')) $('edName').value = E.proj.name;
  $('edEmpty').hidden = E.hasContent();
  setTimeText(); U.fit(); histBtns();
}
E.on('project', onProject);
E.on('sel', function () { E.dirty(); updateBarState(); });
E.on('live', function () { E.dirty(); });
E.on('wand', function () { /* inspector listens too */ });
E.on('project', function () { if (E.playing) E.aud.refresh(); });
E.on('audio', function () { if (E.playing) E.aud.refresh(); });

/* ---------- library ---------- */
var libTab = 'media', LIB_TABS = [['media', 'Media', 'image'], ['audio', 'Audio', 'music'], ['text', 'Text', 'text'], ['fx', 'Effects', 'sparkle']];
var dragInfo = null; U.dragInfo = function () { return dragInfo; };
function buildLibTabs() {
  var t = $('libTabs'); t.textContent = '';
  LIB_TABS.forEach(function (x) {
    var b = h('button', { class: 'et', type: 'button', role: 'tab', 'data-tab': x[0], 'aria-selected': String(x[0] === libTab), html: U.ic(x[2], 20) + '<span>' + x[1] + '</span>', onclick: function () { U.libTab(x[0]); } });
    t.appendChild(b);
  });
}
U.libTab = function (n) {
  libTab = n; Array.prototype.forEach.call($('libTabs').children, function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === n)); });
  $('libBody').scrollTop = 0; renderLib(); updateBarState();
};
var libScroll = 0;
function renderLib() {
  var b = $('libBody'); libScroll = b.scrollTop; b.textContent = '';
  ({ media: libMedia, audio: libAudio, text: libText, fx: libFx })[libTab](b);
  b.scrollTop = libScroll;
}
var libRefresh = raf1(function () { if (libTab === 'media' || libTab === 'audio') renderLib(); });
E.on('media', libRefresh);

function pickFiles(addAll) { U.fileAdd = !!addAll; var f = $('edFile'); f.value = ''; f.click(); }
$('edFile').addEventListener('change', function (e) { var fs = e.target.files; if (fs && fs.length) U.importFiles(fs, { add: U.fileAdd }); });
function importBox(addAll, label) { return h('button', { class: 'import-box', type: 'button', html: U.ic('plus') + '<span>' + label + '</span>', onclick: function () { pickFiles(addAll); } }); }
U.importFiles = async function (files, o) {
  o = o || {}; var wasEmpty = !E.hasContent(); U.toast('Importing\u2026');
  var ok = await E.importFiles(files);
  if (!ok.length) return ok;
  if (o.add || (o.addIfEmpty && wasEmpty)) {
    var cur = o.start != null ? o.start : E.t, row = o.row;
    ok.forEach(function (m) { var c = E.addMedia(m.id, { row: (row && E.rowById(row) && E.rowById(row).kind === (m.kind === 'audio' ? 'a' : 'v')) ? row : undefined, start: cur }); if (c) cur = c.start + c.dur; });
  } else if (ok.every(function (m) { return m.kind === 'audio'; })) U.libTab('audio'); else if (libTab !== 'media') U.libTab('media');
  return ok;
};

function sec(t) { return h('div', { class: 'lib-sec', text: t }); }
function mediaCard(m, sample) {
  var key = sample ? sample.key : m.id, name = sample ? sample.name : m.name;
  var el = h('button', { class: 'lib-item', type: 'button', draggable: 'true', title: name + ' \u2014 click to add at the playhead, or drag to the timeline', 'aria-label': 'Add ' + name }, [
    h('img', { alt: '', draggable: 'false', src: sample ? null : (m.thumb || null) }),
    m && m.kind === 'video' ? h('span', { class: 'badge', text: U.dur(m.dur) }) : null,
    h('span', { class: 'add', html: U.ic('plus', 14) }), h('span', { class: 'nm', text: name })]);
  if (sample) el.setAttribute('data-sample', key);
  el.addEventListener('click', function () { var mm = sample ? E.ensureSampleImage(key) : m; if (mm) { var c = E.addMedia(mm.id); if (c) U.toast('Added ' + name); } });
  el.addEventListener('dragstart', function (e) { dragInfo = { kind: 'v', dur: m && m.kind === 'video' ? m.dur : 4 }; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('application/x-snip', JSON.stringify(sample ? { t: 'sample', key: key } : { t: 'media', id: m.id })); e.dataTransfer.setData('text/plain', name); });
  el.addEventListener('dragend', function () { dragInfo = null; });
  return el;
}
function libMedia(b) {
  b.appendChild(importBox(false, 'Import photos, video or music'));
  b.appendChild(sec('Your media'));
  var mine = E.mediaList.map(function (id) { return E.media[id]; }).filter(function (m) { return m && !m.sample && m.kind !== 'audio'; });
  if (!mine.length) b.appendChild(h('div', { class: 'lib-empty', text: 'Nothing imported yet. Photos and videos you import show up here.' }));
  else { var g = h('div', { class: 'lib-grid' }); mine.forEach(function (m) { g.appendChild(mediaCard(m)); }); b.appendChild(g); }
  b.appendChild(sec('Samples'));
  b.appendChild(h('p', { class: 'lib-hint', text: 'Click to add at the playhead, or drag onto the timeline.' }));
  var sg = h('div', { class: 'lib-grid' }); b.appendChild(sg);
  E.SAMPLE_IMAGES.forEach(function (s) { sg.appendChild(mediaCard(null, s)); });
  var imgs = Array.prototype.slice.call(sg.querySelectorAll('[data-sample] img')), i = 0;
  (function next() { if (i >= imgs.length) return; var im = imgs[i++], s = E.SAMPLE_IMAGES[i - 1]; if (im.isConnected) im.src = E.sampleThumb(s); setTimeout(next, 0); })();
}

/* audio tab */
function audioRow(m, def) {
  var name = def ? def.name : m.name, d = def ? def.dur : m.dur, key = def ? def.key : m.id, playing = m && E.aud.previewId() === m.id;
  var pb = h('button', { class: 'a-play', type: 'button', 'aria-pressed': String(!!playing), 'aria-label': 'Preview ' + name, html: U.ic(playing ? 'pause' : 'play', 14) });
  var row = h('div', { class: 'a-row', draggable: 'true' }, [pb, h('div', { class: 'a-nm' }, [h('b', { text: name }), h('small', { text: (def ? def.cat : 'Imported') + ' \u00b7 ' + U.dur(d) })]),
    h('button', { class: 'a-add', type: 'button', 'aria-label': 'Add ' + name + ' to the timeline', title: 'Add at the playhead', html: U.ic('plus', 15) })]);
  async function getM() { return def ? await E.ensureSampleAudio(key) : m; }
  pb.addEventListener('click', async function () {
    var cur = def ? E.media['sample:' + key] : m;
    if (cur && E.aud.previewId() === cur.id) { E.aud.stopPreview(); return; }
    E.pause(); pb.disabled = true;
    try {
      var mm = await getM(); pb.disabled = false;
      E.aud.stopPreview();
      if (mm && E.aud.preview(mm, function () { var b = document.querySelector('.a-play[aria-pressed="true"]'); if (b) { b.setAttribute('aria-pressed', 'false'); b.innerHTML = U.ic('play', 14); } })) {
        Array.prototype.forEach.call(document.querySelectorAll('.a-play'), function (q) { q.setAttribute('aria-pressed', 'false'); q.innerHTML = U.ic('play', 14); });
        pb.setAttribute('aria-pressed', 'true'); pb.innerHTML = U.ic('pause', 14);
      } else U.toast('This sound could not be played.');
    } catch (e) { pb.disabled = false; U.toast('This sound could not be prepared.'); }
  });
  row.querySelector('.a-add').addEventListener('click', async function () { var mm = await getM(); if (mm) { E.addMedia(mm.id); U.toast('Added ' + name); } });
  row.addEventListener('dragstart', function (e) { dragInfo = { kind: 'a', dur: d }; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('application/x-snip', JSON.stringify(def ? { t: 'asample', key: key } : { t: 'media', id: m.id })); e.dataTransfer.setData('text/plain', name); });
  row.addEventListener('dragend', function () { dragInfo = null; });
  return row;
}
function libAudio(b) {
  b.appendChild(importBox(false, 'Import music or sounds'));
  b.appendChild(sec('Your audio'));
  var mine = E.mediaList.map(function (id) { return E.media[id]; }).filter(function (m) { return m && !m.sample && m.kind === 'audio'; });
  if (!mine.length) b.appendChild(h('div', { class: 'lib-empty', text: 'Import an MP3, WAV, M4A or OGG file and it will appear here.' }));
  mine.forEach(function (m) { b.appendChild(audioRow(m)); });
  ['Music', 'Sound effects'].forEach(function (cat) {
    b.appendChild(sec(cat));
    E.SAMPLE_AUDIO.filter(function (s) { return s.cat === cat; }).forEach(function (s) { b.appendChild(audioRow(null, s)); });
  });
}

/* text tab */
var TEXTS = [
  { name: 'Title', str: 'Your title', text: { font: 'Anton', size: 130, color: '#ffffff', shadow: true }, anim: 'zoom', css: "font:400 28px 'Anton';color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6)" },
  { name: 'Caption', str: 'Your caption', text: { font: 'Oswald', size: 58, color: '#ffffff', shadow: false, box: true, boxC: '#101010', boxPad: 22, boxR: 12 }, anim: 'fade', css: "font:500 18px 'Oswald';color:#fff;background:#101010;padding:3px 10px;border-radius:6px" },
  { name: 'Paper unfold', str: 'Unfolded', text: { font: 'Permanent Marker', size: 120, color: '#1b1b1b', shadow: false }, cut: { on: true, style: 'torn', tex: 'plain', color: '#fbf7ee', edge: 24, rough: 50 }, anim: 'unfold', css: "font:400 22px 'Permanent Marker';color:#1b1b1b;background:#fbf7ee;padding:4px 12px;transform:rotate(-2deg)" },
  { name: 'Ransom note', str: 'Cut and paste', text: { ransom: true, size: 110, shadow: false }, anim: 'stop', ransom: true },
  { name: 'Typewriter', str: 'Dear diary', text: { font: 'Special Elite', size: 64, color: '#2a2a2a', shadow: false, box: true, boxC: '#f4ecd8', boxPad: 26, boxR: 6 }, anim: 'slideU', css: "font:400 18px 'Special Elite';color:#2a2a2a;background:#f4ecd8;padding:5px 10px;border-radius:3px" },
  { name: 'Sticker', str: 'Wow!', text: { font: 'Bowlby One', size: 120, color: '#ffd92e', strokeW: 7, strokeC: '#111111', shadow: true }, anim: 'drop', css: "font:400 28px 'Bowlby One';color:#ffd92e;-webkit-text-stroke:3px #111;paint-order:stroke fill" },
  { name: 'Elegant', str: 'Soft focus', text: { font: 'Playfair Display', size: 96, color: '#fbf7ee', bold: true, shadow: true }, anim: 'fade', css: "font:900 26px 'Playfair Display';color:#fbf7ee;text-shadow:0 2px 6px rgba(0,0,0,.55)" },
  { name: 'Cut-out headline', str: 'Snip snip', text: { font: 'Alfa Slab One', size: 120, color: '#e8491a', shadow: false }, cut: { on: true, style: 'scissors', tex: 'plain', color: '#ffffff', edge: 22, rough: 30 }, anim: 'zoom', css: "font:400 24px 'Alfa Slab One';color:#e8491a;background:#fff;padding:2px 10px;border-radius:4px;box-shadow:0 2px 5px rgba(0,0,0,.4)" }
];
function textPreset(i) { var p = TEXTS[i]; return { name: p.name, text: Object.assign({ str: p.str }, p.text), cut: p.cut, anim: { 'in': { t: p.anim, d: p.anim === 'unfold' ? 1.1 : 0.7 } } }; }
U.addTextPreset = function (i, row, start) {
  var c = E.addText(textPreset(i)); if (!c) return null;
  if (row != null || start != null) { E.moveClip(c.id, row || c.row, start != null ? start : c.start); }
  return c;
};
function libText(b) {
  b.appendChild(h('button', { class: 'eb tx-add', type: 'button', html: U.ic('plus') + '<span>Add default text</span>', onclick: function () { U.addTextPreset(0); U.toast('Text added. Edit it in the Edit panel.'); } }));
  b.appendChild(sec('Styles'));
  var g = h('div', { class: 'tx-grid' }); b.appendChild(g);
  TEXTS.forEach(function (p, i) {
    var pv;
    if (p.ransom) {
      pv = h('span', { class: 'pv' }); var cols = [['#fbf7ee', '#1a1a1a', 'Playfair Display'], ['#111', '#f5f0e6', 'Anton'], ['#f2c14e', '#1a1a1a', 'Pacifico'], ['#e8491a', '#fff7ee', 'Rubik Mono One'], ['#2b5fc4', '#f7f3ea', 'Special Elite']];
      'Snip!'.split('').forEach(function (ch, k) { var c = cols[k]; pv.appendChild(h('span', { text: ch, style: { background: c[0], color: c[1], fontFamily: "'" + c[2] + "'", fontSize: '20px', padding: '1px 4px', margin: '0 1px', display: 'inline-block', transform: 'rotate(' + (k % 2 ? 4 : -4) + 'deg)' } })); });
    } else pv = h('span', { class: 'pv', text: p.str, style: { cssText: p.css } });
    var card = h('button', { class: 'tx-card', type: 'button', draggable: 'true', 'aria-label': 'Add ' + p.name + ' text', title: 'Click to add, or drag to the timeline' }, [pv, h('small', { text: p.name })]);
    card.addEventListener('click', function () { U.addTextPreset(i); U.toast(p.name + ' added.'); });
    card.addEventListener('dragstart', function (e) { dragInfo = { kind: 'v', dur: 3 }; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('application/x-snip', JSON.stringify({ t: 'text', i: i })); e.dataTransfer.setData('text/plain', p.name); });
    card.addEventListener('dragend', function () { dragInfo = null; });
    g.appendChild(card);
  });
}

/* effects tab: paper looks and animations for the selected clip */
U.LOOKS = [
  { id: 'torn', name: 'Torn kraft', cut: { style: 'torn', tex: 'kraft', color: '#cbb68d', edge: 16, rough: 55, detail: 55, grain: 45, boil: 3 } },
  { id: 'scissor', name: 'Scissor cut', cut: { style: 'scissors', tex: 'plain', color: '#fbf7ee', edge: 14, rough: 30, detail: 45, grain: 30, boil: 3 } },
  { id: 'sticker', name: 'Sticker', cut: { style: 'scissors', tex: 'plain', color: '#ffffff', edge: 24, rough: 8, detail: 30, grain: 10, boil: 0, shadow: 26 } },
  { id: 'pinking', name: 'Pinking shears', cut: { style: 'pinking', tex: 'cardstock', color: '#f2c14e', edge: 16, rough: 25, detail: 60, grain: 40, boil: 2 } },
  { id: 'deckle', name: 'Deckle edge', cut: { style: 'deckle', tex: 'parchment', color: '#efe3c4', edge: 18, rough: 50, detail: 60, grain: 55, boil: 2 } },
  { id: 'news', name: 'Newsprint', cut: { style: 'torn', tex: 'newsprint', color: '#e9e4d4', edge: 18, rough: 60, detail: 55, grain: 50, boil: 3 } },
  { id: 'note', name: 'Notebook', cut: { style: 'scissors', tex: 'notebook', color: '#fbf6e6', edge: 16, rough: 25, detail: 40, grain: 20, boil: 3 } },
  { id: 'card', name: 'Cardboard', cut: { style: 'torn', tex: 'cardboard', color: '#c9a574', edge: 20, rough: 65, detail: 50, grain: 60, boil: 3 } },
  { id: 'graph', name: 'Graph paper', cut: { style: 'pinking', tex: 'graph', color: '#f4f7f1', edge: 14, rough: 20, detail: 40, grain: 20, boil: 2 } }
];
var lookThumbs = {};
function lookThumb(look) {
  if (lookThumbs[look.id]) return lookThumbs[look.id];
  var m = E.ensureSampleImage('sunflower'), sj = E.subjectOf(m, { on: true, tol: 46, feather: 2, wands: [] }), s = 170 / Math.max(sj.width, sj.height);
  var sm = K.mkCanvas(sj.width * s, sj.height * s); sm.getContext('2d').drawImage(sj, 0, 0, sm.width, sm.height);
  var o = Object.assign({ key: 'look|' + look.id, variant: 0, withBack: false, scale: Math.max(sm.width, sm.height) / 800 * 2.4 }, look.cut), p = K.cutout(sm, o);
  var c = K.mkCanvas(176, 120), x = c.getContext('2d'); x.fillStyle = '#262a31'; x.fillRect(0, 0, 176, 120);
  var k = Math.min(160 / p.width, 114 / p.height); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 6; x.shadowOffsetY = 3; x.drawImage(p, (176 - p.width * k) / 2, (120 - p.height * k) / 2, p.width * k, p.height * k);
  return (lookThumbs[look.id] = c.toDataURL('image/jpeg', 0.8));
}
U.targetClip = function () {
  var c = E.selClip(); if (c && c.kind !== 'audio') return c;
  var rows = E.proj.rows; for (var i = 0; i < rows.length; i++) { if (rows[i].kind !== 'v') continue; var cc = E.clipAt(rows[i].id, E.t); if (cc) return cc; }
  return null;
};
U.applyLook = function (look) {
  var c = U.targetClip(); if (!c) { U.toast('Add a photo, video or text to the timeline first.'); return; }
  E.select(c.id); Object.assign(c.cut, E.clone(look.cut), { on: true });
  E.emit('project'); E.dirty(); E.commit(); U.toast(look.name + ' applied.');
};
var FXANIM = [['in', 'unfold', 'Paper unfold'], ['out', 'fold', 'Paper fold away'], ['in', 'tear', 'Torn reveal'], ['out', 'tear', 'Torn exit'], ['in', 'stop', 'Stop-motion pop'], ['out', 'stop', 'Stop-motion out'], ['combo', 'hop', 'Stop-motion hop'], ['combo', 'wobble', 'Wobble'], ['combo', 'sway', 'Swing']];
U.applyAnim = function (which, id) {
  var c = U.targetClip(); if (!c) { U.toast('Add a photo, video or text to the timeline first.'); return; }
  E.select(c.id); c.anim[which].t = id; if (which !== 'combo' && c.anim[which].d < 0.3) c.anim[which].d = 0.8;
  if ((id === 'unfold' || id === 'fold') && c.kind !== 'audio') { /* paper effects need the cut-out paper, built on the fly */ }
  E.emit('project'); E.dirty(); E.commit(); U.previewAnim(c, which);
};
function libFx(b) {
  b.appendChild(sec('Cut-out looks'));
  b.appendChild(h('p', { class: 'lib-hint', text: 'Pick a clip on the timeline, then tap a look. It turns the photo, video or text into cut paper.' }));
  var g = h('div', { class: 'lib-grid' }); b.appendChild(g);
  var items = U.LOOKS.map(function (l) {
    var im = h('img', { alt: '', draggable: 'false' }), it = h('button', { class: 'lib-item', type: 'button', 'aria-label': 'Apply ' + l.name }, [im, h('span', { class: 'nm', text: l.name })]);
    it.addEventListener('click', function () { U.applyLook(l); }); g.appendChild(it); return { l: l, im: im };
  });
  var i = 0; (function next() { if (i >= items.length) return; var it = items[i++]; if (it.im.isConnected) { try { it.im.src = lookThumb(it.l); } catch (e) { /* preview is optional */ } } setTimeout(next, 0); })();
  b.appendChild(sec('Paper animations'));
  var pl = h('div', { class: 'pills' }); b.appendChild(pl);
  FXANIM.forEach(function (a) { pl.appendChild(h('button', { class: 'pill', type: 'button', text: a.length > 2 ? a[2] : '', onclick: function () { U.applyAnim(a[0], a[1]); } })); });
  b.appendChild(h('p', { class: 'lib-hint', text: 'Animations apply to the selected clip. Fine-tune timing and the fold in the Edit panel.' }));
}

/* ---------- animation preview ---------- */
U.previewAnim = function (c, which) {
  var a = c.anim, from, to;
  if (which === 'out') { var d = Math.min(a.out.d, c.dur); from = Math.max(c.start, c.start + c.dur - d - 0.4); to = c.start + c.dur; }
  else if (which === 'combo') { from = c.start; to = Math.min(c.start + c.dur, c.start + 3); }
  else { var d2 = Math.min(a['in'].d, c.dur); from = c.start; to = Math.min(c.start + c.dur, c.start + d2 + (a['in'].t === 'unfold' ? 0.9 : 0.4)); }
  E.pause(); E.seek(from); U.stopAt = to; E.play();
};

/* ---------- drops onto the player ---------- */
['dragenter', 'dragover'].forEach(function (ev) { stage.addEventListener(ev, function (e) { var t = e.dataTransfer && e.dataTransfer.types; if (t && Array.prototype.indexOf.call(t, 'Files') >= 0) { e.preventDefault(); stage.classList.add('over'); } }); });
stage.addEventListener('dragleave', function () { stage.classList.remove('over'); });
stage.addEventListener('drop', function (e) { stage.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); U.importFiles(e.dataTransfer.files, { add: true }); } });
$('emImport').addEventListener('click', function () { pickFiles(true); });
$('emDemo').addEventListener('click', function () { U.demo(); });

/* ---------- panels on phones ---------- */
function updateBarState() {
  var s = $('ed').getAttribute('data-sheet') || '';
  Array.prototype.forEach.call($('edBar').querySelectorAll('button'), function (b) {
    var n = b.getAttribute('data-bar'); b.setAttribute('aria-pressed', String((s === 'insp' && n === 'insp') || (s === 'lib' && n === libTab)));
  });
}
U.sheet = function (n) {
  var ed = $('ed'), cur = ed.getAttribute('data-sheet') || '', want = n === 'insp' ? 'insp' : n ? 'lib' : '';
  if (!n || (cur === want && (want === 'insp' || n === libTab))) ed.removeAttribute('data-sheet');
  else { ed.setAttribute('data-sheet', want); if (want === 'lib') U.libTab(n); }
  updateBarState(); setTimeout(U.fit, 30);
};
Array.prototype.forEach.call($('edBar').querySelectorAll('button'), function (b) { b.addEventListener('click', function () { U.sheet(b.getAttribute('data-bar')); }); });
Array.prototype.forEach.call(document.querySelectorAll('[data-sheetx]'), function (b) { b.addEventListener('click', function () { U.sheet(null); }); });

/* ---------- open / close ---------- */
U.open = function () {
  if (K.editorOn) return;
  if (K.labPause) K.labPause(); if (K.trackStop) K.trackStop();
  K.editorOn = true; document.body.classList.add('ed-on');
  window.scrollTo(0, 0);
  onProject(); setPlayIcon(); histBtns(); updateBarState();
  if (!U.raf) U.raf = requestAnimationFrame(loop);
  U.fit(); E.dirty(); E.emit('opened');
  setTimeout(U.fit, 60);
};
U.close = function () {
  if (!K.editorOn) return;
  E.pause(); E.aud.stopPreview(); if (U.stopExport) U.stopExport();
  K.editorOn = false; document.body.classList.remove('ed-on');
};
var ob = $('openEd'); if (ob) ob.addEventListener('click', U.open);

/* ---------- keyboard ---------- */
function typingIn(t) { return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|button|color|file)$/.test(t.type))); }
document.addEventListener('keydown', function (e) {
  if (!K.editorOn) return;
  var md = !$('expModal').hidden; if (md) return;
  var t = e.target, mod = e.ctrlKey || e.metaKey, k = e.key, typing = typingIn(t), range = t && t.tagName === 'INPUT' && t.type === 'range';
  if (mod && (k === 'z' || k === 'Z')) { if (typing) return; e.preventDefault(); if (e.shiftKey) E.redo(); else E.undo(); return; }
  if (mod && (k === 'y' || k === 'Y')) { if (typing) return; e.preventDefault(); E.redo(); return; }
  if (typing) return;
  if (k === ' ' || e.code === 'Space') { e.preventDefault(); if (E.hasContent()) { U.stopAt = null; E.toggle(); } return; }
  if (mod && (k === 'b' || k === 'B')) { e.preventDefault(); E.splitAtPlayhead(); return; }
  if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); if (E.sel) E.duplicateClip(E.sel); return; }
  if (mod || e.altKey) return;
  if ((k === 's' || k === 'S') && !range) { E.splitAtPlayhead(); return; }
  if (k === 'Delete' || k === 'Backspace') { if (E.sel) { e.preventDefault(); E.deleteClip(E.sel); } return; }
  if ((k === 'ArrowLeft' || k === 'ArrowRight') && !range) { e.preventDefault(); E.pause(); E.seek(E.t + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / 30)); return; }
  if (k === 'Home') { e.preventDefault(); E.seek(0); return; }
  if (k === 'End') { e.preventDefault(); E.seek(E.end()); return; }
  if (k === 'Escape') { if (U.wand) U.setWand(false); else if ($('ed').getAttribute('data-sheet')) U.sheet(null); else E.select(null); return; }
  if (k === '+' || k === '=') { if (U.tl) U.tl.zoomBy(1.25); return; }
  if (k === '-' || k === '_') { if (U.tl) U.tl.zoomBy(0.8); return; }
});
document.addEventListener('keyup', function (e) { if (K.editorOn && e.code === 'Space' && !typingIn(e.target)) e.preventDefault(); });

/* ---------- a ready-made demo project ---------- */
U.demo = async function () {
  E.pause(); U.toast('Building a demo project\u2026');
  E.newProject('16:9'); E.proj.name = 'Paper demo';
  var kraft = E.ensureSampleImage('bg-kraft'), sun = E.ensureSampleImage('sunflower'), mug = E.ensureSampleImage('mug');
  var a = E.addMedia(kraft.id, { start: 0 }); E.setDuration(a.id, 9);
  var b = E.addMedia(sun.id, { start: 0.5 }); E.setDuration(b.id, 8);
  b.tf.x = -0.24; b.tf.s = 0.92; b.cut.on = true; b.anim['in'] = { t: 'unfold', d: 1.3 }; b.anim.combo = { t: 'sway', sp: 0.8 }; b.anim.out = { t: 'fold', d: 1 };
  var c = E.addMedia(mug.id, { start: 1.5 }); E.setDuration(c.id, 7);
  c.tf.x = 0.25; c.tf.y = 0.08; c.tf.s = 0.82; c.cut.on = true; c.cut.style = 'scissors'; c.cut.color = '#ffffff'; c.anim['in'] = { t: 'stop', d: 0.8 }; c.anim.combo = { t: 'hop', sp: 1 };
  var t = E.addText(textPreset(3)); t.text.str = 'Snip, snip!'; t.text.size = 130; E.moveClip(t.id, t.row, 2.6); t = E.clipById(t.id); t.dur = 6.4; t.tf.y = -0.36;
  E.tidy(); E.select(null); E.emit('project'); E.emit('sel'); E.dirty();
  E.seek(3.4); E.resetHistory(); onProject();
  try {
    var m = await E.ensureSampleAudio('lofi'), ac = E.addMedia(m.id, { start: 0 }); E.setDuration(ac.id, 9); ac.fadeOut = 1.6; ac.vol = 0.8; E.select(null); E.emit('project'); E.resetHistory();
  } catch (e) { /* music is optional */ }
  U.toast('Demo ready. Press Space to play, or click a clip to edit it.');
};

/* ---------- boot ---------- */
fillIcons(); buildLibTabs(); renderLib(); setPlayIcon(); setMute(false, false); histBtns(); setTimeText();
})();
