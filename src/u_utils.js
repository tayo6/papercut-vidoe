(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var stage = $('stage'), sctx = stage.getContext('2d');
var S = { mode: 'cutout', playing: true, t: 0, bg: 'mat', bgColor: '#2b3a67', bgImg: null, aspect: '16:9', W: 960, H: 540, busy: false };
var ASPECTS = { '16:9': [960, 540, 760], '9:16': [540, 960, 380], '1:1': [720, 720, 620], '4:5': [640, 800, 560], '4:3': [800, 600, 680] };
var K = { $: $, S: S, ASPECTS: ASPECTS, stage: stage, sctx: sctx };
window.__snip = K;

/* ---------- helpers ---------- */
K.num = function (id) { return parseFloat($(id).value); };
K.chk = function (id) { return $(id).checked; };
K.sel = function (id) { return $(id).value; };
K.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
K.lerp = function (a, b, k) { return a + (b - a) * k; };
K.smooth = function (a, b, x) { var k = K.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
K.ease = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
K.easeBack = function (k) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
K.mkCanvas = function (w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
K.rng = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0; var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
K.hash2 = function (x, y, s) {
  var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
K.vnoise = function (x, y, s) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  var a = K.hash2(xi, yi, s), b = K.hash2(xi + 1, yi, s), c = K.hash2(xi, yi + 1, s), d = K.hash2(xi + 1, yi + 1, s);
  return K.lerp(K.lerp(a, b, u), K.lerp(c, d, u), v) * 2 - 1;
};
K.fbm = function (x, y, s) { return K.vnoise(x, y, s) * 0.58 + K.vnoise(x * 2.1, y * 2.1, s + 3) * 0.3 + K.vnoise(x * 4.3, y * 4.3, s + 7) * 0.16; };
K.hexToRgb = function (h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || '#ffffff'); var n = parseInt(m ? m[1] : 'ffffff', 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
K.lum = function (hex) { var c = K.hexToRgb(hex); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; };
K.setStatus = function (msg) { $('status').textContent = msg || ''; };
K.lines = function (id) { return $(id).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
K.pick = function (r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; };
K.boxBlur = function (a, w, h, r) {
  r = Math.round(r); if (r < 1) return a;
  var tmp = new Float32Array(a.length), x, y, acc, k = 1 / (2 * r + 1), cl = K.clamp, row;
  for (y = 0; y < h; y++) {
    acc = 0; row = y * w;
    for (x = -r; x <= r; x++) acc += a[row + cl(x, 0, w - 1)];
    for (x = 0; x < w; x++) { tmp[row + x] = acc * k; acc += a[row + cl(x + r + 1, 0, w - 1)] - a[row + cl(x - r, 0, w - 1)]; }
  }
  for (x = 0; x < w; x++) {
    acc = 0;
    for (y = -r; y <= r; y++) acc += tmp[cl(y, 0, h - 1) * w + x];
    for (y = 0; y < h; y++) { a[y * w + x] = acc * k; acc += tmp[cl(y + r + 1, 0, h - 1) * w + x] - tmp[cl(y - r, 0, h - 1) * w + x]; }
  }
  return a;
};

/* ---------- caches that are dropped when fonts finish loading ---------- */
var CACHES = [];
K.lru = function (max) {
  var m = new Map(), o = {
    get: function (k) { if (!m.has(k)) return undefined; var v = m.get(k); m.delete(k); m.set(k, v); return v; },
    set: function (k, v) { if (m.has(k)) m.delete(k); m.set(k, v); if (m.size > max) m.delete(m.keys().next().value); return v; },
    clear: function () { m.clear(); }
  };
  CACHES.push(o); return o;
};
K.invalidate = function () { CACHES.forEach(function (c) { c.clear(); }); };

/* ---------- fonts (embedded in the page) ---------- */
var FONTS = {
  'Bowlby One': { w: [400], k: 'sans-serif' }, 'Anton': { w: [400], k: 'sans-serif' }, 'Abril Fatface': { w: [400], k: 'serif' },
  'Rubik Mono One': { w: [400], k: 'sans-serif' }, 'Pacifico': { w: [400], k: 'cursive' }, 'Lobster': { w: [400], k: 'cursive' },
  'Permanent Marker': { w: [400], k: 'cursive' }, 'Chewy': { w: [400], k: 'cursive' }, 'Rye': { w: [400], k: 'serif' },
  'Bebas Neue': { w: [400], k: 'sans-serif' }, 'Special Elite': { w: [400], k: 'monospace' }, 'Courier Prime': { w: [400, 700], k: 'monospace' },
  'Playfair Display': { w: [400, 900], k: 'serif' }, 'Old Standard TT': { w: [400, 700], k: 'serif' }, 'UnifrakturCook': { w: [700], k: 'serif' },
  'Libre Baskerville': { w: [400, 700], k: 'serif' }, 'DM Serif Display': { w: [400], k: 'serif' }, 'Oswald': { w: [500], k: 'sans-serif' },
  'Alfa Slab One': { w: [400], k: 'serif' }, 'Roboto Slab': { w: [700], k: 'serif' }, 'Lora': { w: [400, 700], k: 'serif' },
  'Cormorant Garamond': { w: [700], k: 'serif' }
};
K.FONTS = FONTS;
K.RANSOM_FONTS = ['Playfair Display', 'Anton', 'Pacifico', 'Special Elite', 'Abril Fatface', 'Rubik Mono One', 'Courier Prime', 'Lobster', 'Permanent Marker', 'Chewy', 'Bebas Neue', 'Rye', 'Bowlby One', 'Old Standard TT', 'Alfa Slab One', 'DM Serif Display', 'Libre Baskerville', 'Roboto Slab', 'Oswald', 'UnifrakturCook'];
K.font = function (name, px, bold) {
  var f = FONTS[name] || { w: [400], k: 'serif' }, w = bold ? f.w[f.w.length - 1] : f.w[0];
  return w + ' ' + (Math.round(px * 10) / 10) + 'px "' + name + '", ' + f.k;
};
K.loadFonts = function () {
  var jobs = [];
  Object.keys(FONTS).forEach(function (n) { FONTS[n].w.forEach(function (w) { jobs.push(document.fonts.load(w + ' 32px "' + n + '"')); }); });
  return Promise.all(jobs);
};

/* ---------- palettes ---------- */
K.PAPER_COLORS = ['#fbf7ee', '#f2c14e', '#e8491a', '#2b5fc4', '#2f8f5b', '#f4a6c0', '#111111', '#cbb68d'];
K.PAPER_NAMES = ['Ivory', 'Mustard', 'Vermilion', 'Cobalt', 'Pine', 'Rose', 'Ink', 'Kraft'];
K.SCRAPS = [['#fbf7ee', '#1a1a1a'], ['#111111', '#f5f0e6'], ['#f2c14e', '#1a1a1a'], ['#e8491a', '#fff7ee'], ['#2b5fc4', '#f7f3ea'], ['#e9e1cf', '#2a2a2a'], ['#f4a6c0', '#3a0d20'], ['#2f8f5b', '#f6f2e6'], ['#c9d7e6', '#17202e'], ['#7a4bd6', '#fff6e0'], ['#ff9f43', '#1e1206']];

/* ---------- paper grain and textures ---------- */
K.GRAIN = (function () {
  var c = K.mkCanvas(256, 256), x = c.getContext('2d'), r = K.rng(77), i;
  for (i = 0; i < 2600; i++) { x.fillStyle = 'rgba(70,50,20,' + (r() * 0.22).toFixed(3) + ')'; x.fillRect(r() * 256, r() * 256, 1 + r() * 1.5, 1 + r() * 1.5); }
  for (i = 0; i < 1800; i++) { x.fillStyle = 'rgba(255,255,255,' + (r() * 0.35).toFixed(3) + ')'; x.fillRect(r() * 256, r() * 256, 1, 1 + r() * 2); }
  x.lineWidth = 1;
  for (i = 0; i < 160; i++) {
    var px = r() * 256, py = r() * 256, a = r() * 6.28, l = 3 + r() * 9;
    x.strokeStyle = 'rgba(90,70,40,' + (0.05 + r() * 0.12).toFixed(3) + ')';
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return c;
})();
var TEXC = {};
function makeTex(id) {
  var c = K.mkCanvas(256, 256), x = c.getContext('2d'), r = K.rng(id.charCodeAt(0) * 131 + id.length), i;
  function fill(col) { x.fillStyle = col; x.fillRect(0, 0, 256, 256); }
  function wrap(fn) { for (var dx = -256; dx <= 256; dx += 256) for (var dy = -256; dy <= 256; dy += 256) fn(dx, dy); }
  function blotch(rgb, n, rmin, rmax, a) {
    for (i = 0; i < n; i++) {
      var px = r() * 256, py = r() * 256, rr = rmin + r() * (rmax - rmin), al = a * (0.4 + r() * 0.6);
      wrap(function (dx, dy) {
        var g = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, rr);
        g.addColorStop(0, 'rgba(' + rgb + ',' + al + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
        x.fillStyle = g; x.fillRect(px + dx - rr, py + dy - rr, rr * 2, rr * 2);
      });
    }
  }
  function specks(rgb, n, amax) { for (i = 0; i < n; i++) { x.fillStyle = 'rgba(' + rgb + ',' + (r() * amax).toFixed(3) + ')'; var sw = 1 + r() * 1.6; x.fillRect(r() * 254, r() * 254, sw, sw); } }
  function fibres(rgb, n, amax) {
    x.lineWidth = 1;
    for (i = 0; i < n; i++) {
      var px = r() * 256, py = r() * 256, a = r() * 6.283, l = 3 + r() * 10;
      x.strokeStyle = 'rgba(' + rgb + ',' + (0.04 + r() * amax).toFixed(3) + ')'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
  }
  var k;
  if (id === 'cardstock') { fill('#f6f1e4'); blotch('200,185,150', 8, 40, 90, 0.06); specks('90,70,40', 1200, 0.1); specks('255,255,255', 900, 0.4); fibres('120,100,70', 120, 0.12); }
  else if (id === 'kraft') { fill('#c9a977'); blotch('120,85,40', 18, 30, 90, 0.2); blotch('240,215,160', 10, 30, 80, 0.18); specks('70,45,15', 1400, 0.2); fibres('90,60,25', 260, 0.2); }
  else if (id === 'newsprint') { fill('#e6e0cd'); blotch('150,130,90', 10, 40, 100, 0.1); specks('50,45,35', 2400, 0.16); fibres('110,100,80', 100, 0.1); }
  else if (id === 'notebook') { fill('#fbfaf3'); specks('90,80,60', 500, 0.08); x.fillStyle = 'rgba(95,135,205,.55)'; for (k = 20; k < 256; k += 32) x.fillRect(0, k, 256, 1.3); }
  else if (id === 'graph') { fill('#f2f7ee'); for (k = 0; k < 256; k += 16) { x.fillStyle = k % 64 === 0 ? 'rgba(70,150,100,.55)' : 'rgba(120,175,140,.4)'; x.fillRect(k, 0, 1, 256); x.fillRect(0, k, 256, 1); } }
  else if (id === 'parchment') { fill('#e8d5a6'); blotch('140,95,40', 26, 30, 100, 0.22); blotch('255,245,210', 12, 30, 80, 0.4); specks('90,60,20', 900, 0.18); fibres('110,80,40', 100, 0.12); }
  else if (id === 'cardboard') { fill('#b88a55'); for (k = 0; k < 256; k += 8) { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(k, 0, 4, 256); x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(k + 4, 0, 4, 256); } blotch('90,60,25', 14, 30, 90, 0.2); specks('50,30,10', 1500, 0.25); fibres('230,200,150', 200, 0.16); }
  else fill('#fbf7ee');
  return c;
}
K.texTile = function (id) { if (!id || id === 'plain') return null; return TEXC[id] || (TEXC[id] = makeTex(id)); };

/* ---------- time: stepped clock and boil drawings ---------- */
K.stepT = function (t) { var f = parseFloat($('stepFps').value); return f > 0 ? Math.floor(t * f + 1e-6) / f : t; };
K.boilIndex = function (t) { return Math.floor(t * K.num('boilFps') + 1e-6); };
K.variant = function (t) { return K.num('boil') > 0 ? K.boilIndex(t) % Math.max(2, K.num('boilLoop')) : 0; };

/* ---------- shared drawing ---------- */
K.drawShadowed = function (ctx, img, cx, cy, scale, rot) {
  var sd = K.num('shadow'), bl = K.num('shBlur');
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0); ctx.scale(scale, scale);
  if (sd > 0) {
    ctx.shadowColor = 'rgba(0,0,0,' + (0.25 + Math.min(0.35, sd / 150)).toFixed(2) + ')';
    ctx.shadowBlur = bl * scale; ctx.shadowOffsetX = sd * 0.35 * scale; ctx.shadowOffsetY = sd * 0.55 * scale;
  }
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
};
var WB = null;
K.warp = function (img, amt, t) {
  if (!(amt > 0)) return img;
  var A = amt / 100 * img.width * 0.045, pad = Math.ceil(A * 1.4) + 3, w = img.width + pad * 2, h = img.height;
  if (!WB || WB.width !== w || WB.height !== h) WB = K.mkCanvas(w, h);
  var x = WB.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
  var n = Math.max(12, Math.round(h / 10)), sh = h / n, f = amt / 100, i;
  for (i = 0; i < n; i++) {
    var yn = i / n, dx = Math.sin(yn * 5.2 + t * 1.7) * A + Math.sin(yn * 12.5 + t * 2.9) * A * 0.3, sx = 1 + Math.sin(yn * 3.3 + t * 1.3) * 0.03 * f, dw = img.width * sx;
    x.drawImage(img, 0, i * sh, img.width, Math.min(sh + 1, h - i * sh), pad + dx + (img.width - dw) / 2, i * sh, dw, sh + 1);
  }
  return WB;
};
K.finish = function (ctx, w, h, t, bg) {
  if (bg === 'none' || bg === 'transparent') return;
  var vg = K.num('vig'), fg = K.num('fgrain');
  if (vg > 0) {
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (vg / 100 * 0.75).toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (fg > 0) {
    var ox = Math.floor(K.hash2(Math.floor(t * 12), 1, 2) * 256), oy = Math.floor(K.hash2(Math.floor(t * 12), 2, 2) * 256);
    ctx.save(); ctx.globalAlpha = fg / 100 * 0.7; ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(K.GRAIN, 'repeat'); ctx.fillRect(ox, oy, w, h); ctx.restore();
  }
};

/* ---------- transitions between two drawn frames ---------- */
var OFF = [];
function off(w, h, i) {
  var c = OFF[i]; if (!c || c.width !== w || c.height !== h) c = OFF[i] = K.mkCanvas(w, h);
  var x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); return c;
}
K.trans = function (ctx, w, h, kind, k, drawA, drawB) {
  if (kind === 'cut' || k <= 0) { drawA(ctx); return; }
  if (k >= 1) { drawB(ctx); return; }
  var a = off(w, h, 0), b = off(w, h, 1); drawA(a.getContext('2d')); drawB(b.getContext('2d'));
  var e = k * k * (3 - 2 * k);
  if (kind === 'fade') { ctx.drawImage(a, 0, 0); ctx.globalAlpha = e; ctx.drawImage(b, 0, 0); ctx.globalAlpha = 1; }
  else if (kind === 'slide') { ctx.drawImage(a, -w * e, 0); ctx.drawImage(b, w * (1 - e), 0); }
  else if (kind === 'zoom') { var s = K.lerp(1.6, 1, e); ctx.drawImage(a, 0, 0); ctx.globalAlpha = e; ctx.drawImage(b, w / 2 - w * s / 2, h / 2 - h * s / 2, w * s, h * s); ctx.globalAlpha = 1; }
  else {
    ctx.drawImage(a, 0, 0);
    var x0 = K.lerp(-0.06, 1.06, e) * w, y, pts = [];
    for (y = 0; y <= h + 8; y += 6) pts.push([x0 + K.fbm(y * 0.035, e * 4, 17) * h * 0.09 + K.vnoise(y * 0.3, 2, 9) * 2.5, y]);
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, -2); pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); }); ctx.lineTo(0, h + 8); ctx.closePath(); ctx.clip();
    ctx.drawImage(b, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0] + 3, p[1]); else ctx.moveTo(p[0] + 3, p[1]); });
    ctx.strokeStyle = 'rgba(255,252,242,.95)'; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 8; ctx.stroke(); ctx.restore();
  }
};

/* ---------- range outputs ---------- */
var FORMAT = {
  speed: function (v) { return (v / 100).toFixed(2) + 'x'; },
  mpHold: function (v) { return (v / 10).toFixed(1) + 's'; }, mpMove: function (v) { return (v / 10).toFixed(1) + 's'; },
  magAssemble: function (v) { return (v / 10).toFixed(1) + 's'; }, magHold: function (v) { return (v / 10).toFixed(1) + 's'; },
  fHold: function (v) { return (v / 10).toFixed(1) + 's'; }, expIn: function (v) { return (v / 10).toFixed(1) + 's'; }, expOut: function (v) { return (v / 10).toFixed(1) + 's'; },
  magFlicker: function (v) { return v === 0 ? 'off' : v + '/s'; }, boilFps: function (v) { return v + '/s'; },
  fOpen: function (v) { return (v / 10).toFixed(1) + 's'; }, fTilt: function (v) { return v + '\u00b0'; }, fBend: function (v) { return v + '%'; }, fOver: function (v) { return v + '%'; }, fCrease: function (v) { return v + '%'; }, size: function (v) { return v + '%'; }, vol: function (v) { return v + '%'; },
  vig: function (v) { return v + '%'; }, fgrain: function (v) { return v + '%'; }, trLen: function (v) { return v + '%'; }, nwHlTime: function (v) { return v + '%'; },
  orSpin: function (v) { return v + '%'; }, distort: function (v) { return v + '%'; }
};
K.bindRanges = function () {
  Array.prototype.forEach.call(document.querySelectorAll('input[type="range"]'), function (el) {
    var out = $(el.id + 'O'), f = FORMAT[el.id] || String;
    function upd() { if (out) out.textContent = f(parseFloat(el.value)); }
    el.addEventListener('input', upd); upd();
  });
};
K.updateGroups = function () {
  Array.prototype.forEach.call(document.querySelectorAll('.group[data-modes]'), function (g) { g.hidden = g.getAttribute('data-modes').split(' ').indexOf(S.mode) < 0; });
};
})();
