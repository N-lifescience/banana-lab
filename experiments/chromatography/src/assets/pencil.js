/**
 * 연필(pencil) 애셋 — 라인 + 플랫 구현.
 *
 * 원점 선과 용매 전선을 표시하는 도구다. **볼펜이 아니라 연필**이라는 것이
 * 이 실험에서 뜻을 갖는다 — 볼펜 잉크는 전개액에 녹아 함께 올라간다.
 * 그래서 그림도 한눈에 연필이어야 한다: 깎인 나무와 흑연 심.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#barrel', '#barrel-shade', '#wood', '#lead', '#ferrule', '#eraser'];

export function render() {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="pencil">
  <!-- 물건은 프레임 **바닥에 발을 붙여야** 한다. 실험대는 프레임 아래를 선반·작업면에
       맞추므로, 그림이 프레임 가운데에 있으면 물건이 허공에 뜬 채로 놓인다.
       그러고도 그림만 보면 멀쩡해 보인다 — 그래서 여기서 한 번에 내려 둔다. -->
  <g transform="translate(0,85)">
  <ellipse cx="200" cy="196" rx="150" ry="10" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 몸통 -->
  <rect id="barrel" x="112" y="130" width="200" height="34" rx="2"
        fill="${PALETTE.lamp[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <!-- 육각 몸통의 모서리 선 -->
  <path d="M 114,142 L 310,142" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <path d="M 114,154 L 310,154" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 깎인 나무 -->
  <path id="wood" d="M 112,130 L 112,164 L 62,152 L 62,142 Z"
        fill="${PALETTE.flesh[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <!-- 흑연 심 -->
  <path id="lead" d="M 62,142 L 62,152 L 42,147 Z"
        fill="${PALETTE.ink[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <!-- 금속 테 -->
  <rect id="ferrule" x="312" y="128" width="30" height="38" rx="2"
        fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <!-- 지우개 -->
  <rect id="eraser" x="342" y="130" width="26" height="34" rx="6"
        fill="${PALETTE.rubber[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 음영은 언제나 우하단 -->
  <path id="barrel-shade" d="M 112,158 L 312,158 L 312,164 L 112,164 Z" fill="${PALETTE.lamp[1]}"/>
  </g>
</svg>`;
}

export function applyState() {
  // 상태가 없다.
}
