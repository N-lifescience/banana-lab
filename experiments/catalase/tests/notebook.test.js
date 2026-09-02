/**
 * 탐구 과정(4쪽)의 STEP 잠금 — **잠긴 칸이 하는 말과 실제 잠긴 까닭이 같은가.**
 *
 * 플레이테스트(2026-09-02)에서 둘이 어긋난 자리가 둘 나왔다:
 *   · 3단계는 STEP 1 을 다 적어도 STEP 2 가 **영영** 안 열렸다 — 없는 칸(`'1'`)을 보고 있었다
 *   · 1단계는 STEP 2 를 다 적어도 「이대로 실험하기」를 안 눌렀으면 STEP 3 이 잠긴 채
 *     「STEP 2 의 관찰 기록을 적어야 여기가 열립니다」라고 했다 — 방금 적은 학생에게 거짓말
 *
 * 여기서는 `stepLocks` 가 **관찰 기록만** 보는지, 세 난이도에서 같은지 못 박는다.
 * DOM 없이 돈다 — `createNotebook` 은 부르지 않는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { stepLocks, stepNotesWritten } from '../src/ui/notebook.js';
import { UI } from '../src/ui/strings.js';

const put = (st, step, text) => reduce(st, { type: 'SAVE_NOTE', payload: { step, text } }).state;
const ids = UI.protocol.map((g) => g.id);

/** STEP 하나의 세부 단계 칸을 전부 채운다 — 화면에 있는 그 칸들(`1a`·`1b` …)이다. */
function writeStep(st, group) {
  let s = st;
  group.steps.forEach((_, i) => { s = put(s, `${group.id}${String.fromCharCode(97 + i)}`, `기록 ${i}`); });
  return s;
}

test('아무것도 안 적었으면 STEP 1 만 열리고 나머지는 STEP 1 에 잠긴다 — 세 난이도 모두', () => {
  for (const level of [1, 2, 3]) {
    const locks = stepLocks(initialState(level));
    assert.equal(locks[0], null, `${level}단계: STEP 1 이 잠겼습니다`);
    assert.deepEqual(locks.slice(1), ids.slice(1).map(() => ids[0]),
      `${level}단계: 뒤 STEP 은 전부 STEP 1 에 잠겨야 합니다`);
  }
});

test('3단계에서도 STEP 1 의 칸(1a·1b)을 다 적으면 STEP 2 가 열린다', () => {
  // 화면에 그려지는 칸은 세 난이도 모두 세부 단계마다 하나다. 3단계라고 `'1'` 칸은 없다.
  const st = writeStep(initialState(3), UI.protocol[0]);
  assert.equal(stepNotesWritten(st, UI.protocol[0]), true, '3단계에서 1a·1b 를 적었는데 「안 적음」입니다');
  const locks = stepLocks(st);
  assert.equal(locks[1], null, '3단계: STEP 1 을 다 적었는데 STEP 2 가 잠겨 있습니다');
  assert.equal(locks[2], ids[1], 'STEP 3 은 STEP 2 에 잠겨야 합니다');
});

test('실험대 조작을 하나도 안 했어도, 적은 만큼 열린다 — 잠금은 기록만 본다', () => {
  // 「이대로 실험하기」도 안 누르고 원반도 안 뚫었다. 그래도 STEP 1·2 를 적었으면 STEP 3 은 열린다.
  let st = initialState(1);
  st = writeStep(st, UI.protocol[0]);
  st = writeStep(st, UI.protocol[1]);
  assert.equal(st.design.declared, false);
  const locks = stepLocks(st);
  assert.deepEqual(locks.slice(0, 3), [null, null, null], 'STEP 1·2 를 적었으면 STEP 3 까지 열려야 합니다');
  assert.deepEqual(locks.slice(3), ids.slice(3).map(() => ids[2]), 'STEP 4·5 는 STEP 3 에 잠겨야 합니다');
});

test('한 칸씩만 열린다 — STEP 1 만 적으면 STEP 3 은 아직 잠긴다', () => {
  const st = writeStep(initialState(2), UI.protocol[0]);
  const locks = stepLocks(st);
  assert.equal(locks[1], null);
  assert.equal(locks[2], ids[1]);
});

test('잠긴 칸이 가리키는 STEP 은 그 자체로는 열려 있다 — 문구가 닿을 수 없는 곳을 가리키지 않는다', () => {
  let st = initialState(1);
  for (let k = 0; k < UI.protocol.length; k++) {
    const locks = stepLocks(st);
    for (const by of locks.filter(Boolean)) {
      assert.equal(locks[ids.indexOf(by)], null, `STEP ${by} 에 잠겼다는데 STEP ${by} 도 잠겨 있습니다`);
    }
    st = writeStep(st, UI.protocol[k]);
  }
  assert.deepEqual(stepLocks(st), ids.map(() => null), '다 적으면 아무것도 안 잠긴다');
});

test('한 번 펼쳐 본 STEP 은 다시 잠기지 않는다', () => {
  const locks = stepLocks(initialState(1), new Set([ids[3]]));
  assert.equal(locks[3], null, '펼쳐 본 STEP 이 도로 잠겼습니다');
  assert.equal(locks[4], ids[0], '펼쳐 본 적 없는 STEP 은 그대로 잠긴다');
});

test('공백만 적은 칸은 안 적은 것이다', () => {
  let st = initialState(1);
  UI.protocol[0].steps.forEach((_, i) => { st = put(st, `1${String.fromCharCode(97 + i)}`, '   '); });
  assert.equal(stepNotesWritten(st, UI.protocol[0]), false);
});
