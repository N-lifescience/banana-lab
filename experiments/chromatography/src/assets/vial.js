/**
 * 바이알(vial) 애셋 — 라인 + 플랫 구현.
 *
 * 전개조다. 이 그림이 답해야 하는 것은 셋이다 —
 * **전개액이 얼마나 깊은가 · 뚜껑이 덮여 있는가 · 종이가 서 있는가.**
 * 뚜껑은 용매가 날아가는 것도 빛이 드는 것도 막는다. 엽록소는 빛에 쉽게 파괴된다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = ['#body', '#body-shade', '#solvent', '#paper', '#cap'];

/** 병 안쪽 세로 범위. 30 mm 를 이 높이에 대응시킨다. */
const INSIDE = { top: 74, bottom: 280, x: 122, w: 156 };
const MAX_DEPTH_MM = 30;

export function solventGeometry(state = {}) {
  const mm = clamp(state.depth ?? 0, 0, MAX_DEPTH_MM);
  const h = ((INSIDE.bottom - INSIDE.top) * (mm / MAX_DEPTH_MM) * 0.5);
  return { y: (INSIDE.bottom - h).toFixed(1), height: h.toFixed(1) };
}

export function capTransform(state = {}) {
  // 뚜껑을 **떼어 멀리 던지지 않는다.** 프레임 밖으로 나가면 CONTENT_BOX(잡는 영역)와
  // 어긋나 실험대에서 옆 물건의 클릭을 가로챈다 — 화면에서는 그것이 안 보인다.
  // 경첩처럼 한쪽을 축으로 들어 올린다.
  return state.capped ? '' : 'translate(0,-10) rotate(-20 138 26)';
}

/**
 * @param {{depth?: number, capped?: boolean, hasPaper?: boolean}} state
 */
export function render(state = {}) {
  const s = solventGeometry(state);
  const paperOpacity = state.hasPaper ? '1' : '0';

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="vial">
  <ellipse cx="200" cy="290" rx="86" ry="9" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 병 몸통. **프레임 높이를 채운다** — 가운데에만 그리면 실험대에서 실물보다 작게 나온다 -->
  <path id="body" d="M 118,66 L 282,66 L 282,272 C 282,280 275,286 267,286 L 133,286 C 125,286 118,280 118,272 Z"
        fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <clipPath id="vial-inside">
    <path d="M 121,69 L 279,69 L 279,272 C 279,278 274,283 267,283 L 133,283 C 126,283 121,278 121,272 Z"/>
  </clipPath>
  <g clip-path="url(#vial-inside)">
    <!-- 전개액 -->
    <rect id="solvent" x="${INSIDE.x}" y="${s.y}" width="${INSIDE.w}" height="${s.height}"
          fill="${EXP_PALETTE.devSolvent[0]}"/>
    <!-- 세워 둔 거름종이 -->
    <g id="paper" opacity="${paperOpacity}">
      <rect x="185" y="52" width="30" height="230" rx="2"
            fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
      <path d="M 189,232 L 211,232" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}"
            stroke-dasharray="5 3" ${PATH_ATTRS}/>
    </g>
  </g>

  <!-- 목 -->
  <rect x="146" y="42" width="108" height="26" rx="3"
        fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 음영은 언제나 우하단 -->
  <path id="body-shade" d="M 268,69 L 279,69 L 279,272 C 279,278 274,283 267,283 L 150,283 L 160,274 L 264,274 C 266,274 268,272 268,270 Z"
        fill="${PALETTE.glass[1]}"/>

  <!-- 뚜껑 -->
  <g id="cap" transform="${capTransform(state)}">
    <rect x="136" y="12" width="128" height="32" rx="4"
          fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 250,16 L 260,16 L 260,40 L 250,40 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const s = solventGeometry(state);
  const solvent = root.querySelector('#solvent');
  solvent.setAttribute('y', s.y);
  solvent.setAttribute('height', s.height);
  root.querySelector('#paper').setAttribute('opacity', state.hasPaper ? '1' : '0');
  root.querySelector('#cap').setAttribute('transform', capTransform(state));
}
