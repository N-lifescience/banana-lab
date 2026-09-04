/**
 * 광학 상수와 환산.
 *
 * 시야 지름은 실제 광학에서 나온다. "보기 좋게" 바꾸지 말 것.
 * tests/optics.test.js 가 값을 고정하고 있다.
 * docs/05-fov-renderer.md 참조.
 */

import { protoplastAxes } from './osmosis.js';

/** 접안렌즈 시야수(Field Number). 학교용 광학현미경의 표준값. */
export const FIELD_NUMBER_UM = 18000;

/** 접안렌즈 배율. 학교용은 대개 고정 10배. */
export const EYEPIECE = 10;

/** 쓸 수 있는 대물렌즈 */
export const OBJECTIVES = [4, 10, 40];

/**
 * 양파 표피세포의 실물 치수 (µm).
 *
 * ── [확인 필요] ────────────────────────────────────────────────────
 * **두 값 모두 1차 출처를 확인하지 못했다.** 학교 현미경 관찰 자료에서 양파 표피세포를
 * 대략 0.2~0.4 mm 길이의 **길쭉한 벽돌 모양**으로 다루는 것은 널리 되풀이되지만,
 * 어느 문헌의 어느 측정인지는 대지 못한다.
 *
 * 확실한 것은 **모양**이다 — 길쭉하고, 긴 변과 짧은 변의 비가 3~4:1 쯤이며,
 * 세포벽이 또렷한 격자를 이룬다. 시야에 몇 개가 들어오는지가 배율 선택을 가르므로
 * 이 비(比)가 틀리면 §「배율 적합도」(quality.js)가 통째로 틀린다.
 *
 * **이 숫자를 화면에 내보내지 않는다.** 시야 아래에 적히는 것은 시야 지름뿐이다.
 */
export const CELL_LONG_UM = 300;
export const CELL_SHORT_UM = 80;

/**
 * 세포벽 두께 (µm). [확인 필요]
 * 원형질체와 세포벽 사이의 **틈**과 헷갈리지 말 것 — 틈은 삼투로 생기고 이것은 고정이다.
 */
export const WALL_UM = 3;

/**
 * 원형질체와 세포벽 사이의 틈이 화면에서 이 px 보다 좁으면 눈으로 갈라 볼 수 없다.
 * 「원형질분리를 일으켰는가」 판정이 배율에 매이는 이유다.
 */
export const GAP_RESOLVE_PX = 2.5;

export function magnification(objective) {
  return EYEPIECE * objective;
}

/** 시야 지름 (µm) */
export function fieldDiameterUm(objective) {
  return FIELD_NUMBER_UM / objective;
}

/** µm 를 화면 px 로 바꾸는 계수. fieldPx 는 시야 원의 지름(px). */
export function pxPerUm(objective, fieldPx) {
  return fieldPx / fieldDiameterUm(objective);
}

/** 화면에서의 세포 긴 변 (px) */
export function cellLongPx(objective, fieldPx) {
  return CELL_LONG_UM * pxPerUm(objective, fieldPx);
}

/** 화면에서의 세포 짧은 변 (px) */
export function cellShortPx(objective, fieldPx) {
  return CELL_SHORT_UM * pxPerUm(objective, fieldPx);
}

/** 화면에서의 세포벽 두께 (px) */
export function wallPx(objective, fieldPx) {
  return WALL_UM * pxPerUm(objective, fieldPx);
}

/**
 * 시야 안에 들어오는 세포 개수 (대략).
 *
 * **이 값이 배율 선택을 가른다.** 「세포 절반이 원형질분리를 일으켰는가」를 재려면
 * 시야에 셀 만큼의 세포가 있어야 한다. 400배는 시야 지름이 450 µm 라 길쭉한 세포가
 * 몇 개 안 들어온다 — 잘 보이지만 셀 수가 없다. quality.js 의 배율 적합도가 이것을 읽는다.
 */
export function cellsInField(objective) {
  const r = fieldDiameterUm(objective) / 2;
  return Math.round((Math.PI * r * r) / (CELL_LONG_UM * CELL_SHORT_UM));
}

/**
 * 이 배율에서 원형질체가 벽에서 떨어진 것을 갈라 볼 수 있는가.
 * @param {number} ratio 원형질체 부피비 (osmosis.protoplastRatio)
 */
export function canSeeGap(objective, fieldPx, ratio) {
  // 눈에 띄는 것은 **긴 변 쪽 끝**의 틈이다. 원형질체가 둥글게 뭉치면서 그쪽에서
  // 훨씬 많이 물러나기 때문이다 (osmosis.protoplastAxes). 짧은 변 쪽 틈으로 재면
  // 100배에서 원형질분리가 안 보인다는 틀린 결론이 나온다.
  const gap = (cellLongPx(objective, fieldPx) * (1 - protoplastAxes(ratio).long)) / 2;
  return gap >= GAP_RESOLVE_PX;
}

/**
 * 초점 허용 범위.
 * 고배율일수록 초점 심도가 얕다. 저배율을 건너뛰고 400배로 바로 가면
 * 막히는 게 아니라 "사실상 못 찾는" 이유가 이 값이다.
 */
export function focusTolerance(objective) {
  if (objective === 4) return 0.30;
  if (objective === 10) return 0.12;
  return 0.03;
}

/**
 * 나사가 도는 폭. 조동 ±1 · 미동 ±0.2 — `rules.js` 의 clamp 와 같은 값이다.
 * 다이얼 그림(호)·낭독기 범위(`aria-valuemin/max`)·「끝까지 갔습니다」 판정이 이 값을 읽는다.
 * 10배 허용 범위(0.12)가 미동 폭(0.2)보다 좁아, 저배율에서 맞춘 어느 자리에서도 미동만으로 40배에 닿는다.
 */
export const KNOB_SPAN = { coarse: 1, fine: 0.2 };
