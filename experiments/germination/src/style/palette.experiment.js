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
 * 값은 [기본색, 음영색] 쌍이다. 음영은 형태의 우하단에 온다 — 광원이 좌상단 45° 이기 때문이다.
 */

import { INK, STROKE, PATH_ATTRS } from './tokens.js';

/**
 * 이 실험의 시약색·시료색.
 *
 * ── BTB (브로모티몰 블루) ──────────────────────────────────────────
 * CO₂ 가 물에 녹아 산성이 되면 **파랑 → 녹색 → 노랑** 으로 변한다 (AGENTS.md §2.5).
 * 세 단계로만 쓴다 — 연속으로 보간하면 두 챔버가 비슷해 보여 **견줄 것이 없어진다.**
 * 이 실험에서 봐야 하는 것은 「얼마나」가 아니라 「어느 쪽이 넘어갔나」다.
 *
 * 세 색은 **명도까지 벌려 두었다.** 색으로만 갈라 놓으면 색각 이상이 있는 학생에게
 * 파랑과 녹색이 같아 보인다. 흑백으로 인쇄한 보고서에서도 갈려야 한다.
 *
 * ── 콩 ────────────────────────────────────────────────────────────
 * 발아 중인 콩은 물을 머금어 부풀고 **흰 싹**이 나와 있다. 마른 콩은 갈색이고 싹이 없다.
 * 두 색을 충분히 벌려 두지 않으면 어느 챔버에 무엇을 넣었는지 그림에서 알 수 없다 —
 * 그러면 대조 실험을 눈으로 확인할 방법이 사라진다.
 *
 * **기구에는 이 색들을 쓰지 않는다.** 챔버 몸통은 `glass`, 뚜껑은 `bodyDark`,
 * 센서는 `metal` 이다 — 결과 색이 기구에 있으면 학생이 결과와 헷갈린다.
 */
export const EXP_PALETTE = {
  btbBlue:       ['#2F6FB5', '#1F4C80'],
  btbGreen:      ['#5FA05A', '#3F7440'],
  btbYellow:     ['#E6CE49', '#B9A129'],
  beanSprout:    ['#DCE4AC', '#B4BE74'],
  beanSproutTip: ['#F4F5E6', '#D9DCC2'],
  beanDry:       ['#C6A465', '#9C7D3E'],
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
