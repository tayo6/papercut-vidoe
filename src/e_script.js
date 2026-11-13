(function () {
'use strict';
/* SnipScript: a deliberately small expression language. It has no JavaScript,
   DOM, network, storage, loops, or dynamic code execution. */
var K = window.__snip, E = K.E, CACHE = new WeakMap();
var ALLOWED = {
  'transform.x': true, 'transform.y': true, 'transform.scale': true,
  'transform.rotation': true, 'transform.opacity': true
};
var PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
var FUNCS = {
  abs: Math.abs, min: Math.min, max: Math.max, sin: Math.sin, cos: Math.cos,
  tan: Math.tan, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sqrt: Math.sqrt, pow: Math.pow, sign: Math.sign,
  clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
};
function fail(line, message) { throw new SyntaxError('Line ' + line + ': ' + message); }
function tokenize(source, line) {
  var out = [], i = 0, m, rest, ch;
  while (i < source.length) {
    ch = source.charAt(i);
    if (/\s/.test(ch)) { i++; continue; }
    rest = source.slice(i);
    m = rest.match(/^(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:e[+-]?\d+)?/i);
    if (m) { out.push({ type: 'number', value: Number(m[0]) }); i += m[0].length; }
    else if ((m = rest.match(/^[a-z_][a-z0-9_]*/i))) { out.push({ type: 'name', value: m[0].toLowerCase() }); i += m[0].length; }
    else if ('+-*/%^(),'.indexOf(ch) >= 0) { out.push({ type: 'op', value: ch }); i++; }
    else fail(line, 'Unexpected character "' + ch + '".');
    if (out.length > 128) fail(line, 'Expression is too long.');
  }
  return out;
}
function parseExpression(source, line) {
  var tokens = tokenize(source, line), at = 0;
  function primary(depth) {
    if (depth > 32) fail(line, 'Expression is nested too deeply.');
    var t = tokens[at++], args, name;
    if (!t) fail(line, 'Expected a value.');
    if (t.type === 'number') return { type: 'number', value: t.value };
    if (t.type === 'op' && (t.value === '+' || t.value === '-')) return { type: 'unary', op: t.value, right: primary(depth + 1) };
    if (t.type === 'op' && t.value === '(') {
      var inner = expression(0, depth + 1);
      if (!tokens[at] || tokens[at++].value !== ')') fail(line, 'Missing closing parenthesis.');
      return inner;
    }
    if (t.type === 'name') {
      name = t.value;
      if (tokens[at] && tokens[at].value === '(') {
        at++; args = [];
        if (!tokens[at] || tokens[at].value !== ')') {
          while (true) {
            args.push(expression(0, depth + 1));
            if (tokens[at] && tokens[at].value === ',') { at++; continue; }
            break;
          }
        }
        if (!tokens[at] || tokens[at++].value !== ')') fail(line, 'Missing closing parenthesis in function call.');
        if (!Object.prototype.hasOwnProperty.call(FUNCS, name)) fail(line, 'Function "' + name + '" is not allowed.');
        if (args.length < 1 || args.length > 8) fail(line, 'Functions need between 1 and 8 arguments.');
        if (name === 'clamp' && args.length !== 3) fail(line, 'clamp() needs 3 arguments.');
        if (name === 'pow' && args.length !== 2) fail(line, 'pow() needs 2 arguments.');
        if (['abs','sin','cos','tan','round','floor','ceil','sqrt','sign'].indexOf(name) >= 0 && args.length !== 1) fail(line, name + '() needs 1 argument.');
        return { type: 'call', name: name, args: args };
      }
      if (['time','duration','progress','pi'].indexOf(name) < 0) fail(line, 'Variable "' + name + '" is not available.');
      return { type: 'variable', name: name };
    }
    fail(line, 'Expected a number, variable or parenthesized expression.');
  }
  function expression(min, depth) {
    var left = primary(depth), t, op, prec, right;
    while ((t = tokens[at]) && t.type === 'op' && Object.prototype.hasOwnProperty.call(PRECEDENCE, t.value)) {
      op = t.value; prec = PRECEDENCE[op]; if (prec < min) break;
      at++; right = expression(prec + (op === '^' ? 0 : 1), depth + 1);
      left = { type: 'binary', op: op, left: left, right: right };
    }
    return left;
  }
  if (!tokens.length) fail(line, 'Expression is empty.');
  var ast = expression(0, 0);
  if (at !== tokens.length) fail(line, 'Unexpected token "' + tokens[at].value + '".');
  return ast;
}
function evaluate(node, vars, depth) {
  if (depth > 40) throw new Error('Expression is nested too deeply.');
  var a, b, args, i;
  if (node.type === 'number') return node.value;
  if (node.type === 'variable') return node.name === 'pi' ? Math.PI : vars[node.name];
  if (node.type === 'unary') { a = evaluate(node.right, vars, depth + 1); return node.op === '-' ? -a : a; }
  if (node.type === 'binary') {
    a = evaluate(node.left, vars, depth + 1); b = evaluate(node.right, vars, depth + 1);
    if (node.op === '+') return a + b;
    if (node.op === '-') return a - b;
    if (node.op === '*') return a * b;
    if (node.op === '/') { if (b === 0) throw new Error('Division by zero.'); return a / b; }
    if (node.op === '%') { if (b === 0) throw new Error('Division by zero.'); return a % b; }
    return Math.pow(a, b);
  }
  if (node.type === 'call') {
    args = [];
    for (i = 0; i < node.args.length; i++) args.push(evaluate(node.args[i], vars, depth + 1));
    return FUNCS[node.name].apply(null, args);
  }
  throw new Error('Unknown expression node.');
}
function parseProgram(clip, source) {
  if (typeof source !== 'string') throw new TypeError('Script must be text.');
  if (source.length > 4096) throw new SyntaxError('Script is limited to 4,096 characters.');
  var available = E.listProperties(clip).map(function (p) { return p.id; });
  var lines = source.split(/\r?\n/), program = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/#.*$/, '').replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    var m = line.match(/^set\s+([a-z][a-z0-9.]*)\s*=\s*(.+)$/i);
    if (!m) fail(i + 1, 'Use: set transform.x = expression');
    var id = m[1].toLowerCase();
    if (!ALLOWED[id] || available.indexOf(id) < 0) fail(i + 1, 'Property "' + id + '" is not scriptable on this clip.');
    program.push({ id: id, expression: parseExpression(m[2], i + 1), line: i + 1 });
    if (program.length > 32) fail(i + 1, 'A script can contain at most 32 set statements.');
  }
  return program;
}
function programFor(clip) {
  var source = clip.scriptCode || '', old = CACHE.get(clip);
  if (old && old.source === source) return old.program;
  var program = parseProgram(clip, source);
  CACHE.set(clip, { source: source, program: program, error: '' });
  return program;
}
E.compileScript = function (clip, source) {
  var program = parseProgram(clip, source);
  return { statements: program.length, properties: program.map(function (s) { return s.id; }) };
};
E.runClipScript = function (clip, time) {
  if (!clip || clip.scriptEnabled !== true || !String(clip.scriptCode || '').trim()) return null;
  try {
    var program = programFor(clip), duration = Math.max(0, Number(clip.dur) || 0);
    var t = Math.max(0, Math.min(duration, Number(time) || 0));
    var vars = { time: t, duration: duration, progress: duration > 0 ? t / duration : 0 };
    var overrides = Object.create(null);
    for (var i = 0; i < program.length; i++) {
      var value = evaluate(program[i].expression, vars, 0);
      if (!isFinite(value)) throw new Error('Line ' + program[i].line + ': expression did not return a finite number.');
      overrides[program[i].id] = value;
    }
    if (!program.length) return null;
    return E.evaluateProperties(clip, t, overrides).transform;
  } catch (err) {
    var cached = CACHE.get(clip);
    if (cached) cached.error = err && err.message ? err.message : String(err);
    return null;
  }
};
E.getClipScriptError = function (clip) {
  var cached = clip && CACHE.get(clip);
  return cached ? cached.error : '';
};
})();