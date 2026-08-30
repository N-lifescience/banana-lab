/**
 * 첨삭 테스트.
 *
 * 키워드 목록에서 낱말을 뽑아 문장을 조립하지 않는다 — 그건 목록이 자기 자신을 검사하는
 * 것이라 아무것도 검증하지 못한다. 실제 학생이 쓸 법한 문장을 직접 지어서 넣는다.
 *
 * **비용은 비대칭이다.** 엉성한 답이 통과하는 비용은 거의 0 이고, 맞게 쓴 답이 미달로
 * 뜨는 비용은 학생이 글쓰기를 그만두는 것이다. 그래서 여기서 지키는 것은 주로
 * "통과해야 하는 문장이 통과하는가" 쪽이다 (src/ui/grading.js 머리말).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUESTIONS, gradeQuestion, gradeRf, STATUS } from '../src/ui/grading.js';

test('문항 표 — 모든 문항에 되돌려 주는 말이 있고, "틀렸"/"잘못" 이 없다', () => {
  for (const q of QUESTIONS) {
    assert.ok(q.feedback && q.feedback.trim().length > 0, `${q.id} 의 feedback 이 비어 있습니다`);
    assert.equal(/틀렸|잘못/.test(q.feedback), false, `${q.id} 의 feedback 에 "틀렸/잘못" 이 있습니다`);
  }
});

test('ⓐ 문항 — 설명하는 결이 달라도 모두 통과한다', () => {
  // 용해도로 설명해도, 종이에 붙는 정도로 설명해도, 그냥 "성질이 달라서" 로 설명해도 맞다.
  const answers = [
    '색소마다 전개액에 녹는 정도가 달라서 올라가는 거리가 서로 다르기 때문이다.',
    '어떤 색소는 종이에 잘 붙어서 천천히 가고 어떤 색소는 덜 붙어서 멀리 간다.',
    '색소들의 성질이 서로 달라서 전개액을 따라 올라가는 속도가 달랐던 것 같다.',
    '전개액이 종이를 타고 올라가면서 색소를 데려가는데, 색소마다 딸려 가는 정도가 달라 갈라진다.',
  ];
  for (const text of answers) {
    assert.equal(gradeQuestion('qa', text).status, STATUS.PASS, `미달로 판정했습니다: "${text}"`);
  }
});

test('ⓐ 문항 — 한두 낱말짜리 답은 더 써 보라고 한다', () => {
  for (const text of ['성질이 달라서.', '갈라짐']) {
    const r = gradeQuestion('qa', text);
    assert.equal(r.status, STATUS.MORE);
    assert.ok(r.message && r.message.length > 0);
  }
});

test('2번 문항 — 색소 이름으로 써도, 색 이름으로 써도 통과한다', () => {
  // 색 이름을 쓰는 것은 색소 이름을 외우지 못한 것이지 틀린 것이 아니다.
  const answers = [
    '위에서부터 카로틴, 잔토필, 엽록소 a, 엽록소 b 순이었다. 잘 녹는 것일수록 멀리 간 것 같다.',
    '맨 위가 주황색이고 그 아래가 노란색, 청록색, 황록색이었다. 성질 차이 때문인 것 같다.',
    '주황 띠가 가장 높이 올라갔고 황록 띠가 제일 밑에 남았다. 종이에 붙는 정도가 달라서다.',
  ];
  for (const text of answers) {
    assert.equal(gradeQuestion('q2', text).status, STATUS.PASS, `미달로 판정했습니다: "${text}"`);
  }
});

test('2번 문항 — 순서를 말하지 않으면 더 써 보라고 한다', () => {
  // 색소 이름만 늘어놓은 답. "어떤 순서였는가" 가 이 문항이 묻는 것이다.
  const r = gradeQuestion('q2', '카로틴과 잔토필과 엽록소가 보였고 색이 다 달랐다.');
  assert.equal(r.status, STATUS.MORE);
  assert.ok(r.message && r.message.length > 0);
});

test('3번 문항 — 보드가 없으므로 언제나 unavailable 이지 more 가 아니다', () => {
  const withText = gradeQuestion('q3', '다른 모둠은 우리보다 띠가 흐렸다. 적게 찍었다고 한다.');
  const empty = gradeQuestion('q3', '');
  assert.equal(withText.status, STATUS.UNAVAILABLE);
  assert.equal(empty.status, STATUS.UNAVAILABLE);
});

/* ---------------- 전개율 ---------------- */

test('전개율 첨삭 — 잰 두 거리를 나눈 값을 본다', () => {
  assert.equal(gradeRf('0.5', { pigmentMm: 40, solventMm: 80 }).status, STATUS.PASS);
  assert.equal(gradeRf(0.5, { pigmentMm: 40, solventMm: 80 }).status, STATUS.PASS);
  // 자로 읽는 값이라 눈금 한 칸쯤은 어긋난다.
  assert.equal(gradeRf('0.52', { pigmentMm: 40, solventMm: 80 }).status, STATUS.PASS);
});

test('전개율 첨삭 — 되돌려 주는 말에 답을 적지 않는다', () => {
  // 한 번 틀렸다고 몫을 그대로 내주면, 그 뒤로는 나눌 이유가 없다.
  const wrong = gradeRf('0.9', { pigmentMm: 40, solventMm: 80 });
  assert.equal(wrong.status, STATUS.MORE);
  assert.doesNotMatch(wrong.message, /0\.5/);
  assert.match(wrong.message, /원점/);
});

test('전개율 첨삭 — 거꾸로 나눈 것은 이유를 짚어 준다', () => {
  const flipped = gradeRf('2', { pigmentMm: 40, solventMm: 80 });
  assert.equal(flipped.status, STATUS.MORE);
  assert.match(flipped.message, /1보다 클 수 없/);
});

test('전개율 첨삭 — 분모가 없으면 미달이 아니라 unavailable 이다', () => {
  // 전선을 표시하지 않았거나 종이 끝을 넘어간 경우. 학생이 못 쓴 것이 아니라
  // 잴 수 없는 것이라, 미달로 보이면 "못 한 일" 로 읽힌다.
  const r = gradeRf('0.5', { pigmentMm: 40, solventMm: 0 });
  assert.equal(r.status, STATUS.UNAVAILABLE);
});

test('첨삭기는 색소별 Rf 표를 보지 않는다', () => {
  // `develop.js` 에는 실측 Rf 가 있다(Pearson CP11). 그건 **띠를 그릴 자리**이고,
  // 첨삭기가 그것을 끌어다 쓰면 「카로틴을 골랐어야 한다」는 채점이 되어 버린다.
  // 재는 것과 나누는 것이 이 실험이 가르치려는 바다 — 첨삭기는 나눗셈만 본다.
  // **주석은 빼고 코드만 본다.** 산문까지 훑으면 "카로틴의 Rf 가 맞나가 아니다" 라고
  // 적어 둔 주석에 걸린다 — 오탐이 한 번 나면 그 뒤로 아무도 이 검사를 안 믿는다
  // (PLAYBOOK §9-3 · roadmap.test.js 의 개인정보 검사가 같은 이유로 고쳐졌다).
  const src = readFileSync(new URL('../src/ui/grading.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert.equal(/\bPIGMENTS\b/.test(src), false,
    'grading.js 가 색소별 Rf 표를 참조합니다 — 두 거리를 나누는 것만 봐야 합니다');
  // 같은 두 거리면 어느 띠를 쟀든 같은 답이 나온다.
  assert.equal(
    gradeRf('0.5', { pigmentMm: 40, solventMm: 80 }).status,
    gradeRf('0.5', { pigmentMm: 20, solventMm: 40 }).status
  );
});
