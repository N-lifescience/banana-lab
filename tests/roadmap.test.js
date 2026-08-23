/**
 * 완성 판정 체크리스트 (`docs/08-roadmap.md`) 중 **기계로 확실히 판정되는 것**만.
 *
 * 체크리스트는 18줄이고 대부분은 눈으로 봐야 한다. 여기 있는 것은 눈으로 보면 놓치기 쉽고
 * 기계로는 확실한 것들이다. 특히 개인정보 항목은 사람 눈에 맡기면 안 된다 —
 * 한 번 놓치면 학생 정보가 남는다.
 *
 * 애매한 것을 여기 넣지 말 것. 오탐이 한 번 나면 `npm run check` 를 아무도 믿지 않게 된다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { initialState, fieldParams, UNDO_LIMITS } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { renderFOV } from '../src/render/fov.js';
import { lipidCount, canResolveGranules } from '../src/sim/optics.js';

const FIELD_PX = 328;

function sourceFiles() {
  const dir = new URL('../src/ui/', import.meta.url);
  const files = readdirSync(dir).map((f) => [`src/ui/${f}`, readFileSync(new URL(f, dir), 'utf8')]);
  files.push(['index.html', readFileSync(new URL('../index.html', import.meta.url), 'utf8')]);
  files.push(['src/main.js', readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')]);
  return files;
}

/* ---------------- 개인정보 — 눈으로 보면 놓친다 ---------------- */

test('학생 이름·학번을 입력받는 칸이 어디에도 없다', () => {
  // docs/08 완성 판정. 기본 답은 "저장하지 않는다" 이고, 입력칸이 없어야 저장할 것도 없다.
  const banned = /(이름|성명|학번|학년|반\s*번호|생년월일)\s*(을|를|:|입력)|type=["']?(email|tel)/;
  for (const [name, src] of sourceFiles()) {
    const hit = src.match(banned);
    assert.equal(hit, null, `${name} 에 개인정보 입력으로 보이는 것이 있습니다: "${hit?.[0]}"`);
  }
});

test('제출 대상 값에 개인을 가리키는 것이 없다', () => {
  // 결과 보드(T06)는 이 값들만 주고받는다. 이미지도 개인정보도 아니다.
  const p = fieldParams(initialState(1, 12345), 'B');
  const allowed = new Set([
    'reagent', 'coverage', 'excess', 'floating', 'tooThick', 'contaminated',
    'bubbles', 'cracked', 'lensTouched', 'reactionT', 'objective', 'focusErr',
    'brightness', 'panX', 'panY', 'seed',
  ]);
  for (const key of Object.keys(p)) {
    assert.ok(allowed.has(key), `fieldParams 에 예상 못 한 값이 있습니다: ${key}`);
  }
  for (const v of Object.values(p)) {
    assert.ok(['number', 'boolean', 'object', 'string'].includes(typeof v) || v === null);
  }
});

/* ---------------- 강제하지 않는가 ---------------- */

test('덮개 유리 없이 400배로 관찰이 되기는 된다', () => {
  // 막혀 있으면 개정 취지가 사라진 것이다.
  let s = initialState(1, 12345);
  s = reduce(s, { type: 'PEEL_BANANA' }).state;
  s = reduce(s, { type: 'SMEAR', payload: { slide: 'B', thickness: 0.3 } }).state;
  const mounted = reduce(s, { type: 'MOUNT', payload: { slide: 'B' } });
  assert.notEqual(mounted.outcome, 'blocked');
  const zoomed = reduce(mounted.state, { type: 'SET_OBJECTIVE', payload: { objective: 40 } });
  assert.notEqual(zoomed.outcome, 'blocked');
  assert.equal(zoomed.state.microscope.objective, 40, '올라가기는 올라가야 한다');
  const shot = reduce(zoomed.state, { type: 'CAPTURE' });
  assert.notEqual(shot.outcome, 'blocked', '기록까지 되어야 한다');
});

/* ---------------- 과학적으로 맞는가 ---------------- */

test('(가) 대조군에는 아무 색도 나타나지 않는다', () => {
  // 대조군이 대조군답게 지루해야 한다.
  const svg = renderFOV({
    reagent: null, coverage: 0, excess: 0, objective: 40,
    focusErr: 0, brightness: 1, reactionT: 1, seed: 31337,
  });
  assert.equal(/#3A4A9E|stainStarch/i.test(svg), false, '(가)에 녹말 염색색이 있습니다');
  assert.equal(/#C0392B|stainLipid/i.test(svg), false, '(가)에 지질 염색색이 있습니다');
});

test('지질 방울은 녹말립보다 훨씬 드물다', () => {
  // 바나나 지방 함량은 0.3% 다. 녹말립처럼 가득 차 있으면 틀린 것이다.
  const granulesPerField = 49 * 20;   // 400배에서 셀 약 49개 × 셀당 20개
  assert.ok(lipidCount(40) * 20 < granulesPerField,
    `400배 지질 방울 ${lipidCount(40)}개 — 녹말립에 견줘 드물어야 합니다`);
});

test('40배에서는 녹말립이 개별로 보이지 않는다', () => {
  // 보이면 광학 스케일이 틀린 것이다. 실제 현미경에서도 분해되지 않는다.
  assert.equal(canResolveGranules(4, FIELD_PX), false);
  assert.equal(canResolveGranules(40, FIELD_PX), true, '400배에서는 보여야 한다');
});

/* ---------------- 만듦새 ---------------- */

test('같은 시드는 같은 그림, 다른 시드는 다른 그림', () => {
  const p = (seed) => ({
    reagent: 'IKI', coverage: 1, excess: 0, objective: 40,
    focusErr: 0, brightness: 1, reactionT: 1, seed,
  });
  assert.equal(renderFOV(p(7)), renderFOV(p(7)));
  assert.notEqual(renderFOV(p(7)), renderFOV(p(8)));
});

/* ---------------- 난이도가 실제로 다른가 ---------------- */

test('세 난이도의 되돌리기 횟수가 다르다', () => {
  assert.equal(UNDO_LIMITS[1], Infinity);
  assert.equal(UNDO_LIMITS[2], 3);
  assert.equal(UNDO_LIMITS[3], 1);
  const seen = new Set([1, 2, 3].map((lv) => String(initialState(lv).session.undosLeft)));
  assert.equal(seen.size, 3, '세 난이도가 실제로 달라야 합니다');
});

test('난이도를 올려도 하드 게이트가 늘지 않는다', () => {
  // docs/06 은 3단계에서 메시지만 줄이라고 한다. 막는 것을 늘리면 안 된다.
  const script = [
    ['PEEL_BANANA', {}],
    ['SMEAR', { slide: 'B', thickness: 0.9 }],
    ['DROP', { slide: 'B', count: 5 }],
    ['MOUNT', { slide: 'B' }],
    ['SET_OBJECTIVE', { objective: 40 }],
    ['COARSE_FOCUS', { delta: 0.4 }],
    ['CAPTURE', {}],
  ];
  const blockedCount = (level) => {
    let s = initialState(level, 999);
    let n = 0;
    for (const [type, payload] of script) {
      const r = reduce(s, { type, payload });
      if (r.outcome === 'blocked') n++;
      s = r.state;
    }
    return n;
  };
  assert.equal(blockedCount(3), blockedCount(1),
    '3단계에서 막히는 횟수가 1단계와 같아야 합니다 — 메시지만 줄인다');
});
