/**
 * 모세관 통(capbox) 애셋 — 라인 + 플랫 구현.
 *
 * 칸이 둘인 통이다. **왼쪽은 헤파린이 발린 것, 오른쪽은 민무늬.**
 * 어느 칸에서 꺼내느냐가 이 실험의 변인이라 **둘이 한눈에 갈려야 한다** —
 * 그래서 헤파린 칸에만 구분 띠(`heparinBand`)를 둘렀고, 그 칸의 모세관에도
 * 같은 색 고리가 하나씩 들어가 있다. 통을 닫아 놓고 봐도, 관 하나만 집어 봐도 갈린다.
 *
 * `#pick` 은 지금 고른 칸을 짚어 준다 — 좌우 이동(transform)만 한다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, PATH_ATTRS, paint } from '../style/tokens.js';
import { EXP_PALETTE, paintExp } from '../style/palette.experiment.js';

export const NODES = [
  '#box', '#box-shade', '#slot-heparin', '#slot-plain', '#band', '#pick',
];

/** 두 칸의 중심 x. `#pick` 은 이 차이만큼 옆으로 간다. */
const SLOT_CENTER = { heparin: 122, plain: 278 };
const PICK_DX = SLOT_CENTER.plain - SLOT_CENTER.heparin;

/** 칸마다 들어 있는 모세관 다섯 개의 왼쪽 x */
const TUBE_X = [0, 26, 52, 78, 104];

/** 고른 칸을 짚어 주는 표시의 위치. 기본은 헤파린 칸(왼쪽)이다. */
export function pickTransform(state = {}) {
  return state.kind === 'plain' ? `translate(${PICK_DX},0)` : 'translate(0,0)';
}

function tubes(x0) {
  return TUBE_X.map(
    (dx) =>
      `    <rect x="${x0 + dx}" y="104" width="12" height="120" rx="6" ${paint('glass', { stroke: 'hair' })}/>`
  ).join('\n');
}

function tubeRings(x0) {
  return TUBE_X.map(
    (dx) =>
      `    <rect x="${x0 + dx}" y="150" width="12" height="13" rx="2" ${paintExp('heparinBand', { stroke: 'hair' })}/>`
  ).join('\n');
}

/**
 * 모세관 통 SVG 문자열 렌더링
 *
 * @param {{kind?: 'heparin'|'plain'}} state
 */
export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="capbox">
  <!-- 통 본체 — 위에서 내려다본 두 칸짜리 상자 -->
  <g id="box">
    <rect x="40" y="66" width="320" height="190" rx="10" ${paint('paper')}/>
    <!-- 가운데 칸막이. 두 칸이 물리적으로 갈려 있다는 것을 여기서 못 박는다. -->
    <rect x="196" y="66" width="8" height="190" ${paint('paper', { shade: true, stroke: 'detail' })}/>
    <!-- 칸 바닥 -->
    <rect x="56" y="96" width="132" height="132" rx="4" ${paint('paper', { shade: true, stroke: 'detail' })}/>
    <rect x="212" y="96" width="132" height="132" rx="4" ${paint('paper', { shade: true, stroke: 'detail' })}/>
  </g>

  <!-- 통의 우측 · 하단 음영 (광원 좌상단 45°) -->
  <path id="box-shade" d="M 40,240 L 344,240 L 344,66 L 350,66 Q 360,66 360,76 L 360,246 Q 360,256 350,256 L 50,256 Q 40,256 40,246 Z" fill="${PALETTE.paper[1]}"/>

  <!-- 헤파린이 발린 칸 (왼쪽) -->
  <g id="slot-heparin">
${tubes(62)}
  </g>

  <!-- 민무늬 칸 (오른쪽) -->
  <g id="slot-plain">
${tubes(218)}
  </g>

  <!--
    헤파린 표시. 통에 두른 띠 + 그 칸 모세관마다의 고리.
    **민무늬 칸에는 아무 표시도 없다** — 없다는 것 자체가 표시다.
  -->
  <g id="band">
    <rect x="44" y="72" width="148" height="16" rx="3" ${paintExp('heparinBand', { stroke: 'hair' })}/>
    <rect x="46" y="83" width="144" height="4" fill="${EXP_PALETTE.heparinBand[1]}"/>
    <rect x="44" y="234" width="148" height="16" rx="3" ${paintExp('heparinBand', { stroke: 'hair' })}/>
    <rect x="46" y="245" width="144" height="4" fill="${EXP_PALETTE.heparinBand[1]}"/>
${tubeRings(62)}
  </g>

  <!-- 지금 고른 칸을 짚어 주는 표시 -->
  <g id="pick" transform="${pickTransform(state)}">
    <rect x="117" y="20" width="10" height="22" rx="2" ${paint('metal', { stroke: 'detail' })}/>
    <path d="M 106,40 L 138,40 L 122,60 Z" ${paint('metal', { stroke: 'detail' })}/>
    <path d="M 122,60 L 138,40 L 130,40 Z" fill="${PALETTE.metal[1]}"/>
    <path d="M 50,104 L 50,90 L 64,90" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 180,90 L 194,90 L 194,104" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 194,220 L 194,234 L 180,234" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 64,234 L 50,234 L 50,220" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  root.querySelector('#pick').setAttribute('transform', pickTransform(state));
}
