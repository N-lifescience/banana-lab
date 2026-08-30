/**
 * 보고서 테스트.
 *
 * 종이에 무엇이 실리는가와, **이름이 어디로 가지 않는가**를 본다.
 * 뒤쪽이 더 중요하다 — 개인정보가 상태나 저장소로 새면 화면 어디서도 티가 안 나고,
 * 티가 안 나는 채로 계속 쌓인다 (AGENTS.md §6).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { buildSheet } from '../src/ui/report.js';
import { UI } from '../src/ui/strings.js';

/**
 * 주석을 걷어낸 소스. 이 파일의 주석은 "localStorage 에 저장하지 않는다" 처럼
 * 금지어를 그대로 적고 있어서, 걷어내지 않으면 설명문을 코드로 오해한다.
 */
const SOURCE = readFileSync(new URL('../src/ui/report.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** 몇 가지를 적어 둔 상태 하나 */
function filled() {
  let st = initialState(2);
  const put = (step, text) => { st = reduce(st, { type: 'SAVE_NOTE', payload: { step, text } }).state; };
  put('predict.A', '색이 변하지 않는다');
  put('predict.why.A', '아무 용액도 넣지 않았으니까');
  put('1a', '껍질을 벗기니 안쪽이 연한 노란색이었다');
  put('selfeval.process', '4');
  put('feedback.learned', '바나나에 녹말이 많다');
  return st;
}

test('보고서에 학생이 적은 것과 넣은 이름이 실린다', () => {
  const html = buildSheet(filled(), { name: '홍길동', grade: '2', classNo: '4', number: '17' });
  assert.ok(html.includes('홍길동'), '이름이 종이에 없습니다');
  assert.ok(html.includes('색이 변하지 않는다'), '예상이 종이에 없습니다');
  assert.ok(html.includes('아무 용액도 넣지 않았으니까'), '예상의 까닭이 종이에 없습니다');
  assert.ok(html.includes('껍질을 벗기니'), '탐구 과정 기록이 종이에 없습니다');
  assert.ok(html.includes('바나나에 녹말이 많다'), '느낀 점이 종이에 없습니다');
  // 리커트는 숫자만 적으면 무슨 뜻인지 모른다. 뜻을 함께 싣는다.
  assert.ok(html.includes('4 · 그렇다'), '자기 평가 점수의 뜻이 종이에 없습니다');
});

test('적지 않은 칸도 종이에 남는다 — 어디를 건너뛰었는지 보여야 한다', () => {
  const html = buildSheet(initialState(1), {});
  assert.ok(html.includes(UI.report.notWritten), '빈칸 표시가 없습니다');
  // 세부 단계는 하나도 안 적었어도 전부 실린다
  const steps = UI.protocol.reduce((n, g) => n + g.steps.length, 0);
  const shown = (html.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
  assert.ok(shown >= steps, `세부 단계 ${steps}칸 중 ${shown}칸만 실렸습니다`);
});

test('넣지 않은 개인정보 칸은 종이에 아예 나오지 않는다', () => {
  const html = buildSheet(initialState(1), { name: '홍길동' });
  assert.ok(html.includes('홍길동'));
  assert.ok(!html.includes('>학교<'), '비워 둔 학교 칸이 종이에 빈 항목으로 남습니다');
});

test('학생이 쓴 글은 태그로 해석되지 않는다', () => {
  // 이 글은 학생 자기 화면에만 들어가지만, 보고서로 인쇄돼 남에게 건네진다.
  // 따옴표까지 막지 않으면 속성 안에 들어갈 때 새 속성을 붙일 수 있다 (5단계 배율 칸).
  let st = initialState(1);
  const payload = `<img src=x onerror=alert(1)>" onfocus="alert(2)`;
  for (const step of ['q2', 'mag.0', 'predict.A', '1a', 'feedback.learned']) {
    st = reduce(st, { type: 'SAVE_NOTE', payload: { step, text: payload } }).state;
  }
  const html = buildSheet(st, { name: payload });
  // "onerror=alert" 라는 **글자**는 남는다 — 그게 학생이 쓴 내용이고, 글자로 보이는 것이 맞다.
  // 봐야 할 것은 그것이 태그나 속성으로 **해석되는가** 다.
  assert.ok(!html.includes('<img src=x'), '학생이 쓴 태그가 그대로 들어갔습니다');
  assert.ok(!html.includes('" onfocus='), '따옴표로 속성을 빠져나갈 수 있습니다');
  assert.ok(html.includes('&lt;img'), '글자로는 남아 있어야 합니다');
  assert.ok(html.includes('&quot;'), '따옴표가 인코딩되지 않았습니다');
});

test('보고서는 개인정보를 상태에도 저장소에도 보내지 않는다', () => {
  // 이름을 store 에 넣으면 되돌리기 기록에 남고, 상태를 읽는 모든 화면으로 흘러간다.
  assert.ok(!/\.dispatch\(/.test(SOURCE),
    'report.js 가 store.dispatch 를 부릅니다 — 이름이 상태로 들어갑니다');
  for (const sink of ['localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest']) {
    assert.ok(!SOURCE.includes(sink), `report.js 가 ${sink} 를 씁니다 — 이름이 남습니다`);
  }
});
