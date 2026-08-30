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

import { SLIDE_IDS, SIDES } from './state.js';

/** 그 조작을 한 적이 있는가. 흔적이 상태에 남지 않는 조작은 로그로 본다. */
const did = (st, action) => st.session.log.some((l) => l.action === action);

const anySlide = (st, f) => SLIDE_IDS.some((id) => f(st.slides[id]));

/** 이 용액으로 본 시야를 기록한 적이 있는가. */
const capturedWith = (st, solution) =>
  st.session.captures.some((c) => c.solution === solution);

/** 설탕 용액(농도 무관)으로 기록한 캡처들 */
const sugarCaptures = (st) =>
  st.session.captures.filter((c) => c.solution && c.solution !== 'WATER');

/**
 * `UI.protocol` 의 순서와 **한 칸씩 짝**을 이룬다. 그룹 id → 판정 함수 배열.
 * 절차를 고치면 여기도 함께 고쳐야 한다 — `tests/progress.test.js` 가 개수를 맞춰 본다.
 */
export const STEP_DONE = {
  '1': [
    // 칼집은 벗기는 순간 없어진다. 지금 상태로는 볼 수 없으므로 한 적이 있는지로 본다.
    (st) => did(st, 'CUT_SCALE'),
    (st) => Boolean(st.tools.epidermis) || anySlide(st, (s) => s.sample !== null),
    (st) => anySlide(st, (s) => s.sample !== null),
  ],
  '2': [
    (st) => anySlide(st, (s) => s.drops > 0),
    (st) => anySlide(st, (s) => s.coverslip.placed),
  ],
  '3': [
    (st) => st.microscope.stage !== null || st.session.captures.length > 0,
    (st) => st.microscope.lowMagFocused,
    // 이 관찰의 자리는 100배다 (quality.magnificationFactor 참조). 400배도 올린 것으로 친다 —
    // 더 올려 본 것을 "안 했다" 고 표시하면 화면이 틀린 말을 하게 된다.
    (st) => st.microscope.objective >= 10
      || st.session.captures.some((c) => c.objective >= 10),
    (st) => capturedWith(st, 'WATER'),
  ],
  '4': [
    (st) => did(st, 'APPLY_SOLUTION'),
    (st) => did(st, 'WICK'),
    // 치환이 **끝난** 적이 있는가. 한 번만 대면 섞인 채로 남는다.
    (st) => anySlide(st, (s) => s.medium && s.medium.id !== 'WATER')
      || sugarCaptures(st).length > 0,
    // 평형에 닿은 뒤에 기록한 것이 있는가 — 덜 기다리고 본 것과 갈린다.
    (st) => sugarCaptures(st).some((c) => c.settled),
  ],
  '5': ['S05', 'S10', 'S15', 'S20'].map((sol) => (st) => capturedWith(st, sol)),
  '6': [
    // 설탕 용액을 쓴 **뒤에** 증류수로 되돌린 것이라야 원형질 분리 복귀다.
    // 맨 처음 증류수 봉입까지 여기에 걸리면, 아무것도 안 해도 끝난 것으로 표시된다.
    (st) => deplasmolysisCapture(st) !== null,
    (st) => Boolean(deplasmolysisCapture(st)?.settled),
  ],
};

/**
 * 원형질 분리 복귀를 본 기록. 설탕 용액 기록보다 **뒤에 있는** 증류수 기록이다.
 * 없으면 null.
 */
export function deplasmolysisCapture(st) {
  const first = st.session.captures.findIndex((c) => c.solution && c.solution !== 'WATER');
  if (first < 0) return null;
  return st.session.captures.slice(first + 1).find((c) => c.solution === 'WATER') ?? null;
}

/** 결과를 기록한 받침 유리들. 같은 유리를 여러 장 찍어도 하나로 센다. */
export function capturedSlides(st) {
  return new Set(st.session.captures.map((c) => c.slide));
}

/** 어느 농도에서 본 결과를 기록해 두었는가. 탐구 노트의 농도별 표가 이것으로 채워진다. */
export function capturedSolutions(st) {
  return new Set(st.session.captures.map((c) => c.solution).filter(Boolean));
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
 * 결과가 갖춰졌는가 — 탐구 노트 「5. 결과」 가 끝났다는 뜻이다.
 *
 * **바나나랩과 갈리는 곳이다.** 거기서는 받침 유리 석 장을 한 번씩 찍으면 끝이었다.
 * 여기서 셋은 서로 다른 처리군이 아니라 여벌이라, 유리 개수로는 아무것도 판정할 수 없다.
 * 갖춰야 하는 것은 **농도열**이다 — 증류수 + 설탕 용액 4종.
 */
export function resultsDone(st) {
  const seen = capturedSolutions(st);
  return ['WATER', 'S05', 'S10', 'S15', 'S20'].every((sol) => seen.has(sol));
}

/**
 * 예상하고 견주는 **단위**.
 *
 * ── 바나나랩과 갈리는 곳이다 ────────────────────────────────────────
 * 거기서는 받침 유리 (가)(나)(다)가 곧 세 처리군이라 예상도 유리별로 물었다.
 * 여기서 유리 석 장은 **여벌**이고, 조건을 가르는 것은 **덮개 유리 아래 용액**이다.
 * 유리별로 물으면 학생은 같은 것을 세 번 예상하게 된다.
 *
 *   water  증류수(저장액)에 넣으면?
 *   sugar  진한 설탕 용액(고장액)에 넣으면?
 *   back   그 세포를 다시 증류수로 바꾸면?
 */
export const CONDITIONS = ['water', 'sugar', 'back'];

/**
 * 이 조건을 실제로 본 기록. 없으면 null.
 *
 * `sugar` 는 **가장 진한 농도**에서 본 것을 고른다 — 변화가 가장 뚜렷해 예상과 견주기 좋고,
 * 5 % 만 해 보고 「아무 일도 없었다」로 끝나는 것을 막는다(막는 게 아니라, 더 진한 것을
 * 해 봤다면 그쪽을 보여 준다는 뜻이다).
 */
export function captureForCondition(st, cond) {
  const caps = st.session.captures;
  if (cond === 'water') return caps.find((c) => c.solution === 'WATER') ?? null;
  if (cond === 'back') return deplasmolysisCapture(st);
  const sugar = caps.filter((c) => c.solution && c.solution !== 'WATER');
  if (sugar.length === 0) return null;
  return sugar.reduce((best, c) => (c.targetPct > best.targetPct ? c : best));
}

/** 안쪽 표피를 올려 본 적이 있는가 — 정리 단계에서 "왜 안 보였는지" 를 묻는 데 쓴다. */
export function triedInnerSide(st) {
  return st.session.captures.some((c) => c.side === SIDES.INNER)
    || anySlide(st, (s) => s.sample?.side === SIDES.INNER);
}

