/**
 * 수조(waterbath) 애셋 — 라인 + 플랫.
 *
 * ── 색으로 온도를 말하지 않는다 ────────────────────────────────────
 * 수조 다섯(0 · 20 · 37 · 60 · 100 ℃)은 **물 색이 전부 같다.** 온도는 **눈금이** 말한다.
 * 뜨거운 것을 붉게, 찬 것을 푸르게 칠하면 학생이 그래프를 보기 전에 색으로 답을 짐작한다.
 *
 * 실제로 눈에 보이는 것만 다르게 뒀다 — **0 ℃ 수조에는 얼음이 뜨고, 100 ℃ 는 김이 난다.**
 * 이 둘은 색칠이 아니라 그 온도에서 실제로 일어나는 일이다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';

export const NODES = ['#tank', '#tank-shade', '#water', '#water-shade', '#gauge', '#gauge-text', '#surface'];

/**
 * 수면 위에 보이는 것.
 *
 * 얼음과 김은 **그 온도에서 실제로 보이는 것**이다. 색으로 온도를 흉내 내는 것과 다르다.
 */
function surfaceMarks(tempC) {
  if (tempC <= 5) {
    return [0, 1, 2].map((i) => {
      const x = 130 + i * 52;
      return `<path d="M ${x},142 l 26,0 l -5,15 l -26,0 Z"`
        + ` fill="${EXP_PALETTE.ice[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`;
    }).join('');
  }
  if (tempC >= 90) {
    // 눈금판(y 60~102)을 피해 좌우로 벌려 올린다. 가운데로 올리면 눈금 뒤에 숨어
    // **끓고 있다는 유일한 단서가 안 보인다.**
    return [116, 268].map((x) => `<path d="M ${x},138 c 12,-16 -12,-24 0,-40"`
      + ` fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" opacity="0.55" ${PATH_ATTRS}/>`).join('');
  }
  return '';
}

/**
 * @param {{tempC?: number}} state
 */
export function render(state = {}) {
  const tempC = state.tempC ?? 20;
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="waterbath">
  <ellipse cx="200" cy="252" rx="132" ry="14" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 물통 -->
  <path id="tank" d="M 86,116 L 92,246 C 92,252 308,252 308,246 L 314,116 Z"
    fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 물. 다섯 수조가 전부 같은 색이다 -->
  <rect id="water" x="94" y="142" width="212" height="102" fill="${EXP_PALETTE.bathWater[0]}" stroke="none"/>
  <rect id="water-shade" x="248" y="142" width="58" height="102" fill="${EXP_PALETTE.bathWater[1]}" stroke="none"/>
  <path d="M 94,142 L 306,142" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <!-- 수면 위 — 얼음이나 김 -->
  <g id="surface">${surfaceMarks(tempC)}</g>

  <path id="tank-shade" d="M 288,116 L 282,250 C 302,250 308,250 308,246 L 314,116 Z"
    fill="${PALETTE.metal[1]}" stroke="none"/>
  <path d="M 86,116 L 314,116" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 온도 눈금. **온도를 말하는 것은 여기 하나뿐이다** -->
  <g id="gauge">
    <rect x="150" y="60" width="100" height="42" rx="5"
      fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="228" y="60" width="22" height="42" rx="5" fill="${PALETTE.bodyDark[1]}" stroke="none"/>
  </g>
  <text id="gauge-text" x="200" y="90" font-size="26" font-weight="bold" text-anchor="middle"
    fill="${PALETTE.lamp[0]}">${tempC} ℃</text>
</svg>`;
}

export function applyState(root, state = {}) {
  const tempC = state.tempC ?? 20;
  root.querySelector('#gauge-text').textContent = `${tempC} ℃`;
  root.querySelector('#surface').innerHTML = surfaceMarks(tempC);
}
