/**
 * 페트리 접시(dish) 애셋 — 라인 + 플랫 구현.
 *
 * 이 실험에서는 **감자즙에 담근 원반을 놓아 두는 자리**다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';

export const NODES = ['#dish', '#dish-shade', '#contents'];

/**
 * 접시에 담긴 원반들.
 *
 * 감자즙에 담근 원반은 여기 놓아 둔다. **몇 장이 놓였는지가 그림에 보여야**
 * 학생이 방금 뚫어 담근 것이 먹혔는지 알 수 있다.
 *
 * 색은 원반 애셋(`disc.js`)과 같은 규칙을 따른다 — 끓인 감자즙은 갈변한다.
 */
export function contentShapes(contents = []) {
  if (!Array.isArray(contents) || contents.length === 0) return '';
  return contents.slice(0, 6).map((item, i) => {
    const kind = String(item ?? '').toUpperCase();
    const pair = kind === 'DISC_BOILED' ? EXP_PALETTE.potatoBoiled
      : kind === 'DISC' ? EXP_PALETTE.discWet
        : PALETTE.paper;
    const cx = 152 + (i % 3) * 48;
    const cy = 152 + Math.floor(i / 3) * 26;
    return `<circle cx="${cx}" cy="${cy}" r="17" fill="${pair[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`
      + `<path d="M ${cx + 12},${cy + 12} A 17,17 0 0 0 ${cx + 12},${cy - 12} A 17,17 0 0 1 ${cx + 12},${cy + 12} Z" fill="${pair[1]}" stroke="none"/>`;
  }).join('');
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
