/**
 * 서술형 첨삭 — 바깥에서 던지는 문장.
 *
 * `tests/grading.test.js` 는 첨삭을 만든 쪽이 쓴 테스트다. 만든 사람이 자기 키워드 목록에
 * 맞춰 문장을 지으면 테스트가 공허해진다 — 목록이 자기 자신을 검사할 뿐이다.
 * 이 파일의 문장은 **구현을 보지 않고** 지어서 던진 것이고, 실제로 결함을 잡아냈다.
 *
 * 처음 던졌을 때 9개 중 6개가 어긋났고, 6개 전부 **맞게 쓴 답을 미달로 판정한 것**이었다.
 * 반대 방향(엉성한 답이 통과) 오류는 0건이었다. 그때 `npm run check` 는 99개 전부 초록불이었다.
 * 만든 쪽 테스트도, 구현이 이미 본 문장도 이걸 잡지 못했다.
 *
 * 그래서 이 파일이 있다. 여기 있는 문장은 **키워드 목록에서 역산해서 만들지 말 것.**
 * 목록을 넓히려고 여기 문장을 고치는 것도 금지다 — 그러면 이 테스트의 존재 이유가 사라진다.
 * 새 문장을 더할 때는 목록을 보지 말고 먼저 지어라.
 *
 * 이 기능에서 가장 나쁜 결과는 테스트가 빨간불이 되는 것이 아니라
 * **맞는 말을 쓴 학생에게 미달이라고 말하는 것**이다. 그래서 통과해야 할 문장이 더 많다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeQuestion, QUESTIONS, STATUS } from '../src/ui/grading.js';

/* ---------------- 2번 문항 — 녹말과 지방의 분포 ---------------- */

test('2번 문항: 견주어 쓴 답은 낱말을 어떻게 골랐든 통과한다', () => {
  const answers = [
    '파란 점들이 셀 수 없을 만큼 잔뜩 있었다. 빨간 것은 손에 꼽을 정도였다.',
    '(나) 쪽이 훨씬 촘촘했고 (다) 쪽은 듬성듬성했다. 차이가 뚜렷했다.',
    '녹말 알갱이는 세포를 꽉 채웠지만 지방 방울은 어쩌다 하나씩 눈에 띄었다.',
    '아이오딘 쪽은 알갱이가 수십 개는 되어 보였는데, 수단 쪽은 겨우 두세 개였다.',
    '청람색 알갱이는 세포 안을 가득 채우고 있었다. 반면에 선홍색 방울은 수가 적고 서로 멀리 떨어져 있었다.',
    '아이오딘을 넣은 쪽은 전체가 파랗게 물들 만큼 알갱이가 많았고, 수단 Ⅲ 를 넣은 쪽은 작은 점이 띄엄띄엄 있을 뿐이었다.',
  ];
  for (const text of answers) {
    const { status } = gradeQuestion('q2', text);
    assert.equal(status, STATUS.PASS, `맞게 쓴 답을 미달로 판정했습니다: "${text}"`);
  }
});

test('2번 문항: 한쪽만 말하면 통과하지 못한다', () => {
  // 카드 합격 기준에 박힌 반례가 첫 줄이다.
  const answers = [
    '녹말은 청람색으로 보였다.',
    '녹말 알갱이가 시야 전체에 가득 퍼져 있었다. 정말 많아 보였다.',
    '지방은 드문드문 조금만 보였고 크기도 아주 작았다.',
  ];
  for (const text of answers) {
    const { status } = gradeQuestion('q2', text);
    assert.notEqual(status, STATUS.PASS, `한쪽만 말했는데 통과했습니다: "${text}"`);
  }
});

test('2번 문항: 색만 말하고 양을 말하지 않으면 통과하지 못한다', () => {
  for (const text of ['두 슬라이드 모두 색이 변했다.', '청람색과 선홍색이 모두 나타났다.']) {
    assert.notEqual(gradeQuestion('q2', text).status, STATUS.PASS, `"${text}"`);
  }
});

/* ---------------- 질문 ⓐ — 용액을 쓰는 까닭 ---------------- */

test('질문 ⓐ: 까닭을 짚은 답은 낱말을 어떻게 골랐든 통과한다', () => {
  const answers = [
    '맨눈으로는 투명해서 뭐가 뭔지 모르겠는데, 용액을 넣으면 물들어서 어디에 있는지 드러난다.',
    '대조군은 아무 표시가 없어서 알기 힘들었다. 시약이 녹말에만 달라붙어 파랗게 되니까 위치를 알 수 있다.',
    '(가)는 아무것도 넣지 않아서 색이 없어 무엇이 있는지 구분할 수 없었다. 용액을 떨어뜨리면 녹말과 지방이 색을 띠어서 눈으로 찾아낼 수 있다.',
  ];
  for (const text of answers) {
    const { status } = gradeQuestion('qa', text);
    assert.equal(status, STATUS.PASS, `맞게 쓴 답을 미달로 판정했습니다: "${text}"`);
  }
});

test('질문 ⓐ: 절차만 적으면 통과하지 못한다', () => {
  for (const text of ['두 방울씩 떨어뜨렸다.', '선생님이 넣으라고 하셨다.']) {
    assert.notEqual(gradeQuestion('qa', text).status, STATUS.PASS, `"${text}"`);
  }
});

/* ---------------- 잘 쓴 한 문장을 짧다고 되돌려 보내지 않는다 ---------------- */

test('마침표를 하나만 찍어도 내용이 있으면 통과한다', () => {
  // 문장 수로 길이를 재던 때 실제로 걸렸던 답이다.
  // 마침표를 어떻게 찍는지는 학생마다 다르고 우리가 볼 것이 아니다.
  const text = '녹말 알갱이는 세포를 꽉 채웠지만 지방 방울은 어쩌다 하나씩 눈에 띄었다';
  assert.equal(gradeQuestion('q2', text).status, STATUS.PASS);
});

/* ---------------- 3번 문항 — 아직 할 수 없는 일 ---------------- */

test('3번 문항은 공유 보드가 없으면 미달이 아니라 아직 할 수 없음이다', () => {
  // '미달' 로 보이면 학생에게 "내가 못 한 일" 로 읽힌다. 보드는 T06 이고 아직 없다.
  for (const text of ['', '다른 모둠 것을 봤다.']) {
    assert.equal(gradeQuestion('q3', text).status, STATUS.UNAVAILABLE, `"${text}"`);
  }
});

/* ---------------- 아이에게 보여 줄 문장 ---------------- */

test('되돌려 주는 말이 학생을 나무라지 않는다', () => {
  for (const q of QUESTIONS) {
    assert.ok(q.feedback && q.feedback.trim(), `${q.id} 에 되돌려 주는 말이 없습니다`);
    assert.equal(/틀렸|잘못|오답|실패|미달/.test(q.feedback), false,
      `${q.id} 의 문구가 학생을 나무랍니다: "${q.feedback}"`);
    if (q.hint) {
      assert.equal(/틀렸|잘못|오답|실패|미달/.test(q.hint), false,
        `${q.id} 의 권유 문구가 학생을 나무랍니다: "${q.hint}"`);
    }
  }
});

test('견주는 말이 없어도 막지 않고 권유만 한다', () => {
  // 두 물질을 다 말했으면 통과다. 깊이는 판정이 아니라 권유로 다룬다.
  const shallow = '녹말도 보였고 지방도 보였다. 둘 다 관찰할 수 있었다.';
  const r = gradeQuestion('q2', shallow);
  assert.equal(r.status, STATUS.PASS, '두 물질을 다 말했으면 통과여야 합니다');
  assert.ok(r.message, '견주는 말이 없으면 권유 문구가 붙어야 합니다');
});
