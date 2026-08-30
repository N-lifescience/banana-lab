/**
 * 초시계(stopwatch) 애셋 — 라인 + 플랫.
 *
 * 이 실험에서 **재는 것은 시간 하나뿐이다.** 종속변인의 기구가 화면에 없으면
 * 학생 눈에는 시간이 저절로 나오는 것처럼 보인다. 그래서 실험대에 둔다.
 *
 * 바늘은 **초를 가리킨다.** 60초에 한 바퀴다 — 눈금이 없으면 돌아가는 것이
 * 무슨 뜻인지 알 수 없으므로 12칸을 긋는다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#case', '#case-shade', '#face', '#ticks', '#hand', '#button'];

const CX = 200;
const CY = 172;
const R = 88;

/** 초바늘의 회전. 60초에 한 바퀴다. */
export function handTransform(seconds = 0) {
  return `rotate(${((seconds % 60) / 60) * 360} ${CX} ${CY})`;
}

function tickMarks() {
  let out = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const long = i % 3 === 0;
    const r0 = R - (long ? 20 : 12);
    const x0 = (CX + Math.cos(a) * r0).toFixed(1);
    const y0 = (CY + Math.sin(a) * r0).toFixed(1);
    const x1 = (CX + Math.cos(a) * (R - 5)).toFixed(1);
    const y1 = (CY + Math.sin(a) * (R - 5)).toFixed(1);
    out += `<path d="M ${x0},${y0} L ${x1},${y1}" fill="none" stroke="${INK}"`
      + ` stroke-width="${long ? STROKE.detail : STROKE.hair}" ${PATH_ATTRS}/>`;
  }
  return out;
}

/**
 * @param {{seconds?: number, running?: boolean}} state
 */
export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="stopwatch">
  <ellipse cx="${CX}" cy="268" rx="80" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 위쪽 단추. 눌러서 재기 시작한다 -->
  <g id="button">
    <rect x="186" y="40" width="28" height="24" rx="4"
      fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="204" y="40" width="10" height="24" rx="4" fill="${PALETTE.metal[1]}" stroke="none"/>
  </g>

  <circle id="case" cx="${CX}" cy="${CY}" r="${R + 10}"
    fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <path id="case-shade" d="M ${CX + 69},${CY + 69} A ${R + 10},${R + 10} 0 0 0 ${CX + 69},${CY - 69} A ${R + 10},${R + 10} 0 0 1 ${CX + 69},${CY + 69} Z"
    fill="${PALETTE.bodyDark[1]}" stroke="none"/>

  <circle id="face" cx="${CX}" cy="${CY}" r="${R}"
    fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <g id="ticks">${tickMarks()}</g>

  <g id="hand" transform="${handTransform(state.seconds)}">
    <path d="M ${CX},${CY + 14} L ${CX},${CY - R + 14}"
      fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <circle cx="${CX}" cy="${CY}" r="6" fill="${INK}" stroke="none"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  root.querySelector('#hand').setAttribute('transform', handTransform(state.seconds));
}
