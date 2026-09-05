/**
 * 아트 디렉션 토큰 — 라인 + 플랫 (확정)
 *
 * 이 파일은 기구 애셋(src/assets/)에만 적용된다.
 * 현미경 시야(src/render/fov.js)는 광학 시뮬레이션이라 별도 규칙을 따른다.
 * docs/01-art-direction.md 참조.
 *
 * 여기 없는 색을 애셋에 쓰면 `npm run check:art`가 실패한다.
 * 새 색이 필요하면 반드시 이 파일에 먼저 추가하고, 왜 필요한지 주석을 남긴다.
 */

/** 모든 애셋의 외곽선은 이 한 가지 색을 쓴다. 물체마다 다른 선색을 쓰면 세트가 흩어진다. */
export const INK = '#2F2A20';

/**
 * 물체마다 [기본, 음영] 두 단계만 갖는다.
 * 음영은 항상 형태의 우하단에 온다 — 광원이 좌상단 45°이기 때문이다.
 */
export const PALETTE = {
  ink: [INK, INK],

  // 바나나
  peelUnripe:   ['#CFE08C', '#A6C059'],
  peelRipe:     ['#F3D25B', '#D9A93A'],
  peelOverripe: ['#DCC084', '#B08A48'],
  peelSpot:     ['#8A6A2A', '#6E5420'],
  flesh:        ['#FAF4E0', '#E5DAB8'],
  stem:         ['#8A7538', '#6B5A28'],
  tip:          ['#4A3818', '#3A2C12'],

  // 기구
  glass:        ['#CFECEA', '#A2CBC9'],
  rubber:       ['#E39B9B', '#C06E6E'],
  metal:        ['#93A2B6', '#63718A'],
  bodyDark:     ['#6E7784', '#4B535E'],
  lamp:         ['#FFDF8A', '#E8BE55'],
  paper:        ['#FBF8EE', '#E5DFCB'],
  /*
   * 방 — 벽 · 바닥 · 선반 그늘. **기구보다 확실히 밝은 띠에 둔다.**
   * 앞서는 바닥(#A8B1A4)의 명도가 0.424 로 기구 몸통(#A8B2BE, 0.439)과 **사실상 같았다.**
   * 벽도 0.609 로 가까웠다. 그래서 화면 전체가 한 덩어리 회색으로 뭉쳤다 —
   * 사장님 말씀대로 「명도·채도가 너무 비슷해서」다 (2026-09-05).
   * 이제 방은 0.52~0.70, 기구는 0.09~0.44 — **띠가 겹치지 않는다.**
   * 채도도 함께 낮췄다. 방은 물러나 있어야 하고, 눈길은 기구가 가져가야 한다.
   */
  bench:        ['#D9D9D7', '#BEBFBC'],
  /*
   * 실험대 **작업면**. 앞서는 `metal` 을 그대로 썼는데, 그것은 현미경·개수대·폐액통의
   * 몸통 색이기도 하다 — **상판과 기구가 글자 그대로 같은 색이었다.**
   * 화면에서 재 보니 물건과 바로 뒤 바탕의 명암비가 개수대 1.00 · 폐액통 1.13 · 쓰레기통 2.23
   * 이었다 (1.00 = 완전히 같음). 선반 위 물건은 7~12 로 멀쩡했다 — 선반은 `glass` 라서다.
   * (사장님 지시, 2026-09-05: 「실험대 배경이랑 실험 기물들이랑 헷갈리네, 눈에 확 안 띄어.」)
   *
   * 그래서 **가구는 가구 색, 기구는 기구 색**으로 갈랐다. 상판은 밝고 채도가 낮은 세이지다 —
   * 기구가 그 위에서 가장 어둡고 또렷한 것이 되어야 눈이 먼저 간다.
   */
  benchTop:     ['#CBCCCA', '#ABADAA'],
  /*
   * 선반 — **가구다. 유리가 아니다.**
   * 앞서는 `glass` 로 칠했는데 그것은 **시약병·받침 유리의 색이기도 하다.** 상판이 `metal`
   * 이었던 것과 똑같은 실수가 선반에도 있었다. 재 보니 병과 바로 뒤 선반의 명도차가
   * 0.007 이었다 (0 = 완전히 같음) — 마흔여섯 물건 중 서른이 명도차 0.10 미만이었다.
   * (사장님 지시, 2026-09-05: 「배경의 채도를 전체적으로 낮춘다든지, 채도·명도 차이를 늘려봐.」)
   */
  shelfTop:     ['#C6C7C5', '#A6A8A5'],
  /*
   * 방의 **밝은 면** — 천장 · 조명갓 · 캐비닛 문.
   * 앞서는 `paper` 로 칠했는데 그것은 **거름종이·휴지 상자의 색이기도 하다.**
   * 상판이 `metal`, 선반이 `glass` 였던 것과 같은 실수가 여기에도 있었다.
   * 게다가 `paper` 는 따뜻한 크림색이라, 방을 무채색으로 낮춰 놓아도 **캐비닛만 노랗게
   * 남아 화면 아래쪽이 눈을 끌었다.** 가구는 가구 색으로 돌린다.
   */
  roomLight:    ['#E2E3E1', '#CFD0CE'],
  /** 방의 **그늘진 면** — 상판이 캐비닛에 드리우는 그늘, 선반 브래킷. 여기도 `metal` 이었다. */
  roomShade:    ['#9EA09D', '#7F817E'],

  // 시약 원액
  iodine:       ['#A8701F', '#7C4E12'],
  sudan:        ['#C94A38', '#96311F'],

  // 염색 반응색. 시야 렌더러와 슬라이드 애셋이 공유한다.
  // pale은 용액이 가장자리까지만 닿은 전이 구간에 쓴다 — 연속 보간 대신 3단계로 양자화한다.
  stainStarch:     ['#2C3A8C', '#1B2566'],
  stainStarchPale: ['#7C87C4', '#5A67AE'],
  stainLipid:      ['#D6394F', '#9C2033'],
  stainLipidPale:  ['#E68C9A', '#C96878'],
};

/** 선 두께는 셋뿐이다. 그 사이 값을 쓰면 세트가 흐트러진다. */
export const STROKE = {
  outline: 3,   // 물체의 바깥 윤곽
  detail: 2,    // 내부 구획선
  hair: 1.5,    // 눈금, 이음매 같은 잔 디테일
};

/** 접지 그림자. 애셋에서 허용되는 유일한 반투명 요소다. */
export const GROUND_SHADOW = { fill: INK, opacity: 0.12 };

/** 광원 방향. 음영 도형을 어느 쪽에 둘지 판단할 때 쓴다. */
export const LIGHT = { angleDeg: 315, from: 'upper-left' };

/** 애셋의 기준 viewBox. 모든 기구 애셋이 같은 좌표계를 쓴다. */
export const VIEWBOX = { w: 400, h: 300 };

/** 린터가 쓰는 파생 목록 — 직접 수정하지 말 것. */
export const ALLOWED_FILLS = new Set(
  Object.values(PALETTE).flat().concat(['none', 'transparent'])
);
export const ALLOWED_STROKE_WIDTHS = new Set(
  Object.values(STROKE).map(String)
);

/** 공통 패스 속성. 모든 도형에 뿌린다. */
export const PATH_ATTRS = 'stroke-linejoin="round" stroke-linecap="round"';

/**
 * 애셋에서 도형 하나를 그릴 때 쓰는 헬퍼.
 * 토큰 밖 값이 들어오면 개발 중에 바로 터지도록 막아 둔다.
 */
export function paint(tone, { shade = false, stroke = 'outline' } = {}) {
  const pair = PALETTE[tone];
  if (!pair) throw new Error(`팔레트에 없는 색: ${tone} — src/style/tokens.js에 먼저 추가하세요`);
  const w = STROKE[stroke];
  if (w === undefined) throw new Error(`허용되지 않은 선 두께: ${stroke}`);
  return `fill="${pair[shade ? 1 : 0]}" stroke="${INK}" stroke-width="${w}" ${PATH_ATTRS}`;
}
