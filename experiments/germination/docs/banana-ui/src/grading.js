/**
 * 서술형 자동 첨삭.
 *
 * DOM 을 모르는 순수 모듈이다 — document, window 를 참조하지 않는다.
 * 정답 일치가 아니라 "근거로 쓸 만한 낱말이 둘 다 있는가" 만 본다 (docs/06-lab-notebook.md 참조).
 * 형태소 분석기 없이 단순 포함 검사로 충분하다 — 학생 문장을 정확히 판정하는 게 목적이 아니라
 * 다시 보게 만드는 게 목적이다.
 *
 * 문항을 if 사슬로 짜지 않고 표(QUESTIONS) 하나로 내보낸다 — tests/grading.test.js 가
 * 이 표를 통째로 훑어 "되돌려 주는 말이 비었는지" 같은 것을 전 문항에 대해 검증할 수 있다.
 * 이 표의 feedback 문구는 docs/06 의 첨삭 표 문구를 그대로 쓴다 — 화면에 보이는 다른 한국어와
 * 달리 여기서는 규칙과 문구가 한 쌍이라 표 밖(strings.js)으로 떼어내지 않는다.
 */

import { magnification, EYEPIECE } from '../sim/optics.js';

export const STATUS = { PASS: 'pass', MORE: 'more', UNAVAILABLE: 'unavailable' };

/**
 * 무엇을 보고 판정하는가 — 그리고 왜 그렇게 바꿨는가.
 *
 * 처음에는 형용사 목록 두 개를 AND 로 묶었다 (녹말 계열 '많/가득/빽빽' 과 지방 계열 '적/드문/작').
 * 목록에 없는 낱말을 쓴 정답이 전부 미달로 떨어졌다. 실제로 구현이 본 적 없는 학생 문장
 * 9개를 던져 보니 6개가 어긋났고, **6개 전부 맞게 쓴 답을 미달로 판정한 것**이었다.
 *
 *   "파란 점들이 셀 수 없을 만큼 잔뜩 있었다. 빨간 것은 손에 꼽을 정도였다."   → 미달
 *   "(나) 쪽이 훨씬 촘촘했고 (다) 쪽은 듬성듬성했다."                          → 미달
 *
 * 목록을 넓히는 것은 쳇바퀴다. 새 문장을 지을 때마다 또 어긋난다.
 * 근본 원인은 **비용 비대칭을 거꾸로 잡은 것**이다. 이 첨삭은 점수를 매기지도, 진행을 막지도
 * 않는다 (`docs/06`, T05 카드). 그러면
 *
 *   · 엉성한 답이 통과하는 비용  →  거의 0. 아무 일도 일어나지 않는다
 *   · 맞게 쓴 답이 미달로 뜨는 비용 →  크다. 아이가 자기가 틀렸다고 믿는다
 *
 * 그래서 판정을 "어떤 형용사를 썼나" 가 아니라 **"무엇을 견주고 있나"** 로 바꿨다.
 * 무엇을 가리키는 말(녹말·청람·파란·아이오딘·(나))은 형용사보다 훨씬 닫힌 집합이라
 * 목록으로 잡을 수 있다. 그 위에 길이만 본다.
 *
 * 깊이를 재는 낱말은 버리지 않고 **판정에서 힌트로 강등**했다. 통과시키되,
 * 견주는 말이 안 보이면 더 써 보라고 권한다. 판정이 아니라 권유다 — 그것이 원래 목적이다.
 *
 * `scripts/check-grading.mjs` 와 `tests/grading.holdout.test.js` 가 이 판정을 지킨다.
 * 목록을 좁히면 거기서 잡힌다.
 */

/**
 * 문항 표.
 * - subjects: 각 배열에서 하나 이상 나와야 한다. 배열끼리는 전부(AND) 필요하다.
 *   "무엇에 대해 쓰고 있는가" 를 본다 — 2번 문항은 녹말과 지방을 **둘 다** 말해야 한다.
 * - anyOf: 배열 중 **하나라도** 걸리면 된다. qa 처럼 개념 하나만 짚어도 통과시킬 때 쓴다.
 * - depth: 통과 여부를 가르지 않는다. 없으면 통과시키되 `hint` 를 함께 돌려준다.
 * - minChars: 공백을 뺀 글자 수 하한. 한두 낱말짜리 답만 거르는 보조 장치.
 * - available: false 면 항상 'unavailable' — 3번 문항은 공유 보드(T06)가 없어 채점 자체가
 *   불가능하다. '미달' 로 보이면 학생에게 "못 한 일" 로 읽히므로 별도 상태로 둔다.
 */
export const QUESTIONS = [
  {
    id: 'qa',
    minChars: 20,
    // 대조군이 안 보였다는 쪽, 또는 용액이 색으로 드러냈다는 쪽. 하나만 짚어도 통과시킨다.
    anyOf: [
      ['무색', '색이 없', '색깔이 없', '투명', '구분', '구별', '어렵', '어려', '힘들',
        '보이지 않', '안 보', '모르', '알 수 없', '표시가 없', '맨눈', '그냥 보'],
      ['색이 변', '색깔이 변', '색을 띠', '띠어서', '물들', '염색', '검출', '반응',
        '푸르게', '파랗게', '파란', '청람', '붉게', '붉은', '선홍', '나타나', '드러나',
        '찾아낼', '찾을 수 있', '알아낼', '알아볼 수 있', '확인할 수 있', '알 수 있'],
    ],
    depth: [['대조', '(가)', '가 슬라이드', '비교', '견주']],
    feedback: '(가)에서는 무엇이 보였는지 다시 보고, 왜 (나)에서는 보였는지 이어서 써 보세요',
    hint: '(가) 대조군과 견주어 쓰면 까닭이 더 분명해집니다',
  },
  {
    id: 'q2',
    minChars: 20,
    // 두 물질을 가리키는 말. 형용사와 달리 닫힌 집합이라 목록으로 잡을 수 있다.
    subjects: [
      ['녹말', '전분', '청람', '파란', '파랑', '푸른', '아이오딘', '(나)'],
      ['지방', '지질', '선홍', '붉은', '빨간', '빨강', '수단', '(다)'],
    ],
    // 견주는 말. 없다고 미달로 만들지 않는다 — 통과시키고 권유만 한다.
    depth: [[
      '많', '적', '가득', '고르', '빽빽', '촘촘', '잔뜩', '꽉', '전체', '골고루', '풍부',
      '드문', '드물', '듬성', '몇', '두세', '손에 꼽', '겨우', '어쩌다', '희박',
      '훨씬', '보다', '비해', '지만', '는데', '반면', '하지만', '그러나', '차이',
    ]],
    feedback: '두 물질의 양과 흩어진 모양을 서로 견주어 써 보세요. 어느 쪽이 더 많았나요?',
    hint: '어느 쪽이 더 많았는지 한 줄 덧붙이면 좋겠습니다',
  },
  {
    id: 'q3',
    available: false,
    feedback: '아직 다른 모둠의 결과를 보지 않았습니다',
  },
];

/**
 * 얼마나 썼는지는 **글자 수**로 잰다. 문장 수로 세지 않는다.
 *
 * 문장 수를 세면 잘 쓴 한 문장이 짧다고 되돌려 보내진다. 실제로 걸렸다:
 *   "녹말 알갱이는 세포를 꽉 채웠지만 지방 방울은 어쩌다 하나씩 눈에 띄었다."
 * 두 물질을 다 말하고 대조도 분명한데 마침표가 하나라 미달이었다.
 * 마침표·쉼표를 어떻게 쓰는지는 학생마다 다르고, 그건 우리가 볼 것이 아니다.
 * 이 조건의 목적은 한두 낱말짜리 답만 거르는 것뿐이라 글자 수로 충분하다.
 */
function bodyLength(text) {
  return text.replace(/\s+/g, '').length;
}

function hasAnyKeyword(text, words) {
  return words.some((w) => text.includes(w));
}

/**
 * 통과시킬지 정한다.
 *
 * 통과 조건은 **무엇에 대해 썼는가** 와 **얼마나 썼는가** 둘뿐이다.
 * 견주는 낱말(depth)은 통과를 가르지 않고, 없으면 권유(hint)만 붙인다.
 * 왜 이렇게 하는지는 이 파일 위쪽 주석에 적어 두었다 — 요약하면,
 * 맞게 쓴 답을 미달로 만드는 비용이 그 반대보다 훨씬 크기 때문이다.
 *
 * @returns {{status: 'pass'|'more'|'unavailable', message: string|null}}
 */
export function grade(question, text) {
  if (question.available === false) {
    return { status: STATUS.UNAVAILABLE, message: question.feedback };
  }
  const t = (text ?? '').trim();
  if (!t) return { status: STATUS.MORE, message: question.feedback };

  const lengthOk = bodyLength(t) >= (question.minChars ?? 20);
  const subjectsOk = (question.subjects ?? []).every((words) => hasAnyKeyword(t, words));
  const anyOfOk = !question.anyOf || question.anyOf.some((words) => hasAnyKeyword(t, words));

  if (!lengthOk || !subjectsOk || !anyOfOk) {
    return { status: STATUS.MORE, message: question.feedback };
  }

  // 통과다. 견주는 말이 안 보이면 더 써 보라고 권한다 — 판정이 아니라 권유다.
  const deepOk = !question.depth || question.depth.some((words) => hasAnyKeyword(t, words));
  return { status: STATUS.PASS, message: deepOk ? null : (question.hint ?? null) };
}

export function gradeQuestion(id, text) {
  const question = QUESTIONS.find((q) => q.id === id);
  if (!question) throw new Error(`알 수 없는 문항: ${id}`);
  return grade(question, text);
}

/**
 * gradeQuestion 의 별칭. scripts/check-grading.mjs 가 이 이름과 (id, text, context) 형태를 쓴다.
 * context 는 지금 안 쓴다 — 3번 문항의 unavailable 은 공유 보드가 아직 없다는 사실(QUESTIONS
 * 표의 available:false) 로만 정해지고, 보드가 생기면(T06) 그때 context 로 넘어온 보드 데이터를
 * 보게 될 것이다.
 */
export function gradeAnswer(id, text, _context) {
  return gradeQuestion(id, text);
}

/**
 * 결과 및 정리 1 — 배율 입력 첨삭 (docs/06 첨삭 표 1행).
 * 배율은 접안(고정 10배) × 대물렌즈의 곱이다. optics.magnification() 이 정답이다.
 */
export function gradeMagnification(input, objective) {
  const correct = magnification(objective);
  if (Number(input) === correct) return { status: STATUS.PASS, message: null };
  return {
    status: STATUS.MORE,
    // 예전 문구는 "지금 대물렌즈는 400×입니다" 였다 — 400 은 대물렌즈가 아니라 답이고,
    // 한 번 틀리면 화면이 곱셈 결과를 그대로 내주고 있었다. 곱할 두 수만 알려 준다.
    message: `배율은 접안렌즈 배율 × 대물렌즈 배율입니다. 접안렌즈는 ${EYEPIECE}배, 지금 대물렌즈는 ${objective}배입니다`,
  };
}
