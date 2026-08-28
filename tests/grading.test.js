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
    '(가)는 아무 것도 넣지 않아서 색깔이 없어 녹말이 있는지 구분하기 어렵습니다. ' +
    '그런데 (나)에 아이오딘 용액을 넣으면 녹말이 있는 부분만 청람색으로 변해서 눈으로 검출할 수 있습니다.';
  const pass2 =
    '아무 용액도 넣지 않은 (가)는 알갱이가 있는지 알아보기 어려웠다. ' +
    '아이오딘-아이오딘화 칼륨 용액을 넣으니 녹말이 들어있는 자리만 파랗게 변해서 쉽게 검출할 수 있었다.';
  assert.equal(gradeQuestion('qa', pass1).status, STATUS.PASS);
  assert.equal(gradeQuestion('qa', pass2).status, STATUS.PASS);
});

test('ⓐ 문항 — 미달이어야 하는 문장', () => {
  const fail1 = '아이오딘 용액을 넣으니 색이 변했다.'; // 색 변화만 있고 "무색이라 구분이 어렵다" 가 없다
  const fail2 = '(가)는 색이 없어서 잘 모르겠다.'; // 반대로 구분 어려움만 있고 색 변화/검출이 없다
  for (const text of [fail1, fail2]) {
    const r = gradeQuestion('qa', text);
    assert.equal(r.status, STATUS.MORE);
    assert.ok(r.message && r.message.length > 0);
  }
});

test('2번 문항 — 통과해야 하는 문장 (대조 구조)', () => {
  const pass1 =
    '(나)에서는 알갱이가 아주 많고 시야에 고르게 퍼져 있었는데, (다)에서는 붉은 방울이 몇 개만 드문드문 보였다. ' +
    '녹말이 지방보다 훨씬 많았다.';
  const pass2 =
    '녹말 알갱이는 시야 전체에 가득 퍼져서 색이 진했지만, 지방 방울은 아주 작고 드물게 한두 개만 보였다. ' +
    '그래서 바나나에는 지방보다 녹말이 훨씬 많다고 생각한다.';
  assert.equal(gradeQuestion('q2', pass1).status, STATUS.PASS);
  assert.equal(gradeQuestion('q2', pass2).status, STATUS.PASS);
});

test('2번 문항 — 카드 반례: "녹말은 청람색으로 보였다" 만 쓰면 통과하지 못한다', () => {
  const r = gradeQuestion('q2', '녹말은 청람색으로 보였다.');
  assert.equal(r.status, STATUS.MORE);
  assert.ok(r.message && r.message.length > 0);
});

test('2번 문항 — 미달이어야 하는 그 밖의 문장', () => {
  const fail1 = '아이오딘 용액을 넣으니 색이 변했다.';
  const fail2 = '지방 방울은 몇 개 안 보이고 드문드문 있었다.'; // 지방 계열만 있고 녹말 계열이 없다
  for (const text of [fail1, fail2]) {
    const r = gradeQuestion('q2', text);
    assert.equal(r.status, STATUS.MORE);
  }
});

test('2번 문항 — 한쪽 계열 낱말만으로는 길게 써도 통과하지 못한다', () => {
  // 녹말 계열만 있고 지방 계열이 전혀 없는, 문장 수는 충분한 답.
  const starchOnly = '녹말 알갱이가 시야 전체에 가득 퍼져 있어서 색이 진하게 나타났다. 정말 많아 보였다.';
  assert.equal(gradeQuestion('q2', starchOnly).status, STATUS.MORE);
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

test('되짚어 주는 말이 화면의 식과 어긋나지 않는다', async () => {
  /*
   * 식은 화면에 있고, **막혔을 때 보는 문장**은 따로 적혀 있다. 둘이 따로 적혀 있으면
   * 언젠가 어긋난다 — 그리고 그 문장을 보는 사람은 **가장 많이 거들어 주는 1단계 학생**이다.
   * 그 자리에서 식과 다른 말을 하면 되짚기가 아니라 **잘못 이끄는 것**이다.
   *
   * ★ 문장을 글자로 안 박는다 — **식에 있는 숫자가 문장에도 있는가**만 본다.
   *   (답인 총배율은 뺀다. 그것을 말해 주면 문제가 아니게 된다)
   * (웨이브 1 의 micrometer 세션이 자기 저장소에서 「× 10 µm 가 빠져 있다」로 잡았다)
   */
  const { UI } = await import('../src/ui/strings.js');
  const { EYEPIECE } = await import('../src/sim/optics.js');
  for (const objective of [4, 10, 40]) {
    const total = EYEPIECE * objective;
    const shown = UI.zoom.magLine(EYEPIECE, objective, total);
    const said = gradeMagnification('99', objective).message;
    const needed = (shown.match(/\d+/g) ?? []).filter((n) => n !== String(total));
    for (const n of needed) {
      assert.ok(said.includes(n),
        `화면의 식은 "${shown}" 인데 되짚는 말은 "${said}" 입니다 — ${n} 이 빠졌습니다`);
    }
    assert.ok(!said.includes(String(total)),
      `되짚는 말이 답(${total})을 그대로 알려 주면 문제가 아니게 됩니다 — "${said}"`);
  }
});
