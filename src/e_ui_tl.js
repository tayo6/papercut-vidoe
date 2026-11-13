(function () {
'use strict';
/* Video editor timeline: rows of clips you can drag, trim, split and snap, a ruler to scrub, zoom, and drops from the library. */
var K = window.__snip, E = K.E, U = E.ui, h = U.h, $ = U.$, clamp = K.clamp;
var scroll = $('tlScroll'), inner = $('tlInner'), TL = U.tl = {};
var HEAD = 46, RH = { v: 56, a: 40 }, pps = 80, snapOn = true, W = 0;
var clipEls = {}, rowEls = {}, laneEls = {}, phEl = null, guideEl = null, ghostEl = null, newEl = null, drag = null, scrub = null;
var STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
TL.pps = function () { return pps; };
TL.addTrack = function (kind) {
  if (kind !== 'v' && kind !== 'a') throw new TypeError('Track kind must be video or audio.');
  var row = E.addRow(kind, kind === 'v' ? 'top' : 'bottom');
  E.emit('project'); E.dirty(); E.commit();
  return row;
};
[ ['tlAddVideo', 'v'], ['tlAddAudio', 'a'] ].forEach(function (item) {
  var button = $(item[0]);
  if (button) button.addEventListener('click', function () { TL.addTrack(item[1]); });
});

function timeAt(clientX) { return (clientX - inner.getBoundingClientRect().left - HEAD) / pps; }
function labelOf(c) { return c.kind === 'text' ? ((c.text.str || 'Text').split('\n')[0] || 'Text') : (c.name || 'Clip'); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function tickLabel(t, step) { if (step < 1) return t.toFixed(1) + 's'; var m = Math.floor(t / 60), s = Math.round(t - m * 60); return m + ':' + pad2(s); }

/* ---------- snapping ---------- */
function targets(ex, noPh) { var a = [0]; if (!noPh) a.push(E.t); E.proj.clips.forEach(function (c) { if (c.id !== ex) a.push(c.start, c.start + c.dur); }); return a; }
function guideAt(t) { if (!guideEl) { guideEl = h('div', { class: 'tl-guide' }); inner.appendChild(guideEl); } guideEl.style.left = (HEAD + t * pps) + 'px'; }
function hideGuide() { if (guideEl) { guideEl.remove(); guideEl = null; } }
function snapSpan(start, d, ex) {
  if (!snapOn) { hideGuide(); return start; }
  var th = 8 / pps, best = null;
  targets(ex).forEach(function (p) { [p - start, p - (start + d)].forEach(function (q) { if (Math.abs(q) < th && (!best || Math.abs(q) < Math.abs(best.d))) best = { d: q, p: p }; }); });
  if (best) { guideAt(best.p); return start + best.d; }
  hideGuide(); return start;
}
function snapAt(t, ex, noPh) {
  if (!snapOn) { hideGuide(); return t; }
  var th = 8 / pps, best = null;
  targets(ex, noPh).forEach(function (p) { var q = p - t; if (Math.abs(q) < th && (!best || Math.abs(q) < Math.abs(best.d))) best = { d: q, p: p }; });
  if (best) { guideAt(best.p); return t + best.d; }
  hideGuide(); return t;
}

/* ---------- building the DOM ---------- */
function stripUrl(m) {
  if (m.stripUrl) return m.stripUrl;
  if (m.strip && !m.stripBusy) { m.stripBusy = true; m.strip.canvas.toBlob(function (b) { if (b) { m.stripUrl = URL.createObjectURL(b); repaintAll(); } }, 'image/jpeg', 0.75); }
  return null;
}
function waveEl(c, m) {
  var w = Math.max(4, Math.round(c.dur * pps)), cw = Math.min(w, 4096), chh = RH.a - 8, cvs = h('canvas', { class: 'c-wave', width: cw, height: chh }), x = cvs.getContext('2d'), pk = m.peaks;
  if (pk) {
    x.fillStyle = 'rgba(255,255,255,.82)';
    for (var i = 0; i < cw; i++) {
      var t0 = c['in'] + i / cw * c.dur, t1 = c['in'] + (i + 1) / cw * c.dur, a = Math.floor(t0 * pk.perSec), b = Math.max(a + 1, Math.ceil(t1 * pk.perSec)), mx = 0;
      for (var j = a; j < b && j < pk.data.length; j++) if (pk.data[j] > mx) mx = pk.data[j];
      var hh = Math.max(1.5, mx / 255 * (chh - 8)); x.fillRect(i, (chh - hh) / 2, 1, hh);
    }
  }
  return cvs;
}
function paintClip(el, c) {
  var bg = el.querySelector('.c-bg'), m = c.media && E.media[c.media], ch = (c.kind === 'audio' ? RH.a : RH.v) - 8;
  bg.textContent = ''; bg.style.backgroundImage = '';
  if (c.kind === 'image' && m && m.thumb) bg.style.backgroundImage = 'url(' + m.thumb + ')';
  else if (c.kind === 'video' && m) {
    var su = stripUrl(m);
    if (su && m.strip) {
      var st = m.strip, tw = Math.max(16, Math.round(st.tw * ch / st.th)), n = Math.max(1, Math.ceil(c.dur * pps / tw)), tiles = h('div', { class: 'c-tiles' });
      for (var i = 0; i < n; i++) {
        var t = c['in'] + (i + 0.5) * tw / pps, fi = clamp(Math.floor(t / m.dur * st.n), 0, st.n - 1);
        tiles.appendChild(h('i', { style: { width: tw + 'px', backgroundImage: 'url(' + su + ')', backgroundSize: (st.n * tw) + 'px 100%', backgroundPosition: (-fi * tw) + 'px 0' } }));
      }
      bg.appendChild(tiles);
    } else if (m.thumb) bg.style.backgroundImage = 'url(' + m.thumb + ')';
  } else if (c.kind === 'audio' && m) bg.appendChild(waveEl(c, m));
  else if (c.kind === 'text') bg.appendChild(h('div', { class: 'c-txt', text: 'T' }));
}
function buildClip(c) {
  var el = h('div', { class: 'clip k-' + c.kind, 'data-id': c.id, tabindex: '0', role: 'button', 'aria-label': labelOf(c) + ', ' + c.kind + ' clip, starts at ' + c.start.toFixed(1) + ' seconds, lasts ' + c.dur.toFixed(1) + ' seconds' });
  el.style.left = (c.start * pps) + 'px'; el.style.width = Math.max(6, c.dur * pps) + 'px';
  el.appendChild(h('div', { class: 'c-bg' }));
  var di = c.anim['in'].t !== 'none' ? Math.min(c.anim['in'].d, c.dur) : 0, dO = c.anim.out.t !== 'none' ? Math.min(c.anim.out.d, c.dur) : 0;
  if (di > 0 && c.kind !== 'audio') el.appendChild(h('i', { class: 'c-in', style: { width: Math.max(6, di * pps) + 'px' } }));
  if (dO > 0 && c.kind !== 'audio') el.appendChild(h('i', { class: 'c-out', style: { width: Math.max(6, dO * pps) + 'px' } }));
  if (c.kind !== 'audio' && c.cut.on) el.appendChild(h('i', { class: 'c-cut', title: 'Paper cut-out', html: U.ic('scissors', 12) }));
  el.appendChild(h('span', { class: 'c-name', text: labelOf(c) }));
  var hl = h('i', { class: 'h hl' }), hr = h('i', { class: 'h hr' }); el.appendChild(hl); el.appendChild(hr);
  paintClip(el, c);
  var cw = Math.max(6, c.dur * pps);
  E.kfTimes(c).forEach(function (t) { if (t < -1e-6 || t > c.dur + 1e-6) return; el.appendChild(h('i', { class: 'kfm', 'data-t': String(t), title: 'Keyframe: click to jump here, drag to move it', style: { left: clamp(t * pps, 7, Math.max(7, cw - 7)) + 'px' }, html: U.kfIcon(11) })); });
  if (E.listClipScriptCues) E.listClipScriptCues(c).forEach(function (q) {
    if (q.at < -1e-6 || q.at > c.dur + 1e-6) return;
    el.appendChild(h('i', { class: 'scrmk' + (c.scriptEnabled ? '' : ' off'), 'data-line': String(q.line), 'data-at': String(q.at), 'data-mode': q.mode,
      title: (q.mode === 'tween' ? 'Script tween: ' : 'Script event: ') + q.property + ' at ' + q.at.toFixed(2) + 's — tap to jump, drag to retime',
      'aria-label': 'Script cue for ' + q.property + ' at ' + q.at.toFixed(2) + ' seconds',
      style: { left: clamp(q.at * pps, 5, Math.max(5, cw - 5)) + 'px' } }));
  });
  el.addEventListener('pointerdown', function (e) {
    var sm = e.target.closest && e.target.closest('.scrmk'), km = e.target.closest && e.target.closest('.kfm');
    if (sm) startScriptCue(e, c.id, sm); else if (km) startKf(e, c.id, km); else if (e.target === hl) startTrim(e, c.id, 'l'); else if (e.target === hr) startTrim(e, c.id, 'r'); else startMove(e, c.id);
  });
  el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); E.select(c.id); } });
  clipEls[c.id] = el; return el;
}
function buildRow(r) {
  var row = h('div', { class: 'tl-row rk-' + r.kind + ((r.kind === 'v' ? r.hide : r.mute) ? ' off' : ''), 'data-row': r.id, style: { height: RH[r.kind] + 'px' } });
  var off = r.kind === 'v' ? r.hide : r.mute, nm = r.kind === 'v' ? (off ? 'Show track' : 'Hide track') : (off ? 'Unmute track' : 'Mute track');
  var peers = E.proj.rows.filter(function (x) { return x.kind === r.kind; }), trackNo = peers.indexOf(r) + 1;
  row.appendChild(h('div', { class: 'tl-head' }, [h('span', { class: 'tl-track-name', text: r.scriptName || ((r.kind === 'v' ? 'V' : 'A') + trackNo), title: r.scriptName ? (r.scriptName + ' track') : ((r.kind === 'v' ? 'Video' : 'Audio') + ' track ' + trackNo) }), h('button', { class: 'rb', type: 'button', title: nm, 'aria-label': nm, 'aria-pressed': String(!!off), html: U.ic(r.kind === 'v' ? (off ? 'eyeoff' : 'eye') : (off ? 'mute' : 'vol'), 16), onclick: function () { E.setRowFlag(r.id, r.kind === 'v' ? 'hide' : 'mute'); } })]));
  var lane = h('div', { class: 'tl-lane', style: { width: W + 'px' } });
  lane.addEventListener('click', function (e) { if (e.target !== lane) return; E.select(null); E.pause(); E.seek(Math.max(0, timeAt(e.clientX))); });
  E.rowClips(r.id).forEach(function (c) { lane.appendChild(buildClip(c)); });
  row.appendChild(lane); rowEls[r.id] = row; laneEls[r.id] = lane; return row;
}
function buildRuler() {
  var ruler = h('div', { class: 'tl-ruler' }), rt = h('div', { class: 'tl-rt', style: { width: W + 'px' } }), total = W / pps, step = STEPS[STEPS.length - 1], i;
  for (i = 0; i < STEPS.length; i++) if (STEPS[i] * pps >= 74) { step = STEPS[i]; break; }
  rt.style.backgroundImage = 'linear-gradient(90deg, #363b44 1px, transparent 1px)'; rt.style.backgroundSize = (step / 5 * pps) + 'px 5px'; rt.style.backgroundRepeat = 'repeat-x'; rt.style.backgroundPosition = '0 100%';
  for (i = 0; i * step <= total + 1e-6; i++) rt.appendChild(h('span', { class: 'mj', style: { left: (i * step * pps) + 'px' }, text: tickLabel(i * step, step) }));
  rt.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; E.pause(); scrub = { pid: e.pointerId }; try { rt.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } scrubTo(e); e.preventDefault(); });
  rt.addEventListener('pointermove', function (e) { if (scrub) scrubTo(e); });
  var end = function () { scrub = null; hideGuide(); }; rt.addEventListener('pointerup', end); rt.addEventListener('pointercancel', end);
  ruler.appendChild(h('div', { class: 'tl-corner' })); ruler.appendChild(rt); return ruler;
}
function scrubTo(e) { E.seek(snapAt(Math.max(0, timeAt(e.clientX)), null, true)); }

function build() {
  var sl = scroll.scrollLeft, st = scroll.scrollTop;
  drag = null; scrub = null; clipEls = {}; rowEls = {}; laneEls = {}; guideEl = ghostEl = newEl = null;
  var vw = scroll.clientWidth - HEAD, total = Math.max(E.end() + 10, vw / pps + 1, 24); W = Math.ceil(total * pps);
  inner.textContent = ''; inner.style.width = (HEAD + W) + 'px'; inner.style.setProperty('--head', HEAD + 'px');
  inner.appendChild(buildRuler());
  E.proj.rows.forEach(function (r) { inner.appendChild(buildRow(r)); });
  phEl = h('div', { class: 'tl-ph' }, [h('i')]); inner.appendChild(phEl);
  if (!E.hasContent()) { var vr = E.proj.rows.filter(function (r) { return r.kind === 'v'; }).pop(); if (vr && laneEls[vr.id]) laneEls[vr.id].appendChild(h('div', { class: 'tl-hint', text: 'Drag media here, or click an item in the library' })); }
  placePh(); markSel(); tools();
  scroll.scrollLeft = sl; scroll.scrollTop = st;
  $('tlZoom').value = pps;
}
TL.build = build;
var buildSoon = U.raf1(build);
function repaintAll() { E.proj.clips.forEach(function (c) { var el = clipEls[c.id]; if (el) paintClip(el, c); }); }
function placePh() { if (phEl) phEl.style.left = (HEAD + E.t * pps) + 'px'; }
function markSel() { Object.keys(clipEls).forEach(function (id) { clipEls[id].classList.toggle('sel', id === E.sel); }); }
function tools() { var has = !!E.sel; $('tlDup').disabled = !has; $('tlDel').disabled = !has; }
function follow(force) {
  if ((!E.playing && !force) || drag || scrub) return;
  var x = HEAD + E.t * pps, l = scroll.scrollLeft, vw = scroll.clientWidth;
  if (x > l + vw - 24 || x < l + HEAD) scroll.scrollLeft = Math.max(0, x - HEAD - vw * 0.25);
}

/* ---------- geometry of rows while dragging ---------- */
function targetRow(clientY, kind) {
  var ir = inner.getBoundingClientRect(), sr = scroll.getBoundingClientRect(), iy = clientY - ir.top, rows = E.proj.rows.filter(function (r) { return r.kind === kind; });
  if (!rows.length) return { id: 'new-bottom', y: iy };
  var first = rowEls[rows[0].id], last = rowEls[rows[rows.length - 1].id];
  if (kind === 'v' && clientY < sr.top + 30) return { id: 'new-top', y: first.offsetTop };
  if (kind === 'a' && iy > last.offsetTop + last.offsetHeight + 10) return { id: 'new-bottom', y: last.offsetTop + last.offsetHeight };
  var best = rows[0].id, bd = Infinity;
  rows.forEach(function (r) { var el = rowEls[r.id], top = el.offsetTop, bot = top + el.offsetHeight, d = iy < top ? top - iy : iy > bot ? iy - bot : 0; if (d < bd) { bd = d; best = r.id; } });
  return { id: best };
}
function showGhost(tr, start, d) {
  if (ghostEl) { ghostEl.remove(); ghostEl = null; } if (newEl) { newEl.remove(); newEl = null; }
  if (tr.id === 'new-top' || tr.id === 'new-bottom') { newEl = h('div', { class: 'tl-newrow', style: { top: (tr.y - 1) + 'px' } }); inner.appendChild(newEl); return start; }
  var res = E.freeStart(tr.id, start, d, drag ? drag.id : undefined);
  ghostEl = h('div', { class: 'tl-ghost', style: { left: (res * pps) + 'px', width: Math.max(6, d * pps) + 'px' } }); laneEls[tr.id].appendChild(ghostEl); return res;
}
function clearGhost() { if (ghostEl) { ghostEl.remove(); ghostEl = null; } if (newEl) { newEl.remove(); newEl = null; } hideGuide(); }

/* ---------- moving a clip ---------- */
function startMove(e, id) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  var c = E.clipById(id); if (!c) return;
  var wasSel = E.sel === id; E.select(id);
  if (e.pointerType === 'touch' && !wasSel) return; /* first tap selects; the next drag moves it */
  drag = { type: 'move', id: id, kind: E.rowKind(c), sx: e.clientX, sy: e.clientY, ss: scroll.scrollLeft, s0: c.start, moved: false, el: clipEls[id], pid: e.pointerId, last: e };
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onCancel);
  autoScroll();
}
function onMove(e) {
  var d = drag; if (!d || e.pointerId !== d.pid) return; d.last = e;
  if (d.type === 'trim') { trimTo(e); return; }
  if (d.type === 'kf') { kfTo(e); return; }
  if (d.type === 'scriptCue') { scriptCueTo(e); return; }
  var c = E.clipById(d.id); if (!c) return;
  if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 5) return;
  d.moved = true; d.el.classList.add('drag');
  var start = Math.max(0, d.s0 + (e.clientX - d.sx + scroll.scrollLeft - d.ss) / pps); start = snapSpan(start, c.dur, d.id);
  var tr = targetRow(e.clientY, d.kind); d.target = tr.id; d.start = showGhost(tr, start, c.dur); if (tr.id.indexOf('new') === 0) d.start = start;
  d.el.style.transform = 'translate(' + ((start - d.s0) * pps) + 'px,' + (e.clientY - d.sy) + 'px)';
}
function onUp(e) {
  var d = drag; if (!d || e.pointerId !== d.pid) return;
  unhook(); clearGhost();
  if (d.type === 'trim') { drag = null; E.emit('project'); E.commit(); return; }
  if (d.type === 'kf' || d.type === 'scriptCue') { drag = null; if (d.moved) { E.emit('project'); E.commit(); } return; }
  var id = d.id, moved = d.moved, tgt = d.target, st = d.start; drag = null;
  if (d.el) { d.el.classList.remove('drag'); d.el.style.transform = ''; }
  if (moved && tgt) E.moveClip(id, tgt, st);
}
function onCancel(e) { var d = drag; if (!d) return; unhook(); clearGhost(); if (d.el) { d.el.classList.remove('drag'); d.el.style.transform = ''; } if (d.type === 'trim' || ((d.type === 'kf' || d.type === 'scriptCue') && d.moved)) { E.emit('project'); E.commit(); } drag = null; }
function unhook() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onCancel); }
function autoScroll() {
  if (!drag) return;
  var r = scroll.getBoundingClientRect(), e = drag.last, x = e ? e.clientX : -1, sp = 0;
  if (x > r.right - 48) sp = Math.min(24, (x - (r.right - 48)) / 2); else if (x < r.left + HEAD + 40 && x >= r.left) sp = -Math.min(24, (r.left + HEAD + 40 - x) / 2);
  if (sp) { scroll.scrollLeft += sp; if (e) onMove(e); }
  requestAnimationFrame(autoScroll);
}

/* ---------- trimming ---------- */
function startTrim(e, id, side) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.stopPropagation(); e.preventDefault(); E.select(id); E.pause();
  drag = { type: 'trim', id: id, side: side, pid: e.pointerId, el: clipEls[id], last: e };
  try { e.target.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onCancel);
  autoScroll();
}
var repaintSoon = U.raf1(function () { if (drag && drag.type === 'trim') { var c = E.clipById(drag.id), el = clipEls[drag.id]; if (c && el) paintClip(el, c); } });
function trimTo(e) {
  var d = drag, c = E.clipById(d.id); if (!c) return;
  var t = snapAt(Math.max(0, timeAt(e.clientX)), d.id, false);
  E.trimClip(d.id, d.side, t, true);
  var el = clipEls[d.id]; el.style.left = (c.start * pps) + 'px'; el.style.width = Math.max(6, c.dur * pps) + 'px';
  if (c.kind === 'video' || c.kind === 'audio') repaintSoon();
  E.seek(d.side === 'l' ? c.start : Math.max(c.start, c.start + c.dur - 0.034));
}

/* ---------- keyframe diamonds: click to jump the playhead there, drag to move them in time ---------- */
function startKf(e, id, mk) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  var c = E.clipById(id); if (!c) return;
  e.stopPropagation(); e.preventDefault(); E.select(id); E.pause();
  var t0 = parseFloat(mk.getAttribute('data-t')) || 0;
  drag = { type: 'kf', id: id, mk: mk, t: t0, moved: false, sx: e.clientX, pid: e.pointerId, last: e };
  E.seek(c.start + clamp(t0, 0, c.dur));
  try { mk.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onCancel);
}
function kfTo(e) {
  var d = drag, c = E.clipById(d.id); if (!c) return;
  if (!d.moved && Math.abs(e.clientX - d.sx) < 4) return;
  d.moved = true;
  var t = Math.round(clamp(timeAt(e.clientX) - c.start, 0, c.dur) * 100) / 100, got = E.moveKfTime(c, d.t, t);
  d.t = got; d.mk.setAttribute('data-t', String(got)); d.mk.style.left = clamp(got * pps, 7, Math.max(7, c.dur * pps - 7)) + 'px';
  E.dirty(); E.seek(c.start + got);
}
function startScriptCue(e, id, mk) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  var c = E.clipById(id); if (!c || !E.moveClipScriptCue) return;
  e.stopPropagation(); e.preventDefault(); E.select(id); E.pause();
  var at = parseFloat(mk.getAttribute('data-at')) || 0;
  drag = { type: 'scriptCue', id: id, line: +mk.getAttribute('data-line'), at: at, moved: false, sx: e.clientX, pid: e.pointerId, mk: mk, last: e };
  E.seek(c.start + at);
  try { mk.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onCancel);
}
function scriptCueTo(e) {
  var d = drag, c = E.clipById(d.id); if (!c) return;
  if (!d.moved && Math.abs(e.clientX - d.sx) < 4) return;
  d.moved = true;
  var next = Math.round(clamp(timeAt(e.clientX) - c.start, 0, c.dur) * 100) / 100;
  try {
    var got = E.moveClipScriptCue(c, d.line, next);
    d.at = got; d.mk.setAttribute('data-at', String(got));
    var q = E.listClipScriptCues(c).filter(function (x) { return x.line === d.line; })[0];
    d.mk.style.left = clamp(got * pps, 5, Math.max(5, c.dur * pps - 5)) + 'px';
    if (q) d.mk.title = (q.mode === 'tween' ? 'Script tween: ' : 'Script event: ') + q.property + ' at ' + got.toFixed(2) + 's — tap to jump, drag to retime';
    E.dirty(); E.seek(c.start + got);
  } catch (err) { U.toast(err && err.message ? err.message : 'Could not move script cue.'); }
}

/* ---------- drops from the library or the desktop ---------- */
function hasType(e, t) { var a = e.dataTransfer && e.dataTransfer.types; return !!a && Array.prototype.indexOf.call(a, t) >= 0; }
inner.addEventListener('dragover', function (e) {
  if (!hasType(e, 'application/x-snip') && !hasType(e, 'Files')) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  var info = U.dragInfo() || { kind: 'v', dur: 3 }, tr = targetRow(e.clientY, info.kind);
  showGhost(tr, Math.max(0, timeAt(e.clientX)), info.dur);
});
inner.addEventListener('dragleave', function (e) { if (!e.relatedTarget || !inner.contains(e.relatedTarget)) clearGhost(); });
inner.addEventListener('drop', function (e) {
  var raw = e.dataTransfer && e.dataTransfer.getData('application/x-snip'), files = e.dataTransfer && e.dataTransfer.files;
  var info = U.dragInfo() || { kind: 'v' }, tr = targetRow(e.clientY, raw ? info.kind : 'v'), at = Math.max(0, timeAt(e.clientX));
  clearGhost();
  if (raw) { e.preventDefault(); try { U.dropAdd(JSON.parse(raw), tr.id, at); } catch (er) { /* bad payload */ } }
  else if (files && files.length) { e.preventDefault(); U.importFiles(files, { add: true, row: tr.id.indexOf('new') === 0 ? undefined : tr.id, start: at }); }
});
U.dropAdd = async function (info, rowSpec, start) {
  if (info.t === 'text') { U.addTextPreset(info.i, rowSpec, start); return; }
  var m = null;
  if (info.t === 'media') m = E.media[info.id]; else if (info.t === 'sample') m = E.ensureSampleImage(info.key); else if (info.t === 'asample') m = await E.ensureSampleAudio(info.key);
  if (!m) return;
  var rid = rowSpec; if (rid === 'new-top' || rid === 'new-bottom') rid = E.addRow(m.kind === 'audio' ? 'a' : 'v', rid === 'new-top' ? 'top' : 'bottom').id;
  var rr = E.rowById(rid); if (!rr || rr.kind !== (m.kind === 'audio' ? 'a' : 'v')) rid = undefined;
  E.addMedia(m.id, { row: rid, start: start });
};

/* ---------- zoom ---------- */
TL.setPps = function (v) {
  v = clamp(v, 20, 300); if (Math.abs(v - pps) < 0.01) return;
  var vw = scroll.clientWidth, x = HEAD + E.t * pps - scroll.scrollLeft, anchor = (x > HEAD && x < vw) ? E.t : (scroll.scrollLeft + vw / 2 - HEAD) / pps, vx = HEAD + anchor * pps - scroll.scrollLeft;
  pps = v; build(); scroll.scrollLeft = Math.max(0, HEAD + anchor * pps - vx);
};
TL.zoomBy = function (k) { TL.setPps(pps * k); };
TL.fit = function () { TL.setPps((scroll.clientWidth - HEAD - 30) / Math.max(E.end(), 2)); scroll.scrollLeft = 0; };
$('tlZoom').addEventListener('input', function () { TL.setPps(+$('tlZoom').value); });
$('tlZoomIn').addEventListener('click', function () { TL.zoomBy(1.25); });
$('tlZoomOut').addEventListener('click', function () { TL.zoomBy(0.8); });
$('tlFit').addEventListener('click', function () { TL.fit(); });
scroll.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); TL.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); } }, { passive: false });

/* ---------- toolbar ---------- */
$('tlSplit').addEventListener('click', function () { E.splitAtPlayhead(); });
$('tlDup').addEventListener('click', function () { if (E.sel) E.duplicateClip(E.sel); });
$('tlDel').addEventListener('click', function () { if (E.sel) E.deleteClip(E.sel); });
$('tlSnap').addEventListener('click', function () { snapOn = !snapOn; $('tlSnap').setAttribute('aria-pressed', String(snapOn)); });

/* ---------- events ---------- */
E.on('project', buildSoon);
E.on('sel', function () { markSel(); tools(); });
E.on('time', function () { placePh(); follow(false); });
E.on('media-thumb', function () { repaintAll(); });
E.on('opened', function () { build(); follow(true); });
window.addEventListener('resize', function () { if (K.editorOn) buildSoon(); });
})();
