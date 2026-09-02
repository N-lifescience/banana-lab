/**
 * "실제로 했는가" 판정이 절차와 어긋나지 않는가.
 *
 * 이 표가 절차보다 짧거나 길면 화면이 엉뚱한 칸에 표시를 단다. 그런데 그건 브라우저를
 * 띄워야만 보이고, 띄워도 잘 안 보인다 — 여러 칸 중 한 칸이 밀린 것을 눈으로 잡기는 어렵다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP_DONE, stepDone, groupDone, resultsDone, countAction } from '../src/sim/progress.js';
import { reduce } from '../src/sim/rules.js';
import { initialState, ENDS, SLOTS, SLOT_ITEMS, ANGLE_BEST_DEG } from '../src/sim/state.js';
import { beatRate } from '../src/sim/spin.js';
import { UI } from '../src/ui/strings.js';

const run = (s, type, payload = {}) => reduce(s, { type, payload });

test('판정 표가 절차표와 한 칸씩 짝을 이룬다', () => {
  for (const group of UI.protocol) {
    const fns = STEP_DONE[group.id];
    assert.ok(fns, `STEP ${group.id} 의 판정이 없습니다`);
    assert.equal(fns.length, group.steps.length,
      `STEP ${group.id}: 절차 ${group.steps.length}칸 · 판정 ${fns.length}칸 — 한 칸씩 밀립니다`);
  }
  // 절차에 없는 그룹을 판정만 남겨 두면, 절차를 지운 뒤에도 아무도 모른다.
  const ids = UI.protocol.map((g) => g.id);
  assert.deepEqual(Object.keys(STEP_DONE).sort(), ids.slice().sort());
});

test('처음에는 아무 단계도 끝나 있지 않다', () => {
  const st = initialState(1);
  for (const g of UI.protocol) assert.equal(groupDone(st, g.id), false, `STEP ${g.id}`);
  assert.equal(resultsDone(st), false);
});

test('절차를 끝까지 밟으면 모든 단계가 끝난 것으로 판정된다', () => {
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };

  // 1. 준비
  go('SWAB_FINGER');
  go('PICK_CAPILLARY', { kind: 'heparin' });
  // 2. 채혈  3. 빨아올리기 — 기둥이 절반 넘게 차야 한다
  for (let i = 0; i < 2; i++) {
    go('PRICK_FINGER');
    go('DRAW_BLOOD', { angleDeg: ANGLE_BEST_DEG, dwell: 0.9 });
  }
  // 4. 밀봉
  go('SEAL_END', { end: ENDS.OUTER, press: 0.75 });
  go('SEAL_END', { end: ENDS.INNER, press: 0.75 });
  // 5. 회전판에 물리기 — **반대쪽에 빈 모세관을 넣어야 균형이 맞는다**
  go('LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE });
  go('LOAD_ROTOR', { slot: SLOTS.B, what: SLOT_ITEMS.COUNTER });
  // 6. 당기기 — 박자에 맞춰
  for (let i = 0; i < 30; i++) {
    go('PULL', { strength: 1 });
    go('TICK', { seconds: 1 / beatRate(s.rotor.speed), speed: 1 });
  }
  for (let i = 0; i < 60; i++) go('TICK', { seconds: 0.4, speed: 1 });
  // 7. 재기와 기록
  go('STOP_ROTOR');
  go('MEASURE');
  go('CAPTURE');

  for (const g of UI.protocol) {
    const left = g.steps
      .map((step, i) => (stepDone(s, g.id, i) ? null : step.label))
      .filter(Boolean);
    assert.deepEqual(left, [], `STEP ${g.id} 에서 아직 안 한 것으로 잡힙니다`);
  }
  assert.equal(resultsDone(s), true);
});

test('당김 횟수를 기준으로 삼지 않는다 — 물음은 「층이 갈렸는가」다', () => {
  // 회전 시간과 당김 횟수는 [확인 필요] 다 (AGENTS.md §2.4).
  // 그 수를 판정에 박아 두면 화면이 없는 사실을 사실처럼 말하게 된다.
  const src = STEP_DONE['6'].map((f) => f.toString()).join('\n');
  assert.equal(/pulls\s*[<>]=?\s*\d/.test(src), false,
    'STEP 6 의 판정이 당김 횟수를 보고 있습니다 — 그 수는 [확인 필요] 입니다');

  // 실제로도 그렇게 돈다: 많이 당겼어도 안 갈렸으면 아직이다.
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };
  go('SWAB_FINGER');
  go('PRICK_FINGER');
  go('DRAW_BLOOD', { angleDeg: ANGLE_BEST_DEG, dwell: 0.9 });
  go('SEAL_END', { end: ENDS.OUTER, press: 0.75 });
  go('SEAL_END', { end: ENDS.INNER, press: 0.75 });
  go('LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE });
  go('LOAD_ROTOR', { slot: SLOTS.B, what: SLOT_ITEMS.COUNTER });
  // 박자를 완전히 어긋나게 스무 번. 횟수만 보면 다 한 것이고, 층은 안 갈렸다.
  for (let i = 0; i < 20; i++) {
    go('PULL', { strength: 1 });
    go('TICK', { seconds: 1.5 / beatRate(s.rotor.speed), speed: 1 });
  }
  assert.ok(countAction(s, 'PULL') >= 20, '스무 번은 당겼다');
  assert.equal(stepDone(s, '6', 1), false, '횟수만 채우고 층이 안 갈렸는데 끝난 것으로 잡힙니다');
});

test('균형은 「했는가」가 아니라 「맞아 있는가」로 본다', () => {
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };
  go('LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE });
  assert.equal(stepDone(s, '5', 0), true, '넣기는 했다');
  assert.equal(stepDone(s, '5', 1), false, '반대쪽이 비었는데 균형이 맞은 것으로 잡힙니다');
  go('LOAD_ROTOR', { slot: SLOTS.B, what: SLOT_ITEMS.COUNTER });
  assert.equal(stepDone(s, '5', 1), true);
  // 깊이를 어긋나게 하면 다시 아니다. 「넣었다」가 아니라 「맞아 있다」를 본다.
  go('SEAT', { slot: SLOTS.B, depth: 0.4 });
  assert.equal(stepDone(s, '5', 1), false);
});

test('새 모세관을 꺼내도 「해 봤다」는 남는다', () => {
  // 모세관은 한 개다. 새것을 꺼내면 상태가 통째로 처음으로 돌아가는데,
  // 학생은 분명히 밀봉을 해 봤다. 물음이 "지금 그런가" 가 아니라 "해 봤는가" 이므로
  // 로그를 본다 (progress.js 머리말).
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };
  go('SEAL_END', { end: ENDS.OUTER, press: 0.75 });
  assert.equal(stepDone(s, '4', 0), true);
  go('NEW_CAPILLARY', {});
  assert.equal(s.tube.seal.outer, 0, '새 모세관은 막혀 있지 않다');
  assert.equal(stepDone(s, '4', 0), true, '해 본 것이 사라지면 노트가 학생을 거짓말쟁이로 만든다');
  assert.equal(stepDone(s, '4', 1), false, '다만 「지금 막혀 있는가」는 아니다');
});

test('실험대에 놓인 모세관을 그대로 써도 「모세관 고르기」는 끝난 것이다', () => {
  /*
   * 플레이테스트에서 실제로 막혔다. 통을 눌러 종류를 바꾼 적도, 새것을 꺼낸 적도 없이
   * 놓인 모세관으로 끝까지 한 학생은 STEP 1 이 영영 「지금 할 차례」였고, 그래서
   * 「한 번에 한 STEP」이 STEP 1 에 닻을 내려 STEP 3 부터 영영 안 열렸다.
   */
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };
  go('SWAB_FINGER');
  assert.equal(stepDone(s, '1', 1), false, '아직 아무 모세관도 쓰지 않았다');
  go('PRICK_FINGER');
  go('DRAW_BLOOD', { angleDeg: ANGLE_BEST_DEG, dwell: 0.9 });
  assert.equal(stepDone(s, '1', 1), true, '손끝에 대어 빨아올린 모세관은 고른 것이다');
  assert.equal(groupDone(s, '1'), true, 'STEP 1 이 영영 「지금 할 차례」로 남습니다');
});

test('재려고 시료를 꺼내도 「균형 맞추기」는 남는다', () => {
  /*
   * 자는 실험대의 모세관에만 댈 수 있어서 학생은 반드시 시료를 꺼내고 잰다.
   * 그 순간 5b 가 도로 「아직」이 되면 STEP 6·7 이 잠긴다 — 플레이테스트에서 실제로 막혔다.
   */
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };
  go('LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE });
  go('LOAD_ROTOR', { slot: SLOTS.B, what: SLOT_ITEMS.COUNTER });
  assert.equal(stepDone(s, '5', 1), true);
  go('UNLOAD', { slot: SLOTS.A });
  assert.equal(s.rotor.slots.A, null, '시료를 꺼냈다');
  assert.equal(stepDone(s, '5', 1), true, '시료를 꺼냈다고 균형을 맞춘 사실이 사라집니다');
  // 빈 모세관 없이 시료만 넣은 것은 여전히 아니다.
  let s2 = initialState(1);
  s2 = run(s2, 'LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE }).state;
  assert.equal(stepDone(s2, '5', 1), false);
});
