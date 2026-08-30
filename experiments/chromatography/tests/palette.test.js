/**
 * 이 실험의 색 규칙.
 *
 * 가장 중요한 것은 **색소 네 색을 기구에 쓰지 않는다** 는 것이다.
 * 실험대에 청록색 병이 있으면 학생은 그것을 결과와 헷갈린다. 바나나랩에서 실험대에
 * 파란 배관을 넣으려다 막았던 것과 같은 이유다 (NEW-EXPERIMENT.md §4).
 *
 * 사람 눈으로 지킬 수 없다 — 애셋이 열다섯이고 색은 hex 문자열이다. 기계가 지킨다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { EXP_PALETTE, paintExp } from '../src/style/palette.experiment.js';
import { PALETTE } from '../src/style/tokens.js';
import { ASSETS, SAMPLE_STATES } from '../src/assets/index.js';
import { PIGMENTS } from '../src/sim/develop.js';

/** 결과색 — 이 넷이 기구에 나타나면 안 된다. */
const RESULT_TONES = PIGMENTS.map((p) => p.tone);

test('색소 네 가지가 모두 팔레트에 있다', () => {
  for (const tone of RESULT_TONES) {
    assert.ok(EXP_PALETTE[tone], `EXP_PALETTE.${tone} 이 없습니다`);
    assert.equal(EXP_PALETTE[tone].length, 2, `${tone} 은 [기본, 음영] 두 단계여야 합니다`);
  }
});

test('색소 네 색이 tokens.js 에 들어가 있지 않다', () => {
  // tokens.js 는 실험을 합칠 때 diff 가 0 이어야 한다 (MERGE-AND-DEPLOY.md §3.1).
  const shared = new Set(Object.values(PALETTE).flat());
  for (const tone of RESULT_TONES) {
    for (const hex of EXP_PALETTE[tone]) {
      assert.equal(shared.has(hex), false, `${hex} 가 tokens.js 에 있습니다 — 이 실험의 색은 palette.experiment.js 에만 둡니다`);
    }
  }
});

/**
 * **결과색을 기구에 쓰지 않는다.**
 *
 * 소스를 훑는 대신 **실제로 그려진 SVG** 를 본다. 소스만 보면 상수 이름을 바꿔 우회할 수
 * 있고, 반대로 주석에 hex 를 적어 둔 것에 걸린다. 그려 놓고 색을 세는 편이 정확하다.
 */
test('색소 네 색이 기구 애셋의 그림에 나타나지 않는다', () => {
  const banned = new Map();
  for (const tone of RESULT_TONES) {
    for (const hex of EXP_PALETTE[tone]) banned.set(hex.toUpperCase(), tone);
  }
  for (const [name, mod] of Object.entries(ASSETS)) {
    for (const state of SAMPLE_STATES[name] ?? [{}]) {
      const svg = mod.render(state).toUpperCase();
      for (const [hex, tone] of banned) {
        assert.equal(svg.includes(hex), false,
          `${name} 애셋에 결과색 ${tone}(${hex}) 이 쓰였습니다 — 학생이 결과와 헷갈립니다`);
      }
    }
  }
});

test('상층액 초록과 엽록소 b 황록은 서로 충분히 멀다', () => {
  // 원심관과 띠가 같은 색으로 보이면 화면이 결과를 먼저 말해 버린다.
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  assert.ok(dist(EXP_PALETTE.pigmentJuice[0], EXP_PALETTE.chlorophyllB[0]) > 120,
    '상층액 색과 엽록소 b 색이 너무 가깝습니다');
  assert.ok(dist(EXP_PALETTE.leafFresh[0], EXP_PALETTE.chlorophyllB[0]) > 80,
    '잎 색과 엽록소 b 색이 너무 가깝습니다');
});

test('paintExp 는 팔레트에 없는 색을 막는다', () => {
  assert.throws(() => paintExp('없는색'), /palette\.experiment/);
  assert.throws(() => paintExp('carotene', { stroke: 'thick' }), /선 두께/);
  assert.ok(paintExp('carotene').includes(EXP_PALETTE.carotene[0]));
});
