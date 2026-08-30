/**
 * 페트리 접시(dish) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#dish', '#dish-shade', '#contents'];

/**
 * 접시 내부 내용물(비늘잎 조각, 벗긴 표피 등) SVG 도형 생성
 */
export function contentShapes(contents = []) {
  if (!contents || !Array.isArray(contents) || contents.length === 0) return '';
  let out = '';
  contents.forEach((item, i) => {
    if (typeof item === 'string' && (item.includes('banana') || item.includes('slice') || item.includes('flesh'))) {
      const cx = 190 + (i % 3) * 12;
      const cy = 152 + (i % 2) * 6;
      out += `<ellipse cx="${cx}" cy="${cy}" rx="26" ry="13" fill="${PALETTE.flesh[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>` +
        `<ellipse cx="${cx + 4}" cy="${cy + 2}" rx="22" ry="10" fill="${PALETTE.flesh[1]}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="3" fill="${PALETTE.peelSpot[0]}"/>`;
    } else if (typeof item === 'string' && item.includes('peel')) {
      out += `<path d="M 160,150 C 180,140 210,142 230,154 C 215,160 185,158 160,150 Z" fill="${PALETTE.peelRipe[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`;
    } else {
      out += `<circle cx="${180 + i * 15}" cy="155" r="8" fill="${PALETTE.flesh[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`;
    }
  });
  return out;
}

/**
 * 페트리 접시 SVG 문자열 렌더링
 *
 * @param {{contents?: string[]|object[]}} state
 */
export function render(state = {}) {
  const cHtml = contentShapes(state.contents);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="dish">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="195" rx="108" ry="18" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 접시 외벽 및 바닥 본체 -->
  <g id="dish">
    <!-- 접시 옆면/바닥 -->
    <path d="M 90,140 C 90,155 139,168 200,168 C 261,168 310,155 310,140 L 300,180 C 300,195 255,205 200,205 C 145,205 100,195 100,180 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 접시 윗 테두리(개구부) -->
    <ellipse cx="200" cy="140" rx="110" ry="28" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 내부 바닥 타원 디테일 선 -->
    <ellipse cx="200" cy="175" rx="96" ry="22" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 접시 내용물 그룹 -->
  <g id="contents">${cHtml}</g>

  <!-- 접시 우하단 음영 (광원 좌상단 45°) -->
  <path id="dish-shade" d="M 200,168 C 261,168 310,155 310,140 L 300,180 C 300,195 255,205 200,205 L 200,180 C 240,180 280,172 290,160 L 295,145 C 275,155 240,165 200,168 Z" fill="${PALETTE.glass[1]}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const contents = root.querySelector('#contents');
  contents.innerHTML = contentShapes(state.contents);
}
