/**
 * 공변세포 영구표본 애셋 — 라인 + 플랫 구현.
 *
 * 받침 유리 + 덮개 유리 + 그 사이에 봉입된 잎 뒷면 표피 조각. 라벨이 붙어 있다.
 *
 * 이 실험에서 학생이 만드는 표본이 아니라 **이미 만들어져 온 것**이다.
 * 그 사실이 그림에서 읽혀야 한다 — 그 일은 두 가지가 한다.
 *   1. 덮개 유리 둘레를 두른 굳은 봉입제 테두리 (`#seal`)
 *   2. 손으로 쓴 라벨 (`#label`)
 * 이 둘이 없으면 방금 만든 슬라이드와 그림이 똑같아지고,
 * 학생은 여기에 시약을 떨어뜨리거나 덮개 유리를 들추려 든다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE, paintExp } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = [
  '#glass', '#glass-shade', '#mount', '#mount-shade', '#coverslip', '#seal', '#crack', '#label',
];

/**
 * 금이 갔는가. `stagemic.js` 와 같은 규약이다 —
 * 불리언으로도, 0~1 연속값(살짝 간 금 ↔ 완전히 갈라진 유리)으로도 받는다.
 */
export function crackOpacity(state = {}) {
  const c = state.cracked;
  if (!c) return '0';
  if (typeof c === 'number') return clamp(0.45 + c * 0.55, 0, 1).toFixed(2);
  return '1';
}

/**
 * 공변세포 영구표본 SVG 문자열 렌더링
 *
 * @param {{cracked?: boolean|number}} state
 */
export function render(state = {}) {
  const cOpacity = crackOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="specimen">
  <!-- 접지 그림자 -->
  <rect x="64" y="112" width="280" height="90" rx="8" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 받침 유리 -->
  <rect id="glass" x="60" y="105" width="280" height="90" rx="6" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <path id="glass-shade" d="M 66,192 L 334,192 A 3,3 0 0 0 337,189 L 337,115 L 331,121 L 331,186 L 72,186 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 라벨. 손으로 쓴 이름이 붙어 있다는 것이 「만들어져 온 표본」의 표시다 -->
  <rect x="63" y="108" width="52" height="84" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <line x1="115" y1="105" x2="115" y2="195" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <g id="label">
    <text x="89" y="141" font-size="10" font-weight="bold" text-anchor="middle" fill="${INK}">공변세포</text>
    <text x="89" y="158" font-size="9" text-anchor="middle" fill="${INK}">영구표본</text>
    <text x="89" y="173" font-size="8" text-anchor="middle" fill="${INK}">잎 뒷면</text>
  </g>

  <!-- 봉입된 잎 조각. 덮개 유리 아래에 있으므로 먼저 그린다.
       잎맥은 **서로 교차하지 않게** 긋는다 — X 자로 그으면 잎이 아니라 유리에 난 흠집으로 읽힌다 -->
  <g id="mount">
    <path d="M 192,132 C 202,124 226,124 238,132 C 248,139 248,161 238,169 C 226,178 200,178 191,169 C 183,161 183,139 192,132 Z" ${paintExp('leaf', { stroke: 'detail' })}/>
    <path id="mount-shade" d="M 240,140 C 246,150 245,163 237,169 C 227,177 207,178 196,174 C 217,173 232,164 237,150 C 239,146 240,143 240,140 Z" fill="${EXP_PALETTE.leaf[1]}"/>
    <path d="M 197,168 C 208,156 218,144 233,137" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 209,158 L 203,142" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 221,146 L 228,159" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 덮개 유리. 비쳐야 아래의 표본이 보인다 -->
  <g id="coverslip">
    <rect x="176" y="114" width="72" height="72" rx="2" fill="${PALETTE.glass[0]}" fill-opacity="0.3" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 178,184 L 246,184 A 2,2 0 0 0 248,182 L 248,116 L 244,120 L 244,180 L 182,180 Z" fill="${PALETTE.glass[1]}" fill-opacity="0.55"/>
  </g>

  <!-- 굳은 봉입제 테두리. 덮개 유리 위로 덮이므로 나중에 그린다.
       테두리는 **칠한 도형**이지 굵은 선이 아니다 — 외곽선 색은 INK 하나뿐이기 때문이다 -->
  <g id="seal">
    <path d="M 172,110 H 252 V 190 H 172 Z M 176,114 H 248 V 186 H 176 Z" fill-rule="evenodd" fill="${EXP_PALETTE.balsam[0]}"/>
    <rect x="248" y="110" width="4" height="80" fill="${EXP_PALETTE.balsam[1]}"/>
    <rect x="172" y="186" width="80" height="4" fill="${EXP_PALETTE.balsam[1]}"/>
    <rect x="172" y="110" width="80" height="80" rx="1" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 금. 표본 쪽을 비켜 오른쪽 여백에서 갈라진다 -->
  <g id="crack" opacity="${cOpacity}">
    <path d="M 318,186 L 296,160 L 282,134 L 276,114" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 296,160 L 318,142" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 296,160 L 272,176 L 264,191" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 318,186 L 335,176" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  root.querySelector('#crack').setAttribute('opacity', crackOpacity(state));
}
