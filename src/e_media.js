(function () {
'use strict';
/* Video editor: media import (images, video, audio), thumbnails, built-in samples,
   background removal for any image, and text clips drawn to canvases. */
var K = window.__snip, E = K.E, mkCanvas = K.mkCanvas, clamp = K.clamp;
var IMG_MAX = 1920, SUBJ_RES = 800, MASK_RES = 640;

function onceEv(el, ev, ms) {
  return new Promise(function (res, rej) {
    var to = setTimeout(function () { cleanup(); rej(new Error(ev + ' timed out')); }, ms || 10000);
    function ok() { cleanup(); res(); } function bad() { cleanup(); rej(new Error('media error')); }
    function cleanup() { clearTimeout(to); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); }
    el.addEventListener(ev, ok); el.addEventListener('error', bad);
  });
}
E.onceEv = onceEv;
function thumbOf(src, sw, sh, max) {
  var s = Math.min(1, max / Math.max(sw, sh)), c = mkCanvas(sw * s, sh * s); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
function addMedia(m) { m.id = m.id || E.uid('m'); E.media[m.id] = m; E.mediaList.push(m.id); E.emit('media'); return m; }
function baseName(n) { return (n || 'Media').replace(/\.[^.]+$/, ''); }
E.kindOfFile = function (f) {
  var t = f.type || '', n = (f.name || '').toLowerCase();
  if (/^image\//.test(t) || /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/.test(n)) return 'image';
  if (/^video\//.test(t) || /\.(mp4|m4v|mov|webm|mkv|ogv)$/.test(n)) return 'video';
  if (/^audio\//.test(t) || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/.test(n)) return 'audio';
  return null;
};

/* ---------- audio helpers ---------- */
function decode(ab) {
  return new Promise(function (res, rej) {
    var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) { rej(new Error('no audio')); return; }
    var oc = new OC(2, 1, 44100), p = oc.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej);
  });
}
function peaksOf(buf) {
  var sr = buf.sampleRate, bucket = Math.max(1, Math.round(sr / 200)), n = Math.ceil(buf.length / bucket), pk = new Uint8Array(n), ch = [], c, i, j;
  for (c = 0; c < buf.numberOfChannels; c++) ch.push(buf.getChannelData(c));
  for (i = 0; i < n; i++) { var m = 0, a = i * bucket, b = Math.min(buf.length, a + bucket); for (c = 0; c < ch.length; c++) for (j = a; j < b; j += 2) { var v = Math.abs(ch[c][j]); if (v > m) m = v; } pk[i] = Math.min(255, Math.round(Math.sqrt(m) * 255)); }
  return { data: pk, perSec: sr / bucket };
}

/* ---------- import ---------- */
E.importImage = async function (file) {
  var bmp = null, w, h;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = null; }
  if (!bmp) {
    var url = URL.createObjectURL(file), im = new Image(); im.src = url;
    try { await im.decode(); } catch (e2) { URL.revokeObjectURL(url); throw e2; }
    bmp = im; setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  w = bmp.width || bmp.naturalWidth; h = bmp.height || bmp.naturalHeight;
  var s = Math.min(1, IMG_MAX / Math.max(w, h)), c = mkCanvas(w * s, h * s); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return addMedia({ kind: 'image', name: baseName(file.name), canvas: c, w: c.width, h: c.height, thumb: thumbOf(c, c.width, c.height, 180), defDur: 4 });
};
async function seekTo(v, t) {
  if (v.readyState >= 2 && Math.abs(v.currentTime - t) < 0.001) return;
  var p = onceEv(v, 'seeked', 8000); v.currentTime = t; await p;
}
E.importVideo = async function (file) {
  var url = URL.createObjectURL(file), v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  await onceEv(v, 'loadedmetadata', 20000);
  var w = v.videoWidth, h = v.videoHeight, dur = v.duration;
  if (!w || !h) throw new Error('no video track');
  if (!isFinite(dur)) { v.currentTime = 1e6; await onceEv(v, 'durationchange', 4000).catch(function () {}); dur = v.duration; if (!isFinite(dur)) dur = 10; }
  var m = addMedia({ kind: 'video', name: baseName(file.name), url: url, w: w, h: h, dur: dur, file: file, thumb: '' });
  try {
    await seekTo(v, Math.min(0.1, dur / 3)); await new Promise(function (r) { setTimeout(r, 30); });
    m.thumb = thumbOf(v, w, h, 180); E.emit('media');
  } catch (e) { /* thumbnail is optional */ }
  stripFor(m, v).catch(function () {});
  audioFromFile(m, file).catch(function () {});
  return m;
};
async function stripFor(m, v) {
  var n = clamp(Math.ceil(m.dur / 2), 3, 24), th = 54, tw = Math.max(24, Math.round(th * m.w / m.h)), c = mkCanvas(tw * n, th), x = c.getContext('2d');
  for (var i = 0; i < n; i++) { await seekTo(v, Math.min(m.dur - 0.05, (i + 0.5) / n * m.dur)); x.drawImage(v, i * tw, 0, tw, th); }
  m.strip = { canvas: c, n: n, tw: tw, th: th }; E.emit('media-thumb');
}
async function audioFromFile(m, file) {
  if (file.size > 300 * 1024 * 1024) return;
  var buf = await decode(await file.arrayBuffer());
  m.buffer = buf; m.peaks = peaksOf(buf); m.hasAudio = true; E.emit('media-thumb'); E.emit('audio');
}
E.importAudio = async function (file) {
  var buf = await decode(await file.arrayBuffer());
  return addMedia({ kind: 'audio', name: baseName(file.name), buffer: buf, dur: buf.duration, peaks: peaksOf(buf), hasAudio: true });
};
E.importFile = async function (file) {
  var k = E.kindOfFile(file);
  if (k === 'image') return E.importImage(file);
  if (k === 'video') return E.importVideo(file);
  if (k === 'audio') return E.importAudio(file);
  throw new Error('Unsupported file');
};
E.importFiles = async function (files, opt) {
  opt = opt || {};
  var list = Array.prototype.slice.call(files || []), ok = [], bad = 0;
  for (var i = 0; i < list.length; i++) {
    try { ok.push(await E.importFile(list[i])); } catch (e) { bad++; }
  }
  if (opt.add) ok.forEach(function (m) { E.addMedia(m.id); });
  if (ok.length || bad) E.emit('toast', (ok.length ? 'Imported ' + ok.length + ' file' + (ok.length > 1 ? 's' : '') : '') + (bad ? (ok.length ? '. ' : '') + bad + ' could not be read in this browser.' : ''));
  return ok;
};
E.addCanvasMedia = function (name, canvas, extra) {
  return addMedia(Object.assign({ kind: 'image', name: name, canvas: canvas, w: canvas.width, h: canvas.height, thumb: thumbOf(canvas, canvas.width, canvas.height, 180), defDur: 4 }, extra || {}));
};

/* ---------- samples ---------- */
E.SAMPLE_IMAGES = [
  { key: 'sunflower', name: 'Sunflower photo' }, { key: 'mug', name: 'Coffee mug photo' }, { key: 'cactus', name: 'Cactus photo' },
  { key: 'bg-kraft', name: 'Kraft paper', bg: 'paper' }, { key: 'bg-mat', name: 'Cutting mat', bg: 'mat' }, { key: 'bg-sunset', name: 'Sunset gradient', bg: 'gradient' }, { key: 'bg-notebook', name: 'Notebook page', bg: 'notebook' }
];
var sampleThumbs = {};
function makeSample(s) {
  if (!s.bg) return K.SAMPLES[s.key]();
  var c = mkCanvas(1280, 720), x = c.getContext('2d');
  if (s.bg === 'notebook') {
    x.fillStyle = '#fbf6e6'; x.fillRect(0, 0, 1280, 720); x.strokeStyle = 'rgba(80,120,200,.35)'; x.lineWidth = 2;
    for (var y = 90; y < 720; y += 48) { x.beginPath(); x.moveTo(0, y); x.lineTo(1280, y); x.stroke(); }
    x.strokeStyle = 'rgba(220,70,70,.45)'; x.beginPath(); x.moveTo(150, 0); x.lineTo(150, 720); x.stroke();
  } else K.M.drawBG(x, 1280, 720, 0, s.bg);
  return c;
}
E.sampleThumb = function (s) { return sampleThumbs[s.key] || (sampleThumbs[s.key] = (function () { var c = makeSample(s); return thumbOf(c, c.width, c.height, 180); })()); };
E.ensureSampleImage = function (key) {
  var id = 'sample:' + key; if (E.media[id]) return E.media[id];
  var s = E.SAMPLE_IMAGES.find(function (q) { return q.key === key; }); if (!s) return null;
  var c = makeSample(s);
  return addMedia({ id: id, kind: 'image', name: s.name.replace(' photo', ''), canvas: c, w: c.width, h: c.height, thumb: E.sampleThumb(s), defDur: 4, fill: !!s.bg, sample: true });
};

E.SAMPLE_AUDIO = [
  { key: 'lofi', name: 'Lo-fi paper', dur: 16, cat: 'Music' }, { key: 'bounce', name: 'Stop-motion bounce', dur: 12, cat: 'Music' }, { key: 'pad', name: 'Soft pad', dur: 16, cat: 'Music' },
  { key: 'snip', name: 'Scissor snip', dur: 0.4, cat: 'Sound effects' }, { key: 'rustle', name: 'Paper rustle', dur: 0.9, cat: 'Sound effects' }, { key: 'tear', name: 'Paper tear', dur: 0.9, cat: 'Sound effects' },
  { key: 'tick', name: 'Stop-motion tick', dur: 0.15, cat: 'Sound effects' }, { key: 'pop', name: 'Pop', dur: 0.3, cat: 'Sound effects' }, { key: 'whoosh', name: 'Whoosh', dur: 0.8, cat: 'Sound effects' }
];
function note(oc, dest, f, t0, d, type, gain, atk, rel) {
  var o = oc.createOscillator(), g = oc.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + atk); g.gain.setTargetAtTime(0, t0 + d, rel);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + d + rel * 7);
}
function noiseBuf(oc, secs, seed) {
  var b = oc.createBuffer(1, Math.ceil(oc.sampleRate * secs), oc.sampleRate), d = b.getChannelData(0), r = K.rng(seed || 5);
  for (var i = 0; i < d.length; i++) d[i] = r() * 2 - 1; return b;
}
function hit(oc, dest, nb, t0, d, type, f, q, gain) {
  var s = oc.createBufferSource(); s.buffer = nb; var fl = oc.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  var g = oc.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t0 + d);
  s.connect(fl); fl.connect(g); g.connect(dest); s.start(t0, Math.random() * 0.2, d + 0.02);
}
function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }
async function synth(key, dur) {
  var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = dur > 3 ? 32000 : 44100, oc = new OC(2, Math.ceil(sr * dur), sr);
  var out = oc.createGain(); out.gain.value = 0.9; var lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = dur > 3 ? 4200 : 12000; out.connect(lp); lp.connect(oc.destination);
  var nb = noiseBuf(oc, 1.2, 11), i, b;
  if (key === 'lofi') {
    var beat = 60 / 90, chords = [[45, 60, 64, 67], [41, 57, 60, 64], [48, 64, 67, 71], [43, 59, 62, 64], [45, 60, 64, 67], [41, 57, 60, 64]];
    chords.forEach(function (ch, bar) {
      var t0 = bar * 4 * beat;
      note(oc, out, mtof(ch[0]), t0, beat * 3.6, 'sine', 0.34, 0.01, 0.12);
      [0, 2].forEach(function (bt) { for (var q = 1; q < 4; q++) note(oc, out, mtof(ch[q]), t0 + bt * beat + q * 0.012, beat * 1.6, 'triangle', 0.075, 0.015, 0.2); });
      for (b = 0; b < 4; b++) {
        var tb = t0 + b * beat;
        if (b % 2 === 0) { var k = oc.createOscillator(), kg = oc.createGain(); k.frequency.setValueAtTime(130, tb); k.frequency.exponentialRampToValueAtTime(42, tb + 0.14); kg.gain.setValueAtTime(0.55, tb); kg.gain.exponentialRampToValueAtTime(0.001, tb + 0.22); k.connect(kg); kg.connect(out); k.start(tb); k.stop(tb + 0.25); }
        else hit(oc, out, nb, tb, 0.14, 'bandpass', 1900, 0.8, 0.2);
        hit(oc, out, nb, tb, 0.04, 'highpass', 7000, 0.7, 0.07); hit(oc, out, nb, tb + beat / 2, 0.035, 'highpass', 7000, 0.7, 0.045);
      }
    });
    for (i = 0; i < 40; i++) hit(oc, out, nb, Math.random() * dur, 0.012, 'highpass', 3000, 0.6, 0.03 + Math.random() * 0.03);
  } else if (key === 'bounce') {
    var bt = 60 / 120, scale = [60, 62, 64, 67, 69, 72, 69, 67], r = K.rng(9);
    for (i = 0; i < 24 * 2; i++) {
      var t1 = i * bt / 2, nn = scale[Math.floor(r() * scale.length)] + (i % 8 === 0 ? -12 : 0);
      note(oc, out, mtof(nn), t1, 0.12, 'triangle', 0.28, 0.004, 0.07); note(oc, out, mtof(nn) * 2, t1, 0.05, 'sine', 0.08, 0.002, 0.04);
    }
    for (i = 0; i < 24; i++) { var tw = i * bt; note(oc, out, i % 4 === 0 ? 420 : 760, tw, 0.03, 'square', 0.1, 0.001, 0.02); if (i % 2) hit(oc, out, nb, tw, 0.05, 'bandpass', 2400, 1.2, 0.12); }
    for (i = 0; i < 6; i++) note(oc, out, mtof([36, 36, 41, 43, 36, 41][i]), i * 4 * bt, 4 * bt * 0.9, 'sine', 0.3, 0.01, 0.1);
  } else if (key === 'pad') {
    [[48, 55, 60, 64], [45, 52, 57, 64], [41, 48, 57, 60], [43, 50, 55, 62]].forEach(function (ch, bar) {
      ch.forEach(function (n2, q) { note(oc, out, mtof(n2) * (q % 2 ? 1.003 : 0.997), bar * 4, 4.4, 'sawtooth', 0.045, 1.4, 0.9); note(oc, out, mtof(n2), bar * 4, 4.4, 'sine', 0.08, 1.2, 0.9); });
    });
  } else if (key === 'snip') { hit(oc, out, nb, 0.02, 0.05, 'highpass', 2600, 0.8, 0.9); hit(oc, out, nb, 0.1, 0.06, 'highpass', 3000, 0.8, 0.8); }
  else if (key === 'rustle') { for (i = 0; i < 16; i++) hit(oc, out, nb, i * 0.045 + Math.random() * 0.02, 0.05 + Math.random() * 0.04, 'bandpass', 2500 + Math.random() * 2500, 0.7, 0.2 + Math.random() * 0.25); }
  else if (key === 'tear') { for (i = 0; i < 28; i++) hit(oc, out, nb, 0.02 + i * 0.026 + Math.random() * 0.012, 0.04, 'highpass', 1500 + i * 70, 0.9, 0.35 * (1 - i / 40)); }
  else if (key === 'tick') { note(oc, out, 1100, 0.005, 0.012, 'square', 0.5, 0.001, 0.008); }
  else if (key === 'pop') { var po = oc.createOscillator(), pg = oc.createGain(); po.frequency.setValueAtTime(700, 0.01); po.frequency.exponentialRampToValueAtTime(140, 0.16); pg.gain.setValueAtTime(0.9, 0.01); pg.gain.exponentialRampToValueAtTime(0.001, 0.2); po.connect(pg); pg.connect(out); po.start(0.01); po.stop(0.25); }
  else if (key === 'whoosh') {
    var ws = oc.createBufferSource(); ws.buffer = nb; var wf = oc.createBiquadFilter(); wf.type = 'bandpass'; wf.Q.value = 1.2; wf.frequency.setValueAtTime(350, 0); wf.frequency.exponentialRampToValueAtTime(3200, 0.65);
    var wg = oc.createGain(); wg.gain.setValueAtTime(0, 0); wg.gain.linearRampToValueAtTime(0.9, 0.35); wg.gain.linearRampToValueAtTime(0, 0.78); ws.connect(wf); wf.connect(wg); wg.connect(out); ws.start(0);
  }
  return oc.startRendering();
}
E.ensureSampleAudio = async function (key) {
  var id = 'sample:' + key; if (E.media[id]) return E.media[id];
  var s = E.SAMPLE_AUDIO.find(function (q) { return q.key === key; }); if (!s) return null;
  var buf = await synth(key, s.dur);
  if (E.media[id]) return E.media[id];
  return addMedia({ id: id, kind: 'audio', name: s.name, buffer: buf, dur: buf.duration, peaks: peaksOf(buf), hasAudio: true, sample: true, cat: s.cat });
};

/* ---------- background removal for any image ---------- */
var SC = K.lru(8);
function flood(d, w, h, seeds, ref, tol, alphaOnly) {
  var seen = new Uint8Array(w * h), stack = [], tol2 = tol * tol;
  function ok(p) { var q = p * 4; if (d[q + 3] < 10) return true; if (alphaOnly) return false; var dr = d[q] - ref[0], dg = d[q + 1] - ref[1], db = d[q + 2] - ref[2]; return dr * dr + dg * dg + db * db <= tol2; }
  function push(p) { if (!seen[p] && ok(p)) { seen[p] = 1; stack.push(p); } }
  seeds.forEach(push);
  while (stack.length) { var i = stack.pop(), x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
  return seen;
}
E.rmKey = function (m, rm) { return m.id + '|' + (rm.on ? 1 : 0) + '|' + rm.tol + '|' + rm.feather + '|' + (rm.wands || []).map(function (q) { return q[0].toFixed(3) + ',' + q[1].toFixed(3); }).join(';'); };
/* Returns the canvas used as the cut-out subject: scaled to a working size, background removed and cropped when asked.
   subject.nb = where the crop sits inside the original image (0..1), used to map clicks back to the photo. */
E.subjectOf = function (m, rm) {
  var key = E.rmKey(m, rm), hit = SC.get(key); if (hit) return hit;
  var src = m.canvas, sw = src.width, sh = src.height, s2 = Math.min(1, SUBJ_RES / Math.max(sw, sh)), W = Math.max(8, Math.round(sw * s2)), Hh = Math.max(8, Math.round(sh * s2));
  var out = mkCanvas(W, Hh), ox = out.getContext('2d'); ox.drawImage(src, 0, 0, W, Hh); out.nb = { x: 0, y: 0, w: 1, h: 1 };
  if (!rm.on) return SC.set(key, out);
  var s1 = Math.min(1, MASK_RES / Math.max(sw, sh)), w = Math.max(8, Math.round(sw * s1)), h = Math.max(8, Math.round(sh * s1));
  var c1 = mkCanvas(w, h), x1 = c1.getContext('2d', { willReadFrequently: true }); x1.drawImage(src, 0, 0, w, h);
  var d = x1.getImageData(0, 0, w, h).data, n = w * h, a = new Float32Array(n), i, x, y;
  for (i = 0; i < n; i++) a[i] = d[i * 4 + 3] / 255;
  var cs = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]], rs = [], gs = [], bs = [], clear = 0, seeds = [];
  cs.forEach(function (c) { var q = (c[1] * w + c[0]) * 4; rs.push(d[q]); gs.push(d[q + 1]); bs.push(d[q + 2]); if (d[q + 3] < 10) clear++; });
  function med(v) { v.sort(function (p, q) { return p - q; }); return (v[1] + v[2]) / 2; }
  for (x = 0; x < w; x++) { seeds.push(x); seeds.push((h - 1) * w + x); }
  for (y = 0; y < h; y++) { seeds.push(y * w); seeds.push(y * w + w - 1); }
  var seen = flood(d, w, h, seeds, [med(rs), med(gs), med(bs)], rm.tol, clear >= 3);
  for (i = 0; i < n; i++) if (seen[i]) a[i] = 0;
  (rm.wands || []).forEach(function (q) {
    var px = clamp(Math.round(q[0] * (w - 1)), 0, w - 1), py = clamp(Math.round(q[1] * (h - 1)), 0, h - 1), qi = (py * w + px) * 4;
    var sn = flood(d, w, h, [py * w + px], [d[qi], d[qi + 1], d[qi + 2]], rm.tol, false);
    for (i = 0; i < n; i++) if (sn[i]) a[i] = 0;
  });
  if (rm.feather > 0) { K.boxBlur(a, w, h, rm.feather); for (i = 0; i < n; i++) a[i] = K.smooth(0.3, 0.7, a[i]); }
  var mk = mkCanvas(w, h), mx = mk.getContext('2d'), mid = mx.createImageData(w, h), minx = w, miny = h, maxx = -1, maxy = -1;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) { i = y * w + x; mid.data[i * 4 + 3] = Math.round(a[i] * 255); if (a[i] > 0.25) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; } }
  mx.putImageData(mid, 0, 0);
  ox.globalCompositeOperation = 'destination-in'; ox.drawImage(mk, 0, 0, W, Hh); ox.globalCompositeOperation = 'source-over';
  if (maxx < 0) return SC.set(key, out);
  var fx = W / w, fy = Hh / h, bx = Math.max(0, Math.floor(minx * fx) - 2), by = Math.max(0, Math.floor(miny * fy) - 2), bw = Math.min(W - bx, Math.ceil((maxx + 1) * fx) - bx + 4), bh = Math.min(Hh - by, Math.ceil((maxy + 1) * fy) - by + 4);
  var cr = mkCanvas(bw, bh); cr.getContext('2d').drawImage(out, bx, by, bw, bh, 0, 0, bw, bh);
  cr.nb = { x: bx / W, y: by / Hh, w: bw / W, h: bh / Hh };
  return SC.set(key, cr);
};

/* ---------- text clips ---------- */
var TC = K.lru(24);
function hashStr(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; }
function wrapLines(x, str, maxW) {
  var out = [];
  str.split('\n').forEach(function (para) {
    if (!para) { out.push(''); return; }
    var words = para.split(' '), line = '';
    words.forEach(function (w) { var test = line ? line + ' ' + w : w; if (line && x.measureText(test).width > maxW) { out.push(line); line = w; } else line = test; });
    out.push(line);
  });
  return out;
}
var RS = 2;
function ransom(t) {
  var px = t.size * RS * 0.62, fonts = K.RANSOM_FONTS, scr = K.SCRAPS, lines = t.str.split('\n'), mx = mkCanvas(8, 8).getContext('2d'), rowsData = [], maxW = 0, i;
  var limit = E.proj.w * RS * 0.9;
  function layout(scale) {
    rowsData = []; maxW = 0;
    lines.forEach(function (ln, li) {
      var tiles = [], x = 0;
      Array.from(ln).forEach(function (ch, ci) {
        if (ch === ' ') { x += px * scale * 0.36; return; }
        var r = K.rng(hashStr(ch) + li * 131 + ci * 17 + 7), fs = px * scale * (0.8 + r() * 0.26), fn = fonts[Math.floor(r() * fonts.length)], sc = scr[Math.floor(r() * scr.length)];
        mx.font = K.font(fn, fs, false); var tw = Math.max(fs * 0.62, mx.measureText(ch).width + fs * 0.34), th = fs * (1.12 + r() * 0.16);
        tiles.push({ ch: ch, fs: fs, fn: fn, sc: sc, w: tw, h: th, x: x + tw / 2, rot: (r() - 0.5) * 0.24, dy: (r() - 0.5) * px * scale * 0.16, sk: [r(), r(), r(), r()] });
        x += tw * 0.93;
      });
      rowsData.push({ tiles: tiles, w: x }); maxW = Math.max(maxW, x);
    });
  }
  layout(1); if (maxW > limit) layout(limit / maxW);
  var lh = px * 1.5 * (t.lh / 1.1), mg = px * 0.4, W = Math.ceil(maxW + mg * 2), Hh = Math.ceil(lines.length * lh + mg * 2), c = mkCanvas(W, Hh), x = c.getContext('2d');
  rowsData.forEach(function (row, li) {
    var ox = (W - row.w) / 2 + (t.align === 'left' ? -(W - row.w) / 2 + mg : t.align === 'right' ? (W - row.w) / 2 - mg : 0), cy = mg + lh * (li + 0.5);
    row.tiles.forEach(function (tl) {
      x.save(); x.translate(ox + tl.x, cy + tl.dy); x.rotate(tl.rot);
      x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = px * 0.05; x.shadowOffsetY = px * 0.03;
      var hw = tl.w / 2, hh = tl.h / 2, j = tl.fs * 0.04;
      x.beginPath(); x.moveTo(-hw + tl.sk[0] * j, -hh + tl.sk[1] * j); x.lineTo(hw - tl.sk[1] * j, -hh + tl.sk[2] * j); x.lineTo(hw - tl.sk[2] * j, hh - tl.sk[3] * j); x.lineTo(-hw + tl.sk[3] * j, hh - tl.sk[0] * j); x.closePath();
      x.fillStyle = tl.sc[0]; x.fill(); x.shadowColor = 'transparent';
      x.fillStyle = tl.sc[1]; x.font = K.font(tl.fn, tl.fs, false); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(tl.ch, 0, tl.fs * 0.04);
      x.restore();
    });
  });
  return c;
}
E.textCanvas = function (c) {
  var t = c.text, key = JSON.stringify(t) + '|' + E.proj.w, hit = TC.get(key); if (hit) return hit;
  var res;
  if (t.ransom) res = ransom(t);
  else {
    var size = t.size * RS, mx = mkCanvas(8, 8).getContext('2d'); mx.font = K.font(t.font, size, t.bold);
    if ('letterSpacing' in mx) mx.letterSpacing = (t.ls * RS) + 'px';
    var maxW = E.proj.w * RS * 0.88 - (t.box ? t.boxPad * RS * 2 : 0), lines = wrapLines(mx, t.str, maxW), lh = size * t.lh, w = 0;
    lines.forEach(function (ln) { w = Math.max(w, mx.measureText(ln).width); });
    var sw = t.strokeW * RS, pad = Math.ceil(size * 0.14 + sw * 1.2 + (t.box ? t.boxPad * RS : 0) + (t.shadow ? size * 0.12 : 0)), W = Math.ceil(w + pad * 2), Hh = Math.ceil(lines.length * lh + pad * 2);
    res = mkCanvas(W, Hh); var x = res.getContext('2d');
    x.font = K.font(t.font, size, t.bold); if ('letterSpacing' in x) x.letterSpacing = (t.ls * RS) + 'px';
    x.textBaseline = 'middle'; x.textAlign = t.align === 'left' ? 'left' : t.align === 'right' ? 'right' : 'center'; x.lineJoin = 'round';
    var tx = t.align === 'left' ? pad : t.align === 'right' ? W - pad : W / 2;
    if (t.box) {
      var bp = t.boxPad * RS, bx = (t.align === 'left' ? pad : t.align === 'right' ? W - pad - w : (W - w) / 2) - bp, by = pad - bp - size * 0.02, bw = w + bp * 2, bh = lines.length * lh + bp * 2 - 0;
      x.fillStyle = t.boxC; x.beginPath(); if (x.roundRect) x.roundRect(bx, by, bw, bh, t.boxR * RS); else x.rect(bx, by, bw, bh); x.fill();
    }
    lines.forEach(function (ln, li) {
      var ty = pad + lh * (li + 0.5);
      if (t.shadow) { x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = size * 0.1; x.shadowOffsetY = size * 0.045; x.fillStyle = t.color; x.fillText(ln, tx, ty); x.restore(); }
      if (sw > 0) { x.strokeStyle = t.strokeC; x.lineWidth = sw * 2; x.strokeText(ln, tx, ty); }
      x.fillStyle = t.color; x.fillText(ln, tx, ty);
    });
  }
  return TC.set(key, res);
};
E.TEXT_FONTS = ['Anton', 'Bebas Neue', 'Bowlby One', 'Oswald', 'Alfa Slab One', 'Abril Fatface', 'DM Serif Display', 'Playfair Display', 'Lora', 'Roboto Slab', 'Old Standard TT', 'Special Elite', 'Courier Prime', 'Pacifico', 'Lobster', 'Permanent Marker', 'Chewy', 'Rye', 'Rubik Mono One', 'UnifrakturCook'];
})();
