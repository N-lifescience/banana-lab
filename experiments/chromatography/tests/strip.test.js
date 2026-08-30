/**
 * 결과 렌더러 — 거름종이 위의 색 띠.
 *
 * 여기서 검사하는 것은 **그림이 예쁜가**가 아니라 (그건 하네스에서 사람이 본다)
 * 같은 상태가 같은 그림을 내는가, 한 화면에 여러 장을 그려도 서로 간섭하지 않는가,
 * 그리고 **화면이 답을 먼저 말하지 않는가** 다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderStrip, visibleBands } from '../src/render/strip.js';
import { PIGMENT_IDS, ORIGIN_MM, PAPER_H_MM } from '../src/sim/develop.js';
import { initialState, stripParams } from '../src/sim/state.js';

/** 절차를 다 지킨 종이 */
const GOOD = {
  originMm: ORIGIN_MM, marker: 'pencil', spots: 15, spotMm: 2,
  load: 0.9, rawLoad: 0.9, grit: 0, frontMm: 93, overrun: false,
  markedFront: 93, markedBands: false, rulerPlaced: false,
  submerged: false, washedOut: 0, chlorophyllKept: 1, wetness: 0.4,
  torn: false, depthMm: 0, inVial: false, seed: 7,
};

test('같은 상태 + 같은 시드면 같은 그림이 나온다', () => {
  assert.equal(renderStrip(GOOD), renderStrip(GOOD));
  assert.notEqual(renderStrip(GOOD), renderStrip({ ...GOOD, load: 0.2 }));
});

test('idPrefix 가 다르면 한 화면에 두 장을 그려도 서로 간섭하지 않는다', () => {
  // 같은 id 가 둘이면 브라우저는 먼저 나온 것 하나만 쓴다 — **에러 없이 조용히** 틀린다.
  const a = renderStrip(GOOD, { idPrefix: 'card1-' });
  const b = renderStrip({ ...GOOD, load: 0.3 }, { idPrefix: 'card2-' });
  const ids = (svg) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const shared = ids(a).filter((id) => ids(b).includes(id));
  assert.deepEqual(shared, [], `두 장이 같은 id 를 씁니다: ${shared.join(', ')}`);
});

test('기본 상태로도 그림이 나온다 — 인자가 비어도 터지지 않는다', () => {
  assert.ok(renderStrip().startsWith('<svg'));
  assert.ok(renderStrip(stripParams(initialState())).startsWith('<svg'));
});

/* ---------------- 띠가 답하는 것 ---------------- */

test('띠 순서는 위에서부터 카로틴 · 잔토필 · 엽록소 a · 엽록소 b 다', () => {
  const bands = visibleBands(GOOD);
  const sorted = [...bands].sort((a, b) => b.atMm - a.atMm).map((b) => b.id);
  assert.deepEqual(sorted, PIGMENT_IDS);
});

test('원점이 잠기면 띠가 하나도 없다', () => {
  assert.deepEqual(visibleBands({ ...GOOD, submerged: true }), []);
});

test('색소를 안 실었으면 띠가 없다', () => {
  assert.deepEqual(visibleBands({ ...GOOD, load: 0 }), []);
});

test('덜 찍으면 띠가 옅다 — 없어지지는 않는다', () => {
  const faint = visibleBands({ ...GOOD, load: 0.15 });
  assert.equal(faint.length, 4);
  for (const b of faint) assert.ok(b.alpha < 0.3, `${b.id} 가 옅어야 합니다`);
});

test('원점이 크면 띠가 굵어진다', () => {
  const tight = visibleBands({ ...GOOD, spotMm: 2 });
  const wide = visibleBands({ ...GOOD, spotMm: 12 });
  for (let i = 0; i < tight.length; i++) {
    assert.ok(wide[i].widthMm > tight[i].widthMm, `${tight[i].id} 가 굵어져야 합니다`);
  }
});

test('일찍 꺼내면 띠 넷이 원점 가까이 뭉친다', () => {
  const early = visibleBands({ ...GOOD, frontMm: 25 });
  const spread = Math.max(...early.map((b) => b.atMm)) - Math.min(...early.map((b) => b.atMm));
  const late = visibleBands({ ...GOOD, frontMm: 93 });
  const lateSpread = Math.max(...late.map((b) => b.atMm)) - Math.min(...late.map((b) => b.atMm));
  assert.ok(spread < lateSpread / 3, '일찍 꺼내면 훨씬 좁게 뭉쳐야 합니다');
});

test('빛을 쬐면 청록·황록 두 띠가 먼저 옅어지고 주황·노랑은 남는다', () => {
  const dark = visibleBands(GOOD);
  const lit = visibleBands({ ...GOOD, chlorophyllKept: 0.15 });
  const by = (bs) => Object.fromEntries(bs.map((b) => [b.id, b.alpha]));
  const d = by(dark), l = by(lit);
  assert.ok(l.chlorophyllA < d.chlorophyllA * 0.3);
  assert.ok(l.chlorophyllB < d.chlorophyllB * 0.3);
  assert.equal(l.carotene, d.carotene, '카로틴은 빛에 그대로여야 합니다');
  assert.equal(l.xanthophyll, d.xanthophyll, '잔토필은 빛에 그대로여야 합니다');
});

test('볼펜으로 그으면 잉크의 가짜 띠가 섞이고, 색소로 세지 않는다', () => {
  const bands = visibleBands({ ...GOOD, marker: 'pen' });
  assert.equal(bands.filter((b) => !b.ink).length, 4, '색소는 여전히 넷입니다');
  assert.ok(bands.some((b) => b.ink), '잉크 띠가 있어야 합니다');
});

/* ---------------- 화면이 답을 먼저 말하지 않는가 ---------------- */

test('띠 이름표는 기본으로 꺼져 있다', () => {
  assert.equal(renderStrip(GOOD).includes('카로틴'), false,
    '이름표가 기본으로 켜져 있으면 화면이 채점할 답을 먼저 말합니다');
  assert.ok(renderStrip(GOOD, { labels: true }).includes('카로틴'));
});

test('그림 어디에도 전개율 값이 적혀 있지 않다', () => {
  // 자 눈금(cm 숫자)은 재라고 있는 것이고, Rf 는 학생이 계산하는 값이다.
  const svg = renderStrip({ ...GOOD, rulerPlaced: true, markedBands: true }, { labels: true });
  assert.equal(/Rf|전개율/.test(svg), false, '앱은 정답 Rf 를 갖고 있지 않습니다');
  const text = [...svg.matchAll(/>([^<>]*)</g)].map((m) => m[1]).join(' ');
  assert.equal(/0\.\d/.test(text), false, `그림에 소수가 적혀 있습니다: "${text.trim()}"`);
});

test('자를 대면 눈금이 나오고, 대지 않으면 안 나온다', () => {
  assert.equal(renderStrip(GOOD).includes('strip-ruler'), false);
  assert.ok(renderStrip({ ...GOOD, rulerPlaced: true }).includes('strip-ruler'));
});

test('전선이 종이 끝을 넘어가면 전선 줄을 그리지 않는다', () => {
  // 어디였는지 알 수 없는 것을 그려 주면, 화면이 학생 대신 답을 만들어 준 셈이 된다.
  const over = renderStrip({ ...GOOD, overrun: true, markedFront: null, frontMm: PAPER_H_MM, wetness: 0.5 });
  const lines = [...over.matchAll(/<line[^>]*>/g)].map((m) => m[0]);
  assert.equal(lines.filter((l) => l.includes('rgba(120,140,160')).length, 0);
});

test('찢어진 종이에는 띠도 눈금도 없다', () => {
  const svg = renderStrip({ ...GOOD, torn: true, rulerPlaced: true });
  assert.ok(svg.includes('strip--torn'));
  assert.equal(svg.includes('linearGradient'), false);
});
