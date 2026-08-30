/**
 * 결과 그래프 테스트.
 *
 * 이 그래프가 이 실험의 **대답**이다. 실험대는 잘못된 조작을 막지 않고, 여기서 답한다.
 * 그러므로 여기서 볼 것은 「예쁜가」가 아니라 **갈래를 실제로 갈라 놓는가**다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderGraph, graphNotes, classify, axisValues, yMaxOf } from '../src/render/graph.js';
import { initialState, CHOICES, STANDARD_TOTAL_ML } from '../src/sim/state.js';
import { YEAST_POUR_ML } from '../src/sim/fermentation.js';
import { UI } from '../src/ui/strings.js';

const DESIGN = { ...initialState().design, independent: 'temp' };
const base = {
  tempC: 33, glucosePct: 10, yeastMl: YEAST_POUR_ML, totalMl: STANDARD_TOTAL_ML, plugged: true,
};
const trial = (at, over = {}, rest = {}) => ({
  at, independent: 'temp', conditions: { ...base, ...over },
  gasMl: 12, minutes: 20, kohChecked: false, offDesign: [], ...rest,
});

/* ---------------- 갈래를 가르는가 ---------------- */

test('설계대로 한 시행만 선으로 이어진다', () => {
  assert.equal(classify(trial(0), DESIGN), 'line');
});

test('통제변인이 어긋난 시행은 선에서 떨어져 나온다', () => {
  assert.equal(classify(trial(0, { glucosePct: 5 }), DESIGN), 'off-design');
});

test('효모액을 안 넣은 시행도 통제변인이 어긋난 것이다', () => {
  assert.equal(classify(trial(0, { yeastMl: 0 }), DESIGN), 'off-design');
});

test('솜마개를 안 한 시행도 통제변인이 어긋난 것이다', () => {
  assert.equal(classify(trial(0, { plugged: false }), DESIGN), 'off-design');
});

test('조작변인이 다른 시행은 같은 선에 이어지지 않는다', () => {
  assert.equal(classify({ ...trial(0), independent: 'glucose' }, DESIGN), 'other-variable');
});

test('조작변인을 안 골랐으면 모든 점이 「알 수 없음」이다', () => {
  assert.equal(classify(trial(0), initialState().design), 'unknown');
});

/**
 * 총 부피는 **설계 칩에 없는 조건**이다. 그래도 비교가 성립하지 않는 것은 마찬가지라
 * 선에서 떼어 놓는다 — 「대조군에 증류수를 넣는 까닭」이 화면에서 대답하는 자리다.
 */
test('총 부피가 남들과 다른 시행은 선에서 떨어져 나온다', () => {
  const trials = [trial(0, { tempC: 20 }), trial(1, { tempC: 30 }), trial(2, { tempC: 40, totalMl: 20 })];
  const outliers = new Set([2]);
  assert.equal(classify(trials[0], DESIGN, outliers), 'line');
  assert.equal(classify(trials[2], DESIGN, outliers), 'off-design');
});

/* ---------------- 지우지 않는가 ---------------- */

test('어긋난 시행도 기체가 안 난 시행도 그래프에 그려진다', () => {
  const trials = [
    trial(0),
    trial(1, { glucosePct: 5 }),
    trial(2, { tempC: 55 }, { gasMl: 0.05 }),
  ];
  const svg = renderGraph(trials, DESIGN);
  assert.equal(svg.match(/data-points="(\d+)"/)[1], '3');
  for (const t of trials) {
    assert.ok(svg.includes(`id="g-p${t.at}"`), `${t.at}번 시행이 그려지지 않았습니다`);
  }
});

test('선은 설계대로 한 점만 잇는다', () => {
  const svg = renderGraph([
    trial(0, { tempC: 20 }, { gasMl: 5 }),
    trial(1, { tempC: 30 }, { gasMl: 11 }),
    trial(2, { tempC: 40, glucosePct: 5 }, { gasMl: 3 }),
  ], DESIGN);
  const d = svg.match(/id="g-line" d="M ([^"]+)"/)[1];
  assert.equal(d.split(' L ').length, 2, '어긋난 점까지 선에 끼워 넣었습니다');
});

test('이을 점이 하나뿐이면 선을 그리지 않는다', () => {
  assert.ok(!renderGraph([trial(0)], DESIGN).includes('id="g-line"'));
});

/* ---------------- 축이 눈에 보이는가 ---------------- */

test('세로축이 잰 값에 맞춰지고, 눈금은 읽을 수 있는 수로 올림된다', () => {
  assert.equal(yMaxOf([]), 4, '아무것도 안 쟀는데 축이 무너집니다');
  assert.equal(yMaxOf([trial(0, {}, { gasMl: 4.2 })]), 8);
  assert.equal(yMaxOf([trial(0, {}, { gasMl: 11.04 })]), 12);
  assert.equal(yMaxOf([trial(0, {}, { gasMl: 19.9 })]), 20);
});

/**
 * **눈금이 읽히는가.** 다섯 눈금(0·¼·½·¾·1)이 전부 정수로 떨어져야 한다.
 * 꼭대기를 15 로 두었을 때 0·4·8·11·15 가 나왔다 — 반올림한 수는 눈금이 아니다.
 */
test('세로 눈금 다섯이 전부 정수로 떨어진다', () => {
  for (const ml of [0, 3, 7, 11.04, 15, 19.9]) {
    const yMax = yMaxOf([trial(0, {}, { gasMl: ml })]);
    for (const f of [0.25, 0.5, 0.75]) {
      assert.ok(Number.isInteger(yMax * f),
        `꼭대기 ${yMax} 의 ${f} 눈금이 ${yMax * f} 입니다 — 반올림해서 보여 주면 읽을 수 없습니다`);
    }
  }
});

test('가장 많은 점과 가장 적은 점이 그림에서 실제로 갈린다', () => {
  const svg = renderGraph([
    trial(0, { tempC: 10 }, { gasMl: 0.9 }),
    trial(1, { tempC: 30 }, { gasMl: 11 }),
  ], DESIGN);
  const ys = [...svg.matchAll(/id="g-p\d+" cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(ys.length, 2);
  assert.ok(Math.abs(ys[0] - ys[1]) > 40,
    `두 점이 ${Math.abs(ys[0] - ys[1]).toFixed(0)} px 밖에 안 떨어져 있습니다 — 이 실험이 견주는 것이 그 차이입니다`);
});

test('갈래마다 모양이 다르다 — 색만으로 가르지 않는다', () => {
  const line = renderGraph([trial(0)], DESIGN);
  const off = renderGraph([trial(0, { glucosePct: 5 })], DESIGN);
  const unknown = renderGraph([trial(0)], initialState().design);
  assert.ok(line.includes('<circle id="g-p0"'), '설계대로 한 점이 동그라미가 아닙니다');
  assert.ok(off.includes('<rect id="g-p0"'), '어긋난 점이 네모가 아닙니다');
  assert.ok(unknown.includes('<path id="g-p0"'), '알 수 없는 점이 마름모가 아닙니다');
});

test('하지 않은 조건도 가로축에 남는다', () => {
  const svg = renderGraph([trial(0, { tempC: 30 })], DESIGN);
  for (const t of CHOICES.tempC) {
    assert.ok(svg.includes(UI.units.tempC(t)), `${t} ℃ 가 축에서 사라졌습니다`);
  }
});

test('조작변인이 바뀌면 가로축도 바뀐다', () => {
  assert.deepEqual(axisValues({ independent: 'temp' }), CHOICES.tempC);
  assert.deepEqual(axisValues({ independent: 'glucose' }), CHOICES.glucosePct);
  assert.deepEqual(axisValues({ independent: null }), []);
});

/**
 * 희석을 잘못하면 축에 없는 농도(3.3 %)가 나온다.
 * **오른쪽 끝 너머로 밀어내면 「10 % 보다 진하다」로 읽혀 아예 틀린 말이 된다.**
 */
test('축에 없는 값은 가장 가까운 두 눈금 사이에 놓인다', () => {
  const design = { ...initialState().design, independent: 'glucose' };
  const svg = renderGraph([
    trial(0, { glucosePct: 0 }), trial(1, { glucosePct: 10 / 3 }), trial(2, { glucosePct: 5 }),
  ].map((t) => ({ ...t, independent: 'glucose' })), design);
  const xs = [...svg.matchAll(/id="g-p(\d)"[^>]*?(?:cx|x)="([\d.]+)"/g)]
    .map((m) => [m[1], Number(m[2])]);
  const at = Object.fromEntries(xs);
  assert.ok(at['1'] > at['0'] && at['1'] < at['2'],
    `3.3 % 가 0 %(${at['0']}) 와 5 %(${at['2']}) 사이에 있지 않습니다: ${at['1']}`);
});

/* ---------------- 설명이 무엇을 말하는가 ---------------- */

test('어긋난 시행의 설명이 무엇이 어긋났는지 이름으로 말한다', () => {
  const notes = graphNotes([trial(0, { glucosePct: 5 })], DESIGN).join('\n');
  assert.ok(notes.includes(UI.conditions.glucosePct), '무엇이 어긋났는지 이름을 말하지 않습니다');
});

/**
 * **그림으로 갈리지 않는 것을 말이 대신한다.**
 * 솜마개를 안 해도 기체는 난다 (호흡도 CO₂ 를 낸다). 그림만 보면 아무 문제가 없어 보인다.
 */
test('솜마개를 안 한 시행이 있으면 무엇을 갈라낼 수 없는지 말해 준다', () => {
  const notes = graphNotes([trial(0, { plugged: false })], DESIGN).join('\n');
  assert.match(notes, /호흡/, '발효인지 호흡인지 갈라낼 수 없다는 말이 없습니다');
});

test('총 부피가 다른 시행이 있으면 왜 견줄 수 없는지 말해 준다', () => {
  const notes = graphNotes([
    trial(0, { tempC: 20 }), trial(1, { tempC: 30 }), trial(2, { tempC: 40, totalMl: 20 }),
  ], DESIGN).join('\n');
  assert.match(notes, /부피/, '부피가 다르다는 말이 없습니다');
  assert.ok(notes.includes('20 mL'), '몇 mL 인지 말하지 않습니다');
});

test('부피가 전부 같으면 부피 이야기를 꺼내지 않는다 — 맞는 일에 빨간불이 나면 안 된다', () => {
  const notes = graphNotes([trial(0, { tempC: 20 }), trial(1, { tempC: 30 })], DESIGN).join('\n');
  assert.ok(!notes.includes('총 부피'), '맞게 한 학생에게 부피를 나무랍니다');
});

test('시행이 없으면 나무라지 않고 무엇을 하면 되는지 말한다', () => {
  assert.deepEqual(graphNotes([], DESIGN), [UI.graph.empty]);
});

test('설계를 안 했어도 그래프는 그려지고, 왜 축이 없는지 말해 준다', () => {
  const design = initialState().design;
  const svg = renderGraph([trial(0)], design);
  assert.ok(svg.includes('id="g-p0"'), '설계를 안 했다고 점을 안 그렸습니다');
  assert.ok(graphNotes([trial(0)], design).join('\n').includes('조작변인'));
});

/* ---------------- 순수 함수인가 ---------------- */

test('같은 시행이면 같은 그림이 나온다', () => {
  const trials = [trial(0), trial(1, { tempC: 30 })];
  assert.equal(renderGraph(trials, DESIGN), renderGraph(trials, DESIGN));
});

test('idPrefix 가 다르면 id 가 하나도 겹치지 않는다', () => {
  const trials = [trial(0)];
  const a = [...renderGraph(trials, DESIGN, { idPrefix: 'a' }).matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const b = [...renderGraph(trials, DESIGN, { idPrefix: 'b' }).matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(a.length > 0);
  assert.deepEqual(a.filter((x) => b.includes(x)), []);
});

test('난수를 쓰지 않는다', () => {
  const src = readFileSync(new URL('../src/render/graph.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!src.includes('Math.random'), '난수를 쓰면 결과를 되살릴 수 없습니다');
});

/* ---------------- 설계를 고치면 함께 바뀌는가 ---------------- */

test('설계를 고치면 어떤 점이 쓸 수 있는지가 함께 바뀐다', () => {
  const t = trial(0, { glucosePct: 5 });
  assert.equal(classify(t, DESIGN), 'off-design');
  const fixed = { ...DESIGN, controls: { ...DESIGN.controls, glucosePct: 5 } };
  assert.equal(classify(t, fixed), 'line', '설계를 고쳤는데 점이 그대로 어긋난 채입니다');
});

test('설명도 지금 설계로 다시 잰다', () => {
  const t = trial(0, { glucosePct: 5 }, { offDesign: [] });   // 기록 당시에는 어긋나지 않았다
  const notes = graphNotes([t], DESIGN).join('\n');
  assert.ok(notes.includes(UI.conditions.glucosePct), '얼어 있는 판정을 그대로 읽었습니다');
});

/**
 * **다크 모드에서 축과 글자가 보이는가.**
 *
 * 처음에는 `tokens.js` 의 고정 잉크색을 썼다. 라이트 모드에서는 멀쩡했는데
 * 다크 모드에서 축 이름과 눈금이 **검은 바탕에 검은 글씨**가 됐다.
 * 콘솔에는 아무 말도 안 나오고, 브라우저의 대비 검사는 단추만 보고 있었다.
 *
 * 눈으로만 잡히던 것이라 기계가 볼 수 있는 자리로 옮긴다 —
 * **글자와 축은 `currentColor` 여야 한다.** 점의 색(팔레트)은 갈래를 말하는 것이라 예외다.
 */
test('축과 글자가 테마를 따라간다 — 고정 잉크색을 쓰지 않는다', () => {
  const svg = renderGraph([trial(0), trial(1, { tempC: 20 })], DESIGN);
  const texts = [...svg.matchAll(/<text[^>]*>/g)].map((m) => m[0]);
  assert.ok(texts.length > 0);
  for (const t of texts) {
    assert.match(t, /fill="currentColor"/,
      `글자에 고정 색이 박혀 있습니다 — 다크 모드에서 안 보입니다:\n  ${t}`);
  }
  // 축과 눈금선도 마찬가지다.
  assert.ok(!/stroke="#[0-9A-Fa-f]{3,8}"\s+stroke-opacity/.test(svg),
    '눈금선에 고정 색이 박혀 있습니다');
});
