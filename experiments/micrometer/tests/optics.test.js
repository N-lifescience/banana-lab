/**
 * 광학 상수 고정 테스트.
 *
 * 이 실험에서 광학 수치는 학생이 구해야 하는 답 그 자체다. "보기 좋게" 바꾸려는 시도를
 * 여기서 막는다. 수치를 바꿔야 한다면 tasks/DESIGN-optics.md 를 먼저 고치고 사람에게 확인받을 것.
 *
 * 아직 확인되지 않은 치수에 기대는 검사는 test.todo 로 남긴다.
 * 임시값을 넣어 초록불을 내면 다음 사람이 값이 확인된 줄 안다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  magnification, fieldDiameterUm, pxPerUm, focusTolerance,
  umPerEyepieceDiv, eyepieceDivPx, stageDivPx, eyepieceDivsPerStageDiv,
  EYEPIECE_DIV_FIELD_FRACTION, EYEPIECE_DIVS_ACROSS_FIELD, RETICLE_SPAN_FIELD_FRACTION,
  canResolveStageTicks, canResolveEyepieceTicks, canResolveEyepieceMajor,
  zoomEyepieceDivPx, zoomVisibleDivs,
  foldSkewDeg, usableRunDiv, phaseDiv, readErrDiv, calibration,
  guardCellLengthUm, guardCellDivs,
  OBJECTIVES, EYEPIECE, RETICLE_DIVS, RETICLE_PITCH_UM,
  TICK_RESOLVE_PX, JUDGE_GAP_DIV, MIN_COUNTABLE_RUN_DIV, GAP_MAX_DEG,
  ZOOM, COUNTABLE_PITCH_PX, PAN_LIMIT_PX, FIELD_PX_REF, GUARD_CELL_UM,
  STAGE_MICROMETER_FOCUS_EASE,
} from '../src/sim/optics.js';

const FIELD_PX = 328; // FOV.radius * 2

const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---------------- 배율과 시야 (T-1 · T-2) ---------------- */

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

/* ---------------- 접안 눈금 (T-3 · T-4 · T-5 · T-6 · T-13) ---------------- */

test('접안 눈금 한 칸은 100 µm ÷ 대물배율이다', () => {
  assert.equal(RETICLE_PITCH_UM, 100, '10 mm / 100칸 = 0.1 mm');
  assert.equal(umPerEyepieceDiv(4), 25);
  assert.equal(umPerEyepieceDiv(10), 10);
  assert.equal(umPerEyepieceDiv(40), 2.5);
});

test('접안 눈금 한 칸이 시야 지름에서 차지하는 비율은 배율과 무관하다', () => {
  // 이 실험의 핵심 불변량. 렌더러가 objective 를 눈금자 계산에 넣으면 여기서 깨진다.
  const ratios = OBJECTIVES.map((o) => umPerEyepieceDiv(o) / fieldDiameterUm(o));
  for (const r of ratios) {
    assert.ok(near(r, EYEPIECE_DIV_FIELD_FRACTION, 1e-12), `비율 ${r} — 전 배율에서 같아야 합니다`);
    assert.ok(near(r, 0.1 / 18, 1e-12), '0.1 mm / 18 mm = 0.005556');
  }
  assert.equal(new Set(ratios).size, 1, '세 배율의 비율이 하나의 값이어야 합니다');
});

test('화면에서도 접안 눈금 간격은 배율에 반응하지 않는다', () => {
  // 구조로 못박는다 — 눈금자 px 함수는 objective 를 받을 자리가 없다.
  assert.equal(eyepieceDivPx.length, 1, 'eyepieceDivPx(fieldPx) — 인자는 fieldPx 하나뿐이어야 합니다');
  assert.ok(near(eyepieceDivPx(FIELD_PX), 1.822, 0.001));

  // 대물 눈금은 반대로 배율을 따라 4배씩 벌어진다. 그 대비가 학생이 보는 것이다.
  assert.ok(near(stageDivPx(10, FIELD_PX), 1.822, 0.001), '100배에서는 두 눈금자가 포개진다');
  assert.ok(near(stageDivPx(40, FIELD_PX), 7.289, 0.001), '400배에서는 대물 눈금만 벌어진다');
});

test('umPerEyepieceDiv 는 접안배율에 의존하지 않는다', () => {
  // 시그니처로 먼저 확인한다. 총배율이나 접안배율이 들어올 자리가 없어야 한다.
  assert.equal(umPerEyepieceDiv.length, 1, 'objective 하나만 받아야 합니다');

  // 동작으로도 확인한다 — 대물배율을 곱하면 접안 눈금 규격이 그대로 나온다(상수).
  for (const o of OBJECTIVES) {
    assert.equal(umPerEyepieceDiv(o) * o, RETICLE_PITCH_UM);
  }
  // 총배율에 의존했다면 100배에서 100/100 = 1 µm 가 나왔을 것이다.
  assert.notEqual(umPerEyepieceDiv(10), RETICLE_PITCH_UM / magnification(10));
  assert.equal(umPerEyepieceDiv(10) * EYEPIECE, 100, '접안배율은 상쇄되어 식에 들어가지 않는다');
});

test('시야 지름은 접안 눈금 180칸이고, 눈금자 100칸은 시야의 55.6 %만 가로지른다', () => {
  for (const o of OBJECTIVES) {
    assert.ok(near(fieldDiameterUm(o) / umPerEyepieceDiv(o), 180, 1e-9));
  }
  assert.equal(EYEPIECE_DIVS_ACROSS_FIELD, 180);
  assert.equal(RETICLE_DIVS, 100, '눈금자에 새겨진 칸 수. 180은 셀 수 있는 수가 아니다');
  assert.ok(near(RETICLE_SPAN_FIELD_FRACTION, 10 / 18, 1e-12));
  assert.ok(RETICLE_DIVS < EYEPIECE_DIVS_ACROSS_FIELD, '눈금자는 시야를 다 가로지르지 못한다');
});

test('100배에서 두 눈금자는 1 : 1, 400배에서 4 : 1이다', () => {
  assert.equal(eyepieceDivsPerStageDiv(10), 1, '완전히 포개진다 — 이 실험의 가장 좋은 장면');
  assert.equal(eyepieceDivsPerStageDiv(40), 4);
  assert.equal(eyepieceDivsPerStageDiv(4), 0.4);

  // 400배에서 100배 값을 그대로 쓰면 정확히 대물배율의 비만큼 틀린다.
  assert.equal(umPerEyepieceDiv(10) / umPerEyepieceDiv(40), 4);
  assert.equal(umPerEyepieceDiv(10) / umPerEyepieceDiv(40), 40 / 10);
});

/* ---------------- 개별 묘사 임계 (T-7 · T-8) ---------------- */

test('대물 잔눈금은 400배에서만 시야 원에 개별로 그려진다', () => {
  assert.equal(canResolveStageTicks(40, FIELD_PX), true, '7.29 px');
  assert.equal(canResolveStageTicks(10, FIELD_PX), false, '1.82 px — 모아레가 된다');
  assert.equal(canResolveStageTicks(4, FIELD_PX), false, '0.73 px — 4배가 스스로 답하는 자리');
  assert.equal(TICK_RESOLVE_PX, 4);
});

test('접안 잔눈금은 어느 배율에서도 시야 원에서 셀 수 없다', () => {
  // 그래서 확대 뷰가 있는 것이다. 시야 원에는 굵은 눈금(10칸)만 그린다.
  assert.equal(canResolveEyepieceTicks(FIELD_PX), false, '1.82 px');
  assert.equal(canResolveEyepieceMajor(FIELD_PX), true, '18.2 px — 읽을 수 있다');
  assert.equal(canResolveEyepieceTicks(700), false, '시야 원을 700 px 로 키워도 3.9 px 라 부족하다');
});

test('확대 뷰는 400배 보정 구간인 접안 40칸을 한 화면에 담는다', () => {
  assert.ok(zoomEyepieceDivPx(FIELD_PX) >= COUNTABLE_PITCH_PX,
    `확대 뷰 한 칸 ${zoomEyepieceDivPx(FIELD_PX).toFixed(1)} px — 세려면 ${COUNTABLE_PITCH_PX} px 는 되어야 합니다`);
  assert.ok(zoomVisibleDivs(FIELD_PX) >= 40,
    `${zoomVisibleDivs(FIELD_PX).toFixed(1)}칸 — 40칸이 잘리면 학생이 조작이 아니라 UI 때문에 틀립니다`);
  assert.equal(ZOOM.scale, 8);
  assert.equal(ZOOM.width, 600);
});

/* ---------------- 어긋남 (T-11 · T-12 · T-14) ---------------- */

test('기울기 차는 180° 주기로 접힌다 — 눈금자는 방향이 아니라 선이다', () => {
  assert.equal(foldSkewDeg(0, 0), 0);
  assert.equal(foldSkewDeg(180, 0), 0, '180° 돌린 눈금자는 나란하다');
  assert.equal(foldSkewDeg(3, 0), 3);
  assert.equal(foldSkewDeg(0, 3), -3);
  assert.equal(foldSkewDeg(179, 0), -1);
  for (const [a, b] of [[0, 0], [5, 200], [-37, 91], [400, 13]]) {
    const d = foldSkewDeg(a, b);
    assert.ok(d > -90 && d <= 90, `${d}° — −90 ~ +90 으로 접혀야 합니다`);
  }
});

test('기울기가 커질수록 겹쳐 보이는 구간이 단조 감소한다', () => {
  assert.equal(usableRunDiv(0), RETICLE_DIVS, '나란하면 눈금자 전체');
  assert.equal(usableRunDiv(0.1), RETICLE_DIVS, '상한은 눈금자 길이지 무한대가 아니다');
  assert.ok(near(usableRunDiv(1), 28.6, 0.1), '400배 보정 40칸이 간신히 안 된다');
  assert.ok(near(usableRunDiv(3), 9.6, 0.1));
  assert.ok(usableRunDiv(0.1) >= usableRunDiv(1));
  assert.ok(usableRunDiv(1) > usableRunDiv(3));
  assert.ok(usableRunDiv(3) > usableRunDiv(10));
  assert.ok(usableRunDiv(20) < 2, '20°면 막지 않아도 칸 수를 셀 수 없다');
  assert.equal(usableRunDiv(5), usableRunDiv(-5), '어느 쪽으로 기울든 같다');
});

test('GAP_MAX_DEG 는 usableRunDiv 와 같은 각도를 말한다', () => {
  // 두 함수가 서로 다른 각도를 말하면 화면과 점수가 어긋난다. 항등식으로 묶어 둔다.
  assert.ok(near(usableRunDiv(GAP_MAX_DEG), MIN_COUNTABLE_RUN_DIV, 1e-9));
  assert.ok(near(GAP_MAX_DEG, 19.47, 0.01), '설계도 표의 「20° 이상은 셀 수 없다」와 같은 지점');
  assert.equal(JUDGE_GAP_DIV, 0.5);
});

test('위상차는 한 칸 주기로 접힌다 — 0.9칸 어긋남은 0.1칸 어긋남과 같다', () => {
  assert.equal(phaseDiv(40, 0), 0);
  assert.ok(near(phaseDiv(40, 2.5), 0, 1e-12), '정확히 한 칸이면 다시 포개진다');
  assert.ok(near(phaseDiv(40, 1.25), 0.5, 1e-12), '반 칸이 최악이다');
  assert.ok(near(phaseDiv(40, 0.25), phaseDiv(40, 2.25), 1e-12));
  assert.ok(near(readErrDiv(0), 0.25, 1e-12), '위상이 완벽해도 눈금선 두께만큼은 남는다');
  assert.ok(near(readErrDiv(0.5), 0.5, 1e-12), '반 칸 어긋나면 판독 오차가 두 배');
});

test('기울기는 답을 치우게 하지 않고 오차 폭만 넓힌다', () => {
  const runs = [0.2, 1, 3, 10].map((skewDeg) => calibration(40, { fieldPx: FIELD_PX, skewDeg }));
  for (const c of runs) {
    assert.equal(c.umPerDiv, 2.5, '기댓값은 기울기와 무관하다 — 답이 치우치면 안 된다');
  }
  for (let i = 1; i < runs.length; i++) {
    assert.ok(runs[i].relErr > runs[i - 1].relErr, '기울일수록 오차 폭만 커진다');
    assert.ok(runs[i].eyepieceRunDiv < runs[i - 1].eyepieceRunDiv, '셀 수 있는 칸이 줄어든다');
  }
  // 위상차도 마찬가지로 답이 아니라 오차 폭에만 걸린다.
  const a = calibration(40, { fieldPx: FIELD_PX, phase: 0 });
  const b = calibration(40, { fieldPx: FIELD_PX, phase: 0.5 });
  assert.equal(a.umPerDiv, b.umPerDiv);
  assert.ok(b.relErr > a.relErr);
});

test('400배 보정은 100배 보정보다 상대오차가 크다', () => {
  // 시야가 좁아 대물 눈금이 몇 칸 안 들어오기 때문이다.
  // 「100배에서 보정하고 배율비로 나눈다」가 존재하는 이유 = 3단계 심화 문항의 근거.
  const at100 = calibration(10, { fieldPx: FIELD_PX, skewDeg: 0.2 });
  const at400 = calibration(40, { fieldPx: FIELD_PX, skewDeg: 0.2 });
  assert.ok(near(at100.relErr, 0.024, 0.004), `100배 ${(at100.relErr * 100).toFixed(1)} %`);
  assert.ok(near(at400.relErr, 0.061, 0.006), `400배 ${(at400.relErr * 100).toFixed(1)} %`);
  assert.ok(at400.relErr > at100.relErr);
  assert.ok(near(at400.stageRunDiv, at100.stageRunDiv / 4, 1e-9), '400배에서는 대물 눈금이 1/4만 들어온다');
});

/* ---------------- 재물대 이동 범위 ---------------- */

test('재물대 이동 범위는 시야 반지름 + 눈금 부분 절반이다', () => {
  // 끝까지 밀면 눈금 부분(1 mm)이 시야에서 완전히 빠진다 → 저배율로 「찾는」 단계가 생긴다.
  const ruledHalfPx = (1000 * pxPerUm(10, FIELD_PX_REF)) / 2;
  assert.equal(PAN_LIMIT_PX, Math.round(FIELD_PX_REF / 2 + ruledHalfPx));
  assert.equal(PAN_LIMIT_PX, 255);
  assert.ok(PAN_LIMIT_PX > FIELD_PX_REF / 2, '눈금 부분을 시야 밖으로 보낼 수 있어야 한다');
  // 100배에서 눈금 부분 1 mm 는 접안 눈금자 100칸과 길이가 같다(1 : 1).
  assert.ok(near(ruledHalfPx, (eyepieceDivPx(FIELD_PX_REF) * RETICLE_DIVS) / 2, 1e-9));
});

/* ---------------- 공변세포 (T-9 · T-10) ---------------- */

test('공변세포는 400배에서 접안 15~25칸을 차지한다', () => {
  // 셀 만한 창. tasks/RESOLVED-cell-size.md 의 실측(RH 55 %, 56.7 µm)이 이 안에 들어온다.
  for (const seed of [0, 1, 7, 42, 1234, 99999]) {
    const divs = guardCellDivs(40, seed);
    assert.ok(divs >= 15 && divs <= 25, `시드 ${seed} → ${divs.toFixed(1)}칸`);
  }
  assert.ok(near(GUARD_CELL_UM.min / 2.5, 22, 0.01));
  assert.ok(near(GUARD_CELL_UM.max / 2.5, 24.8, 0.01));
});

test('시드를 바꿔도 그 창을 벗어나지 않고, 값은 실제로 흩어진다', () => {
  const seen = new Set();
  for (let seed = 0; seed < 500; seed++) {
    const um = guardCellLengthUm(seed);
    assert.ok(um >= GUARD_CELL_UM.min && um <= GUARD_CELL_UM.max, `시드 ${seed} → ${um} µm`);
    const divs = guardCellDivs(40, seed);
    assert.ok(divs >= 15 && divs <= 25, `시드 ${seed} → ${divs.toFixed(1)}칸`);
    seen.add(Math.round(um * 10));
  }
  assert.ok(seen.size > 50, `${seen.size}가지 — 고정값 하나면 관찰이 아니라 정답 맞히기가 된다`);
});

test('100배 측정은 일부러 거칠고, 400배 시야에는 세포가 여러 개 들어온다', () => {
  const um = guardCellLengthUm(0);
  const coarse = um / umPerEyepieceDiv(10);
  assert.ok(coarse >= 3.8 && coarse <= 6.3,
    `100배에서 ${coarse.toFixed(1)}칸 — 눈금 하나가 20 % 오차라 400배로 올릴 이유가 된다`);
  const across = fieldDiameterUm(40) / um;
  assert.ok(across >= 7 && across <= 12,
    `400배 시야에 가로 ${across.toFixed(1)}개 — 골라 재는 판단이 생겨야 한다`);
});

test('세포를 400배에서 재는 것이 100배에서 재는 것보다 정밀하다', () => {
  // 같은 세포라도 400배에서는 칸 수가 4배라 판독 오차의 몫이 1/4이 된다.
  const err100 = (2 * readErrDiv(0)) / guardCellDivs(10, 0);
  const err400 = (2 * readErrDiv(0)) / guardCellDivs(40, 0);
  assert.ok(near(err100 / err400, 4, 1e-9), '정확히 대물배율의 비만큼 나아진다');
});

/* ---------------- 초점 ---------------- */

test('초점 심도는 고배율일수록 얕다', () => {
  const [a, b, c] = OBJECTIVES.map((o) => focusTolerance(o));
  assert.ok(a > b && b > c, '4배 > 10배 > 40배 순으로 넉넉해야 합니다');
  assert.ok(c < 0.05, '400배는 매우 좁아야 저배율 선행의 이유가 생깁니다');
});

test('대물 마이크로미터는 표본보다 초점 잡기가 쉽다', () => {
  // 유리 위 크롬 선이라 두께가 없다. 「100배에서 눈금에 먼저 초점을 맞춘다」가 그래서 성립한다.
  for (const o of OBJECTIVES) {
    assert.equal(focusTolerance(o, 'micrometer'), focusTolerance(o) * STAGE_MICROMETER_FOCUS_EASE);
  }
  assert.equal(focusTolerance(40), focusTolerance(40, 'specimen'),
    '기본값은 표본 — rules.js 가 인자 하나로 부른다');
});

test('접안 눈금자는 초점 나사와 무관하다', () => {
  // 접안렌즈 안에 있으므로 항상 선명하다. 눈금자용 허용치를 따로 만들면
  // "흐려질 수 있다"는 뜻이 되어 §5.5 가 깨진다. 렌더러는 눈금 레이어를 블러에서 뺀다.
  assert.equal(focusTolerance(40, 'reticle'), focusTolerance(40));
});

/* ---------------- 아직 확인되지 않은 치수 ---------------- */
/*
 * 아래는 tasks/DESIGN-optics.md §8 에 남은 [확인 필요] 항목이다.
 * 값이 오기 전에 임시값으로 초록불을 내면 다음 사람이 확인된 값으로 읽는다.
 * (공변세포 길이는 tasks/RESOLVED-cell-size.md 에서 채워져 위 검사로 올라갔다.)
 */

test.todo('공변세포 폭(단축) — 기공 개폐로 변한다. 실측 필요 (측정 대상은 아니고 그림에만 쓴다)');
test.todo('기공 복합체 전체 길이와 주변 표피세포 크기 — 시야 배치와 대비에 필요');
test.todo('공변세포 안 엽록체 지름 — 400배에서 개별로 그릴지 판단하려면 필요');
test.todo('기공 밀도(개/mm²) — 시야당 기공 개수. 재배 조건 의존성이 커서 문헌만으로는 부족');
test.todo('표본의 종명 — T. virginiana / T. zebrina / T. pallida 는 크기가 다르다');
test.todo('리클을 뒤집어 끼우면 눈금만 흐려지는가 — 사실이면 연속값이 하나 더 생긴다');
