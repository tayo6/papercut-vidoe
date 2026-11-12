(function () {
'use strict';
var K = window.__snip, $ = K.$, num = K.num, clamp = K.clamp, mkCanvas = K.mkCanvas, boxBlur = K.boxBlur, vnoise = K.vnoise, fbm = K.fbm, smooth = K.smooth, hexToRgb = K.hexToRgb;
var FCACHE = new Map();
function tri(v) { v = v - Math.floor(v); return Math.abs(v * 2 - 1) * 2 - 1; }

/* Edge displacement in px along a straight edge, for torn rectangles (newspaper clippings, scraps). */
K.edgeDisp = function (style, s, seed, amp, v) {
  var detail = num('detail'), f1 = 0.02 + 0.06 * (detail / 100), m = clamp(num('boil') / 10, 0, 1) * 0.9, d;
  if (style === 'scissors') d = vnoise(s * 0.012, seed, 3) * amp * 0.5;
  else if (style === 'pinking') d = tri(s * 0.07) * amp * 0.45 + vnoise(s * 0.02, seed, 2) * amp * 0.25;
  else if (style === 'deckle') d = fbm(s * f1 * 2.4, seed, 21) * amp * 0.6;
  else d = (fbm(s * f1, seed, 11) + 0.3 * vnoise(s * 0.4, seed, 5)) * amp;
  if (m > 0 && style !== 'pinking') d += m * 0.5 * fbm(s * f1 * 1.3 + v * 7.3, seed + 31, 31) * amp;
  return d;
};

/* Build the paper silhouette around any canvas. Its alpha is the cut outline. */
function buildPaper(src, o) {
  var scl = o.scale || 1, edge = (o.edge != null ? o.edge : num('edge')) * scl, rough = o.rough != null ? o.rough : num('rough'), detail = o.detail != null ? o.detail : num('detail');
  var style = o.style || K.sel('cutStyle'), v = o.variant || 0, boil = o.noBoil ? 0 : (o.boil != null ? o.boil : num('boil'));
  var rb = edge * 1.4 + 4, pad = Math.ceil(edge + 0.4 * rb) + 10, sw = src.width, sh = src.height, w = sw + pad * 2, h = sh + pad * 2;
  var key = (o.key || '') + '|' + sw + 'x' + sh + '|' + edge, t = (rb - edge) / (2 * rb), field, i;
  if (o.key && FCACHE.has(key)) field = FCACHE.get(key);
  else {
    var sx = mkCanvas(w, h), sc = sx.getContext('2d', { willReadFrequently: true }); sc.drawImage(src, pad, pad);
    var d = sc.getImageData(0, 0, w, h).data; field = new Float32Array(w * h);
    for (i = 0; i < field.length; i++) field[i] = d[i * 4 + 3] / 255;
    boxBlur(field, w, h, rb);
    if (o.key) { FCACHE.set(key, field); if (FCACHE.size > 6) FCACHE.delete(FCACHE.keys().next().value); }
  }
  var amp = rough / 100 * 0.22, f = 0.015 + (0.22 - 0.015) * (detail / 100), m = clamp(boil / 10, 0, 1) * 0.9, vo = v * 17.31, vo2 = v * 9.77;
  var rgb = hexToRgb(o.color || $('edgeColor').value), fibre = style === 'torn' || style === 'deckle', soft = 0.02;
  var out = mkCanvas(w, h), ox = out.getContext('2d'), id = ox.createImageData(w, h), od = id.data, x, y, s0, n, a, a2, q;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
    var fv = field[y * w + x]; s0 = fv - t; q = (y * w + x) * 4;
    if (s0 > 0.42) a = 1;
    else if (s0 < -0.42 || fv < 0.001) a = 0;
    else {
      var xs = x / scl, ys = y / scl;
      if (style === 'torn') { n = fbm(xs * f, ys * f, 11) + vnoise(xs * 0.55, ys * 0.55, 5) * 0.22; soft = 0.075; if (m > 0) n += m * 0.65 * fbm(xs * f * 1.3 + vo, ys * f * 1.3 + vo2, 31); }
      else if (style === 'scissors') {
        var fx = xs * f * 0.3, fy = ys * f * 0.3, ix = Math.floor(fx), iy = Math.floor(fy), ux = fx - ix, uy = fy - iy;
        var h00 = K.hash2(ix, iy, 3) * 2 - 1, h10 = K.hash2(ix + 1, iy, 3) * 2 - 1, h01 = K.hash2(ix, iy + 1, 3) * 2 - 1, h11 = K.hash2(ix + 1, iy + 1, 3) * 2 - 1;
        n = (h00 * (1 - ux) + h10 * ux) * (1 - uy) + (h01 * (1 - ux) + h11 * ux) * uy; soft = 0.018;
        if (m > 0) n += m * 0.25 * vnoise(xs * f * 0.4 + vo, ys * f * 0.4 + vo2, 41);
      } else if (style === 'pinking') { var fz = 0.03 + 0.13 * (detail / 100); n = (tri(xs * fz) + tri(ys * fz)) * 0.5 + vnoise(xs * f * 0.3, ys * f * 0.3, 2) * 0.25; soft = 0.02; if (m > 0) n += m * 0.2 * vnoise(xs * f * 0.5 + vo, ys * f * 0.5 + vo2, 43); }
      else { n = fbm(xs * f * 2.6, ys * f * 2.6, 21) * 0.8 + vnoise(xs * f * 0.3, ys * f * 0.3, 9) * 0.4; soft = 0.13; if (m > 0) n += m * 0.5 * fbm(xs * f * 2.6 + vo, ys * f * 2.6 + vo2, 33); }
      a = smooth(-soft, soft, s0 + n * amp);
      if (fibre && rough > 0 && fv > 0.02) {
        a2 = smooth(-0.24, -0.04, s0 + vnoise(xs * 0.85 + vo, ys * 0.85 + vo2, 55) * amp * 1.1 + n * amp * 0.3) * 0.34;
        if (a2 > a) a = a2;
      }
    }
    od[q] = rgb[0]; od[q + 1] = rgb[1]; od[q + 2] = rgb[2]; od[q + 3] = Math.round(a * 255);
  }
  ox.putImageData(id, 0, 0);
  return { paper: out, pad: pad, w: w, h: h };
}

/* Paper outline, texture and grain, with the source art clipped inside. */
K.cutout = function (src, o) {
  o = o || {};
  var b = buildPaper(src, o), w = b.w, h = b.h, res = mkCanvas(w, h), x = res.getContext('2d');
  var tex = o.tex != null ? o.tex : K.sel('paperTex'), tile = K.texTile(tex), grain = (o.grain != null ? o.grain : num('grain')) / 100;
  x.drawImage(b.paper, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  if (tile) { x.fillStyle = x.createPattern(tile, 'repeat'); x.fillRect(0, 0, w, h); }
  if (grain > 0) { x.globalAlpha = grain * (tile ? 0.5 : 0.95); x.fillStyle = x.createPattern(K.GRAIN, 'repeat'); x.fillRect(0, 0, w, h); x.globalAlpha = 1; }
  x.globalCompositeOperation = 'source-over';
  var back = null;
  if (o.withBack) { back = mkCanvas(w, h); var bk = back.getContext('2d'); bk.drawImage(res, 0, 0); bk.globalCompositeOperation = 'source-atop'; bk.fillStyle = 'rgba(60,45,25,.07)'; bk.fillRect(0, 0, w, h); }
  res.pad = b.pad; res.subW = src.width; res.subH = src.height;
  if (o.noArt) { res.back = back; return res; }
  var art = mkCanvas(w, h), ax = art.getContext('2d');
  ax.drawImage(src, b.pad, b.pad); ax.globalCompositeOperation = 'destination-in'; ax.drawImage(b.paper, 0, 0);
  x.save();
  if (o.innerShadow !== 0) { x.shadowColor = 'rgba(0,0,0,.38)'; x.shadowBlur = 5 * (o.scale || 1); x.shadowOffsetY = 2 * (o.scale || 1); }
  x.drawImage(art, 0, 0); x.restore();
  if (grain > 0) { x.globalCompositeOperation = 'source-atop'; x.globalAlpha = grain * 0.35; x.fillStyle = x.createPattern(K.GRAIN, 'repeat'); x.fillRect(0, 0, w, h); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  res.back = back;
  return res;
};

/* Torn-edged rectangle outline as a polygon, so clippings stay cheap to redraw every boil frame. */
K.tornRect = function (x0, y0, w, h, seed, v) {
  var style = K.sel('cutStyle'), amp = Math.max(1.5, num('rough') / 100 * 14 + num('edge') * 0.15), pts = [], s, step = 4;
  for (s = 0; s <= w; s += step) pts.push([x0 + s, y0 - K.edgeDisp(style, s, seed, amp, v)]);
  for (s = 0; s <= h; s += step) pts.push([x0 + w + K.edgeDisp(style, s, seed + 1, amp, v), y0 + s]);
  for (s = w; s >= 0; s -= step) pts.push([x0 + s, y0 + h + K.edgeDisp(style, s, seed + 2, amp, v)]);
  for (s = h; s >= 0; s -= step) pts.push([x0 - K.edgeDisp(style, s, seed + 3, amp, v), y0 + s]);
  return pts;
};
K.pathPts = function (ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
})();
