/**
 * 절차 판정표 테스트.
 *
 * 탐구 노트 4단계는 **하고 나서 적는 곳**이다. 여기서 보는 것은
 *   1. 절차(`UI.protocol`)와 판정표(`STEP_DONE`)가 **한 칸씩 짝**을 이루는가
 *   2. **없는 조작을 「아직」으로 표시하지 않는가** — 늘 참이거나 늘 거짓인 판정이 없는가
 *   3. 실제로 해야만 ✓ 가 붙는가
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP_DONE, stepDone, groupDone, resultsDone, hasCleanRecord, chamberWith } from '../src/sim/progress.js';
import { initialState, CHAMBERS, MAX_SCOOPS } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { OBSERVE_LIMIT_MIN } from '../src/sim/metabolism.js';
import { UI } from '../src/ui/strings.js';

const scoop = (kind, chamber) => [['SCOOP_BEANS', { kind }], ['POUR_BEANS', { chamber }]];
const ticks = (n) => Array.from({ length: n }, () => ['TICK', { minutes: 1 }]);

function play(script, seed = 4242) {
  let s = initialState(1, seed);
  for (const [type, payload] of script) s = reduce(s, { type, payload: payload ?? {} }).state;
  return s;
}

/** 절차를 처음부터 끝까지 밟는 각본. 앞에서부터 잘라 쓴다. */
const FULL = [
  ...scoop('sprout', 'L'), ...scoop('dry', 'R'),
  ...scoop('sprout', 'L'), ...scoop('dry', 'R'),
  ['POUR_BTB', { chamber: 'L' }], ['POUR_BTB', { chamber: 'R' }],
  ['INSTALL_SENSOR', { chamber: 'L' }], ['INSTALL_SENSOR', { chamber: 'R' }],
  ['SEAL', { chamber: 'L' }], ['SEAL', { chamber: 'R' }],
  ['START', { chamber: 'L' }], ['START', { chamber: 'R' }],
  ...ticks(OBSERVE_LIMIT_MIN),
  ['RECORD', {}],
];

/* ---------------- 절차와 표가 맞는가 ---------------- */

test('절차의 세부 단계마다 판정 함수가 하나씩 있다', () => {
  // 하나라도 어긋나면 그 칸은 영영 「아직」으로 남고, 학생은 있지도 않은 단추를 찾는다.
  for (const group of UI.protocol) {
    const fns = STEP_DONE[group.id];
    assert.ok(fns, `STEP ${group.id} 의 판정이 없습니다`);
    assert.equal(fns.length, group.steps.length,
      `STEP ${group.id} — 절차 ${group.steps.length}칸 · 판정 ${fns.length}개`);
  }
  assert.deepEqual(Object.keys(STEP_DONE).sort(), UI.protocol.map((g) => g.id).sort(),
    '절차에 없는 그룹이 판정표에 있거나 그 반대입니다');
});

/* ---------------- 없는 조작을 「아직」으로 두지 않는가 ---------------- */

test('처음에는 아무 단계도 ✓ 가 아니다', () => {
  // 아무것도 안 했는데 ✓ 가 붙으면, 하지도 않은 일을 했다고 말하는 것이 된다.
  const st = initialState(1);
  for (const group of UI.protocol) {
    group.steps.forEach((step, i) => {
      assert.equal(stepDone(st, group.id, i), false,
        `아무것도 안 했는데 「${step.label}」 이 ✓ 입니다`);
    });
  }
});

test('절차를 다 밟으면 모든 단계가 ✓ 가 된다', () => {
  // 늘 거짓인 판정이 하나라도 있으면 학생은 끝내도 끝나지 않는 목록을 본다.
  const st = play(FULL);
  for (const group of UI.protocol) {
    group.steps.forEach((step, i) => {
      assert.equal(stepDone(st, group.id, i), true,
        `절차를 다 밟았는데 「${step.label}」 이 아직입니다`);
    });
    assert.equal(groupDone(st, group.id), true, `STEP ${group.id} 이 안 끝났습니다`);
  }
});

/* ---------------- 실제로 해야만 붙는가 ---------------- */

test('한쪽 챔버에만 넣으면 「양을 같게」는 아직이다', () => {
  const st = play([...scoop('sprout', 'L'), ...scoop('sprout', 'L')]);
  assert.equal(stepDone(st, '1', 0), true, '발아 콩을 넣었는데 안 붙었습니다');
  assert.equal(stepDone(st, '1', 2), false, '한쪽만 넣었는데 「같게 맞췄다」가 붙었습니다');
});

test('양쪽에 다른 숟갈 수로 넣으면 「양을 같게」는 아직이다', () => {
  const st = play([...scoop('sprout', 'L'), ...scoop('dry', 'R'), ...scoop('dry', 'R')]);
  assert.equal(stepDone(st, '1', 2), false);
});

test('센서를 콩에 파묻으면 「닿지 않게 두기」는 아직이다', () => {
  const base = play(FULL.slice(0, FULL.indexOf(FULL.find((x) => x[0] === 'SEAL'))));
  const buried = reduce(base, { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: 1 } }).state;
  assert.equal(stepDone(base, '3', 2), true, '제대로 꽂았는데 안 붙었습니다');
  assert.equal(stepDone(buried, '3', 2), false, '콩에 닿았는데 ✓ 가 남아 있습니다');
});

test('센서를 안 꽂은 것은 「닿지 않음」이 아니다', () => {
  const st = play([...scoop('sprout', 'L'), ...scoop('dry', 'R')]);
  assert.equal(stepDone(st, '3', 2), false, '안 꽂았는데 「안 닿았다」로 셉니다');
});

test('한 챔버만 밀봉하면 아직이다', () => {
  const st = play([...scoop('sprout', 'L'), ...scoop('dry', 'R'), ['SEAL', { chamber: 'L' }]]);
  assert.equal(stepDone(st, '4', 0), false);
});

test('지켜본 시간이 쌓여야 5단계가 붙는다', () => {
  const upto = (n) => play([...FULL.slice(0, FULL.findIndex((x) => x[0] === 'TICK')), ...ticks(n)]);
  assert.equal(stepDone(upto(2), '5', 0), false);
  assert.equal(stepDone(upto(6), '5', 0), true);
  assert.equal(stepDone(upto(6), '5', 1), false);
  assert.equal(stepDone(upto(16), '5', 1), true);
  assert.equal(stepDone(upto(16), '5', 2), false, '관찰 시간을 안 채웠는데 붙었습니다');
  assert.equal(stepDone(upto(OBSERVE_LIMIT_MIN), '5', 2), true);
});

/* ---------------- 어긋난 기록도 결과로 센다 ---------------- */

test('어긋난 채로 기록해도 5단계 결과는 있는 것으로 센다', () => {
  // 「제대로 된 기록이 있어야 다음으로 간다」로 만들면, 어긋난 결과를 보는 것이
  // 이 실험의 배울 거리인데 그 길을 막는 셈이 된다.
  const off = play([...scoop('sprout', 'L'), ...scoop('dry', 'R'), ...scoop('dry', 'R'), ['RECORD', {}]]);
  assert.equal(resultsDone(off), true);
  assert.equal(hasCleanRecord(off), false, '어긋난 기록이 깨끗한 것으로 셉니다');
  assert.equal(hasCleanRecord(play(FULL)), true);
});

/* ---------------- 도우미 ---------------- */

test('섞인 챔버는 어느 콩의 챔버도 아니다', () => {
  const mixed = play([...scoop('sprout', 'L'), ...scoop('dry', 'L')]);
  assert.equal(chamberWith(mixed, 'sprout'), null, '섞인 챔버를 발아 콩 챔버로 셉니다');
  assert.equal(chamberWith(mixed, 'dry'), null);
});

test('어느 쪽에 무엇을 넣든 찾아진다 — 자리에 뜻을 두지 않는다', () => {
  for (const [a, b] of [['L', 'R'], ['R', 'L']]) {
    const st = play([...scoop('sprout', a), ...scoop('dry', b)]);
    assert.equal(chamberWith(st, 'sprout').id, a);
    assert.equal(chamberWith(st, 'dry').id, b);
  }
});

test('가득 채워도 판정이 무너지지 않는다', () => {
  const st = play(Array.from({ length: MAX_SCOOPS + 2 }, () => scoop('sprout', 'L')).flat());
  assert.equal(CHAMBERS.length, 2);
  assert.equal(stepDone(st, '1', 0), true);
  assert.equal(stepDone(st, '1', 2), false, '한쪽만 가득 찼는데 「같게」가 붙었습니다');
});
