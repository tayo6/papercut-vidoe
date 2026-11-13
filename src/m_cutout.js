(function () {
'use strict';
var K = window.__snip, $ = K.$, S = K.S, P = K.P, num = K.num, chk = K.chk, sel = K.sel, clamp = K.clamp, lerp = K.lerp, mkCanvas = K.mkCanvas, ease = K.ease;
var M = (K.M = {});

/* ---------- backgrounds ---------- */
var KRAFT = (function () {
  var c = mkCanvas(256, 256), x = c.getContext('2d'); x.fillStyle = '#d9c7a0'; x.fillRect(0, 0, 256, 256);
  x.globalAlpha = 0.9; x.fillStyle = x.createPattern(K.GRAIN, 'repeat'); x.fillRect(0, 0, 256, 256); return c;
})();
M.drawBG = function (ctx, w, h, t, bg) {
  var x, y;
  if (bg === 'none') return;
  if (bg === 'transparent') { for (y = 0; y < h; y += 24) for (x = 0; x < w; x += 24) { ctx.fillStyle = ((x + y) / 24) % 2 ? '#8c8c8c' : '#b9b9b9'; ctx.fillRect(x, y, 24, 24); } }
  else if (bg === 'green') { ctx.fillStyle = '#00b140'; ctx.fillRect(0, 0, w, h); }
  else if (bg === 'mat') {
    var u = w / 960; ctx.fillStyle = '#1f4d39'; ctx.fillRect(0, 0, w, h); ctx.lineWidth = 1;
    for (x = 0; x <= w; x += 30 * u) { ctx.strokeStyle = Math.round(x / (30 * u)) % 5 === 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.13)'; ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); ctx.stroke(); }
    for (y = 0; y <= h; y += 30 * u) { ctx.strokeStyle = Math.round(y / (30 * u)) % 5 === 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.13)'; ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); ctx.stroke(); }
  } else if (bg === 'paper') { ctx.fillStyle = ctx.createPattern(KRAFT, 'repeat'); ctx.fillRect(0, 0, w, h); }
  else if (bg === 'gradient') {
    var a = t * 0.3, g = ctx.createLinearGradient(w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * h, w / 2 - Math.cos(a) * w, h / 2 - Math.sin(a) * h);
    g.addColorStop(0, '#ff9a56'); g.addColorStop(0.5, '#e0457b'); g.addColorStop(1, '#5b4bd6'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (bg === 'color') { ctx.fillStyle = S.bgColor; ctx.fillRect(0, 0, w, h); }
  else if (bg === 'image' && S.bgImg) { var s = Math.max(w / S.bgImg.width, h / S.bgImg.height), iw = S.bgImg.width * s, ih = S.bgImg.height * s; ctx.drawImage(S.bgImg, (w - iw) / 2, (h - ih) / 2, iw, ih); }
  else { ctx.fillStyle = '#1f4d39'; ctx.fillRect(0, 0, w, h); }
};
M.hint = function (ctx, w, h, msg) {
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = K.font('IBM Plex Sans', Math.round(h * 0.035), true).replace(/^\d+/, '600'); ctx.textAlign = 'center'; ctx.fillText(msg, w / 2, h / 2);
};

/* ---------- movement presets (t is already on the stepped clock) ---------- */
M.motion = function (t, w, h) {
  var m = sel('move'), fps = num('boilFps'), r = { dx: 0, dy: 0, rot: 0, sc: 1 }, tq;
  if (m === 'bounce') { r.dy = -Math.abs(Math.sin(t * 3.2)) * 0.09 * h; r.sc = 1 + Math.abs(Math.sin(t * 3.2 + 1.57)) * 0.02; }
  else if (m === 'float') { r.dy = Math.sin(t * 1.4) * 0.025 * h; r.dx = Math.sin(t * 0.9) * 0.015 * w; r.rot = Math.sin(t * 1.1) * 0.04; }
  else if (m === 'stop') { var st = Math.max(2, fps / 2); tq = Math.floor(t * st) / st; r.dy = -Math.abs(Math.sin(tq * 3)) * 0.07 * h; r.rot = Math.sin(tq * 2.2) * 0.07; r.dx = Math.sin(tq * 1.3) * 0.02 * w; }
  else if (m === 'sway') { r.rot = Math.sin(t * 1.6) * 0.13; r.dx = Math.sin(t * 1.6) * 0.02 * w; }
  else if (m === 'wobble') { r.sc = 1 + Math.sin(t * 5) * 0.03; r.rot = Math.sin(t * 7) * 0.045; }
  else if (m === 'spin') { r.rot = t * 0.6; }
  var b = num('boil');
  if (b > 0) { var fr = K.boilIndex(t), u = w / 960; r.dx += (K.hash2(fr, 1, 5) - 0.5) * b * 0.9 * u; r.dy += (K.hash2(fr, 2, 5) - 0.5) * b * 0.9 * u; r.rot += (K.hash2(fr, 3, 5) - 0.5) * b * 0.0035; }
  return r;
};

/* ---------- cut-out ---------- */
var VC = K.lru(10);
function paperSig() { return ['cutStyle', 'paperTex', 'edge', 'rough', 'detail', 'grain', 'boil', 'boilLoop', 'edgeColor'].map(function (id) { return $(id).value; }).join(','); }
M.paperSig = paperSig;
M.subjectPaper = function (t, withBack) {
  if (!P.subj) return null;
  var v = K.variant(t), sig = paperSig() + '|' + P.ver + '|' + v + (withBack ? '|b' : ''), hit = VC.get(sig);
  return hit || VC.set(sig, K.cutout(P.subj, { key: 'p' + P.ver, variant: v, withBack: !!withBack }));
};
M.cutout = function (ctx, w, h, t) {
  var img = M.subjectPaper(t);
  if (!img) { M.hint(ctx, w, h, 'Pick a sample or upload a photo'); return; }
  var mo = M.motion(t, w, h), sc = Math.min(w / img.width, h / img.height) * (num('size') / 100) * mo.sc;
  K.drawShadowed(ctx, K.warp(img, num('distort'), t), w / 2 + mo.dx, h / 2 + mo.dy, sc, mo.rot);
};

/* ---------- note card (used by the unfold mode) ---------- */
var NC = K.lru(12);
M.noteCard = function (t) {
  var txt = $('noteText').value, v = K.variant(t), key = txt + '|' + paperSig() + '|' + v, hit = NC.get(key);
  if (hit) return hit;
  var ls = txt.split('\n'), c = mkCanvas(560, 120 + ls.length * 64), x = c.getContext('2d');
  x.fillStyle = '#fff9e6'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = 'rgba(80,120,200,.25)'; x.lineWidth = 1;
  for (var yy = 60; yy < c.height; yy += 32) { x.beginPath(); x.moveTo(0, yy); x.lineTo(c.width, yy); x.stroke(); }
  x.fillStyle = '#20242c'; x.font = K.font('Special Elite', 34); x.textAlign = 'center'; x.textBaseline = 'middle';
  ls.forEach(function (l, i) { x.fillText(l, c.width / 2, 70 + i * 64, c.width - 50); });
  return NC.set(key, K.cutout(c, { variant: v, withBack: true }));
};
})();
