/**
 * 첨삭 테스트.
 *
 * 키워드 목록에서 낱말을 뽑아 문장을 조립하지 않는다 — 그건 목록이 자기 자신을 검사하는
 * 것이라 아무것도 검증하지 못한다. 실제 고등학생이 쓸 법한 문장을 직접 지어서 넣는다.
 *
 * **그래도 이 파일만으로는 부족하다.** 여기 있는 문장은 첨삭을 만든 쪽이 쓴 것이고,
 * 진짜 검증은 `tests/grading.holdout.test.js` 가 한다 — 구현을 보지 않은 쪽이 쓴 문장이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, gradeQuestion, gradeHematocrit, HCT_TOLERANCE_PCT, STATUS } from '../src/ui/grading.js';

test('문항 표 — 모든 문항에 되돌려 주는 말이 있고, "틀렸"/"잘못" 이 없다', () => {
  for (const q of QUESTIONS) {
    assert.ok(q.feedback && q.feedback.trim().length > 0, `${q.id} 의 feedback 이 비어 있습니다`);
    assert.equal(/틀렸|잘못/.test(q.feedback), false, `${q.id} 의 feedback 에 "틀렸/잘못" 이 있습니다`);
  }
});

test('ⓐ 문항 — 통과해야 하는 문장', () => {
  const pass1 =
    '반대쪽 빨대를 비워 두고 돌렸더니 회전판이 심하게 흔들렸습니다. '
    + '빈 모세관을 넣어 양쪽 무게를 맞추면 흔들리지 않고 곧게 돕니다.';
  const pass2 =
    '한쪽에만 모세관을 넣으면 무게 중심이 가운데에서 벗어나서 덜덜 떨렸다. '
    + '그래서 반대쪽에도 같은 것을 넣어 균형을 맞춰야 한다.';
  assert.equal(gradeQuestion('qa', pass1).status, STATUS.PASS);
  assert.equal(gradeQuestion('qa', pass2).status, STATUS.PASS);
});

test('ⓐ 문항 — 미달이어야 하는 문장', () => {
  const fail1 = '빈 모세관을 넣었다.';                 // 무슨 일이 일어나는지가 없다
  const fail2 = '선생님이 그렇게 하라고 하셨다.';       // 관찰도 까닭도 없다
  for (const text of [fail1, fail2]) {
    const r = gradeQuestion('qa', text);
    assert.equal(r.status, STATUS.MORE);
    assert.ok(r.message && r.message.length > 0);
  }
});

test('2번 문항 — 통과해야 하는 문장 (바깥쪽과 축 쪽을 둘 다 말한다)', () => {
  const pass1 =
    '바깥쪽 끝에는 짙고 어두운 붉은색 층이 다져져 있었고, 축 쪽에는 맑은 노란색 액체가 남았다. '
    + '아래쪽이 적혈구층이고 위쪽이 혈장이다.';
  const pass2 =
    '회전 바깥쪽에 적혈구가 가라앉아 진한 색으로 뭉쳤고 축 쪽에는 투명한 혈장이 떠 있었다. '
    + '그 사이에 아주 얇은 회백색 띠도 보였는데 연층이라고 한다.';
  assert.equal(gradeQuestion('q2', pass1).status, STATUS.PASS);
  assert.equal(gradeQuestion('q2', pass2).status, STATUS.PASS);
});

test('2번 문항 — 한쪽만 말하면 통과하지 못한다', () => {
  const fail1 = '바깥쪽에 진한 붉은색 적혈구층이 다져져 있었다. 색이 아주 어두웠다.';
  const fail2 = '축 쪽에 맑고 노란 액체가 떠 있었다. 생각보다 양이 많았다.';
  for (const text of [fail1, fail2]) {
    assert.equal(gradeQuestion('q2', text).status, STATUS.MORE, `"${text}"`);
  }
});

test('3번 문항 — 볼 길이 없으므로 언제나 unavailable 이지 more 가 아니다', () => {
  const withText = gradeQuestion('q3', '다른 모둠은 우리보다 층이 더 또렷했다. 더 오래 돌렸다고 한다.');
  const empty = gradeQuestion('q3', '');
  assert.equal(withText.status, STATUS.UNAVAILABLE);
  assert.equal(empty.status, STATUS.UNAVAILABLE);
});

test('헤마토크릿 첨삭 — 재어 나눈 값이면 통과한다', () => {
  assert.equal(gradeHematocrit('45', 0.45).status, STATUS.PASS);
  assert.equal(gradeHematocrit(45, 0.45).status, STATUS.PASS);
  assert.equal(gradeHematocrit('45%', 0.45).status, STATUS.PASS, '% 를 붙여 적어도 같은 답이다');
  // 자를 눈으로 읽는 일이라 넉넉히 봐준다.
  assert.equal(gradeHematocrit(String(45 + HCT_TOLERANCE_PCT - 1), 0.45).status, STATUS.PASS);
});

test('헤마토크릿 첨삭 — **답을 되돌려 주지 않는다**', () => {
  // 한 번 틀렸다고 화면이 값을 알려 주면 그 뒤로는 재어 볼 이유가 없어진다.
  // 이 실험이 가르치려는 것이 재는 것과 나누는 것이다.
  const wrong = gradeHematocrit('80', 0.45);
  assert.equal(wrong.status, STATUS.MORE);
  assert.doesNotMatch(wrong.message, /\d/, '되돌려 주는 말에 숫자가 있으면 그것이 곧 답이 된다');
  assert.match(wrong.message, /자/, '어디를 다시 재야 하는지는 말해 준다');
});

test('헤마토크릿 첨삭 — 아무 말이나 적으면 구하는 방법을 알려 준다', () => {
  for (const bad of ['', '모르겠다', '0']) {
    const r = gradeHematocrit(bad, 0.45);
    assert.equal(r.status, STATUS.MORE);
    assert.ok(/나눈|나누/.test(r.message), `"${bad}" 에 구하는 방법을 안 알려 줍니다`);
  }
});
