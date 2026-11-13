(function () {
'use strict';
var K = window.__snip, $ = K.$, M = K.M, num = K.num, sel = K.sel, clamp = K.clamp, lerp = K.lerp, mkCanvas = K.mkCanvas;
var STOCKS = { newsprint: '#e7e1cf', cream: '#f5efdc', aged: '#e0cfa6', kraft: '#cdb089', salmon: '#f3d6c2', grey: '#d9dde0', white: '#fbfbf8' }, STOCKLIST = Object.keys(STOCKS);
var PUBLIST = ['broad', 'tab', 'gaz', 'mag', 'book'];
var PUB = {
  broad: { mast: 'Old Standard TT', head: ['Playfair Display', 'Old Standard TT', 'Libre Baskerville', 'DM Serif Display'], body: 'Old Standard TT', cols: 4, bs: 9.5 },
  tab: { mast: 'Anton', head: ['Anton', 'Bebas Neue', 'Oswald', 'Alfa Slab One'], body: 'Lora', cols: 3, bs: 10.5, band: true },
  gaz: { mast: 'UnifrakturCook', head: ['Rye', 'Old Standard TT', 'Special Elite', 'Abril Fatface'], body: 'Libre Baskerville', cols: 3, bs: 9.5, stock: 'aged' },
  mag: { mast: 'Playfair Display', head: ['DM Serif Display', 'Playfair Display', 'Abril Fatface', 'Cormorant Garamond'], body: 'Lora', cols: 2, bs: 11 },
  book: { mast: null, head: ['Cormorant Garamond', 'Lora', 'Playfair Display', 'Libre Baskerville'], body: 'Libre Baskerville', cols: 1, bs: 12.5 }
};
var FW = 'the of and to in a is that for it as was with be by on at from which but have an had they were their one all can has there been more when will would who so no'.split(' ');
var NW = 'council market report city police minister budget school court election weather storm harbour train factory season river bridge county theatre railway farmers prices record trade committee voters festival mayor station coast winter garden museum library bakery orchestra league student hospital airport village district company workers union plan opens closes returns wins sees faces gains falls rises says finds shows year week century local national public new first final annual former senior early late open'.split(' ');
var PRE = ['WHY EVERYONE IS TALKING ABOUT', 'THE QUIET RISE OF', 'INSIDE THE STORY OF', 'A NEW LOOK AT', 'THE LONG ROAD TO', 'WHAT WE LEARNED ABOUT', 'THE TOWN WAKES UP TO'];
var POST = ['AND WHAT IT MEANS FOR ALL OF US', 'THE FULL STORY INSIDE', 'CHANGES EVERYTHING THIS WEEK', 'COMES HOME AT LAST', 'FIVE THINGS WE LEARNED'];
var MAST = ['The Daily Ledger', 'The Harbour Courier', 'Valley Dispatch', 'The Weekly Gazette', 'The Morning Bulletin', 'Lantern Times', 'The Paper Mill Press'];
function fitText(font, text, bold, capPx, maxW) {
  var m = mkCanvas(8, 8).getContext('2d'), s0 = 100, mt, k, asc;
  m.font = K.font(font, s0, bold); mt = m.measureText(text); asc = mt.actualBoundingBoxAscent || s0 * 0.72; k = capPx / asc;
  if (mt.width * k > maxW) k = maxW / mt.width;
  return { size: s0 * k, asc: asc * k };
}
function hs(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; }
function wordGen(r) {
  var cap = true;
  return function () {
    var wd = r() < 0.55 ? FW[Math.floor(r() * FW.length)] : NW[Math.floor(r() * NW.length)];
    if (cap) { wd = wd[0].toUpperCase() + wd.slice(1); cap = false; }
    var q = r(); if (q < 0.06) { wd += '.'; cap = true; } else if (q < 0.14) wd += ',';
    return wd;
  };
}
/* justified column of filler copy */
function flow(x, r, colX, colW, y0, y1, lh, bs) {
  var next = wordGen(r), pending = null, y = y0;
  while (y + bs <= y1) {
    var line = [], lw = 0, sp = bs * 0.27, wd, ww;
    for (;;) {
      wd = pending || next(); pending = null; ww = x.measureText(wd).width;
      if (line.length && lw + ww + sp * line.length > colW) { pending = wd; break; }
      line.push([wd, ww]); lw += ww; if (line.length > 14) break;
    }
    var gaps = line.length - 1, extra = gaps > 0 ? (colW - lw) / gaps : 0, xx = colX, i;
    if (r() < 0.07 || extra > bs * 1.6) extra = sp;
    for (i = 0; i < line.length; i++) { x.fillText(line[i][0], xx, y + bs); xx += line[i][1] + extra; }
    y += lh;
  }
}
function halftone(x, bx, by, bw, bh, r, ink) {
  x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip(); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(bx, by, bw, bh); x.fillStyle = ink;
  var cx = bx + bw * (0.3 + 0.4 * r()), cy = by + bh * (0.3 + 0.3 * r()), sp = 3.6, px, py, row = 0, d, val;
  for (py = by; py < by + bh; py += sp, row++) for (px = bx + (row % 2) * sp / 2; px < bx + bw; px += sp) {
    d = Math.hypot(px - cx, (py - cy) * 1.3) / (bw * 0.55); val = clamp(1 - d, 0, 1) * 0.8 + 0.12 * Math.sin(px * 0.09 + py * 0.05);
    if (val > 0.08) { x.beginPath(); x.arc(px, py, val * 1.8, 0, 7); x.fill(); }
  }
  x.restore(); x.strokeStyle = ink; x.lineWidth = 1; x.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
}
var CL = K.lru(40);
function makeClip(kw, fi, W, H) {
  var key = [kw, fi, W, H, sel('nwPub'), sel('nwStock'), num('nwSize')].join('|'), hit = CL.get(key);
  if (hit) return hit;
  var seed = hs(kw) + fi * 977, r = K.rng(seed), u = H / 540, pk = sel('nwPub') === 'mix' ? PUBLIST[(fi + hs(kw)) % 5] : sel('nwPub'), pub = PUB[pk];
  var stockKey = sel('nwStock') === 'auto' ? (pub.stock || STOCKLIST[Math.floor(r() * STOCKLIST.length)]) : sel('nwStock'), paper = STOCKS[stockKey];
  var cw = Math.round(W * (0.8 + 0.16 * r())), ch = Math.round(H * (0.68 + 0.26 * r())), ink = stockKey === 'kraft' ? '#1c140c' : stockKey === 'aged' ? '#2a1c0b' : '#161513';
  var headFont = K.pick(r, pub.head), kwSize = num('nwSize') * u, m = mkCanvas(8, 8).getContext('2d'), mt;
  m.font = K.font(headFont, kwSize, true); mt = m.measureText(kw);
  if (mt.width > cw * 0.9) { kwSize *= cw * 0.9 / mt.width; m.font = K.font(headFont, kwSize, true); mt = m.measureText(kw); }
  var kwW = mt.width, asc = mt.actualBoundingBoxAscent || kwSize * 0.72, desc = mt.actualBoundingBoxDescent || 0, kwH = asc + desc;
  var kx = cw / 2 + (r() - 0.5) * (cw - kwW) * 0.4, ky = ch * (0.42 + 0.16 * r());
  var kLo = Math.max(kwW / 2 + 8 * u, cw - W * 0.485), kHi = Math.min(cw - kwW / 2 - 8 * u, W * 0.485);
  kx = kLo <= kHi ? clamp(kx, kLo, kHi) : cw / 2; ky = clamp(ky, ch - H * 0.485, H * 0.485);
  var c = mkCanvas(cw, ch), x = c.getContext('2d'), i, j;
  x.fillStyle = paper; x.fillRect(0, 0, cw, ch);
  x.globalAlpha = 0.55; x.fillStyle = x.createPattern(K.GRAIN, 'repeat'); x.fillRect(0, 0, cw, ch); x.globalAlpha = 1;
  var fc = cw * (0.3 + 0.4 * r()), fg = x.createLinearGradient(fc - 14 * u, 0, fc + 14 * u, 0);
  fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(0.5, 'rgba(0,0,0,.07)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = fg; x.fillRect(0, 0, cw, ch);
  var eg = x.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75); eg.addColorStop(0, 'rgba(90,60,20,0)'); eg.addColorStop(1, 'rgba(90,60,20,.16)'); x.fillStyle = eg; x.fillRect(0, 0, cw, ch);
  x.textBaseline = 'alphabetic'; x.fillStyle = ink; x.strokeStyle = ink;
  var top = 12 * u;
  if (pub.mast) {
    var mname = K.pick(r, MAST), mh = 54 * u, ms = pk === 'gaz' ? 40 * u : pk === 'tab' ? 40 * u : 32 * u;
    if (pk === 'tab') { var bandH = mh * 0.82, ft = fitText(pub.mast, mname.toUpperCase(), false, bandH * 0.56, cw * 0.88); x.fillStyle = '#c81d11'; x.fillRect(0, 0, cw, bandH); x.fillStyle = '#fff'; x.font = K.font(pub.mast, ft.size); x.textAlign = 'center'; x.fillText(mname.toUpperCase(), cw / 2, (bandH + ft.asc) / 2); }
    else if (pk === 'mag') { x.font = K.font(pub.mast, ms, true); x.textAlign = 'left'; x.fillText(mname, 16 * u, 12 * u + ms * 0.8); x.fillRect(16 * u, mh - 2 * u, cw - 32 * u, 1.4 * u); }
    else { x.font = K.font(pub.mast, ms, true); x.textAlign = 'center'; x.fillText(pk === 'gaz' ? mname : mname.toUpperCase(), cw / 2, 10 * u + ms * 0.85); x.fillRect(16 * u, mh - 6 * u, cw - 32 * u, 2.4 * u); x.fillRect(16 * u, mh - 2 * u, cw - 32 * u, 1 * u); }
    if (pk !== 'tab' && pk !== 'mag') { x.font = K.font('Libre Baskerville', 7.5 * u); x.textAlign = 'center'; x.fillText('LATE EDITION  ·  WEDNESDAY  ·  THREE CENTS', cw / 2, mh + 7 * u); mh += 9 * u; }
    top = mh + 6 * u; x.fillStyle = ink;
  }
  var bs = pub.bs * u, lh = bs * 1.3, cols = pub.cols, mg = 16 * u, gut = 12 * u, colW = (cw - 2 * mg - (cols - 1) * gut) / cols;
  if (pk === 'book') { colW = Math.min(colW, 430 * u); mg = (cw - colW) / 2; }
  var preH = pk === 'book' ? kwSize * 0.42 : kwSize * 0.45, postH = pk === 'book' ? kwSize * 0.1 : kwSize * 0.58, headTop = ky - kwH / 2 - preH - 8 * u, headBot = ky + kwH / 2 + postH + 8 * u;
  x.font = K.font(pub.body, bs); x.textAlign = 'left';
  function fillRegion(y0, y1, withPhoto) {
    if (y1 - y0 < lh * 2.2) return;
    x.font = K.font(pub.body, bs); x.textAlign = 'left'; x.fillStyle = ink;
    for (i = 0; i < cols; i++) {
      var cx0 = mg + i * (colW + gut), yy = y0;
      if (i > 0) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(cx0 - gut / 2, y0, 0.8, y1 - y0); }
      x.fillStyle = ink;
      if (r() < 0.65 && y1 - yy > lh * 6) {
        x.font = K.font(K.pick(r, pub.head), 15 * u, true); x.textAlign = 'left';
        var sh = (NW[Math.floor(r() * NW.length)] + ' ' + NW[Math.floor(r() * NW.length)] + ' ' + NW[Math.floor(r() * NW.length)]).toUpperCase();
        x.fillText(sh, cx0, yy + 14 * u, colW); yy += 22 * u; x.font = K.font(pub.body, bs);
      }
      if (withPhoto && cols > 1 && i === Math.floor(r() * cols) && y1 - yy > 90 * u) { var ph = (55 + r() * 30) * u; halftone(x, cx0, yy, colW, ph, r, ink); yy += ph + 3 * u; x.font = K.font(pub.body, bs * 0.8); x.fillText('Photograph: staff', cx0, yy + bs * 0.8); yy += lh; x.font = K.font(pub.body, bs); }
      flow(x, r, cx0, colW, yy, y1, lh, bs);
    }
  }
  fillRegion(top, headTop, false); fillRegion(headBot, ch - (pk === 'book' ? 26 : 14) * u, true);
  if (pk === 'tab') { x.fillStyle = ink; x.fillRect(0, headTop + 2 * u, cw, 3.5 * u); x.fillRect(0, headBot - 5 * u, cw, 3.5 * u); }
  var small = K.font(pk === 'book' ? 'Cormorant Garamond' : 'Oswald', kwSize * 0.27, true), kl = kx - kwW / 2, kr = kx + kwW / 2;
  x.fillStyle = ink; x.font = small; if ('letterSpacing' in x) x.letterSpacing = Math.round(kwSize * 0.03) + 'px';
  if (pk === 'book') { x.textAlign = 'center'; x.fillText('CHAPTER ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][fi % 10], kx, ky - kwH / 2 - kwSize * 0.2); }
  else { x.textAlign = 'left'; x.fillText(K.pick(r, PRE), kl, ky - kwH / 2 - kwSize * 0.14, kwW); x.textAlign = 'right'; x.fillText(K.pick(r, POST), kr, ky + kwH / 2 + kwSize * 0.44, kwW); }
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  x.textAlign = 'center'; x.font = K.font(headFont, kwSize, true); x.fillStyle = ink; x.fillText(kw, kx, ky + (asc - desc) / 2);
  if (pk === 'book') { x.font = K.font(pub.body, 9 * u); x.fillStyle = ink; x.fillText(String(12 + Math.floor(r() * 300)), cw / 2, ch - 8 * u); }
  return CL.set(key, { c: c, cw: cw, ch: ch, kx: kx, ky: ky, kb: { x: kx - kwW / 2, y: ky - kwH / 2, w: kwW, h: kwH }, rot: (r() - 0.5) * 0.05, seed: seed, pk: pk });
}
function polyProgress(ctx, pts, p) {
  var n = Math.max(2, Math.floor(p * (pts.length - 1)) + 1), i; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
}
function drawHighlight(ctx, kb, p, style, color, seed, pk) {
  if (p <= 0) return;
  var i, pts = [], h = kb.h, cx = kb.x + kb.w / 2, cy = kb.y + kb.h / 2, jit = function (k) { return (K.hash2(k, seed, 6) - 0.5) * h * 0.03; };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (style === 'marker') {
    var x0 = kb.x - h * 0.12, y0 = kb.y - h * 0.04, ww = (kb.w + h * 0.24) * p, hh = h * 1.08;
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x0, y0 + jit(0));
    for (i = 1; i <= 12; i++) ctx.lineTo(x0 + ww * i / 12, y0 + jit(i)); for (i = 12; i >= 0; i--) ctx.lineTo(x0 + ww * i / 12 + (i === 12 ? h * 0.02 : 0), y0 + hh + jit(i + 20));
    ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, h * 0.055);
    if (style === 'box') {
      var bx = kb.x - h * 0.14, by = kb.y - h * 0.1, bw = kb.w + h * 0.28, bh = h * 1.2, per = [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh], [bx, by - bh * 0.08]], s, k = 0;
      for (s = 0; s < 4; s++) for (i = 0; i < 20; i++, k++) pts.push([lerp(per[s][0], per[s + 1][0], i / 20) + jit(k), lerp(per[s][1], per[s + 1][1], i / 20) + jit(k + 99)]);
    } else if (style === 'circle') {
      var rx = kb.w * 0.6 + h * 0.4, ry = h * 0.85, th0 = -2.2, N = 90;
      for (i = 0; i <= N; i++) { var th = th0 + i / N * Math.PI * 2 * 1.1, rr = 1 + 0.03 * Math.sin(th * 2 + 1) - 0.05 * i / N; pts.push([cx + Math.cos(th) * rx * rr, cy + Math.sin(th) * ry * rr]); }
    } else for (i = 0; i <= 40; i++) pts.push([kb.x - h * 0.1 + (kb.w + h * 0.2) * i / 40, kb.y + h * 1.12 + Math.sin(i * 0.9) * h * 0.025 + jit(i)]);
    polyProgress(ctx, pts, p);
  }
  ctx.restore();
}
function drawClip(ctx, w, h, cl, v, scale, alpha, p, ox, oy) {
  var rim = Math.max(0, num('edge')) * 0.3, boil = num('boil'), bi = K.boilIndex(M.nowT || 0);
  ctx.save(); ctx.translate(w / 2 + (ox || 0), h / 2 + (oy || 0)); ctx.rotate(cl.rot + (boil > 0 ? (K.hash2(bi, cl.seed, 3) - 0.5) * boil * 0.003 : 0)); ctx.scale(scale, scale); ctx.translate(-cl.kx, -cl.ky);
  ctx.globalAlpha = alpha;
  var outer = K.tornRect(0, 0, cl.cw, cl.ch, cl.seed, v), sd = num('shadow');
  ctx.save();
  if (sd > 0) { ctx.shadowColor = 'rgba(0,0,0,' + (0.25 + Math.min(0.35, sd / 150)).toFixed(2) + ')'; ctx.shadowBlur = num('shBlur'); ctx.shadowOffsetX = sd * 0.35; ctx.shadowOffsetY = sd * 0.55; }
  ctx.fillStyle = $('edgeColor').value; K.pathPts(ctx, outer); ctx.fill(); ctx.restore();
  ctx.save(); K.pathPts(ctx, rim > 0.5 ? K.tornRect(rim, rim, cl.cw - rim * 2, cl.ch - rim * 2, cl.seed + 9, v) : outer); ctx.clip(); ctx.drawImage(cl.c, 0, 0); ctx.restore();
  drawHighlight(ctx, cl.kb, p, sel('nwHl'), $('hlColor').value, cl.seed, cl.pk);
  ctx.restore();
}
M.news = function (ctx, w, h, t, opts) {
  var kws = K.lines('nwWords').map(function (s) { return s.toUpperCase(); });
  if (!kws.length) { M.hint(ctx, w, h, 'Type a keyword'); return; }
  var period = 60 / num('nwBpm'), f = Math.floor(t / period), tn = (t - f * period) / period, nF = Math.round(num('nwFrames')), kind = sel('trKind'), len = num('trLen') / 100;
  var k = kind === 'cut' ? 0 : clamp((tn - (1 - len)) / len, 0, 1), v = K.variant(t), hlT = num('nwHlTime') / 100;
  if (M.lastNews !== f) { M.lastNews = f; if (!(opts && opts.silent)) K.sfx('beat'); }
  M.nowT = t;
  function clipFor(fr) { return makeClip(kws[Math.floor(fr / nF) % kws.length], fr % nF, w, h); }
  var pr = clamp((tn - 0.04) / hlT, 0, 1), pop = tn < 0.1 ? 1 + (0.1 - tn) * 0.3 : 1;
  K.trans(ctx, w, h, kind, k, function (c) { drawClip(c, w, h, clipFor(f), v, pop, 1, pr); }, function (c) { drawClip(c, w, h, clipFor(f + 1), v, 1, 1, 0); });
  if (tn > 0.3 && k <= 0) clipFor(f + 1);
};
})();
