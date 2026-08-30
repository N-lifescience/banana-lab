/**
 * 난이도 — **설명만 줄인다. 할 수 있는 일은 세 단계가 똑같다.**
 *
 * 힌트를 줄여서 길이 막히면 그건 설명을 줄인 게 아니라 강제를 넣은 것이다.
 * 바나나랩에서는 검사 118개가 통과하는 동안 2·3단계에 **닿을 방법이 없었다** —
 * 그래서 여기서는 "닿는가" 와 "할 수 있는 일이 같은가" 를 함께 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, UNDO_LIMITS } from '../src/sim/state.js';
import { ACTIONS, reduce } from '../src/sim/rules.js';
import { dropTable, tapTable } from '../src/ui/bench.js';
import { UI } from '../src/ui/strings.js';

/** dispatch 를 받아 적기만 하는 가짜 저장소 */
function fakeStore(level) {
  const state = initialState(level, 4242);
  return { getState: () => state, dispatch: () => ({ state, outcome: 'ok', message: null, tag: null }) };
}

test('세 단계의 조작표 모양이 같다', () => {
  const shape = (level) => {
    const d = dropTable(fakeStore(level));
    return Object.entries(d)
      .map(([from, to]) => `${from}:${Object.keys(to).sort().join(',')}`)
      .sort().join(' | ');
  };
  assert.equal(shape(1), shape(3), '1단계와 3단계에서 끌어다 놓을 수 있는 것이 달라졌습니다');
  assert.equal(shape(2), shape(3));
});

test('세 단계의 누르기 표 모양이 같다', () => {
  const shape = (level) => Object.keys(tapTable(fakeStore(level), () => {})).sort().join(',');
  assert.equal(shape(1), shape(3));
  assert.equal(shape(2), shape(3));
});

test('조작표가 난이도를 인자로 받지 않는다', () => {
  // 받게 되는 순간 "3단계에서는 이 조작을 뺀다" 가 한 줄이면 가능해진다.
  const src = readFileSync(new URL('../src/ui/bench.js', import.meta.url), 'utf8');
  for (const name of ['dropTable', 'tapTable']) {
    const sig = src.match(new RegExp(`export function ${name}\\(([^)]*)\\)`))?.[1] ?? '';
    assert.ok(sig, `${name} 의 서명을 못 찾았습니다`);
    assert.equal(/level/.test(sig), false, `${name}(${sig}) 가 난이도를 받습니다`);
  }
});

test('난이도가 올라가도 쓸 수 있는 액션이 줄지 않는다', () => {
  // ACTIONS 는 난이도를 모른다. 아는 순간 "3단계에서는 못 한다" 가 생긴다.
  const src = readFileSync(new URL('../src/sim/rules.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.equal(/session\.level/.test(src), false,
    'rules.js 가 난이도를 봅니다 — 규칙은 난이도를 몰라야 합니다');
});

test('되돌리기 횟수만 단계별로 다르고, 3단계에서도 살아 있다', () => {
  assert.equal(UNDO_LIMITS[1], Infinity);
  assert.equal(UNDO_LIMITS[2], 3);
  assert.equal(UNDO_LIMITS[3], 1);
  // 3단계에서도 한 번은 실제로 된다. 기능이 사실상 죽어 있으면 안 된다.
  let s = initialState(3, 1);
  s = reduce(s, { type: 'ADD_LEAF', payload: {} }).state;
  const undone = reduce(s, { type: 'UNDO', payload: {} });
  assert.equal(undone.state.tube.leaf, 0, '3단계에서 되돌리기가 실제로 동작해야 합니다');
});

test('말풍선은 단계가 올라갈수록 짧아지기만 한다', () => {
  for (const [kind, byLevel] of Object.entries(UI.bench.hints)) {
    const len = (l) => (byLevel[l] ?? []).join('').length;
    assert.ok(len(1) >= len(2), `${kind}: 2단계 힌트가 1단계보다 깁니다`);
    assert.ok(len(2) >= len(3), `${kind}: 3단계 힌트가 2단계보다 깁니다`);
    assert.equal(len(3), 0, `${kind}: 3단계는 이름만 남습니다`);
  }
});

test('확대 뷰는 난이도로 손잡이의 출발 자리만 바꾼다', () => {
  // 범위나 단추를 바꾸면 그건 설명을 줄인 게 아니라 할 수 있는 일을 줄인 것이다.
  const src = readFileSync(new URL('../src/ui/zoom.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const usesLevel = [...src.matchAll(/session\.level/g)].length;
  assert.equal(usesLevel, 1, `확대 뷰가 난이도를 ${usesLevel}곳에서 봅니다 — 출발 자리 한 곳이어야 합니다`);
  assert.equal(/level\s*[=!]==?\s*[23]\s*\?/.test(src), false,
    '확대 뷰가 2·3단계를 따로 갈라 다르게 그립니다');
});
