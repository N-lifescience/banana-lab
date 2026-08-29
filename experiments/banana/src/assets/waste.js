/**
 * 폐액통(waste) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = ['#bin', '#bin-shade', '#level'];

/**
 * 폐액 액위 및 색상 계산
 */
export function liquidGeometry(state = {}) {
  const level = clamp(state.level ?? 0, 0, 1);
  const maxHeight = 145;
  const baseY = 248;
  const height = (maxHeight * level).toFixed(1);
  const y = (baseY - maxHeight * level).toFixed(1);
  const fill = state.fill ?? PALETTE.iodine[0];
  return { y, height, fill };
}

/**
 * 폐액통 SVG 문자열 렌더링
 *
 * @param {{level?: number, fill?: string}} state
 */
export function render(state = {}) {
  const { y, height, fill } = liquidGeometry(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="waste">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="270" rx="78" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 폐액통 본체 -->
  <g id="bin">
    <!-- 몸통 외벽 -->
    <path d="M 120,80 L 135,248 C 135,258 160,266 200,266 C 240,266 265,258 265,248 L 280,80 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 윗 테두리(입구) -->
    <ellipse cx="200" cy="80" rx="80" ry="16" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 입구 안쪽 디테일 타원 -->
    <ellipse cx="200" cy="80" rx="72" ry="12" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 라벨 (폐액 표기) -->
    <rect x="160" y="148" width="80" height="28" rx="2" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <text x="200" y="166" font-size="10" font-weight="bold" text-anchor="middle" fill="${INK}">폐액 (WASTE)</text>
  </g>

  <!-- 내부 액위 -->
  <rect id="level" x="142" y="${y}" width="116" height="${height}" rx="3" fill="${fill}"/>

  <!-- 폐액통 우하단 음영 (광원 좌상단 45°) -->
  <path id="bin-shade" d="M 200,80 C 240,80 280,72 280,80 L 265,248 C 265,258 240,266 200,266 L 200,250 C 235,250 252,244 252,238 L 264,90 C 248,93 225,95 200,95 Z" fill="${PALETTE.bodyDark[1]}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const levelEl = root.querySelector('#level');
  const { y, height, fill } = liquidGeometry(state);
  levelEl.setAttribute('y', y);
  levelEl.setAttribute('height', height);
  levelEl.setAttribute('fill', fill);
}
