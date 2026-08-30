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
 * ── 색소 네 가지는 **결과색**이다 ───────────────────────────────────
 * 카로틴 주황 · 잔토필 노랑 · 엽록소 a 청록 · 엽록소 b 황록.
 * 이 표기는 검증됐다(한국어 위키백과 「광합성 색소」). 「청녹」이 아니라 **「청록」**이고,
 * **나무위키 「크로마토그래피」 문서는 엽록소 a 와 b 의 색을 뒤바꿔 적어 두었다.**
 *
 * **이 네 색을 기구에 쓰지 않는다.** 학생이 결과와 헷갈린다.
 * `tests/palette.test.js` 가 `src/assets/` 를 훑어 기계로 막는다.
 *
 * ── 상층액 초록과 엽록소 b 황록 ─────────────────────────────────────
 * 둘 다 초록 계열이라 채도와 밝기를 충분히 벌려 두었다. 원심관과 띠가 같은 색으로 보이면
 * 화면이 결과를 먼저 말해 버린다.
 */
export const EXP_PALETTE = {
  // 색소 — 결과색. 기구에 쓰지 않는다
  carotene:     ['#E8913A', '#BE6C22'],   // 카로틴 — 주황
  xanthophyll:  ['#F0CF45', '#C9A527'],   // 잔토필 — 노랑
  chlorophyllA: ['#2E8E86', '#1C6660'],   // 엽록소 a — 청록
  chlorophyllB: ['#8FBE49', '#6A9330'],   // 엽록소 b — 황록
  // 볼펜 잉크가 갈라져 생기는 가짜 띠. 색소가 아니므로 색도 색소 계열에서 멀리 둔다
  inkDye:       ['#5C5FA8', '#3E4180'],

  // 액체 — 기구 안에 담겨 보인다
  // 추출액도 전개액도 실제로는 무색이다. 그런데 무색으로 두면 선반의 병이 비어 보이고,
  // 원심관에 무엇이 들었는지 알 수 없다 (바나나랩의 증류수에서 겪은 일이다).
  // **색소 네 색과 채도·밝기를 충분히 벌린** 옅은 색을 쓴다.
  extract:      ['#BFD4E0', '#95AFC0'],   // 추출액 (메탄올:아세톤 = 3:1)
  devSolvent:   ['#D8CFE4', '#B0A3C4'],   // 전개액 (석유에터:아세톤 = 9:1)
  pigmentJuice: ['#1F5F33', '#123F21'],   // 뽑아낸 상층액 — 짙은 초록

  // 시료 — 결과색이 아니라 **재료색**이다. 기구에 쓰지 않는 것은 위의 색소 네 가지뿐이다.
  // 엽록소 b(황록 #8FBE49)와 헷갈리지 않게 채도·명도를 벌려 두었다.
  leafFresh:    ['#3F8A46', '#2C6431'],   // 신선한 시금치 잎
  leafWilted:   ['#8C8A4A', '#6B6935'],   // 시든 잎 — 누렇게 바랬다
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
