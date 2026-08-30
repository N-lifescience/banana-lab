/**
 * 탐구 과정의 각 세부 단계를 **실제로 했는가.**
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 탐구 노트 4단계는 읽고 칸을 채우는 곳이었다. 그런데 칸은 실험대에 손도 대지 않고 채울 수
 * 있다. 그러면 노트는 관찰 기록이 아니라 받아쓰기가 되고, 실험대와 노트가 따로 논다.
 *
 * 여기서는 **상태만 보고** 각 단계가 실제로 일어났는지 판정한다. 화면은 이 값을 읽어
 * 「했다/아직」을 표시하고, 다음에 무엇을 적으면 되는지 짚어 준다.
 *
 * ── 막지 않는다 ────────────────────────────────────────────────────
 * 안 한 단계의 칸도 그대로 열려 있다. 여기서 나오는 것은 **표시**이지 잠금이 아니다
 * (AGENTS.md §2.1). 순서를 바꿔 하거나 먼저 적어 두는 것을 금지할 이유가 없다.
 *
 * ── 없는 조작을 「아직」으로 표시하지 않는다 ────────────────────────
 * 늘 참인 판정(「받침 유리를 꺼낸다」처럼 조작이 아예 없는 것)을 두면 학생은 **있지도
 * 않은 단추를 찾는다.** 그래서 이 실험의 세부 단계는 전부 **실제 조작**과 짝을 이룬다.
 */

import { CHAMBERS, BEAN_KINDS, SENSOR, LID, sensorState, comparisonKind, mismatches } from './state.js';
import { OBSERVE_LIMIT_MIN } from './metabolism.js';

/** 두 챔버 모두에서 참인가. */
const both = (st, f) => CHAMBERS.every((id) => f(st.chambers[id]));
/** 한 챔버에서라도 참인가. */
const some = (st, f) => CHAMBERS.some((id) => f(st.chambers[id]));

/** 이 갈래의 콩이 들어 있는 챔버. 섞인 챔버는 어느 쪽도 아니다. */
export function chamberWith(st, kind) {
  return CHAMBERS.map((id) => st.chambers[id]).find((c) => c.beans === kind && !c.mixed) ?? null;
}

/** 두 챔버에서 가장 오래 잰 시간. 「얼마나 지켜봤는가」를 이걸로 본다. */
const watched = (st) => Math.max(...CHAMBERS.map((id) => st.chambers[id].elapsedMin));

/**
 * `UI.protocol` 의 순서와 **한 칸씩 짝**을 이룬다. 그룹 id → 판정 함수 배열.
 * 절차를 고치면 여기도 함께 고쳐야 한다 — `tests/progress.test.js` 가 개수를 맞춰 본다.
 */
export const STEP_DONE = {
  '1': [
    (st) => Boolean(chamberWith(st, BEAN_KINDS.SPROUT)),
    (st) => Boolean(chamberWith(st, BEAN_KINDS.DRY)),
    // 「같게 하기」는 **양쪽에 다 넣고 나서** 볼 수 있다. 아무것도 안 넣었을 때
    // 0 == 0 이라고 ✓ 를 붙이면, 하지도 않은 일을 했다고 말하는 것이 된다.
    (st) => both(st, (c) => c.scoops > 0)
      && st.chambers.L.scoops === st.chambers.R.scoops,
  ],
  '2': [
    (st) => some(st, (c) => c.btb),
    (st) => both(st, (c) => c.btb),
  ],
  '3': [
    (st) => some(st, (c) => c.sensorIn),
    (st) => both(st, (c) => c.sensorIn),
    // 둘 다 꽂혀 있고 둘 다 안 닿아야 한다. 안 꽂은 것은 「안 닿음」이 아니다.
    (st) => both(st, (c) => sensorState(c) === SENSOR.CLEAR),
  ],
  '4': [
    (st) => both(st, (c) => c.lid === LID.SEALED),
    (st) => both(st, (c) => c.running || c.elapsedMin > 0),
  ],
  '5': [
    (st) => watched(st) >= 5,
    (st) => watched(st) >= 15,
    (st) => CHAMBERS.some((id) => st.chambers[id].finished),
  ],
  // 「실험대 정리하기」가 있었다. 손 씻기·마개 닫기·폐액 버리기를 조작으로 두고 지켰는지
  // 세던 것인데, 그러면 평가되는 것이 안전 습관이 아니라 **화면 속 단추를 눌렀다는
  // 사실**이다. 세는 것을 걷어내면서 이 칸도 함께 뺐다 — 판정할 조작이 없어졌다.
  // 실제 실험에서 해야 하는 정리는 7단계에 **가만히 적힌 안내**로 남아 있다.
  '6': [
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

/**
 * 결과를 한 번이라도 기록했는가 — 탐구 노트 5단계가 끝났다는 뜻이다.
 *
 * **어긋난 기록도 센다.** 어긋난 채로 잰 결과를 보는 것이 이 실험이 가르치려는 것이라,
 * 「제대로 된 기록이 있어야 다음으로 간다」로 만들면 그 배울 거리를 막는 셈이 된다.
 */
export function resultsDone(st) {
  return st.session.captures.length > 0;
}

/**
 * 대조가 성립한 기록이 하나라도 있는가.
 *
 * **막는 데 쓰지 않는다.** 6단계 정리에서 「지금까지 어땠는가」를 말해 줄 때만 쓴다.
 */
export function hasCleanRecord(st) {
  return st.session.captures.some((c) => c.comparison === 'ok');
}

/** 지금 기록해 두면 대조가 성립하는가. 실험대가 아니라 노트가 읽는다. */
export function comparisonNow(st) {
  return { kind: comparisonKind(st), mismatched: mismatches(st) };
}
