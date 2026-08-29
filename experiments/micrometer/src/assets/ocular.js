/**
 * 접안 마이크로미터(리클) 애셋 — 라인 + 플랫 구현.
 *
 * 접안렌즈 통 안에 끼워 넣는 지름 20 mm 짜리 둥근 유리판이다.
 * 가운데에 눈금이 새겨져 있고, 눈금 자체에는 길이 단위가 없다 —
 * 대물 마이크로미터로 한 눈금의 길이를 재어야 비로소 자가 된다.
 *
 * 여기 그린 눈금은 **실험대에서 이 물건을 알아보기 위한 것**이다.
 * 시야에서 보는 정밀한 눈금은 시야 렌더러가 따로 그린다 — 그쪽을 따라 촘촘하게 그리면
 * 실험대에서는 지름 20 mm 라 회색 덩어리가 된다. 일곱 눈금이면 「자가 새겨진 유리」로 읽힌다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#case', '#glass', '#glass-shade', '#scale', '#numbers'];

/** 원판 중심과 반지름. 케이스는 이보다 한 겹 크다. */
const CX = 200;

/**
 * 케이스에 들어 있는가.
 *
 * 리클은 맨손으로 집는 물건이 아니라 작은 통에 담겨 온다.
 * 통에 담긴 채로는 접안렌즈에 끼울 수 없다 — 그 사실이 화면에서 보여야 한다.
 */
export function caseOpacity(state = {}) {
  return state.inCase ? '1' : '0';
}

/**
 * 뒤집힌 채로 끼웠는가.
 *
 * 눈금선은 좌우 대칭이라 뒤집어도 그대로다. 달라지는 것은 **숫자**뿐이다 —
 * 0 과 100 이 자리를 바꾸고 글자가 거울에 비친 것처럼 된다.
 * 실제로도 학생이 알아채는 단서가 그것 하나다.
 *
 * 좌우 반전은 x = CX 를 축으로 한다. `translate(2·CX,0) scale(-1,1)` 이 그 뜻이다.
 */
export function numbersTransform(state = {}) {
  return state.flipped ? `translate(${CX * 2},0) scale(-1,1)` : '';
}

/**
 * 접안 마이크로미터 SVG 문자열 렌더링
 *
 * @param {{flipped?: boolean, inCase?: boolean}} state
 */
export function render(state = {}) {
  const cOpacity = caseOpacity(state);
  const nTransform = numbersTransform(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="ocular">
  <!-- 접지 그림자. 케이스를 씌우면 케이스가 그대로 덮는다 -->
  <circle cx="206" cy="157" r="92" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 보관 케이스. 유리판보다 한 겹 크게 그려서, 씌우면 테두리만 남는다 -->
  <g id="case" opacity="${cOpacity}">
    <circle cx="200" cy="150" r="120" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 291.9,72.9 A 120,120 0 0 1 122.9,241.9 L 131.9,231.2 A 106,106 0 0 0 281.2,81.9 Z" fill="${PALETTE.bodyDark[1]}"/>
    <circle cx="200" cy="150" r="104" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 유리 원판 -->
  <circle id="glass" cx="200" cy="150" r="92" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <path id="glass-shade" d="M 270.5,90.9 A 92,92 0 0 1 140.9,220.5 L 149.2,210.5 A 79,79 0 0 0 260.5,99.2 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 새겨진 눈금. 기준선 하나 + 눈금 일곱. 양 끝과 가운데가 길다 -->
  <g id="scale">
    <line x1="128" y1="150" x2="272" y2="150" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="128" y1="150" x2="128" y2="126" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="152" y1="150" x2="152" y2="136" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="176" y1="150" x2="176" y2="136" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="150" x2="200" y2="126" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="224" y1="150" x2="224" y2="136" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="248" y1="150" x2="248" y2="136" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="272" y1="150" x2="272" y2="126" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 눈금 숫자. 뒤집으면 이것만 달라진다 -->
  <g id="numbers" transform="${nTransform}">
    <text x="128" y="176" font-size="15" text-anchor="middle" fill="${INK}">0</text>
    <text x="200" y="176" font-size="15" text-anchor="middle" fill="${INK}">50</text>
    <text x="272" y="176" font-size="15" text-anchor="middle" fill="${INK}">100</text>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  root.querySelector('#case').setAttribute('opacity', caseOpacity(state));

  const numbers = root.querySelector('#numbers');
  const tf = numbersTransform(state);
  if (tf) {
    numbers.setAttribute('transform', tf);
  } else {
    numbers.removeAttribute('transform');
  }
}
