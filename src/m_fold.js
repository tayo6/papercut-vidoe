(function () {
'use strict';
var K = window.__snip, $ = K.$, M = K.M, num = K.num, sel = K.sel, chk = K.chk, clamp = K.clamp, mkCanvas = K.mkCanvas;
var PI = Math.PI, SUB = 4;
function sstep(q) { return q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q); }
function smooth01(a, b, x) { var q = clamp((x - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); }

/* ---------- timing: linear 0 -> 1, hold, 1 -> 0. Each hinge applies its own easing. ---------- */
M.foldOpen = function () { return Math.max(0.6, num('fOpen') / 10); };
M.foldCycle = function () { return M.foldOpen() * 2 + num('fHold') / 10; };
M.foldState = function (t) {
  var open = M.foldOpen(), hold = num('fHold') / 10, c = t % M.foldCycle();
  if (c < open) return { p: c / open, dir: 1, tc: c, T: open };
  if (c < open + hold) return { p: 1, dir: 0, tc: c, T: open };
  return { p: 1 - (c - open - hold) / open, dir: -1, tc: c, T: open };
};

/* ---------- one folding axis ----------
   Boundaries between vertex columns (or rows) carry a signed hinge angle: real creases at the panel edges and
   a small bending angle between them. Panels open outward from the anchor panel, each flap swinging over the top
   and carrying the still-folded paper with it. Hinge axes sit a little above the sheet so stacked layers keep
   their order, like paper with thickness. */
function makeAxis(n, anchor, p, st, o) {
  var nv = n * SUB + 1, ang = new Float64Array(nv), zt = new Float64Array(nv), q = new Float64Array(n + 1);
  var nR = n - 1 - anchor, nL = anchor, nc = Math.max(nR, nL, 1);
  [[1, nR, -1], [-1, nL, 1]].forEach(function (side) {
    var dirn = side[0], count = side[1], s = side[2], flv = [], k, j, u;
    for (k = 1; k <= count; k++) {
      var m = dirn > 0 ? anchor + k : anchor - k + 1, cc = o.sync ? nc : count;
      var start = (k - 1) / cc * o.stag, dur = 1 - o.stag * (cc - 1) / cc, qq = clamp((p - start) / dur, 0, 1), theta = PI * (1 - sstep(qq));
      q[m] = qq; ang[m * SUB] = s * theta; zt[m * SUB] = o.zeta * (1 - k / (cc + 2));
      var fl, since = st.tc - (start + dur) * st.T;
      if (st.dir < 0) fl = -0.6 * Math.sin(PI * qq);
      else if (qq >= 1 && since > 0) fl = Math.abs(Math.sin(since * 15 + k)) * Math.exp(-since * 5.5) * 0.5;
      else fl = Math.sin(PI * qq);
      flv.push(fl > 0 ? Math.min(o.bend * fl, (PI - theta) * 0.8) : o.bend * fl);
    }
    /* a flap carries the paper nested inside it, so that paper bends along the same curve (alternating sense) */
    for (k = 1; k <= count; k++) {
      var pm = dirn > 0 ? anchor + k : anchor - k, tot = 0;
      for (j = 1; j <= k; j++) tot += ((k - j) % 2 ? -1 : 1) * flv[j - 1];
      for (u = 1; u < SUB; u++) ang[pm * SUB + u] = s * tot / SUB;
    }
  });
  return { ang: ang, zt: zt, q: q, n: n, a0: anchor * SUB, a1: (anchor + 1) * SUB };
}
function rotCol(P, Xb, zb, a) { var c = Math.cos(a), s = Math.sin(a), dx = P[0] - Xb, dz = P[2] - zb; P[0] = Xb + dx * c + dz * s; P[2] = zb - dx * s + dz * c; }
function rotRow(P, Yb, zb, a) { var c = Math.cos(a), s = Math.sin(a), dy = P[1] - Yb, dz = P[2] - zb; P[1] = Yb + dy * c - dz * s; P[2] = zb + dy * s + dz * c; }
function foldCols(P, ax, i, iw) {
  var b, nb = ax.n * SUB;
  if (i > ax.a1) for (b = i - 1; b >= ax.a1; b--) { if (ax.ang[b] !== 0) rotCol(P, (b / nb - 0.5) * iw, ax.zt[b], ax.ang[b]); }
  else if (i < ax.a0) for (b = i + 1; b <= ax.a0; b++) { if (ax.ang[b] !== 0) rotCol(P, (b / nb - 0.5) * iw, ax.zt[b], ax.ang[b]); }
}
function foldRows(P, ax, j, ih) {
  var b, nb = ax.n * SUB;
  if (j > ax.a1) for (b = j - 1; b >= ax.a1; b--) { if (ax.ang[b] !== 0) rotRow(P, (0.5 - b / nb) * ih, ax.zt[b], ax.ang[b]); }
  else if (j < ax.a0) for (b = j + 1; b <= ax.a0; b++) { if (ax.ang[b] !== 0) rotRow(P, (0.5 - b / nb) * ih, ax.zt[b], ax.ang[b]); }
}

/* ---------- which panels hold paper ---------- */
var OCC = new WeakMap();
function occupancy(img, C, R) {
  var key = C + 'x' + R, hit = OCC.get(img);
  if (hit && hit.key === key) return hit.occ;
  var gw = C * 12, gh = R * 12, c = mkCanvas(gw, gh), x = c.getContext('2d', { willReadFrequently: true }), d, occ = [], pr, pc, i, j, any;
  x.drawImage(img, 0, 0, gw, gh); d = x.getImageData(0, 0, gw, gh).data;
  for (pr = 0; pr < R; pr++) for (pc = 0; pc < C; pc++) {
    any = false;
    for (j = 0; j < 12 && !any; j++) for (i = 0; i < 12; i++) if (d[((pr * 12 + j) * gw + pc * 12 + i) * 4 + 3] > 6) { any = true; break; }
    occ.push(any);
  }
  OCC.set(img, { key: key, occ: occ }); return occ;
}

/* ---------- textured triangle ---------- */
function texTri(x, img, ax, ay, au, av, bx, by, bu, bv, cx, cy, cu, cv, infl) {
  var d1u = bu - au, d1v = bv - av, d2u = cu - au, d2v = cv - av, det = d1u * d2v - d2u * d1v;
  if (Math.abs(det) < 1e-6) return;
  var d1x = bx - ax, d1y = by - ay, d2x = cx - ax, d2y = cy - ay;
  if (Math.abs(d1x * d2y - d1y * d2x) < 0.06) return;
  var A = (d1x * d2v - d2x * d1v) / det, C = (d1u * d2x - d2u * d1x) / det, B = (d1y * d2v - d2y * d1v) / det, D = (d1u * d2y - d2u * d1y) / det;
  var E = ax - A * au - C * av, F = ay - B * au - D * av, mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3, i, px, py, L, k, xs = [ax, bx, cx], ys = [ay, by, cy];
  x.save(); x.beginPath();
  for (i = 0; i < 3; i++) { px = xs[i] - mx; py = ys[i] - my; L = Math.hypot(px, py) || 1; k = (L + infl) / L; if (i) x.lineTo(mx + px * k, my + py * k); else x.moveTo(mx + px * k, my + py * k); }
  x.closePath(); x.clip(); x.setTransform(A, B, C, D, E, F);
  var u0 = Math.max(0, Math.min(au, bu, cu) - 1.5), v0 = Math.max(0, Math.min(av, bv, cv) - 1.5), u1 = Math.min(img.width, Math.max(au, bu, cu) + 1.5), v1 = Math.min(img.height, Math.max(av, bv, cv) + 1.5);
  if (u1 > u0 && v1 > v0) x.drawImage(img, u0, v0, u1 - u0, v1 - v0, u0, v0, u1 - u0, v1 - v0);
  x.restore();
}

/* ---------- panel canvases (largest first, so big canvases sit at the low indexes) ---------- */
var POOL = [], LAYERS = {};
function poolCanvas(k, w, h) {
  var c = POOL[k];
  if (!c) c = POOL[k] = mkCanvas(Math.max(8, w), Math.max(8, h));
  else if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
  var x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, c.width, c.height); return c;
}
function layer(w, h, which) {
  var key = w + 'x' + h + (which ? 't' : 's'), c = LAYERS[key];
  if (!c) { var ks = Object.keys(LAYERS); if (ks.length > 5) delete LAYERS[ks[0]]; c = LAYERS[key] = mkCanvas(w, h); }
  var x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.shadowColor = 'rgba(0,0,0,0)'; x.shadowBlur = 0; x.shadowOffsetX = 0; x.shadowOffsetY = 0; x.clearRect(0, 0, w, h); return c;
}

var LX = -0.4, LY = 0.56, LZ = 0.72, LL = Math.hypot(LX, LY, LZ); LX /= LL; LY /= LL; LZ /= LL;
var HX = LX, HY = LY, HZ = LZ + 1, HL = Math.hypot(HX, HY, HZ); HX /= HL; HY /= HL; HZ /= HL;
var AMB = 0.7, F0 = AMB + (1 - AMB) * LZ, SP0 = Math.pow(HZ, 36);

M.unfold = function (ctx, w, h, t, opts) {
  var note = chk('noteOn'), img = note ? M.noteCard(t) : M.subjectPaper(t, true);
  if (!img) { M.hint(ctx, w, h, 'Pick a sample or upload a photo'); return; }
  var mo = M.motion(t, w, h), sc = Math.min(w / img.width, h / img.height) * (num('size') / 100) * mo.sc, st = M.foldState(t);
  var ci = Math.floor(t / M.foldCycle());
  if (M.lastFold !== ci) { M.lastFold = ci; if (!(opts && opts.silent)) K.sfx('snip'); }
  M.foldDraw(ctx, w, h, {
    img: img, back: img.back || img, p: st.p, dir: st.dir, tc: st.tc, T: st.T, C: parseInt(sel('fCols'), 10), R: parseInt(sel('fRows'), 10), dirKey: sel('fDir'),
    over: num('fOver') / 100, bend: num('fBend'), distort: num('distort'), tilt: num('fTilt'), crease: num('fCrease') / 100, sc: sc, rot: mo.rot * 0.5,
    cx: w / 2 + mo.dx, cy: h / 2 + mo.dy, shadow: num('shadow'), shBlur: num('shBlur')
  });
};

/* The fold renderer, shared by the Unfold mode and the video editor.
   spec: img, back (paper canvases), p/dir/tc/T (fold state), C, R, dirKey, over, bend, distort, tilt, crease,
   sc, rot, cx, cy (where the sheet sits on the frame), flipX, flipY, shadow, shBlur. Returns false when nothing was drawn. */
M.foldDraw = function (ctx, w, h, spec) {
  var img = spec.img, back = spec.back || img, iw = img.width, ih = img.height, size = Math.max(iw, ih);
  var sc = spec.sc, rot = spec.rot || 0, st = { p: spec.p, dir: spec.dir, tc: spec.tc, T: spec.T }, p = st.p;

  /* layout */
  var C = spec.C, R = spec.R, dir = spec.dirKey, over = spec.over, roll = false;
  var colsMain = dir === 'lr' || dir === 'rl' || dir === 'ctr';
  var aC = dir === 'lr' ? 0 : dir === 'rl' ? C - 1 : dir === 'ctr' ? Math.floor((C - 1) / 2) : Math.floor((C - 1) / 2);
  var aR = dir === 'tb' ? 0 : dir === 'bt' ? R - 1 : dir === 'ctr' ? Math.floor((R - 1) / 2) : Math.floor((R - 1) / 2);
  var bend = (0.12 + 0.9 * spec.bend / 100) * (1 + spec.distort / 200);
  var z0 = size * 0.0036, cp = (colsMain ? 1 : 2.6), rp = (colsMain ? 2.6 : 1);
  var stag = 0.95 - 0.85 * over, xo = { stag: stag, sync: dir === 'ctr', bend: bend, zeta: z0 * cp };
  var yo = { stag: stag, sync: dir === 'ctr', bend: bend, zeta: z0 * rp };
  var ov = (C > 1 && R > 1) ? 0.4 : 0, pm = clamp(p / (1 - ov), 0, 1), ps = clamp((p - ov) / (1 - ov), 0, 1), TM = st.T * (1 - ov);
  var stM = { dir: st.dir, tc: st.tc, T: TM }, stS = { dir: st.dir, tc: st.tc - st.T * ov, T: TM };
  var axC = makeAxis(C, aC, colsMain ? pm : ps, colsMain ? stM : stS, xo), axR = makeAxis(R, aR, colsMain ? ps : pm, colsMain ? stS : stM, yo);

  /* vertices */
  var nx = C * SUB + 1, ny = R * SUB + 1, nvt = nx * ny, i, j, k, idx;
  var occ = occupancy(img, C, R), used = new Uint8Array(nvt);
  for (var pr = 0; pr < R; pr++) for (var pc = 0; pc < C; pc++) if (occ[pr * C + pc]) for (j = pr * SUB; j <= (pr + 1) * SUB; j++) for (i = pc * SUB; i <= (pc + 1) * SUB; i++) used[j * nx + i] = 1;
  var WX = new Float64Array(nvt), WY = new Float64Array(nvt), WZ = new Float64Array(nvt), HT = new Float64Array(nvt), SX = new Float64Array(nvt), SY = new Float64Array(nvt);
  var tilt = spec.tilt * PI / 180 * (1 - sstep(p)), pitch = -tilt, yaw = tilt * 0.5, cpx = Math.cos(pitch), spx = Math.sin(pitch), cyw = Math.cos(yaw), syw = Math.sin(yaw), D = size * 2.6;
  var P3 = [0, 0, 0], sumX = 0, sumY = 0, flX = 0, flY = 0, cnt = 0;
  for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
    idx = j * nx + i; if (!used[idx]) continue;
    var fx = (i / (nx - 1) - 0.5) * iw, fy = (0.5 - j / (ny - 1)) * ih;
    P3[0] = fx; P3[1] = fy; P3[2] = 0;
    if (colsMain) { foldRows(P3, axR, j, ih); foldCols(P3, axC, i, iw); } else { foldCols(P3, axC, i, iw); foldRows(P3, axR, j, ih); }
    HT[idx] = P3[2];
    var x1 = P3[0] * cyw + P3[2] * syw, z1 = -P3[0] * syw + P3[2] * cyw, y1 = P3[1] * cpx - z1 * spx, z2 = P3[1] * spx + z1 * cpx;
    WX[idx] = x1; WY[idx] = y1; WZ[idx] = z2;
    var s = D / (D - Math.min(z2, D * 0.8)), X = x1 * s, Y = y1 * s;
    SX[idx] = X; SY[idx] = Y; sumX += X; sumY += Y; flX += fx; flY += fy; cnt++;
  }
  if (!cnt) return false;
  var follow = 0.9, tx = follow * (flX / cnt - sumX / cnt), ty = follow * (flY / cnt - sumY / cnt), cr = Math.cos(rot), sr = Math.sin(rot), fxm = spec.flipX ? -1 : 1, fym = spec.flipY ? -1 : 1;
  for (idx = 0; idx < nvt; idx++) {
    if (!used[idx]) continue;
    var a = (SX[idx] + tx) * fxm, b = -(SY[idx] + ty) * fym;
    SX[idx] = spec.cx + sc * (a * cr - b * sr); SY[idx] = spec.cy + sc * (a * sr + b * cr);
  }

  /* panels */
  var cw = iw / (nx - 1), ch = ih / (ny - 1), panels = [], creaseK = spec.crease, infl = 0.9;
  for (pr = 0; pr < R; pr++) for (pc = 0; pc < C; pc++) {
    if (!occ[pr * C + pc]) continue;
    var x0 = 1e9, y0 = 1e9, x1b = -1e9, y1b = -1e9, zh = 0, zn = 0, cells = [];
    for (j = pr * SUB; j <= (pr + 1) * SUB; j++) for (i = pc * SUB; i <= (pc + 1) * SUB; i++) { idx = j * nx + i; if (SX[idx] < x0) x0 = SX[idx]; if (SX[idx] > x1b) x1b = SX[idx]; if (SY[idx] < y0) y0 = SY[idx]; if (SY[idx] > y1b) y1b = SY[idx]; }
    for (j = pr * SUB; j < (pr + 1) * SUB; j++) for (i = pc * SUB; i < (pc + 1) * SUB; i++) {
      var ia = j * nx + i, ib = ia + 1, ic = ia + nx, id = ic + 1;
      var e1x = (WX[ib] + WX[id] - WX[ia] - WX[ic]) / 2, e1y = (WY[ib] + WY[id] - WY[ia] - WY[ic]) / 2, e1z = (WZ[ib] + WZ[id] - WZ[ia] - WZ[ic]) / 2;
      var e2x = (WX[ic] + WX[id] - WX[ia] - WX[ib]) / 2, e2y = (WY[ic] + WY[id] - WY[ia] - WY[ib]) / 2, e2z = (WZ[ic] + WZ[id] - WZ[ia] - WZ[ib]) / 2;
      var nxv = -(e1y * e2z - e1z * e2y), nyv = -(e1z * e2x - e1x * e2z), nzv = -(e1x * e2y - e1y * e2x), nl = Math.hypot(nxv, nyv, nzv) || 1;
      nxv /= nl; nyv /= nl; nzv /= nl;
      var mxw = (WX[ia] + WX[ib] + WX[ic] + WX[id]) / 4, myw = (WY[ia] + WY[ib] + WY[ic] + WY[id]) / 4, mzw = (WZ[ia] + WZ[ib] + WZ[ic] + WZ[id]) / 4;
      var vx = -mxw, vy = -myw, vz = D - mzw, vl = Math.hypot(vx, vy, vz) || 1, face = (nxv * vx + nyv * vy + nzv * vz) / vl;
      zh += (HT[ia] + HT[ib] + HT[ic] + HT[id]) / 4; zn++;
      var sg = face >= 0 ? 1 : -1, dd = (nxv * LX + nyv * LY + nzv * LZ) * sg, f = (AMB + (1 - AMB) * Math.max(dd, 0)) / F0 * (face >= 0 ? 1 : 0.97);
      var dk = clamp((1 - f) * 0.85, 0, 0.42), lt = clamp((f - 1) * 0.4, 0, 0.035);
      var spc = Math.max(0, Math.pow(Math.max(0, (nxv * HX + nyv * HY + nzv * HZ) * sg), 36) - SP0) * 0.5;
      cells.push({ ia: ia, ib: ib, ic: ic, id: id, i: i, j: j, front: face >= 0, edge: Math.abs(face) < 0.012, dk: dk, lt: Math.min(0.08, lt + spc * 0.25) });
    }
    panels.push({ pr: pr, pc: pc, cells: cells, x0: Math.floor(Math.max(-80, x0 - 3)), y0: Math.floor(Math.max(-80, y0 - 3)), x1: Math.ceil(Math.min(w + 80, x1b + 3)), y1: Math.ceil(Math.min(h + 80, y1b + 3)), zh: zh / zn });
  }
  panels = panels.filter(function (pn) { return pn.x1 > pn.x0 + 1 && pn.y1 > pn.y0 + 1; });
  panels.forEach(function (pn) { pn.bw = pn.x1 - pn.x0; pn.bh = pn.y1 - pn.y0; });
  var byArea = panels.slice().sort(function (a, b) { return b.bw * b.bh - a.bw * a.bh; });

  /* paint each panel on its own canvas: texture, lighting, crease marks */
  var uw = Math.max(0.8, sc * 1.1);
  byArea.forEach(function (pn, n) {
    var c = poolCanvas(n, pn.bw, pn.bh), x = c.getContext('2d'), ox = pn.x0, oy = pn.y0, cl, q;
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'medium';
    for (q = 0; q < pn.cells.length; q++) {
      cl = pn.cells[q]; if (cl.edge) continue;
      var tex = cl.front ? img : back, u0 = cl.i * cw, v0 = cl.j * ch, u1 = u0 + cw, v1 = v0 + ch;
      texTri(x, tex, SX[cl.ia] - ox, SY[cl.ia] - oy, u0, v0, SX[cl.ib] - ox, SY[cl.ib] - oy, u1, v0, SX[cl.ic] - ox, SY[cl.ic] - oy, u0, v1, infl);
      texTri(x, tex, SX[cl.ib] - ox, SY[cl.ib] - oy, u1, v0, SX[cl.id] - ox, SY[cl.id] - oy, u1, v1, SX[cl.ic] - ox, SY[cl.ic] - oy, u0, v1, infl);
    }
    x.globalCompositeOperation = 'source-atop';
    for (q = 0; q < pn.cells.length; q++) {
      cl = pn.cells[q]; if (cl.edge || (cl.dk < 0.012 && cl.lt < 0.012)) continue;
      x.beginPath(); x.moveTo(SX[cl.ia] - ox, SY[cl.ia] - oy); x.lineTo(SX[cl.ib] - ox, SY[cl.ib] - oy); x.lineTo(SX[cl.id] - ox, SY[cl.id] - oy); x.lineTo(SX[cl.ic] - ox, SY[cl.ic] - oy); x.closePath();
      if (cl.dk >= 0.012) { x.fillStyle = 'rgba(78,52,24,' + cl.dk.toFixed(3) + ')'; x.fill(); }
      if (cl.lt >= 0.012) { x.fillStyle = 'rgba(255,250,236,' + cl.lt.toFixed(3) + ')'; x.fill(); }
    }
    if (creaseK > 0) {
      var edges = [
        { on: pn.pc > 0, q: axC.q[pn.pc], vert: true, at: pn.pc * SUB, light: true }, { on: pn.pc < C - 1, q: axC.q[pn.pc + 1], vert: true, at: (pn.pc + 1) * SUB, light: false },
        { on: pn.pr > 0, q: axR.q[pn.pr], vert: false, at: pn.pr * SUB, light: true }, { on: pn.pr < R - 1, q: axR.q[pn.pr + 1], vert: false, at: (pn.pr + 1) * SUB, light: false }
      ];
      edges.forEach(function (e) {
        if (!e.on) return; var s = creaseK * smooth01(0.8, 1, e.q); if (s < 0.01) return;
        var m, pts = [], ins = [], idx2, inn, dx, dy, L;
        for (m = 0; m <= SUB; m++) {
          if (e.vert) { idx2 = (pn.pr * SUB + m) * nx + e.at; inn = idx2 + (e.light ? 1 : -1); } else { idx2 = e.at * nx + pn.pc * SUB + m; inn = idx2 + (e.light ? nx : -nx); }
          dx = SX[inn] - SX[idx2]; dy = SY[inn] - SY[idx2]; L = Math.hypot(dx, dy) || 1;
          pts.push([SX[idx2] - ox, SY[idx2] - oy]); ins.push([SX[idx2] - ox + dx / L * uw * 1.3, SY[idx2] - oy + dy / L * uw * 1.3]);
        }
        var line = e.light ? ins : pts;
        x.beginPath(); x.moveTo(line[0][0], line[0][1]); for (m = 1; m < line.length; m++) x.lineTo(line[m][0], line[m][1]);
        x.lineWidth = uw * (e.light ? 1.5 : 2.4); x.lineCap = 'butt'; x.strokeStyle = e.light ? 'rgba(255,255,255,' + (0.55 * s).toFixed(3) + ')' : 'rgba(40,24,6,' + (0.42 * s).toFixed(3) + ')'; x.stroke();
      });
    }
    x.globalCompositeOperation = 'source-over'; pn.c = c;
  });

  /* shadows: ground first (nothing falls on a neighbour in the same plane), then lifted flaps over what is below */
  var sd = spec.shadow, bl = spec.shBlur, baseA = 0.25 + Math.min(0.35, sd / 150), tol = size * 0.02;
  panels.sort(function (a, b) { return a.zh - b.zh; });
  if (sd > 0) {
    var sl = layer(w, h, 0), sx = sl.getContext('2d');
    panels.forEach(function (pn) {
      var hh = Math.max(0, pn.zh) * sc, a = baseA * (1 / (1 + hh / (size * 0.6)));
      sx.save(); sx.shadowColor = 'rgba(0,0,0,' + a.toFixed(3) + ')'; sx.shadowBlur = bl * sc + hh * 0.1; sx.shadowOffsetX = sd * 0.35 * sc + hh * 0.2; sx.shadowOffsetY = sd * 0.55 * sc + hh * 0.34;
      sx.drawImage(pn.c, 0, 0, pn.bw, pn.bh, pn.x0, pn.y0, pn.bw, pn.bh); sx.restore();
    });
    sx.shadowColor = 'rgba(0,0,0,0)'; sx.globalCompositeOperation = 'destination-out';
    panels.forEach(function (pn) { sx.drawImage(pn.c, 0, 0, pn.bw, pn.bh, pn.x0, pn.y0, pn.bw, pn.bh); });
    sx.globalCompositeOperation = 'source-over'; ctx.drawImage(sl, 0, 0);
  }
  panels.forEach(function (pn) {
    var rel = pn.zh - tol;
    if (sd > 0 && rel > 0) {
      var hh = rel * sc, a = Math.min(0.5, baseA * 0.9) * smooth01(0, size * 0.1, rel), tl = layer(w, h, 1), tx2 = tl.getContext('2d');
      tx2.shadowColor = 'rgba(0,0,0,' + a.toFixed(3) + ')'; tx2.shadowBlur = bl * sc * 0.6 + hh * 0.12; tx2.shadowOffsetX = hh * 0.22; tx2.shadowOffsetY = hh * 0.36;
      tx2.drawImage(pn.c, 0, 0, pn.bw, pn.bh, pn.x0, pn.y0, pn.bw, pn.bh);
      tx2.shadowColor = 'rgba(0,0,0,0)'; tx2.globalCompositeOperation = 'destination-out'; tx2.drawImage(pn.c, 0, 0, pn.bw, pn.bh, pn.x0, pn.y0, pn.bw, pn.bh); tx2.globalCompositeOperation = 'source-over';
      ctx.drawImage(tl, 0, 0);
    }
    ctx.drawImage(pn.c, 0, 0, pn.bw, pn.bh, pn.x0, pn.y0, pn.bw, pn.bh);
  });
  return true;
};
})();
