/**
 * 계량 숟가락(scoop) 애셋 — 라인 + 플랫 구현.
 *
 * 옆에서 본 숟가락이다. 손잡이가 오른쪽 위로, 오목한 부분이 왼쪽 아래.
 * **이 실험에서 양을 정하는 유일한 손**이라, 담겼는지 비었는지가 멀리서도 보여야 한다.
 *
 * 콩 알갱이는 beanjar.js 의 도형을 그대로 쓴다 — 통에서 퍼낸 것이 숟가락에서 다른 크기로
 * 그려지면 「같은 콩을 옮겼다」로 읽히지 않는다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { rng } from './geometry.js';
import { beanMarkup } from './beanjar.js';

export const NODES = ['#handle', '#bowl', '#bowl-shade', '#load'];

/** 비었으면 0. 「투명한 콩」이 아니라 **없는 것**이다. */
export function loadOpacity(state = {}) {
  return state.holds ? '1' : '0';
}

/**
 * 숟가락에 담긴 콩.
 *
 * 오목한 부분 위로 **봉긋하게 쌓아** 그린다 — 테두리 안에 얌전히 들어가 있으면
 * 축소했을 때 빈 숟가락과 구별되지 않는다.
 */
export function loadMarkup(state = {}) {
  if (!state.holds) return '';
  const kind = state.holds === 'dry' ? 'dry' : 'sprout';
  const r = rng(state.seed ?? 5);
  const spots = [
    [106, 150], [132, 152], [158, 150],   // 오목한 부분에 앉은 줄
    [119, 134], [145, 134],               // 그 위로 봉긋한 줄
  ];
  return spots
    .map(([cx, cy]) => beanMarkup(cx + (r() * 2 - 1) * 2, cy + (r() * 2 - 1) * 1.5, kind, 10.4 + r() * 1.4))
    .join('');
}

/**
 * 숟가락 SVG 문자열 렌더링
 *
 * @param {{holds?: null|'sprout'|'dry', seed?: number}} state
 */
export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="scoop">
  <!-- 접지 그림자 -->
  <ellipse cx="190" cy="206" rx="106" ry="6" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 손잡이 — 오른쪽 위로 -->
  <path id="handle" d="M 170,150 L 314,96 L 320,110 L 175,165 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <!-- 손잡이 아래쪽 음영 (광원 좌상단 45°) -->
  <path d="M 175,165 L 320,110 L 317,102 L 172,157 Z" fill="${PALETTE.metal[1]}"/>
  <line x1="188" y1="152" x2="306" y2="108" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 오목한 부분 — 왼쪽 아래 -->
  <path id="bowl" d="M 90,146 L 178,146 C 178,182 160,204 134,204 C 108,204 90,182 90,146 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <path id="bowl-shade" d="M 178,146 C 178,182 160,204 134,204 C 152,196 164,178 164,146 Z" fill="${PALETTE.metal[1]}"/>

  <!-- 담긴 콩. 비었으면 opacity 0 -->
  <g id="load" opacity="${loadOpacity(state)}">${loadMarkup(state)}</g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 * 계약(contract.js)이 허용한 것만 건드린다 — #load 의 children 과 opacity.
 */
export function applyState(root, state = {}) {
  const load = root.querySelector('#load');
  load.innerHTML = loadMarkup(state);
  load.setAttribute('opacity', loadOpacity(state));
}
