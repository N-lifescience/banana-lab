/**
 * 결과 그래프 테스트.
 *
 * 이 그래프가 이 실험의 **대답**이다. 실험대는 잘못된 조작을 막지 않고, 여기서 답한다.
 * 그러므로 여기서 볼 것은 「예쁜가」가 아니라 **세 갈래를 실제로 갈라 놓는가**다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderGraph, graphNotes, classify, axisValues, yMaxOf, GRAPH } from '../src/render/graph.js';
import { initialState, CHOICES } from '../src/sim/state.js';
import { OBSERVE_LIMIT_S } from '../src/sim/kinetics.js';
import { UI } from '../src/ui/strings.js';

const DESIGN = { ...initialState().design, independent: 'temp' };
const base = { tempC: 20, ph: 7, h2o2Pct: 3, extractPct: 100, extractBoiled: false, buffered: true };
const trial = (at, over = {}, rest = {}) => ({
  at, independent: 'temp', conditions: { ...base, ...over },
  seconds: 25, floated: true, offDesign: [], ...rest,
});

/* ---------------- 세 갈래를 가르는가 ---------------- */

test('설계대로 잰 시행만 선으로 이어진다', () => {
  assert.equal(classify(trial(0), DESIGN), 'line');
});

test('통제변인이 어긋난 시행은 선에서 떨어져 나온다', () => {
  assert.equal(classify(trial(0, { h2o2Pct: 1 }, { offDesign: ['h2o2Pct'] }), DESIGN), 'off-design');
});

test('안 뜬 시행은 따로 갈린다', () => {
  assert.equal(classify(trial(0, {}, { floated: false, seconds: null }), DESIGN), 'no-float');
});

test('조작변인이 다른 시행은 같은 선에 이어지지 않는다', () => {
  assert.equal(classify({ ...trial(0), independent: 'ph' }, DESIGN), 'other-variable');
});

test('조작변인을 안 골랐으면 모든 점이 「알 수 없음」이다', () => {
  assert.equal(classify(trial(0), initialState().design), 'unknown');
});

/* ---------------- 지우지 않는가 ---------------- */

test('어긋난 시행도 안 뜬 시행도 그래프에 그려진다', () => {
  const trials = [
    trial(0),
    trial(1, { h2o2Pct: 1 }, { offDesign: ['h2o2Pct'] }),
    trial(2, { tempC: 100 }, { floated: false, seconds: null }),
  ];
  const svg = renderGraph(trials, DESIGN);
  assert.equal(svg.match(/data-points="(\d+)"/)[1], '3');
  for (const t of trials) {
    assert.ok(svg.includes(`id="g-p${t.at}"`), `${t.at}번 시행이 그려지지 않았습니다`);
  }
});

test('선은 설계대로 잰 점만 잇는다', () => {
  const svg = renderGraph([
    trial(0, { tempC: 0 }), trial(1, { tempC: 37 }),
    trial(2, { tempC: 20, h2o2Pct: 1 }, { offDesign: ['h2o2Pct'] }),
  ], DESIGN);
  const d = svg.match(/id="g-line" d="M ([^"]+)"/)[1];
  assert.equal(d.split(' L ').length, 2, '어긋난 점이 선에 끼어 있습니다');
});

test('이을 점이 하나뿐이면 선을 그리지 않는다', () => {
  assert.ok(!renderGraph([trial(0)], DESIGN).includes('id="g-line"'));
});

/* ---------------- 안 뜬 시행에 시간을 지어내지 않는가 ---------------- */

test('안 뜬 시행은 시간 축이 아니라 위쪽 칸에 놓인다', () => {
  const svg = renderGraph([trial(0, { tempC: 100 }, { floated: false, seconds: null })], DESIGN);
  const y = Number(svg.match(/id="g-p0"[\s\S]*?M [\d.]+,([\d.]+)/)[1]);
  assert.ok(y < GRAPH.top + GRAPH.noFloatBand,
    '안 뜬 시행이 시간 축 위에 있습니다 — 학생이 없는 값을 읽게 됩니다');
});

/* ---------------- 세로축이 데이터를 따라가는가 ---------------- */

/**
 * 축을 관찰 시간(300초)으로 고정해 두었더니 **37 ℃ 8초와 20 ℃ 25초가 축에 붙어
 * 한 점처럼 보였다.** 이 실험에서 견주는 것이 바로 그 차이다.
 */
test('세로축이 잰 값에 맞춰지고, 눈금은 읽을 수 있는 수로 올림된다', () => {
  assert.equal(yMaxOf([trial(0, {}, { seconds: 8.2 })]), 10);
  assert.equal(yMaxOf([trial(0, {}, { seconds: 25 })]), 30);
  assert.equal(yMaxOf([trial(0, {}, { seconds: 100 })]), 120);
  assert.equal(yMaxOf([]), 10, '아무것도 안 쟀을 때도 축이 무너지지 않아야 합니다');
});

test('안 뜬 시행은 세로축 꼭대기를 끌어올리지 않는다', () => {
  // 안 뜬 것은 시간이 **없는** 것이라 축의 값이 아니다.
  const trials = [trial(0, {}, { seconds: 8.2 }), trial(1, {}, { floated: false, seconds: null })];
  assert.equal(yMaxOf(trials), 10);
});

test('가장 빠른 점과 가장 느린 점이 그림에서 실제로 갈린다', () => {
  const svg = renderGraph([
    trial(0, { tempC: 37 }, { seconds: 8.2 }),
    trial(1, { tempC: 20 }, { seconds: 25 }),
  ], DESIGN);
  const ys = [...svg.matchAll(/<circle id="g-p\d+" cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(ys.length, 2);
  assert.ok(Math.abs(ys[0] - ys[1]) > 40,
    `두 점이 ${Math.abs(ys[0] - ys[1]).toFixed(0)} px 밖에 안 떨어져 있습니다 — 견줄 수가 없습니다`);
});

test('안 뜬 시행 옆에 숫자가 붙지 않는다', () => {
  const svg = renderGraph([trial(0, { tempC: 100 }, { floated: false, seconds: null })], DESIGN);
  // 안 뜬 시행만 있으면 세로축 꼭대기가 바닥값(10초)이라 300 이 어디에도 안 나온다.
  assert.ok(!svg.includes(`>${OBSERVE_LIMIT_S}<`), '관찰 시간이 그 시행의 값처럼 적혀 있습니다');
});

/* ---------------- 색만으로 가르지 않는가 ---------------- */

test('갈래마다 모양이 다르다 — 색만으로 가르지 않는다', () => {
  // 색각 이상이 있으면 색으로만 갈린 점은 같아 보인다. 모양이 먼저다.
  const one = (rest, over = {}) => renderGraph([trial(0, over, rest)], DESIGN);
  assert.ok(/id="g-p0"[^>]*<?/.test(one({})) && one({}).includes('<circle id="g-p0"'), '보통 점이 동그라미가 아닙니다');
  assert.ok(one({ offDesign: ['h2o2Pct'] }, { h2o2Pct: 1 }).includes('<rect id="g-p0"'), '어긋난 점이 네모가 아닙니다');
  assert.ok(one({ floated: false, seconds: null }).includes('<g id="g-p0"'), '안 뜬 점이 가위표가 아닙니다');
});

test('글자와 축은 currentColor 다 — 다크 모드에서도 읽힌다', () => {
  // 고정 검정(INK)이면 다크 모드에서 눈금·축 이름·「뜨지 않음」 칸이 통째로 안 보였다.
  const svg = renderGraph([trial(0), trial(1, { tempC: 37 }, { seconds: 8 }),
    trial(2, { tempC: 100 }, { floated: false, seconds: null })], DESIGN);
  const texts = svg.match(/<text[^>]*>/g) ?? [];
  assert.ok(texts.length > 0);
  for (const t of texts) assert.match(t, /fill="currentColor"/, `글자가 고정색입니다: ${t}`);
  assert.doesNotMatch(svg, /#[0-9A-Fa-f]{6}"[^>]*>[^<]*(초|℃|뜨지 않음)/, '축 글자에 고정 색이 남아 있습니다');
  assert.ok(svg.includes('<g id="g-p2" stroke="currentColor"'), '안 뜬 점(가위표)이 고정색입니다');
});

/* ---------------- 축 ---------------- */

test('재지 않은 조건도 가로축에 남는다', () => {
  // 잰 것만 그리면 「37 ℃ 만 재고 끝냈다」와 「다섯 조건을 다 쟀다」가 같은 그림이 된다.
  const svg = renderGraph([trial(0, { tempC: 37 })], DESIGN);
  for (const v of CHOICES.tempC) {
    assert.ok(svg.includes(`>${UI.units.tempC(v)}<`), `${v} ℃ 가 가로축에 없습니다`);
  }
});

test('조작변인이 바뀌면 가로축도 바뀐다', () => {
  assert.deepEqual(axisValues({ independent: 'temp' }), CHOICES.tempC);
  assert.deepEqual(axisValues({ independent: 'ph' }), CHOICES.ph);
  assert.deepEqual(axisValues({ independent: null }), []);
});

/* ---------------- 설명이 무엇을 말하는가 ---------------- */

test('어긋난 시행의 설명이 무엇이 어긋났는지 이름으로 말한다', () => {
  // 「통제변인이 다릅니다」로는 무엇을 고쳐야 할지 알 수 없다.
  const notes = graphNotes([trial(0, { h2o2Pct: 1 }, { offDesign: ['h2o2Pct'] })], DESIGN).join(' ');
  assert.ok(notes.includes(UI.conditions.h2o2Pct), `어긋난 조건의 이름이 없습니다: ${notes}`);
});

test('시행이 없으면 나무라지 않고 무엇을 하면 되는지 말한다', () => {
  assert.deepEqual(graphNotes([], DESIGN), [UI.graph.empty]);
});

test('설계를 안 했어도 그래프는 그려지고, 왜 축이 없는지 말해 준다', () => {
  const empty = initialState().design;
  const svg = renderGraph([trial(0)], empty);
  assert.ok(svg.includes('data-points="1"'), '설계가 없다고 그래프를 안 그렸습니다');
  assert.ok(graphNotes([trial(0)], empty).join(' ').includes('조작변인'));
});

/* ---------------- 순수 함수 ---------------- */

test('같은 시행이면 같은 그림이 나온다', () => {
  const trials = [trial(0), trial(1, { tempC: 37 })];
  assert.equal(renderGraph(trials, DESIGN), renderGraph([...trials], { ...DESIGN }));
});

test('idPrefix 가 다르면 id 가 하나도 겹치지 않는다', () => {
  const idsOf = (svg) => svg.match(/id="[^"]+"/g) ?? [];
  const a = renderGraph([trial(0)], DESIGN, { idPrefix: 'left' });
  const b = renderGraph([trial(0)], DESIGN, { idPrefix: 'right' });
  assert.deepEqual(idsOf(a).filter((x) => idsOf(b).includes(x)), []);
});

test('난수를 쓰지 않는다', () => {
  const src = readFileSync(new URL('../src/render/graph.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('Math.random') && !src.includes('Date.now'));
});

/* ---------------- 저장된 판정이 아니라 지금 설계로 잰다 ---------------- */

/**
 * 같은 두 측정인데 **통제값을 언제 정했느냐**에 따라 라벨이 뒤집혔다.
 *
 * `trial.offDesign` 은 기록하던 순간의 판정이라 그 뒤로 얼어 있는데, 그래프의 가로축은
 * 지금 설계로 그려진다. 둘을 섞어 읽으니 **설계와 같은 조건인데 빈 네모**,
 * **설계와 다른 조건인데 깨끗한 점**이 나왔고, 그 차이는 화면 어디에도 안 나왔다.
 */
test('설계를 고치면 어떤 점이 쓸 수 있는지가 함께 바뀐다', () => {
  const t3 = { ...trial(0, { h2o2Pct: 3 }), offDesign: [] };          // 기록 당시엔 설계대로였다
  const t1 = { ...trial(1, { h2o2Pct: 1 }), offDesign: ['h2o2Pct'] }; // 기록 당시엔 어긋났다
  // 설계를 1 % 로 바꾼다 — 이제 t1 이 설계대로이고 t3 이 어긋난다.
  const after = { ...DESIGN, controls: { ...DESIGN.controls, h2o2Pct: 1 } };
  assert.equal(classify(t3, after), 'off-design', '저장된 판정을 그대로 믿고 있습니다');
  assert.equal(classify(t1, after), 'line', '저장된 판정을 그대로 믿고 있습니다');
});

test('설명도 지금 설계로 다시 잰다', () => {
  const t = { ...trial(0, { h2o2Pct: 3 }), offDesign: [] };
  const after = { ...DESIGN, controls: { ...DESIGN.controls, h2o2Pct: 1 } };
  assert.ok(graphNotes([t], after).join(' ').includes(UI.conditions.h2o2Pct),
    '지금 설계와 어긋난 것을 설명이 말해 주지 않습니다');
});

test('끓인 감자즙으로 잰 시행이 선에서 떨어져 나온다', () => {
  // 통제변인에 없던 시절에는 이 시행이 깨끗한 점으로 선 위에 얹혔다.
  const boiled = trial(0, { extractBoiled: true }, { offDesign: [] });
  assert.equal(classify(boiled, DESIGN), 'off-design');
});
