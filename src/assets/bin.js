/**
 * 쓰레기통(bin) 애셋 — 라인 + 플랫.
 *
 * 폐액통(`waste.js`)과 다른 물건이다. 이쪽은 **고형 폐기물**을 버린다 —
 * 한 번 쓴 덮개 유리처럼 액체가 아닌 것.
 *
 * ⚠ 자리표시(placeholder)다. 형태를 다시 그릴 사람에게:
 *   - 계약(`src/assets/contract.js` 의 `bin`)과 아래 `NODES` 는 **그대로 두어야** 한다.
 *     코드는 `#trash-fill` 의 `opacity` 만 건드린다.
 *   - `docs/01-art-direction.md` 를 지키고 `npm run check:art -- bin` 으로 확인한다.
 *   - viewBox 는 400×300 고정.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = ['#trash', '#trash-shade', '#trash-fill'];

/** 안에 버린 것이 있는가. */
export function fillOpacity(state = {}) {
  return clamp(state.fill ?? 0, 0, 1).toFixed(2);
}

export function render(state = {}) {
  const fOpacity = fillOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="bin">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="250" rx="86" ry="14" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 통 몸통 -->
  <g id="trash">
    <path d="M 132,96 L 268,96 L 254,242 L 146,242 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 -->
    <rect x="118" y="74" width="164" height="24" rx="8" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="186" y="60" width="28" height="16" rx="6" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 몸통 세로 홈 -->
    <line x1="172" y1="112" x2="164" y2="228" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="228" y1="112" x2="236" y2="228" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 버린 것. 비어 있으면 보이지 않는다. -->
  <g id="trash-fill" opacity="${fOpacity}">
    <rect x="160" y="176" width="34" height="34" rx="2" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="198" y="188" width="30" height="30" rx="2" fill="${PALETTE.glass[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <path id="trash-shade" d="M 268,96 L 254,242 L 146,242 L 150,228 L 242,228 L 254,102 Z" fill="${PALETTE.bodyDark[1]}"/>
</svg>`;
}

export function applyState(root, state = {}) {
  const fill = root.querySelector('#trash-fill');
  if (fill) fill.setAttribute('opacity', fillOpacity(state));
}
