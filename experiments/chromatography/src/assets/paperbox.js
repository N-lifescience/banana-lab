/**
 * 거름종이 통(paperbox) 애셋 — 라인 + 플랫 구현.
 *
 * 낱장 한 장을 실험대에 그리면 4 cm 폭이 화면에서 너무 작아 알아볼 수가 없다.
 * 실제 실험실처럼 통에서 꺼내 쓴다. 상태가 없다 — 몇 장이든 꺼내 쓸 수 있고,
 * **소모품이 바닥나면 그건 결과가 아니라 막다른 길이다.**
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#box', '#box-shade', '#sheets'];

export function render() {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="paperbox">
  <polygon points="86,246 300,246 344,208 130,208" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 통에서 삐져나온 거름종이들 — 통보다 먼저 그려 뒤에 놓는다 -->
  <g id="sheets">
    <rect x="150" y="72" width="102" height="86" rx="2"
          fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="162" y="60" width="102" height="98" rx="2"
          fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="174" y="50" width="102" height="108" rx="2"
          fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 268,54 L 274,54 L 274,156 L 180,156 L 180,150 L 268,150 Z" fill="${PALETTE.paper[1]}"/>
  </g>

  <!-- 통 -->
  <g id="box">
    <polygon points="112,152 288,152 328,118 152,118"
             fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <polygon points="112,152 288,152 288,238 112,238"
             fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <polygon points="288,152 328,118 328,204 288,238"
             fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 앞면 라벨 -->
    <rect x="130" y="176" width="140" height="34" rx="2"
          fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <text x="200" y="199" font-size="13" font-weight="bold" text-anchor="middle" fill="${INK}">거름종이</text>
  </g>

  <!-- 음영은 언제나 우하단 -->
  <polygon id="box-shade" points="288,152 328,118 328,204 288,238" fill="${PALETTE.bench[1]}"/>
</svg>`;
}

export function applyState() {
  // 상태가 없다. 계약(contract.js)에서도 states 가 비어 있다.
}
