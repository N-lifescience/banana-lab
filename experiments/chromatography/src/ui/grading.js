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

import { rf } from '../sim/develop.js';

export const STATUS = { PASS: 'pass', MORE: 'more', UNAVAILABLE: 'unavailable' };

/**
 * 무엇을 보고 판정하는가 — 그리고 왜 그렇게 하는가.
 *
 * **바나나랩에서 물린 것을 그대로 물려받은 규칙이다.** 거기서는 형용사 목록 두 개를 AND 로
 * 묶었다가, 구현이 본 적 없는 학생 문장 9개 중 6개를 미달로 판정했다. **6개 전부 맞게 쓴
 * 답이었다.**
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
 * 그래서 판정을 "어떤 형용사를 썼나" 가 아니라 **"무엇에 대해 쓰고 있나"** 로 둔다.
 * 무엇을 가리키는 말(색소 이름·색 이름·위아래)은 형용사보다 훨씬 닫힌 집합이라
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
 *   "무엇에 대해 쓰고 있는가" 를 본다 — 2번 문항은 색소와 위아래를 **둘 다** 말해야 한다.
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
    /**
     * 「왜 갈라지는가」.
     *
     * 답의 모양이 여럿이다 — 용해도로 설명해도, 종이에 붙는 정도로 설명해도, 그냥
     * "성질이 달라서 올라가는 정도가 다르다" 로 설명해도 맞다. 어느 하나를 요구하면
     * **맞게 쓴 답을 미달로 만든다.** 그래서 두 무리 중 **하나만** 걸려도 통과시킨다.
     */
    anyOf: [
      // 무엇이 다른가
      ['성질', '용해', '녹는', '녹아', '잘 녹', '흡착', '붙는', '붙어', '달라', '다르', '차이',
        '무게', '크기', '분자', '극성', '친화', '끌리'],
      // 그래서 무엇이 달라지는가
      ['올라가', '올라오', '올라간', '이동', '빠르', '느리', '멀리', '더 높', '높이',
        '거리', '속도', '갈라', '분리', '나뉘', '나누어', '따라 올'],
    ],
    depth: [['전개액', '용매', '종이', '거름종이', '모세관', '타고']],
    feedback: '초록 한 가지로 보이던 것이 왜 여러 줄로 갈라졌는지, 색소마다 무엇이 달라서 그런지 이어서 써 보세요',
    hint: '전개액과 종이가 무슨 일을 하는지 한 줄 덧붙이면 좋겠습니다',
  },
  {
    id: 'q2',
    minChars: 20,
    /**
     * 「띠 순서와 그 까닭」.
     *
     * 색소를 가리키는 말과 위·아래를 가리키는 말. 형용사와 달리 닫힌 집합이라
     * 목록으로 잡을 수 있다. **색 이름도 받는다** — 학생이 「주황이 맨 위」 라고 쓰는 것은
     * 색소 이름을 외우지 못한 것이지 틀린 것이 아니다.
     */
    subjects: [
      ['카로틴', '잔토필', '엽록소', '클로로필', '색소',
        '주황', '주홍', '노랑', '노란', '청록', '청녹', '황록', '연두', '초록', '녹색'],
      /*
       * 순서를 가리키는 말.
       *
       * **이건 목록을 넓힌 것이 맞다.** 바깥 세션이 던진 문장 하나가 여기서 걸렸다 —
       * 「카로틴이 1등, 잔토필이 2등, … 엽록소 b가 꼴등」. 순서를 **등수**로 말한
       * 맞는 답인데 미달로 판정했다.
       *
       * 형용사 목록을 넓히는 것과는 다르다. 양을 나타내는 말(잔뜩·듬성듬성·손에 꼽을)은
       * 사실상 끝이 없어서 넓혀 봐야 쳇바퀴지만, **순서를 나타내는 말은 문법화된 닫힌
       * 집합**이다 — 공간(위·아래) · 차례(순서·차례) · 서수(첫·째·다음) · 등수 넷뿐이다.
       * 그래도 다음에 또 걸리는 표현이 나오면, 그때는 넓히지 말고 판정 방식을 다시 볼 것.
       */
      ['위', '아래', '높', '낮', '먼저', '처음', '맨', '순서', '순으로', '차례',
        '앞', '뒤', '밑', '다음', '째', '등수', '1등', '2등', '3등', '꼴등', '나중'],
    ],
    // 까닭을 대는 말. 없다고 미달로 만들지 않는다 — 통과시키고 권유만 한다.
    depth: [['때문', '왜냐', '해서', '라서', '으로', '어서', '성질', '용해', '녹', '흡착', '차이']],
    feedback: '위에서부터 어떤 순서였는지 적고, 왜 그 순서가 되었을지 이어서 써 보세요',
    hint: '왜 그 순서가 되었을지 한 줄 덧붙이면 좋겠습니다',
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
 * 전개율(Rf) 입력 첨삭.
 *
 * ── 앱은 정답 Rf 를 갖고 있지 않다 ─────────────────────────────────
 * 교과서 순서에 대응하는 권위 있는 Rf 표를 못 찾았다 (AGENTS.md §2.5). 그래서 여기서
 * 보는 것은 **"카로틴의 Rf 가 맞나"** 가 아니라 **"방금 잰 두 거리를 제대로 나눴나"** 다.
 * 두 거리는 학생이 화면의 자로 읽은 값이고, 이 함수는 그 나눗셈만 확인한다.
 *
 * 그래서 색소 이름을 인자로 받지 않는다. 받게 되는 순간 앱이 없는 답을 갖고 있는 척하게 된다.
 *
 * ── 되돌려 주는 말에 답을 적지 않는다 ──────────────────────────────
 * 한 번 틀렸다고 몫을 그대로 내주면, 그 뒤로는 나눌 이유가 없다. **구하는 방법**만 말한다.
 */
export function gradeRf(input, { pigmentMm, solventMm } = {}) {
  const answer = rf(pigmentMm, solventMm);
  if (answer === null) {
    return { status: STATUS.UNAVAILABLE, message: '용매 전선을 표시하지 않아 나눌 분모가 없습니다' };
  }
  const given = Number(String(input ?? '').trim());
  if (!Number.isFinite(given)) {
    return { status: STATUS.MORE, message: '색소가 이동한 거리를 용매가 이동한 거리로 나눈 값을 적어 보세요' };
  }
  // 자로 읽는 값이라 눈금 한 칸쯤은 어긋난다. 0.05 는 그 폭이다.
  if (Math.abs(given - answer) <= 0.05) return { status: STATUS.PASS, message: null };
  if (given > 1) {
    return {
      status: STATUS.MORE,
      message: '전개율은 1보다 클 수 없습니다 — 색소는 용매보다 멀리 가지 못합니다. 나누는 순서를 다시 보세요',
    };
  }
  return {
    status: STATUS.MORE,
    message: '두 거리 모두 **원점에서부터** 재어, 색소가 간 거리를 용매가 간 거리로 나누세요',
  };
}
