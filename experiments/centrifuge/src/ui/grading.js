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


export const STATUS = { PASS: 'pass', MORE: 'more', UNAVAILABLE: 'unavailable' };

/**
 * 무엇을 보고 판정하는가 — 그리고 왜 그렇게 잡았는가.
 *
 * **비용이 비대칭이다.** 이 첨삭은 점수를 매기지도, 진행을 막지도 않는다. 그러면
 *
 *   · 엉성한 답이 통과하는 비용   →  거의 0. 아무 일도 일어나지 않는다
 *   · 맞게 쓴 답이 미달로 뜨는 비용 →  크다. 아이가 자기가 틀렸다고 믿는다
 *
 * 그래서 판정을 "어떤 형용사를 썼나" 가 아니라 **"무엇에 대해 쓰고 있나"** 로 잡는다.
 * 무엇을 가리키는 말(적혈구·혈장·균형·흔들)은 형용사보다 훨씬 닫힌 집합이라
 * 목록으로 잡을 수 있다. 그 위에 길이만 본다.
 *
 * 깊이를 재는 낱말은 **판정에서 힌트로 강등**한다. 통과시키되, 없으면 더 써 보라고 권한다.
 * 판정이 아니라 권유다 — 그것이 원래 목적이다.
 *
 * `scripts/check-grading.mjs` 와 `tests/grading.holdout.test.js` 가 이 판정을 지킨다.
 * 목록을 좁히면 거기서 잡힌다.
 */

/**
 * 문항 표.
 * - subjects: 각 배열에서 하나 이상 나와야 한다. 배열끼리는 전부(AND) 필요하다.
 * - anyOf: 배열 중 **하나라도** 걸리면 된다. 개념 하나만 짚어도 통과시킬 때 쓴다.
 * - depth: 통과 여부를 가르지 않는다. 없으면 통과시키되 `hint` 를 함께 돌려준다.
 * - minChars: 공백을 뺀 글자 수 하한. 한두 낱말짜리 답만 거르는 보조 장치.
 * - available: false 면 항상 'unavailable' — 3번 문항은 다른 모둠의 결과를 볼 길이 아직
 *   없어 채점 자체가 불가능하다. '미달' 로 보이면 "못 한 일" 로 읽히므로 별도 상태로 둔다.
 */
export const QUESTIONS = [
  {
    id: 'qa',
    minChars: 20,
    // 흔들린다는 쪽, 또는 무게가 한쪽으로 쏠린다는 쪽. 하나만 짚어도 통과시킨다.
    anyOf: [
      ['흔들', '떨', '덜덜', '요동', '진동', '기울', '휘청', '어긋', '삐뚤', '고르지 않'],
      ['균형', '평형', '무게', '중심', '한쪽', '한 쪽', '반대쪽', '양쪽', '맞춰', '맞추',
        '같은 무게', '똑같이', '대칭'],
    ],
    depth: [['섞', '흐리', '흐려', '번', '경계', '층이 안', '잘 안', '또렷', '깨끗', '망가',
      '느려', '덜 빠', '속도']],
    feedback: '한쪽만 넣고 돌렸을 때 회전판이 어땠는지, 그것이 층에 무엇을 했는지 이어서 써 보세요',
    hint: '흔들리면 층이 어떻게 되는지 한 줄 덧붙이면 까닭이 더 분명해집니다',
  },
  {
    id: 'q2',
    /*
     * 25 였다. 그런데 이 파일 아래 `bodyLength` 주석이 **통과해야 한다고 든 예문**
     * 「바깥쪽은 진한 적혈구층이고 축 쪽은 맑은 혈장이었다」가 공백을 빼면 21자라
     * 자기 예문을 미달로 돌려보내고 있었다 (플레이테스트 — PLAYTEST-REVIEW #9).
     * 한쪽만 말한 답은 낱말 조건이 이미 거르므로 글자 수는 한두 낱말짜리만 거르면 된다.
     */
    minChars: 20,
    // 갈라진 것들을 가리키는 말. 바깥쪽 것과 축 쪽 것을 **둘 다** 말해야 한다.
    subjects: [
      ['적혈구', '붉', '빨간', '빨강', '암적', '진한 색', '짙은', '어두운', '가라앉', '아래쪽'],
      ['혈장', '혈청', '노란', '노랑', '누런', '담황', '맑', '투명', '액체', '위쪽', '윗부분'],
    ],
    // 연층까지 짚으면 좋지만, 없다고 미달로 만들지 않는다 — 아주 얇아서 놓치기 쉽다.
    depth: [['연층', '버피', '백혈구', '혈소판', '회백', '흰', '하얀', '얇은 띠', '가운데',
      '사이']],
    feedback: '바깥쪽에 모인 것과 축 쪽에 남은 것을 **둘 다** 쓰고, 각각이 무엇인지 이어서 써 보세요',
    hint: '두 층 사이의 아주 얇은 띠도 보았다면 한 줄 덧붙여 보세요',
  },
  {
    id: 'q3',
    available: false,
    feedback: '모둠원의 기록을 모은 뒤 견주어 쓰는 문항이라 첨삭하지 않습니다. 자유롭게 쓰세요',
  },
];

/**
 * 얼마나 썼는지는 **글자 수**로 잰다. 문장 수로 세지 않는다.
 *
 * 문장 수를 세면 잘 쓴 한 문장이 짧다고 되돌려 보내진다. **바나나랩에서 실제로 걸렸다** —
 * 두 물질을 다 말하고 대조도 분명한 답이 마침표가 하나라 미달이었다.
 * 이 실험으로 옮기면 이런 답이다:
 *   "바깥쪽은 진한 적혈구층이고 축 쪽은 맑은 혈장이었다"
 * 한 문장이지만 물어본 것에는 다 답했다.
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
 * 헤마토크릿 입력 첨삭.
 *
 * **답을 되돌려 주지 않는다.** 한 번 틀렸다고 화면이 값을 알려 주면, 그 뒤로는 재어 볼
 * 이유가 없어진다 — 이 실험이 가르치려는 것이 재는 것과 나누는 것이다.
 * 되돌려 주는 것은 **구하는 방법**뿐이다.
 *
 * 자를 눈으로 읽는 일이라 넉넉히 봐준다. 이 값은 점수가 아니라 "다시 재어 볼래?" 다.
 *
 * @param {string|number} input  학생이 적은 값 (%)
 * @param {number} packedOfColumn  그림에서 적혈구층이 기둥에서 차지하는 비율 0~1
 */
export const HCT_TOLERANCE_PCT = 8;

export function gradeHematocrit(input, packedOfColumn) {
  const got = Number(String(input ?? '').replace(/[%\s]/g, ''));
  if (!Number.isFinite(got) || got <= 0) {
    return {
      status: STATUS.MORE,
      message: '적혈구층 길이를 혈액 기둥 전체 길이로 나눈 뒤 100을 곱하세요',
    };
  }
  const want = (packedOfColumn ?? 0) * 100;
  if (Math.abs(got - want) <= HCT_TOLERANCE_PCT) return { status: STATUS.PASS, message: null };
  return {
    status: STATUS.MORE,
    // 정답을 적지 않는다. **어디를 다시 재야 하는지**만 말한다.
    message: '자를 다시 대고, 바깥쪽 끝에서 적혈구층 경계까지와 기둥 전체를 각각 읽어 보세요',
  };
}
