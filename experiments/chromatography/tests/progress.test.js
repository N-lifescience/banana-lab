/**
 * "실제로 했는가" 판정이 절차와 어긋나지 않는가.
 *
 * 이 표가 절차보다 짧거나 길면 화면이 엉뚱한 칸에 표시를 단다. 그런데 그건 브라우저를
 * 띄워야만 보이고, 띄워도 잘 안 보인다 — 열몇 칸 중 한 칸이 밀린 것을 눈으로 잡기는 어렵다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP_DONE, stepDone, groupDone, resultsDone, didAction, countAction } from '../src/sim/progress.js';
import { reduce } from '../src/sim/rules.js';
import { initialState, MARKERS, LEAF_KINDS, currentFrontMm } from '../src/sim/state.js';
import { ORIGIN_MM, PAPER_H_MM } from '../src/sim/develop.js';
import { UI } from '../src/ui/strings.js';
import { benchLocked } from '../src/ui/notebook.js';

const run = (s, type, payload = {}) => reduce(s, { type, payload });

/** 절차를 처음부터 끝까지 밟는다. 이 순서가 곧 `UI.protocol` 의 순서다. */
function fullRun() {
  let s = initialState(1);
  const go = (t, p) => { s = run(s, t, p).state; };

  go('ADD_LEAF', { kind: LEAF_KINDS.FRESH, amount: 0.5 });
  go('ADD_EXTRACT', { amount: 0.5 });
  for (let i = 0; i < 5; i++) go('SHAKE', { amount: 0.2 });
  for (let i = 0; i < 12; i++) go('TICK', { seconds: 1 });

  go('DRAW_ORIGIN', { heightMm: ORIGIN_MM, marker: MARKERS.PENCIL });
  go('LOAD_CAPILLARY');
  for (let i = 0; i < 15; i++) { go('SPOT', { dwell: 0.2 }); go('DRY_SPOT'); }

  go('POUR_SOLVENT', { mm: 5 });
  go('INSERT_PAPER');
  go('CAP_VIAL');
  for (let i = 0; i < 400 && currentFrontMm(s.paper) < PAPER_H_MM * 0.9; i++) go('TICK', { seconds: 1 });
  go('UNCAP_VIAL');
  go('REMOVE_PAPER');
  go('MARK_FRONT');
  go('DRY_PAPER');
  go('MARK_BANDS');
  go('MEASURE');
  go('CAPTURE');
  return s;
}

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
  const s = fullRun();
  for (const g of UI.protocol) {
    const left = g.steps
      .map((step, i) => (stepDone(s, g.id, i) ? null : step.label))
      .filter(Boolean);
    assert.deepEqual(left, [], `STEP ${g.id} 에서 아직 안 한 것으로 잡힙니다`);
  }
  assert.equal(resultsDone(s), true);
});

/**
 * 거름종이는 한 장이고, 새것을 꺼내면 종이의 상태가 통째로 처음으로 돌아간다.
 * 그때 "원점을 그었다" 가 아직으로 바뀌면 안 된다 — 학생은 분명히 그었다.
 * 물음은 "지금 그렇게 되어 있는가" 가 아니라 **"해 봤는가"** 다.
 */
test('새 거름종이를 꺼내도 해 본 단계가 아직으로 되돌아가지 않는다', () => {
  let s = fullRun();
  const before = Object.keys(STEP_DONE).filter((g) => groupDone(s, g));
  s = run(s, 'NEW_PAPER').state;
  const after = Object.keys(STEP_DONE).filter((g) => groupDone(s, g));
  assert.deepEqual(after, before, '새 종이를 꺼내자 해 본 단계가 사라졌습니다');
});

test('막힌 조작은 한 것으로 세지 않는다', () => {
  let s = initialState(1);
  s = run(s, 'DRAW_ORIGIN', {}).state;
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'CAP_VIAL').state;
  const r = run(s, 'INSERT_PAPER');       // 뚜껑이 닫혀 있어 막힌다
  assert.equal(r.outcome, 'blocked');
  assert.equal(didAction(r.state, 'INSERT_PAPER'), false);
});

test('찍은 횟수는 절차의 "10~20회" 를 기준으로 본다', () => {
  let s = initialState(1);
  s = run(s, 'ADD_LEAF', {}).state;
  s = run(s, 'ADD_EXTRACT', {}).state;
  for (let i = 0; i < 5; i++) s = run(s, 'SHAKE', { amount: 0.2 }).state;
  for (let i = 0; i < 12; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  s = run(s, 'DRAW_ORIGIN', {}).state;
  s = run(s, 'LOAD_CAPILLARY').state;
  for (let i = 0; i < 9; i++) { s = run(s, 'SPOT', { dwell: 0.2 }).state; s = run(s, 'DRY_SPOT').state; }
  assert.equal(countAction(s, 'SPOT'), 9);
  assert.equal(stepDone(s, '4', 1), false, '아홉 번은 아직입니다');
  s = run(s, 'SPOT', { dwell: 0.2 }).state;
  assert.equal(stepDone(s, '4', 1), true, '열 번이면 한 것으로 봅니다');
});

/**
 * **진행은 뒤로 가지 않는다 — 그리고 그것이 STEP 자물쇠를 떠받치고 있다.**
 *
 * 자물쇠는 「지금 자리(`nowIdx`)보다 뒤엣것」을 잠근다. 그러니 지금 자리가 **뒤로 밀리면**
 * 이미 저절로 열려서 학생이 보고 있던 STEP 이 잠길 자리가 된다 — 봤던 것이 사라진다.
 * 다른 저장소에서는 실제로 그 일이 났고, 그래서 「한 번이라도 펼쳐진 것」을 따로 기억한다
 * (`everOpened`, notebook.js).
 *
 * **여기서는 그 일이 안 난다.** 진행이 `didAction` — 즉 **로그**를 보고, 로그는 되돌리기로
 * 지워지지 않기 때문이다 (rules.js: 「되돌리면 직전 상태로 돌아가고, 로그는 되돌리지 않는다」).
 * 그 성질이 깨지면 자물쇠 쪽을 다시 봐야 하므로 여기서 못 박아 둔다.
 *
 * 재어 보고 적는다: `everOpened` 를 담는 그리는 쪽 줄을 빼도 지금은 검사가 하나도 안 물었다.
 * **물지도 못할 검사를 늘리는 대신 물릴 수 있는 것을 잰다.**
 */
test('되돌려도 탐구 과정의 진행은 뒤로 가지 않는다', () => {
  let st = initialState(1);
  const go = (type, payload = {}) => { st = reduce(st, { type, payload }).state; };

  go('ADD_LEAF');
  assert.equal(groupDone(st, '1'), true, 'STEP 1 이 끝난 것으로 잡히지 않습니다');
  const leafBefore = st.tube.leaf;

  go('UNDO');
  assert.equal(st.tube.leaf < leafBefore, true, '되돌리기가 실험대를 안 되돌렸습니다');
  assert.equal(groupDone(st, '1'), true,
    '되돌리기로 STEP 진행이 뒤로 갔습니다 — 이러면 이미 열려 있던 STEP 이 잠길 자리가 됩니다. '
    + 'notebook.js 의 everOpened 를 다시 보세요');
});

/*
 * **노트와 실험대가 서로를 가리키는 자리가 있었다.**
 *
 * 4쪽에 막 들어온 학생은 그 쪽을 아직 「읽었습니다」로 넘기지 않았으므로 실험대가 잠겨 있다.
 * 그때 STEP 1 은 「실험대에서 먼저 해 보세요」라 하고 실험대는 「먼저 탐구 노트를 읽으세요」라
 * 했다 — **막다른 길**이고, 빠져나갈 단추는 화면 밖이었다(폰에서 600px 아래).
 *
 * 자물쇠의 주인은 `UI.bench.lock.required` 하나다. 여기에 쪽 번호를 다시 적으면
 * 그 목록이 바뀔 때 노트만 옛말을 한다 — 그래서 **목록에서 끌어와** 검사한다.
 */
test('실험대 잠김 판정은 읽어야 할 쪽 목록 하나만 본다', () => {
  const required = UI.bench.lock.required;
  assert.ok(required.length > 0, '읽어야 할 쪽이 하나도 없으면 이 검사가 헛돈다');

  let s = initialState(1);
  assert.equal(benchLocked(s), true, '아무것도 안 읽었으면 잠겨 있다');

  // 마지막 하나를 남기면 아직 잠겨 있어야 한다 — 「거의 다」는 열림이 아니다.
  for (const id of required.slice(0, -1)) s = run(s, 'MARK_READ', { stage: id }).state;
  assert.equal(benchLocked(s), true, `${required.length - 1}쪽만 읽었는데 열렸다`);

  s = run(s, 'MARK_READ', { stage: required.at(-1) }).state;
  assert.equal(benchLocked(s), false, '다 읽었는데 안 열렸다');
});

test('잠겼을 때의 안내는 어디를 눌러야 하는지까지 말한다', () => {
  const N = UI.notebook;
  assert.ok(N.stepNotYetLocked, '잠겼을 때 쓸 문장이 없다');
  assert.notEqual(N.stepNotYetLocked, N.stepNotYet, '잠겼을 때와 아닐 때가 같은 말이면 고친 것이 없다');
  // **빠져나갈 길이 문장 안에 있어야 한다** (AGENTS.md §2.1).
  // 단추 글자를 여기에 손으로 적지 않는다 — 단추 이름이 바뀌면 안내만 옛말이 된다.
  assert.ok(N.stepNotYetLocked.includes(N.readConfirm),
    `안내가 단추(「${N.readConfirm}」)를 가리키지 않는다: ${N.stepNotYetLocked}`);
});
