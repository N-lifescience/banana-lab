/**
 * 모세관(capillary) 애셋 — 라인 + 플랫 구현.
 *
 * 상층액을 원점에 조금씩 올리는 도구다. 관 안에 무엇이 들었는지 보여야
 * "비어 있는데 찍고 있다" 를 학생이 화면에서 알 수 있다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = ['#glass', '#glass-shade', '#fill'];

/** 관 안쪽 — 왼쪽 위에서 오른쪽 아래로 눕혀 그린다 */
const BORE = { x: 74, y: 142, w: 252, h: 12 };

/** 머금은 액이 관을 채운 길이 */
export function fillGeometry(state = {}) {
  const level = clamp(state.loaded ?? state.strength ?? 0, 0, 1);
  return {
    width: (BORE.w * level).toFixed(1),
    opacity: level > 0 ? '1' : '0',
  };
}

/**
 * @param {{loaded?: number, strength?: number}} state
 */
export function render(state = {}) {
  const f = fillGeometry(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="capillary">
  <ellipse cx="200" cy="196" rx="128" ry="9" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 유리관. 오른쪽 끝이 가늘어진다 — 그쪽으로 찍는다 -->
  <path id="glass"
        d="M 72,138 L 300,138 L 344,146 L 300,154 L 72,154 C 68,154 66,151 66,146 C 66,141 68,138 72,138 Z"
        fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 머금은 상층액 -->
  <rect id="fill" x="${BORE.x}" y="${BORE.y}" width="${f.width}" height="${BORE.h}"
        fill="${EXP_PALETTE.pigmentJuice[0]}" opacity="${f.opacity}"/>

  <!-- 음영은 언제나 우하단 -->
  <path id="glass-shade" d="M 72,150 L 300,150 L 322,148 L 300,152 L 72,152 Z"
        fill="${PALETTE.glass[1]}"/>
</svg>`;
}

export function applyState(root, state = {}) {
  const f = fillGeometry(state);
  const node = root.querySelector('#fill');
  node.setAttribute('width', f.width);
  node.setAttribute('opacity', f.opacity);
}
