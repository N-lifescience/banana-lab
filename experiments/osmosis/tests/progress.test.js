/**
 * "실제로 했는가" 판정이 절차와 어긋나지 않는가.
 *
 * 이 표가 절차보다 짧거나 길면 화면이 엉뚱한 칸에 표시를 단다. 그런데 그건 브라우저를
 * 띄워야만 보이고, 띄워도 잘 안 보인다 — 스무 칸 중 한 칸이 밀린 것을 눈으로 잡기는 어렵다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STEP_DONE, stepDone, groupDone, resultsDone,
  capturedSolutions, deplasmolysisCapture, triedInnerSide,
} from '../src/sim/progress.js';
import * as progress from '../src/sim/progress.js';
import { reduce } from '../src/sim/rules.js';
import { initialState, SIDES, settled, SLIDE_IDS } from '../src/sim/state.js';
import { EXCHANGE_PER_WICK } from '../src/sim/osmosis.js';
import { UI } from '../src/ui/strings.js';

const run = (s, type, payload = {}) => reduce(s, { type, payload });

function tickUntilSettled(state) {
  for (let i = 0; i < 40; i++) {
    if (SLIDE_IDS.every((id) => settled(state.slides[id]))) return state;
    state = run(state, 'TICK', { seconds: 1, speed: 10 }).state;
  }
  throw new Error('삼투가 평형에 닿지 않았습니다');
}

function exchangeTo(state, slide, solution) {
  let s = run(state, 'RINSE_DROPPER').state;
  s = run(s, 'FILL_DROPPER', { solution }).state;
  s = run(s, 'APPLY_SOLUTION', { slide }).state;
  for (let i = 0; i < Math.ceil(1 / EXCHANGE_PER_WICK); i++) s = run(s, 'WICK', { slide }).state;
  return tickUntilSettled(s);
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
  for (const g of UI.protocol) {
    for (let i = 0; i < g.steps.length; i++) {
      assert.equal(stepDone(st, g.id, i), false, `STEP ${g.id}-${i} (${g.steps[i].label})`);
    }
    assert.equal(groupDone(st, g.id), false, `STEP ${g.id}`);
  }
  assert.equal(resultsDone(st), false);
});

test('맨 처음 증류수 봉입이 「되돌리기」 로 잡히지 않는다', () => {
  // 설탕 용액을 쓰기 **전**의 증류수까지 여기에 걸리면, 아무것도 안 해도 6단계가 끝난 것이 된다.
  let s = initialState(1, 4242);
  s = run(s, 'CUT_SCALE').state;
  s = run(s, 'PEEL_EPIDERMIS', { side: SIDES.OUTER }).state;
  s = run(s, 'PLACE_SAMPLE', { slide: 'A' }).state;
  s = run(s, 'FILL_DROPPER', { solution: 'WATER' }).state;
  s = run(s, 'DROP', { slide: 'A', count: 2 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'A', angleDeg: 45 }).state;
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = tickUntilSettled(s);
  s = run(s, 'CAPTURE').state;

  assert.equal(deplasmolysisCapture(s), null);
  assert.equal(groupDone(s, '6'), false, '설탕 용액을 쓰기 전에는 되돌릴 것이 없다');
});

test('절차를 끝까지 밟으면 여섯 단계가 모두 끝난 것으로 판정된다', () => {
  let s = initialState(1, 4242);
  const go = (t, p) => { s = run(s, t, p).state; };

  go('CUT_SCALE');
  go('PEEL_EPIDERMIS', { side: SIDES.OUTER, thickness: 0.28 });
  go('PLACE_SAMPLE', { slide: 'A' });
  go('FILL_DROPPER', { solution: 'WATER' });
  go('DROP', { slide: 'A', count: 2 });
  go('PICK_COVERSLIP');
  go('PLACE_COVERSLIP', { slide: 'A', angleDeg: 45 });

  go('MOUNT', { slide: 'A' });
  go('SET_DIAPHRAGM', { value: 0.7 });
  go('COARSE_FOCUS', { delta: 0 });
  go('SET_OBJECTIVE', { objective: 10 });
  s = tickUntilSettled(s);
  go('CAPTURE');

  for (const sol of ['S05', 'S10', 'S15', 'S20']) {
    s = exchangeTo(s, 'A', sol);
    go('CAPTURE');
  }
  s = exchangeTo(s, 'A', 'WATER');
  go('CAPTURE');

  for (const g of UI.protocol) {
    const left = g.steps
      .map((step, i) => (stepDone(s, g.id, i) ? null : step.label))
      .filter(Boolean);
    assert.deepEqual(left, [], `STEP ${g.id} 에서 아직 안 한 것으로 잡힙니다`);
  }
  assert.equal(resultsDone(s), true);
  assert.deepEqual([...capturedSolutions(s)].sort(), ['S05', 'S10', 'S15', 'S20', 'WATER']);
});

test('농도열이 덜 차면 결과가 갖춰지지 않은 것으로 본다', () => {
  // 받침 유리 개수로 판정하면 안 된다 — 셋은 처리군이 아니라 여벌이다.
  let s = initialState(1, 4242);
  s = run(s, 'CUT_SCALE').state;
  s = run(s, 'PEEL_EPIDERMIS', { side: SIDES.OUTER }).state;
  s = run(s, 'PLACE_SAMPLE', { slide: 'A' }).state;
  s = run(s, 'FILL_DROPPER', { solution: 'WATER' }).state;
  s = run(s, 'DROP', { slide: 'A', count: 2 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'A', angleDeg: 45 }).state;
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = tickUntilSettled(s);
  for (let i = 0; i < 5; i++) s = run(s, 'CAPTURE').state;   // 같은 증류수만 다섯 장
  assert.equal(resultsDone(s), false);
});

test('안쪽 표피를 올려 본 적이 있으면 그것이 남는다', () => {
  let s = initialState(1);
  assert.equal(triedInnerSide(s), false);
  s = run(s, 'CUT_SCALE').state;
  s = run(s, 'PEEL_EPIDERMIS', { side: SIDES.INNER }).state;
  s = run(s, 'PLACE_SAMPLE', { slide: 'B' }).state;
  assert.equal(triedInnerSide(s), true);
});

test('판정은 표시일 뿐 잠금이 아니다', () => {
  // 아무 단계도 안 했는데 노트를 먼저 채워도 막히지 않아야 한다 (AGENTS.md §2.1).
  let s = initialState(1);
  const r = run(s, 'SAVE_NOTE', { step: '5a', text: '먼저 적어 둔 것' });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.session.notes['5a'], '먼저 적어 둔 것');
  assert.equal(stepDone(r.state, '5', 0), false, '적었다고 한 것이 되지는 않는다');
});

/* ------------------------------------------------------------------ */
/* 정리·안전 — **판정 자체를 걷어냈다**                                  */
/* ------------------------------------------------------------------ */

/*
 * 한때 손 씻기·마개 닫기·폐액 버리기를 지켜보고 자기 평가에 ✓/✗ 를 달았다. 두 가지가 틀렸다.
 *
 * 하나는 **거짓말을 했다** — 판정을 채우는 `CHECK_TIDY` 가 「보고서 열기」를 누를 때만 도는데
 * 자기 평가 쪽은 그 전에 보므로, 아무것도 안 한 학생에게 「세 가지를 모두 지켰습니다」가 떴다.
 * 선생님이 플레이해서 찾으셨다.
 *
 * 다른 하나가 더 크다 — 가상 실험에서 그걸 따지면 **화면 속 단추를 눌렀다는 사실**을
 * 평가하게 된다. 안전 습관이 아니라 조작 순서 외우기다. 진짜 마개는 교실에서 닫는다.
 * 그래서 판정을 통째로 걷고 **판정하지 않는 안내**만 남겼다.
 */
test('정리·안전을 판정하는 함수가 없다', () => {
  for (const name of ['tidyStatus', 'tidyWatchlist', 'tidyMissedNow', 'TIDY_KINDS']) {
    assert.equal(progress[name], undefined, `${name} 가 되살아났습니다`);
  }
});

test('판정 대신 안내가 있다', () => {
  const n = UI.notebook;
  assert.ok(Array.isArray(n.valuesList) && n.valuesList.length >= 3,
    '안전 안내 문장이 없습니다');
  assert.equal(n.valuesWatched, undefined, '지켜보는 항목 목록이 남아 있습니다');
  assert.equal(n.noViolations, undefined, '「모두 지켰습니다」가 남아 있습니다');
  // **앱이 확인하지 않는다는 것을 밝혀야 한다.** 안 밝히면 학생이 어딘가 채점되는 줄 안다.
  assert.match(n.valuesLead, /확인하지 않습니다/, '판정하지 않는다는 말이 없습니다');
  // 안전 목록이 **한 벌뿐이어야** 한다. 두 곳에 두면 언젠가 둘이 다른 말을 한다.
  assert.equal(n.safetyNotes, undefined, '옛 안전 목록이 따로 남아 있습니다');
});

test('안내가 이 실험의 것이다 — 베껴 온 시약 문구가 아니다', () => {
  const all = UI.notebook.valuesList.join(' ');
  // 삼투 실험에서 위험한 것은 시약이 아니라 유리 기구와 칼이다. 설탕 용액은 마셔도 된다.
  assert.match(all, /유리/, '유리 기구 이야기가 없습니다');
  assert.match(all, /해부칼|칼/, '칼 이야기가 없습니다');
});
