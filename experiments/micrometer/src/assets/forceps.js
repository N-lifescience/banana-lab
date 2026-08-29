/**
 * 핀셋(forceps) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#arm-left', '#arm-right', '#joint', '#held'];

/**
 * 좌측 날 변형
 */
export function leftTransform(state = {}) {
  if (state.closed || state.holding) {
    return 'rotate(2.6 192 60)';
  }
  return '';
}

/**
 * 우측 날 변형
 */
export function rightTransform(state = {}) {
  if (state.closed || state.holding) {
    return 'rotate(-2.6 208 60)';
  }
  return '';
}

/**
 * 집은 물체의 불투명도
 */
export function heldOpacity(state = {}) {
  return state.holding ? '1' : '0';
}

/**
 * 집은 물체(커버글라스 등) 내부 도형
 */
export function heldShapes(holding) {
  if (!holding) return '';
  if (holding === 'coverslip') {
    return `<polygon points="180,240 200,225 220,240 200,255" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>` +
      `<polygon points="190,248 200,240 220,240 200,255" fill="${PALETTE.glass[1]}"/>`;
  }
  if (holding === 'sample' || holding === 'banana') {
    return `<ellipse cx="200" cy="242" rx="9" ry="6" fill="${PALETTE.flesh[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`;
  }
  return `<circle cx="200" cy="242" r="7" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`;
}

/**
 * 핀셋 SVG 문자열 렌더링
 *
 * @param {{closed?: boolean, holding?: string|null}} state
 */
export function render(state = {}) {
  const lTransform = leftTransform(state);
  const rTransform = rightTransform(state);
  const hOpacity = heldOpacity(state);
  const hContent = heldShapes(state.holding);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="forceps">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="265" rx="30" ry="6" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 집은 물체 (날 사이) -->
  <g id="held" opacity="${hOpacity}">${hContent}</g>

  <!-- 좌측 날 (회전 가능 그룹) -->
  <g id="arm-left"${lTransform ? ` transform="${lTransform}"` : ''}>
    <path d="M 189,60 L 195,60 L 180,145 L 189,240 L 184,240 L 172,145 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 미끄럼 방지 홈 디테일 -->
    <line x1="174" y1="125" x2="178" y2="125" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="173" y1="135" x2="177" y2="135" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="174" y1="145" x2="178" y2="145" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우측 날 (회전 가능 그룹) -->
  <g id="arm-right"${rTransform ? ` transform="${rTransform}"` : ''}>
    <path d="M 205,60 L 211,60 L 228,145 L 216,240 L 211,240 L 220,145 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 우하단 음영 (광원 좌상단 45°) -->
    <path d="M 208,60 L 211,60 L 228,145 L 216,240 L 213,240 L 224,145 Z" fill="${PALETTE.metal[1]}"/>
    <!-- 미끄럼 방지 홈 디테일 -->
    <line x1="222" y1="125" x2="226" y2="125" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="223" y1="135" x2="227" y2="135" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="222" y1="145" x2="226" y2="145" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 상단 연결부(joint) -->
  <g id="joint">
    <path d="M 188,52 C 188,38 212,38 212,52 L 212,62 L 188,62 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 205,40 C 209,43 212,47 212,52 L 212,62 L 205,62 Z" fill="${PALETTE.metal[1]}"/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const armL = root.querySelector('#arm-left');
  const lTransform = leftTransform(state);
  if (lTransform) {
    armL.setAttribute('transform', lTransform);
  } else {
    armL.removeAttribute('transform');
  }

  const armR = root.querySelector('#arm-right');
  const rTransform = rightTransform(state);
  if (rTransform) {
    armR.setAttribute('transform', rTransform);
  } else {
    armR.removeAttribute('transform');
  }

  const held = root.querySelector('#held');
  held.setAttribute('opacity', heldOpacity(state));
  held.innerHTML = heldShapes(state.holding);
}
