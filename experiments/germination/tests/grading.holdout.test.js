/**
 * 서술형 첨삭 — **바깥에서 던지는 문장.**
 *
 * `tests/fixtures/answers.json` 은 **채점 코드를 안 본 다른 세션**이 썼다.
 * 구현한 사람이 자기 키워드 목록을 보고 만든 테스트는 아무것도 검증하지 못한다 —
 * 바나나랩에서 전체 99개가 통과하는 상태에서 바깥 문장 9개 중 6개가 미달이었고
 * **6개 전부 맞게 쓴 답**이었다.
 *
 * 고칠 것이 생기면 **답안이 아니라 채점 쪽**을 고친다.
 * 답안을 고치기 시작하면 이 검사는 자기 자신을 검사하는 것이 된다.
 *
 * 커밋 게이트에 둔다 — 결정적이고 빠르며, 판정이 애매하지 않다.
 * 사람이 눈으로 볼 것은 `scripts/check-grading.mjs` 가 더 자세히 찍어 준다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeAnswer, QUESTIONS } from '../src/ui/grading.js';

const answers = JSON.parse(
  readFileSync(new URL('./fixtures/answers.json', import.meta.url), 'utf8')
);

const rows = Object.entries(answers).filter(([, v]) => Array.isArray(v));

test('바깥 문장이 충분히 있다', () => {
  // 몇 개 안 되면 통과해도 아무 뜻이 없다.
  const n = rows.reduce((a, [, list]) => a + list.length, 0);
  assert.ok(n >= 20, `바깥 문장이 ${n}개뿐입니다`);
  for (const [id, list] of rows) {
    assert.ok(list.filter((a) => a.expect === 'pass').length >= 4,
      `${id} 에 통과해야 마땅한 답이 너무 적습니다`);
  }
});

test('첨삭 문항마다 바깥 문장이 있다', () => {
  // 문항을 새로 넣고 답안을 안 쓰면, 그 문항은 아무도 안 본 채로 학생에게 나간다.
  for (const q of QUESTIONS) {
    if (q.available === false) continue;
    assert.ok(answers[q.id], `문항 ${q.id} 에 바깥 문장이 없습니다`);
  }
});

/**
 * **거짓 부정만 실패다.** 비용이 비대칭이기 때문이다 —
 * 엉성한 답이 통과하는 비용은 거의 0이고(점수를 매기지도 막지도 않는다),
 * 맞게 쓴 답이 미달로 뜨는 비용은 **아이가 자기가 틀렸다고 믿는 것**이다.
 */
test('맞게 쓴 답을 되돌려 보내지 않는다', () => {
  const bad = [];
  for (const [id, list] of rows) {
    for (const { text, expect } of list) {
      if (expect !== 'pass') continue;
      const got = gradeAnswer(id, text).status;
      if (got === 'unavailable') continue;
      if (got !== 'pass') bad.push(`[${id}] "${text.slice(0, 50)}…" → ${got}`);
    }
  }
  assert.deepEqual(bad, [],
    `맞게 쓴 답 ${bad.length}개가 미달로 판정됩니다:\n  ${bad.join('\n  ')}\n`
    + '  → 고칠 것은 답안이 아니라 src/ui/grading.js 입니다.');
});

test('통과했을 때 되돌려 주는 말이 나무라지 않는다', () => {
  // 통과인데 붙는 말은 **권유**여야 한다. 「부족합니다」로 읽히면 통과가 통과로 안 읽힌다.
  const scold = /부족|미달|틀렸|잘못|다시 쓰|안 됩니다/;
  for (const q of QUESTIONS) {
    if (q.hint) assert.equal(scold.test(q.hint), false, `${q.id} 의 권유가 나무랍니다: ${q.hint}`);
  }
});

test('되돌려 주는 말이 빈 문항이 없다', () => {
  for (const q of QUESTIONS) {
    assert.ok(q.feedback && q.feedback.trim(),
      `${q.id} 에 더 써 보라는 말이 없습니다 — 빈칸만 남습니다`);
  }
});

test('빈칸에는 통과를 주지 않는다', () => {
  for (const q of QUESTIONS) {
    if (q.available === false) continue;
    assert.notEqual(gradeAnswer(q.id, '').status, 'pass', `${q.id} 이 빈칸을 통과시킵니다`);
  }
});
