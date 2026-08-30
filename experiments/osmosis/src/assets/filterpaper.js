/**
 * 거름종이(filterpaper) 애셋 — 라인 + 플랫 구현.
 *
 * 덮개 유리 **반대쪽**에 대어 액을 빨아들이는 물건이다. 이 조작이 없으면
 * 새 용액이 덮개 유리 아래로 들어가지 않는다 (`docs/04-interaction-rules.md` R-09).
 * 그림에서 **모서리가 뾰족하게 접혀 있어야** 「대는 것」으로 읽힌다 —
 * 둥근 원판만 그려 두면 무엇에 쓰는지 알 수 없다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#paper', '#paper-shade', '#wedge', '#wet'];

/** 빨아들인 액이 번진 정도 */
export function wetOpacity(state = {}) {
  const w = typeof state.wet === 'number' ? state.wet : (state.wet ? 1 : 0);
  return Math.max(0, Math.min(1, w)).toFixed(2);
}

/**
 * 거름종이 SVG 문자열 렌더링.
 * @param {{wet?: number|boolean}} state
 */
export function render(state = {}) {
  const wOpacity = wetOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="filterpaper">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="248" rx="104" ry="14" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 쌓아 둔 원판 두 장 -->
  <g id="paper">
    <circle cx="176" cy="146" r="94" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <circle cx="186" cy="152" r="94" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 접은 자국 -->
    <line x1="186" y1="58" x2="186" y2="246" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="152" x2="280" y2="152" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 원판 우하단 음영 (광원 좌상단 45°) -->
  <path id="paper-shade" d="M 186,246 A 94,94 0 0 0 280,152 L 262,152 A 76,76 0 0 1 186,228 Z" fill="${PALETTE.paper[1]}"/>

  <!-- 네 겹으로 접어 뾰족하게 만든 조각. 실제로 쓰는 것은 이 뾰족한 끝이다. -->
  <g id="wedge">
    <path d="M 226,124 L 336,196 L 236,222 Z" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 336,196 L 236,222 L 244,208 L 320,190 Z" fill="${PALETTE.paper[1]}"/>
    <line x1="226" y1="124" x2="286" y2="209" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 빨아들인 액이 뾰족한 끝에서 번져 올라간다 -->
  <path id="wet" d="M 336,196 L 236,222 L 258,180 L 320,190 Z" fill="${PALETTE.glass[1]}" opacity="${wOpacity}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  root.querySelector('#wet').setAttribute('opacity', wetOpacity(state));
}
