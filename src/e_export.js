(function () {
'use strict';
/* Video editor export. Every frame is rendered offline with the same renderer as the preview, encoded with WebCodecs
   (H.264 or VP9 video, AAC or Opus audio) and muxed into an MP4 or WebM file. Browsers without WebCodecs record the
   preview in real time instead. The finished file goes through the page's downloads capability. */
var K = window.__snip, E = K.E, U = E.ui, $ = U.$, clamp = K.clamp, V = K.vend || {};
var modal = $('expModal'), SR = 48000, CANCEL = { cancelled: true };
var HAS_VID = typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function' && !!(V.mp4 && V.webm);
var HAS_AUD = typeof window.AudioEncoder === 'function' && typeof window.AudioData === 'function';
var HAS_REC = typeof window.MediaRecorder === 'function' && !!(window.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream);
var inName = $('expName'), selRes = $('expRes'), selFps = $('edxFps'), selQ = $('expQ'), selFmt = $('expFmt'), chkAudio = $('expAudio');
var info = $('expInfo'), prog = $('expProg'), bar = $('expBar'), msgEl = $('expMsg'), prev = $('expPrev');
var btnGo = $('expGo'), btnCancel = $('expCancel'), btnClose = $('expClose'), btnFrame = $('expFrame');
var plan = null, job = null, result = null, phase = 'idle', seq = 0, prevSeq = 0, opener = null;
var RES = [[480, '480p'], [720, '720p'], [1080, '1080p'], [1440, '2K'], [2160, '4K']];
selFmt.innerHTML = '<option value="mp4">MP4 (most compatible)</option><option value="webm">WebM</option>';

/* ---------- small helpers ---------- */
var chan = new MessageChannel(), waiters = [];
chan.port1.onmessage = function () { var w = waiters.shift(); if (w) w(); };
/* A yield that browsers do not throttle in background tabs, so a long export keeps going and the buttons stay alive. */
function tick() { return new Promise(function (res) { waiters.push(res); chan.port2.postMessage(0); }); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function hex2(n) { return ('0' + n.toString(16)).slice(-2); }
function even(n) { return Math.max(2, Math.round(n / 2) * 2); }
function fmtMB(b) { return b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? Math.max(1, Math.round(b / 1e6)) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; }
function fmtLeft(s) { s = Math.max(1, Math.round(s)); return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s'; }
function cleanName(s) { s = String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); return s || 'snipwork-video'; }
function setSel(el, v, def) { el.value = String(v); if (el.value !== String(v)) el.value = String(def); }

/* ---------- codec choices ---------- */
function avcLevel(w, h, fps) {
  var mbs = Math.ceil(w / 16) * Math.ceil(h / 16), rate = mbs * fps, L = [[0x1f, 108000, 3600], [0x20, 216000, 5120], [0x28, 245760, 8192], [0x2a, 522240, 8704], [0x32, 589824, 22080], [0x33, 983040, 36864], [0x34, 2073600, 36864]];
  for (var i = 0; i < L.length; i++) if (mbs <= L[i][2] && rate <= L[i][1]) return L[i][0];
  return 0x34;
}
function vp9Level(w, h, fps) {
  var ps = w * h, rate = ps * fps, L = [[10, 36864, 829440], [11, 73728, 2036736], [20, 122880, 4608000], [21, 245760, 9216000], [30, 552960, 20736000], [31, 983040, 36864000], [40, 2228224, 83558400], [41, 2228224, 160432128], [50, 8912896, 311951360], [51, 8912896, 588251136], [52, 8912896, 1176502272]];
  for (var i = 0; i < L.length; i++) if (ps <= L[i][1] && rate <= L[i][2]) return L[i][0];
  return 52;
}
/* Target video bitrate (bits/s): about 0.12 bit per pixel per frame at 30 fps for "High". Paper grain is noisy, so it is generous. */
function bitrate(w, h, fps, q, vp9) { return Math.round(clamp(w * h * 30 * Math.pow(fps / 30, 0.75) * 0.12 * q * (vp9 ? 0.8 : 1), 8e5, 80e6)); }
async function probeVideo(fmt, w, h, fps, q, skipAvc) {
  if (!HAS_VID) return null;
  var tries = [], l = hex2(avcLevel(w, h, fps));
  if (fmt === 'mp4' && !skipAvc) ['64', '4d', '42'].forEach(function (p) { tries.push({ kind: 'avc', codec: 'avc1.' + p + '00' + l }); });
  tries.push({ kind: 'vp9', codec: 'vp09.00.' + vp9Level(w, h, fps) + '.08' });
  for (var i = 0; i < tries.length; i++) {
    var t = tries[i], cfg = { codec: t.codec, width: w, height: h, bitrate: bitrate(w, h, fps, q, t.kind === 'vp9'), framerate: fps };
    if (t.kind === 'avc') cfg.avc = { format: 'avc' };
    try { var r = await VideoEncoder.isConfigSupported(cfg); if (r && r.supported) { t.cfg = cfg; return t; } } catch (e) { /* try the next codec */ }
  }
  return null;
}
async function probeAudio(fmt) {
  if (!HAS_AUD) return null;
  var tries = fmt === 'mp4' ? [{ kind: 'aac', codec: 'mp4a.40.2' }, { kind: 'opus', codec: 'opus' }] : [{ kind: 'opus', codec: 'opus' }];
  for (var i = 0; i < tries.length; i++) {
    try { var r = await AudioEncoder.isConfigSupported({ codec: tries[i].codec, sampleRate: SR, numberOfChannels: 2, bitrate: 160000 }); if (r && r.supported) return tries[i]; } catch (e) { /* try the next codec */ }
  }
  return null;
}
function pickMime(fmt) {
  if (!HAS_REC) return { mime: '', ext: 'webm' };
  var mp4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'], web = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  var list = fmt === 'webm' ? web.concat(mp4) : mp4.concat(web);
  for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return { mime: list[i], ext: list[i].indexOf('mp4') >= 0 ? 'mp4' : 'webm' };
  return { mime: '', ext: 'webm' };
}

/* ---------- settings ---------- */
var SKEY = 'snipwork.export';
function loadSet() { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } }
function saveSet() { try { localStorage.setItem(SKEY, JSON.stringify({ res: +selRes.value, fps: selFps.value, q: selQ.value, fmt: selFmt.value, audio: chkAudio.checked })); } catch (e) { /* storage unavailable */ } }
function dims(short) { var P = E.proj, s = short / Math.min(P.w, P.h); return [even(P.w * s), even(P.h * s)]; }
function isSmall() { return !!(window.matchMedia && matchMedia('(max-width: 999px)').matches); }
function buildRes(want) {
  selRes.innerHTML = '';
  RES.forEach(function (r) {
    if (isSmall() && r[0] > 1080) return;
    var d = dims(r[0]), o = document.createElement('option'), l = r[1] + ' \u00b7 ' + d[0] + '\u00d7' + d[1];
    o.value = String(r[0]); o.textContent = l; o.setAttribute('data-l', l); selRes.appendChild(o);
  });
  var vals = Array.prototype.map.call(selRes.options, function (o) { return +o.value; }), pick = vals[0];
  vals.forEach(function (v) { if (v <= want) pick = v; });
  selRes.value = String(pick);
}

/* ---------- what will happen with the current settings ---------- */
function describe(p, withAudio) {
  var v = p.fmt === 'webm' || !p.v || p.v.kind !== 'avc' ? 'VP9' : 'H.264';
  var a = !withAudio ? '' : (p.fmt === 'webm' || (p.a && p.a.kind === 'opus')) ? ' + Opus audio' : ' + AAC audio';
  return v + ' video' + a;
}
function updateInfo(p) {
  var L = [];
  if (!p.mode) { info.textContent = 'This browser cannot export video. Try the latest Chrome, Edge, Firefox or Safari.'; return; }
  var vbr = p.mode === 'fast' ? p.v.cfg.bitrate : bitrate(p.w, p.h, p.fps, p.q, false), est = (vbr + (p.audio ? 160000 : 0)) * p.dur / 8;
  L.push(E.fmtS(p.dur) + ' \u00b7 ' + p.w + '\u00d7' + p.h + ' \u00b7 ' + p.fps + ' fps \u00b7 up to about ' + fmtMB(est));
  if (p.mode === 'fast') {
    L.push(describe(p, p.audio && !!p.a) + (p.fmt === 'mp4' ? ' in an MP4 file.' : ' in a WebM file.'));
    if (p.fmt === 'mp4' && p.v.kind !== 'avc') L.push('This browser cannot encode H.264, so the MP4 uses VP9 video. Choose WebM if a player will not open it.');
    if (p.fmt === 'mp4' && p.audio && p.a && p.a.kind === 'opus') L.push('This browser cannot encode AAC, so the audio is Opus. Most players handle it; a few older ones stay silent.');
  } else L.push('This browser cannot encode ' + (p.recWhy === 'audio' ? 'audio' : 'video') + ' ahead of time, so the video is recorded in real time (' + E.fmtS(p.dur) + ') as ' + p.rec.ext.toUpperCase() + '. Keep this tab open and visible.');
  L = L.concat(p.notes);
  if (est > 400e6) L.push('That is a big file. A smaller size or lower quality exports faster and saves more reliably.');
  info.textContent = L.join('\n');
}
async function refresh() {
  var my = ++seq; plan = null; syncButtons();
  var fmt = selFmt.value, fps = +selFps.value, q = +selQ.value, dur = E.end(), hasAudio = E.aud.hasAudio(), wantAudio = chkAudio.checked && hasAudio;
  var opts = Array.prototype.slice.call(selRes.options);
  var probes = HAS_VID ? await Promise.all(opts.map(function (o) { var dd = dims(+o.value); return probeVideo(fmt, dd[0], dd[1], fps, q); })) : [];
  var aud = HAS_VID && wantAudio ? await probeAudio(fmt) : null;
  if (my !== seq) return;
  opts.forEach(function (o, i) { var bad = HAS_VID && !probes[i]; o.disabled = bad; o.textContent = o.getAttribute('data-l') + (bad ? ' (not supported here)' : ''); });
  var idx = 0; opts.forEach(function (o, i) { if (o.value === selRes.value) idx = i; });
  if (HAS_VID && !probes[idx]) {
    var j = idx; while (j >= 0 && !probes[j]) j--;
    if (j < 0) { j = idx; while (j < opts.length && !probes[j]) j++; }
    if (j >= 0 && j < opts.length) { idx = j; selRes.value = opts[j].value; }
  }
  var d = dims(+selRes.value), v = HAS_VID ? probes[idx] : null;
  var p = { fmt: fmt, fps: fps, q: q, res: +selRes.value, w: d[0], h: d[1], dur: dur, N: Math.max(1, Math.round(dur * fps)), audio: wantAudio, notes: [], mode: null, v: null, a: null, rec: null };
  if (chkAudio.checked && !hasAudio) p.notes.push('There is no sound on the timeline, so the video will be silent.');
  if (HAS_VID && v && (!wantAudio || aud)) { p.mode = 'fast'; p.v = v; p.a = aud; }
  else if (HAS_REC) { p.mode = 'rec'; p.rec = pickMime(fmt); p.recWhy = HAS_VID && v ? 'audio' : 'video'; }
  else if (HAS_VID && v) { p.mode = 'fast'; p.v = v; p.audio = false; p.notes.push('This browser cannot encode audio, so the video will have no sound.'); }
  plan = p; updateInfo(p); syncButtons();
}

/* ---------- dialog state ---------- */
function showProg(on, withBar) { prog.hidden = !on; bar.parentNode.hidden = withBar === false; }
function setBar(f) { bar.style.width = Math.round(clamp(f, 0, 1) * 100) + '%'; }
function setMsg(t, kind) { msgEl.textContent = t; msgEl.className = kind || ''; }
function syncButtons() {
  var busy = phase === 'busy', ok = !!(plan && plan.mode);
  [inName, selRes, selFps, selQ, selFmt, chkAudio, btnFrame].forEach(function (el) { el.disabled = busy; });
  btnFrame.hidden = busy;
  btnGo.disabled = busy || (phase === 'idle' && !ok);
  btnGo.querySelector('.lbl').textContent = busy ? 'Exporting\u2026' : phase === 'done' ? 'Save file' : 'Export';
  btnCancel.textContent = busy ? 'Stop export' : phase === 'done' ? 'Close' : 'Cancel';
  modal.setAttribute('aria-busy', busy ? 'true' : 'false');
}
async function drawPrev() {
  var P = E.proj, dur = E.end(), T = E.t >= dur - 0.03 ? 0 : E.t, w = 320, h = Math.max(2, Math.round(320 * P.h / P.w)), my = ++prevSeq;
  if (prev.width !== w || prev.height !== h) { prev.width = w; prev.height = h; }
  try { await E.prepVideos(); await E.seekVideos(T, 3000); if (my !== prevSeq || modal.hidden) return; E.render(prev.getContext('2d'), w, h, T); }
  catch (e) { /* the preview picture is optional */ }
}
U.openExport = function () {
  if (!K.editorOn || !modal.hidden) return;
  if (!E.hasContent()) { U.toast('Add something to the timeline first, then export.'); return; }
  E.pause(); E.aud.stopPreview(); $('edToast').classList.remove('on');
  opener = document.activeElement; var s = loadSet();
  result = null; phase = 'idle'; showProg(false); setBar(0); setMsg('');
  inName.value = E.proj.name || 'Untitled';
  setSel(selFps, s.fps || 30, 30); setSel(selQ, s.q || 1, 1); setSel(selFmt, s.fmt || 'mp4', 'mp4'); chkAudio.checked = s.audio !== false;
  buildRes(s.res || 1080);
  info.textContent = 'Checking what this browser can encode\u2026';
  modal.hidden = false; syncButtons(); refresh(); drawPrev();
  setTimeout(function () { (btnGo.disabled ? btnCancel : btnGo).focus(); }, 0);
};
function closeModal() {
  modal.hidden = true; prevSeq++; seq++;
  if (opener && opener.focus) { try { opener.focus(); } catch (e) { /* element is gone */ } }
  opener = null;
}
U.stopExport = function () { if (job) job.cancel = true; if (!modal.hidden) closeModal(); };

/* ---------- saving ---------- */
async function saveFile(name, blob) {
  if (!(window.claude && window.claude.use)) { K.plainSave(name, blob); return { ok: true }; }
  var dl = null;
  try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (!dl) return { ok: false, msg: 'Saving files is not available in this view. Open the page in claude.ai to export.' };
  try { await dl.save({ filename: name, data: blob }); return { ok: true }; }
  catch (e) {
    var code = e && e.code, map = {
      declined: 'Save cancelled. Choose Save file to try again.',
      too_large: 'That file is too large to save here. Try 720p, a lower quality or a shorter project.',
      rate_limited: 'Another save prompt is still open. Answer it, then choose Save file again.',
      rejected_extension: 'This view does not allow saving that file type.'
    };
    return { ok: false, msg: map[code] || 'Could not save the file: ' + ((e && e.message) || 'unknown error') };
  }
}
async function doSave() {
  if (!result || phase === 'busy') return;
  var name = cleanName(inName.value) + '.' + result.ext;
  btnGo.disabled = true; setMsg('Waiting to save ' + name + '\u2026');
  var r = await saveFile(name, result.blob);
  btnGo.disabled = false;
  if (r.ok) setMsg('Saved ' + name + ' \u00b7 ' + fmtMB(result.blob.size) + '. You can close this window.', 'ok'); else setMsg(r.msg, 'err');
}

/* ---------- fast path: offline render + WebCodecs ---------- */
async function exportFast(p, jb) {
  var W = p.w, H = p.h, fps = p.fps, N = p.N, dur = E.end(), us = 1e6 / fps, gop = Math.max(1, Math.round(fps * 2));
  var venc = null, aenc = null, mux = null, fail = null, outs = 0, t0 = performance.now(), lastUI = 0, lastTxt = 0;
  U.busy = true; E.pause(); E.aud.stopPreview();
  try {
    setMsg('Getting ready\u2026'); setBar(0);
    await K.loadFonts(); await E.prepVideos(); if (jb.cancel) throw CANCEL;
    var mix = null;
    if (p.audio) { setMsg('Mixing the audio\u2026'); mix = await E.aud.mix(dur, SR); if (jb.cancel) throw CANCEL; }
    var useAudio = !!(mix && p.a), M = p.fmt === 'webm' ? V.webm : V.mp4, target = new M.ArrayBufferTarget(), cfg;
    if (p.fmt === 'webm') cfg = { target: target, video: { codec: 'V_VP9', width: W, height: H, frameRate: fps }, firstTimestampBehavior: 'offset' };
    else cfg = { target: target, video: { codec: p.v.kind === 'avc' ? 'avc' : 'vp9', width: W, height: H, frameRate: fps }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' };
    if (useAudio) cfg.audio = { codec: p.fmt === 'webm' ? 'A_OPUS' : (p.a.kind === 'aac' ? 'aac' : 'opus'), numberOfChannels: 2, sampleRate: SR };
    mux = new M.Muxer(cfg);
    venc = new VideoEncoder({ output: function (c, m) { outs++; try { mux.addVideoChunk(c, m); } catch (e) { fail = fail || e; } }, error: function (e) { fail = fail || e; } });
    venc.configure(p.v.cfg);
    var L = null, R = null, aTotal = 0, aPos = 0;
    if (useAudio) {
      aenc = new AudioEncoder({ output: function (c, m) { try { mux.addAudioChunk(c, m); } catch (e) { fail = fail || e; } }, error: function (e) { fail = fail || e; } });
      aenc.configure({ codec: p.a.codec, sampleRate: SR, numberOfChannels: 2, bitrate: 160000 });
      L = mix.getChannelData(0); R = mix.numberOfChannels > 1 ? mix.getChannelData(1) : L; aTotal = mix.length;
    }
    var feedTo = function (upTo) {
      upTo = Math.min(upTo, aTotal);
      while (aPos < upTo) {
        var n = Math.min(4800, upTo - aPos), buf = new Float32Array(n * 2);
        buf.set(L.subarray(aPos, aPos + n), 0); buf.set(R.subarray(aPos, aPos + n), n);
        var ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(aPos * 1e6 / SR), data: buf });
        aenc.encode(ad); ad.close(); aPos += n;
      }
    };
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var cx = cv.getContext('2d', { alpha: false }) || cv.getContext('2d');
    for (var i = 0; i < N; i++) {
      if (jb.cancel) throw CANCEL;
      if (fail) throw fail;
      var T = i / fps;
      await E.seekVideos(T, 8000);
      E.render(cx, W, H, T);
      var vf = new VideoFrame(cv, { timestamp: Math.round(i * us), duration: Math.round(us) });
      venc.encode(vf, { keyFrame: i % gop === 0 }); vf.close();
      if (useAudio) feedTo(Math.round((T + 0.5) * SR));
      while (venc.encodeQueueSize > 5 && !jb.cancel && !fail) await new Promise(function (res) { var done = false, f = function () { if (done) return; done = true; venc.removeEventListener('dequeue', f); res(); }; venc.addEventListener('dequeue', f); setTimeout(f, 200); });
      var now = performance.now();
      if (now - lastUI > 40) {
        lastUI = now; setBar((i + 1) / N * 0.97);
        if (now - lastTxt > 500) {
          lastTxt = now; var el = (now - t0) / 1000, left = el > 1.5 ? ' \u00b7 about ' + fmtLeft(el / (i + 1) * (N - i - 1)) + ' left' : '';
          setMsg('Rendering frame ' + (i + 1) + ' of ' + N + ' (' + Math.round((i + 1) / N * 100) + '%)' + left + '. Keep this tab open.');
        }
        await tick();
      }
    }
    if (fail) throw fail;
    setMsg('Finishing the file\u2026'); setBar(0.98);
    if (useAudio) feedTo(aTotal);
    await venc.flush(); if (aenc) await aenc.flush();
    if (jb.cancel) throw CANCEL;
    if (fail) throw fail;
    mux.finalize();
    var ext = p.fmt === 'webm' ? 'webm' : 'mp4';
    return { blob: new Blob([target.buffer], { type: ext === 'webm' ? 'video/webm' : 'video/mp4' }), ext: ext, w: W, h: H, desc: describe(p, useAudio) };
  } catch (e) {
    if (e !== CANCEL && !jb.cancel && outs === 0 && p.v && p.v.kind === 'avc') { var re = new Error((e && e.message) || 'The H.264 encoder could not start.'); re.retryVp9 = true; throw re; }
    throw e;
  } finally {
    try { if (venc && venc.state !== 'closed') venc.close(); } catch (e) { /* already closed */ }
    try { if (aenc && aenc.state !== 'closed') aenc.close(); } catch (e) { /* already closed */ }
    U.busy = false; E.dirty();
  }
}

/* ---------- fallback: record the playing preview ---------- */
async function exportRec(p, jb) {
  var W = p.w, H = p.h, fps = Math.min(p.fps, 30), dur = E.end(), t0 = E.t, mt = p.rec || pickMime(p.fmt), rc = document.createElement('canvas'), rec = null, chunks = [], raf = 0;
  rc.width = W; rc.height = H; rc.setAttribute('aria-hidden', 'true');
  rc.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
  document.body.appendChild(rc);
  var x = rc.getContext('2d', { alpha: false }) || rc.getContext('2d');
  U.busy = true; E.pause(); E.aud.stopPreview();
  try {
    await K.loadFonts(); await E.prepVideos(); if (jb.cancel) throw CANCEL;
    var stream = rc.captureStream(fps);
    if (p.audio && E.aud.hasAudio()) { var as = E.aud.recStream(); if (as) as.getAudioTracks().forEach(function (t) { stream.addTrack(t); }); }
    var opt = { videoBitsPerSecond: bitrate(W, H, fps, p.q, false) }; if (mt.mime) opt.mimeType = mt.mime;
    rec = new MediaRecorder(stream, opt);
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var stopped = new Promise(function (r) { rec.onstop = r; });
    E.seek(0); E.syncVideos(0); await E.seekVideos(0, 5000); E.render(x, W, H, 0);
    rec.start(500); E.play();
    setMsg('Recording in real time. Keep this tab open and visible.');
    await new Promise(function (res) {
      (function loop() {
        if (jb.cancel || !E.playing) { res(); return; }
        E.syncVideos(E.t); E.render(x, W, H, E.t); setBar(E.t / dur * 0.98);
        raf = requestAnimationFrame(loop);
      })();
    });
    E.pause(); if (!jb.cancel) { E.render(x, W, H, Math.max(0, dur - 0.001)); await sleep(300); }
    rec.stop(); await stopped;
    if (jb.cancel) throw CANCEL;
    return { blob: new Blob(chunks, { type: (mt.mime || 'video/webm').split(';')[0] }), ext: mt.ext, w: W, h: H, desc: 'recorded in real time' };
  } finally {
    cancelAnimationFrame(raf);
    try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) { /* already stopped */ }
    E.pause(); if (rc.parentNode) rc.parentNode.removeChild(rc);
    E.seek(t0); U.busy = false; E.dirty();
  }
}

/* ---------- the Export button ---------- */
async function startExport() {
  if (phase === 'busy' || !plan || !plan.mode) return;
  var p = plan; saveSet();
  if (p.mode === 'rec' && p.audio) E.aud.ensure(); /* needs the click's user gesture */
  phase = 'busy'; result = null; var jb = job = { cancel: false };
  showProg(true, true); setBar(0); setMsg('Starting\u2026'); syncButtons();
  try {
    var out;
    try { out = p.mode === 'fast' ? await exportFast(p, jb) : await exportRec(p, jb); }
    catch (e) {
      if (!(e && e.retryVp9) || jb.cancel) throw e;
      var v2 = await probeVideo(p.fmt, p.w, p.h, p.fps, p.q, true); if (!v2) throw e;
      var p2 = {}; for (var k in p) p2[k] = p[k]; p2.v = v2; p2.notes = p.notes.concat('The H.264 encoder did not start, so this MP4 uses VP9 video.');
      setMsg('The H.264 encoder did not start. Trying VP9\u2026'); out = await exportFast(p2, jb);
    }
    if (jb.cancel) throw CANCEL;
    result = out; phase = 'done'; syncButtons(); setBar(1);
    setMsg('Ready: ' + out.w + '\u00d7' + out.h + ' \u00b7 ' + out.desc + ' \u00b7 ' + fmtMB(out.blob.size) + '.');
    await doSave();
  } catch (e) {
    if (e === CANCEL || jb.cancel) { phase = 'idle'; setBar(0); if (modal.hidden) { showProg(false); setMsg(''); U.toast('Export stopped.'); } else { showProg(true, false); setMsg('Export stopped. Nothing was saved.'); } syncButtons(); }
    else { phase = 'idle'; showProg(true, false); setMsg('The export did not finish: ' + ((e && e.message) || e) + ' Try a smaller size or the other format.', 'err'); syncButtons(); if (window.console) console.error(e); }
  } finally { if (job === jb) job = null; U.busy = false; E.dirty(); }
}

btnGo.addEventListener('click', function () { if (phase === 'done' && result) doSave(); else startExport(); });
btnCancel.addEventListener('click', function () { if (phase === 'busy') { if (job) { job.cancel = true; setMsg('Stopping\u2026'); } } else closeModal(); });
btnClose.addEventListener('click', function () { if (job) job.cancel = true; closeModal(); });
modal.addEventListener('pointerdown', function (e) { if (e.target === modal && phase !== 'busy') closeModal(); });
[selRes, selFps, selQ, selFmt, chkAudio].forEach(function (el) {
  el.addEventListener('change', function () {
    saveSet();
    if (phase === 'done') { result = null; phase = 'idle'; showProg(false); setMsg(''); }
    refresh();
  });
});
btnFrame.addEventListener('click', async function () {
  if (phase === 'busy') return;
  var d = dims(+selRes.value), T = clamp(E.t, 0, Math.max(0, E.end() - 1 / 60)), c = document.createElement('canvas');
  c.width = d[0]; c.height = d[1]; btnFrame.disabled = true; showProg(true, false); setMsg('Rendering the frame\u2026'); U.busy = true;
  try {
    await K.loadFonts(); await E.prepVideos(); await E.seekVideos(T, 5000);
    E.render(c.getContext('2d'), c.width, c.height, T);
    var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
    if (!blob) throw new Error('This browser could not encode the picture. Try a smaller size.');
    var name = cleanName(inName.value) + '-frame-' + E.fmt(T, true).replace(/:/g, '-') + '.png', r = await saveFile(name, blob);
    setMsg(r.ok ? 'Saved ' + name + '.' : r.msg, r.ok ? 'ok' : 'err');
  } catch (e) { setMsg('Could not save the frame: ' + ((e && e.message) || e), 'err'); }
  finally { U.busy = false; E.dirty(); btnFrame.disabled = phase === 'busy'; }
});
document.addEventListener('keydown', function (e) {
  if (modal.hidden) return;
  if (e.key === 'Escape') { if (phase !== 'busy') { e.preventDefault(); closeModal(); } return; }
  if (e.key !== 'Tab') return;
  var els = Array.prototype.filter.call(modal.querySelectorAll('button, input, select'), function (el) { return !el.disabled && el.offsetParent !== null; });
  if (!els.length) { e.preventDefault(); return; }
  var first = els[0], last = els[els.length - 1], a = document.activeElement, inside = modal.contains(a);
  if (e.shiftKey && (a === first || !inside)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (a === last || !inside)) { e.preventDefault(); first.focus(); }
});
$('edExport').addEventListener('click', U.openExport);
})();
