/**
 * 휴지/렌즈페이퍼(tissue) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#box', '#box-shade', '#sheet'];

/**
 * 뽑힌 휴지 장(sheet)의 불투명도 계산
 */
export function sheetOpacity(state = {}) {
  if (typeof state.used === 'number') {
    return state.used >= 1 ? '0' : '1';
  }
  return state.used ? '0' : '1';
}

/**
 * 휴지 상자 SVG 문자열 렌더링
 *
 * @param {{used?: number|boolean}} state
 */
export function render(state = {}) {
  const sOpacity = sheetOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="tissue">
  <!-- 접지 그림자 -->
  <polygon points="110,232 274,232 318,198 154,198" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 뽑힌 휴지(sheet) — 상자 뒤/슬롯 위 -->
  <g id="sheet" opacity="${sOpacity}">
    <path d="M 205,126 C 188,95 204,65 228,58 C 248,68 252,94 246,126 Z" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 226,62 C 238,75 244,98 244,126 L 246,126 C 252,94 248,68 228,58 Z" fill="${PALETTE.paper[1]}"/>
    <!-- 휴지 주름 디테일 선 -->
    <path d="M 216,92 C 224,85 234,95 240,88" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 휴지 상자(box) 본체 -->
  <g id="box">
    <!-- 상자 윗면 -->
    <polygon points="120,140 270,140 310,105 160,105" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 상자 전면 -->
    <polygon points="120,140 270,140 270,225 120,225" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 상자 우측면 -->
    <polygon points="270,140 310,105 310,190 270,225" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 윗면 인출구(슬롯) 타원 -->
    <ellipse cx="230" cy="124" rx="36" ry="9" fill="${PALETTE.paper[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 상자 전면 브랜드/줄무늬 디테일 -->
    <rect x="135" y="160" width="120" height="12" fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="135" y="178" width="120" height="24" fill="${PALETTE.paper[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <text x="195" y="194" font-size="9" font-weight="bold" text-anchor="middle" fill="${INK}">KIMWIPES</text>
  </g>

  <!-- 상자 우하단 음영 (우측면 + 전면 하단부) -->
  <path id="box-shade" d="M 270,140 L 310,105 L 310,190 L 270,225 Z" fill="${PALETTE.paper[1]}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const sheet = root.querySelector('#sheet');
  sheet.setAttribute('opacity', sheetOpacity(state));
}
