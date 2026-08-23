/**
 * 관찰 가능성 — 합격선이 아니라 상태 지표.
 *
 * 학생을 통과·불통과로 가르지 않는다. 지금 시야가 얼마나 볼 만한지를 0~100 으로 보여 주고,
 * 정리 단계에서 "왜 이 값이 나왔는지" 스스로 설명하게 하는 데 쓴다.
 *
 * docs/04-interaction-rules.md 참조.
 */

import { focusTolerance } from './optics.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 방울 수: 두 방울이 최고, 모자라면 일부만 물들고, 넘치면 대비가 죽는다 */
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

export function thicknessFactor(tooThick) {
  return tooThick ? 0.35 : 1;
}

export function bubbleFactor(bubbles) {
  return clamp01(1 - bubbles * 0.09);
}

/** 배율 적합도: 이 관찰은 400배에서 해야 알갱이가 보인다 */
export function magnificationFactor(objective) {
  if (objective === 40) return 1;
  if (objective === 10) return 0.7;
  return 0.4;
}

export function lensFactor(lensTouched) {
  return lensTouched ? 0.4 : 1;
}

/**
 * @returns {{score:number, worst:string, factors:object}}
 *   worst 는 가장 많이 깎은 항목 — UI가 "무엇부터 고칠지" 안내할 때 쓴다.
 */
export function observability(p) {
  const factors = {
    // 시약을 쓰지 않는 슬라이드((가) 대조군)는 방울 수로 깎지 않는다.
    //
    // 대조군에 아무것도 떨어뜨리지 않는 것이 **맞는 절차**다. 그런데 방울 수를 그대로 재면
    // 0방울이 55 % 감점이 되고, 화면은 "지금 가장 크게 깎이는 항목: 방울 수" 라고 말한다 —
    // 제대로 한 학생에게 화면이 틀린 것을 하라고 안내하는 꼴이 된다.
    drops: p.reagent ? dropFactor(p.coverage ?? 1, p.excess ?? 0) : 1,
    focus: focusFactor(p.focusErr ?? 0, p.objective ?? 40),
    brightness: brightnessFactor(p.brightness ?? 1),
    thickness: thicknessFactor(p.tooThick ?? false),
    bubbles: bubbleFactor(p.bubbles ?? 0),
    magnification: magnificationFactor(p.objective ?? 40),
    lens: lensFactor(p.lensTouched ?? false),
  };
  const score = Math.round(100 * Object.values(factors).reduce((a, b) => a * b, 1));
  // 아무것도 깎이지 않았으면 "가장 크게 깎이는 항목" 은 없다.
  // 전부 1.0 일 때 그냥 정렬하면 첫 항목이 뽑혀, 나무랄 것이 없는데도
  // 화면이 "지금 가장 크게 깎이는 항목: 방울 수" 라고 말한다.
  const ranked = Object.entries(factors).sort((a, b) => a[1] - b[1]);
  const worst = ranked[0][1] >= 1 ? null : ranked[0][0];
  return { score, worst, factors };
}
