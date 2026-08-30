/**
 * 탐구 과정의 각 세부 단계를 **실제로 했는가.**
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 탐구 노트 4단계는 읽고 칸을 채우는 곳이었다. 그런데 칸은 실험대에 손도 대지 않고 채울 수
 * 있다. 그러면 노트는 관찰 기록이 아니라 받아쓰기가 되고, 실험대와 노트가 따로 논다.
 *
 * ── 막지 않는다 ────────────────────────────────────────────────────
 * 안 한 단계의 칸도 그대로 열려 있다. 여기서 나오는 것은 **표시**이지 잠금이 아니다
 * (AGENTS.md §2.1). 순서를 바꿔 하거나 먼저 적어 두는 것을 금지할 이유가 없다.
 *
 * ── 왜 로그를 보는가 ───────────────────────────────────────────────
 * 이 실험은 거름종이가 **한 장**이고, 새것을 꺼내면 종이의 상태가 통째로 처음으로 돌아간다.
 * 상태만 보면 새 종이를 꺼내는 순간 "원점을 그었다" 가 아직으로 바뀌는데, 학생은 분명히
 * 그었다. 물음이 "지금 그렇게 되어 있는가" 가 아니라 **"해 봤는가"** 이므로 로그를 본다.
 * 상태로 봐야 맞는 것(층이 갈렸는가)은 상태로 본다.
 *
 * ── 왜 sim 에 있는가 ───────────────────────────────────────────────
 * DOM 을 모르는 순수 함수라 `node --test` 로 검증된다. 화면 안에 두면 이 판정이 맞는지
 * 브라우저를 띄워야만 알 수 있다.
 */

import { isSettled } from './state.js';

/** 그 액션을 뜻대로 해낸 적이 있는가. 막힌 것(blocked)은 한 것으로 세지 않는다. */
export function didAction(st, type) {
  return st.session.log.some((l) => l.action === type && l.outcome !== 'blocked');
}

/** 그 액션을 몇 번 했는가 */
export function countAction(st, type) {
  return st.session.log.filter((l) => l.action === type && l.outcome !== 'blocked').length;
}

/**
 * `UI.protocol` 의 순서와 **한 칸씩 짝**을 이룬다. 그룹 id → 판정 함수 배열.
 * 절차를 고치면 여기도 함께 고쳐야 한다 — `tests/progress.test.js` 가 개수를 맞춰 본다.
 */
export const STEP_DONE = {
  // 1. 시료 준비
  '1': [
    (st) => didAction(st, 'ADD_LEAF'),
  ],
  // 2. 색소 추출
  '2': [
    (st) => didAction(st, 'ADD_EXTRACT'),
    (st) => didAction(st, 'SHAKE'),
    (st) => isSettled(st.tube) || st.session.captures.length > 0,
  ],
  // 3. 원점 긋기
  '3': [
    (st) => didAction(st, 'DRAW_ORIGIN'),
  ],
  // 4. 점 찍기
  '4': [
    (st) => didAction(st, 'LOAD_CAPILLARY'),
    // 절차가 "10~20회" 라고 적힌 자리. 열 번을 넘겼는가로 본다.
    (st) => countAction(st, 'SPOT') >= 10,
  ],
  // 5. 전개
  '5': [
    (st) => didAction(st, 'POUR_SOLVENT'),
    (st) => didAction(st, 'INSERT_PAPER'),
    (st) => didAction(st, 'CAP_VIAL'),
  ],
  // 6. 꺼내기
  '6': [
    (st) => didAction(st, 'REMOVE_PAPER'),
    (st) => didAction(st, 'MARK_FRONT'),
  ],
  // 7. 재기
  '7': [
    (st) => didAction(st, 'MARK_BANDS'),
    (st) => didAction(st, 'MEASURE'),
    (st) => st.session.captures.length > 0,
  ],
};

/** 세부 단계 하나를 했는가. 표에 없는 자리는 판정하지 않는다(=아직). */
export function stepDone(st, groupId, index) {
  return Boolean(STEP_DONE[groupId]?.[index]?.(st));
}

/** 그룹 하나를 다 했는가. */
export function groupDone(st, groupId) {
  const fns = STEP_DONE[groupId];
  return Boolean(fns?.length) && fns.every((f) => f(st));
}

/** 결과를 한 번이라도 기록했는가 — 탐구 노트 5단계가 끝났다는 뜻이다. */
export function resultsDone(st) {
  return st.session.captures.length > 0;
}
