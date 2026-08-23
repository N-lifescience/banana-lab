/**
 * 광학 상수 고정 테스트.
 *
 * 이 값들은 실제 현미경에서 나왔다. "보기 좋게" 바꾸려는 시도를 여기서 막는다.
 * 수치를 바꿔야 한다면 docs/05-fov-renderer.md 를 먼저 고치고 사람에게 확인받을 것.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  magnification, fieldDiameterUm, cellPx, granuleRadiusPx,
  canResolveGranules, lipidCount, focusTolerance, OBJECTIVES,
} from '../src/sim/optics.js';

const FIELD_PX = 328; // FOV.radius * 2

test('총배율은 접안 10배 × 대물배율이다', () => {
  assert.equal(magnification(4), 40);
  assert.equal(magnification(10), 100);
  assert.equal(magnification(40), 400);
});

test('시야 지름은 18000 / 대물배율 (µm)', () => {
  assert.equal(fieldDiameterUm(4), 4500);
  assert.equal(fieldDiameterUm(10), 1800);
  assert.equal(fieldDiameterUm(40), 450);
});

test('400배 시야에는 세포가 가로로 세 개쯤 들어온다', () => {
  const across = FIELD_PX / cellPx(40, FIELD_PX);
  assert.ok(across > 2.5 && across < 3.5, `가로 ${across.toFixed(2)}개 — 3개 부근이어야 합니다`);
});

test('40배 시야에는 세포가 가로로 서른 개쯤 들어온다', () => {
  const across = FIELD_PX / cellPx(4, FIELD_PX);
  assert.ok(across > 25 && across < 35, `가로 ${across.toFixed(2)}개 — 30개 부근이어야 합니다`);
});

test('녹말립은 400배에서만 개별로 분해된다', () => {
  assert.equal(canResolveGranules(40, FIELD_PX), true);
  assert.equal(canResolveGranules(10, FIELD_PX), true, '100배는 경계선 — 개별 묘사 가능');
  assert.equal(canResolveGranules(4, FIELD_PX), false, '40배에서 알갱이가 개별로 보이면 틀린 것');
});

test('녹말립은 세포의 1/5 크기다', () => {
  const ratio = (granuleRadiusPx(40, FIELD_PX) * 2) / cellPx(40, FIELD_PX);
  assert.ok(ratio > 0.15 && ratio < 0.25, `비율 ${ratio.toFixed(3)}`);
});

test('지질 방울은 면적 비례 고정 밀도이고, 400배에서 손에 꼽을 만큼만 보인다', () => {
  const n = lipidCount(40);
  assert.ok(n >= 4 && n <= 8, `400배에서 ${n}개 — 바나나 지방 0.3%를 생각하면 한 자릿수여야 합니다`);
  assert.ok(lipidCount(10) > n, '저배율일수록 넓은 면적이 들어오므로 개수는 늘어난다');
});

test('초점 심도는 고배율일수록 얕다', () => {
  const [a, b, c] = OBJECTIVES.map(focusTolerance);
  assert.ok(a > b && b > c, '4배 > 10배 > 40배 순으로 넉넉해야 합니다');
  assert.ok(c < 0.05, '400배는 매우 좁아야 저배율 선행의 이유가 생깁니다');
});
