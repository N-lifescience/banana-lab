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
 * 이 실험은 모세관이 **한 개**이고, 새것을 꺼내면 상태가 통째로 처음으로 돌아간다.
 * 상태만 보면 새 모세관을 꺼내는 순간 "밀봉했다" 가 아직으로 바뀌는데, 학생은 분명히
 * 막았다. 물음이 "지금 그렇게 되어 있는가" 가 아니라 **"해 봤는가"** 이므로 로그를 본다.
 * 상태로 봐야 맞는 것(균형이 맞아 있는가·층이 갈렸는가)은 상태로 본다.
 *
 * ── 왜 sim 에 있는가 ───────────────────────────────────────────────
 * DOM 을 모르는 순수 함수라 `node --test` 로 검증된다. 화면 안에 두면 이 판정이 맞는지
 * 브라우저를 띄워야만 알 수 있다.
 */

import { separation, imbalanceOf } from './state.js';

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
  // 1. 준비
  '1': [
    (st) => didAction(st, 'SWAB_FINGER'),
    (st) => didAction(st, 'PICK_CAPILLARY') || st.tools.tubesUsed > 0,
  ],
  // 2. 채혈
  '2': [
    (st) => didAction(st, 'PRICK_FINGER'),
  ],
  // 3. 빨아올리기
  '3': [
    (st) => didAction(st, 'DRAW_BLOOD'),
    // 기둥이 잴 만큼 찼는가. **몇 번 빨아올렸는지가 아니라 얼마나 찼는지**로 본다 —
    // 한 번에 길게 댄 학생과 나눠 댄 학생을 갈라 세면 안 된다.
    (st) => st.tube.fill >= 0.5,
  ],
  // 4. 밀봉
  '4': [
    (st) => didAction(st, 'SEAL_END'),
    (st) => st.tube.seal.outer > 0 && st.tube.seal.inner > 0,
  ],
  // 5. 회전판에 물리기
  '5': [
    (st) => didAction(st, 'LOAD_ROTOR'),
    // 균형을 맞췄는가. 「했는가」가 아니라 「맞아 있는가」다 — 이건 상태로 봐야 맞다.
    (st) => Boolean(st.rotor.slots.A && st.rotor.slots.B) && imbalanceOf(st.rotor) < 0.25,
  ],
  // 6. 당기기
  '6': [
    (st) => didAction(st, 'PULL'),
    // **당김 횟수를 기준으로 삼지 않는다.** 그 수는 [확인 필요] 다.
    // 물음은 "몇 번 당겼는가" 가 아니라 **"층이 갈렸는가"** 다.
    (st) => separation(st.tube) >= 0.5,
  ],
  // 7. 재기와 기록
  '7': [
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
