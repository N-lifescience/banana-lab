/**
 * 거름종이 원반(disc) 애셋 — 라인 + 플랫.
 *
 * 실물 지름이 6 mm 라 실험대에 그대로 놓으면 화면에서 점 하나다. 이 애셋은
 * **핀셋에 물린 모습**과 **접시 위**, 그리고 결과 화면의 확대 뷰에서 쓴다.
 * 실험대에 낱개로 놓지 않는 이유가 그것이다 — 덮개 유리 22 mm 를 낱장으로 놓았다가
 * 못 잡게 됐던 바나나랩의 일과 같다.
 *
 * 상태는 둘뿐이다: **감자즙을 머금었는가**, **그 감자즙이 끓인 것인가.**
 * 끓인 감자즙은 갈변하므로 실제로 색이 다르다 — 지우면 오히려 틀린 그림이 된다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';

export const NODES = ['#disc', '#disc-shade', '#fibers'];

/** 원반의 색. 안 담근 것은 마른 거름종이, 담근 것은 감자즙을 머금은 색. */
export function discFill(state = {}) {
  if (!state.soaked) return PALETTE.paper;
  return state.boiled ? EXP_PALETTE.potatoBoiled : EXP_PALETTE.discWet;
}

/**
 * 종이 결. 원반을 **유리 조각이 아니라 종이로** 보이게 하는 유일한 단서다.
 * 원 안에 짧은 선 몇 개면 충분하다 — 촘촘하게 그리면 라인+플랫이 아니라 텍스처가 된다.
 */
function fiberLines() {
  return [
    'M 156,128 L 244,128', 'M 146,160 L 254,160', 'M 156,192 L 244,192',
  ].map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" opacity="0.35" ${PATH_ATTRS}/>`).join('');
}

/**
 * @param {{soaked?: boolean, boiled?: boolean}} state
 */
export function render(state = {}) {
  const [base, shade] = discFill(state);
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="disc">
  <ellipse cx="200" cy="228" rx="72" ry="10" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 원반. 펀치로 뚫은 것이라 완전한 원이다 -->
  <circle id="disc" cx="200" cy="160" r="82"
    fill="${base}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <path id="disc-shade" d="M 258,218 A 82,82 0 0 0 258,102 A 82,82 0 0 1 258,218 Z"
    fill="${shade}" stroke="none"/>

  <g id="fibers">${fiberLines()}</g>
</svg>`;
}

export function applyState(root, state = {}) {
  const [base, shade] = discFill(state);
  root.querySelector('#disc').setAttribute('fill', base);
  root.querySelector('#disc-shade').setAttribute('fill', shade);
}
