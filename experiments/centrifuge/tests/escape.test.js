/**
 * 학생이 쓴 글을 화면과 종이에 넣을 때 정화가 실제로 되는가.
 *
 * `AGENTS.md`/작업 규칙: **`innerHTML` 을 쓸 거면 정화 함수 + 그 함수에 대한 테스트까지
 * 있어야 근거가 된다.** 이 저장소는 `innerHTML` 을 27자리에서 쓰는데 `escapeHtml` 에
 * 테스트가 하나도 없었다. 함수는 맞게 쓰여 있었지만 **맞다는 것을 아무도 재지 않았다.**
 *
 * ── 낱말을 세지 않는다 ────────────────────────────────────────────────
 * `onerror=` 같은 **글자는 정화를 거쳐도 그대로 남는다.** 남아도 된다 — 그건 그냥 글자다.
 * 그걸 금지어로 세면 「손끝을 소독한 뒤 onerror 를 확인했다」 같은 멀쩡한 문장에
 * 빨간불이 나고, **그런 검사는 곧 꺼진다.**
 *
 * 재야 할 것은 **태그가 열릴 수 있는가**와 **속성이 닫힐 수 있는가** 둘뿐이다.
 * 이 앱에서 학생 글이 들어가는 자리가 정확히 그 둘이다 —
 *   본문   `<p>…</p>` · `<span>…</span>`
 *   속성   `<textarea>…</textarea>` 와 5단계 배율 칸의 `value="…"`
 * 날 `<` 가 없으면 태그가 못 열리고, 날 `"`·`'` 가 없으면 속성을 못 빠져나간다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { escapeHtml } from '../src/ui/notebook.js';

/** 실제로 들어올 법한 것과, 들어오면 곤란한 것을 섞는다. */
const PAYLOADS = [
  '<script>alert(1)</script>',
  '" onerror="alert(1)',
  "' onload='alert(1)",
  '<img src=x onerror=alert(1)>',
  '</textarea><script>alert(1)</script>',
  '"><svg/onload=alert(1)>',
  '&lt;script&gt;',                       // 이미 escape 된 글이 되살아나면 안 된다
  '적혈구층 & 혈장의 경계가 "흐릿"했다',    // 멀쩡한 학생 문장
  '기둥 길이 < 5 mm 였다',                 // 부등호를 쓴 멀쩡한 문장
  '',
];

test('정화한 글에는 태그를 열 수 있는 글자가 남지 않는다', () => {
  for (const p of PAYLOADS) {
    const out = escapeHtml(p);
    assert.ok(!out.includes('<'), `날 < 가 남았습니다: ${JSON.stringify(out)}`);
    assert.ok(!out.includes('>'), `날 > 가 남았습니다: ${JSON.stringify(out)}`);
  }
});

test('정화한 글로는 속성을 빠져나갈 수 없다', () => {
  // `value="…"` 와 `<textarea>` 안에 그대로 들어간다. 따옴표 하나면 새 속성을 붙일 수 있다.
  for (const p of PAYLOADS) {
    const out = escapeHtml(p);
    assert.ok(!out.includes('"'), `날 " 가 남았습니다: ${JSON.stringify(out)}`);
    assert.ok(!out.includes("'"), `날 ' 가 남았습니다: ${JSON.stringify(out)}`);
  }
});

test('& 는 반드시 실체참조의 시작이다 (반쪽 정화가 아니다)', () => {
  // `&` 를 안 바꾸면 학생이 친 `&lt;` 가 브라우저에서 `<` 로 되살아난다.
  for (const p of PAYLOADS) {
    const out = escapeHtml(p);
    for (const [, tail] of out.matchAll(/&(.{0,5})/g)) {
      assert.ok(/^(amp|lt|gt|quot|#39);/.test(tail),
        `실체참조가 아닌 & 가 남았습니다: ${JSON.stringify(out)}`);
    }
  }
});

test('멀쩡한 글자를 지우지 않는다 — 되돌리면 원래 글이다', () => {
  // 「막는다」를 「지운다」로 고치면 위 검사들은 다 통과하지만 학생 글이 사라진다.
  const back = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g,
    (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
  for (const p of PAYLOADS) assert.equal(back(escapeHtml(p)), p);
});

/**
 * ── 두 번째 층 ────────────────────────────────────────────────────
 * 함수가 맞아도 **부르지 않으면 소용없다.** 새 칸을 하나 더 만들면서 감싸는 것을 잊는 것이
 * 실제로 일어나는 일이다. 학생 글을 HTML 에 끼워 넣는 자리마다 정화를 거치는지 본다.
 *
 * 앱 문구(`N.q2Label` 같은 상수)는 여기서 보지 않는다 — 학생이 쓴 것이 아니다.
 * **맞는 일에 빨간불을 내면 검사가 꺼진다.**
 */
const readSrc = (n) => readFileSync(new URL(`../src/ui/${n}`, import.meta.url), 'utf8');

/** `${ … }` 를 중괄호 짝을 맞춰 뽑는다. 정규식만으로는 중첩된 것을 놓친다. */
function interpolations(src) {
  const found = [];
  for (let i = 0; i < src.length - 1; i++) {
    if (src[i] !== '$' || src[i + 1] !== '{') continue;
    let depth = 0;
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) { found.push(src.slice(i + 2, j)); i = j; break; }
    }
  }
  return found;
}

test('학생이 쓴 글은 HTML 에 넣기 전에 반드시 정화를 거친다', () => {
  const bad = [];
  for (const name of ['report.js', 'notebook.js']) {
    for (const expr of interpolations(readSrc(name))) {
      // 학생 글이 담기는 곳은 `session.notes` 뿐이다.
      if (!/session\.notes\b|\bnotes\[/.test(expr)) continue;
      // `or(...)` 는 안에서 escapeHtml 을 부른다 (report.js 의 헬퍼).
      if (/\bescapeHtml\s*\(|^\s*or\s*\(/.test(expr)) continue;
      bad.push(`${name}: \${${expr.replace(/\s+/g, ' ').trim().slice(0, 70)}}`);
    }
  }
  assert.deepEqual(bad, [],
    '학생 글이 정화 없이 HTML 로 들어갑니다:\n  ' + bad.join('\n  '));
});
