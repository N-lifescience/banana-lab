/**
 * 첨삭 테스트.
 *
 * 키워드 목록에서 낱말을 뽑아 문장을 조립하지 않는다 — 그건 목록이 자기 자신을 검사하는
 * 것이라 아무것도 검증하지 못한다. 실제 중학생이 쓸 법한 문장을 직접 지어서 넣는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, gradeQuestion, gradeMagnification, STATUS } from '../src/ui/grading.js';

test('문항 표 — 모든 문항에 되돌려 주는 말이 있고, "틀렸"/"잘못" 이 없다', () => {
  for (const q of QUESTIONS) {
    assert.ok(q.feedback && q.feedback.trim().length > 0, `${q.id} 의 feedback 이 비어 있습니다`);
    assert.equal(/틀렸|잘못/.test(q.feedback), false, `${q.id} 의 feedback 에 "틀렸/잘못" 이 있습니다`);
  }
});

test('ⓐ 문항 — 통과해야 하는 문장', () => {
  // 두 갈래 중 **하나만** 또렷이 써도 통과다 — 둘은 같은 사실의 양면이다.
  const pass1 =
    '접안 마이크로미터의 눈금은 그냥 칸일 뿐이라서 한 칸이 실제로 몇 마이크로미터인지 알 수 없습니다. ' +
    '그래서 한 칸이 10 µm 로 정해져 있는 대물 마이크로미터와 겹쳐 보고 한 칸의 길이를 구했습니다.';
  const pass2 =
    '접안 눈금만 보면 세포가 몇 칸인지는 세지만 그 칸이 얼마인지 모르기 때문에 실제 크기를 알 수 없다.';
  const pass3 =
    '대물 마이크로미터는 한 칸의 길이가 이미 정해져 있어서 기준이 된다. ' +
    '그것과 견주면 접안 눈금 한 칸이 몇 µm 인지 구할 수 있다.';
  for (const text of [pass1, pass2, pass3]) {
    assert.equal(gradeQuestion('qa', text).status, STATUS.PASS,
      `맞게 쓴 답을 미달로 판정했습니다: "${text}"`);
  }
});

test('ⓐ 문항 — 미달이어야 하는 문장', () => {
  const fail1 = '두 눈금자를 겹쳐서 보았다.';                    // 무엇을 알았는지가 없다
  const fail2 = '현미경으로 공변세포를 관찰했고 눈금이 잘 보였다.';  // 물음과 상관없는 답
  for (const text of [fail1, fail2]) {
    const r = gradeQuestion('qa', text);
    assert.equal(r.status, STATUS.MORE, `엉성한 답이 통과했습니다: "${text}"`);
    assert.ok(r.message && r.message.length > 0);
  }
});

test('ⓐ 문항 — 첨삭이 이 실험에 없는 것을 말하지 않는다', () => {
  // 여기 있던 것은 바나나랩 문항이라 첨삭이 「(가)에서는…」 이라고 답했다.
  // 이 실험에는 (가)도 대조군도 아이오딘도 없다 — 학생이 쓴 답과 상관없는 말이었다.
  const qa = QUESTIONS.find((q) => q.id === 'qa');
  const banana = /\(가\)|\(나\)|\(다\)|대조군|아이오딘|녹말|지방|수단/;
  assert.equal(banana.test(qa.feedback), false, `ⓐ 첨삭에 이 실험에 없는 말이 있습니다: ${qa.feedback}`);
  assert.equal(banana.test(qa.hint ?? ''), false, `ⓐ 권유에 이 실험에 없는 말이 있습니다: ${qa.hint}`);
});

test('2번 문항 — 칸 수와 한 칸의 길이를 둘 다 말해야 통과한다', () => {
  const pass1 =
    '400배에서는 세포가 차지하는 칸 수가 네 배쯤 늘었지만 한 칸의 길이가 4분의 1로 줄어서, ' +
    '결국 계산한 크기는 두 배율에서 거의 같았다.';
  const pass2 =
    '배율을 올리니 눈금이 더 많이 걸쳐서 칸 수는 커졌는데, 눈금값이 10 µm 에서 2.5 µm 로 작아졌다. ' +
    '그래서 곱한 값은 비슷했다.';
  for (const text of [pass1, pass2]) {
    assert.equal(gradeQuestion('q2', text).status, STATUS.PASS,
      `맞게 쓴 답을 미달로 판정했습니다: "${text}"`);
  }
});

test('2번 문항 — 한쪽만 말하면 통과하지 못한다', () => {
  // 상쇄를 본 것이 이 문항의 핵심이라, 한쪽만 말한 것은 아직 본 것이 아니다.
  const divsOnly = '400배에서는 세포가 훨씬 크게 보여서 눈금 칸 수가 많이 늘어났다. 네 배쯤 되었다.';
  const umOnly = '400배에서는 접안 눈금 한 칸의 길이가 2.5 µm 로 줄어들었다. 100배보다 작아졌다.';
  for (const text of [divsOnly, umOnly]) {
    assert.equal(gradeQuestion('q2', text).status, STATUS.MORE,
      `한쪽만 말했는데 통과했습니다: "${text}"`);
  }
});

test('3번 문항 — 보드가 없으므로 언제나 unavailable 이지 more 가 아니다', () => {
  const withText = gradeQuestion('q3', '다른 모둠은 우리보다 알갱이가 적었다. 배율도 낮게 봤다고 한다.');
  const empty = gradeQuestion('q3', '');
  assert.equal(withText.status, STATUS.UNAVAILABLE);
  assert.equal(empty.status, STATUS.UNAVAILABLE);
});

test('배율 첨삭 — 접안 10배 × 대물렌즈', () => {
  assert.equal(gradeMagnification('400', 40).status, STATUS.PASS);
  assert.equal(gradeMagnification(400, 40).status, STATUS.PASS);
  const wrong = gradeMagnification('40', 40);
  assert.equal(wrong.status, STATUS.MORE);
  // 첨삭은 곱할 두 수를 알려 주고, **곱한 결과는 알려 주지 않는다.**
  // 한 번 틀렸다고 답을 내주면 그 칸은 더 이상 아무것도 묻지 않는 칸이 된다.
  assert.match(wrong.message, /10배/);
  assert.match(wrong.message, /40배/);
  assert.doesNotMatch(wrong.message, /400/);
});
