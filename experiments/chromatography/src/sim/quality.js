/**
 * 결과의 볼 만함 — 합격선이 아니라 상태 지표.
 *
 * 학생을 통과·불통과로 가르지 않는다. 지금 거름종이가 얼마나 읽을 만한지를 0~100 으로
 * 보여 주고, 정리 단계에서 "왜 이 값이 나왔는지" 스스로 설명하게 하는 데 쓴다.
 *
 * docs/04-interaction-rules.md 참조.
 */

import { PAPER_H_MM, ORIGIN_MM, MIN_SPOT_MM, MAX_SPOT_MM } from './develop.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 실린 색소량. 절차의 "10~20회" 가 이 곡선에 대응한다 —
 * 다섯 번이면 흐리고, 열다섯 번이면 넉넉하다.
 */
export function loadFactor(rawLoad) {
  return clamp01(0.15 + 0.85 * Math.min(1, rawLoad / 0.85));
}

/**
 * 원점이 잠겨 씻겨 나간 정도.
 *
 * `loadFactor` 와 따로 두는 이유: 둘이 한 칸이면 화면이 "색소가 부족합니다" 라고만 말하는데,
 * 덜 찍은 학생과 원점을 잠근 학생이 **고쳐야 할 것이 서로 다르다.**
 */
export function washFactor(washedOut) {
  return clamp01(1 - washedOut);
}

/**
 * 얼마나 갈라졌는가. 전선이 원점에서 멀리 갈수록 띠 사이가 벌어진다.
 * 너무 일찍 꺼내면 넷이 원점 가까이 뭉쳐 있다.
 */
export function separationFactor(frontMm, originMm = ORIGIN_MM) {
  const travel = Math.max(0, frontMm - originMm);
  const room = Math.max(1, PAPER_H_MM - originMm);
  return clamp01(0.1 + 0.9 * Math.min(1, travel / (room * 0.75)));
}

/**
 * 띠가 얼마나 또렷한가. 원점을 크게 찍으면 띠가 굵어져 이웃과 겹친다.
 * 바닥을 0.25 로 둔다 — 가장 크게 번져도 **띠 넷이 뭉쳐 보이는 것**이지 아무것도 없는 것이
 * 아니다. 0 으로 두면 점수가 통째로 0 이 되어 다른 항목이 무슨 상태인지 알 수 없게 된다.
 */
export function sharpnessFactor(spotMm) {
  const over = Math.max(0, spotMm - MIN_SPOT_MM);
  return clamp01(1 - 0.75 * (over / (MAX_SPOT_MM - MIN_SPOT_MM)));
}

/**
 * 전개율을 **잴 수 있는가.**
 *
 * 전선이 종이 끝을 넘어갔거나 표시하기 전에 말라 버렸으면 분모가 없다.
 * 띠가 아무리 예뻐도 이 실험이 구하려던 값을 못 구한 것이라 크게 깎는다.
 */
export function measurableFactor({ markedFront, overrun, wetness }) {
  if (overrun) return 0.25;
  if (markedFront !== null && markedFront !== undefined) return 1;
  if ((wetness ?? 0) > 0.15) return 0.8;   // 아직 눈에 보인다. 지금 표시하면 된다
  return 0.35;
}

/** 부스러기와 볼펜 잉크. 색소가 아닌 것이 종이에 올라와 있다. */
export function purityFactor(grit, marker) {
  const ink = marker === 'pen' ? 0.35 : 0;
  return clamp01(1 - grit * 0.5 - ink);
}

/**
 * 엽록소가 얼마나 남았는가.
 * 시든 잎을 쓰거나 바이알 뚜껑을 열어 두면 청록·황록 두 띠가 먼저 옅어진다.
 */
export function chlorophyllFactor(kept) {
  return clamp01(0.5 + 0.5 * kept);
}

/**
 * @returns {{score:number, worst:string|null, factors:object}}
 *   worst 는 가장 많이 깎은 항목 — UI가 "무엇부터 고칠지" 안내할 때 쓴다.
 */
export function observability(p = {}) {
  const factors = {
    load: loadFactor(p.rawLoad ?? p.load ?? 0),
    wash: washFactor(p.washedOut ?? 0),
    separation: separationFactor(p.frontMm ?? 0, p.originMm ?? ORIGIN_MM),
    sharpness: sharpnessFactor(p.spotMm ?? MIN_SPOT_MM),
    measurable: measurableFactor(p),
    purity: purityFactor(p.grit ?? 0, p.marker),
    chlorophyll: chlorophyllFactor(p.chlorophyllKept ?? 1),
  };
  const score = Math.round(100 * Object.values(factors).reduce((a, b) => a * b, 1));
  // 아무것도 깎이지 않았으면 "가장 크게 깎이는 항목" 은 없다.
  // 전부 1.0 일 때 그냥 정렬하면 첫 항목이 뽑혀, 나무랄 것이 없는데도
  // 화면이 "지금 가장 크게 깎이는 항목: 색소량" 이라고 말한다.
  const ranked = Object.entries(factors).sort((a, b) => a[1] - b[1]);
  const worst = ranked[0][1] >= 1 ? null : ranked[0][0];
  return { score, worst, factors };
}
