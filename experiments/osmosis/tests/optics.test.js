/**
 * 광학 상수는 실제 값에서 나온다. "보기 좋게" 바꾸면 여기서 잡힌다.
 *
 * **[확인 필요] 로 표시된 값도 여기서 고정한다.** 출처를 못 댄 값일수록
 * 아무도 모르게 슬금슬금 바뀌기 쉽다 — 바뀌는 것 자체는 괜찮고,
 * 바뀐 줄 모르는 것이 나쁘다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELD_NUMBER_UM, EYEPIECE, OBJECTIVES,
  CELL_LONG_UM, CELL_SHORT_UM, WALL_UM, GAP_RESOLVE_PX,
  magnification, fieldDiameterUm, pxPerUm,
  cellLongPx, cellShortPx, wallPx, cellsInField, canSeeGap, focusTolerance,
} from '../src/sim/optics.js';
import { protoplastRatio, CELL_SAP_PCT } from '../src/sim/osmosis.js';

/** 화면에서의 시야 지름 (px). fov.js 의 radius × 2 와 같아야 한다. */
const FIELD_PX = 328;

test('시야 지름 = 18000 / 대물배율', () => {
  assert.equal(FIELD_NUMBER_UM, 18000);
  assert.equal(fieldDiameterUm(4), 4500);
  assert.equal(fieldDiameterUm(10), 1800);
  assert.equal(fieldDiameterUm(40), 450);
});

test('총배율은 접안 × 대물', () => {
  assert.equal(EYEPIECE, 10);
  assert.deepEqual(OBJECTIVES, [4, 10, 40]);
  assert.deepEqual(OBJECTIVES.map(magnification), [40, 100, 400]);
});

test('세포 치수가 고정돼 있다 — [확인 필요] 여도 마음대로 바꾸지 않는다', () => {
  assert.equal(CELL_LONG_UM, 300);
  assert.equal(CELL_SHORT_UM, 80);
  assert.equal(WALL_UM, 3);
});

test('표피세포는 길쭉하다 — 긴 변과 짧은 변의 비가 3~4:1', () => {
  // 이 비가 무너지면 시야에 들어오는 세포 개수가 달라지고,
  // 「100배가 이 관찰의 자리」라는 판단(quality.magnificationFactor)이 통째로 틀린다.
  const ratio = CELL_LONG_UM / CELL_SHORT_UM;
  assert.ok(ratio >= 3 && ratio <= 4, `긴 변 / 짧은 변 = ${ratio}`);
});

test('px 환산이 배율에 반비례한다', () => {
  assert.ok(pxPerUm(40, FIELD_PX) > pxPerUm(10, FIELD_PX));
  assert.ok(pxPerUm(10, FIELD_PX) > pxPerUm(4, FIELD_PX));
  // 배율이 10배가 되면 화면 크기도 정확히 10배다
  assert.ok(Math.abs(cellLongPx(40, FIELD_PX) / cellLongPx(4, FIELD_PX) - 10) < 1e-9);
  assert.ok(cellShortPx(10, FIELD_PX) < cellLongPx(10, FIELD_PX));
  assert.ok(wallPx(40, FIELD_PX) > wallPx(4, FIELD_PX));
});

test('100배 시야에는 비율을 잴 만큼 세포가 들어오고, 400배에는 안 들어온다', () => {
  // 이 실험이 재는 것은 「몇 개 중 몇 개」다. 400배는 잘 보이지만 셀 수가 없다.
  assert.ok(cellsInField(10) >= 50, `100배에 ${cellsInField(10)}개`);
  assert.ok(cellsInField(40) < 20, `400배에 ${cellsInField(40)}개 — 비율을 잴 수 없어야 한다`);
  assert.ok(cellsInField(4) > cellsInField(10));
});

test('원형질체와 세포벽 사이의 틈은 100배에서부터 갈라 보인다', () => {
  assert.equal(GAP_RESOLVE_PX, 2.5);
  const at = (pct) => protoplastRatio(pct, CELL_SAP_PCT);
  // 세포액보다 묽으면 애초에 틈이 없다
  assert.equal(canSeeGap(10, FIELD_PX, at(5)), false);
  assert.equal(canSeeGap(40, FIELD_PX, at(5)), false);
  // 15 % 는 100배에서 보이고 40배에서는 안 보인다 — 배율 선택이 결과를 가르는 자리다
  assert.equal(canSeeGap(4, FIELD_PX, at(15)), false, '40배에서는 못 갈라 본다');
  assert.equal(canSeeGap(10, FIELD_PX, at(15)), true, '100배에서는 보여야 한다');
  assert.equal(canSeeGap(40, FIELD_PX, at(15)), true);
});

test('초점 허용 범위는 고배율일수록 좁다', () => {
  assert.ok(focusTolerance(4) > focusTolerance(10));
  assert.ok(focusTolerance(10) > focusTolerance(40));
  assert.ok(focusTolerance(40) <= 0.05, '400배는 사실상 못 찾을 만큼 좁아야 한다');
});
