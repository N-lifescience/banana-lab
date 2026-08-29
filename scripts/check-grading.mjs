#!/usr/bin/env node
/**
 * 서술형 첨삭 — 바깥에서 던지는 문장으로 검증한다.
 *
 *   node scripts/check-grading.mjs
 *
 * 왜 따로 있나:
 * `tests/grading.test.js` 는 첨삭을 만든 쪽이 쓴 테스트다. 만든 사람이 자기 키워드 목록에
 * 맞춰 문장을 지으면 테스트가 공허해진다 — 목록이 자기 자신을 검사할 뿐이다.
 * 이 파일의 문장은 **구현과 키워드 목록을 보기 전에** 지었다. 바깥에서 던지는 시험이다.
 *
 * 이 기능에서 가장 나쁜 결과는 테스트가 빨간불이 되는 것이 아니라,
 * **맞는 말을 쓴 학생에게 미달이라고 말하는 것**이다. 그래서 통과해야 할 문장을
 * 미달 문장보다 많이, 낱말을 일부러 다르게 골라 넣었다.
 */

let grading;
try {
  grading = await import('../experiments/banana/src/ui/grading.js');
} catch (e) {
  console.log('src/ui/grading.js 를 아직 불러올 수 없습니다 — ' + e.message);
  process.exit(0);
}

const { gradeAnswer, QUESTIONS } = grading;
if (typeof gradeAnswer !== 'function') {
  console.log('grading.js 가 gradeAnswer(questionId, text, context) 를 내보내지 않습니다.');
  console.log('내보내는 것: ' + Object.keys(grading).join(', '));
  process.exit(1);
}

const results = [];
const check = (ok, label, detail = '') => {
  results.push({ ok, label });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? '\n      ' + detail : ''}`);
};

/** 채점 결과에서 'pass' 여부만 뽑는다. 구현이 문자열이든 객체든 받아 준다. */
const verdict = (r) => (typeof r === 'string' ? r : r?.verdict ?? r?.result ?? r?.status);

/* ------------------------------------------------------------------ */
/* 2번 문항 — 녹말과 지방의 분포. 대조 구조를 보는 것이 핵심             */
/* ------------------------------------------------------------------ */

// 통과해야 한다. 일부러 서로 다른 낱말을 골랐다 —
// 학생이 교과서 표현을 그대로 베끼지 않아도 통과해야 하기 때문이다.
const q2Pass = [
  '(나)에서는 알갱이가 아주 많고 시야에 고르게 퍼져 있었는데, (다)에서는 붉은 방울이 몇 개만 드문드문 보였다. 녹말이 지방보다 훨씬 많았다.',
  '청람색 알갱이는 세포 안을 가득 채우고 있었다. 반면에 선홍색 방울은 수가 적고 서로 멀리 떨어져 있었다. 두 물질의 양 차이가 컸다.',
  '녹말은 빽빽하게 들어차 있었지만 지방은 아주 드물었다. 세포 하나에 알갱이는 스무 개쯤 보였고 붉은 방울은 두세 개뿐이었다.',
  '아이오딘을 넣은 쪽은 전체가 파랗게 물들 만큼 알갱이가 많았고, 수단 Ⅲ 를 넣은 쪽은 작은 점이 띄엄띄엄 있을 뿐이었다.',
];

// 미달이어야 한다. 카드 합격 기준에 박힌 반례가 첫 줄이다.
const q2Fail = [
  '녹말은 청람색으로 보였다.',
  '아이오딘 용액을 넣으니 색이 변했다.',
  '녹말이 아주 많고 고르게 퍼져 있었다.',          // 한쪽 계열만 — 대조가 없다
  '지방은 드문드문 조금만 보였다.',                 // 반대쪽만 — 역시 대조가 없다
];

console.log('\n서술형 첨삭 — 바깥에서 던지는 문장\n');
console.log('2번 문항 (녹말과 지방의 분포)');

for (const s of q2Pass) {
  const v = verdict(gradeAnswer('q2', s, {}));
  check(v === 'pass', `통과해야 함: "${s.slice(0, 34)}…"`, v === 'pass' ? '' : `→ ${v}`);
}
for (const s of q2Fail) {
  const v = verdict(gradeAnswer('q2', s, {}));
  check(v !== 'pass', `미달이어야 함: "${s.slice(0, 34)}…"`, v !== 'pass' ? '' : '→ pass (통과해 버렸다)');
}

/* ------------------------------------------------------------------ */
/* 질문 ⓐ — 용액을 쓰는 까닭                                            */
/* ------------------------------------------------------------------ */

console.log('\n질문 ⓐ (용액을 쓰는 까닭)');

const qaPass = [
  '(가)는 아무것도 넣지 않아서 색이 없어 무엇이 있는지 구분할 수 없었다. 용액을 떨어뜨리면 녹말과 지방이 색을 띠어서 눈으로 찾아낼 수 있다.',
  '그냥 보면 세포 속이 투명해서 알아보기 어렵다. 아이오딘과 수단 Ⅲ 가 각각 녹말과 지방에만 반응해 색이 변하기 때문에 검출할 수 있다.',
];
const qaFail = [
  '색이 예쁘게 변해서 넣는다.',
  '선생님이 넣으라고 하셨다.',
];

for (const s of qaPass) {
  const v = verdict(gradeAnswer('qa', s, {}));
  check(v === 'pass', `통과해야 함: "${s.slice(0, 34)}…"`, v === 'pass' ? '' : `→ ${v}`);
}
for (const s of qaFail) {
  const v = verdict(gradeAnswer('qa', s, {}));
  check(v !== 'pass', `미달이어야 함: "${s.slice(0, 34)}…"`, v !== 'pass' ? '' : '→ pass (통과해 버렸다)');
}

/* ------------------------------------------------------------------ */
/* 3번 문항 — 보드가 없으면 '미달' 이 아니라 '아직 할 수 없음'          */
/* ------------------------------------------------------------------ */

console.log('\n3번 문항 (다른 모둠과 비교) — T06 공유 보드가 아직 없다');

const q3 = verdict(gradeAnswer('q3', '', { board: null }));
check(q3 === 'unavailable', "보드가 없으면 'unavailable' 을 돌려준다",
  q3 === 'unavailable' ? '' : `→ ${q3} (학생에게 못 한 일로 보이면 안 된다)`);

/* ------------------------------------------------------------------ */
/* 되돌려 주는 말 — 아이에게 보여 줄 문장이다                            */
/* ------------------------------------------------------------------ */

console.log('\n되돌려 주는 말');

if (!Array.isArray(QUESTIONS)) {
  check(false, 'QUESTIONS 문항 표를 내보낸다', 'if 사슬이면 전 문항을 훑을 수 없다');
} else {
  const blank = QUESTIONS.filter((q) => !q.feedback || !String(q.feedback).trim());
  check(blank.length === 0, '모든 문항에 되돌려 주는 말이 있다',
    blank.length ? `비어 있음: ${blank.map((q) => q.id).join(', ')}` : '');

  const harsh = QUESTIONS.filter((q) => /틀렸|잘못|오답|실패/.test(String(q.feedback)));
  check(harsh.length === 0, '되돌려 주는 말이 학생을 나무라지 않는다',
    harsh.length ? `문제 문구: ${harsh.map((q) => q.id).join(', ')}` : '');

  console.log(`\n  문항 ${QUESTIONS.length}개:`);
  for (const q of QUESTIONS) console.log(`    ${String(q.id).padEnd(4)} ${q.feedback ?? '(없음)'}`);
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length}건 미달\n` : '\n전부 통과\n');
process.exit(failed.length ? 1 : 0);
