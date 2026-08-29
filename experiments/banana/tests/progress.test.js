/**
 * "실제로 했는가" 판정이 절차와 어긋나지 않는가.
 *
 * 이 표가 절차보다 짧거나 길면 화면이 엉뚱한 칸에 표시를 단다. 그런데 그건 브라우저를
 * 띄워야만 보이고, 띄워도 잘 안 보인다 — 20칸 중 한 칸이 밀린 것을 눈으로 잡기는 어렵다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP_DONE, stepDone, groupDone, resultsDone } from '../src/sim/progress.js';
import { reduce } from '../src/sim/rules.js';
import { initialState, REAGENTS, SLIDE_IDS } from '../src/sim/state.js';
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
  // STEP 1 의 "받침 유리 꺼내기" 만 예외다 — 처음부터 선반에 나와 있으므로 늘 참이다.
  assert.equal(stepDone(st, '1', 0), false);
  assert.equal(stepDone(st, '1', 1), true);
  for (const g of UI.protocol) assert.equal(groupDone(st, g.id), false, `STEP ${g.id}`);
  assert.equal(resultsDone(st), false);
});

test('절차를 끝까지 밟으면 여섯 단계가 모두 끝난 것으로 판정된다', () => {
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };

  go('PEEL_BANANA');
  for (const id of SLIDE_IDS) go('SMEAR', { slide: id, thickness: 0.3 });

  go('FILL_DROPPER', { reagent: REAGENTS.WATER });
  go('DROP', { slide: 'A', count: 2 });
  go('RINSE_DROPPER');
  go('FILL_DROPPER', { reagent: REAGENTS.IKI });
  go('DROP', { slide: 'B', count: 2 });
  go('RINSE_DROPPER');
  go('FILL_DROPPER', { reagent: REAGENTS.SUDAN });
  go('DROP', { slide: 'C', count: 2 });
  go('RINSE_DROPPER');
  for (let i = 0; i < 12; i++) go('TICK', { seconds: 1, speed: 10 });

  for (const id of SLIDE_IDS) {
    go('PICK_COVERSLIP');
    go('PLACE_COVERSLIP', { slide: id, angleDeg: 45 });
  }

  go('SET_DIAPHRAGM', { value: 0.85 });
  for (const id of SLIDE_IDS) {
    go('SET_OBJECTIVE', { objective: 4 });
    go('MOUNT', { slide: id });
    go('COARSE_FOCUS', { delta: 0 });
    go('SET_OBJECTIVE', { objective: 40 });
    go('CAPTURE');
  }

  for (const g of UI.protocol) {
    const left = g.steps
      .map((step, i) => (stepDone(s, g.id, i) ? null : step.label))
      .filter(Boolean);
    assert.deepEqual(left, [], `STEP ${g.id} 에서 아직 안 한 것으로 잡힙니다`);
  }
  assert.equal(resultsDone(s), true);
});
