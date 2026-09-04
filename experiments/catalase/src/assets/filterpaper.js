/**
 * 거름종이와 펀치(filterpaper) 애셋 — 라인 + 플랫.
 *
 * 원반을 **만드는** 자리다. 지름 6 mm 원반을 펀치로 뚫는다.
 * 몇 장이든 뚫을 수 있다 — 소모품이 바닥나면 결과로 답한 것이 아니라 막다른 길이 된다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#sheet', '#sheet-shade', '#punch', '#holes'];

/**
 * 이미 뚫은 자리. 뚫을수록 늘어난다.
 *
 * 이 구멍들이 하는 일은 **한 일이 남는 것**이다. 종이가 늘 새것으로 보이면
 * 학생은 방금 누른 것이 먹혔는지 그림에서 읽을 수 없다.
 */
function holePattern(count = 0) {
  const n = Math.max(0, Math.min(count, 12));
  let out = '';
  for (let i = 0; i < n; i++) {
    const cx = 122 + (i % 6) * 22;
    const cy = 150 + Math.floor(i / 6) * 24;
    out += `<circle cx="${cx}" cy="${cy}" r="7" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`;
  }
  return out;
}

/**
 * @param {{punched?: number}} state  지금까지 뚫은 개수
 */
export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="filterpaper">
  <ellipse cx="200" cy="246" rx="112" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 거름종이 한 장. 둥근 여과지다 -->
  <circle id="sheet" cx="196" cy="164" r="94"
    fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <path id="sheet-shade" d="M 262,230 A 94,94 0 0 0 262,98 A 94,94 0 0 1 262,230 Z"
    fill="${PALETTE.paper[1]}" stroke="none"/>

  <!-- 뚫은 자리 -->
  <g id="holes">${holePattern(state.punched)}</g>

  <!-- 펀치. 종이 오른쪽에 비스듬히 놓여 있다 -->
  <g id="punch">
    <path d="M 258,60 L 300,52 L 318,96 L 282,110 Z"
      fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 300,52 L 318,96 L 300,103 L 286,58 Z"
      fill="${PALETTE.bodyDark[1]}" stroke="none"/>
    <path d="M 288,104 L 296,142"
      fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <circle cx="297" cy="148" r="9"
      fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  root.querySelector('#holes').innerHTML = holePattern(state.punched);
}
