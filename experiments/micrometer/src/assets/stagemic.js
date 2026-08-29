/**
 * 대물 마이크로미터 애셋 — 라인 + 플랫 구현.
 *
 * 겉모습은 받침 유리(76 × 26 mm)와 같다. 다른 것은 가운데다 —
 * 금속 테로 둘러싼 자리에 1 mm 를 100 등분한 눈금이 새겨져 있다.
 * 이 눈금의 한 칸이 0.01 mm 라는 것이 이 실험에서 유일하게 **이미 아는 길이**이고,
 * 접안 마이크로미터 한 눈금의 길이는 여기에 견주어서만 구할 수 있다.
 *
 * 그러니 받침 유리와 **한눈에 구별되어야 한다**. 그 일은 가운데 금속 테가 한다 —
 * 눈금은 실험대 크기에서 너무 작아서 혼자서는 단서가 되지 못한다.
 * 시야에서 보는 정밀한 눈금은 시야 렌더러가 따로 그린다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = ['#glass', '#glass-shade', '#ring', '#scale', '#crack', '#label'];

/**
 * 금이 갔는가.
 *
 * 불리언으로도, 0~1 연속값으로도 받는다. 연속값을 받는 이유는
 * 「살짝 간 금」과 「완전히 갈라진 유리」를 같은 노드로 말하기 위해서다 —
 * 조작을 막는 대신 결과를 바꾸는 이 저장소의 방식이다 (docs/04-interaction-rules.md).
 */
export function crackOpacity(state = {}) {
  const c = state.cracked;
  if (!c) return '0';
  if (typeof c === 'number') return clamp(0.45 + c * 0.55, 0, 1).toFixed(2);
  return '1';
}

/**
 * 대물 마이크로미터 SVG 문자열 렌더링
 *
 * @param {{cracked?: boolean|number}} state
 */
export function render(state = {}) {
  const cOpacity = crackOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="stagemic">
  <!-- 접지 그림자 -->
  <rect x="64" y="112" width="280" height="90" rx="8" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 유리 본체. 받침 유리와 같은 76 × 26 mm 이라 그림도 같은 자리에 있다 -->
  <rect id="glass" x="60" y="105" width="280" height="90" rx="6" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <path id="glass-shade" d="M 66,192 L 334,192 A 3,3 0 0 0 337,189 L 337,115 L 331,121 L 331,186 L 72,186 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 좌측 젖빛 라벨 부위 -->
  <rect x="63" y="108" width="52" height="84" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <line x1="115" y1="105" x2="115" y2="195" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <g id="label">
    <text x="89" y="142" font-size="11" font-weight="bold" text-anchor="middle" fill="${INK}">1 mm</text>
    <text x="89" y="160" font-size="9" text-anchor="middle" fill="${INK}">100 등분</text>
    <text x="89" y="175" font-size="8" text-anchor="middle" fill="${INK}">0.01 mm</text>
  </g>

  <!-- 눈금을 두른 금속 테. 받침 유리와 구별되는 지점이 여기다 -->
  <g id="ring">
    <circle cx="200" cy="150" r="40" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 230.6,124.3 A 40,40 0 0 1 174.3,180.6 L 179.4,174.5 A 32,32 0 0 0 224.5,129.4 Z" fill="${PALETTE.metal[1]}"/>
    <circle cx="200" cy="150" r="32" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 새겨진 눈금. 기준선과 눈금을 합친 덩어리의 한가운데가 테의 한가운데(y=150)에 오도록
       기준선을 y=158 에 둔다. 눈금이 위로만 자라므로 기준선을 정중앙에 두면 위로 쏠려 보인다.
       다섯 칸이면 「자가 새겨진 유리」로 읽힌다.
       100 등분을 그대로 그리면 실험대 크기에서 회색 덩어리가 된다 -->
  <g id="scale">
    <line x1="172" y1="158" x2="228" y2="158" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="172" y1="158" x2="172" y2="142" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="186" y1="158" x2="186" y2="149" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="158" x2="200" y2="142" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="214" y1="158" x2="214" y2="149" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="228" y1="158" x2="228" y2="142" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 금. 눈금 쪽을 비켜 오른쪽에서 갈라진다 — 금이 눈금을 덮으면
       무엇이 깨진 것인지가 아니라 눈금이 원래 그런 것인지가 헷갈린다 -->
  <g id="crack" opacity="${cOpacity}">
    <path d="M 320,182 L 292,158 L 266,140 L 248,122" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 292,158 L 300,126" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 292,158 L 274,180 L 262,191" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 320,182 L 335,171" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  root.querySelector('#crack').setAttribute('opacity', crackOpacity(state));
}
