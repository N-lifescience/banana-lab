/**
 * 자(ruler) 애셋 — 라인 + 플랫 구현.
 *
 * 이 실험이 구하려는 값(전개율)은 **재야만** 나온다. 자는 그래서 장식이 아니다.
 * 눈금은 그리되 **숫자는 적지 않는다** — 읽는 것이 학생이 할 일이다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#body', '#body-shade', '#ticks'];

const BODY = { x: 40, y: 122, w: 320, h: 54 };

/** 눈금. 5 칸마다 길게 — cm 자의 생김새다. */
function ticks() {
  const out = [];
  for (let i = 0; i <= 32; i++) {
    const x = BODY.x + 6 + i * 9.6;
    const long = i % 5 === 0;
    out.push(`<path d="M ${x.toFixed(1)},${BODY.y + 2} L ${x.toFixed(1)},${BODY.y + (long ? 24 : 14)}"/>`);
  }
  return out.join('');
}

export function render() {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="ruler">
  <!-- 물건은 프레임 **바닥에 발을 붙여야** 한다. 실험대는 프레임 아래를 선반·작업면에
       맞추므로, 그림이 프레임 가운데에 있으면 물건이 허공에 뜬 채로 놓인다.
       그러고도 그림만 보면 멀쩡해 보인다 — 그래서 여기서 한 번에 내려 둔다. -->
  <g transform="translate(0,100)">
  <rect x="46" y="182" width="320" height="10" rx="5" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <rect id="body" x="${BODY.x}" y="${BODY.y}" width="${BODY.w}" height="${BODY.h}" rx="3"
        fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <g id="ticks" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}>${ticks()}</g>

  <!-- 음영은 언제나 우하단 -->
  <path id="body-shade" d="M ${BODY.x + 2},${BODY.y + BODY.h - 8} L ${BODY.x + BODY.w - 2},${BODY.y + BODY.h - 8}
        L ${BODY.x + BODY.w - 2},${BODY.y + BODY.h - 2} L ${BODY.x + 2},${BODY.y + BODY.h - 2} Z"
        fill="${PALETTE.glass[1]}"/>
  </g>
</svg>`;
}

export function applyState() {
  // 상태가 없다.
}
