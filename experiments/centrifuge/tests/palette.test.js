/**
 * 이 실험의 색 규칙.
 *
 * 가장 중요한 것은 **결과색을 기구에 쓰지 않는다** 는 것이다.
 * 실험대에 암적색 통이 있으면 학생은 그것을 결과와 헷갈린다. 바나나랩에서 실험대에
 * 파란 배관을 넣으려다 막았던 것과 같은 이유다 (NEW-EXPERIMENT.md §4).
 *
 * 사람 눈으로 지킬 수 없다 — 애셋이 열셋이고 색은 hex 문자열이다. 기계가 지킨다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXP_PALETTE, paintExp } from '../src/style/palette.experiment.js';
import { PALETTE } from '../src/style/tokens.js';
import { ASSETS, SAMPLE_STATES } from '../src/assets/index.js';

/**
 * **결과색** — 이 다섯이 기구에 나타나면 안 된다.
 *
 * 갈라진 층의 색과 응고한 혈병의 색이다. 이 색들이 나오는 자리는 결과 렌더러
 * (`src/render/tube.js`) 하나뿐이어야 한다.
 */
const RESULT_TONES = ['packedCells', 'buffyCoat', 'plasma', 'serum', 'clot'];

/** 기구에 써도 되는 이 실험의 색. 재료색과 기구색이다. */
const MATERIAL_TONES = ['bloodFresh', 'clay', 'heparinBand', 'alcohol'];

test('결과색 다섯이 모두 팔레트에 있다', () => {
  for (const tone of RESULT_TONES) {
    assert.ok(EXP_PALETTE[tone], `EXP_PALETTE.${tone} 이 없습니다`);
    assert.equal(EXP_PALETTE[tone].length, 2, `${tone} 은 [기본, 음영] 두 단계여야 합니다`);
  }
});

test('이 실험의 색이 tokens.js 에 들어가 있지 않다', () => {
  // tokens.js 는 실험을 합칠 때 diff 가 0 이어야 한다 (MERGE-AND-DEPLOY.md §3.1).
  const shared = new Set(Object.values(PALETTE).flat());
  for (const [tone, pair] of Object.entries(EXP_PALETTE)) {
    for (const hex of pair) {
      assert.equal(shared.has(hex), false,
        `${hex}(${tone}) 가 tokens.js 에 있습니다 — 이 실험의 색은 palette.experiment.js 에만 둡니다`);
    }
  }
});

/**
 * **결과색을 기구에 쓰지 않는다.**
 *
 * 소스를 훑는 대신 **실제로 그려진 SVG** 를 본다. 소스만 보면 상수 이름을 바꿔 우회할 수
 * 있고, 반대로 주석에 hex 를 적어 둔 것에 걸린다. 그려 놓고 색을 세는 편이 정확하다.
 */
test('결과색이 기구 애셋의 그림에 나타나지 않는다', () => {
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

/**
 * **선홍(생혈)과 암적(압축된 적혈구층)은 충분히 멀어야 한다.**
 *
 * 이 둘이 가까우면 "다져져서 어두워졌다" 는 변화가 화면에서 사라진다.
 * 그 변화가 이 실험에서 눈으로 보는 것의 절반이다 (AGENTS.md §2.5).
 */
test('선홍과 암적이 서로 충분히 멀다', () => {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  assert.ok(dist(EXP_PALETTE.bloodFresh[0], EXP_PALETTE.packedCells[0]) > 80,
    '채혈 순간의 핏방울과 압축된 적혈구층이 같은 색으로 보입니다');
});

/**
 * **연층은 혈장과 갈려야 한다.**
 *
 * 한국어 위키백과는 버피코트를 「담황색」이라고 적는데, 그 색으로 칠하면 혈장과 구분이
 * 안 된다. 학생이 봐야 하는 것이 바로 그 얇은 띠라서, 그림에서는 치명적이다.
 */
test('연층(회백색)과 혈장(담황색)이 서로 충분히 멀다', () => {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  assert.ok(dist(EXP_PALETTE.buffyCoat[0], EXP_PALETTE.plasma[0]) > 45,
    '연층이 혈장과 같은 색으로 보입니다 — 「담황색」이 아니라 회백색입니다');
});

test('기구에 써도 되는 색은 결과색과 겹치지 않는다', () => {
  const result = new Set(RESULT_TONES.flatMap((t) => EXP_PALETTE[t]));
  for (const tone of MATERIAL_TONES) {
    assert.ok(EXP_PALETTE[tone], `EXP_PALETTE.${tone} 이 없습니다`);
    for (const hex of EXP_PALETTE[tone]) {
      assert.equal(result.has(hex), false, `${tone} 이 결과색과 같은 hex 를 씁니다: ${hex}`);
    }
  }
});

test('paintExp 는 팔레트에 없는 색을 막는다', () => {
  assert.throws(() => paintExp('없는색'), /palette\.experiment/);
  assert.throws(() => paintExp('bloodFresh', { stroke: 'thick' }), /선 두께/);
  assert.ok(paintExp('bloodFresh').includes(EXP_PALETTE.bloodFresh[0]));
});
