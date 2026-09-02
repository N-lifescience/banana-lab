/**
 * 서술형 자동 첨삭.
 *
 * DOM 을 모르는 순수 모듈이다 — `document`·`window` 를 참조하지 않는다.
 * 정답 일치가 아니라 **「근거로 쓸 만한 낱말이 있는가」** 만 본다.
 * 형태소 분석기 없이 단순 포함 검사로 충분하다 — 학생 문장을 정확히 판정하는 것이 목적이
 * 아니라 **다시 보게 만드는 것**이 목적이다.
 *
 * 문항을 if 사슬로 짜지 않고 표(`QUESTIONS`) 하나로 내보낸다 — 테스트가 이 표를 통째로
 * 훑어 「되돌려 주는 말이 비었는지」 같은 것을 전 문항에 대해 검증할 수 있다.
 *
 * ── 비용은 비대칭이다 ──────────────────────────────────────────────
 * 이 첨삭은 점수를 매기지도, 진행을 막지도 않는다. 그러면
 *
 *   · 엉성한 답이 통과하는 비용   → 거의 0. 아무 일도 일어나지 않는다
 *   · **맞게 쓴 답이 미달로 뜨는 비용** → 크다. **아이가 자기가 틀렸다고 믿는다**
 *
 * 바나나랩에서 형용사 목록을 AND 로 묶었다가, 바깥에서 새로 쓴 학생 문장 9개 중 6개가
 * 미달로 떨어졌고 **6개 전부 맞게 쓴 답**이었다. 목록을 넓히는 것은 쳇바퀴다 —
 * 새 문장을 지을 때마다 또 어긋난다.
 *
 * 그래서 판정을 **「무엇을 견주고 있나」**로 본다. 무엇을 가리키는 말(이산화 탄소·BTB·
 * 발아·마른)은 형용사보다 훨씬 닫힌 집합이라 목록으로 잡을 수 있다.
 * 깊이를 재는 낱말은 **판정에서 힌트로 강등**했다 — 통과시키되 더 써 보라고 권한다.
 *
 * `scripts/check-grading.mjs` 와 `tests/grading.holdout.test.js` 가 이 판정을 지킨다.
 * 목록을 좁히면 거기서 잡힌다.
 */

export const STATUS = { PASS: 'pass', MORE: 'more', UNAVAILABLE: 'unavailable' };

/* ------------------------------------------------------------------ */
/* 소재 목록 — 무엇을 가리키는 말인가                                   */
/* ------------------------------------------------------------------ */

/** 잰 것 — 이산화 탄소 · 온도 · BTB 색. 어느 쪽으로 말해도 된다. */
const MEASURED = [
  '이산화 탄소', '이산화탄소', 'co2', 'CO2', 'CO₂', '탄소', 'ppm', '농도',
  '온도', '기온', '℃', '도씨', '따뜻', '더워', '뜨거',
  'btb', 'BTB', '색', '노랑', '노래', '노란', '녹색', '초록', '파랑', '파란', '푸른',
];

/** 콩 두 갈래를 가리키는 말. */
const SPROUT = ['발아', '싹', '불린', '불려', '젖은', '살아', '자라', '한쪽', '왼쪽', '오른쪽'];
const DRY = ['마른', '말린', '건조', '안 불린', '딱딱', '다른 쪽', '다른쪽', '나머지'];

/** 세포호흡·물질대사를 가리키는 말. 있으면 좋지만 없다고 미달로 만들지 않는다. */
const RESPIRATION = [
  '호흡', '세포호흡', '물질대사', '대사', '에너지', '분해', '양분', '영양',
  '산소', '내뿜', '내놓', '방출', '만들', '나와', '생겨', '활발',
];

/** 대조 실험을 가리키는 말. */
const CONTROL = [
  '같게', '같은', '똑같', '동일', '맞춰', '맞추', '통제', '변인', '조건', '대조',
  '비교', '견주', '차이', '때문', '까닭', '원인', '탓', '영향', '알 수 없', '말할 수 없',
  '가릴 수', '구분', '구별', '판단',
];

/**
 * 문항 표.
 * - `subjects`: 각 배열에서 하나 이상 나와야 한다. 배열끼리는 전부(AND) 필요하다
 * - `anyOf`: 배열 중 **하나라도** 걸리면 된다 — 개념 하나만 짚어도 통과시킬 때 쓴다
 * - `depth`: 통과 여부를 가르지 않는다. 없으면 통과시키되 `hint` 를 함께 돌려준다
 * - `minChars`: 공백을 뺀 글자 수 하한. 한두 낱말짜리 답만 거르는 보조 장치
 * - `available: false`: 항상 `unavailable` — 채점 자체가 불가능한 문항.
 *   「미달」로 보이면 학생에게 「못 한 일」로 읽히므로 별도 상태로 둔다
 */
export const QUESTIONS = [
  {
    id: 'qa',
    minChars: 20,
    /**
     * 「왜 두 챔버가 다르게 변했나」.
     * 잰 것을 말하든, 호흡·대사를 말하든, **하나만 짚어도 통과시킨다.**
     */
    anyOf: [MEASURED, RESPIRATION],
    depth: [[...SPROUT, ...DRY]],
    feedback: '두 챔버에서 무엇이 어떻게 달랐는지, 그리고 왜 그랬을지 이어서 써 보세요',
    hint: '어느 쪽 콩을 넣은 챔버인지 함께 적으면 까닭이 더 분명해집니다',
  },
  {
    id: 'q2',
    minChars: 20,
    /**
     * 「콩 말고는 왜 다 같게 두어야 하나」 — **이 실험의 몸통이다.**
     * 대조 실험을 가리키는 말이 있어야 통과시킨다. 하나만 있으면 된다.
     */
    subjects: [CONTROL],
    depth: [[...MEASURED, ...SPROUT, ...DRY]],
    feedback: '두 챔버에서 다른 것도 함께 달랐다면 무엇을 알 수 없게 되는지 써 보세요',
    hint: '무엇이 어떻게 달라졌는지 예를 하나 들면 더 좋겠습니다',
  },
  {
    id: 'record',
    /**
     * 15 였다. 「온도가 왼쪽이 1도 정도 높았다」(공백 빼고 14자)가 미달로 떨어졌다 —
     * 기록에 붙는 물음은 「무엇을 보았나」라 **짧은 관찰 한 줄이 정답의 모양**이다.
     * 한두 낱말(「노란색.」)만 거르면 되므로 10 으로 낮춘다 (플레이테스트).
     */
    minChars: 10,
    /** 기록마다 붙는 「무엇을 보았나」. 잰 것을 하나라도 짚으면 통과다. */
    anyOf: [MEASURED],
    depth: [[...SPROUT, ...DRY]],
    feedback: '두 챔버의 BTB 색이나 온도가 어떻게 달랐는지 적어 보세요',
    hint: '어느 쪽 챔버인지 함께 적으면 나중에 읽기 좋습니다',
  },
  {
    id: 'q3',
    /**
     * 다른 모둠과의 비교. **채점할 근거가 이 화면에 없다.**
     * 「미달」로 두면 답을 잘 써도 부족하다는 말을 듣는다.
     */
    available: false,
    feedback: '다른 모둠의 결과는 이 화면이 알 수 없어 첨삭하지 않습니다. 자유롭게 쓰세요',
  },
];

/**
 * 얼마나 썼는지는 **글자 수**로 잰다. 문장 수로 세지 않는다.
 *
 * 문장 수를 세면 잘 쓴 한 문장이 짧다고 되돌려 보내진다. 마침표·쉼표를 어떻게 쓰는지는
 * 학생마다 다르고, 그건 우리가 볼 것이 아니다. 이 조건의 목적은 한두 낱말짜리 답만
 * 거르는 것뿐이라 글자 수로 충분하다.
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
 * 통과 조건은 **무엇에 대해 썼는가**와 **얼마나 썼는가** 둘뿐이다.
 * 견주는 낱말(`depth`)은 통과를 가르지 않고, 없으면 권유(`hint`)만 붙인다.
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

/** `gradeQuestion` 의 별칭. `scripts/check-grading.mjs` 가 이 이름을 쓴다. */
export function gradeAnswer(id, text, _context) {
  return gradeQuestion(id, text);
}
