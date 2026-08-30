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
  const pass1 =
    '덮개 유리 한쪽에만 용액을 떨어뜨렸을 때는 액이 가장자리에 고여 있고 아래는 그대로였습니다. ' +
    '반대쪽에 거름종이를 대니까 그 액이 덮개 유리 밑으로 빨려 들어가면서 용액이 바뀌었습니다.';
  const pass2 =
    '거름종이가 반대쪽에서 액을 빨아들이면 새 용액이 그쪽으로 끌려 옵니다. ' +
    '그래야 슬라이드를 다시 만들지 않고도 같은 세포를 보면서 용액만 갈 수 있습니다.';
  assert.equal(gradeQuestion('qa', pass1).status, STATUS.PASS);
  assert.equal(gradeQuestion('qa', pass2).status, STATUS.PASS);
});

test('ⓐ 문항 — 미달이어야 하는 문장', () => {
  const fail1 = '거름종이를 반대쪽에 대었습니다.';   // 한 일만 있고 까닭이 없다
  const fail2 = '그렇게 하라고 되어 있었습니다.';
  for (const text of [fail1, fail2]) {
    const r = gradeQuestion('qa', text);
    assert.equal(r.status, STATUS.MORE);
    assert.ok(r.message && r.message.length > 0);
  }
});

test('2번 문항 — 통과해야 하는 문장 (농도 + 근거)', () => {
  const pass1 =
    '10 % 에서는 원형질이 떨어진 세포가 몇 개뿐이었는데 15 % 에서는 절반이 넘었습니다. ' +
    '그래서 그 사이 어딘가라고 생각합니다.';
  const pass2 =
    '15 % 쯤이라고 봅니다. 세어 보니 보라색 덩어리가 벽에서 떨어진 세포가 대략 반이었습니다.';
  assert.equal(gradeQuestion('q2', pass1).status, STATUS.PASS);
  assert.equal(gradeQuestion('q2', pass2).status, STATUS.PASS);
});

test('2번 문항 — 카드 반례: 숫자만 적으면 통과하지 못한다', () => {
  const r = gradeQuestion('q2', '15 % 입니다.');
  assert.equal(r.status, STATUS.MORE);
  assert.ok(r.message && r.message.length > 0);
});

test('2번 문항 — 농도를 말하지 않으면 통과하지 못한다', () => {
  // 근거만 길게 쓰고 어느 농도인지 밝히지 않은 답. 이 문항이 묻는 것이 그 농도다.
  const noConc = '보라색이 벽에서 떨어진 세포를 세어 보니 절반쯤 되는 지점이 있었습니다.';
  assert.equal(gradeQuestion('q2', noConc).status, STATUS.MORE);
});

test('3번 문항 — 세포벽을 짚어야 통과한다', () => {
  assert.equal(gradeQuestion('q3', '세포벽이 있어서 물이 더 들어와도 터지지 않습니다.').status, STATUS.PASS);
  assert.equal(gradeQuestion('q3', '물을 많이 먹어서 그렇습니다.').status, STATUS.MORE);
});

test('4번 문항 — 보드가 없으므로 언제나 unavailable 이지 more 가 아니다', () => {
  const withText = gradeQuestion('q4', '다른 모둠은 우리보다 더 낮은 농도에서 변했다고 했다.');
  const empty = gradeQuestion('q4', '');
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
