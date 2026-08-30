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
 * 이 실험에는 **색 변화가 없다.** 결과는 맹관부에 모인 기체의 양 하나뿐이다.
 * 그래서 색을 고를 때 지킨 것이 하나 있다 — **조건마다 다른 색을 주지 않는다.**
 *
 * 항온기 다섯(10 · 20 · 30 · 40 · 55 ℃)은 **몸통 색이 전부 같고** 눈금으로만 갈린다.
 * 뜨거운 것을 붉게 칠하면 학생이 그래프를 보기 전에 색으로 답을 짐작한다.
 *
 * 포도당 수용액 10 % 와 5 % 도 **같은 색**이다. 실제로 둘은 눈으로 구별되지 않고,
 * 색으로 갈라 두면 학생이 병을 안 읽고 색으로 고른다 — 그러면 통제변인을 틀릴 수가 없어져
 * 이 실험이 가르치려는 것이 사라진다.
 */
export const EXP_PALETTE = {
  // 포도당 수용액. 실제로는 무색투명하지만, 유리와 같은 색으로 두면 **빈 발효관과 구별되지
  // 않는다.** 옅게 두되 유리색(#E4EFEE)과는 갈라지게 잡았다 — 진하게 하면
  // 「무슨 색이 나는 반응」으로 읽힌다. **10 % 와 5 % 가 같은 색이다** (위 주석 참조).
  glucose:  ['#D3E9F4', '#A9CCDE'],

  // 증류수. 포도당 수용액보다 한 단 옅다 — 대조군 발효관이 눈으로 갈려야 한다.
  water:    ['#EAF4F8', '#C7DEE8'],

  // 효모액. 건조 효모를 물에 푼 것이라 **뿌옇다.** 이것은 실제로 보이는 차이라 남긴다.
  yeast:    ['#E6DCBE', '#C2B693'],

  // 포도당 수용액에 효모액을 섞은 것. 팽대부에 담기는 것이 이 색이다.
  brew:     ['#DED5B8', '#B8AD8C'],

  // 40 % 수산화 칼륨 수용액. 무색이지만 **다른 병이라는 것**만 보이면 된다.
  koh:      ['#E7E0EF', '#C5BAD4'],

  // 맹관부에 모인 이산화 탄소. 물에 둘러싸인 기체는 흰빛으로 보인다.
  gas:      ['#F7FBFC', '#D9E8EE'],

  // 팽대부에서 올라오는 기포.
  bubble:   ['#FBFEFF', '#DCEAF0'],

  // 솜마개. 기구 색이 아니라 재료 색이라 여기 둔다 — 종이(paper)보다 노랗지 않다.
  cotton:   ['#F2F0E6', '#D3D0C2'],
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
