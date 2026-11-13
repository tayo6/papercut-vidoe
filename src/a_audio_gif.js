(function () {
'use strict';
var K = window.__snip, $ = K.$, num = K.num, chk = K.chk, clamp = K.clamp;

/* ---------- audio: built-in paper sounds plus a user track ---------- */
var AC = null, master = null, recDest = null, noiseBuf = null, trackBuf = null, trackSrc = null, boilCount = 0;
function actx() {
  if (!AC) {
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    AC = new C(); master = AC.createGain(); master.connect(AC.destination);
    recDest = AC.createMediaStreamDestination(); master.connect(recDest);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function burst(a, when, dur, type, freq, q, gain) {
  var src = a.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.5;
  var f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq * (0.85 + Math.random() * 0.3); f.Q.value = q;
  var g = a.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(when, Math.random() * 0.5, dur + 0.02);
}
function tickSound(a, when, gain) {
  var o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = 900 + Math.random() * 500;
  g.gain.setValueAtTime(gain * 0.5, when); g.gain.exponentialRampToValueAtTime(0.0008, when + 0.028);
  o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.04);
}
K.sfx = function (kind) {
  if (!chk('sfxOn')) return;
  var a = actx(); if (!a) return;
  var v = num('vol') / 100 * 0.6, now = a.currentTime, eff = $('sfxKind').value;
  if (kind === 'boil') {
    boilCount++;
    if (eff === 'rustle') burst(a, now, 0.07, 'bandpass', 3500, 0.7, v * 0.6);
    else if (eff === 'tick') tickSound(a, now, v);
    else if (boilCount % 4 === 0) { burst(a, now, 0.03, 'highpass', 2600, 0.8, v); burst(a, now + 0.045, 0.03, 'highpass', 3000, 0.8, v * 0.8); }
  } else {
    if (eff === 'rustle') burst(a, now, 0.14, 'bandpass', 2800, 0.6, v);
    else if (eff === 'tick') tickSound(a, now, v * 1.3);
    else { burst(a, now, 0.035, 'highpass', 2600, 0.8, v); burst(a, now + 0.05, 0.035, 'highpass', 3000, 0.8, v * 0.9); }
  }
};
K.trackStart = function () {
  if (!trackBuf) return; var a = actx(); if (!a) return;
  K.trackStop();
  trackSrc = a.createBufferSource(); trackSrc.buffer = trackBuf; trackSrc.loop = true;
  var g = a.createGain(); g.gain.value = num('vol') / 100 + 0.2; trackSrc.connect(g); g.connect(master); trackSrc.start(0);
};
K.trackStop = function () { if (trackSrc) { try { trackSrc.stop(); } catch (e) { /* already stopped */ } trackSrc.disconnect(); trackSrc = null; } };
K.hasTrack = function () { return !!trackBuf; };
K.recStream = function () { var a = actx(); return a ? recDest.stream : null; };

K.loadAudioFile = function (file) {
  if (!file) return;
  var a = actx(); if (!a) { K.setStatus('This browser cannot play audio here.'); return; }
  var fr = new FileReader();
  fr.onload = function () {
    a.decodeAudioData(fr.result, function (buf) {
      trackBuf = buf; $('audioName').textContent = 'Audio loaded: ' + file.name + ' (' + buf.duration.toFixed(1) + ' s, loops). It is mixed into WebM exports.';
      $('audioClear').hidden = false; if (K.S.playing) K.trackStart();
    }, function () { K.setStatus('That audio file could not be decoded.'); });
  };
  fr.readAsArrayBuffer(file);
};
$('audioFile').addEventListener('change', function (e) { K.loadAudioFile(e.target.files[0]); e.target.value = ''; });
$('audioClear').addEventListener('click', function () {
  K.trackStop(); trackBuf = null; $('audioClear').hidden = true;
  $('audioName').textContent = 'Sound starts after you press a button on this page. Effects and your audio are both recorded into WebM exports.';
});
$('vol').addEventListener('input', function () { if (trackSrc) K.trackStart(); });

/* ---------- GIF encoder (median-cut palette, LZW) ---------- */
function medianCut(hist, nColors) {
  var bins = [], k;
  for (k = 0; k < hist.length; k++) if (hist[k]) bins.push({ r: ((k >> 10) & 31) << 3 | 4, g: ((k >> 5) & 31) << 3 | 4, b: (k & 31) << 3 | 4, c: hist[k] });
  if (!bins.length) bins.push({ r: 0, g: 0, b: 0, c: 1 });
  var boxes = [bins];
  while (boxes.length < nColors) {
    var bi = -1, best = 0, ch = 'r', i;
    for (i = 0; i < boxes.length; i++) {
      var bx = boxes[i]; if (bx.length < 2) continue;
      var mn = { r: 255, g: 255, b: 255 }, mx = { r: 0, g: 0, b: 0 };
      bx.forEach(function (p) { ['r', 'g', 'b'].forEach(function (c) { if (p[c] < mn[c]) mn[c] = p[c]; if (p[c] > mx[c]) mx[c] = p[c]; }); });
      ['r', 'g', 'b'].forEach(function (c) { var s = (mx[c] - mn[c]) * Math.sqrt(bx.length); if (s > best) { best = s; bi = i; ch = c; } });
    }
    if (bi < 0) break;
    var box = boxes[bi]; box.sort(function (a, b) { return a[ch] - b[ch]; });
    var tot = 0; box.forEach(function (p) { tot += p.c; });
    var acc = 0, cut = 1; for (i = 0; i < box.length - 1; i++) { acc += box[i].c; if (acc >= tot / 2) { cut = i + 1; break; } cut = i + 1; }
    boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map(function (bx) {
    var r = 0, g = 0, b = 0, c = 0; bx.forEach(function (p) { r += p.r * p.c; g += p.g * p.c; b += p.b * p.c; c += p.c; });
    return [Math.round(r / c), Math.round(g / c), Math.round(b / c)];
  });
}
function lzw(idx, mcs) {
  var clear = 1 << mcs, eoi = clear + 1, next = eoi + 1, size = mcs + 1, dict = new Map(), out = [], cur = 0, bits = 0;
  function put(code) { cur |= code << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>= 8; bits -= 8; } }
  put(clear);
  var prefix = idx[0], i, k, key, c;
  for (i = 1; i < idx.length; i++) {
    k = idx[i]; key = (prefix << 8) | k; c = dict.get(key);
    if (c !== undefined) { prefix = c; continue; }
    put(prefix);
    if (next === 4096) { put(clear); dict.clear(); next = eoi + 1; size = mcs + 1; }
    else { if (next >= (1 << size)) size++; dict.set(key, next++); }
    prefix = k;
  }
  put(prefix); put(eoi); if (bits > 0) out.push(cur & 255);
  return out;
}
/* frames: async function(i) -> ImageData; returns Blob */
K.encodeGif = async function (count, w, h, fps, transparent, getFrame, onProgress) {
  var hist = new Uint32Array(32768), i, p, d;
  for (i = 0; i < count; i += 3) {
    d = (await getFrame(i)).data;
    for (p = 0; p < d.length; p += 8) if (!transparent || d[p + 3] >= 128) hist[((d[p] >> 3) << 10) | ((d[p + 1] >> 3) << 5) | (d[p + 2] >> 3)]++;
    onProgress(i / count * 0.35);
  }
  var pal = medianCut(hist, transparent ? 255 : 256), off = transparent ? 1 : 0, palette = [];
  if (transparent) palette.push([0, 0, 0]);
  pal.forEach(function (c) { palette.push(c); });
  while (palette.length < 256) palette.push([0, 0, 0]);
  var cache = new Int16Array(32768).fill(-1);
  function nearest(r, g, b) {
    var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3), v = cache[key]; if (v >= 0) return v;
    var best = 1e9, bi = off, j;
    for (j = off; j < off + pal.length; j++) { var q = palette[j], dr = q[0] - r, dg = q[1] - g, db = q[2] - b, dd = dr * dr + dg * dg + db * db; if (dd < best) { best = dd; bi = j; } }
    cache[key] = bi; return bi;
  }
  var bytes = [];
  function w16(v) { bytes.push(v & 255, (v >> 8) & 255); }
  'GIF89a'.split('').forEach(function (ch) { bytes.push(ch.charCodeAt(0)); });
  w16(w); w16(h); bytes.push(0xF7, 0, 0);
  palette.forEach(function (c) { bytes.push(c[0], c[1], c[2]); });
  bytes.push(0x21, 0xFF, 0x0B); 'NETSCAPE2.0'.split('').forEach(function (ch) { bytes.push(ch.charCodeAt(0)); }); bytes.push(3, 1, 0, 0, 0);
  var delay = Math.max(2, Math.round(100 / fps));
  for (i = 0; i < count; i++) {
    d = (await getFrame(i)).data;
    var idx = new Uint8Array(w * h);
    for (p = 0; p < w * h; p++) { var q4 = p * 4; idx[p] = transparent && d[q4 + 3] < 128 ? 0 : nearest(d[q4], d[q4 + 1], d[q4 + 2]); }
    bytes.push(0x21, 0xF9, 4, transparent ? 0x09 : 0x04); w16(delay); bytes.push(0, 0);
    bytes.push(0x2C); w16(0); w16(0); w16(w); w16(h); bytes.push(0, 8);
    var data = lzw(idx, 8);
    for (var o = 0; o < data.length; o += 255) { var n = Math.min(255, data.length - o); bytes.push(n); for (var z = 0; z < n; z++) bytes.push(data[o + z]); }
    bytes.push(0);
    onProgress(0.35 + (i + 1) / count * 0.65);
  }
  bytes.push(0x3B);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
};
})();
