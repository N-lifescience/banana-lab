/**
 * 이 실험이 **무엇이고 교육과정 어디에 놓이는가.** 화면에 쓰이지 않는, 목록을 위한 정보다.
 *
 * ── 왜 지금 만드는가 ────────────────────────────────────────────────
 * 실험을 합칠 때 `experiments/<id>/manifest.js` 가 필요하다 (`MERGE-AND-DEPLOY.md` §2).
 * 이 파일이 클론에 **미리 들어 있으면** 실험 세션이 자기 것을 채워 돌려주고, 합치는 사람은
 * 모아 놓기만 하면 된다. 없으면 나중에 실험 일곱 개를 열어 가며 사람이 되짚어 써야 한다.
 * 지금 채우는 값이 곧 메인 페이지의 카드 한 장이 된다.
 *
 * ── 여기 없는 것 ────────────────────────────────────────────────────
 * `entry`(진입점)는 **합치는 사람이** 붙인다. 독립 앱일 때는 진입점이 하나뿐이라 쓸 데가 없다.
 * 공용 엔진도, 라우팅도, 목록 화면도 아직 만들지 않는다 — 세 번째 실험이 나오기 전에는
 * 무엇이 공통인지 모른다 (`MERGE-AND-DEPLOY.md` §1).
 */

import { UI } from './ui/strings.js';

/**
 * 실험의 **뼈대** — 조작과 결과 화면의 큰 틀.
 *
 * 실험이 여덟 개일 때는 "바나나랩을 복제한다" 로 충분하다. 수십 개가 되면 물음이
 * "무엇을 복제하나" 로 바뀐다. 크로마토그래피와 원심분리는 이미 현미경이 없어서
 * 바나나랩의 절반이 남는 코드다. 그래서 뼈대에 이름을 붙여 둔다.
 *
 * 목록은 **닫혀 있지 않다.** 새 뼈대가 필요하면 여기 한 줄을 늘리는데, 늘리기 전에
 * 기존 뼈대로 안 되는 이유를 한 문장으로 적을 수 있어야 한다. 적을 수 없으면 기존 것이다.
 */
export const SKELETONS = {
  /** 표본을 만들어 현미경으로 본다 — 봉입·덮개 유리·배율·초점. banana · osmosis · micrometer */
  'microscope-slide': '슬라이드 제작 + 현미경 관찰',
  /** 변인을 고르고 조건을 맞춰 반복 측정한다. 결과는 조건 간 비교다. catalase · fermentation */
  'variable-design': '변인 설계 + 반복 측정',
  /** 섞인 것을 나눈다. 결과가 띠·층처럼 **위치**로 나온다. chromatography · centrifuge */
  'separation': '분리 — 띠·층으로 읽는 결과',
  /** 닫아 놓고 시간이 지나기를 기다린다. 결과가 시간축을 갖는다. germination */
  'time-course': '시간 경과 관찰',
};

/**
 * 이 실험이 쓰이는 교육과정 자리. **목록이다 — 하나가 아니다.**
 *
 * 여기가 이 파일에서 가장 중요한 자리다. 중·고 생명과학 전체로 넓히면 같은 실험이
 * 여러 교과서에 나온다(삼투는 중학교 과학에도, 생명과학Ⅰ에도, 세포와 물질대사에도 있다).
 * 교과서마다 시뮬레이터를 새로 만들면 실험 30개가 아니라 180개가 된다.
 * **실험은 하나로 두고 이 목록을 늘린다.**
 *
 * 쪽수는 **사람이 책을 보고 채운다.** 모르면 null 로 두어라 — 지어낸 쪽수는
 * 없는 쪽수보다 나쁘다. 교사가 그 쪽을 펴 보고 나서야 틀린 것을 안다.
 */
const curriculum = [
  { school: '고', course: '세포와 물질대사', publisher: '비상교육', unit: 'Ⅰ. 세포', page: 13 },
  { school: '중', course: '과학', publisher: null, unit: null, page: null },
];

export const manifest = {
  /**
   * 주소와 폴더 이름이 되는 값 (`/?exp=banana`).
   *
   * **한 번 정하면 못 바꾼다.** 교사가 반마다 다른 링크를 만들어 나눠 주고, 그 링크는
   * 학습지에 인쇄돼 남는다. 바꾸면 이미 나간 종이가 죽는다.
   *
   * 규칙: **무엇을 하는 실험인가**로 짓는다. 어느 교과서에 있는지로 짓지 않는다.
   *   ✅ osmosis-onion · osmosis-potato   (재료·방법이 다르면 다른 실험이다)
   *   ❌ bio1-osmosis · middle2-osmosis   (같은 실험을 교과서 수만큼 복제하게 된다)
   * 이름이 부딪히면 교과 접두사를 붙이지 말고 **무엇이 다른지를 붙여라.**
   */
  id: 'banana',

  /** 제목은 화면에도 쓰인다. 두 곳에 적으면 언젠가 달라진다. */
  title: UI.appTitle,

  /** 카드 한 장에 들어갈 한 문장. **결과를 미리 말하지 않는다** (`ROSTER.md` 메인 페이지 규칙). */
  summary: '바나나 과육을 발라 만든 슬라이드를 두 가지 용액으로 염색하고, 현미경으로 녹말립과 지질 방울을 찾는다.',

  skeleton: 'microscope-slide',

  /**

   * 실제 실험용 보고서 양식(`public/forms/`)의 파일 이름. **이 값이 그 종이의 유일한 주소다** —

   * 앱과 선생님 화면이 이것으로 링크를 만들고, `scripts/build-report-form.mjs` 가 이 이름으로 굽는다.

   * 내용은 `src/forms/spec.js` 에 있다. 둘이 어긋나면 굽는 자리에서 멎는다.

   */

  formFile: '바나나_탄수화물과_지질_보고서양식.pdf',

  /** 'ready' 는 열어서 쓸 수 있다는 뜻. 'draft' 는 목록에 흐리게만 나온다. */
  status: 'ready',

  /** 이 실험이 지원하는 난이도. 난이도는 학년이 아니라 **화면이 얼마나 거들어 주는가**다. */
  levels: [1, 2, 3],

  /** 혼자/모둠. 모둠 활동이 성립하지 않는 실험은 ['solo'] 만 둔다. */
  modes: ['solo', 'group'],

  curriculum,
};

/**
 * 매니페스트가 쓸 만한지 본다. 문제를 배열로 돌려준다 — 비어 있으면 통과다.
 *
 * 던지지 않고 모아서 돌려주는 이유: 합칠 때 실험 여러 개를 한 번에 검사하는데,
 * 첫 실험에서 멈추면 나머지를 보려고 몇 번을 다시 돌려야 한다.
 */
export function validateManifest(m) {
  const bad = [];
  const need = (cond, msg) => { if (!cond) bad.push(msg); };

  need(typeof m?.id === 'string' && /^[a-z][a-z0-9-]*$/.test(m.id),
    'id 는 소문자·숫자·붙임표만 씁니다 (폴더 이름이자 주소가 됩니다)');
  need(!/^(중|고|middle|high|bio|sci)\d*-/.test(m?.id ?? ''),
    `id 에 교과 접두사를 붙이지 마세요 — 같은 실험이 교과서마다 복제됩니다: ${m?.id}`);
  need(typeof m?.title === 'string' && m.title.length > 0, 'title 이 필요합니다');
  need(typeof m?.summary === 'string' && m.summary.length > 10, 'summary 가 필요합니다 (카드 한 문장)');
  need(m?.skeleton in SKELETONS, `모르는 뼈대: ${m?.skeleton} — SKELETONS 에 있는 것을 쓰거나 새로 추가하세요`);
  need(['ready', 'draft'].includes(m?.status), "status 는 'ready' 또는 'draft' 입니다");
  need(Array.isArray(m?.levels) && m.levels.length > 0 && m.levels.every((l) => [1, 2, 3].includes(l)),
    'levels 는 1·2·3 중 하나 이상입니다');
  need(Array.isArray(m?.modes) && m.modes.length > 0 && m.modes.every((x) => ['solo', 'group'].includes(x)),
    "modes 는 'solo'·'group' 중 하나 이상입니다");
  need(Array.isArray(m?.curriculum) && m.curriculum.length > 0,
    'curriculum 이 비었습니다 — 이 실험이 어느 교과 어디에 놓이는지가 목록 화면을 만듭니다');

  for (const [i, c] of (m?.curriculum ?? []).entries()) {
    need(['중', '고'].includes(c?.school), `curriculum[${i}].school 은 '중' 또는 '고' 입니다`);
    need(typeof c?.course === 'string' && c.course.length > 0, `curriculum[${i}].course 가 필요합니다`);
    need(c?.page === null || Number.isInteger(c?.page),
      `curriculum[${i}].page 는 정수이거나 null 입니다 — 모르면 null 로 두고 지어내지 마세요`);
  }
  return bad;
}
