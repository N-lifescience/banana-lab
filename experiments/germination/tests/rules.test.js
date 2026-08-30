/**
 * 규칙 엔진 테스트.
 *
 * 이 저장소에서 가장 중요한 검사는 **「막지 않는가」** 다 (AGENTS.md §2.1).
 * 하드 게이트는 두 종류만 허용되고, 그 둘은 **빠져나갈 길을 문장에 담아야** 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { reduce, ACTIONS, BLOCKING_REASONS, TRANSIENT_ACTIONS } from '../src/sim/rules.js';
import {
  initialState, CHAMBERS, MAX_SCOOPS, LID, SENSOR,
  sensorState, comparisonKind, mismatches, chamberView, beanLevel, UNDO_LIMITS,
} from '../src/sim/state.js';
import { OBSERVE_LIMIT_MIN, ATMOSPHERIC_CO2_PPM } from '../src/sim/metabolism.js';

/** 액션을 차례로 돌린다. 마지막 결과와 상태를 함께 돌려준다. */
function run(state, script) {
  let s = state;
  let last = null;
  for (const [type, payload] of script) {
    last = reduce(s, { type, payload: payload ?? {} });
    s = last.state;
  }
  return { state: s, last };
}

const fill = (chamber, kind, n) =>
  Array.from({ length: n }, () => [['SCOOP_BEANS', { kind }], ['POUR_BEANS', { chamber }]]).flat();

/** 두 챔버를 제대로 꾸민 상태 — 여기서 하나씩 어긋뜨려 본다. */
function prepared(level = 1, { scoopsL = 2, scoopsR = 2, btb = true, seal = true } = {}) {
  const script = [
    ...fill('L', 'sprout', scoopsL),
    ...fill('R', 'dry', scoopsR),
    ...(btb ? [['POUR_BTB', { chamber: 'L' }], ['POUR_BTB', { chamber: 'R' }]] : []),
    ['INSTALL_SENSOR', { chamber: 'L' }], ['INSTALL_SENSOR', { chamber: 'R' }],
    ...(seal ? [['SEAL', { chamber: 'L' }], ['SEAL', { chamber: 'R' }]] : []),
  ];
  return run(initialState(level, 4242), script).state;
}

/* ================================================================== */
/* 막지 않는가 — 이 저장소에서 가장 중요한 검사                        */
/* ================================================================== */

/**
 * 모든 액션을 여러 상태에서 돌려 보고, `blocked` 가 나오면 사유가 허용된 둘 중
 * 하나인지 확인한다. 누군가 조작을 막는 코드를 넣으면 여기서 잡힌다.
 */
test('blocked 는 허용된 두 사유에만 난다', () => {
  const states = [
    initialState(1, 1), initialState(3, 2), prepared(1),
    run(prepared(1), [['START', { chamber: 'L' }], ['TICK', { minutes: 5 }]]).state,
  ];
  const payloads = [
    {}, { chamber: 'L' }, { chamber: 'R' }, { kind: 'sprout' }, { kind: 'dry' },
    { chamber: 'L', depth: 0.9 }, { minutes: 3 }, { at: 0 }, { stage: '1' },
    { step: '1a', text: '가' }, { kind: 'hands-unwashed' },
  ];
  const allowed = new Set(Object.values(BLOCKING_REASONS));
  for (const type of Object.keys(ACTIONS)) {
    for (const st of states) {
      for (const payload of payloads) {
        const r = reduce(st, { type, payload });
        if (r.outcome !== 'blocked') continue;
        assert.ok(allowed.has(r.reason),
          `${type} 이 허용되지 않은 사유로 막습니다: ${r.reason}`);
      }
    }
  }
});

/**
 * **막을 때는 빠져나갈 길을 문장에 담는다.**
 * 「뚜껑을 여세요」로는 어디를 눌러야 여는지 알 수 없다 — 어디로 가야 하는지까지 말한다.
 */
test('막는 문구에 어디로 가야 하는지가 들어 있다', () => {
  const sealed = prepared(1);
  const cases = [
    ['POUR_BEANS', { chamber: 'L' }],
    ['POUR_BTB', { chamber: 'L' }],
    ['REMOVE_SENSOR', { chamber: 'L' }],
  ];
  for (const [type, payload] of cases) {
    const withScoop = reduce(sealed, { type: 'SCOOP_BEANS', payload: { kind: 'sprout' } }).state;
    const r = reduce(withScoop, { type, payload });
    assert.equal(r.outcome, 'blocked', `${type} 이 닫힌 뚜껑에서도 통과합니다`);
    assert.match(r.message, /확대 뷰|뚜껑 열기/,
      `${type} 의 막는 문구가 어디로 가야 하는지 말해 주지 않습니다: "${r.message}"`);
  }
});

test('밀봉하지 않아도 · 센서가 없어도 · 콩이 없어도 측정은 시작된다', () => {
  // 셋 다 막지 않는다. 결과가 대신 답한다.
  for (const st of [initialState(1, 9), prepared(1, { btb: false, seal: false })]) {
    const r = reduce(st, { type: 'START', payload: { chamber: 'L' } });
    assert.notEqual(r.outcome, 'blocked');
    assert.equal(r.state.chambers.L.running, true);
  }
});

test('센서를 콩에 파묻는 깊이도 막지 않는다 — 신호가 튈 뿐이다', () => {
  const st = prepared(1, { seal: false });
  const r = reduce(st, { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: 1 } });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(sensorState(r.state.chambers.L), SENSOR.BURIED);
});

test('두 챔버에 같은 콩을 넣어도, 양을 다르게 넣어도 막지 않는다', () => {
  const same = run(initialState(1, 3), [...fill('L', 'sprout', 2), ...fill('R', 'sprout', 3)]).state;
  assert.equal(comparisonKind(same), 'same-beans');
  assert.equal(same.chambers.R.scoops, 3, '양을 다르게 넣는 것을 막으면 안 됩니다');
});

test('콩을 섞어 넣어도 막지 않고, 무엇이 일어났는지 말한다', () => {
  const { state, last } = run(initialState(1, 3),
    [...fill('L', 'sprout', 1), ...fill('L', 'dry', 1)]);
  assert.equal(last.outcome, 'happened');
  assert.equal(state.chambers.L.mixed, true);
  assert.equal(comparisonKind(state), 'mixed');
  // 되돌아갈 길을 문장에 담는다.
  assert.match(last.message, /개수대/);
});

/* ================================================================== */
/* 결과가 대신 답하는가                                                */
/* ================================================================== */

test('밀봉한 발아 콩 쪽만 BTB 가 노래지고 온도가 오른다', () => {
  const st = run(prepared(1), [
    ['START', { chamber: 'L' }], ['START', { chamber: 'R' }],
    ['TICK', { minutes: OBSERVE_LIMIT_MIN }],
  ]).state;
  const L = chamberView(st.chambers.L);
  const R = chamberView(st.chambers.R);
  assert.equal(L.btbStage, 'yellow');
  assert.equal(R.btbStage, 'blue');
  assert.ok(L.tempC > R.tempC + 0.5, `온도 차가 ${(L.tempC - R.tempC).toFixed(2)} ℃ 뿐입니다`);
});

test('BTB 를 안 넣으면 색 칸이 아예 없다 — 그래도 그래프는 쌓인다', () => {
  const st = run(prepared(1, { btb: false }), [
    ['START', { chamber: 'L' }], ['TICK', { minutes: 10 }],
  ]).state;
  const L = chamberView(st.chambers.L);
  assert.equal(L.btbStage, null, 'BTB 를 안 넣었는데 색이 있습니다');
  assert.ok(L.samples.length > 0, '센서는 꽂혀 있으므로 그래프는 쌓여야 합니다');
});

/**
 * 센서는 **재는 도구이지 일어나는 일이 아니다.**
 * 이 둘을 갈라 두는 것이 이 실험에서 배울 거리 하나다.
 */
test('센서가 없어도 BTB 색은 변한다 — 그래프만 안 쌓인다', () => {
  const st = run(initialState(1, 11), [
    ...fill('L', 'sprout', 2), ['POUR_BTB', { chamber: 'L' }],
    ['SEAL', { chamber: 'L' }], ['START', { chamber: 'L' }],
    ['TICK', { minutes: OBSERVE_LIMIT_MIN }],
  ]).state;
  const L = chamberView(st.chambers.L);
  assert.equal(L.samples.length, 0, '센서가 없는데 그래프에 값이 쌓였습니다');
  assert.equal(L.btbStage, 'yellow', '센서가 없다고 색까지 안 변하면 틀린 것입니다');
});

test('재는 도중에 뚜껑을 열면 그 뒤부터 곡선이 꺾이고, 이미 쌓인 값은 그대로다', () => {
  const before = run(prepared(1), [['START', { chamber: 'L' }], ['TICK', { minutes: 10 }]]).state;
  const snapshot = [...before.chambers.L.samples];
  const after = run(before, [['OPEN_LID', { chamber: 'L' }], ['TICK', { minutes: 10 }]]).state;
  const s = after.chambers.L.samples;
  assert.deepEqual(s.slice(0, snapshot.length), snapshot, '이미 잰 값이 바뀌었습니다');
  const rose = s[s.length - 1].co2Ppm - s[snapshot.length - 1].co2Ppm;
  const roseBefore = snapshot[snapshot.length - 1].co2Ppm - ATMOSPHERIC_CO2_PPM;
  assert.ok(rose < roseBefore * 0.2, `뚜껑을 열었는데 계속 오릅니다 (${rose.toFixed(0)} ppm)`);
});

test('관찰 시간을 다 채우면 스스로 멈추고, 다시 시작할 수 있다', () => {
  const st = run(prepared(1), [['START', { chamber: 'L' }], ['TICK', { minutes: OBSERVE_LIMIT_MIN + 5 }]]).state;
  assert.equal(st.chambers.L.running, false);
  assert.equal(st.chambers.L.finished, true);
  assert.equal(st.chambers.L.elapsedMin, OBSERVE_LIMIT_MIN, '관찰 시간을 넘겨 재면 안 됩니다');
  const again = reduce(st, { type: 'START', payload: { chamber: 'L' } });
  assert.notEqual(again.outcome, 'blocked', '다시 시작하는 길이 막히면 막다른 길입니다');
});

test('재고 있지 않은 챔버에는 시간이 흐르지 않는다', () => {
  const st = run(prepared(1), [['START', { chamber: 'L' }], ['TICK', { minutes: 10 }]]).state;
  assert.equal(st.chambers.R.elapsedMin, 0);
  assert.equal(st.chambers.R.samples.length, 0);
});

/* ================================================================== */
/* 대조가 성립하는가                                                   */
/* ================================================================== */

test('콩의 상태만 다르면 비교가 성립한다', () => {
  assert.equal(comparisonKind(prepared(1)), 'ok');
  assert.deepEqual(mismatches(prepared(1)), []);
});

test('어긋난 통제변인이 이름으로 나온다', () => {
  assert.deepEqual(mismatches(prepared(1, { scoopsR: 3 })), ['scoops']);
  assert.deepEqual(mismatches(prepared(1, { btb: false, seal: true })), []);   // 둘 다 안 넣으면 어긋난 것이 아니다
  const oneBtb = reduce(prepared(1, { btb: false, seal: false }),
    { type: 'POUR_BTB', payload: { chamber: 'L' } }).state;
  assert.deepEqual(mismatches(oneBtb), ['btb']);
  const oneSeal = reduce(prepared(1, { seal: false }), { type: 'SEAL', payload: { chamber: 'L' } }).state;
  assert.deepEqual(mismatches(oneSeal), ['sealed']);
});

test('한쪽 센서만 콩에 파묻혀도 어긋난 것이다', () => {
  const st = reduce(prepared(1, { seal: false }),
    { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: 1 } }).state;
  assert.deepEqual(mismatches(st), ['sensor']);
});

test('아직 콩을 안 넣었으면 나무라지 않는다', () => {
  // 「전부 어긋났다」고 말하면 아무것도 안 한 학생을 나무라는 꼴이 된다.
  assert.equal(comparisonKind(initialState(1)), 'empty');
  assert.deepEqual(mismatches(initialState(1)), []);
});

/* ================================================================== */
/* 센서 — 콩에 닿는가                                                  */
/* ================================================================== */

test('꽂을 때는 지금 콩 높이에 닿지 않는 자리에 놓인다', () => {
  // 꽂자마자 파묻힌 채로 시작하면 학생은 자기가 무엇을 잘못했는지 모른 채 튀는 그래프부터 본다.
  for (let n = 1; n <= MAX_SCOOPS - 1; n++) {
    const st = run(initialState(1, 5), [...fill('L', 'sprout', n), ['INSTALL_SENSOR', { chamber: 'L' }]]).state;
    assert.equal(sensorState(st.chambers.L), SENSOR.CLEAR, `${n}숟갈에서 꽂자마자 파묻혔습니다`);
  }
});

test('센서를 꽂아 둔 뒤 콩을 더 부으면 닿을 수 있고, 그때 말해 준다', () => {
  // 저장해 둔 판정을 믿으면 이미 파묻혔는데도 「닿지 않음」으로 남는다.
  let s = run(initialState(1, 5), [...fill('L', 'sprout', 1), ['INSTALL_SENSOR', { chamber: 'L' }]]).state;
  assert.equal(sensorState(s.chambers.L), SENSOR.CLEAR);

  // **닿는 그 순간에** 말해야 한다. 이미 파묻힌 뒤에 말하면 늦고, 안 말하면
  // 그래프가 왜 튀는지 알 길이 없다. 그래서 한 숟갈씩 부으며 그 순간을 찾는다.
  let told = null;
  for (let i = 0; i < MAX_SCOOPS - 1 && !told; i++) {
    const r = run(s, fill('L', 'sprout', 1));
    s = r.state;
    if (r.last.tag === 'sensor-buried') told = r.last;
  }
  assert.equal(sensorState(s.chambers.L), SENSOR.BURIED,
    '콩을 가득 부었는데도 센서가 안 닿습니다 — 두 조작이 물려 있지 않습니다');
  assert.ok(told, '센서가 콩에 닿았는데 아무 말도 안 했습니다');
  assert.match(told.message, /위로 끌어 올리/, '어떻게 고치는지 말해 주지 않습니다');
});

test('파묻힌 센서를 빼면 부스러기가 묻고, 휴지로 닦으면 지워진다', () => {
  const buried = reduce(prepared(1, { seal: false }),
    { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: 1 } }).state;
  const out = reduce(buried, { type: 'REMOVE_SENSOR', payload: { chamber: 'L' } });
  assert.equal(out.state.chambers.L.sensorFouled, true);
  assert.match(out.message, /휴지/, '되돌아갈 길이 문장에 없습니다');
  const wiped = reduce(out.state, { type: 'WIPE_SENSOR', payload: { chamber: 'L' } }).state;
  assert.equal(wiped.chambers.L.sensorFouled, false);
});

/* ================================================================== */
/* 되돌아갈 길이 다 열려 있는가                                        */
/* ================================================================== */

test('개수대에서 챔버를 비우면 처음부터 다시 할 수 있다', () => {
  // 이것이 없으면 콩을 섞은 한 번의 실수가 곧 끝이 된다 — 그건 막다른 길이다.
  const mixed = run(initialState(1, 3), [...fill('L', 'sprout', 1), ...fill('L', 'dry', 1)]).state;
  const empty = reduce(mixed, { type: 'EMPTY_CHAMBER', payload: { chamber: 'L' } }).state;
  assert.equal(empty.chambers.L.beans, null);
  assert.equal(empty.chambers.L.mixed, false);
  assert.equal(empty.chambers.L.scoops, 0);
});

test('챔버를 비워도 센서에 묻은 부스러기는 남는다 — 그건 휴지로 닦는다', () => {
  const fouled = { ...initialState(1, 3) };
  fouled.chambers = { ...fouled.chambers, L: { ...fouled.chambers.L, sensorFouled: true } };
  const empty = reduce(fouled, { type: 'EMPTY_CHAMBER', payload: { chamber: 'L' } }).state;
  assert.equal(empty.chambers.L.sensorFouled, true);
});

test('가득 찬 챔버에 더 부어도 막다른 길이 되지 않는다', () => {
  const { state, last } = run(initialState(1, 3), fill('L', 'sprout', MAX_SCOOPS + 2));
  assert.notEqual(last.outcome, 'blocked');
  assert.equal(state.chambers.L.scoops, MAX_SCOOPS);
  assert.equal(beanLevel(state.chambers.L), 1);
});

test('잘못 담은 숟가락은 다른 통에 다시 담으면 된다', () => {
  const { state, last } = run(initialState(1, 3),
    [['SCOOP_BEANS', { kind: 'sprout' }], ['SCOOP_BEANS', { kind: 'dry' }]]);
  assert.equal(state.scoop.holds, 'dry');
  assert.equal(last.tag, 'scoop-swapped');
});

/* ================================================================== */
/* 기록                                                                */
/* ================================================================== */

test('어긋난 상태도 그대로 기록되고, 무엇이 어긋났는지 함께 남는다', () => {
  const st = reduce(prepared(1, { scoopsR: 3 }), { type: 'RECORD' }).state;
  const c = st.session.captures[0];
  assert.equal(c.comparison, 'off-control');
  assert.deepEqual(c.mismatches, ['scoops']);
  assert.ok(c.chambers.L && c.chambers.R, '두 챔버가 다 기록돼야 합니다');
});

test('기록을 지워도 남은 기록의 번호가 밀리지 않는다', () => {
  // 인덱스로 지우면 앞엣것을 지운 순간 뒤엣것의 번호가 밀려, 딸린 답이 남의 것이 된다.
  let st = prepared(1);
  for (let i = 0; i < 3; i++) st = reduce(st, { type: 'RECORD' }).state;
  const ats = st.session.captures.map((c) => c.at);
  assert.deepEqual(ats, [0, 1, 2]);
  const after = reduce(st, { type: 'DELETE_CAPTURE', payload: { at: 0 } }).state;
  assert.deepEqual(after.session.captures.map((c) => c.at), [1, 2]);
});

/* ================================================================== */
/* 되돌리기 · 기록                                                     */
/* ================================================================== */

test('시간이 흐르는 것은 되돌리기 기록에 쌓이지 않는다', () => {
  // 쌓으면 1초마다 도는 TICK 이 20칸짜리 기록을 몇 초 만에 밀어내고,
  // 되돌리기 1회짜리 3단계에서는 그 한 번이 TICK 을 무르는 데 쓰여 사라진다.
  assert.ok(TRANSIENT_ACTIONS.has('TICK'));
  const st = run(prepared(3), [['START', { chamber: 'L' }]]).state;
  const before = st.session.history.length;
  const after = run(st, Array.from({ length: 30 }, () => ['TICK', { minutes: 1 }])).state;
  assert.equal(after.session.history.length, before, 'TICK 이 되돌리기 기록을 밀어냈습니다');
});

test('센서 깊이를 끄는 동안은 한 번으로 합쳐진다', () => {
  const st = prepared(1, { seal: false });
  const before = st.session.history.length;
  const dragged = run(st, Array.from({ length: 20 },
    (_, i) => ['SET_SENSOR_DEPTH', { chamber: 'L', depth: 0.2 + i * 0.01 }])).state;
  assert.equal(dragged.session.history.length, before + 1,
    '슬라이더 눈금 하나씩 무르는 것은 뜻이 없습니다');
});

test('되돌리기 횟수가 난이도마다 다르다', () => {
  assert.equal(UNDO_LIMITS[1], Infinity);
  assert.equal(UNDO_LIMITS[2], 3);
  assert.equal(UNDO_LIMITS[3], 1);
  const seen = new Set([1, 2, 3].map((lv) => String(initialState(lv).session.undosLeft)));
  assert.equal(seen.size, 3, '세 난이도가 실제로 달라야 합니다');
});

test('되돌리기 횟수를 다 써도 막지 않는다 — 아무 일도 없다고 말할 뿐이다', () => {
  const st = run(initialState(3, 3), [['SCOOP_BEANS', { kind: 'sprout' }], ['UNDO', {}], ['UNDO', {}]]).last;
  assert.equal(st.outcome, 'happened');
  assert.equal(st.tag, 'undo-exhausted');
});

/* ================================================================== */
/* 난이도가 막는 것을 늘리지 않는가                                    */
/* ================================================================== */

test('3단계에서 막히는 횟수가 1단계와 같다', () => {
  // 난이도는 **설명만** 줄인다. 막는 것을 늘리면 설명을 줄인 게 아니라 길을 막은 것이다.
  const script = [
    ['SCOOP_BEANS', { kind: 'sprout' }], ['POUR_BEANS', { chamber: 'L' }],
    ['SEAL', { chamber: 'L' }],
    ['POUR_BEANS', { chamber: 'L' }],           // 닫힌 뚜껑 — 여기서 막힌다
    ['POUR_BTB', { chamber: 'L' }],             // 여기서도
    ['START', { chamber: 'L' }], ['TICK', { minutes: 5 }], ['RECORD', {}],
  ];
  const count = (level) => {
    let s = initialState(level, 77);
    let n = 0;
    for (const [type, payload] of script) {
      const r = reduce(s, { type, payload });
      if (r.outcome === 'blocked') n++;
      s = r.state;
    }
    return n;
  };
  assert.ok(count(1) > 0, '이 각본은 실제로 한 번은 막혀야 뜻이 있습니다');
  assert.equal(count(3), count(1), '3단계에서 막히는 횟수가 1단계와 달라졌습니다');
});

/* ================================================================== */
/* 층 경계                                                             */
/* ================================================================== */

test('src/sim/ 은 DOM 도 시계도 난수도 모른다', () => {
  const dir = new URL('../src/sim/', import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const code = readFileSync(new URL(f, dir), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const banned of ['document', 'window', 'Date.now', 'Math.random']) {
      assert.ok(!code.includes(banned),
        `src/sim/${f} 이 ${banned} 를 씁니다 — node --test 로 규칙을 검증할 수 없게 됩니다`);
    }
  }
});

test('reduce 는 부수효과가 없다', () => {
  const st = prepared(1);
  const before = JSON.stringify(st);
  reduce(st, { type: 'START', payload: { chamber: 'L' } });
  reduce(st, { type: 'EMPTY_CHAMBER', payload: { chamber: 'L' } });
  assert.equal(JSON.stringify(st), before, '원래 상태가 바뀌었습니다');
});

test('모르는 액션은 조용히 넘어가지 않고 터진다', () => {
  assert.throws(() => reduce(initialState(1), { type: '없는액션' }), /알 수 없는 액션/);
});

test('챔버는 둘뿐이고 이름에 뜻이 없다', () => {
  // 「발아 콩 챔버」로 이름 지으면 화면이 답을 미리 말한다.
  assert.deepEqual(CHAMBERS, ['L', 'R']);
  const src = readFileSync(new URL('../src/sim/state.js', import.meta.url), 'utf8');
  assert.ok(!/CHAMBERS\s*=\s*\[\s*'sprout'/.test(src));
});

/* ---------------- 끝까지 갔는데 아무 말이 없는 손잡이 ---------------- */

/** 센서를 꽂은 챔버 하나. 깊이 시험의 출발점이다. */
function withSensor(depth) {
  let st = initialState(1);
  const d = (type, payload) => { st = reduce(st, { type, payload }).state; };
  d('SCOOP_BEANS', { kind: 'sprout' });
  d('POUR_BEANS', { chamber: 'L' });
  d('INSTALL_SENSOR', { chamber: 'L' });
  d('SET_SENSOR_DEPTH', { chamber: 'L', depth });
  return st;
}

/**
 * 센서 깊이는 0~1 로 잘린다. 그런데 **끝에 닿은 뒤로는 계속 눌러도 값도 화면도
 * 그대로였다** — 재어 보니 양 끝에서 스무 번을 더 눌러도 한 마디도 없었다.
 * 학생은 손잡이가 고장 났다고 생각한다.
 *
 * **막지 않는다.** 자르는 것은 그대로 두고 **왜 안 움직이는지**만 말한다.
 * 셋을 함께 본다 — 끝에서 말하는가 · **그 말대로 따라가면 실제로 맞는가** ·
 * **맞은 뒤에는 그 말을 안 하는가.** 뒤엣것이 없으면 화면이 계속 옛말을 한다.
 * (micrometer 세션이 미동나사에서 찾았다)
 */
test('센서 깊이 — 끝에서 더 밀면 왜 안 움직이는지 말한다', () => {
  for (const [end, beyond, word] of [[0, -0.05, '얕은'], [1, 1.05, '깊은']]) {
    const st = withSensor(end);
    assert.equal(st.chambers.L.sensorDepth, end, `${word} 쪽 끝까지 안 갔습니다`);
    const r = reduce(st, { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: beyond } });
    assert.equal(r.tag, 'sensor-depth-end', `${word} 쪽 끝에서 아무 말도 안 합니다`);
    assert.ok(r.message.includes(word), `무엇이 끝인지 안 말합니다: "${r.message}"`);
    // **막지는 않는다** — 값이 잘릴 뿐 조작은 그대로 받는다.
    assert.notEqual(r.outcome, 'blocked', '끝에서 조작을 막고 있습니다 (AGENTS.md §2.1)');
  }
});

test('센서 깊이 — 그 말대로 반대로 밀면 실제로 움직인다', () => {
  const st = withSensor(0);
  const r = reduce(st, { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: 0.05 } });
  assert.equal(r.state.chambers.L.sensorDepth, 0.05,
    '말대로 반대로 밀었는데 안 움직입니다 — 그러면 그 말이 거짓말입니다');
});

test('센서 깊이 — 남은 만큼은 움직인 뒤에 말한다 (얼어붙지 않는다)', () => {
  // 0.02 에서 끝까지 밀었는데 말만 하고 상태를 되돌리면 손잡이가 0.02 에 얼어붙어
  // **0 에 영영 못 닿는다.** 말을 붙이면서 손잡이를 얼리면 고침이 아니라 새 결함이다.
  for (const [from, beyond, end] of [[0.02, -0.01, 0], [0.97, 1.02, 1]]) {
    const st = withSensor(from);
    assert.equal(st.chambers.L.sensorDepth, from, '출발 깊이가 다릅니다');
    const r = reduce(st, { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: beyond } });
    assert.equal(r.state.chambers.L.sensorDepth, end,
      `${from} 에서 끝까지 밀었는데 ${r.state.chambers.L.sensorDepth} 에 멈췄습니다 — 얼어붙었습니다`);
    assert.equal(r.tag, 'sensor-depth-end', '움직이기만 하고 왜 멈췄는지 안 말합니다');
  }
});

test('센서 깊이 — 끝에서 벗어나면 그 말을 더 안 한다', () => {
  let st = withSensor(0);
  st = reduce(st, { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: 0.05 } }).state;
  for (const depth of [0.1, 0.5, 0.9]) {
    const r = reduce(st, { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth } });
    st = r.state;
    assert.notEqual(r.tag, 'sensor-depth-end',
      `끝이 아닌데 아직 끝이라고 합니다 (깊이 ${depth})`);
  }
});

/**
 * **막힌 결과에는 `tag` 가 없다.**
 *
 * `blocked()` 는 `reason` 만 낸다 — 태그는 「무슨 일이 있었나」를 가리키는 것이고,
 * 막힘은 「안 됐다」이므로 낼 태그가 없다. 그런데 말풍선 검사가 태그를 실어 보내면
 * **앱이 만들 수 없는 상태**를 재게 되고, 통과해도 아무것도 보증하지 못한다.
 * 층 사이에 못을 박아 둔다. (osmosis 세션이 낸 것)
 */
test('막힌 결과에는 tag 가 없다 — 검사가 없는 상태를 재지 않게', () => {
  let st = initialState(1);
  const d = (type, payload) => { const r = reduce(st, { type, payload }); st = r.state; return r; };
  d('SCOOP_BEANS', { kind: 'sprout' });
  d('POUR_BEANS', { chamber: 'L' });
  d('SEAL', { chamber: 'L' });
  d('SCOOP_BEANS', { kind: 'sprout' });
  const r = d('POUR_BEANS', { chamber: 'L' });
  assert.equal(r.outcome, 'blocked', '밀봉한 챔버에 부었는데 안 막혔습니다');
  assert.equal(r.tag, undefined, `막힌 결과에 tag 가 붙었습니다: ${JSON.stringify(r.tag)}`);
  assert.ok(r.reason, '막힌 이유(reason)가 없습니다');
});
