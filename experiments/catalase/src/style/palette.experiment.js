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
 *
 * **색만 내보내는 파일이 아니다.** 아래 EXP_PALETTE 의 주석에 「왜 이 색인가」가 적혀 있다.
 * 색을 더할 때 그 이유를 같이 적는다 — 다음 사람이 지우거나 바꿔도 되는지 알 수 있어야 한다.
 */

import { INK, STROKE, PATH_ATTRS } from './tokens.js';

/**
 * 이 실험의 시약색.
 *
 * ── 색이 답을 말하지 않게 한다 ────────────────────────────────────
 * 이 실험에는 **색 변화가 없다.** 결과는 원반이 떠오르는 시간 하나뿐이다.
 * 그래서 색을 고를 때 지킨 것이 하나 있다 — **조건마다 다른 색을 주지 않는다.**
 *
 * 완충 용액 다섯 병(pH 3·5·7·9·11)은 **전부 같은 색**이고 숫자 라벨로만 갈린다.
 * pH 마다 색을 달리하면 학생이 그래프를 보기 전에 병 색으로 답을 짐작한다.
 * 수조 다섯도 마찬가지다 — 물은 온도에 따라 색이 달라지지 않고, 온도는 눈금이 말한다.
 *
 * 실제로 색이 다른 것만 다르게 뒀다: **끓인 감자즙은 갈변한다.** 그것은 학생이
 * 눈으로 볼 수 있는 진짜 차이라 지우면 오히려 틀린 그림이 된다.
 */
export const EXP_PALETTE = {
  // 과산화수소수. 실제로는 무색투명하지만, 유리와 같은 색으로 두면 **빈 비커와 구별되지 않는다.**
  // 처음에 #D9EDF2 로 두었더니 실제로 그랬다 — 결과 화면에서 아무것도 안 부은 비커와
  // 3 % 를 부은 비커가 눈으로 구별되지 않았다. 유리색(#E4EFEE)과 너무 가까웠기 때문이다.
  // 지금 값은 유리와 갈라지되 여전히 옅다 — 진하게 하면 「무슨 색이 나는 반응」으로 읽힌다.
  h2o2:         ['#C2E4EE', '#98C6D4'],

  // 감자즙 원액. 갈아서 거른 것이라 뿌옇다.
  potato:       ['#E8DEA8', '#C6BB80'],
  // 끓인 감자즙 — 갈변한다. 이 차이는 실제로 눈에 보이므로 색으로 남긴다.
  potatoBoiled: ['#C4A87C', '#9E855A'],
  // 감자즙을 머금은 거름종이 원반. 마른 종이(tokens 의 paper)보다 누렇다.
  discWet:      ['#E3D9B4', '#C3B78C'],

  // 발생한 산소 기포. 물속에서 흰빛으로 보인다.
  bubble:       ['#F4FBFC', '#D2E6EC'],

  // 완충 용액 — **pH 와 무관하게 한 색이다.** 위 주석 참조.
  buffer:       ['#DCD6EA', '#B8AFD0'],
  // 0.1 M 염산 · 0.1 M 수산화 나트륨. 완충 용액과 **다른 병이라는 것**만 보이면 된다.
  acidBase:     ['#EAE3D3', '#CAC0AA'],

  // 수조의 물 — 다섯 수조가 전부 같은 색이다. 온도는 눈금이 말한다.
  bathWater:    ['#8FC4DE', '#6BA3C0'],
  // 0 ℃ 수조의 얼음.
  ice:          ['#E9F4F8', '#C4DDE7'],
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
