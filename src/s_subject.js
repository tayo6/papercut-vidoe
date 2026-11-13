(function () {
'use strict';
var K = window.__snip, $ = K.$, num = K.num, chk = K.chk, mkCanvas = K.mkCanvas, boxBlur = K.boxBlur;
var P = { sw: 0, sh: 0, src: null, base: null, edits: null, subj: null, full: null, ver: 0, fit: null };
K.P = P;
var rctx = $('refine').getContext('2d');
var tool = null, composePending = false, down = false;
var SUBJ_RES = 560;

function loadImageSource(img) {
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  var s = Math.min(1, 640 / Math.max(iw, ih)), w = Math.max(8, Math.round(iw * s)), h = Math.max(8, Math.round(ih * s));
  var c = mkCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  P.sw = w; P.sh = h; P.src = x.getImageData(0, 0, w, h); P.edits = new Int8Array(w * h);
  computeBase(); compose();
}

/* Flood fill over similar colour. Transparent pixels always count as background. */
function flood(seeds, ref, tol, alphaOnly) {
  var w = P.sw, h = P.sh, d = P.src.data, seen = new Uint8Array(w * h), stack = [], tol2 = tol * tol;
  function ok(p) {
    var q = p * 4; if (d[q + 3] < 10) return true; if (alphaOnly) return false;
    var dr = d[q] - ref[0], dg = d[q + 1] - ref[1], db = d[q + 2] - ref[2]; return dr * dr + dg * dg + db * db <= tol2;
  }
  seeds.forEach(function (p) { if (!seen[p] && ok(p)) { seen[p] = 1; stack.push(p); } });
  var i, x, y;
  function push(p) { if (!seen[p] && ok(p)) { seen[p] = 1; stack.push(p); } }
  while (stack.length) {
    i = stack.pop(); x = i % w; y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  return seen;
}

function computeBase() {
  var w = P.sw, h = P.sh, d = P.src.data, n = w * h, i, x, y;
  P.base = new Float32Array(n); P.base.fill(1);
  if (!chk('rmBg')) return;
  var cs = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]], rs = [], gs = [], bs = [], clear = 0;
  cs.forEach(function (c) { var q = (c[1] * w + c[0]) * 4; rs.push(d[q]); gs.push(d[q + 1]); bs.push(d[q + 2]); if (d[q + 3] < 10) clear++; });
  function med(a) { a.sort(function (p, q) { return p - q; }); return (a[1] + a[2]) / 2; }
  var seeds = [];
  for (x = 0; x < w; x++) { seeds.push(x); seeds.push((h - 1) * w + x); }
  for (y = 0; y < h; y++) { seeds.push(y * w); seeds.push(y * w + w - 1); }
  var seen = flood(seeds, [med(rs), med(gs), med(bs)], num('tol'), clear >= 3);
  for (i = 0; i < n; i++) if (seen[i]) P.base[i] = 0;
}

function compose() {
  if (!P.src) return;
  var w = P.sw, h = P.sh, n = w * h, a = new Float32Array(n), i, e;
  for (i = 0; i < n; i++) { e = P.edits[i]; a[i] = e === 1 ? 0 : e === 2 ? 1 : P.base[i]; }
  var f = num('feather');
  if (f > 0) { boxBlur(a, w, h, f); for (i = 0; i < n; i++) a[i] = K.smooth(0.3, 0.7, a[i]); }
  var full = mkCanvas(w, h), fx = full.getContext('2d'), id = fx.createImageData(w, h), d = id.data, s = P.src.data;
  var minx = w, miny = h, maxx = 0, maxy = 0, x, y, q;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
    i = y * w + x; q = i * 4;
    d[q] = s[q]; d[q + 1] = s[q + 1]; d[q + 2] = s[q + 2]; d[q + 3] = Math.round(a[i] * s[q + 3]);
    if (a[i] > 0.25 && s[q + 3] > 20) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  fx.putImageData(id, 0, 0); P.full = full;
  if (maxx <= minx || maxy <= miny) { minx = 0; miny = 0; maxx = w - 1; maxy = h - 1; }
  var bw = maxx - minx + 1, bh = maxy - miny + 1, sc = SUBJ_RES / Math.max(bw, bh);
  var t = mkCanvas(bw * sc, bh * sc), tx = t.getContext('2d'); tx.imageSmoothingQuality = 'high';
  tx.drawImage(full, minx, miny, bw, bh, 0, 0, t.width, t.height);
  P.subj = t; P.ver++; drawRefine();
}
function scheduleCompose() { if (composePending) return; composePending = true; requestAnimationFrame(function () { composePending = false; compose(); }); }

function drawRefine() {
  var cw = 320, ch = 220, u, v;
  rctx.clearRect(0, 0, cw, ch);
  for (v = 0; v < ch; v += 10) for (u = 0; u < cw; u += 10) { rctx.fillStyle = ((u + v) / 10) % 2 ? '#9a9a9a' : '#c4c4c4'; rctx.fillRect(u, v, 10, 10); }
  if (!P.full) return;
  var s = Math.min(cw / P.sw, ch / P.sh), ox = (cw - P.sw * s) / 2, oy = (ch - P.sh * s) / 2;
  P.fit = { s: s, ox: ox, oy: oy }; rctx.drawImage(P.full, ox, oy, P.sw * s, P.sh * s);
}
function toImage(e) {
  var r = $('refine').getBoundingClientRect(), cx = (e.clientX - r.left) * (320 / r.width), cy = (e.clientY - r.top) * (220 / r.height);
  return { x: (cx - P.fit.ox) / P.fit.s, y: (cy - P.fit.oy) / P.fit.s };
}
function paintAt(e) {
  if (!P.fit || (tool !== 'erase' && tool !== 'keep')) return;
  var p = toImage(e), rad = 12 / P.fit.s, v = tool === 'erase' ? 1 : 2;
  var x0 = Math.max(0, Math.floor(p.x - rad)), x1 = Math.min(P.sw - 1, Math.ceil(p.x + rad)), y0 = Math.max(0, Math.floor(p.y - rad)), y1 = Math.min(P.sh - 1, Math.ceil(p.y + rad)), x, y;
  for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) if ((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) <= rad * rad) P.edits[y * P.sw + x] = v;
  scheduleCompose();
}
function wandAt(e) {
  var p = toImage(e), x = Math.round(p.x), y = Math.round(p.y);
  if (x < 0 || y < 0 || x >= P.sw || y >= P.sh) return;
  var q = (y * P.sw + x) * 4, d = P.src.data, seen = flood([y * P.sw + x], [d[q], d[q + 1], d[q + 2]], num('tol'), false), v = tool === 'wandOff' ? 1 : 2;
  for (var i = 0; i < seen.length; i++) if (seen[i]) P.edits[i] = v;
  compose(); K.setStatus(tool === 'wandOff' ? 'Removed the connected area of similar colour.' : 'Kept the connected area of similar colour.');
}
$('refine').addEventListener('pointerdown', function (e) {
  if (!tool || !P.fit) return;
  if (tool === 'wandOff' || tool === 'wandKeep') { wandAt(e); return; }
  down = true; $('refine').setPointerCapture(e.pointerId); paintAt(e);
});
$('refine').addEventListener('pointermove', function (e) { if (down) paintAt(e); });
$('refine').addEventListener('pointerup', function () { down = false; });
$('refine').addEventListener('pointercancel', function () { down = false; });

var TOOLS = { wandOff: 'wandOff', wandKeep: 'wandKeep', brushErase: 'erase', brushKeep: 'keep' };
function setTool(t) {
  tool = tool === t ? null : t;
  Object.keys(TOOLS).forEach(function (id) { $(id).setAttribute('aria-pressed', tool === TOOLS[id]); });
  $('refine').style.cursor = tool ? 'crosshair' : 'default';
}
Object.keys(TOOLS).forEach(function (id) { $(id).addEventListener('click', function () { setTool(TOOLS[id]); }); });
$('brushReset').addEventListener('click', function () { if (P.edits) { P.edits.fill(0); compose(); } });
['tol', 'rmBg'].forEach(function (id) {
  $(id).addEventListener('input', function () { if (P.src) { computeBase(); compose(); } });
  $(id).addEventListener('change', function () { if (P.src) { computeBase(); compose(); } });
});
$('feather').addEventListener('input', function () { if (P.src) compose(); });

function loadFile(file) {
  if (!file) return;
  var url = URL.createObjectURL(file), img = new Image();
  img.onload = function () { loadImageSource(img); URL.revokeObjectURL(url); K.setStatus('Photo loaded. Adjust tolerance, or tap the preview with a click tool to clean the cut.'); };
  img.onerror = function () { K.setStatus('That file could not be read as an image.'); URL.revokeObjectURL(url); };
  img.src = url;
}
$('photoFile').addEventListener('change', function (e) { loadFile(e.target.files[0]); e.target.value = ''; });
K.loadPhotoFile = loadFile;

/* ---------- drawn sample photos so the studio opens working ---------- */
function ell(x, cx, cy, rx, ry, rot, fill, stroke) {
  x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 7); x.fillStyle = fill; x.fill();
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = 3; x.stroke(); }
}
var SAMPLES = {
  sunflower: function () {
    var c = mkCanvas(640, 460), x = c.getContext('2d'); x.fillStyle = '#cfe6ef'; x.fillRect(0, 0, 640, 460);
    x.strokeStyle = '#2f7a3a'; x.lineWidth = 16; x.beginPath(); x.moveTo(320, 250); x.quadraticCurveTo(300, 360, 322, 450); x.stroke();
    ell(x, 372, 372, 52, 22, -0.6, '#3f9a4a', '#2f7a3a'); ell(x, 268, 392, 46, 20, 0.6, '#3f9a4a', '#2f7a3a');
    for (var i = 0; i < 18; i++) { var a = i / 18 * Math.PI * 2; ell(x, 320 + Math.cos(a) * 108, 200 + Math.sin(a) * 108, 56, 22, a, i % 2 ? '#f6b81c' : '#f9cb3d', '#d98a0b'); }
    ell(x, 320, 200, 70, 70, 0, '#5a3418', '#3a210d');
    for (var j = 0; j < 40; j++) { var b = j * 2.4, r = Math.sqrt(j) * 9; ell(x, 320 + Math.cos(b) * r, 200 + Math.sin(b) * r, 3, 3, 0, '#8a5a2b'); }
    return c;
  },
  mug: function () {
    var c = mkCanvas(640, 460), x = c.getContext('2d'); x.fillStyle = '#f3dccb'; x.fillRect(0, 0, 640, 460);
    x.strokeStyle = '#2d5a8a'; x.lineWidth = 26; x.beginPath(); x.arc(468, 252, 62, -1.3, 1.3); x.stroke();
    x.fillStyle = '#3a6ea5'; x.beginPath(); x.moveTo(180, 130); x.lineTo(470, 130); x.lineTo(450, 390); x.quadraticCurveTo(325, 420, 200, 390); x.closePath(); x.fill();
    ell(x, 325, 130, 145, 26, 0, '#2d5a8a'); ell(x, 325, 132, 128, 17, 0, '#5b3a22');
    x.fillStyle = '#ffd7d0'; x.beginPath(); x.moveTo(325, 330); x.bezierCurveTo(240, 270, 270, 210, 325, 258); x.bezierCurveTo(380, 210, 410, 270, 325, 330); x.fill();
    return c;
  },
  cactus: function () {
    var c = mkCanvas(640, 460), x = c.getContext('2d'); x.fillStyle = '#f6e8a6'; x.fillRect(0, 0, 640, 460);
    x.fillStyle = '#c4572f'; x.beginPath(); x.moveTo(230, 330); x.lineTo(410, 330); x.lineTo(386, 440); x.lineTo(254, 440); x.closePath(); x.fill();
    x.fillStyle = '#d96a3d'; x.fillRect(216, 310, 208, 30);
    x.fillStyle = '#3f9a5a'; x.beginPath(); x.roundRect(285, 70, 70, 250, 35); x.fill();
    x.beginPath(); x.roundRect(205, 160, 40, 110, 20); x.fill(); x.fillRect(205, 235, 100, 36);
    x.beginPath(); x.roundRect(395, 130, 40, 100, 20); x.fill(); x.fillRect(335, 200, 100, 36);
    x.fillStyle = '#e6f5d8'; for (var k = 0; k < 26; k++) x.fillRect(292 + (k * 37) % 56, 90 + (k * 53) % 220, 3, 8);
    ell(x, 320, 66, 20, 20, 0, '#ee5d8f', '#c23b6c'); ell(x, 320, 66, 7, 7, 0, '#ffd34d');
    return c;
  }
};
K.SAMPLES = SAMPLES;
K.loadSample = function (name) { loadImageSource(SAMPLES[name]()); };
Array.prototype.forEach.call(document.querySelectorAll('[data-sample]'), function (b) { b.addEventListener('click', function () { K.loadSample(b.getAttribute('data-sample')); }); });
})();
