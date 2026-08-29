/**
 * 개인정보처리방침의 **본문이 가리키는 조가 그 조가 맞는가.**
 *
 * ── 왜 ────────────────────────────────────────────────────────────
 * 필수 항목이 빠져서 조를 하나 끼워 넣었다(제5조 파기). 그러면 뒤가 전부 한 칸씩 밀리는데,
 * **본문이 「제10조의 연락처로」처럼 번호로 가리키던 자리는 안 따라온다.** 그 순간 방침이
 * 엉뚱한 조를 가리키고, 읽는 사람은 연락처를 찾다가 「안전성 확보 조치」를 읽는다.
 * 눈으로는 잘 안 보인다 — 번호가 **여전히 있기 때문**이다.
 *
 * ── ★ 「없는 조를 가리키는가」로 재면 안 잡힌다 ──────────────────────
 * 조를 하나 끼워도 `제10조` 는 **여전히 있다.** 다만 다른 조가 되어 있을 뿐이다.
 * 그래서 **가리키는 곳의 표제까지** 봐야 갈린다. 가리키는 말 **뒤에 따라오는 말**이
 * 무엇을 가리키려던 것인지 알려 준다 — 「…의 연락처」면 보호책임자 조여야 한다.
 * (centrifuge 세션이 자기 검사에서 잡아 허브를 거쳐 넘겨 주었다)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');

/** 조 번호 → 표제. `<h2>제N조 (…)</h2>` 에서 뽑는다. */
const TITLES = new Map(
  [...HTML.matchAll(/<h2>\s*제(\d+)조\s*\(([^)]*)\)/g)].map((m) => [Number(m[1]), m[2]]));

/**
 * 가리키는 말 뒤에 따라오는 말 → 그 조의 표제에 반드시 있어야 하는 낱말.
 * 여기 없는 모양의 참조는 「무엇을 가리키는지 모르겠다」로 따로 보고한다 — 조용히 넘기지 않는다.
 */
const MEANS = [
  [/^\s*[가-힣]목/, '항목'],          // 「제2조 가목의 …」
  [/^의?\s*보관 기간/, '보유'],       // 「제4조의 보관 기간」
  [/^의?\s*연락처/, '보호책임자'],    // 「제11조의 연락처로」
];

test('조 번호가 1부터 빠짐없이 이어진다', () => {
  const nums = [...TITLES.keys()];
  assert.ok(nums.length > 0, '방침에서 조를 하나도 못 찾았습니다 — 검사가 헛돌고 있습니다');
  assert.deepEqual(nums, nums.map((_, i) => i + 1),
    `조 번호가 1부터 이어지지 않습니다: ${nums.join('·')}`);
});

test('본문이 가리키는 조가 그 조가 맞다', () => {
  // 표제(`<h2>…`)가 아닌 곳에서 「제N조」를 찾고, 뒤따르는 말을 30자쯤 본다.
  const refs = [];
  for (const m of HTML.matchAll(/제(\d+)조/g)) {
    const before = HTML.slice(Math.max(0, m.index - 4), m.index);
    if (before.includes('<h2>')) continue;                       // 표제는 참조가 아니다
    refs.push({ n: Number(m[1]), after: HTML.slice(m.index + m[0].length, m.index + m[0].length + 30) });
  }

  /**
   * ★ **하나도 못 봤으면 그것부터 빨간불이다.**
   *   문장을 다듬다가 참조 모양이 바뀌면 이 검사는 **조용히 0개를 보게 되고**, 0개를 다 통과
   *   시키며 초록불을 낸다. 그때 이 검사는 있는 것처럼 보이지만 아무것도 안 지킨다.
   */
  assert.ok(refs.length > 0,
    '본문에서 조를 가리키는 자리를 하나도 못 찾았습니다 — 검사가 아무것도 안 보고 있습니다');

  const bad = [];
  for (const { n, after } of refs) {
    const title = TITLES.get(n);
    if (!title) { bad.push(`제${n}조 — 그런 조가 없습니다`); continue; }

    const rule = MEANS.find(([re]) => re.test(after));
    if (!rule) {
      bad.push(`제${n}조${after.slice(0, 12)}… — 무엇을 가리키는지 모르겠습니다`
        + ' (MEANS 에 이 모양을 더하세요)');
      continue;
    }
    if (!title.includes(rule[1])) {
      bad.push(`제${n}조${after.slice(0, 12)}… → 「${title}」`
        + ` (「${rule[1]}」 을 담은 조여야 합니다)`);
    }
  }
  assert.deepEqual(bad, [], `방침이 엉뚱한 조를 가리킵니다:\n  ${bad.join('\n  ')}`);
});
