/**
 * 이 실험 고유의 시약색·반응색 — 여기 한 파일에만 둔다.
 *
 * 규칙 (NEW-EXPERIMENT.md §4 · MERGE-AND-DEPLOY.md §3.1):
 *   - 기구 색(glass, metal, paper, bodyDark, rubber, bench …)은 tokens.js 의 공용 PALETTE 를 쓴다.
 *     여기에 다시 만들지 않는다.
 *   - 이 실험에서만 쓰는 시약색·반응색만 EXP_PALETTE 에 넣는다.
 *   - src/style/tokens.js 는 수정하지 않는다. 이 실험을 합칠 때 tokens.js 의 diff 가 0 이어야 한다.
 *   - 반응색을 기구에 쓰지 않는다.
 *
 * 값은 tokens.js 의 PALETTE 와 같은 [기본색, 음영색] 쌍이다.
 * 음영은 형태의 우하단에 온다 — 광원이 좌상단 45° 이기 때문이다.
 * 애셋은 paintExp(tone, { shade, stroke }) 로 이 색을 쓴다. paint() 와 쓰는 법이 같다.
 *
 * check-art-direction.mjs 가 이 파일을 읽어 허용 색 목록에 EXP_PALETTE 값을 더한다.
 * 파일이 이대로(빈 EXP_PALETTE) 있어도 검사는 정상으로 돌고, 공용 색만 허용된다.
 *
 * 예 (양파 표피 관찰):
 *   export const EXP_PALETTE = {
 *     carmine:      ['#B3324B', '#8C2438'],   // 아세트산 카민 원액
 *     nucleusStain: ['#8C2F45', '#6B2233'],   // 붉게 물든 핵
 *   };
 */

import { INK, STROKE, PATH_ATTRS } from './tokens.js';

/**
 * 이 실험의 시약색.
 *
 * `tokens.js` 의 공용 PALETTE 에는 바나나랩의 시약색이 아직 남아 있다 — **손대지 않는다.**
 * 합칠 때 `tokens.js` 의 diff 가 0 이어야 하기 때문이다. 이 실험의 색은 전부 여기에 넣는다.
 *
 * water — 증류수. 실제 증류수는 무색이라 처음에는 유리 음영색으로 두었는데,
 * 교실에서 보니 선반의 병이 비어 보였고 스포이트에 담겼을 때 무엇이 들었는지 알 수 없었다.
 * **액포색(보라)과 헷갈리지 않는 밝은 하늘색**을 쓴다 — 채도와 밝기를 충분히 벌려 두어야
 * 현미경으로 본 결과와 섞이지 않는다.
 */
export const EXP_PALETTE = {
  water: ['#6FB3D9', '#4A8FB8'],

  /**
   * 적양파 비늘잎. 바깥쪽 면에만 색이 있고 안쪽 면은 거의 무색이다 —
   * **그림에서 그 차이가 읽혀야 한다.** 어느 면을 벗기는지가 이 실험의 변인이고,
   * 학생은 병 이름표가 아니라 이 색을 보고 고른다 (`AGENTS.md` §2.5).
   */
  onionOuter: ['#B0568F', '#8A3F6E'],
  onionInner: ['#F2E4EC', '#DCC7D5'],

  /**
   * 액포의 안토시아닌. **보라색 영역의 크기가 곧 원형질체의 크기다.**
   *
   * deep 은 원형질분리로 **수축해서 색소가 진해진** 상태다. 다른 색이 아니라
   * 같은 색이 짙어진 것이라야 한다 — 색이 바뀌면 학생은 「반응이 일어났다」로 읽는다.
   * 삼투는 반응이 아니다.
   */
  vacuole: ['#A8479B', '#82346F'],
  vacuoleDeep: ['#7E3272', '#5C2153'],

  /**
   * 설탕 용액. **농도가 달라도 다 무색이다.**
   * 농도마다 색을 달리 칠하면 "진한 용액은 진한 색" 이라는 틀린 것을 가르치게 된다.
   * 병은 전부 이 한 색이고, 구분은 **이름표**가 한다 (`tasks/T02-assets.md`).
   */
  sugar: ['#EDF1EC', '#CFD8CD'],
};

/**
 * paint() 의 실험용 짝. EXP_PALETTE 의 색을 애셋에서 쓸 때 부른다.
 * tokens.js 를 건드리지 않고 이 실험의 색만 쓰게 하는 통로다.
 */
export function paintExp(tone, { shade = false, stroke = 'outline' } = {}) {
  const pair = EXP_PALETTE[tone];
  if (!pair) throw new Error(`palette.experiment.js 에 없는 색: ${tone}`);
  const w = STROKE[stroke];
  if (w === undefined) throw new Error(`허용되지 않은 선 두께: ${stroke}`);
  return `fill="${pair[shade ? 1 : 0]}" stroke="${INK}" stroke-width="${w}" ${PATH_ATTRS}`;
}
