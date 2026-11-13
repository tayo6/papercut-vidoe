(function () {
'use strict';
var K = window.__snip, $ = K.$, S = K.S, M = K.M, num = K.num, chk = K.chk, clamp = K.clamp, stage = K.stage, sctx = K.sctx;
var last = 0, lastBoil = -1, override = null;

/* ---------- one render entry point for the stage and every export ---------- */
M.render = function (ctx, w, h, t, opts) {
  opts = opts || {};
  var bg = opts.bg || S.bg, te = K.stepT(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, w, h);
  M.drawBG(ctx, w, h, te, bg);
  if (M[S.mode]) M[S.mode](ctx, w, h, te, opts);
  K.finish(ctx, w, h, te, bg);
};

/* ---------- frame shape ---------- */
function setStageSize(w, h) { stage.width = w; stage.height = h; S.W = w; S.H = h; }
function setAspect(a) {
  var d = K.ASPECTS[a]; S.aspect = a; setStageSize(d[0], d[1]); $('box').style.maxWidth = d[2] + 'px';
  Array.prototype.forEach.call(document.querySelectorAll('#aspectChips .chip'), function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-asp') === a); });
}
Array.prototype.forEach.call(document.querySelectorAll('#aspectChips .chip'), function (c) { c.addEventListener('click', function () { setAspect(c.getAttribute('data-asp')); }); });

/* ---------- tabs ---------- */
function setMode(m) {
  S.mode = m; document.body.setAttribute('data-mode', m); S.t = 0; M.lastBeat = M.lastNews = M.lastFold = M.lastMag = -1;
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.setAttribute('aria-selected', t.getAttribute('data-mode') === m); });
  if (m === 'unfold') $('move').value = 'float';
  K.updateGroups();
}
Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.addEventListener('click', function () { setMode(t.getAttribute('data-mode')); K.sfx('snip'); }); });
$('nwHl').addEventListener('change', function () { $('hlColor').value = { marker: '#ffd92e', box: '#d3201a', circle: '#d3201a', under: '#1d1d1d' }[$('nwHl').value]; });

/* ---------- background ---------- */
function setBg(b) {
  S.bg = b;
  Array.prototype.forEach.call(document.querySelectorAll('#bgChips .chip'), function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-bg') === b); });
}
Array.prototype.forEach.call(document.querySelectorAll('#bgChips .chip'), function (c) {
  c.addEventListener('click', function () { var b = c.getAttribute('data-bg'); if (b === 'image' && !S.bgImg) { $('bgFile').click(); return; } setBg(b); });
});
function setBgColor(col) { S.bgColor = col; $('bgColor').value = col; $('bgSw').style.background = col; setBg('color'); }
$('bgColor').addEventListener('input', function () { setBgColor($('bgColor').value); });
K.PAPER_COLORS.forEach(function (col, i) {
  var b = document.createElement('button'); b.type = 'button'; b.className = 'swatch'; b.style.background = col; b.setAttribute('aria-label', 'Background ' + K.PAPER_NAMES[i]); b.title = K.PAPER_NAMES[i];
  b.addEventListener('click', function () { setBgColor(col); }); $('paperSw').appendChild(b);
});
$('bgFile').addEventListener('change', function (e) {
  var f = e.target.files[0]; e.target.value = ''; if (!f) return;
  var url = URL.createObjectURL(f), im = new Image();
  im.onload = function () { S.bgImg = im; setBg('image'); }; im.onerror = function () { K.setStatus('That background image could not be read.'); }; im.src = url;
});

/* ---------- transport ---------- */
function setPlaying(p) { S.playing = p; $('playBtn').textContent = p ? 'Pause' : 'Play'; if (p) K.trackStart(); else K.trackStop(); }
$('playBtn').addEventListener('click', function () { setPlaying(!S.playing); });
$('stepBtn').addEventListener('click', function () { setPlaying(false); S.t += 1 / (parseFloat($('stepFps').value) || Math.max(2, num('boilFps'))); });
$('restartBtn').addEventListener('click', function () { S.t = 0; M.lastBeat = M.lastNews = M.lastFold = M.lastMag = -1; if (S.playing) K.trackStart(); });
document.addEventListener('keydown', function (e) { if (e.code === 'Space' && e.target === document.body && !K.editorOn) { e.preventDefault(); setPlaying(!S.playing); } });

var box = $('box');
['dragenter', 'dragover'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.add('over'); }); });
['dragleave', 'drop'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.remove('over'); }); });
box.addEventListener('drop', function (e) {
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
  if (/^audio\//.test(f.type)) K.loadAudioFile(f);
  else if (/^image\//.test(f.type)) { K.loadPhotoFile(f); if (['cutout', 'unfold', 'match'].indexOf(S.mode) < 0) setMode('cutout'); }
});
$('themeBtn').addEventListener('click', function () {
  var r = document.documentElement, cur = r.getAttribute('data-theme'), dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  r.setAttribute('data-theme', dark ? 'light' : 'dark');
});

K.labPause = function () { setPlaying(false); };

/* ---------- main loop ---------- */
function frame(now) {
  var dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (K.editorOn) { requestAnimationFrame(frame); return; }
  if (S.playing && !S.frozen) S.t += dt * num('speed') / 100;
  try { M.render(sctx, S.W, S.H, S.t, override ? { bg: override } : {}); } catch (err) { console.error(err); }
  if (S.playing && !S.frozen && num('boil') > 0 && ['match', 'news'].indexOf(S.mode) < 0) { var bf = K.boilIndex(K.stepT(S.t)); if (bf !== lastBoil) { lastBoil = bf; K.sfx('boil'); } }
  $('readout').textContent = (S.t % 1000).toFixed(2).padStart(5, '0') + 's';
  requestAnimationFrame(frame);
}

/* ---------- exports ---------- */
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
/* Outside claude.ai (for example GitHub Pages) there is no downloads capability, so use a normal browser download. */
K.plainSave = function (filename, data) {
  var blob = data instanceof Blob ? data : new Blob([data]), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none'; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 4000);
};
async function save(filename, data) {
  if (!(window.claude && window.claude.use)) { K.plainSave(filename, data); K.setStatus('Saved ' + filename + '.'); return true; }
  var dl = null;
  try { dl = await claude.use('downloads'); } catch (e) { dl = null; }
  if (!dl) { K.setStatus('Saving files is not available in this view. Open the page in claude.ai to export.'); return false; }
  try { await dl.save({ filename: filename, data: data }); K.setStatus('Saved ' + filename + '.'); return true; }
  catch (e) {
    var code = e && e.code, msg = { declined: 'Save cancelled.', too_large: 'That file is too large to save here. Try a shorter length or a smaller size.', rate_limited: 'A save prompt is already open. Answer it, then try again.' }[code];
    K.setStatus(msg || 'Could not save: ' + ((e && e.message) || 'unknown error')); return false;
  }
}
K.save = save;
function busy(b) { S.busy = b; ['expPng', 'expGreen', 'expGif', 'expWebm'].forEach(function (id) { $(id).disabled = b; }); $('prog').style.display = b ? 'block' : 'none'; if (!b) $('prog').firstElementChild.style.width = '0'; }
function prog(v) { $('prog').firstElementChild.style.width = Math.round(clamp(v, 0, 1) * 100) + '%'; }
function toBlob(c, type) { return new Promise(function (res) { c.toBlob(res, type); }); }

async function exportPng(bg, name) {
  if (S.busy) return; busy(true); K.setStatus('Rendering…');
  try {
    var s = num('expScale'), w = Math.round(S.W * s), h = Math.round(S.H * s), c = K.mkCanvas(w, h);
    M.render(c.getContext('2d'), w, h, S.t, { bg: bg, silent: true });
    var b = await toBlob(c, 'image/png'); if (!b) { K.setStatus('This browser could not encode the PNG. Try a smaller size.'); return; }
    await save(name, b);
  } catch (e) { K.setStatus('PNG export failed: ' + e.message); } finally { busy(false); }
}
$('expPng').addEventListener('click', function () { exportPng('none', 'snipwork-transparent.png'); });
$('expGreen').addEventListener('click', function () { exportPng('green', 'snipwork-greenscreen.png'); });

$('expGif').addEventListener('click', async function () {
  if (S.busy) return; busy(true); K.setStatus('Rendering GIF frames…');
  try {
    var len = Math.min(5, parseFloat($('expLen').value)), fps = 12, n = Math.round(len * fps), hin = Math.round(num('expIn') / 10 * fps), hout = Math.round(num('expOut') / 10 * fps);
    var gw = Math.min(480, S.W), gh = Math.round(S.H * gw / S.W), c = K.mkCanvas(gw, gh), x = c.getContext('2d', { willReadFrequently: true });
    var transparent = S.bg === 'transparent', bg = transparent ? 'none' : S.bg, lastIdx = -1, lastData = null;
    var blob = await K.encodeGif(n + hin + hout, gw, gh, fps, transparent, async function (i) {
      var idx = clamp(i - hin, 0, n - 1);
      if (idx !== lastIdx) { M.render(x, gw, gh, idx / fps, { bg: bg, silent: true }); lastData = x.getImageData(0, 0, gw, gh); lastIdx = idx; if (idx % 4 === 0) await sleep(0); }
      return lastData;
    }, prog);
    await save('snipwork.gif', blob);
  } catch (e) { K.setStatus('GIF export failed: ' + e.message); } finally { busy(false); }
});

function pickMime() {
  if (!window.MediaRecorder) return { mime: '', ext: 'webm' };
  var c = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported(c[i])) return { mime: c[i], ext: c[i].indexOf('mp4') >= 0 ? 'mp4' : 'webm' };
  return { mime: '', ext: 'webm' };
}
var MIME = pickMime();
$('expWebm').textContent = MIME.ext === 'mp4' ? 'MP4 video' : 'WebM video';
$('expWebm').addEventListener('click', async function () {
  if (S.busy) return;
  if (!stage.captureStream || !window.MediaRecorder) { K.setStatus('This browser cannot record video.'); return; }
  busy(true); var wasPlaying = S.playing, oldW = S.W, oldH = S.H;
  try {
    var len = parseFloat($('expLen').value), hin = num('expIn') / 10, hout = num('expOut') / 10, sc = Math.min(2, num('expScale')), fps = parseInt($('expFps').value, 10), total = (hin + len + hout) * 1000;
    override = S.bg === 'transparent' ? 'green' : null;
    setStageSize(Math.round(oldW * sc), Math.round(oldH * sc));
    S.t = 0; M.lastBeat = M.lastNews = M.lastFold = M.lastMag = -1; S.frozen = hin > 0; setPlaying(true);
    await sleep(120);
    var stream = stage.captureStream(fps), as = (chk('sfxOn') || K.hasTrack()) ? K.recStream() : null;
    if (as) as.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
    var rec = new MediaRecorder(stream, MIME.mime ? { mimeType: MIME.mime, videoBitsPerSecond: 8000000 } : {}), chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var done = new Promise(function (r) { rec.onstop = r; });
    K.setStatus('Recording ' + (total / 1000).toFixed(1) + ' s…'); rec.start(250);
    var start = performance.now();
    await new Promise(function (res) {
      var iv = setInterval(function () {
        var el = performance.now() - start; S.frozen = el < hin * 1000 || el >= (hin + len) * 1000; prog(el / total);
        if (el >= total) { clearInterval(iv); res(); }
      }, 40);
    });
    rec.stop(); await done;
    await save('snipwork.' + MIME.ext, new Blob(chunks, { type: (MIME.mime || 'video/webm').split(';')[0] }));
  } catch (e) { K.setStatus('Video export failed: ' + e.message); }
  finally { override = null; S.frozen = false; setStageSize(oldW, oldH); setPlaying(wasPlaying); busy(false); }
});

/* ---------- logo made of ransom-note letters ---------- */
function drawLogo() {
  var c = $('logo'), x = c.getContext('2d'), word = 'Snipwork', r = K.rng(21), i;
  var cols = [['#e8491a', '#fff7ee'], ['#f2c14e', '#1a1a1a'], ['#fbf7ee', '#1a1a1a'], ['#2b5fc4', '#fbf7ee'], ['#111111', '#fbf7ee'], ['#2f8f5b', '#fbf7ee'], ['#f4a6c0', '#3a0d20'], ['#e9e1cf', '#1a1a1a']];
  var fonts = ['Bowlby One', 'Playfair Display', 'Anton', 'Special Elite', 'Abril Fatface', 'Rubik Mono One', 'Lobster', 'Courier Prime'], px = 6;
  x.clearRect(0, 0, c.width, c.height);
  for (i = 0; i < word.length; i++) {
    var fs = 50 + r() * 10, w = fs * 0.78 + r() * 8, h = fs * 1.15, rot = (r() - 0.5) * 0.22, col = cols[i % cols.length];
    x.save(); x.translate(px + w / 2, 46 + (r() - 0.5) * 8); x.rotate(rot);
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 5; x.shadowOffsetY = 2; x.fillStyle = col[0]; x.beginPath();
    x.moveTo(-w / 2 + r() * 3, -h / 2 + r() * 3); x.lineTo(w / 2 - r() * 3, -h / 2 + r() * 3); x.lineTo(w / 2 - r() * 3, h / 2 - r() * 3); x.lineTo(-w / 2 + r() * 3, h / 2 - r() * 3); x.closePath(); x.fill();
    x.shadowColor = 'transparent'; x.fillStyle = col[1]; x.font = K.font(fonts[i % fonts.length], fs); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(word[i], 0, 3);
    x.restore(); px += w + 3;
  }
}

/* ---------- start ---------- */
K.bindRanges(); setAspect('16:9'); setMode('cutout'); drawLogo(); K.loadSample('sunflower');
$('bgChips').querySelector('[data-bg="mat"]').click();
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPlaying(false); S.t = 1.2; }
K.loadFonts().then(function () { K.invalidate(); drawLogo(); }, function () {});
requestAnimationFrame(function (t) { last = t; frame(t); });
})();
