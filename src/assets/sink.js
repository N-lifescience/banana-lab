/**
 * 개수대(sink) 애셋 — 라인 + 플랫.
 *
 * ⚠ 자리표시(placeholder)다. 형태를 다시 그릴 사람에게:
 *   - 계약(`src/assets/contract.js` 의 `sink`)과 아래 `NODES` 는 **그대로 두어야** 한다.
 *     코드는 `#water` 의 `opacity` 만 건드린다 — 그 노드가 사라지면 물이 안 보인다.
 *   - `docs/01-art-direction.md` 를 지키고 `npm run check:art -- sink` 로 확인한다.
 *   - viewBox 는 400×300 고정. 다른 값을 쓰면 같은 선 두께가 다르게 렌더된다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = ['#basin', '#basin-shade', '#water', '#faucet'];

/** 물이 흐르는 중인가. 0이면 잠겨 있다. */
export function waterOpacity(state = {}) {
  return clamp(state.water ?? 0, 0, 1).toFixed(2);
}

export function render(state = {}) {
  const wOpacity = waterOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="sink">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="248" rx="150" ry="16" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 수도꼭지 -->
  <g id="faucet">
    <rect x="188" y="60" width="16" height="46" rx="4" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 196,64 L 196,44 L 252,44 L 252,86" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="244" y="84" width="16" height="12" rx="3" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="150" y="52" width="34" height="10" rx="5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 물줄기. 잠겨 있으면 보이지 않는다. -->
  <g id="water" opacity="${wOpacity}">
    <rect x="248" y="96" width="8" height="72" rx="4" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <ellipse cx="252" cy="176" rx="26" ry="7" fill="${PALETTE.glass[1]}"/>
  </g>

  <!-- 개수대 몸통 -->
  <g id="basin">
    <path d="M 62,108 L 338,108 L 322,238 L 78,238 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="54" y="96" width="292" height="18" rx="6" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 배수구 -->
    <ellipse cx="200" cy="214" rx="22" ry="8" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="184" y1="214" x2="216" y2="214" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <path id="basin-shade" d="M 338,108 L 322,238 L 78,238 L 84,224 L 310,224 L 324,114 Z" fill="${PALETTE.metal[1]}"/>
</svg>`;
}

export function applyState(root, state = {}) {
  const water = root.querySelector('#water');
  if (water) water.setAttribute('opacity', waterOpacity(state));
}
