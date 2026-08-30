/**
 * 규칙 엔진 테스트.
 *
 * 가장 중요한 것은 맨 아래 「하드 게이트는 두 종류뿐이다」다 — 모든 액션을 여러 상태에서
 * 돌려 보고 `blocked` 가 나오면 사유가 허용된 둘 중 하나인지 본다.
 * 누군가 조작을 막는 코드를 넣으면 거기서 잡힌다 (AGENTS.md §2.1).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, beakerConditions, offDesign, controlledKeys,
  UNDO_LIMITS, HISTORY_LIMIT, PH_METHODS, MODES,
} from '../src/sim/state.js';
import {
  reduce, ACTIONS, BLOCKING_REASONS, TRANSIENT_ACTIONS, THERMAL_SHOCK_DELTA_C,
} from '../src/sim/rules.js';
import { OBSERVE_LIMIT_S } from '../src/sim/kinetics.js';

/** 액션을 죽 이어서 돌린다. 마지막 결과와 상태를 함께 돌려준다. */
function run(state, steps) {
  let s = state;
  let last = null;
  for (const [type, payload] of steps) {
    last = reduce(s, { type, payload });
    s = last.state;
  }
  return { state: s, last };
}

/** 조건 한 벌을 갖춘 비커에 원반을 넣기까지. */
const setup = (over = {}) => [
  ['MAKE_EXTRACT', { pct: over.extractPct ?? 100 }],
  ...(over.boil ? [['BOIL_EXTRACT', {}]] : []),
  ['PUNCH_DISC', {}],
  ...(over.skipSoak ? [] : [['SOAK_DISC', {}]]),
  ['POUR_H2O2', { pct: over.h2o2Pct ?? 3 }],
  ...(over.ph !== undefined ? [['SET_PH', { ph: over.ph, method: over.method ?? PH_METHODS.BUFFER }]] : []),
  ...(over.tempC !== undefined ? [['PUT_IN_BATH', { tempC: over.tempC }]] : []),
  ['DROP_DISC', {}],
];

/** 원반이 뜰 때까지(또는 관찰 시간까지) 시간을 흘린다. */
function tickUntilDone(state, step = 1) {
  let s = state;
  for (let t = 0; t < OBSERVE_LIMIT_S && !s.bench.beaker.floated; t += step) {
    s = reduce(s, { type: 'TICK', payload: { seconds: step } }).state;
  }
  return s;
}

/* ================================================================== */
/* 변인 설계                                                           */
/* ================================================================== */

test('조작변인을 고르면 그 조건이 통제변인 목록에서 빠진다', () => {
  assert.ok(!controlledKeys({ independent: 'temp' }).includes('tempC'));
  assert.ok(controlledKeys({ independent: 'temp' }).includes('ph'));
  assert.ok(!controlledKeys({ independent: 'ph' }).includes('ph'));
});

test('조작변인을 도중에 바꿔도 막지 않는다 — 앞 시행이 이어지지 않을 뿐', () => {
  let { state } = run(initialState(), [['SET_INDEPENDENT', { variable: 'temp' }], ...setup({ tempC: 37 })]);
  state = tickUntilDone(state);
  state = reduce(state, { type: 'RECORD_TRIAL' }).state;
  const r = reduce(state, { type: 'SET_INDEPENDENT', payload: { variable: 'ph' } });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.design.independent, 'ph');
  assert.equal(r.state.trials.length, 1, '앞 시행이 지워졌습니다');
});

test('설계를 안 해도 실험은 그대로 된다 — declared 는 잠금이 아니다', () => {
  let { state } = run(initialState(), setup({ tempC: 37 }));
  assert.equal(state.design.declared, false);
  state = tickUntilDone(state);
  const r = reduce(state, { type: 'RECORD_TRIAL' });
  assert.equal(r.outcome, 'ok');
  assert.equal(r.state.trials.length, 1);
});

test('조작변인을 안 골랐으면 어긋난 통제변인도 없다 — 나무라지 않는다', () => {
  const st = initialState();
  assert.deepEqual(offDesign(st.design, { tempC: 99, ph: 1, h2o2Pct: 1, extractPct: 1, buffered: false }), []);
});

test('통제변인이 어긋난 시행도 기록되고, 무엇이 어긋났는지 이름으로 남는다', () => {
  let { state } = run(initialState(), [
    ['SET_INDEPENDENT', { variable: 'temp' }],
    ...setup({ h2o2Pct: 1, tempC: 37 }),      // 설계는 3 % 인데 1 % 로 부었다
  ]);
  state = tickUntilDone(state);
  const r = reduce(state, { type: 'RECORD_TRIAL' });
  assert.equal(r.outcome, 'happened', '어긋난 시행이 막혔습니다');
  assert.equal(r.state.trials.length, 1, '어긋난 시행이 기록되지 않았습니다');
  assert.deepEqual(r.state.trials[0].offDesign, ['h2o2Pct']);
});

/* ================================================================== */
/* 감자즙 · 원반                                                        */
/* ================================================================== */

test('끓인 감자즙으로 만든 원반은 뜨지 않는다', () => {
  let { state } = run(initialState(), setup({ boil: true, tempC: 20 }));
  state = tickUntilDone(state);
  assert.equal(state.bench.beaker.floated, false);
});

test('끓인 감자즙을 되돌리는 길은 새로 만드는 것뿐이다 — 식히기는 없다', () => {
  assert.ok(!('COOL_EXTRACT' in ACTIONS), '식히면 돌아온다고 배우면 이 실험을 거꾸로 배운 것입니다');
  const { state } = run(initialState(), [['MAKE_EXTRACT', {}], ['BOIL_EXTRACT', {}], ['MAKE_EXTRACT', {}]]);
  assert.equal(state.bench.extract.boiled, false);
});

test('감자즙을 안 묻힌 원반을 넣는 것을 막지 않는다', () => {
  const { last } = run(initialState(), setup({ skipSoak: true, tempC: 20 }));
  assert.equal(last.outcome, 'happened');
  assert.equal(last.tag, 'no-enzyme');
  assert.ok(last.state.bench.beaker.disc, '원반이 비커에 안 들어갔습니다');
});

test('감자즙을 안 묻힌 원반도 완충 안 한 pH 11 에서는 뜬다', () => {
  let { state } = run(initialState(),
    setup({ skipSoak: true, ph: 11, method: PH_METHODS.ACID_BASE }));
  state = tickUntilDone(state);
  assert.equal(state.bench.beaker.floated, true,
    '효소가 없는데도 뜨는 것을 못 보면 학생이 물어볼 질문이 생기지 않습니다');
});

test('감자즙이 없으면 원반에 아무것도 묻지 않는다 — 막지는 않는다', () => {
  const r = run(initialState(), [['PUNCH_DISC', {}], ['SOAK_DISC', {}]]).last;
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.bench.disc.soakedPct, 0);
});

/* ================================================================== */
/* 비커                                                                */
/* ================================================================== */

test('빈 비커에 원반을 넣어도 막지 않는다 — 아무 일도 안 일어날 뿐', () => {
  let { last } = run(initialState(), [['PUNCH_DISC', {}], ['DROP_DISC', {}]]);
  assert.equal(last.outcome, 'happened');
  assert.equal(last.tag, 'no-substrate');
  const state = tickUntilDone(last.state);
  assert.equal(state.bench.beaker.floated, false);
});

test('안 부은 비커와 물만 부은 비커는 다르다', () => {
  const empty = initialState().bench.beaker;
  assert.equal(empty.h2o2Pct, null, '안 부은 비커의 농도가 0 이면 화면이 같은 말을 하게 됩니다');
  assert.equal(beakerConditions(empty).h2o2Pct, 0, '계산에는 0 이 가야 합니다');
});

test('산·염기로 pH 를 맞추면 그대로 되지만 무슨 일이 생기는지 말해 준다', () => {
  const r = run(initialState(), [['SET_PH', { ph: 11, method: PH_METHODS.ACID_BASE }]]).last;
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.bench.beaker.ph, 11);
  assert.equal(beakerConditions(r.state.bench.beaker).buffered, false);
});

test('완충 용액으로 맞추면 조용히 된다', () => {
  const r = run(initialState(), [['SET_PH', { ph: 11, method: PH_METHODS.BUFFER }]]).last;
  assert.equal(r.outcome, 'ok');
  assert.equal(beakerConditions(r.state.bench.beaker).buffered, true);
});

test('비커를 비우면 처음으로 돌아간다 — 되돌아갈 길', () => {
  let { state } = run(initialState(), setup({ tempC: 37 }));
  const r = reduce(state, { type: 'EMPTY_BEAKER' });
  assert.equal(r.state.bench.beaker.h2o2Pct, null);
  assert.equal(r.state.bench.beaker.disc, null);
  assert.equal(r.state.bench.beaker.tempC, 37, '수조에서 꺼내지 않았는데 온도가 바뀌었습니다');
});

/* ================================================================== */
/* 열 충격 — 이 실험의 유일한 파손                                      */
/* ================================================================== */

test('온도 차가 크면 비커가 깨진다 — 깨지는 것 자체는 blocked 이 아니다', () => {
  const r = run(initialState(), [
    ['POUR_H2O2', { pct: 3 }], ['PUT_IN_BATH', { tempC: 100 }], ['PUT_IN_BATH', { tempC: 0 }],
  ]).last;
  assert.equal(r.outcome, 'happened', '파손이 일어난 것 자체는 진행된 일입니다');
  assert.equal(r.state.bench.beaker.cracked, true);
});

test('한 단계씩 옮기면 깨지지 않는다', () => {
  const { state } = run(initialState(), [
    ['PUT_IN_BATH', { tempC: 100 }], ['PUT_IN_BATH', { tempC: 60 }],
    ['PUT_IN_BATH', { tempC: 20 }], ['PUT_IN_BATH', { tempC: 0 }],
  ]);
  assert.equal(state.bench.beaker.cracked, false,
    `${THERMAL_SHOCK_DELTA_C} ℃ 미만의 이동으로도 깨지면 실험을 하다가 자꾸 막힙니다`);
});

test('깨진 비커를 쓰려 하면 막히고, 어디로 가야 하는지까지 말한다', () => {
  const { state } = run(initialState(), [
    ['PUT_IN_BATH', { tempC: 100 }], ['PUT_IN_BATH', { tempC: 0 }],
  ]);
  for (const type of ['POUR_H2O2', 'SET_PH', 'PUT_IN_BATH', 'DROP_DISC']) {
    const r = reduce(state, { type, payload: { pct: 3, ph: 7, tempC: 20 } });
    assert.equal(r.outcome, 'blocked', `${type} 이 깨진 비커에서 진행됐습니다`);
    assert.equal(r.reason, BLOCKING_REASONS.BROKEN);
    assert.ok(/선반|비커 통/.test(r.message),
      `${type} 의 막힘 문구가 어디로 가야 하는지 말해 주지 않습니다: ${r.message}`);
  }
});

test('깨진 비커에서 빠져나가는 길이 있다', () => {
  const { state } = run(initialState(), [
    ['PUT_IN_BATH', { tempC: 100 }], ['PUT_IN_BATH', { tempC: 0 }],
  ]);
  const r = reduce(state, { type: 'NEW_BEAKER' });
  assert.equal(r.outcome, 'ok');
  assert.equal(r.state.bench.beaker.cracked, false);
});

test('깨진 비커는 비워도 금이 남는다 — 막지는 않는다', () => {
  const { state } = run(initialState(), [
    ['PUT_IN_BATH', { tempC: 100 }], ['PUT_IN_BATH', { tempC: 0 }],
  ]);
  const r = reduce(state, { type: 'EMPTY_BEAKER' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.bench.beaker.cracked, true);
});

/* ================================================================== */
/* 시행                                                                */
/* ================================================================== */

test('정상 경로: 설계부터 기록까지 경고 하나 없이 끝난다', () => {
  // 제대로 한 학생에게 화면이 아무 잔소리도 하지 않아야 한다.
  let s = initialState(1);
  const steps = [
    ['SET_INDEPENDENT', { variable: 'temp' }],
    ['SET_CONTROL', { key: 'ph', value: 7 }],
    ['DECLARE_DESIGN', {}],
    ...setup({ tempC: 37 }),
  ];
  const noisy = [];
  for (const [type, payload] of steps) {
    const r = reduce(s, { type, payload });
    if (r.outcome !== 'ok') noisy.push(`${type}: ${r.message}`);
    s = r.state;
  }
  s = tickUntilDone(s);
  const rec = reduce(s, { type: 'RECORD_TRIAL' });
  if (rec.outcome !== 'ok') noisy.push(`RECORD_TRIAL: ${rec.message}`);
  assert.deepEqual(noisy, [], '정상 경로에서 화면이 잔소리를 합니다');
});

test('떠오른 시간이 시행에 남고, 조건이 통째로 함께 남는다', () => {
  let { state } = run(initialState(), [['SET_INDEPENDENT', { variable: 'temp' }], ...setup({ tempC: 37 })]);
  state = tickUntilDone(state);
  const { trials } = reduce(state, { type: 'RECORD_TRIAL' }).state;
  assert.equal(trials.length, 1);
  assert.equal(trials[0].floated, true);
  assert.ok(trials[0].seconds > 0);
  assert.deepEqual(Object.keys(trials[0].conditions).sort(),
    ['buffered', 'extractBoiled', 'extractPct', 'h2o2Pct', 'ph', 'tempC']);
});

test('아직 안 떴을 때 기록하려 하면 막지 않고 상황을 말해 준다', () => {
  let { state } = run(initialState(), setup({ tempC: 0 }));
  state = reduce(state, { type: 'TICK', payload: { seconds: 5 } }).state;
  const r = reduce(state, { type: 'RECORD_TRIAL' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'still-running');
  assert.equal(r.state.trials.length, 0);
});

test('관찰 시간을 넘기면 「뜨지 않음」으로 기록된다 — 시간을 지어내지 않는다', () => {
  let { state } = run(initialState(), setup({ tempC: 100 }));
  state = tickUntilDone(state, 10);
  const r = reduce(state, { type: 'RECORD_TRIAL' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'recorded-nofloat');
  assert.equal(r.state.trials[0].floated, false);
  assert.equal(r.state.trials[0].seconds, null, '안 뜬 시행에 시간을 지어냈습니다');
});

test('기록을 지울 때 번호로 지운다 — 뒤엣것이 밀리지 않는다', () => {
  let s = initialState();
  for (const tempC of [20, 37]) {
    ({ state: s } = run(s, [['EMPTY_BEAKER', {}], ...setup({ tempC })]));
    s = tickUntilDone(s);
    s = reduce(s, { type: 'RECORD_TRIAL' }).state;
  }
  assert.deepEqual(s.trials.map((t) => t.at), [0, 1]);
  const r = reduce(s, { type: 'DELETE_TRIAL', payload: { at: 0 } });
  assert.deepEqual(r.state.trials.map((t) => t.at), [1], '번호가 다시 붙었습니다');
});

test('원반이 든 비커에 더 부으면 그 시행은 처음부터 다시 잰다', () => {
  const { state } = run(initialState(), setup({ tempC: 20 }));
  const r = reduce(state, { type: 'POUR_H2O2', payload: { pct: 3 } });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.bench.beaker.elapsedS, 0);
  assert.equal(r.state.bench.beaker.disc, null);
});

/* ================================================================== */
/* 안전 — **앱이 판정하지 않는다**                                       */
/* ================================================================== */

test('안전을 판정하는 액션이 하나도 남아 있지 않다', () => {
  // 손 씻기·마개 닫기·폐액 버리기를 지켜보고 「지켰다/놓쳤다」를 찍던 것을 걷어냈다.
  // 가상 실험에서 그것을 따지면 **화면 속 단추를 눌렀다는 사실**을 평가하게 된다.
  // 게다가 그 판정은 한 번도 돌지 않아 학생이 무엇을 했든 「지켰습니다」가 찍혔다.
  // `reduce` 는 모르는 액션에 **던진다.** 「막혔다」보다 확실한 신호다 —
  // 규칙 표에 그 이름이 아예 없다는 뜻이라, 어딘가에서 조용히 되살아날 자리가 없다.
  for (const type of ['WASH_HANDS', 'CLOSE_CAP', 'DISPOSE_WASTE', 'CHECK_TIDY', 'NOTE_VIOLATION']) {
    assert.throws(() => reduce(initialState(), { type }), /알 수 없는 액션/,
      `${type} 이 아직 살아 있습니다 — 안전은 판정하지 않기로 했습니다`);
  }
});

test('상태에 안전 판정용 칸이 남아 있지 않다', () => {
  const st = initialState();
  assert.equal('violations' in st.session, false, 'session.violations 가 남아 있습니다');
  assert.equal('tidy' in st.session, false, 'session.tidy 가 남아 있습니다');
});

/* ================================================================== */
/* 되돌리기                                                            */
/* ================================================================== */

test('난이도가 올라갈수록 되돌릴 수 있는 횟수가 줄어든다', () => {
  assert.equal(UNDO_LIMITS[1], Infinity);
  assert.ok(UNDO_LIMITS[2] > UNDO_LIMITS[3]);
});

test('되돌리면 직전 상태로 돌아가고, 로그는 되돌리지 않는다', () => {
  const { state } = run(initialState(2), [['MAKE_EXTRACT', {}], ['PUNCH_DISC', {}]]);
  const r = reduce(state, { type: 'UNDO' });
  assert.equal(r.state.bench.disc.punched, false);
  assert.equal(r.state.bench.extract.ready, true);
  assert.ok(r.state.session.log.length > state.session.log.length, '로그가 되돌려졌습니다');
});

test('시간이 흘러도 되돌리기 기록이 밀리지 않는다', () => {
  // 3단계는 되돌리기가 1회다. 그 한 번이 TICK 을 무르는 데 쓰이면 기능이 죽는다.
  let { state } = run(initialState(3), setup({ tempC: 20 }));
  const before = state.session.history.length;
  for (let i = 0; i < 30; i++) state = reduce(state, { type: 'TICK', payload: { seconds: 1 } }).state;
  assert.equal(state.session.history.length, before, '시간 경과가 되돌리기 기록을 밀어냈습니다');
  const r = reduce(state, { type: 'UNDO' });
  assert.notEqual(r.tag, 'undo-empty');
});

test('연속 조작은 되돌리기 기록에서 하나로 합쳐진다', () => {
  let s = initialState(2);
  const before = s.session.history.length;
  for (const value of [1, 2, 3]) {
    s = reduce(s, { type: 'SET_CONTROL', payload: { key: 'h2o2Pct', value } }).state;
  }
  assert.equal(s.session.history.length, before + 1, '슬라이더 눈금마다 기록이 쌓였습니다');
});

test('아무것도 바꾸지 못한 조작은 되돌리기 기록에 쌓이지 않는다', () => {
  const s = initialState(2);
  const r = reduce(s, { type: 'TAKE_FROM_BATH' });   // 수조에 있지도 않다
  assert.equal(r.state.session.history.length, 0);
});

test('되돌리기 기록은 상한까지만 쌓이고, 스냅샷이 스냅샷을 품지 않는다', () => {
  let s = initialState(1);
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
    s = reduce(s, { type: 'PUNCH_DISC' }).state;
    s = reduce(s, { type: 'DISCARD_DISC' }).state;
  }
  assert.ok(s.session.history.length <= HISTORY_LIMIT);
  for (const snap of s.session.history) {
    assert.deepEqual(snap.session.history, [], '스냅샷 안에 또 기록이 들어 있습니다');
  }
});

test('되돌리기를 다 써도, 되돌릴 것이 없어도 막지 않는다', () => {
  const empty = reduce(initialState(3), { type: 'UNDO' });
  assert.equal(empty.outcome, 'happened');
  assert.equal(empty.tag, 'undo-empty');

  let { state } = run(initialState(3), [['PUNCH_DISC', {}], ['DISCARD_DISC', {}]]);
  state = reduce(state, { type: 'UNDO' }).state;      // 1회 다 씀
  const done = reduce(state, { type: 'UNDO' });
  assert.equal(done.outcome, 'happened');
  assert.equal(done.tag, 'undo-exhausted');
});

/* ================================================================== */
/* 엔진의 불변식                                                        */
/* ================================================================== */

test('reduce 는 원본 상태를 바꾸지 않는다', () => {
  const s = initialState();
  const before = JSON.stringify(s);
  run(s, setup({ tempC: 37 }));
  assert.equal(JSON.stringify(s), before, 'reduce 에 부수효과가 있습니다');
});

test('로그에는 시각이 아니라 순번이 붙는다', () => {
  const { state } = run(initialState(), [['PUNCH_DISC', {}], ['DISCARD_DISC', {}]]);
  assert.deepEqual(state.session.log.map((l) => l.at), [0, 1]);
});

test('되돌리기 기록은 시행에 들어가지 않는다', () => {
  let { state } = run(initialState(1), setup({ tempC: 37 }));
  state = tickUntilDone(state);
  const { trials } = reduce(state, { type: 'RECORD_TRIAL' }).state;
  assert.ok(!JSON.stringify(trials).includes('history'));
});

/**
 * **이 파일에서 가장 중요한 검사다.**
 *
 * 모든 액션을 여러 상태에서 돌려 보고, `blocked` 이 나오면 사유가 허용된 둘 중
 * 하나인지 본다. 조작을 막는 코드를 새로 넣으면 여기서 잡힌다.
 */
test('하드 게이트는 두 종류뿐이다', () => {
  const states = [
    initialState(1),
    run(initialState(1), setup({ tempC: 37 })).state,
    run(initialState(1), setup({ skipSoak: true, ph: 11, method: PH_METHODS.ACID_BASE })).state,
    run(initialState(3), [['PUT_IN_BATH', { tempC: 100 }], ['PUT_IN_BATH', { tempC: 0 }]]).state,
    run(initialState(2), [['MAKE_EXTRACT', {}], ['BOIL_EXTRACT', {}], ['PUNCH_DISC', {}], ['SOAK_DISC', {}]]).state,
  ];
  const payload = {
    variable: 'temp', key: 'ph', value: 7, pct: 3, ph: 11, method: PH_METHODS.ACID_BASE,
    tempC: 60, seconds: 1, at: 0, step: 'x', text: 'y', stage: '1',
  };
  const offenders = [];
  for (const type of Object.keys(ACTIONS)) {
    for (const s of states) {
      const r = reduce(s, { type, payload });
      if (r.outcome !== 'blocked') continue;
      if (!Object.values(BLOCKING_REASONS).includes(r.reason)) {
        offenders.push(`${type} — 허용되지 않은 사유 ${r.reason}`);
      }
      // 막을 때는 어디로 가야 하는지까지 말해야 한다 (AGENTS.md §2.1).
      if (!r.message || r.message.length < 10) offenders.push(`${type} — 막힌 이유를 말하지 않습니다`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('시간 경과와 읽음 표시는 학생이 「한」 조작이 아니다', () => {
  for (const type of ['TICK', 'MARK_READ']) {
    assert.ok(TRANSIENT_ACTIONS.has(type), `${type} 이 되돌리기 기록에 쌓입니다`);
  }
});

test('sim 은 DOM 도 시계도 난수도 모른다', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../src/sim/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const banned of ['document', 'window.', 'Date.now', 'Math.random']) {
      assert.ok(!src.includes(banned), `src/sim/${f} 가 ${banned} 을 씁니다`);
    }
  }
});

test('모드는 혼자와 모둠 둘뿐이고, 상태가 그것을 들고 있다', () => {
  assert.equal(initialState(1, 1, MODES.SOLO).session.mode, MODES.SOLO);
  assert.equal(initialState(1, 1, MODES.GROUP).session.mode, MODES.GROUP);
});

/* ================================================================== */
/* 기록이 잰 조건과 어긋나지 않는가                                     */
/* ================================================================== */

/**
 * **기록된 초는 기록된 조건에서 나올 수 있는 값이어야 한다.**
 *
 * 원반이 뜬 **뒤에** 비커를 다른 수조로 옮기면, 잰 시간은 그대로인데 기록되는 조건만
 * 바뀌었다 — 20 ℃ 에서 잰 25 초가 **아무 표시 없이 37 ℃ 시행으로** 남았다.
 * 그래프에서는 깨끗한 점으로 선 위에 얹혔다.
 */
test('뜬 뒤에 비커를 옮겨도 기록은 잰 조건 그대로다', () => {
  let { state } = run(initialState(), [
    ['SET_INDEPENDENT', { variable: 'temp' }], ...setup({ tempC: 20 }),
  ]);
  state = tickUntilDone(state);
  const measured = state.bench.beaker.floatedAtS;
  state = reduce(state, { type: 'PUT_IN_BATH', payload: { tempC: 37 } }).state;
  const { trials } = reduce(state, { type: 'RECORD_TRIAL' }).state;
  assert.equal(trials[0].conditions.tempC, 20, '옮긴 뒤의 온도로 기록됐습니다');
  assert.equal(trials[0].seconds, measured);
});

test('기록된 시간이 기록된 조건에서 실제로 나오는 값이다', async () => {
  // 이 불변식 하나가 위 버그를 통째로 잡는다.
  const { riseTime } = await import('../src/sim/kinetics.js');
  let s = initialState();
  s = reduce(s, { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  for (const tempC of [37, 20, 0]) {
    ({ state: s } = run(s, [['EMPTY_BEAKER', {}], ...setup({ tempC })]));
    s = tickUntilDone(s);
    s = reduce(s, { type: 'RECORD_TRIAL' }).state;
  }
  for (const t of s.trials) {
    const expected = riseTime(t.conditions);
    assert.equal(t.floated, expected.floated, `${t.at}번: 떴는지가 조건과 어긋납니다`);
    if (t.floated) {
      assert.ok(Math.abs(t.seconds - expected.seconds) < 1e-6,
        `${t.at}번: ${t.seconds} 초로 기록됐는데 그 조건에서는 ${expected.seconds} 초입니다`);
    }
  }
});

/**
 * 재는 도중에 조건을 바꾸면 그 시행은 처음부터 다시 잰다.
 *
 * 진행도는 **누적된 시간 전체**에 조건을 곱해 내므로, 0 ℃ 에서 90 초를 지켜본 뒤 37 ℃ 로
 * 옮기면 그 90 초가 소급해 37 ℃ 로 계산됐다 — **화면에 91 초가 떠 있는데
 * 「8.2 초 걸렸습니다」**라고 말했다.
 */
test('재는 도중에 조건을 바꾸면 시행이 처음부터 다시 시작된다', () => {
  for (const [label, action, payload] of [
    ['수조를 옮기면', 'PUT_IN_BATH', { tempC: 37 }],
    ['pH 를 바꾸면', 'SET_PH', { ph: 11, method: PH_METHODS.ACID_BASE }],
    ['수조에서 꺼내면', 'TAKE_FROM_BATH', {}],
    ['더 부으면', 'POUR_H2O2', { pct: 1 }],
  ]) {
    let { state } = run(initialState(), setup({ tempC: 0 }));
    for (let i = 0; i < 30; i++) state = reduce(state, { type: 'TICK', payload: { seconds: 1 } }).state;
    const r = reduce(state, { type: action, payload });
    assert.equal(r.outcome, 'happened', `${label}: 아무 말도 안 합니다`);
    assert.equal(r.state.bench.beaker.disc, null, `${label}: 원반이 그대로 있습니다`);
    assert.equal(r.state.bench.beaker.elapsedS, 0, `${label}: 시계가 안 돌아갔습니다`);
  }
});

test('이미 뜬 시행은 조건을 바꿔도 되감기지 않는다', () => {
  // 측정이 끝났고 그때 조건은 얼려 있다. 되감으면 기록하기 전에 결과가 사라진다.
  let { state } = run(initialState(), setup({ tempC: 20 }));
  state = tickUntilDone(state);
  const r = reduce(state, { type: 'PUT_IN_BATH', payload: { tempC: 37 } });
  assert.equal(r.state.bench.beaker.floated, true, '뜬 결과가 사라졌습니다');
});

test('시행 번호는 한 번 쓰면 다시 쓰지 않는다', () => {
  // 남은 시행에서 최댓값을 뽑던 시절에는 마지막 것을 지우면 같은 번호가 다시 붙었다 —
  // 그 번호에 딸린 노트가 새 시행의 것이 된다.
  let s = initialState();
  s = reduce(s, { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  const once = (tempC) => {
    ({ state: s } = run(s, [['EMPTY_BEAKER', {}], ...setup({ tempC })]));
    s = tickUntilDone(s);
    s = reduce(s, { type: 'RECORD_TRIAL' }).state;
  };
  once(37); once(20);
  const last = s.trials.at(-1).at;
  s = reduce(s, { type: 'DELETE_TRIAL', payload: { at: last } }).state;
  once(0);
  assert.notEqual(s.trials.at(-1).at, last, '지운 번호가 다시 붙었습니다');
  assert.equal(new Set(s.trials.map((t) => t.at)).size, s.trials.length);
});

test('끓인 감자즙은 통제변인이라 어긋나면 이름이 남는다', () => {
  // 통제변인에 없던 시절에는 실수로 끓인 감자즙을 쓴 시행이 **깨끗한 점**으로 찍혔다.
  // pH 계열에서 pH 7 자리에만 끓인 것을 쓰면 「pH 7 에서 활성이 없다」가 학생의 결론이 된다.
  let { state } = run(initialState(), [
    ['SET_INDEPENDENT', { variable: 'ph' }],
    ['MAKE_EXTRACT', { pct: 100 }], ['BOIL_EXTRACT', {}],
    ['PUNCH_DISC', {}], ['SOAK_DISC', {}],
    ['POUR_H2O2', { pct: 3 }], ['DROP_DISC', {}],
  ]);
  state = tickUntilDone(state, 10);
  const { trials } = reduce(state, { type: 'RECORD_TRIAL' }).state;
  assert.deepEqual(trials[0].offDesign, ['extractBoiled']);
});

/**
 * **막힌 결과에는 태그가 없다 — 층 사이를 못 박는다.**
 *
 * `blocked(state, message, reason)` 에는 `tag` 자리가 아예 없다. 그런데 말풍선 쪽
 * (`toast.js`)은 그 사실 위에 서 있다 — 막힘을 태그로 거르려 들면 조건이 **언제나
 * 거짓**이라 아무것도 못 거르고, 그 코드는 **조용히 죽은 채로** 남는다.
 *
 * 여기가 바뀌면 저쪽 주석이 거짓이 되므로, 두 층을 이 검사로 묶어 둔다.
 * (옆 랩이 자기 저장소에서 그 구멍에 빠지고 알려 준 것을 받아 넣었다. 그쪽은
 * **검사가 태그를 손으로 실어** 앱이 만들 수 없는 상태를 재고 있었다.)
 */
test('막힌 결과에는 태그가 없다 — 태그로 거르는 코드는 죽는다', () => {
  let st = initialState(1);
  st = reduce(st, { type: 'PUT_IN_BATH', payload: { tempC: 100 } }).state;
  st = reduce(st, { type: 'PUT_IN_BATH', payload: { tempC: 0 } }).state;   // 열 충격
  const r = reduce(st, { type: 'SET_PH', payload: { ph: 7 } });
  assert.equal(r.outcome, 'blocked', '깨진 비커를 만졌는데 안 막혔습니다');
  assert.equal(r.tag, undefined,
    '막힌 결과에 태그가 생겼습니다 — toast.js 가 「막힘엔 태그가 없다」 위에 서 있습니다');
  assert.ok(r.reason, '막힘에는 사유(reason)가 있어야 합니다');
});
