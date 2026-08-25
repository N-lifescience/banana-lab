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
 * 아이오딘·수단 Ⅲ 원액과 반응색은 참조 구현이라 `tokens.js` 의 공용 PALETTE 에 있다.
 * 뒤에 만드는 실험은 그렇게 하지 않는다 — 자기 색은 전부 여기에 넣는다.
 *
 * water — 증류수. 실제 증류수는 무색이라 처음에는 유리 음영색으로 두었는데,
 * 교실에서 보니 선반의 병이 비어 보였고 스포이트에 담겼을 때 무엇이 들었는지 알 수 없었다.
 * **녹말 반응색(청람색, stainStarch)과 헷갈리지 않는 밝은 하늘색**을 쓴다 —
 * 채도와 밝기를 충분히 벌려 두어야 현미경으로 본 결과와 섞이지 않는다.
 */
export const EXP_PALETTE = {
  water: ['#6FB3D9', '#4A8FB8'],
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
