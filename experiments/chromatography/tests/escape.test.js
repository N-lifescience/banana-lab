/**
 * 정화 함수 자체를 잰다.
 *
 * 규칙이 「정화 함수 **+ 그 함수에 대한 테스트**」까지 있어야 근거로 친다고 못 박고 있다.
 * 여태 `buildSheet` 결과를 훑는 검사만 있었다 — 그건 **함수를 지나간다는 것**은 보지만
 * **함수가 무엇을 막는지**는 안 본다. 두 층이 다 필요하다.
 *
 * ── 낱말을 재지 않는다 ──────────────────────────────────────────────
 * 정화를 거쳐도 `onerror=` 라는 **글자는 남는다.** 그게 맞다 — 학생이 그렇게 썼으면
 * 글자로 보이는 것이 옳다. 재야 할 것은 그 글자가 **살아 있는 태그나 속성이 되는가**다.
 * 낱말을 세면 맞는 것을 막고, 그러면 사람이 검사를 꺼 버린다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/ui/notebook.js';
import { buildSheet } from '../src/ui/report.js';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';

test('다섯 글자를 모두 막는다 — 따옴표까지', () => {
  /*
   * `&<>` 만 막으면 큰따옴표 하나로 속성을 빠져나가 새 속성을 붙일 수 있다.
   * 학생이 쓴 글은 속성 안에도 들어간다(`value="…"`). 그래서 다섯이다.
   */
  assert.equal(escapeHtml('&'), '&amp;');
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('>'), '&gt;');
  assert.equal(escapeHtml('"'), '&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
});

test('& 를 먼저 막는다 — 나중에 막으면 이미 바꾼 것을 또 바꾼다', () => {
  // `<` → `&lt;` 로 바꾼 뒤 `&` 를 막으면 `&amp;lt;` 가 되어 화면에 `&lt;` 가 보인다.
  assert.equal(escapeHtml('<&>'), '&lt;&amp;&gt;');
  assert.equal(escapeHtml('&amp;'), '&amp;amp;');
});

test('살아 있는 태그와 속성이 안 만들어진다 — 글자는 남는다', () => {
  const attack = `<img src=x onerror=alert(1)>" onfocus="alert(2)`;
  const out = escapeHtml(attack);

  // 태그도 속성도 살아나지 않는다.
  assert.equal(out.includes('<img'), false, '태그가 살아 있습니다');
  assert.equal(out.includes('" onfocus='), false, '따옴표로 속성을 빠져나갑니다');
  assert.equal(/<[a-zA-Z]/.test(out), false, '여는 태그가 남아 있습니다');

  // **글자는 남아야 한다.** 학생이 쓴 것이고, 글자로 보이는 것이 맞다.
  assert.ok(out.includes('onerror=alert(1)'), '학생이 쓴 글자가 사라졌습니다');
  assert.ok(out.includes('&lt;img'), '글자로 남지 않았습니다');
});

test('숫자·null 도 터지지 않고 글자로 다룬다', () => {
  // 노트 칸은 비어 있을 수 있고, 계산 칸에는 숫자가 들어온다.
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(undefined), 'undefined');
});

test('학생이 쓴 글이 실제로 이 함수를 지나 종이로 나간다', () => {
  /*
   * 함수만 재면 **어디에도 안 쓰이는 함수**가 초록불을 받는다.
   * 그래서 학생이 쓴 글이 종이까지 가는 길을 한 번 통째로 지난다.
   */
  const payload = `<img src=x onerror=alert(1)>" onfocus="alert(2)`;
  let st = initialState(1);
  for (const step of ['q2', '1a', 'feedback.learned']) {
    st = reduce(st, { type: 'SAVE_NOTE', payload: { step, text: payload } }).state;
  }
  const html = buildSheet(st, { name: payload, team: payload }, 'group');

  assert.equal(html.includes('<img src=x'), false, '학생이 쓴 태그가 종이에 살아 있습니다');
  assert.equal(html.includes('" onfocus='), false, '이름 칸에서 속성을 빠져나갑니다');
  assert.ok(html.includes('&lt;img'), '글자로는 남아 있어야 합니다');
});
