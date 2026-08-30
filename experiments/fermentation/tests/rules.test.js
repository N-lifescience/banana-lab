/**
 * 규칙 엔진 테스트.
 *
 * 가장 중요한 것은 「하드 게이트는 두 종류뿐이다」다 — 모든 액션을 여러 상태에서
 * 돌려 보고 `blocked` 가 나오면 사유가 허용된 둘 중 하나인지 본다.
 * 누군가 조작을 막는 코드를 넣으면 거기서 잡힌다 (AGENTS.md §2.1).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, tubeConditions, offDesign, controlledKeys, conditionValue,
  volumeOutliers, mixPct, UNDO_LIMITS, HISTORY_LIMIT, MODES, isRunning,
} from '../src/sim/state.js';
import { reduce, ACTIONS, BLOCKING_REASONS, TRANSIENT_ACTIONS } from '../src/sim/rules.js';
import {
  gasVolume, OBSERVE_LIMIT_MIN, GLUCOSE_POUR_ML, YEAST_POUR_ML, KOH_POUR_ML,
} from '../src/sim/fermentation.js';

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

/** 발효관 하나를 채우고 항온기에 넣기까지. */
const setup = (over = {}) => [
  ...(over.glucosePct === undefined
    ? [['POUR_GLUCOSE', { pct: 10 }]]
    : over.glucosePct === null ? [] : [['POUR_GLUCOSE', { pct: over.glucosePct }]]),
  ...(over.yeast === false
    ? [['POUR_WATER', {}]]
    : [['POUR_YEAST', { ml: over.yeastMl ?? YEAST_POUR_ML }]]),
  ...(over.plugged === false ? [] : [['PLUG_TUBE', {}]]),
  ['PUT_IN_INCUBATOR', { tempC: over.tempC ?? 33 }],
];

/** 관찰 시간을 다 흘린다. */
function tickToEnd(state, step = 1) {
  let s = state;
  for (let t = 0; t < OBSERVE_LIMIT_MIN + 2 && s.bench.tube.elapsedMin < OBSERVE_LIMIT_MIN; t += step) {
    s = reduce(s, { type: 'TICK', payload: { minutes: step } }).state;
  }
  return s;
}

/* ================================================================== */
/* 변인 설계                                                           */
/* ================================================================== */

test('조작변인을 고르면 그 조건이 통제변인 목록에서 빠진다', () => {
  assert.ok(!controlledKeys({ independent: 'temp' }).includes('tempC'));
  assert.ok(controlledKeys({ independent: 'temp' }).includes('glucosePct'));
  assert.ok(!controlledKeys({ independent: 'glucose' }).includes('glucosePct'));
  assert.ok(controlledKeys({ independent: 'glucose' }).includes('tempC'));
});

test('조작변인을 도중에 바꿔도 막지 않는다 — 앞 시행이 이어지지 않을 뿐', () => {
  let s = reduce(initialState(1), { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  s = tickToEnd(run(s, setup({ tempC: 30 })).state);
  s = reduce(s, { type: 'RECORD_TRIAL' }).state;
  const r = reduce(s, { type: 'SET_INDEPENDENT', payload: { variable: 'glucose' } });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.design.independent, 'glucose');
  assert.equal(r.state.trials.length, 1, '앞서 잰 시행이 사라졌습니다');
});

test('설계를 안 해도 실험은 그대로 된다 — declared 는 잠금이 아니다', () => {
  const s = tickToEnd(run(initialState(1), setup()).state);
  const r = reduce(s, { type: 'RECORD_TRIAL' });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.trials.length, 1);
});

test('조작변인을 안 골랐으면 어긋난 통제변인도 없다 — 나무라지 않는다', () => {
  const st = initialState(1);
  assert.deepEqual(offDesign(st.design, tubeConditions(st.bench.tube)), []);
});

test('통제변인이 어긋난 시행도 기록되고, 무엇이 어긋났는지 이름으로 남는다', () => {
  // 온도를 조작변인으로 골라 두고, 포도당을 5 % 로 부어 통제변인을 어긋나게 한다.
  let s = reduce(initialState(1), { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  s = tickToEnd(run(s, setup({ glucosePct: 5, tempC: 30 })).state);
  const r = reduce(s, { type: 'RECORD_TRIAL' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.trials.length, 1);
  assert.deepEqual(r.state.trials[0].offDesign, ['glucosePct']);
});

test('통제변인 목록에 없는 조건을 정하려 해도 막지 않고 말해 준다', () => {
  const r = reduce(initialState(1), { type: 'SET_CONTROL', payload: { key: 'ph', value: 7 } });
  assert.equal(r.outcome, 'happened');
});

/* ================================================================== */
/* 발효관 채우기                                                        */
/* ================================================================== */

test('안 부은 발효관과 증류수만 부은 발효관은 다르다', () => {
  const empty = initialState(1).bench.tube;
  assert.equal(empty.glucosePct, null, '안 부은 것이 0 으로 기록됩니다');
  const s = reduce(initialState(1), { type: 'POUR_WATER', payload: { asGlucose: true } }).state;
  assert.equal(s.bench.tube.glucosePct, 0);
});

test('효모액을 안 넣어도 막지 않는다 — 기체가 안 모이는 것이 답이다', () => {
  const s = tickToEnd(run(initialState(1), setup({ yeast: false })).state);
  const c = s.bench.tube.runConditions;
  assert.equal(gasVolume(c, OBSERVE_LIMIT_MIN), 0);
  const r = reduce(s, { type: 'RECORD_TRIAL' });
  assert.notEqual(r.outcome, 'blocked');
});

test('대조군의 증류수는 효모액과 **같은 부피**라 총 부피가 같아진다', () => {
  const withYeast = run(initialState(1), setup()).state.bench.tube;
  const control = run(initialState(1), setup({ yeast: false })).state.bench.tube;
  assert.equal(tubeConditions(withYeast).totalMl, tubeConditions(control).totalMl);
  assert.equal(tubeConditions(withYeast).totalMl, GLUCOSE_POUR_ML + YEAST_POUR_ML);
});

test('효모액 자리를 비워 두면 그 시행만 부피가 달라져 눈에 띈다', () => {
  const full = { conditions: { totalMl: 35 } };
  const short = { conditions: { totalMl: 20 } };
  assert.deepEqual(volumeOutliers([full, full, short]), [short]);
  assert.deepEqual(volumeOutliers([full, full, full]), []);
});

test('시행이 하나뿐이거나 전부 제각각이면 부피를 나무라지 않는다', () => {
  assert.deepEqual(volumeOutliers([{ conditions: { totalMl: 20 } }]), []);
  assert.deepEqual(volumeOutliers([
    { conditions: { totalMl: 20 } }, { conditions: { totalMl: 30 } }, { conditions: { totalMl: 40 } },
  ]), []);
});

test('솜마개를 안 해도 막지 않는다 — 무엇을 못 보는지 말해 줄 뿐', () => {
  const { last } = run(initialState(1), setup({ plugged: false }));
  assert.equal(last.outcome, 'happened');
  assert.equal(last.tag, 'not-plugged');
  assert.equal(last.state.bench.tube.inIncubator, true, '진행이 막혔습니다');
});

/* ================================================================== */
/* 하드 게이트 — 솜마개                                                 */
/* ================================================================== */

test('솜마개로 막힌 발효관에는 부을 수 없다 — 물리적으로 성립하지 않는다', () => {
  const s = run(initialState(1), [['PLUG_TUBE', {}]]).state;
  const r = reduce(s, { type: 'POUR_YEAST', payload: {} });
  assert.equal(r.outcome, 'blocked');
  assert.equal(r.reason, BLOCKING_REASONS.IMPOSSIBLE);
});

test('막혔을 때 어디로 가야 하는지까지 말한다', () => {
  const s = run(initialState(1), [['PLUG_TUBE', {}]]).state;
  const r = reduce(s, { type: 'POUR_GLUCOSE', payload: { pct: 10 } });
  assert.match(r.message, /솜마개/, '무엇이 막고 있는지 말하지 않습니다');
  assert.match(r.message, /눌러/, '어떻게 빼는지 말하지 않습니다');
});

test('막힌 데서 빠져나가는 길이 있다', () => {
  let s = run(initialState(1), [['PLUG_TUBE', {}]]).state;
  s = reduce(s, { type: 'UNPLUG_TUBE' }).state;
  const r = reduce(s, { type: 'POUR_YEAST', payload: {} });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.bench.tube.yeastMl, YEAST_POUR_ML);
});

/* ================================================================== */
/* 정상 경로                                                           */
/* ================================================================== */

test('정상 경로: 설계부터 기록까지 경고 하나 없이 끝난다', () => {
  const { state, last } = run(initialState(1), [
    ['SET_INDEPENDENT', { variable: 'temp' }],
    ['DECLARE_DESIGN', {}],
    ['POUR_GLUCOSE', { pct: 10 }],
    ['POUR_YEAST', {}],
    ['PLUG_TUBE', {}],
    ['PUT_IN_INCUBATOR', { tempC: 33 }],
  ]);
  assert.equal(last.outcome, 'ok', `정상 절차에 경고가 붙었습니다: ${last.message}`);
  const done = tickToEnd(state);
  const rec = reduce(done, { type: 'RECORD_TRIAL' });
  assert.equal(rec.outcome, 'ok', `정상 기록에 경고가 붙었습니다: ${rec.message}`);
  assert.equal(rec.state.trials.length, 1);
  assert.ok(rec.state.trials[0].gasMl > 0, '기체가 안 모였습니다');
});

test('기록된 기체 양이 기록된 조건에서 실제로 나오는 값이다', () => {
  const s = tickToEnd(run(initialState(1), setup({ tempC: 30 })).state);
  const t = reduce(s, { type: 'RECORD_TRIAL' }).state.trials[0];
  assert.equal(t.gasMl, gasVolume(t.conditions, OBSERVE_LIMIT_MIN));
});

test('관찰 시간을 안 채우면 막지 않고 상황을 말해 준다', () => {
  let s = run(initialState(1), setup()).state;
  s = reduce(s, { type: 'TICK', payload: { minutes: 3 } }).state;
  const r = reduce(s, { type: 'RECORD_TRIAL' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.trials.length, 0);
  assert.match(r.message, /\d+분/);
});

test('시작도 안 했으면 기록할 것이 없다고 말해 준다', () => {
  const r = reduce(initialState(1), { type: 'RECORD_TRIAL' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.trials.length, 0);
});

test('관찰 시간을 넘겨 시간을 흘려도 시간이 더 가지 않는다', () => {
  let s = tickToEnd(run(initialState(1), setup()).state);
  s = reduce(s, { type: 'TICK', payload: { minutes: 100 } }).state;
  assert.equal(s.bench.tube.elapsedMin, OBSERVE_LIMIT_MIN);
  assert.equal(isRunning(s.bench.tube), false);
});

/* ================================================================== */
/* 이산화 탄소 확인                                                     */
/* ================================================================== */

test('용액을 빼내고 수산화 칼륨을 넣으면 맹관부 기체가 줄었다고 말해 준다', () => {
  let s = tickToEnd(run(initialState(1), setup()).state);
  s = reduce(s, { type: 'UNPLUG_TUBE' }).state;
  const drained = reduce(s, { type: 'DRAIN_TUBE' });
  assert.equal(drained.outcome, 'ok');
  const r = reduce(drained.state, { type: 'ADD_KOH', payload: { ml: KOH_POUR_ML } });
  assert.equal(r.outcome, 'ok');
  assert.match(r.message, /줄었/);
});

test('용액을 안 빼고 넣어도 막지 않는다 — 넘친다고 말해 줄 뿐', () => {
  let s = tickToEnd(run(initialState(1), setup()).state);
  s = reduce(s, { type: 'UNPLUG_TUBE' }).state;
  const r = reduce(s, { type: 'ADD_KOH', payload: {} });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.bench.tube.kohMl, KOH_POUR_ML);
});

test('모인 기체가 없으면 줄어들 것도 없다고 말한다', () => {
  let s = tickToEnd(run(initialState(1), setup({ yeast: false })).state);
  s = reduce(s, { type: 'UNPLUG_TUBE' }).state;
  s = reduce(s, { type: 'DRAIN_TUBE' }).state;
  const r = reduce(s, { type: 'ADD_KOH', payload: {} });
  assert.equal(r.tag, 'koh-no-gas');
});

test('이산화 탄소를 확인했는지가 시행에 남는다', () => {
  let s = tickToEnd(run(initialState(1), setup()).state);
  assert.equal(reduce(s, { type: 'RECORD_TRIAL' }).state.trials[0].kohChecked, false);
  s = reduce(s, { type: 'UNPLUG_TUBE' }).state;
  s = reduce(s, { type: 'DRAIN_TUBE' }).state;
  s = reduce(s, { type: 'ADD_KOH', payload: {} }).state;
  assert.equal(reduce(s, { type: 'RECORD_TRIAL' }).state.trials[0].kohChecked, true);
});

/* ================================================================== */
/* 되감기 — 도중에 조건을 바꾸면                                        */
/* ================================================================== */

test('발효 중에 항온기를 옮기면 시행이 처음부터 다시 시작된다', () => {
  let s = run(initialState(1), setup({ tempC: 20 })).state;
  s = reduce(s, { type: 'TICK', payload: { minutes: 10 } }).state;
  assert.equal(s.bench.tube.elapsedMin, 10);
  const r = reduce(s, { type: 'PUT_IN_INCUBATOR', payload: { tempC: 40 } });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'run-restarted');
  assert.equal(r.state.bench.tube.elapsedMin, 0, '앞선 10 분이 새 온도로 소급 계산됩니다');
});

test('발효 중에 솜마개를 빼면 처음부터 다시 한다', () => {
  let s = run(initialState(1), setup()).state;
  s = reduce(s, { type: 'TICK', payload: { minutes: 5 } }).state;
  const r = reduce(s, { type: 'UNPLUG_TUBE' });
  assert.equal(r.tag, 'run-restarted');
  assert.equal(r.state.bench.tube.elapsedMin, 0);
});

test('관찰이 끝난 뒤에는 되감기지 않는다 — 이미 잰 것이다', () => {
  let s = tickToEnd(run(initialState(1), setup({ tempC: 30 })).state);
  const r = reduce(s, { type: 'TAKE_FROM_INCUBATOR' });
  assert.equal(r.state.bench.tube.elapsedMin, OBSERVE_LIMIT_MIN);
  assert.equal(r.state.bench.tube.runConditions.tempC, 30);
});

test('넣은 뒤에 옮겨도 기록은 잰 조건 그대로다', () => {
  let s = tickToEnd(run(initialState(1), setup({ tempC: 30 })).state);
  s = reduce(s, { type: 'TAKE_FROM_INCUBATOR' }).state;
  const t = reduce(s, { type: 'RECORD_TRIAL' }).state.trials[0];
  assert.equal(t.conditions.tempC, 30);
});

/* ================================================================== */
/* 되돌아갈 길                                                         */
/* ================================================================== */

test('발효관을 비우면 처음으로 돌아간다', () => {
  let s = tickToEnd(run(initialState(1), setup()).state);
  s = reduce(s, { type: 'EMPTY_TUBE' }).state;
  assert.equal(s.bench.tube.glucosePct, null);
  assert.equal(s.bench.tube.yeastMl, 0);
  assert.equal(s.bench.tube.plugged, false);
  assert.equal(s.bench.tube.elapsedMin, 0);
});

test('기록을 지울 때 번호로 지운다 — 뒤엣것이 밀리지 않는다', () => {
  let s = initialState(1);
  for (const tempC of [20, 30, 40]) {
    s = tickToEnd(run(s, [['EMPTY_TUBE', {}], ...setup({ tempC })]).state);
    s = reduce(s, { type: 'RECORD_TRIAL' }).state;
  }
  s = reduce(s, { type: 'DELETE_TRIAL', payload: { at: 1 } }).state;
  assert.deepEqual(s.trials.map((t) => t.at), [0, 2]);
  assert.equal(s.session.trialSeq, 3, '지운 번호가 다시 쓰입니다');
});

test('시행 번호는 한 번 쓰면 다시 쓰지 않는다', () => {
  let s = tickToEnd(run(initialState(1), setup()).state);
  s = reduce(s, { type: 'RECORD_TRIAL' }).state;
  s = reduce(s, { type: 'DELETE_TRIAL', payload: { at: 0 } }).state;
  s = tickToEnd(run(s, [['EMPTY_TUBE', {}], ...setup()]).state);
  s = reduce(s, { type: 'RECORD_TRIAL' }).state;
  assert.equal(s.trials[0].at, 1);
});

/* ================================================================== */
/* 안전 · 되돌리기                                                     */
/* ================================================================== */

/**
 * **앱은 안전 수칙을 재지 않는다.** 손 씻기·마개 닫기·폐액 처리를 하게 만드는 조작을
 * 전부 걷어냈다 — 마개를 닫으려고 병을 한 번 누르는 것은 안전 습관이 아니라 화면 조작이고,
 * 학생은 자기 평가를 채우려고 그것을 누른다. 지금은 탐구 노트 7단계에 **무엇을 지켜야
 * 하는지 적어 두기만** 하고, **앱이 확인하지 않는다는 것을 밝힌다.**
 *
 * 규칙 엔진에 그 액션이 **되살아나지 않는지** 여기서 지킨다. 되살아나면 상태에도 다시
 * 칸이 생기고, 그 칸은 제출물로 새어 나간다 — 개인정보처리방침에 없는 항목이 나가는 것이다.
 */
test('안전 수칙 조작이 규칙 엔진에 없다 — 앱은 그것을 재지 않는다', () => {
  for (const type of ['WASH_HANDS', 'CLOSE_CAP', 'DISPOSE_WASTE', 'CHECK_TIDY', 'NOTE_VIOLATION']) {
    assert.throws(() => reduce(initialState(1), { type }),
      `${type} 이 되살아났습니다 — 앱은 안전 수칙을 재지 않습니다`);
  }
  const st = initialState(1);
  for (const key of ['violations', 'tidy']) {
    assert.equal(key in st.session, false,
      `session.${key} 가 남아 있습니다 — 재지 않는 것을 담아 두면 제출물로 샙니다`);
  }
});

test('난이도가 올라갈수록 되돌릴 수 있는 횟수가 줄어든다', () => {
  assert.ok(UNDO_LIMITS[1] > UNDO_LIMITS[2]);
  assert.ok(UNDO_LIMITS[2] > UNDO_LIMITS[3]);
});

test('되돌리면 직전 상태로 돌아가고, 로그는 되돌리지 않는다', () => {
  let s = reduce(initialState(2), { type: 'POUR_GLUCOSE', payload: { pct: 10 } }).state;
  const before = s.session.log.length;
  const r = reduce(s, { type: 'UNDO' });
  assert.equal(r.state.bench.tube.glucosePct, null);
  assert.ok(r.state.session.log.length > before, '로그까지 되돌아갔습니다');
});

test('시간이 흘러도 되돌리기 기록이 밀리지 않는다', () => {
  let s = run(initialState(2), setup()).state;
  const before = s.session.history.length;
  s = tickToEnd(s);
  assert.equal(s.session.history.length, before, 'TICK 이 되돌리기 기록을 밀어냈습니다');
});

test('연속 조작은 되돌리기 기록에서 하나로 합쳐진다', () => {
  let s = initialState(1);
  const before = s.session.history.length;
  for (const v of [10, 20, 30]) {
    s = reduce(s, { type: 'SET_CONTROL', payload: { key: 'tempC', value: v } }).state;
  }
  assert.equal(s.session.history.length, before + 1);
});

test('되돌리기 기록은 상한까지만 쌓이고, 스냅샷이 스냅샷을 품지 않는다', () => {
  let s = initialState(1);
  for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
    s = reduce(s, { type: i % 2 ? 'PLUG_TUBE' : 'UNPLUG_TUBE' }).state;
  }
  assert.equal(s.session.history.length, HISTORY_LIMIT);
  for (const snap of s.session.history) assert.deepEqual(snap.session.history, []);
});

test('되돌리기를 다 써도, 되돌릴 것이 없어도 막지 않는다', () => {
  const empty = reduce(initialState(3), { type: 'UNDO' });
  assert.equal(empty.outcome, 'happened');
  let s = reduce(initialState(3), { type: 'PLUG_TUBE' }).state;
  s = reduce(s, { type: 'UNPLUG_TUBE' }).state;
  s = reduce(s, { type: 'UNDO' }).state;
  const r = reduce(s, { type: 'UNDO' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'undo-exhausted');
});

/* ================================================================== */
/* 뼈대                                                                */
/* ================================================================== */

test('reduce 는 원본 상태를 바꾸지 않는다', () => {
  const s = initialState(1);
  const copy = JSON.stringify(s);
  reduce(s, { type: 'POUR_GLUCOSE', payload: { pct: 10 } });
  assert.equal(JSON.stringify(s), copy);
});

test('로그에는 시각이 아니라 순번이 붙는다', () => {
  const s = reduce(initialState(1), { type: 'PLUG_TUBE' }).state;
  assert.equal(s.session.log[0].at, 0);
});

test('모르는 액션은 조용히 넘어가지 않는다', () => {
  assert.throws(() => reduce(initialState(1), { type: 'NOPE' }));
});

test('시간 경과와 읽음 표시는 학생이 「한」 조작이 아니다', () => {
  for (const type of ['TICK', 'MARK_READ']) {
    assert.ok(TRANSIENT_ACTIONS.has(type), `${type} 이 되돌리기 기록에 쌓입니다`);
  }
});

test('모드는 혼자와 모둠 둘뿐이고, 상태가 그것을 들고 있다', () => {
  assert.equal(initialState(1, 1, MODES.SOLO).session.mode, MODES.SOLO);
  assert.equal(initialState(1, 1, MODES.GROUP).session.mode, MODES.GROUP);
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

/**
 * **이 파일에서 가장 중요한 검사다.**
 *
 * 모든 액션을 여러 상태에서 돌려 보고, `blocked` 이 나오면 사유가 허용된 둘 중
 * 하나인지 본다. 조작을 막는 코드를 새로 넣으면 여기서 잡힌다.
 */
test('하드 게이트는 두 종류뿐이다', () => {
  const states = [
    initialState(1),
    run(initialState(1), setup({ tempC: 30 })).state,
    run(initialState(1), setup({ yeast: false })).state,
    run(initialState(1), [['PLUG_TUBE', {}]]).state,
    tickToEnd(run(initialState(2), setup()).state),
    run(initialState(3), [['POUR_WATER', { asGlucose: true }], ['PLUG_TUBE', {}]]).state,
  ];
  const payload = {
    variable: 'temp', key: 'tempC', value: 30, pct: 10, ml: 15, tempC: 40,
    minutes: 1, at: 0, step: 'x', text: 'y', stage: '1', kind: 'hands-unwashed',
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

/**
 * **막히는 자리가 실제로 하나뿐인지**까지 본다.
 *
 * 위 검사는 「막을 때 사유가 옳은가」만 본다. 그것만으로는 막는 자리가 스무 개로 늘어나도
 * 전부 IMPOSSIBLE 을 달면 통과한다. 그래서 **몇 군데서 막히는가**를 따로 센다 —
 * 늘어나면 사람이 그 늘어난 이유를 보게 된다.
 */
test('막히는 조작은 솜마개 하나뿐이다', () => {
  const plugged = run(initialState(1), [['PLUG_TUBE', {}]]).state;
  const payload = { pct: 10, ml: 15, tempC: 30, variable: 'temp', key: 'tempC', value: 30, at: 0 };
  const blockedTypes = Object.keys(ACTIONS)
    .filter((type) => reduce(plugged, { type, payload }).outcome === 'blocked');
  assert.deepEqual(blockedTypes.sort(), ['ADD_KOH', 'DRAIN_TUBE', 'POUR_GLUCOSE', 'POUR_WATER', 'POUR_YEAST'],
    '막히는 조작이 달라졌습니다 — 전부 「솜마개가 입구를 막고 있다」여야 합니다');
});

test('통제변인 한 칸을 조건에서 읽는 통로가 하나다', () => {
  const c = { tempC: 30, glucosePct: 10, yeastMl: 15, totalMl: 35, plugged: true };
  assert.equal(conditionValue('yeast', c), true);
  assert.equal(conditionValue('yeast', { ...c, yeastMl: 0 }), false);
  assert.equal(conditionValue('tempC', c), 30);
  assert.equal(conditionValue('plugged', c), true);
});

/* ================================================================== */
/* 희석 — 계산이 틀리면 결과가 대신 답한다                              */
/* ================================================================== */

test('10 % 10 mL 에 증류수 10 mL 를 더하면 5 % 가 된다', () => {
  const s = run(initialState(1), [
    ['ADD_TO_MIX', { kind: 'glucose' }],
    ['ADD_TO_MIX', { kind: 'water' }],
  ]).state;
  assert.equal(mixPct(s.bench.mix), 5);
});

test('증류수를 한 번 더 넣으면 3.3 % 가 된다 — 막지 않는다', () => {
  const { state, last } = run(initialState(1), [
    ['ADD_TO_MIX', { kind: 'glucose' }],
    ['ADD_TO_MIX', { kind: 'water' }],
    ['ADD_TO_MIX', { kind: 'water' }],
  ]);
  assert.notEqual(last.outcome, 'blocked');
  assert.ok(Math.abs(mixPct(state.bench.mix) - 10 / 3) < 1e-9);
});

test('틀리게 희석한 농도가 그대로 발효관에 들어가 설계와 어긋난다', () => {
  let s = reduce(initialState(1), { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  s = reduce(s, { type: 'SET_CONTROL', payload: { key: 'glucosePct', value: 5 } }).state;
  s = run(s, [
    ['ADD_TO_MIX', { kind: 'glucose' }],
    ['ADD_TO_MIX', { kind: 'water' }],
    ['ADD_TO_MIX', { kind: 'water' }],   // 한 번 더 — 5 % 가 아니라 3.3 %
    ['POUR_MIX', {}],
    ['POUR_YEAST', {}],
    ['PLUG_TUBE', {}],
    ['PUT_IN_INCUBATOR', { tempC: 33 }],
  ]).state;
  const t = reduce(tickToEnd(s), { type: 'RECORD_TRIAL' }).state.trials[0];
  assert.deepEqual(t.offDesign, ['glucosePct'], '틀린 희석이 설계와 맞는 것으로 나옵니다');
});

test('맞게 희석하면 설계와 어긋나지 않는다 — 맞는 일에 빨간불이 나면 안 된다', () => {
  let s = reduce(initialState(1), { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  s = reduce(s, { type: 'SET_CONTROL', payload: { key: 'glucosePct', value: 5 } }).state;
  s = run(s, [
    ['ADD_TO_MIX', { kind: 'glucose' }],
    ['ADD_TO_MIX', { kind: 'water' }],
    ['POUR_MIX', {}],
    ['POUR_YEAST', {}],
    ['PLUG_TUBE', {}],
    ['PUT_IN_INCUBATOR', { tempC: 33 }],
  ]).state;
  const t = reduce(tickToEnd(s), { type: 'RECORD_TRIAL' }).state.trials[0];
  assert.deepEqual(t.offDesign, []);
});

test('빈 병에서 부으려 하면 막지 않고 어디서 만드는지 말해 준다', () => {
  const r = reduce(initialState(1), { type: 'POUR_MIX', payload: {} });
  assert.equal(r.outcome, 'happened');
  assert.match(r.message, /선반/, '어디로 가야 하는지 말하지 않습니다');
});

test('만든 병을 비우면 처음부터 다시 만들 수 있다', () => {
  let s = run(initialState(1), [['ADD_TO_MIX', { kind: 'water' }]]).state;
  s = reduce(s, { type: 'EMPTY_MIX' }).state;
  assert.equal(mixPct(s.bench.mix), null);
});

test('빈 병은 「0 %」가 아니라 「비어 있음」이다', () => {
  assert.equal(mixPct(initialState(1).bench.mix), null);
});
