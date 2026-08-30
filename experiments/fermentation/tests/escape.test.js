/**
 * 정화 함수 — **학생이 쓴 글이 태그로 되살아나지 않는가.**
 *
 * 이 저장소는 화면도 종이도 `innerHTML` 로 그린다(서른아홉 자리). 그 안에 학생이 쓴 글이
 * 그대로 들어간다. 정화가 새면 학생이 적은 글자가 **문서의 일부가 된다.**
 *
 * `Projects/CLAUDE.md` 의 요건: 「`innerHTML` 을 쓸 거면 정화 함수 + **그 함수에 대한
 * 테스트**까지 있어야 근거가 된다」. 함수는 있었는데 검사가 없었다.
 *
 * ── 낱말을 재지 않는다 ──────────────────────────────────────────────
 * 「`onerror=` 가 없다」로 재면 안 된다. **정화를 거쳐도 글자는 남는다** — `&lt;img&gt;` 안에
 * `onerror=` 라는 **글자**는 그대로 있다. 그건 위험하지 않다. 재야 할 것은
 * **살아 있는 태그**(`<img`)와 **살아 있는 속성**(`onfocus="`)이다.
 *
 * ── 두 층으로 본다 ─────────────────────────────────────────────────
 * ① 함수 자체가 다섯 글자를 다 막는가 (**따옴표까지** — 속성 안에도 들어가므로)
 * ② 학생이 쓴 글이 **실제로 그 함수를 지나** 종이에 나가는가
 *    — 함수가 멀쩡해도 부르는 것을 한 자리에서 빠뜨리면 소용이 없다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/ui/notebook.js';
import { buildSheet } from '../src/ui/report.js';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';

/** 학생이 쓸 법한, 그리고 실제로 위험한 글들. */
const NASTY = [
  '<img src=x onerror="alert(1)">',
  '<script>alert(1)</script>',
  '" onfocus="alert(1)" autofocus x="',
  "' onmouseover='alert(1)",
  '<svg/onload=alert(1)>',
  '</textarea><img src=x onerror=alert(1)>',
  '&lt;이미 이스케이프된 것&gt;',
];

/* ---------------- ① 함수 자체 ---------------- */

test('정화 함수가 다섯 글자를 다 막는다 — 따옴표까지', () => {
  // `&<>` 만 막으면 큰따옴표 하나로 속성을 빠져나가 새 속성을 붙일 수 있다.
  assert.equal(escapeHtml('&'), '&amp;');
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('>'), '&gt;');
  assert.equal(escapeHtml('"'), '&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
});

test('정화를 거치면 살아 있는 태그도 속성도 남지 않는다', () => {
  for (const text of NASTY) {
    const out = escapeHtml(text);
    assert.equal(/<[a-zA-Z/!]/.test(out), false, `살아 있는 태그가 남았습니다: ${text} → ${out}`);
    // 속성이 살아나려면 **따옴표**가 살아 있어야 한다. 글자 `onerror` 는 남아도 된다.
    assert.equal(/["']/.test(out), false, `따옴표가 남았습니다: ${text} → ${out}`);
  }
});

test('& 를 먼저 막는다 — 두 번 정화해도 태그가 되살아나지 않는다', () => {
  // `<` 를 `&lt;` 로 바꾼 뒤 `&` 를 바꾸면 `&amp;lt;` 가 되는 것이 맞다.
  // 순서가 뒤집히면 이미 이스케이프된 글이 원래 글자로 되돌아간다.
  assert.equal(escapeHtml(escapeHtml('<b>')), '&amp;lt;b&amp;gt;');
});

test('숫자·null 을 넣어도 터지지 않는다', () => {
  // 이 함수는 노트 값·성적·빈 칸에 두루 불린다. 문자열이 아닌 것이 온다.
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(undefined), 'undefined');
});

/* ---------------- ② 실제로 그 함수를 지나는가 ---------------- */

test('학생이 쓴 글이 종이에서 태그로 되살아나지 않는다', () => {
  // **함수가 멀쩡해도 부르는 것을 한 자리에서 빠뜨리면 소용이 없다.**
  // 노트 칸과 이름 칸에 각각 넣어 보고, 나온 종이에 살아 있는 태그가 생겼는지 본다.
  let st = initialState(1);
  const keys = ['predict', 'predict.why', '1a', 'qa', 'q2', 'feedback.learned'];
  for (const key of keys) {
    st = reduce(st, { type: 'SAVE_NOTE', payload: { step: key, text: NASTY[0] } }).state;
  }
  const html = buildSheet(st, { name: NASTY[2], team: NASTY[3], school: NASTY[1] }, 'group');

  assert.equal(html.includes('<img'), false, '종이에 살아 있는 <img 가 생겼습니다');
  assert.equal(html.includes('<script'), false, '종이에 살아 있는 <script 가 생겼습니다');
  assert.equal(html.includes('<svg'), false, '종이에 살아 있는 <svg 가 생겼습니다');
  /*
   * **여기서 한 번 물렸다.** 처음에는 `/\son(error|focus)\s*=/` 로 쟀는데, 정화를 거친
   * 글 안에도 `onerror=` 라는 **글자**는 그대로 남는다 — `&lt;img src=x onerror=&quot;…`.
   * 그건 그냥 글이고 위험하지 않다. 속성이 **살아나려면 진짜 따옴표**가 뒤에 와야 한다.
   * 정화된 글에서는 그 자리에 `&quot;` 가 오므로 이 정규식은 안 걸린다.
   */
  assert.equal(/\son\w+\s*=\s*["']/.test(html), false,
    '종이에 살아 있는 이벤트 속성이 생겼습니다');
  // 그리고 **글은 실려 있어야 한다** — 지워 버리는 것으로 통과하면 안 된다.
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'),
    '학생이 쓴 글이 종이에서 통째로 사라졌습니다 — 막는 것과 지우는 것은 다릅니다');
});
