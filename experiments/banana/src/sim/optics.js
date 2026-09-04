/**
 * 광학 상수와 환산.
 *
 * 이 파일의 숫자는 실제 현미경에서 나온 값이다. "보기 좋게" 바꾸지 말 것.
 * tests/optics.test.js 가 값을 고정하고 있다.
 * docs/05-fov-renderer.md 참조.
 */

/** 접안렌즈 시야수(Field Number). 학교용 광학현미경의 표준값. */
export const FIELD_NUMBER_UM = 18000;

/** 접안렌즈 배율. 학교용은 대개 고정 10배. */
export const EYEPIECE = 10;

/** 쓸 수 있는 대물렌즈 */
export const OBJECTIVES = [4, 10, 40];

/** 실물 치수 (µm). 바나나 과육 조직 기준. */
export const CELL_UM = 150;
export const GRANULE_UM = 30;   // 녹말립
export const LIPID_UM = 14;     // 수단 Ⅲ로 염색된 지질 방울

/**
 * 지질 방울 밀도. 바나나 과육의 지방 함량은 0.3 % 내외라 아주 드물다.
 * 이 값을 키워서 (다) 슬라이드를 화려하게 만들면 과학적으로 틀린 시뮬레이터가 된다.
 */
export const LIPID_AREA_PER_DROPLET_UM2 = 46000;

/** 세포가 화면에서 이 크기보다 작으면 녹말립을 개별로 그리지 않는다 (실제로도 분해되지 않는다). */
export const GRANULE_RESOLVE_PX = 20;

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

/** 화면에서의 세포 한 변 (px) */
export function cellPx(objective, fieldPx) {
  return CELL_UM * pxPerUm(objective, fieldPx);
}

/** 화면에서의 녹말립 반지름 (px) */
export function granuleRadiusPx(objective, fieldPx) {
  return (GRANULE_UM * pxPerUm(objective, fieldPx)) / 2;
}

/** 화면에서의 지질 방울 반지름 (px) */
export function lipidRadiusPx(objective, fieldPx) {
  return (LIPID_UM * pxPerUm(objective, fieldPx)) / 2;
}

/** 이 배율에서 녹말립을 개별 도형으로 그릴 수 있는가 */
export function canResolveGranules(objective, fieldPx) {
  return cellPx(objective, fieldPx) >= GRANULE_RESOLVE_PX;
}

/** 시야에 들어올 지질 방울 개수 — 면적에 비례하는 고정 밀도 */
export function lipidCount(objective) {
  const r = fieldDiameterUm(objective) / 2;
  const n = Math.round((Math.PI * r * r) / LIPID_AREA_PER_DROPLET_UM2);
  return Math.max(4, Math.min(320, n));
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
