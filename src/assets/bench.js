/**
 * 실험대(bench) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#surface', '#surface-shade', '#shelf'];

/**
 * 실험대 SVG 문자열 렌더링
 *
 * @param {object} _state
 */
export function render(_state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="bench">
  <!-- 배경 실험대 벽면 선반 (shelf) -->
  <g id="shelf">
    <!-- 선반 상판 -->
    <polygon points="30,65 370,65 370,78 30,78" fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 선반 하단 음영 -->
    <rect x="32" y="72" width="336" height="5" fill="${PALETTE.bench[1]}"/>
    <!-- 선반 좌/우 지지대 브래킷 -->
    <polygon points="65,78 85,78 65,108" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="315,78 335,78 335,108" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 선반 위 타일/눈금 디테일 -->
    <line x1="30" y1="65" x2="370" y2="65" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 실험대 상판 (surface) 본체 -->
  <g id="surface">
    <!-- 상판 윗면 -->
    <polygon points="0,155 400,155 400,265 0,265" fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 상판 타일/이음매 디테일 격자선 -->
    <line x1="0" y1="195" x2="400" y2="195" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="0" y1="230" x2="400" y2="230" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="130" y1="155" x2="130" y2="265" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="270" y1="155" x2="270" y2="265" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 상판 전면 모서리 테두리 -->
    <rect x="0" y="265" width="400" height="35" fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  </g>

  <!-- 실험대 전면 하단 음영 (surface-shade) (광원 좌상단 45°) -->
  <rect id="surface-shade" x="0" y="275" width="400" height="25" fill="${PALETTE.bench[1]}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(_root, _state = {}) {
  // bench 애셋은 가변 상태가 없습니다.
}
