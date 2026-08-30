/**
 * 전개 물리 상수와 환산.
 *
 * 여기 있는 값은 "보기 좋게" 바꾸면 안 되는 것들이다. 바꿔야 할 것 같으면 사람에게 묻는다
 * (AGENTS.md §2.4 · §6).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPER_W_MM, PAPER_H_MM, ORIGIN_MM, MAX_DEPTH_MM, RISE_K, FULL_RUN_T,
  riseMm, frontMm, isOverrun, bandMm, rf,
  PIGMENTS, PIGMENT_IDS, INK_BANDS, bandWidthMm, bandsOverlap,
} from '../src/sim/develop.js';
import { UI } from '../src/ui/strings.js';

/* ---------------- 치수 ---------------- */

test('거름종이는 2 × 10 cm 다', () => {
  // 국내 상용 크로마토그래프지가 20 × 400 mm 낱장이다. 거기서 10 cm 로 잘라 쓴다.
  // **폭을 40 으로 되돌리지 마라** — 20 mL 바이알(외경 28 mm)에 들어가지 않는다.
  assert.equal(PAPER_W_MM, 20);
  assert.equal(PAPER_H_MM, 100);
});

test('거름종이가 전개조에 실제로 들어간다', () => {
  // 그림에서는 안 보이는 종류의 오류다. 숫자로 못 박는다.
  const VIAL_OUTER_MM = 28;      // 20 mL 신틸레이션 바이알 (Kimble · Sigma)
  const WALL_MM = 2;             // 유리 두께 — 안지름은 그만큼 줄어든다
  assert.ok(PAPER_W_MM < VIAL_OUTER_MM - WALL_MM * 2,
    `폭 ${PAPER_W_MM} mm 종이는 외경 ${VIAL_OUTER_MM} mm 전개조에 들어가지 않습니다`);
});

test('원점은 아래에서 2.5 cm 다', () => {
  // Pearson CP11 "Draw a pencil line about 25 mm from the bottom edge".
  // 국내 지도자료도 2 ~ 2.5 cm 다.
  assert.equal(ORIGIN_MM, 25);
});

test('원점이 전개액보다 높다 — 절차대로 하면 잠기지 않는다', () => {
  // Pearson CP11 은 전개액을 "to a depth of no more than 1 cm" 라고 한다.
  // 그 깊이로 부으면 원점(25 mm)이 잠길 수 없다. **이 관계가 이 실험의 전부다.**
  const RECOMMENDED_DEPTH_MM = 10;
  assert.ok(ORIGIN_MM > RECOMMENDED_DEPTH_MM,
    `원점 ${ORIGIN_MM} mm 는 권장 전개액 깊이 ${RECOMMENDED_DEPTH_MM} mm 보다 높아야 합니다`);
  // 그래도 **잠기게 만들 수는 있어야 한다** — 막지 않고 결과로 답하는 실험이므로,
  // 손잡이가 원점을 넘길 수 없으면 그 실패를 아예 못 겪는다.
  assert.ok(MAX_DEPTH_MM > ORIGIN_MM,
    `전개액을 원점보다 깊게 부을 수 없으면 "원점이 잠긴다" 를 겪을 수 없습니다`);
});

/* ---------------- 물리 — 이것이 이 실험의 optics 다 ---------------- */

test('오른 거리는 시간의 제곱근에 비례한다 (Washburn)', () => {
  // 네 배의 시간이 두 배의 거리다. 이 관계가 깨지면 "왜 시간이 아니라 높이를 보고
  // 꺼내는가" 라는 절차의 근거가 사라진다.
  assert.ok(Math.abs(riseMm(400) - 2 * riseMm(100)) < 1e-9);
  assert.ok(Math.abs(riseMm(900) - 3 * riseMm(100)) < 1e-9);
});

test('처음에 쑥 오르다가 갈수록 느려진다', () => {
  const first = riseMm(100) - riseMm(0);
  const later = riseMm(900) - riseMm(800);
  assert.ok(first > later * 3, `앞의 100 이 뒤의 100 보다 훨씬 많이 올라야 합니다 (${first} vs ${later})`);
});

test('전선은 액면에서 시작해 오르고, 종이 끝에서 멈춘다', () => {
  assert.equal(frontMm(0, 5), 5);
  assert.ok(frontMm(100, 5) > 5);
  assert.equal(frontMm(1e9, 5), PAPER_H_MM);
});

test('전선이 종이 끝을 넘어가면 잴 수 없다고 판정한다', () => {
  assert.equal(isOverrun(100, 5), false);
  assert.equal(isOverrun(FULL_RUN_T * 2, 5), true);
});

test('전개액을 깊이 부을수록 전선이 일찍 끝에 닿는다', () => {
  assert.ok(frontMm(400, 20) > frontMm(400, 2));
});

/* ---------------- 띠의 자리 ---------------- */

test('띠는 원점과 전선 사이를 상대 간격으로 나눈다', () => {
  const front = 90;
  const a = bandMm(0.5, front, 10);
  assert.equal(a, 10 + 0.5 * 80);
});

test('전선이 원점에 못 미치면 색소는 원점에 그대로 있다', () => {
  assert.equal(bandMm(0.9, 5, 10), 10);
});

test('Rf 는 출처의 값 그대로다', () => {
  // Pearson Edexcel A-level Biology B, Core Practical 11 학생용 시트 table A.
  // 용매계가 우리와 같다 — "chromatography solvent (1 : 9 mix of propanone : petroleum spirit)".
  // **이 값을 고치려면 출처를 먼저 바꿔라.** 실리카겔 값을 여기 넣으면 띠 순서가 거짓이 된다.
  const rf = Object.fromEntries(PIGMENTS.map((p) => [p.id, p.rf]));
  assert.deepEqual(rf, {
    carotene: 0.95,
    xanthophyll: 0.71,
    chlorophyllA: 0.65,
    chlorophyllB: 0.45,
  });
});

test('종이에서의 순서는 카로틴 > 잔토필 > 엽록소 a > 엽록소 b 다', () => {
  // 교과서가 가르치는 순서이자 **종이(셀룰로스)의 순서**다.
  // 실리카겔 TLC 로 바꾸면 잔토필이 맨 아래로 내려간다 — 그때는 이 배열도 함께 바꿔야 한다.
  assert.deepEqual(PIGMENT_IDS, ['carotene', 'xanthophyll', 'chlorophyllA', 'chlorophyllB']);
  const front = 90;
  const at = PIGMENTS.map((p) => bandMm(p.rf, front));
  for (let i = 1; i < at.length; i++) {
    assert.ok(at[i - 1] > at[i], `${PIGMENTS[i - 1].id} 가 ${PIGMENTS[i].id} 보다 높아야 합니다`);
  }
});

test('빛에 약한 것은 엽록소 두 가지뿐이다', () => {
  const sensitive = PIGMENTS.filter((p) => p.lightSensitive).map((p) => p.id);
  assert.deepEqual(sensitive, ['chlorophyllA', 'chlorophyllB']);
});

test('볼펜 잉크의 가짜 띠는 색소 목록에 들어 있지 않다', () => {
  // 들어 있으면 결과 판정이 잉크를 색소로 센다.
  const ids = new Set(PIGMENT_IDS);
  for (const b of INK_BANDS) assert.equal(ids.has(b.id), false);
});

/* ---------------- 전개율은 학생이 재는 값이다 ---------------- */

test('rf 는 색소 이름을 받지 않는다 — 앱은 정답 Rf 를 갖고 있지 않다', () => {
  assert.equal(rf.length, 2);
  assert.ok(Math.abs(rf(40, 80) - 0.5) < 1e-9);
});

test('잴 수 없는 값이 들어오면 숫자를 지어내지 않는다', () => {
  assert.equal(rf(40, 0), null);
  assert.equal(rf(40, -1), null);
  assert.equal(rf(-1, 80), null);
});

/**
 * **앱이 갖고 있지 않은 답을 갖고 있는 척하지 않는가.**
 *
 * `develop.js` 에는 실측 Rf 가 있다(Pearson CP11). 그건 **띠를 그릴 자리**이지
 * 학생에게 알려 줄 답이 아니다. 화면이 "카로틴의 Rf 는 0.95" 라고 먼저 말해 버리면
 * 재고 나눌 이유가 사라진다 — Rf 는 **학생이 자로 재어 구하는 값**이다.
 *
 * 정리 단계에서 대조표로 보여 줄지는 따로 판단할 일이고, 아직 하지 않았다.
 * 하게 되면 이 검사도 함께 손봐야 한다 — **끄지 말고, 어디까지 허용할지를 다시 적어라.**
 *
 * 처음에는 `src/ui/`·`src/render/` 소스에서 그 숫자를 문자열로 찾았다. **그게 틀렸다** —
 * 0.5 같은 값은 좌표와 불투명도에도 나와서 애먼 줄에 걸렸다. 산문과 코드를 함께 훑으면
 * 오탐이 온다 (PLAYBOOK §9-3).
 *
 * 대신 이 저장소의 불변식을 쓴다 — **화면에 보이는 한국어는 전부 `strings.js` 에 있다.**
 * 색소 이름이나 「Rf·전개율」 옆에 소수가 붙어 있으면 그건 화면이 답을 말한 것이다.
 */
test('화면 문자열이 색소의 Rf 값을 말하지 않는다', () => {
  const strings = [];
  const walk = (o, path) => {
    if (typeof o === 'string') strings.push([path, o]);
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  };
  walk(UI, 'UI');
  assert.ok(strings.length > 20, '문자열 표를 못 찾았습니다');

  const names = ['카로틴', '잔토필', '엽록소', 'Rf', '전개율'];
  // 이름·용어와 소수가 **같은 문장 안에서 12자 안에** 붙어 있으면 값을 말한 것으로 본다.
  const said = new RegExp(`(${names.join('|')})[^.。\n]{0,12}?0\\.\\d`);
  const saidBack = new RegExp(`0\\.\\d[^.。\n]{0,12}?(${names.join('|')})`);
  for (const [path, text] of strings) {
    assert.equal(said.test(text) || saidBack.test(text), false,
      `${path} 가 색소의 Rf 값을 말합니다: "${text}" — Rf 는 학생이 재는 값입니다`);
  }
});

/* ---------------- 번짐 ---------------- */

test('띠는 올라간 거리에 비례해 굵어진다', () => {
  assert.ok(bandWidthMm(2, 60) > bandWidthMm(2, 10));
});

test('절차대로 하면 띠 넷이 다 갈라지고, 원점을 크게 찍으면 뭉친다', () => {
  /*
   * **가장 빡빡한 자리는 잔토필(0.71)과 엽록소 a(0.65)** 다. 실측 Rf 로 바꾸고 나서
   * 이 둘이 5 mm 안쪽으로 붙었고, 그때 `BAND_SPREAD` 가 0.12 라 절차를 다 지켜도
   * 둘이 뭉쳐 보였다 — 실제로는 갈라지는 것이라 틀린 그림이었다.
   * 이 검사가 그 뒤로 그 자리를 지킨다.
   */
  const front = 93;
  const at = PIGMENTS.map((p) => bandMm(p.rf, front));
  const widths = (spotMm) => at.map((mm) => bandWidthMm(spotMm, mm - ORIGIN_MM));

  const tight = widths(2);
  for (let i = 1; i < at.length; i++) {
    assert.equal(bandsOverlap(at[i - 1], tight[i - 1], at[i], tight[i]), false,
      `${PIGMENTS[i - 1].id} 와 ${PIGMENTS[i].id} 가 절차대로 했는데도 뭉쳐 보입니다`);
  }

  const wide = widths(12);
  const anyMerged = at.some((mm, i) => i > 0 && bandsOverlap(at[i - 1], wide[i - 1], mm, wide[i]));
  assert.ok(anyMerged, '원점을 크게 찍으면 어딘가는 뭉쳐 보여야 합니다');
});
