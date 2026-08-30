/**
 * 관찰 가능성 — 합격선이 아니라 상태 지표.
 *
 * 학생을 통과·불통과로 가르지 않는다. 지금 시야가 얼마나 볼 만한지를 0~100 으로 보여 주고,
 * 정리 단계에서 "왜 이 값이 나왔는지" 스스로 설명하게 하는 데 쓴다.
 *
 * docs/04-interaction-rules.md 참조.
 */

import { focusTolerance, cellsInField } from './optics.js';
import { SIDES } from './state.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 봉입액 방울 수: 두 방울이 최고, 모자라면 일부만 잠기고, 넘치면 덮개 유리가 뜬다 */
export function dropFactor(coverage, excess) {
  const under = 0.45 + 0.55 * coverage;          // 0방울 0.45 · 1방울 0.72 · 2방울 1.00
  const over = 1 - 0.62 * excess;                 // 5방울 이상 0.38
  return clamp01(under * over);
}

export function focusFactor(focusErr, objective) {
  const tol = focusTolerance(objective);
  if (focusErr <= tol) return 1;
  return clamp01(1 - (focusErr - tol) / (tol * 6));
}

export function brightnessFactor(brightness) {
  if (brightness >= 0.55) return 1;
  return clamp01(0.25 + (brightness / 0.55) * 0.75);
}

/** 표피가 두꺼우면 세포가 여러 겹으로 겹쳐 보인다 */
export function thicknessFactor(tooThick) {
  return tooThick ? 0.35 : 1;
}

export function bubbleFactor(bubbles) {
  return clamp01(1 - bubbles * 0.09);
}

/**
 * 배율 적합도. **이 실험은 400배가 최적이 아니다.**
 *
 * 재려는 것이 「세포 **몇 개 중 몇 개**가 원형질분리를 일으켰는가」라, 시야에 셀 만큼의
 * 세포가 있어야 한다. 400배는 시야 지름이 450 µm 뿐이라 길쭉한 표피세포가 예닐곱 개밖에
 * 안 들어온다 — 잘 보이지만 **비율을 잴 수가 없다.** 40배는 반대로 세포가 너무 작아
 * 원형질체와 세포벽 사이의 틈이 갈라 보이지 않는다 (optics.canSeeGap).
 *
 * 그래서 100배가 이 관찰의 자리다. 바나나랩에서 그대로 베껴 오면 안 되는 곳이다.
 */
export function magnificationFactor(objective) {
  if (objective === 10) return 1;
  if (objective === 40) return 0.75;
  return 0.45;
}

export function lensFactor(lensTouched) {
  return lensTouched ? 0.4 : 1;
}

/**
 * 어느 면의 표피인가.
 *
 * 안토시아닌은 **바깥쪽** 표피 세포의 액포에만 있다. 안쪽을 벗기면 색이 거의 없어
 * 원형질체의 크기를 읽을 수가 없다 (`AGENTS.md` §2.5).
 *
 * **막지 않는다.** 여기서 하는 일은 "지금 시야가 볼 만한가" 를 낮게 매기는 것뿐이고,
 * 왜 낮은지는 시야 자체가 말한다.
 */
export function sideFactor(side) {
  if (side === SIDES.INNER) return 0.3;
  return 1;
}

/**
 * @returns {{score:number, worst:string, factors:object}}
 *   worst 는 가장 많이 깎은 항목 — UI가 "무엇부터 고칠지" 안내할 때 쓴다.
 */
export function observability(p) {
  const factors = {
    drops: dropFactor(p.coverage ?? 1, p.excess ?? 0),
    focus: focusFactor(p.focusErr ?? 0, p.objective ?? 10),
    brightness: brightnessFactor(p.brightness ?? 1),
    thickness: thicknessFactor(p.tooThick ?? false),
    bubbles: bubbleFactor(p.bubbles ?? 0),
    magnification: magnificationFactor(p.objective ?? 10),
    lens: lensFactor(p.lensTouched ?? false),
    side: sideFactor(p.side ?? SIDES.OUTER),
  };
  const score = Math.round(100 * Object.values(factors).reduce((a, b) => a * b, 1));
  // 아무것도 깎이지 않았으면 "가장 크게 깎이는 항목" 은 없다.
  // 전부 1.0 일 때 그냥 정렬하면 첫 항목이 뽑혀, 나무랄 것이 없는데도
  // 화면이 "지금 가장 크게 깎이는 항목: 방울 수" 라고 말한다.
  const ranked = Object.entries(factors).sort((a, b) => a[1] - b[1]);
  const worst = ranked[0][1] >= 1 ? null : ranked[0][0];
  return { score, worst, factors };
}

/** 시야에 들어오는 세포 개수 — 화면이 「비율을 재기에 충분한가」를 말할 때 쓴다. */
export { cellsInField };
