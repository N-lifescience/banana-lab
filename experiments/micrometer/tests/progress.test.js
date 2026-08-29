/**
 * "실제로 했는가" 판정이 절차와 어긋나지 않는가.
 *
 * 이 표가 절차보다 짧거나 길면 화면이 엉뚱한 칸에 표시를 단다. 그런데 그건 브라우저를
 * 띄워야만 보이고, 띄워도 잘 안 보인다 — 열일곱 칸 중 한 칸이 밀린 것을 눈으로 잡기는 어렵다.
 *
 * 두 번째 검사가 이 파일의 값어치다: **절차를 rules.js 의 액션으로 끝까지 밟아 본다.**
 * 판정 함수를 손으로 만든 가짜 상태에 먹여 보면, 실제 조작으로는 만들어지지 않는 상태를
 * 판정하고 있어도 통과한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP_DONE, stepDone, groupDone, resultsDone } from '../src/sim/progress.js';
import { reduce } from '../src/sim/rules.js';
import { initialState } from '../src/sim/state.js';
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
  // 이 실험에는 조작이 없어 늘 참인 칸이 하나도 없다. 열일곱 칸 전부 거짓이어야 한다.
  for (const g of UI.protocol) {
    g.steps.forEach((step, i) => {
      assert.equal(stepDone(st, g.id, i), false,
        `STEP ${g.id} 「${step.label}」 이 아무것도 안 했는데 참입니다`);
    });
    assert.equal(groupDone(st, g.id), false, `STEP ${g.id}`);
  }
  assert.equal(resultsDone(st), false);
});

/**
 * 설계도가 「위태롭다」고 짚었던 자리(§2.4)를 지키는 검사.
 *
 * 「눈금을 시야 가운데로」 칸은 없앴고 그 자리에 「접안렌즈를 돌려 나란히 놓기」 를 넣었다.
 * 이 칸이 놓자마자 참이 되면 없앤 문제가 그대로 돌아온 것이다 —
 * **`INSERT_OCULAR` 가 접안렌즈를 비뚤게 끼우는** 덕분에 참이 아니어야 한다.
 * (어긋남은 재물대가 아니라 접안렌즈 쪽에 있다. 리클은 손으로 끼우고 재물대는 클립이 잡는다.)
 */
test('대물 마이크로미터를 올리기만 해서는 「나란히 놓기」 가 참이 되지 않는다', () => {
  let s = initialState(1);
  s = run(s, 'INSERT_OCULAR', { flipped: false }).state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;

  assert.equal(stepDone(s, '2', 0), true, '올린 것은 올린 것으로 잡혀야 합니다');
  assert.equal(s.items.stageMic.angleDeg, 0, '재물대에 놓인 것은 반듯해야 합니다');
  assert.notEqual(s.eyepiece.angleDeg, 0,
    '접안렌즈가 비뚤게 끼워지지 않으면 이 칸은 뜻을 잃습니다 — 돌릴 이유가 없어집니다');
  assert.equal(stepDone(s, '2', 1), false, '돌리지 않았는데 나란한 것으로 잡힙니다');

  s = run(s, 'ROTATE_EYEPIECE', { deltaDeg: -s.eyepiece.angleDeg }).state;
  assert.equal(stepDone(s, '2', 1), true, '나란히 맞췄는데 아직으로 잡힙니다');
});

test('절차를 끝까지 밟으면 여섯 단계가 모두 끝난 것으로 판정된다', () => {
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };
  /** 시야에서 두 곳을 찍는다. 세는 일은 학생이 하고, 앱은 찍힌 자리의 눈금 번호만 읽는다. */
  const pickTwo = (type) => { go(type, { x: -0.5 }); go(type, { x: 0.5 }); };

  /* STEP 1 — 접안 마이크로미터 끼우기 */
  go('INSERT_OCULAR', { flipped: false });

  /* STEP 2 — 올리고, 접안렌즈를 돌려 두 눈금자를 나란히 */
  go('PLACE_ON_STAGE', { item: 'stageMic' });
  go('ROTATE_EYEPIECE', { deltaDeg: -s.eyepiece.angleDeg });

  /* STEP 3 — 100배에서 눈금 맞추기 */
  go('SET_OBJECTIVE', { objective: 10 });
  // **초점을 실제로 맞춘다.** 현미경은 초점이 어긋난 채로 시작한다 (`state.js` 의 coarse).
  // 앞서는 여기서 미동나사를 돌렸다 되돌리기만 했는데, 시작이 이미 딱 맞은 자리라
  // 아무 일도 안 하는 두 줄이었다 — 그래서 「초점 맞추기」가 절차에 있어도
  // 그것이 실제로 필요한지를 이 검사가 한 번도 확인하지 않았다.
  go('COARSE_FOCUS', { delta: -s.microscope.coarse });
  go('FINE_FOCUS', { delta: -s.microscope.fine });
  pickTwo('PICK_SCALE');
  go('RECORD_CALIBRATION');
  go('CAPTURE');
  const cal100 = s.session.calibrations.at(-1);
  assert.equal(cal100.objective, 10);
  assert.ok(cal100.umPerDiv > 0, '눈금값이 빈칸으로 남았습니다 — 찍은 두 지점을 다시 보세요');

  /* STEP 4 — 100배에서 공변세포 재기 */
  go('PLACE_ON_STAGE', { item: 'specimen' });
  pickTwo('PICK_CELL');
  go('RECORD_MEASUREMENT', { calibrationAt: cal100.at });
  go('CAPTURE');

  /* STEP 5 — 400배에서 다시 재기. 학생이 100배 눈금값을 그대로 쓰는 것을 막지 않는다 */
  go('SET_OBJECTIVE', { objective: 40 });
  pickTwo('PICK_CELL');
  go('RECORD_MEASUREMENT', { calibrationAt: cal100.at });
  go('CAPTURE');

  /* STEP 6 — 400배에서 눈금 다시 맞추기 */
  go('PLACE_ON_STAGE', { item: 'stageMic' });
  pickTwo('PICK_SCALE');
  go('RECORD_CALIBRATION');
  go('CAPTURE');

  for (const g of UI.protocol) {
    const left = g.steps
      .map((step, i) => (stepDone(s, g.id, i) ? null : step.label))
      .filter(Boolean);
    assert.deepEqual(left, [], `STEP ${g.id} 에서 아직 안 한 것으로 잡힙니다`);
  }
  assert.equal(resultsDone(s), true);

  // 하드 게이트를 지나온 적이 없어야 한다. 이 절차에는 막히는 자리가 없다.
  assert.equal(s.session.log.some((e) => e.outcome === 'blocked'), false);
});
