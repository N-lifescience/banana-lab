/**
 * 탐구 과정의 각 세부 단계를 **실제로 했는가.**
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 탐구 노트 4단계는 읽고 칸을 채우는 곳이었다. 그런데 칸은 실험대에 손도 대지 않고 채울 수
 * 있다. 그러면 노트는 관찰 기록이 아니라 받아쓰기가 되고, 실험대와 노트가 따로 논다.
 *
 * 여기서는 **상태만 보고** 각 단계가 실제로 일어났는지 판정한다. 화면은 이 값을 읽어
 * "했다/아직" 을 표시하고, 다음에 무엇을 적으면 되는지 짚어 준다.
 *
 * ── 막지 않는다 ────────────────────────────────────────────────────
 * 안 한 단계의 칸도 그대로 열려 있다. 여기서 나오는 것은 **표시**이지 잠금이 아니다
 * (AGENTS.md §2.1). 순서를 바꿔 하거나 먼저 적어 두는 것을 금지할 이유가 없다.
 *
 * ── 왜 sim 에 있는가 ───────────────────────────────────────────────
 * DOM 을 모르는 순수 함수라 `node --test` 로 검증된다. 화면 안에 두면 이 판정이 맞는지
 * 브라우저를 띄워야만 알 수 있다.
 */

import { SLIDE_IDS, initialState } from './state.js';

/** 조리개를 "움직였는가" 는 상태에 따로 없다. 처음 값에서 벗어났는지로 본다. */
const DEFAULT_DIAPHRAGM = initialState().microscope.diaphragm;

const reacted = (s) => s.reactionT >= 0.99;
const everAt40 = (st) => st.microscope.objective === 40
  || st.session.captures.some((c) => c.objective === 40);

/**
 * `UI.protocol` 의 순서와 **한 칸씩 짝**을 이룬다. 그룹 id → 판정 함수 배열.
 * 절차를 고치면 여기도 함께 고쳐야 한다 — `tests/progress.test.js` 가 개수를 맞춰 본다.
 */
export const STEP_DONE = {
  '1': [
    (st) => st.tools.banana.peeled,
    // 받침 유리는 처음부터 선반에 나와 있다. 꺼내는 조작이 따로 없으므로 늘 참이다 —
    // 없는 조작을 "아직" 으로 표시하면 학생은 있지도 않은 단추를 찾는다.
    () => true,
  ],
  '2': [
    (st) => st.slides.A.sample !== null,
    (st) => st.slides.B.sample !== null,
    (st) => st.slides.C.sample !== null,
    (st) => st.slides.A.drops > 0,
  ],
  '3': [
    (st) => st.tools.dropper.holds === 'IKI' || st.slides.B.stain === 'IKI',
    (st) => st.slides.B.drops >= 2,
    (st) => st.slides.B.stain === 'IKI' && reacted(st.slides.B),
    // 씻었다는 것은 "아이오딘을 더는 들고 있지 않다" 로 드러난다.
    (st) => st.slides.B.drops > 0 && st.tools.dropper.holds !== 'IKI',
  ],
  '4': [
    (st) => st.tools.dropper.holds === 'SUDAN3' || st.slides.C.stain === 'SUDAN3',
    (st) => st.slides.C.drops >= 2,
    (st) => st.slides.C.stain === 'SUDAN3' && reacted(st.slides.C),
  ],
  '5': SLIDE_IDS.map((id) => (st) => st.slides[id].coverslip.placed),
  '6': [
    (st) => st.microscope.lowMagFocused,
    everAt40,
    (st) => Math.abs(st.microscope.diaphragm - DEFAULT_DIAPHRAGM) > 0.02,
    (st) => capturedSlides(st).size >= SLIDE_IDS.length,
  ],
};

/** 결과를 기록한 받침 유리들. 같은 유리를 여러 장 찍어도 하나로 센다. */
export function capturedSlides(st) {
  return new Set(st.session.captures.map((c) => c.slide));
}

/** 세부 단계 하나를 했는가. 표에 없는 자리는 판정하지 않는다(=아직). */
export function stepDone(st, groupId, index) {
  return Boolean(STEP_DONE[groupId]?.[index]?.(st));
}

/** 그룹 하나를 다 했는가. */
export function groupDone(st, groupId) {
  const fns = STEP_DONE[groupId];
  return Boolean(fns?.length) && fns.every((f) => f(st));
}

/** (가)(나)(다) 를 한 번씩 다 기록했는가 — 탐구 노트 5단계가 끝났다는 뜻이다. */
export function resultsDone(st) {
  return SLIDE_IDS.every((id) => capturedSlides(st).has(id));
}
