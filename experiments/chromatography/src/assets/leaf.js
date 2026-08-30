/**
 * 시금치 잎(leaf) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 * 신선한 잎과 시든 잎을 `fresh` 하나로 가른다 — 엽록소는 빛에 쉽게 파괴돼서,
 * 시든 잎에서는 뽑을 색소가 적다. 그것이 이 애셋이 상태를 갖는 유일한 이유다.
 */

import { INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = ['#blade', '#blade-shade', '#veins', '#stalk'];

/** 신선한가 시들었는가. 0.5 를 넘으면 신선한 것으로 본다. */
export function leafTone(state = {}) {
  const fresh = clamp(state.fresh ?? 1, 0, 1);
  return fresh > 0.5 ? EXP_PALETTE.leafFresh : EXP_PALETTE.leafWilted;
}

/**
 * @param {{fresh?: number}} state
 */
export function render(state = {}) {
  const tone = leafTone(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="leaf">
  <ellipse cx="212" cy="248" rx="126" ry="16" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 잎자루 — 왼쪽 아래에서 들어온다 -->
  <path id="stalk" d="M 48,214 C 76,208 100,196 122,180"
        fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 잎몸 — 시금치는 끝이 둥글고 밑동이 넓다 -->
  <path id="blade"
        d="M 122,180 C 128,118 186,58 258,52 C 330,46 366,92 358,140
           C 350,190 288,232 216,236 C 166,239 130,216 122,180 Z"
        fill="${tone[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 음영은 언제나 우하단 — 광원이 좌상단 45° 다 -->
  <path id="blade-shade"
        d="M 258,52 C 330,46 366,92 358,140 C 350,190 288,232 216,236
           C 196,237 178,234 163,228 C 244,222 320,178 330,124 C 336,90 306,62 258,52 Z"
        fill="${tone[1]}"/>

  <!-- 잎맥 — 가운데 굵은 맥에서 갈라져 나온다 -->
  <g id="veins" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}>
    <path d="M 122,180 C 186,168 268,142 348,128"/>
    <path d="M 168,174 C 186,146 210,116 246,94"/>
    <path d="M 212,164 C 232,138 260,112 296,96"/>
    <path d="M 258,154 C 282,136 312,120 342,114"/>
    <path d="M 176,178 C 190,198 210,214 236,224"/>
    <path d="M 232,160 C 250,182 276,198 306,204"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const tone = leafTone(state);
  root.querySelector('#blade').setAttribute('fill', tone[0]);
  root.querySelector('#blade-shade').setAttribute('fill', tone[1]);
}
