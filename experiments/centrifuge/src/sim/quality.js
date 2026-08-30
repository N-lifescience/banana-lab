/**
 * 결과의 볼 만함 — 합격선이 아니라 상태 지표.
 *
 * 학생을 통과·불통과로 가르지 않는다. 지금 모세관이 얼마나 읽을 만한지를 0~100 으로
 * 보여 주고, 정리 단계에서 "왜 이 값이 나왔는지" 스스로 설명하게 하는 데 쓴다.
 *
 * **항목을 잘게 나눠 둔 이유**는 화면이 무엇을 고쳐야 하는지 갈라 말하기 위해서다.
 * 「덜 갈렸다」와 「흔들려 섞였다」를 한 칸에 넣으면 화면이 "층이 흐립니다" 라고만 말하는데,
 * 더 돌려야 하는 학생과 균형을 맞춰야 하는 학생은 **고쳐야 할 것이 서로 다르다.**
 *
 * docs/04-interaction-rules.md 참조.
 */

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 얼마나 갈렸는가.
 *
 * 바닥을 0.15 로 둔다 — 하나도 안 갈렸어도 **혈액이 든 모세관은 있는 것**이고,
 * 0 으로 두면 점수가 통째로 0 이 되어 다른 항목이 무슨 상태인지 알 수 없게 된다.
 */
export function separationFactor(sep) {
  return clamp01(0.15 + 0.85 * clamp01(sep));
}

/**
 * 경계가 또렷한가. 흔들려 다시 섞인 만큼 깎인다.
 * `separationFactor` 와 따로 두는 이유는 위 주석에 있다.
 */
export function sharpnessFactor(mixed) {
  return clamp01(1 - 0.7 * clamp01(mixed));
}

/**
 * 잴 만큼의 기둥이 남아 있는가.
 *
 * 짧은 기둥은 그 자체로 틀린 것이 아니다. 다만 같은 1 mm 를 잘못 읽어도 짧은 기둥에서는
 * 헤마토크릿이 훨씬 크게 틀어진다 — 그래서 재기 어려워진다.
 * 절차가 "충분히 빨아올려라" 라고 하는 이유가 이것이다.
 */
export function columnFactor(column) {
  return clamp01(0.2 + 0.8 * Math.min(1, clamp01(column) / 0.6));
}

/** 기둥에 낀 공기. 어디까지가 혈액인지 애매해진다. */
export function bubbleFactor(bubbles) {
  return clamp01(1 - 0.65 * clamp01(bubbles));
}

/**
 * 응고.
 *
 * 응고하면 층이 안 갈릴 뿐 아니라 **위에 뜬 것의 이름이 달라진다**(혈장 → 혈청).
 * 그래서 분리와 따로 센다 — 학생이 답해야 할 것이 다르기 때문이다.
 */
export function clotFactor(clot) {
  return clamp01(1 - 0.8 * clamp01(clot));
}

/**
 * **잴 수 있는가.**
 *
 * 자를 대지 않았으면 이 실험이 구하려던 값(헤마토크릿)을 아직 못 구한 것이다.
 * 크게 깎지는 않는다 — 지금 대면 되는 일이라, 크게 깎으면 화면이 "망쳤다" 고 말하게 된다.
 *
 * **`captured`(기록했으면 만점) 갈래가 있었는데 걷어냈다.** 두 가지가 잘못돼 있었다 —
 * 탐구 노트·보고서는 저장된 기록을 넘기는데 기록에 그 열쇠가 없어 **닿지 않았고**,
 * 회전 확대 뷰는 넘기되 뜻이 달라서(「무엇이든 한 번 기록한 적이 있는가」) **첫 기록을
 * 넘기는 순간 자를 안 댔는데도 70 에서 100 으로 뛰었다.** 같은 관을 두 화면이 다르게 말했다.
 *
 * **다시 잇지 말 것.** 이으면 자를 안 대고 기록해도 만점이라 자를 댈 이유가 사라진다 —
 * 이 갈래가 있는 이유가 바로 그것인데.
 */
export function measurableFactor({ rulerPlaced }) {
  return rulerPlaced ? 1 : 0.7;
}

/**
 * @returns {{score:number, worst:string|null, factors:object}}
 *   worst 는 가장 많이 깎은 항목 — UI가 "무엇부터 고칠지" 안내할 때 쓴다.
 */
export function observability(p = {}) {
  const factors = {
    separation: separationFactor(p.separation ?? 0),
    sharpness: sharpnessFactor(p.mixed ?? 0),
    column: columnFactor(p.column ?? 0),
    bubbles: bubbleFactor(p.bubbles ?? 0),
    clot: clotFactor(p.clot ?? 0),
    measurable: measurableFactor(p),
  };
  const score = Math.round(100 * Object.values(factors).reduce((a, b) => a * b, 1));
  // 아무것도 깎이지 않았으면 "가장 크게 깎이는 항목" 은 없다.
  // 전부 1.0 일 때 그냥 정렬하면 첫 항목이 뽑혀, 나무랄 것이 없는데도
  // 화면이 "지금 가장 크게 깎이는 항목: 분리" 라고 말한다.
  const ranked = Object.entries(factors).sort((a, b) => a[1] - b[1]);
  const worst = ranked[0][1] >= 1 ? null : ranked[0][0];
  return { score, worst, factors };
}
