(function () {
'use strict';
var K = window.__snip, $ = K.$, S = K.S, M = K.M, num = K.num, sel = K.sel, clamp = K.clamp, lerp = K.lerp, mkCanvas = K.mkCanvas, ease = K.ease;
var reshuffleEpoch = 0;
$('reshuffle').addEventListener('click', function () { reshuffleEpoch++; });

/* ---------- magazine scraps: twelve kinds of printed paper ---------- */
function scrapBG(x, w, h, r, pal) {
  var kind = Math.floor(r() * 12), base = pal[0], ink = pal[1], dark = K.lum(base) < 0.5, i, xx, yy, tile;
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  if (kind === 1) { x.fillStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)'; for (i = 0; i < 8; i++) x.fillRect(0, h * r(), w, 1 + r() * 2); }
  else if (kind === 2) { tile = K.texTile('newsprint'); x.fillStyle = x.createPattern(tile, 'repeat'); x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.26)'; for (yy = 3; yy < h - 3; yy += 4) x.fillRect(2 + r() * 3, yy, (w - 8) * (0.5 + r() * 0.5), 1.4); ink = '#141414'; }
  else if (kind === 3) { x.fillStyle = dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.2)'; for (yy = 3; yy < h; yy += 6) for (xx = 3; xx < w; xx += 6) { x.beginPath(); x.arc(xx, yy, 0.8 + (xx / w) * 1.9, 0, 7); x.fill(); } }
  else if (kind === 4) { x.fillStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)'; for (xx = -h; xx < w; xx += 9) { x.beginPath(); x.moveTo(xx, h); x.lineTo(xx + 4, h); x.lineTo(xx + 4 + h, 0); x.lineTo(xx + h, 0); x.fill(); } }
  else if (kind === 5) { x.fillStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.13)'; for (yy = 0; yy < h; yy += 8) for (xx = 0; xx < w; xx += 8) if (((xx + yy) / 8) % 2 === 0) x.fillRect(xx, yy, 8, 8); }
  else if (kind === 6) { x.fillStyle = x.createPattern(K.texTile('kraft'), 'repeat'); x.fillRect(0, 0, w, h); ink = '#2a1a08'; }
  else if (kind === 7) { x.fillStyle = x.createPattern(K.texTile('notebook'), 'repeat'); x.fillRect(0, 0, w, h); ink = '#101830'; }
  else if (kind === 8) { x.fillStyle = x.createPattern(K.texTile('graph'), 'repeat'); x.fillRect(0, 0, w, h); ink = '#0f2a1c'; }
  else if (kind === 9) { x.fillStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.28)'; for (i = 0; i < 40; i++) x.fillRect(r() * w, r() * h, 1.5, 1.5); }
  else if (kind === 10) { x.fillStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'; for (i = 0; i < 4; i++) { x.beginPath(); x.arc(r() * w, r() * h, h * (0.2 + r() * 0.3), 0, 7); x.fill(); } }
  else if (kind === 11) { x.fillStyle = dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)'; x.fillRect(0, h * 0.78, w, h * 0.22); }
  return ink;
}
var SC = K.lru(700);
function scrap(ch, seed, size, v) {
  var key = ch + '|' + seed + '|' + Math.round(size) + '|' + v + '|' + M.paperSig(), hit = SC.get(key);
  if (hit) return hit;
  var r = K.rng(seed), font = K.pick(r, K.RANSOM_FONTS), pal = K.pick(r, K.SCRAPS), bold = r() > 0.5, fs = size * (0.78 + r() * 0.45), fstr = K.font(font, fs, bold);
  var m = mkCanvas(8, 8).getContext('2d'); m.font = fstr;
  var tw = Math.max(fs * 0.45, m.measureText(ch).width), w = Math.ceil(tw + fs * 0.4), h = Math.ceil(fs * 1.25), c = mkCanvas(w, h), x = c.getContext('2d');
  var ink = scrapBG(x, w, h, r, pal);
  x.fillStyle = ink; x.font = fstr; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (r() > 0.86) { x.strokeStyle = ink; x.lineWidth = 3; x.strokeText(ch, w / 2, h * 0.54); }
  x.fillText(ch, w / 2, h * 0.54);
  return SC.set(key, K.cutout(c, { edge: Math.min(num('edge') * 0.4, 9), rough: Math.max(20, num('rough')), variant: v, innerShadow: 0 }));
}
var FB = null;
function drawFlap(ctx, img, px, py, sc, rot, q) {
  var th = (1 - ease(q)) * Math.PI / 2, s = Math.max(0.001, Math.cos(th)), W = img.width, H = img.height;
  if (!FB) FB = mkCanvas(8, 8); if (FB.width !== W || FB.height !== H) { FB.width = W; FB.height = H; }
  var x = FB.getContext('2d'); x.clearRect(0, 0, W, H);
  x.drawImage(img, 0, H / 2, W, H / 2, 0, H / 2, W, H / 2);
  x.drawImage(img, 0, 0, W, H / 2, 0, H / 2 - H / 2 * s, W, H / 2 * s);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(0,0,0,' + ((1 - s) * 0.5).toFixed(3) + ')'; x.fillRect(0, H / 2 - H / 2 * s, W, H / 2 * s); x.globalCompositeOperation = 'source-over';
  K.drawShadowed(ctx, FB, px, py, sc, rot);
}
function bounce(x) {
  var n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
M.magazine = function (ctx, w, h, t, opts) {
  var ls = $('magText').value.split('\n').map(function (s) { return s.replace(/\s+$/, ''); }).filter(function (s) { return s.length; });
  if (!ls.length) { M.hint(ctx, w, h, 'Type some words'); return; }
  var u = h / 540, size = num('magSize') * u, tilt = num('magTilt') * Math.PI / 180, asm = num('magAssemble') / 10, hold = num('magHold') / 10, cyc = asm + hold;
  var ci = Math.floor(t / cyc), c = t - ci * cyc, epoch = ci + reshuffleEpoch * 977, flick = num('magFlicker'), fe = flick > 0 ? Math.floor(t * flick) : 0, v = K.variant(t);
  var step = num('boil') > 0 ? num('boilFps') : 0, cs = step > 0 ? Math.floor(c * step + 1e-6) / step : c, intro = sel('magIntro');
  if (M.lastMag !== ci) { M.lastMag = ci; if (!(opts && opts.silent)) K.sfx('snip'); }
  var rows = [], maxW = 0, totalH = 0, n = 0, k = 0;
  ls.forEach(function (line, li) {
    var items = [], rw = 0, rh = 0, cI;
    for (cI = 0; cI < line.length; cI++) {
      var ch = line[cI];
      if (ch === ' ') { items.push({ gap: size * 0.38 }); rw += size * 0.38; continue; }
      var seed = li * 131 + cI * 17 + epoch * 7919 + ch.charCodeAt(0);
      if (flick > 0 && K.hash2(li * 64 + cI, fe, 9) < 0.25) seed += fe * 104729;
      var img = scrap(ch, seed, size, v), rr = K.rng(seed + 1);
      items.push({ img: img, rot: (rr() - 0.5) * 2 * tilt, dy: (rr() - 0.5) * size * 0.16, sx: (rr() - 0.5) * 1.5, sy: (rr() - 0.5) * 1.4, sr: (rr() - 0.5) * 5, k: k++ });
      rw += img.width * 0.86; rh = Math.max(rh, img.height); n++;
    }
    rows.push({ items: items, w: rw, h: rh || size }); maxW = Math.max(maxW, rw); totalH += (rh || size) * 0.92;
  });
  var fit = Math.min(1, (w * 0.92) / maxW, (h * 0.9) / totalH) * (num('size') / 78), mo = M.motion(t, w, h), a = asm > 0 ? cs / asm : 1, boil = num('boil'), bi = K.boilIndex(t);
  ctx.save(); ctx.translate(w / 2 + mo.dx, h / 2 + mo.dy); ctx.rotate(mo.rot * 0.3); ctx.scale(fit * mo.sc, fit * mo.sc);
  var y = -totalH / 2;
  rows.forEach(function (row) {
    var x = -row.w / 2, cy = y + row.h / 2;
    row.items.forEach(function (it) {
      if (it.gap) { x += it.gap; return; }
      var fx = x + it.img.width * 0.43, fy = cy + it.dy, px = fx, py = fy, rot = it.rot, q = 1, frac = it.k / Math.max(1, n), s0, dur;
      x += it.img.width * 0.86;
      if (intro !== 'none') { s0 = intro === 'scatter' ? 0.3 + 0.5 * frac : 0.7 * frac; dur = intro === 'scatter' ? 0.35 : 0.3; q = clamp((a - s0) / dur, 0, 1); }
      if (intro === 'scatter' && q < 1) {
        var sx = it.sx * w * 0.5 / fit + Math.sin(cs * 1.3 + it.k) * 9, sy = it.sy * h * 0.5 / fit + Math.cos(cs * 1.1 + it.k * 1.7) * 9, e = K.easeBack(q);
        px = lerp(sx, fx, e); py = lerp(sy, fy, e); rot = lerp(it.sr, it.rot, ease(q));
      } else if (intro === 'drop' && q < 1) {
        if (q <= 0) return; py = lerp(fy - h / fit * 0.9, fy, bounce(q)); rot = it.rot + (1 - q) * it.sr * 0.3;
      } else if (intro === 'unfold' && q < 1) {
        if (q <= 0) return;
        drawFlap(ctx, it.img, px, py, 1, rot, q); return;
      }
      if (boil > 0) { px += (K.hash2(it.k, bi, 3) - 0.5) * boil * 0.5; py += (K.hash2(it.k, bi, 4) - 0.5) * boil * 0.5; rot += (K.hash2(it.k, bi, 5) - 0.5) * boil * 0.004; }
      K.drawShadowed(ctx, it.img, px, py, 1, rot);
    });
    y += row.h * 0.92;
  });
  ctx.restore();
};

/* ---------- match cut ---------- */
var BEATBG = ['#e8491a', '#111111', '#f2c14e', '#2b5fc4', '#e9e1cf', '#2f8f5b', '#f4a6c0', '#6a3fd1'];
function beatBackground(ctx, w, h, beat) {
  var r = K.rng(beat * 7919 + 13), kind = Math.floor(r() * 6), c = BEATBG[Math.floor(r() * BEATBG.length)], i, x, y, u = w / 960;
  ctx.fillStyle = c; ctx.fillRect(0, 0, w, h);
  var dark = K.lum(c) < 0.4; ctx.fillStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.14)';
  if (kind === 0) { var step = (26 + r() * 20) * u; for (x = -h; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + step / 2, 0); ctx.lineTo(x + step / 2 + h, h); ctx.lineTo(x + h, h); ctx.fill(); } }
  else if (kind === 1) { var d = (22 + r() * 14) * u; for (y = 0; y < h + d; y += d) for (x = 0; x < w + d; x += d) { ctx.beginPath(); ctx.arc(x + ((y / d) % 2) * d / 2, y, d * (0.15 + 0.3 * (x / w)), 0, 7); ctx.fill(); } }
  else if (kind === 2) { ctx.fillStyle = dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.2)'; for (y = 14 * u; y < h; y += 15 * u) ctx.fillRect(w * 0.06, y, w * (0.6 + r() * 0.4), 4 * u); }
  else if (kind === 3) { var s = (60 + r() * 40) * u; for (y = 0; y < h; y += s) for (x = 0; x < w; x += s) if (Math.round((x + y) / s) % 2 === 0) ctx.fillRect(x, y, s, s); }
  else if (kind === 4) { var g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  else for (i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(r() * w, r() * h, (30 + r() * h * 0.3) * (u > 0 ? 1 : 1), 0, 7); ctx.fill(); }
  ctx.globalAlpha = 0.5; ctx.fillStyle = ctx.createPattern(K.GRAIN, 'repeat'); ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
}
var WC = K.lru(80);
function wordStrip(word, font, size, v) {
  var key = word + '|' + font + '|' + Math.round(size) + '|' + v + '|' + M.paperSig(), hit = WC.get(key);
  if (hit) return hit;
  var m = mkCanvas(8, 8).getContext('2d'); m.font = K.font(font, size);
  var tw = m.measureText(word).width, w = Math.ceil(tw + size * 0.6), h = Math.ceil(size * 1.3), c = mkCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#fffdf6'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = K.font(font, size); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(word, w / 2, h * 0.54);
  return WC.set(key, K.cutout(c, { edge: Math.min(num('edge'), 18), variant: v, innerShadow: 0 }));
}
function matchFrame(ctx, w, h, beat, tn, t, onTop) {
  if (S.bg !== 'transparent' && !M.noBackdrop) beatBackground(ctx, w, h, beat);
  var v = K.variant(t), img, sc = 1;
  if (sel('mcMode') === 'logo') {
    img = M.subjectPaper(t);
    if (!img) { M.hint(ctx, w, h, 'Pick a sample or upload a photo to use as the logo'); return; }
    sc = Math.min(w / img.width, h / img.height) * (num('size') / 100); img = K.warp(img, num('distort'), t);
  } else {
    var words = K.lines('mcWords'); if (!words.length) { M.hint(ctx, w, h, 'Type some words'); return; }
    img = wordStrip(words[beat % words.length].toUpperCase(), sel('mcFont'), num('mcSize') * (h / 540), v);
    sc = Math.min(1, (w * 0.9) / img.width) * (num('size') / 78);
  }
  var pop = tn < 0.12 ? 1 + (0.12 - tn) * 0.5 : 1;
  K.drawShadowed(ctx, img, w / 2, h / 2, sc * pop, 0);
}
M.match = function (ctx, w, h, t, opts) {
  var period = 60 / num('mcBpm'), beat = Math.floor(t / period), tn = (t - beat * period) / period, len = num('trLen') / 100, kind = sel('trKind');
  var k = kind === 'cut' ? 0 : clamp((tn - (1 - len)) / len, 0, 1);
  if (M.lastBeat !== beat) { M.lastBeat = beat; if (!(opts && opts.silent)) K.sfx('beat'); }
  M.noBackdrop = !!(opts && opts.bg === 'none');
  K.trans(ctx, w, h, kind, k, function (c) { matchFrame(c, w, h, beat, tn, t); }, function (c) { matchFrame(c, w, h, beat + 1, 0, t); });
};

/* ---------- text morph from paper scraps ---------- */
var tcache = K.lru(24), PAL = K.PAPER_COLORS;
function pointsFor(text, font, dot, w, h) {
  var key = text + '|' + font + '|' + Math.round(dot) + '|' + w + '|' + h, hit = tcache.get(key);
  if (hit) return hit;
  var c = mkCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true }), fs = h * 0.5;
  x.font = K.font(font, fs); var tw = x.measureText(text).width; if (tw > w * 0.86) fs = fs * (w * 0.86) / tw;
  x.font = K.font(font, fs); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000'; x.fillText(text, w / 2, h / 2);
  var d = x.getImageData(0, 0, w, h).data, step = Math.max(2, dot * 1.1), pts = [], px, py;
  for (py = step / 2; py < h; py += step) for (px = step / 2; px < w; px += step) if (d[((py | 0) * w + (px | 0)) * 4 + 3] > 128) pts.push({ x: px, y: py });
  pts.sort(function (a, b) { return a.x - b.x || a.y - b.y; });
  if (!pts.length) pts.push({ x: w / 2, y: h / 2 });
  return tcache.set(key, pts);
}
M.morph = function (ctx, w, h, t) {
  var words = K.lines('mpWords'); if (!words.length) { M.hint(ctx, w, h, 'Type some words'); return; }
  var hold = num('mpHold') / 10, move = num('mpMove') / 10, cyc = hold + move, k = Math.floor(t / cyc), u = t - k * cyc;
  var dot = num('mpDots') * (h / 540), font = sel('mpFont'), boil = num('boil'), fr = K.boilIndex(t), sd = num('shadow') * (h / 540);
  var A = pointsFor(words[k % words.length].toUpperCase(), font, dot, w, h), B = pointsFor(words[(k + 1) % words.length].toUpperCase(), font, dot, w, h);
  var prog = u < hold ? 0 : (u - hold) / move, n = Math.max(A.length, B.length), i, buf = [];
  for (i = 0; i < n; i++) {
    var a = A[Math.floor(i * A.length / n)], b = B[Math.floor(i * B.length / n)], hr = K.hash2(i, 1, 3), e = ease(clamp((prog * 1.45 - hr * 0.45) / 1.0, 0, 1));
    var arc = Math.sin(e * Math.PI) * (K.hash2(i, 2, 3) - 0.5) * h * 0.35, j = boil > 0 ? (K.hash2(i, fr, 8) - 0.5) * boil * 0.7 : 0;
    buf.push([lerp(a.x, b.x, e) + j, lerp(a.y, b.y, e) + arc + j, (K.hash2(i, 5, 3) - 0.5) * 1.6 + e * 2 * (hr - 0.5) + (boil > 0 ? (K.hash2(i, fr, 9) - 0.5) * 0.3 : 0), dot * (0.95 + K.hash2(i, 6, 3) * 0.55), PAL[Math.floor(K.hash2(i, 4, 3) * PAL.length)], i]);
  }
  function scrapPath(p, ox, oy) {
    var c = Math.cos(p[2]), s = Math.sin(p[2]), hw = p[3] / 2, hh = p[3] * 0.4, i = p[5], j = p[3] * 0.18;
    ctx.setTransform(c, s, -s, c, p[0] + ox, p[1] + oy); ctx.beginPath();
    ctx.moveTo(-hw + (K.hash2(i, 11, 1) - 0.5) * j, -hh + (K.hash2(i, 12, 1) - 0.5) * j); ctx.lineTo(hw + (K.hash2(i, 13, 1) - 0.5) * j, -hh + (K.hash2(i, 14, 1) - 0.5) * j);
    ctx.lineTo(hw + (K.hash2(i, 15, 1) - 0.5) * j, hh + (K.hash2(i, 16, 1) - 0.5) * j); ctx.lineTo(-hw + (K.hash2(i, 17, 1) - 0.5) * j, hh + (K.hash2(i, 18, 1) - 0.5) * j); ctx.closePath();
  }
  if (sd > 0) { ctx.fillStyle = 'rgba(0,0,0,.3)'; buf.forEach(function (p) { scrapPath(p, sd * 0.12, sd * 0.2); ctx.fill(); }); }
  buf.forEach(function (p) { scrapPath(p, 0, 0); ctx.fillStyle = p[4]; ctx.fill(); });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};

/* ---------- word orbit: Fibonacci sphere or rings, far words fade ---------- */
var OC = K.lru(240);
function orbitScrap(word, font, size, col, v) {
  var key = word + '|' + font + '|' + Math.round(size) + '|' + col + '|' + v + '|' + M.paperSig(), hit = OC.get(key);
  if (hit) return hit;
  var m = mkCanvas(8, 8).getContext('2d'); m.font = K.font(font, size);
  var tw = m.measureText(word).width, w = Math.ceil(tw + size * 0.5), h = Math.ceil(size * 1.3), c = mkCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = K.lum(col) < 0.5 ? '#fbf7ee' : '#16161a'; x.font = K.font(font, size); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(word, w / 2, h * 0.54);
  return OC.set(key, K.cutout(c, { edge: Math.min(num('edge') * 0.35, 8), variant: v, innerShadow: 0 }));
}
M.orbit = function (ctx, w, h, t) {
  var words = $('orPhrase').value.split(/\s+/).filter(Boolean); if (!words.length) { M.hint(ctx, w, h, 'Type a phrase'); return; }
  var uu = Math.min(h / 540, w / 960), size = Math.round(num('orSize') * uu), rad = num('orRad') / 100, Rx = rad * w * 0.31, Ry = clamp(rad * h * 0.39, Rx * 0.5, Rx * 1.9), tilt = num('orTilt') * Math.PI / 180, fontSel = sel('orFont'), v = K.variant(t), spin = num('orSpin') / 100;
  var list = [], items = [], i, copies = sel('orLayout') === 'sphere' ? num('orCopies') : 1;
  for (i = 0; i < copies; i++) words.forEach(function (wd) { list.push(wd); });
  var N = list.length, A = t * 0.45 * spin, ca = Math.cos(A), sa = Math.sin(A), ct = Math.cos(tilt), st = Math.sin(tilt), D = 3;
  list.forEach(function (word, idx) {
    var x0, y0, z0;
    if (sel('orLayout') === 'sphere') { y0 = 1 - 2 * (idx + 0.5) / N; var rr = Math.sqrt(Math.max(0, 1 - y0 * y0)), phi = idx * 2.399963; x0 = Math.cos(phi) * rr; z0 = Math.sin(phi) * rr; }
    else {
      var rings = parseInt($('orRows').value, 10), per = Math.ceil(N / rings), ring = Math.floor(idx / per), j = idx % per, cnt = Math.min(per, N - ring * per), th = j / cnt * Math.PI * 2 + ring * 0.9 + (ring % 2 ? -1 : 1) * 0.0;
      x0 = Math.cos(th); z0 = Math.sin(th); y0 = (ring - (rings - 1) / 2) * (size * 1.5 / Ry);
    }
    var x1 = x0 * ca + z0 * sa, z1 = -x0 * sa + z0 * ca, y2 = y0 * ct - z1 * st, z2 = y0 * st + z1 * ct, s = D / (D + z2);
    var font = fontSel === 'mixed' ? K.RANSOM_FONTS[Math.floor(K.hash2(idx, 7, 3) * K.RANSOM_FONTS.length)] : fontSel;
    items.push({ word: word, font: font, x: x1 * Rx * s, y: y2 * Ry * s, z: z2, s: s, col: PAL[(idx * 3) % PAL.length] });
  });
  items.sort(function (a, b) { return b.z - a.z; });
  items.forEach(function (it) {
    var img = orbitScrap(it.word, it.font, size, it.col, v), al = lerp(1, 0.2, K.smooth(-0.6, 1, it.z));
    ctx.globalAlpha = al; K.drawShadowed(ctx, img, w / 2 + it.x, h / 2 + it.y, it.s, Math.sin(t * 0.8 + it.x * 0.01) * 0.04); ctx.globalAlpha = 1;
  });
};
})();
