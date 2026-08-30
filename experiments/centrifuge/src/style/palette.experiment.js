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
 * 이 실험의 색.
 *
 * ── 결과색 넷 ───────────────────────────────────────────────────────
 * **압축된 적혈구층은 암적색이다.** 선홍은 채혈 순간 손끝에 맺힌 핏방울뿐이고,
 * 두 색을 한 색으로 칠하면 "다져졌다" 는 것이 화면에서 안 보인다.
 *
 * **연층은 회백색이다.** 한국어 위키백과는 버피코트를 「담황색」이라고 적는데,
 * 그 색으로 칠하면 **혈장과 구분이 안 된다.** 그림에서는 그것이 치명적이다 —
 * 학생이 봐야 하는 것이 바로 그 얇은 띠이기 때문이다.
 *
 * 혈청은 혈장과 실제로도 비슷한 담황색이다. 그래서 **색으로 가르지 않는다** —
 * 갈라 주는 것은 옆에 붙는 이름표와 혈병이다 (`src/render/tube.js`).
 * 다만 눈으로 한 벌인지 두 벌인지는 알아볼 수 있게 아주 조금 더 맑게 둔다.
 *
 * **이 색들을 기구에 쓰지 않는다.** 실험대에 암적색 통이 있으면 학생이 결과와 헷갈린다.
 * `tests/palette.test.js` 가 `src/assets/` 가 실제로 그린 SVG 를 훑어 기계로 막는다.
 */
export const EXP_PALETTE = {
  // ── 결과색. 기구에 쓰지 않는다 ────────────────────────────────────
  packedCells:  ['#7E1420', '#5A0D16'],   // 적혈구층 — **암적색**
  buffyCoat:    ['#DCDCD2', '#B4B4A8'],   // 연층(백혈구·혈소판) — **회백색**
  plasma:       ['#EFDC9A', '#CDB86E'],   // 혈장 — 담황색
  serum:        ['#F2E6B4', '#D2C287'],   // 혈청 — 응고했을 때. 혈장보다 아주 조금 맑다
  clot:         ['#5C1018', '#3E0A10'],   // 혈병 — 응고해 뭉친 덩이

  // ── 시료색. 결과색이 아니라 **재료색**이다 ─────────────────────────
  // 채혈 순간의 핏방울은 **선홍**이다. 암적색과 충분히 벌려 둔다 —
  // 두 색이 가까우면 "다져져서 어두워졌다" 는 변화가 화면에서 사라진다.
  bloodFresh:   ['#D6303A', '#A81E28'],

  // ── 기구에 써도 되는 이 실험의 색 ─────────────────────────────────
  // 고무찰흙. tokens.js 의 rubber(연분홍)는 살구빛이라 핏방울과 헷갈린다.
  clay:         ['#8FA36B', '#6B7C4C'],
  // 헤파린이 발린 모세관의 띠. 민무늬와 **한눈에 갈려야** 변인 노릇을 한다.
  heparinBand:  ['#3C7FB1', '#2A5C82'],
  // 소독솜에 밴 알코올
  alcohol:      ['#BFD8DE', '#96B4BC'],
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
