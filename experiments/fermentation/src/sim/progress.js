/**
 * 탐구 과정의 각 세부 단계를 **실제로 했는가.**
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 탐구 노트 4단계는 읽고 칸을 채우는 곳이다. 그런데 칸은 실험대에 손도 대지 않고 채울 수 있다.
 * 그러면 노트는 관찰 기록이 아니라 **받아쓰기**가 되고, 실험대와 노트가 따로 논다.
 *
 * 여기서는 **상태만 보고** 각 단계가 실제로 일어났는지 판정한다. 화면은 이 값을 읽어
 * 「했다/아직」을 표시하고, 다음에 무엇을 적으면 되는지 짚어 준다.
 *
 * ── 막지 않는다 ────────────────────────────────────────────────────
 * 안 한 단계의 칸도 그대로 열려 있다. 여기서 나오는 것은 **표시**이지 잠금이 아니다
 * (AGENTS.md §2.1). 순서를 바꿔 하거나 먼저 적어 두는 것을 금지할 이유가 없다.
 *
 * ── 왜 sim 에 있는가 ───────────────────────────────────────────────
 * DOM 을 모르는 순수 함수라 `node --test` 로 검증된다. 화면 안에 두면 이 판정이 맞는지
 * 브라우저를 띄워야만 알 수 있다.
 */

import { defaultControls, VARIABLE_KEY } from './state.js';

/** 로그에 그 액션이 한 번이라도 있었는가. 되돌려도 로그는 남으므로 「한 적 있다」가 맞다. */
const did = (st, action) => st.session.log.some((l) => l.action === action);

/** 기록한 시행 중에 그런 것이 있었는가. */
const everTrial = (st, fn) => st.trials.some(fn);

/**
 * `UI.protocol` 의 순서와 **한 칸씩 짝**을 이룬다. 그룹 id → 판정 함수 배열.
 * 절차를 고치면 여기도 함께 고쳐야 한다 — `tests/progress.test.js` 가 개수를 맞춰 본다.
 */
export const STEP_DONE = {
  // 1. 실험 설계하기
  '1': [
    (st) => st.design.independent !== null,
    // 통제변인을 「정했다」를 어떻게 아나 — 기본값에서 벗어났거나, 설계를 확정했거나.
    // 기본값 그대로 두는 것도 정한 것이므로 `declared` 를 함께 본다.
    (st) => st.design.declared
      || Object.entries(defaultControls()).some(([k, v]) => st.design.controls[k] !== v),
  ],
  // 2. 용액 준비하기
  '2': [
    // 희석해 본 적이 있는가. 10 % 만 쓰는 설계에서도 한 번은 해 보게 둔다 —
    // 「같은 부피를 더하면 농도가 절반」이 이 실험에서 배울 것 중 하나다.
    // **표시일 뿐 잠금이 아니다** — 안 해도 실험은 그대로 된다.
    (st) => did(st, 'ADD_TO_MIX'),
    (st) => did(st, 'POUR_GLUCOSE') || did(st, 'POUR_MIX') || did(st, 'POUR_WATER'),
    (st) => did(st, 'POUR_YEAST') || everTrial(st, (t) => t.conditions.yeastMl > 0),
  ],
  // 3. 산소 차단하고 항온기에 넣기
  '3': [
    (st) => did(st, 'PLUG_TUBE') || everTrial(st, (t) => t.conditions.plugged),
    (st) => did(st, 'PUT_IN_INCUBATOR'),
  ],
  // 4. 시간 경과 관찰하고 기록하기
  '4': [
    // 「지켜봤는가」는 시간이 흘렀는가로 본다. 넣자마자 기록하면 지켜본 것이 아니다.
    (st) => st.bench.tube.elapsedMin > 0 || st.trials.length > 0,
    (st) => st.trials.length > 0,
    // 이산화 탄소 확인은 **한 번이라도** 했으면 된다. 시행마다 하게 하면 절차가 늘어지고,
    // 실제 수업에서도 대표 발효관 하나로 확인한다.
    (st) => did(st, 'ADD_KOH') || everTrial(st, (t) => t.kohChecked),
  ],
  // 5. 조건을 바꿔 되풀이하기
  '5': [
    (st) => did(st, 'EMPTY_TUBE'),
    (st) => st.trials.length >= 2,
    // **조건이 실제로 달라야** 되풀이한 것이다 — 같은 조건으로 세 번 재는 것은
    // 되풀이가 아니라 같은 점을 세 번 찍는 것이다.
    (st) => distinctConditions(st) >= 3,
  ],
};

/** 조작변인 값이 서로 다른 시행이 몇 가지인가. */
export function distinctConditions(st) {
  const key = VARIABLE_KEY[st.design.independent];
  if (!key) return 0;
  return new Set(st.trials.map((t) => t.conditions[key])).size;
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

/**
 * 결과를 견줄 수 있을 만큼 쟀는가 — 탐구 노트 5단계가 끝났다는 뜻이다.
 *
 * **두 번**이 기준이다. 한 점으로는 「조건이 달라지면 달라진다」를 말할 수 없다.
 * 셋 이상이 절차이지만 그것은 권하는 것이고, 여기서 막지 않는다.
 */
export function resultsDone(st) {
  return st.trials.length >= 2;
}
