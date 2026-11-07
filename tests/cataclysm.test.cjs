// 실행: node --test --test-isolation=none tests/cataclysm.test.cjs
// 실제 GPU 성능 측정과 별개로 전체 타임라인의 좌표·수명·호스트 연결을 검증한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/effects/cataclysm/cinematic.js'), 'utf8');

function environment(width = 1000, height = 790) {
  let now = 100, nextId = 1;
  const frames = new Map(), events = new Map(), messages = [], errors = [];
  let drawingCalls = 0;
  function context2d() {
    const state = { globalAlpha: 1, texts: [] }, stack = [];
    return new Proxy(state, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'save') return () => stack.push(target.globalAlpha);
        if (key === 'restore') return () => { target.globalAlpha = stack.pop() ?? 1; };
        if (key === 'measureText') return () => ({ width: 20 });
        return (...args) => {
          drawingCalls++;
          for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${String(key)}: ${args}`);
          if (key === 'fillText') target.texts.push(args[0]);
          if (String(key).startsWith('create')) return { addColorStop(offset, color) {
            assert.ok(Number.isFinite(offset));
            assert.doesNotMatch(color, /NaN|undefined|Infinity/);
          } };
        };
      },
      set(target, key, value) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), String(key));
        target[key] = value; return true;
      }
    });
  }
  class Element {
    constructor() {
      this.style = {}; this.dataset = {}; this.listeners = new Map(); this.children = [];
      this.classList = { add() {}, remove() {}, toggle() {} };
      this.isConnected = true;
    }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    removeEventListener(type) { this.listeners.delete(type); }
    setAttribute() {}
    getBoundingClientRect() { return { left: 0, top: 0, width, height }; }
    getContext() { return this.ctx ||= context2d(); }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    remove() { this.isConnected = false; }
    focus() {}
  }
  const nodes = new Map();
  const root = new Element();
  root.querySelector = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  root.querySelectorAll = () => [];
  const document = {
    hidden: false, body: new Element(), activeElement: new Element(),
    getElementById: () => root, createElement: () => new Element(),
    addEventListener(type, fn) { events.set(`document:${type}`, fn); },
    removeEventListener(type) { events.delete(`document:${type}`); }
  };
  const window = {
    parent: { postMessage(message) { messages.push(message); } },
    addEventListener(type, fn) { events.set(`window:${type}`, fn); },
    removeEventListener(type) { events.delete(`window:${type}`); }
  };
  const sandbox = {
    window, document, location: { origin: 'http://localhost' }, devicePixelRatio: 2,
    performance: { now: () => now },
    console: { error: (...args) => errors.push(args), warn() {} },
    requestAnimationFrame(fn) { const id = nextId++; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout, clearTimeout,
  };
  vm.createContext(sandbox);
  return { sandbox, document, window, root, nodes, events, frames, messages, errors,
    get drawingCalls() { return drawingCalls; },
    step(ms = 100) { now += ms; const jobs = [...frames.values()]; frames.clear(); jobs.forEach(fn => fn(now)); }
  };
}

function load(env) {
  const instrumented = source.replace(/\}\)\(\);\s*$/, `window.testAccess={lutSin,lutCos,glow,jumpTo,
    cachedBoards:()=>[boardCache,damagedBoardCache]};})();`);
  vm.runInContext(instrumented, env.sandbox);
  return env.window.CATACLYSM;
}

test('양수·음수 각도 조회 및 잘못된 광원 좌표 방어', () => {
  const env = environment();
  const api = load(env), math = env.window.testAccess;
  for (let i = -10000; i <= 10000; i++) {
    const angle = i * .719;
    assert.ok(Math.abs(math.lutSin(angle) - Math.sin(angle)) < .009);
    assert.ok(Math.abs(math.lutCos(angle) - Math.cos(angle)) < .009);
  }
  const before = env.drawingCalls;
  for (const bad of [NaN, Infinity, -Infinity]) {
    math.glow(bad, 1, 200, '#ffffff'); math.glow(1, bad, 20, '#ffffff'); math.glow(1, 1, bad, '#ffffff');
  }
  assert.equal(env.drawingCalls, before);
  api.destroy(); assert.equal(env.frames.size, 0);
});

for (const [width, height, target, quality] of [
  [1200, 790, 'e4', 'HIGH'], [390, 620, 'a1', 'LDM'], [800, 600, 'h8', 'ULDM']
]) test(`전체 타임라인: ${width}×${height}, ${target}, ${quality}`, () => {
  const env = environment(width, height), api = load(env);
  assert.equal(api.configure({ embedded: true, muted: true, quality, target,
    pieces: [{ c: 0, r: 0, color: 'b', glyph: 'R' }, { c: 4, r: 4, color: 'w', glyph: 'K' }],
    report: { piecesInZone: 1, whiteInZone: 1, blackInZone: 0, destroyedAssetValue: 100 }
  }), true);
  assert.equal(api.launch(), true);
  assert.equal(api.launch(), false);
  for (let i = 0; i < 800; i++) env.step();
  assert.deepEqual(env.errors, []);
  assert.equal(api.getState().status, 'done');
  assert.equal(env.messages.filter(message => message.type === 'CATACLYSM:COMPLETE').length, 1);
  assert.ok(env.drawingCalls > 1000);
  assert.equal(api.setTarget('z9'), false);
  api.destroy(); api.destroy();
  assert.equal(env.frames.size, 0);
  assert.equal(api.launch(), false);
  assert.equal(env.events.has('document:visibilitychange'), false);
});

test('숨긴 탭은 중지하고 복귀 시 시간 점프 없이 재개', () => {
  const env = environment(), api = load(env);
  api.configure({ muted: true }); api.launch(); env.step();
  const before = env.drawingCalls;
  env.document.hidden = true; env.events.get('document:visibilitychange')();
  assert.equal(env.frames.size, 0);
  env.step(30000); assert.equal(env.drawingCalls, before);
  env.document.hidden = false; env.events.get('document:visibilitychange')();
  env.step(); assert.equal(api.getState().status, 'running');
  assert.ok(env.drawingCalls > before); api.destroy();
});

test('실제 배치 캐시에서 3×3 범위만 파괴', () => {
  const env = environment(), api = load(env);
  api.configure({ target: 'a8', pieces: [
    { c: 0, r: 0, color: 'w', glyph: 'A' }, { c: 1, r: 1, color: 'b', glyph: 'B' },
    { c: 2, r: 0, color: 'b', glyph: 'C' }
  ] });
  env.step();
  const [normal, damaged] = env.window.testAccess.cachedBoards();
  assert.deepEqual([...normal.ctx.texts], ['A', 'B', 'C']);
  assert.deepEqual([...damaged.ctx.texts], ['C']);
  api.destroy();
});

test('게임 연결: 호스트 결과 전달, 위조 메시지 무시, 완료·건너뛰기·실패 정리', () => {
  const env = environment();
  const timers = new Map(); let nextTimer = 0;
  env.sandbox.setTimeout = fn => { const id = ++nextTimer; timers.set(id, fn); return id; };
  env.sandbox.clearTimeout = id => timers.delete(id);
  const bridgeSource = fs.readFileSync(path.join(__dirname, '../js/cataclysmBridge.js'), 'utf8');
  vm.runInContext(bridgeSource, env.sandbox);
  const result = {
    target: 'h8', cost: 32000, friendlyDamage: 200, enemyDamage: 500,
    boardPieces: [{ c: 7, r: 0, type: 'special', visualType: 'r', color: 'b' }],
    destroyedPieces: [{ c: 7, r: 0, type: 'special', color: 'b' }]
  };
  const before = JSON.stringify(result);
  let completed = 0, fallback = 0, destroyed = 0, configured;
  const options = { muted: true, onComplete: () => completed++, onFallback: () => fallback++ };
  const play = () => {
    env.window.CataclysmBridge.play(result, options);
    const overlay = env.document.body.children.at(-1), frame = overlay.children[0];
    frame.contentWindow = { CATACLYSM: {
      configure(value) { configured = value; return true; }, launch: () => true,
      destroy: () => destroyed++
    } };
    frame.onload(); return { overlay, frame, skip: overlay.children[1] };
  };
  let current = play();
  assert.equal(configured.cost, 32000);
  assert.equal(configured.muted, true);
  assert.equal(configured.pieces.length, 1);
  assert.equal(configured.pieces[0].glyph, '♜');
  assert.equal(configured.report.destroyedAssetValue, 700);
  const onMessage = env.events.get('window:message');
  const data = { source: 'CATACLYSM_V16', type: 'CATACLYSM:COMPLETE' };
  onMessage({ source: {}, origin: 'http://localhost', data });
  onMessage({ source: current.frame.contentWindow, origin: 'http://other', data });
  assert.equal(completed, 0);
  onMessage({ source: current.frame.contentWindow, origin: 'http://localhost', data });
  assert.equal(completed, 1); assert.equal(destroyed, 1);
  assert.equal(current.overlay.isConnected, false);
  assert.equal(env.events.has('window:message'), false);
  assert.equal(timers.size, 0);
  current = play(); current.skip.listeners.get('click')();
  assert.equal(completed, 2); assert.equal(destroyed, 2);
  current = play(); env.window.CataclysmBridge.cancel();
  assert.equal(completed, 2); assert.equal(destroyed, 3);
  env.window.CataclysmBridge.play(result, options);
  [...timers.values()][0]();
  assert.equal(fallback, 1); assert.equal(timers.size, 0);
  assert.equal(JSON.stringify(result), before);
});

test('호스트 발사: 한 번만 차감하고 파괴 전 배치와 확정 결과를 동일하게 전달', () => {
  const game = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
  const functionSource = game.slice(game.indexOf('function executeOrbitalStrike(targetKey){'),
    game.indexOf('window.handleOrbitalStrikeResult='));
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[4][4] = { type: 'k', color: 'b' };
  board[3][3] = { type: 'r', color: 'w' };
  board[4][3] = { type: 'special', specialId: 'test', color: 'b' };
  board[7][4] = { type: 'k', color: 'w' };
  const player = { money: 100000, ap: 3 }, sent = [], played = [], finished = [];
  const sandbox = {
    state: { board, turn: 'w', turnNo: 1, engineRevision: 0, audio: { sound: false } },
    CFG: { orbitalStrike: { price: 24000, apCost: 3 } },
    orbitalStrikeReady: () => ({ ok: true }), fromName: () => ({ r: 4, c: 4 }),
    getOrbitalStrikeSquares: () => Array.from({ length: 9 }, (_, i) => ({ r: 3 + Math.floor(i / 3), c: 3 + i % 3 })),
    current: () => player, specialChessType: () => 'n', specialDef: () => ({}),
    piecePrice: piece => piece.type === 'r' ? 500 : 200,
    isKingLike: piece => piece.type === 'k', log() {}, render() {},
    langText: (_, fallback) => fallback, sideName: () => 'white', fmt: value => String(value),
    multiplayerRole: () => 'host', serializeGameState: () => ({}),
    finishGame: (...args) => finished.push(args),
    window: {
      OrbitalBeamVfx: { play: (...args) => played.push(args) },
      multiplayer: { sendOrbitalStrikeResult: result => sent.push(result), sendState() {} }
    }
  };
  vm.createContext(sandbox); vm.runInContext(functionSource, sandbox);
  sandbox.executeOrbitalStrike('e4');
  assert.equal(player.money, 76000); assert.equal(player.ap, 0);
  assert.equal(board[4][4], null); assert.equal(board[7][4].type, 'k');
  assert.equal(played[0][0], sent[0]); assert.equal(played[0][1].muted, true);
  assert.equal(sent[0].cost, 24000); assert.equal(sent[0].boardPieces.length, 4);
  assert.equal(sent[0].destroyedPieces.length, 3);
  assert.equal(sent[0].friendlyDamage, 500); assert.equal(sent[0].enemyDamage, 200);
  assert.equal(sent[0].boardPieces.find(piece => piece.type === 'special').visualType, 'n');
  assert.equal(finished[0][0], 'w');
});

test('이전 재생의 취소 핸들이 새 재생을 중단하지 않음', () => {
  const env = environment(); let cancelled = 0;
  env.window.CataclysmBridge = { play: () => () => cancelled++ };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/orbitalBeamVfx.js'), 'utf8'), env.sandbox);
  const firstCancel = env.window.OrbitalBeamVfx.play({ target: 'e4' });
  const secondCancel = env.window.OrbitalBeamVfx.play({ target: 'a1' });
  assert.equal(cancelled, 1);
  firstCancel(); assert.equal(cancelled, 1);
  secondCancel(); assert.equal(cancelled, 2);
  secondCancel(); assert.equal(cancelled, 2);
});
