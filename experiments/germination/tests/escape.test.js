/**
 * 정화 함수 자체 — **`escapeHtml` 이 무엇을 막는가.**
 *
 * ── 왜 종이 검사만으로는 부족한가 ──────────────────────────────────
 * `tests/report.test.js` 에 「학생이 쓴 글은 태그로 해석되지 않는다」가 있다. 그것은
 * **학생 글이 실제로 이 함수를 지나 종이에 나가는가**를 보는 층이다. 두 층은 다르다 —
 * 종이 쪽 검사는 호출을 하나 빠뜨리면 잡지만, **함수 자체가 헐거워지는 것**은
 * 그 검사가 마침 짚은 자리에서만 걸린다. `/dorms` 의 위험 패턴 판정에서
 * 「정화를 거친다」를 근거로 썼으므로, **그 근거를 지키는 검사가 있어야 한다.**
 *
 * ── 낱말을 재지 않는다 ────────────────────────────────────────────
 * 정화를 거쳐도 `onerror=` 라는 **글자**는 남는다. 그게 학생이 쓴 내용이고 글자로 보이는
 * 것이 맞다. 봐야 할 것은 그것이 **태그나 속성으로 해석되는가**다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/ui/notebook.js';

test('태그를 여는 글자를 막는다', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;');
  // 글자는 남는다 — 지우는 것이 아니라 **해석되지 않게** 하는 것이다.
  assert.ok(escapeHtml('<b>굵게</b>').includes('굵게'));
});

test('따옴표까지 막는다 — 속성 안에 들어가기 때문이다', () => {
  // 학생 글은 본문에만 들어가는 게 아니라 `value="…"` 같은 속성 안에도 들어간다.
  // `& < >` 만 막으면 큰따옴표 하나로 속성을 빠져나가 새 속성을 붙일 수 있다.
  assert.equal(escapeHtml('" onfocus="alert(1)'), '&quot; onfocus=&quot;alert(1)');
  assert.equal(escapeHtml("' onfocus='alert(1)"), '&#39; onfocus=&#39;alert(1)');
});

test('앰퍼샌드를 먼저 막는다 — 아니면 두 번 인코딩된다', () => {
  // `&` 를 나중에 막으면 `&lt;` 의 `&` 를 다시 막아 `&amp;lt;` 가 된다.
  // 그러면 화면에 `&lt;` 라는 글자가 그대로 보인다.
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('막는 글자가 다섯 종류다 — 하나라도 빠지면 빠져나갈 길이 생긴다', () => {
  const got = escapeHtml(`&<>"'`);
  assert.equal(got, '&amp;&lt;&gt;&quot;&#39;');
  for (const c of ['&', '<', '>', '"', "'"]) {
    assert.ok(!escapeHtml(c).includes(c) || c === '&',
      `${c} 가 그대로 남습니다`);
  }
});

test('글자가 아닌 것도 터지지 않고 글자로 바뀐다', () => {
  // 상태에서 오는 값이 늘 문자열은 아니다. 여기서 터지면 화면이 통째로 안 그려진다.
  assert.equal(escapeHtml(undefined), 'undefined');
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(12), '12');
  assert.equal(escapeHtml(0), '0');
});
