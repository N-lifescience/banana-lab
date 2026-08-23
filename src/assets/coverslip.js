/**
 * 덮개유리(커버글라스) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#glass', '#glass-shade'];

/**
 * 덮개유리의 각도(angle) 또는 명시적 transform에 따른 변형 속성값
 */
export function glassTransform(state = {}) {
  if (state.transform) return state.transform;
  const angle = typeof state.angle === 'number' ? state.angle : 0;
  if (angle === 0) return '';
  return `rotate(${-angle} 140 210)`;
}

/**
 * 덮개유리 SVG 문자열 렌더링
 *
 * @param {{angle?: number, held?: boolean, transform?: string}} state
 */
export function render(state = {}) {
  const transform = glassTransform(state);
  const tfAttr = transform ? ` transform="${transform}"` : '';

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="coverslip">
  <!-- 접지 그림자 -->
  <rect x="144" y="96" width="120" height="120" rx="6" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 덮개유리 본체 (회전 가능 그룹) -->
  <g id="glass"${tfAttr}>
    <rect width="120" height="120" x="140" y="90" rx="3" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path id="glass-shade" d="M 146,206 L 254,206 A 3,3 0 0 0 257,203 L 257,96 L 251,102 L 251,200 L 152,200 Z" fill="${PALETTE.glass[1]}"/>
    <line x1="152" y1="102" x2="248" y2="198" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const glass = root.querySelector('#glass');
  const tf = glassTransform(state);
  if (tf) {
    glass.setAttribute('transform', tf);
  } else {
    glass.removeAttribute('transform');
  }
}
