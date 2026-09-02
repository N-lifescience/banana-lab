/**
 * 절차 판정표 테스트.
 *
 * 가장 중요한 것은 **`UI.protocol` 과 칸 수가 맞는가**다. 어긋나면 학생이 있지도 않은
 * 단추를 찾거나, 한 단계가 영영 「아직」으로 남는다 — 화면에는 아무 표시도 안 난다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { STEP_DONE, stepDone, groupDone, resultsDone, distinctConditions } from '../src/sim/progress.js';
import { initialState, PH_METHODS } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { UI } from '../src/ui/strings.js';

function run(state, steps) {
  let s = state;
  for (const [type, payload] of steps) s = reduce(s, { type, payload }).state;
  return s;
}

const tickUntilDone = (s0, step = 5) => {
  let s = s0;
  for (let t = 0; t < 300 && !s.bench.beaker.floated; t += step) {
    s = reduce(s, { type: 'TICK', payload: { seconds: step } }).state;
  }
  return s;
};

/** 한 시행을 처음부터 끝까지. */
function trial(s, tempC) {
  s = run(s, [
    ['EMPTY_BEAKER', {}],
    ['PUNCH_DISC', {}], ['MAKE_EXTRACT', { pct: 100 }], ['SOAK_DISC', {}],
    ['POUR_H2O2', { pct: 3 }], ['SET_PH', { ph: 7, method: PH_METHODS.BUFFER }],
    ['PUT_IN_BATH', { tempC }], ['DROP_DISC', {}],
  ]);
  s = tickUntilDone(s);
  return reduce(s, { type: 'RECORD_TRIAL' }).state;
}

/* ---------------- 표와 절차가 짝을 이루는가 ---------------- */

test('판정표의 칸 수가 UI.protocol 의 세부 단계 수와 같다', () => {
  for (const group of UI.protocol) {
    const fns = STEP_DONE[group.id];
    assert.ok(fns, `STEP ${group.id} 의 판정이 없습니다`);
    assert.equal(fns.length, group.steps.length,
      `STEP ${group.id}: 절차는 ${group.steps.length}칸인데 판정은 ${fns.length}칸입니다`);
  }
});

test('판정표에 절차에 없는 그룹이 없다', () => {
  const ids = new Set(UI.protocol.map((g) => g.id));
  for (const id of Object.keys(STEP_DONE)) {
    assert.ok(ids.has(id), `STEP_DONE.${id} 은 UI.protocol 에 없는 그룹입니다`);
  }
});

/* ---------------- 아무것도 안 했으면 아무것도 안 했다 ---------------- */

test('시작하자마자는 어느 칸도 「했다」가 아니다', () => {
  // 조작이 따로 없는 단계를 「했다」로 두면 표시가 아무 뜻이 없어지고,
  // 「아직」으로 두면 학생이 있지도 않은 단추를 찾는다. 여기서는 전부 실제 조작이 있다.
  const st = initialState();
  const done = UI.protocol.flatMap((g) => g.steps.map((_, i) => stepDone(st, g.id, i)));
  assert.deepEqual(done.filter(Boolean), [], '아무것도 안 했는데 「했다」인 칸이 있습니다');
});

/* ---------------- 실제로 하면 켜지는가 ---------------- */

test('조작변인을 고르면 1단계 첫 칸이 켜진다', () => {
  const st = run(initialState(), [['SET_INDEPENDENT', { variable: 'temp' }]]);
  assert.equal(stepDone(st, '1', 0), true);
});

test('통제변인은 기본값을 그대로 두어도 「정했다」로 볼 길이 있다', () => {
  // 기본값 그대로가 맞는 설계일 수 있다. 그때는 「이대로 실험하기」가 정했다는 뜻이다.
  assert.equal(stepDone(run(initialState(), [['DECLARE_DESIGN', {}]]), '1', 1), true);
  assert.equal(stepDone(run(initialState(), [['SET_CONTROL', { key: 'h2o2Pct', value: 1 }]]), '1', 1), true);
});

test('한 시행을 끝내면 2·3·4단계가 다 켜진다', () => {
  const st = trial(run(initialState(), [['SET_INDEPENDENT', { variable: 'temp' }]]), 37);
  for (const id of ['2', '3', '4']) {
    assert.equal(groupDone(st, id), true, `STEP ${id} 이 켜지지 않았습니다`);
  }
});

test('담근 원반을 비커에 넣은 뒤에도 「담그기」 칸이 꺼지지 않는다', () => {
  // DROP_DISC 가 핀셋의 원반을 비운다. 핀셋만 보면 넣은 순간 ✓ 가 · 로 되돌아갔다 —
  // 기록하기 전까지 「담그기」가 안 한 일로 보였다. 플레이테스트에서 잡았다 (2026-09-02).
  const st = run(initialState(), [
    ['PUNCH_DISC', {}], ['MAKE_EXTRACT', { pct: 100 }], ['SOAK_DISC', {}],
    ['POUR_H2O2', { pct: 3 }], ['DROP_DISC', {}],
  ]);
  assert.equal(st.trials.length, 0, '아직 기록 전이어야 하는 검사입니다');
  assert.equal(stepDone(st, '2', 1), true, '원반을 넣자마자 「담그기」가 꺼졌습니다');
});

test('되돌리기로 무른 조작도 「한 적 있다」로 남는다', () => {
  // 로그는 되돌리지 않는다 — 되돌아보기용 기록이기 때문이다 (rules.js 의 UNDO).
  let st = run(initialState(2), [['PUNCH_DISC', {}]]);
  st = reduce(st, { type: 'UNDO' }).state;
  assert.equal(stepDone(st, '2', 0), true);
});

/* ---------------- 되풀이를 어떻게 세는가 ---------------- */

test('같은 조건으로 여러 번 재는 것은 되풀이가 아니다', () => {
  // 같은 점을 세 번 찍는 것과 조건을 바꿔 세 번 재는 것은 다르다.
  let st = run(initialState(), [['SET_INDEPENDENT', { variable: 'temp' }]]);
  for (let i = 0; i < 3; i++) st = trial(st, 37);
  assert.equal(st.trials.length, 3);
  assert.equal(distinctConditions(st), 1);
  assert.equal(stepDone(st, '5', 2), false, '같은 조건 세 번을 되풀이로 셌습니다');
});

test('조건을 바꿔 세 번 재면 5단계가 다 켜진다', () => {
  let st = run(initialState(), [['SET_INDEPENDENT', { variable: 'temp' }]]);
  for (const t of [20, 37, 0]) st = trial(st, t);
  assert.equal(distinctConditions(st), 3);
  assert.equal(groupDone(st, '5'), true);
});

test('조작변인을 안 골랐으면 되풀이를 셀 수 없다', () => {
  let st = initialState();
  for (const t of [20, 37]) st = trial(st, t);
  assert.equal(distinctConditions(st), 0, '무엇을 바꿨는지 모르는데 가짓수를 셌습니다');
});

/* ---------------- 결과가 견줄 만한가 ---------------- */

test('한 점으로는 결과 단계가 끝나지 않는다', () => {
  let st = run(initialState(), [['SET_INDEPENDENT', { variable: 'temp' }]]);
  st = trial(st, 37);
  assert.equal(resultsDone(st), false, '점 하나로는 「조건이 달라지면 달라진다」를 말할 수 없습니다');
  st = trial(st, 20);
  assert.equal(resultsDone(st), true);
});

test('안 뜬 시행도 결과로 센다', () => {
  // 안 뜬 것도 결과다. 세지 않으면 100 ℃ 를 재고도 「아직 안 했다」가 된다.
  let st = run(initialState(), [['SET_INDEPENDENT', { variable: 'temp' }]]);
  st = trial(st, 37);
  st = run(st, [
    ['EMPTY_BEAKER', {}], ['PUNCH_DISC', {}], ['MAKE_EXTRACT', { pct: 100 }], ['SOAK_DISC', {}],
    ['POUR_H2O2', { pct: 3 }], ['PUT_IN_BATH', { tempC: 100 }], ['DROP_DISC', {}],
  ]);
  for (let t = 0; t < 320; t += 10) st = reduce(st, { type: 'TICK', payload: { seconds: 10 } }).state;
  st = reduce(st, { type: 'RECORD_TRIAL' }).state;
  assert.equal(st.trials.length, 2);
  assert.equal(resultsDone(st), true);
});

/* ---------------- 경계 ---------------- */

test('progress.js 는 DOM 도 시계도 난수도 모른다', () => {
  const src = readFileSync(new URL('../src/sim/progress.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const banned of ['document', 'window.', 'Date.now', 'Math.random']) {
    assert.ok(!src.includes(banned), `progress.js 가 ${banned} 을 씁니다`);
  }
  void readdirSync;
});
