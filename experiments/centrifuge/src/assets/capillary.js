/**
 * 모세관(capillary) 애셋 — 라인 + 플랫 구현.
 *
 * **가로로 눕혀 그린다.** 회전판이 모세관을 수평으로 물기 때문이다.
 * **왼쪽이 회전 바깥쪽 끝, 오른쪽이 축 쪽**이다. 그림에서 그것을 읽게 하는 장치는 셋이다.
 *
 *   1. 혈액 기둥이 **왼쪽 끝에 붙어** 오른쪽으로 자란다. 남는 빈 관은 늘 오른쪽이고,
 *      기둥의 자유면(메니스커스)이 오른쪽을 향해 오목하다 — 비어 있는 쪽이 축 쪽이다.
 *   2. **바깥쪽 마개가 더 두껍고 뭉툭하다.** 바깥쪽 끝을 먼저 고무찰흙에 눌러 막기 때문이다.
 *   3. **헤파린 구분 띠는 축 쪽(오른쪽) 끝**에 있다. 혈액이 닿는 바깥쪽 끝은 표시가 없다.
 *
 * **이 애셋은 갈린 층을 그리지 않는다.** 층은 결과 렌더러의 몫이고, 결과색(암적색·회백색·
 * 담황색)은 기구에 쓰지 않는다. 여기서 보이는 것은 **선홍색 생혈**뿐이다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS, paint } from '../style/tokens.js';
import { EXP_PALETTE, paintExp } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = [
  '#glass', '#glass-shade', '#column', '#plug-outer', '#plug-inner', '#band', '#crack',
];

/** 혈액 기둥이 자라기 시작하는 x — **바깥쪽(왼쪽) 끝**이다. */
const COLUMN_X0 = 34;

/** 마개 회전/축소의 기준점 (rect 중심) */
const PLUG_OUTER_C = [34, 150];
const PLUG_INNER_C = [366, 150];

function num(v, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function unit(v) {
  return clamp(num(v, 0), 0, 1);
}

/** `#column` 의 transform — 왼쪽(바깥쪽) 끝을 고정한 채 길이만 준다. */
export function columnTransform(state = {}) {
  const f = unit(state.fill);
  return `translate(${COLUMN_X0},0) scale(${f.toFixed(4)},1) translate(${-COLUMN_X0},0)`;
}

/** 기둥이 아예 없으면 0. scale(0) 은 획이 선으로 남으므로 투명도로 지운다. */
export function columnOpacity(state = {}) {
  return unit(state.fill) > 0.001 ? '1' : '0';
}

function sealValue(state, end) {
  const seal = state.seal;
  if (seal == null) return 0;
  if (typeof seal === 'number') return unit(seal);
  return unit(seal[end]);
}

/**
 * 마개의 투명도. **0 이면 0 이다 — 안 막힌 것이 눈에 보여야 한다.**
 * 어중간하게 막은 것은 옅고 작게 그려서 "덜 막혔다" 가 보이게 한다.
 */
export function plugOpacity(state = {}, end = 'outer') {
  const s = sealValue(state, end);
  if (s <= 0.001) return '0';
  return (0.4 + 0.6 * s).toFixed(3);
}

/** 덜 누른 고무찰흙은 덩이도 작다. */
export function plugTransform(state = {}, end = 'outer') {
  const s = sealValue(state, end);
  const k = 0.55 + 0.45 * s;
  const [cx, cy] = end === 'outer' ? PLUG_OUTER_C : PLUG_INNER_C;
  return `translate(${cx},${cy}) scale(${k.toFixed(4)}) translate(${-cx},${-cy})`;
}

/** 헤파린이 발린 모세관에만 구분 띠가 보인다 — 고르는 것이 이 실험의 변인이다. */
export function bandOpacity(state = {}) {
  return state.kind === 'heparin' ? '1' : '0';
}

export function crackOpacity(state = {}) {
  return state.broken ? '1' : '0';
}

/**
 * 모세관 SVG 문자열 렌더링
 *
 * @param {{fill?: number, seal?: {outer?: number, inner?: number},
 *          kind?: 'heparin'|'plain', broken?: boolean}} state
 */
export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="capillary">
  <!-- 접지 그림자 — 실험대에 눕혀 놓은 상태 -->
  <ellipse cx="200" cy="184" rx="176" ry="9" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 유리관 본체. 왼쪽 끝(x=30)이 회전 바깥쪽, 오른쪽 끝(x=370)이 축 쪽이다. -->
  <g id="glass">
    <rect x="30" y="134" width="340" height="32" rx="3" ${paint('glass')}/>
    <!-- 관 안지름(bore) 위·아래 벽 -->
    <line x1="34" y1="143" x2="366" y2="143" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="34" y1="157" x2="366" y2="157" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 양끝의 열린 구멍. 마개가 없으면 이 선만 남아 "뚫려 있다" 가 보인다. -->
    <line x1="34" y1="143" x2="34" y2="157" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="366" y1="143" x2="366" y2="157" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!--
    유리 아래쪽 벽 음영 (광원 좌상단 → 음영은 아래).
    벽 두께를 다 채우면 빈 관이 **아래쪽에 하나 더 있는 것처럼** 보인다 — 관은 하나다.
    그래서 바깥 모서리에 붙는 얇은 띠로만 둔다.
  -->
  <rect id="glass-shade" x="34" y="160" width="332" height="5" fill="${PALETTE.glass[1]}"/>

  <!--
    혈액 기둥. **왼쪽(바깥쪽) 끝에서 자란다.**
    오른쪽 끝의 오목한 면이 축 쪽을 향한다 — 비어 있는 쪽이 어디인지 그 곡선이 말한다.
  -->
  <g id="column" transform="${columnTransform(state)}" opacity="${columnOpacity(state)}">
    <path d="M 34,144 L 344,144 Q 335,150 344,156 L 34,156 Z" fill="${EXP_PALETTE.bloodFresh[0]}"/>
    <path d="M 34,152 L 340,152 Q 338,154 344,156 L 34,156 Z" fill="${EXP_PALETTE.bloodFresh[1]}"/>
  </g>

  <!--
    헤파린 구분 띠 — **축 쪽(오른쪽) 끝**의 관 벽을 두르는 고리.
    관 안지름을 가리지 않도록 위·아래 벽으로만 그린다.
  -->
  <g id="band" opacity="${bandOpacity(state)}">
    <rect x="314" y="135" width="20" height="8" ${paintExp('heparinBand', { stroke: 'hair' })}/>
    <rect x="314" y="157" width="20" height="8" ${paintExp('heparinBand', { shade: true, stroke: 'hair' })}/>
  </g>

  <!-- 바깥쪽 마개 — 더 크고 뭉툭하다. 이 끝을 먼저 고무찰흙에 눌러 막는다. -->
  <g id="plug-outer" opacity="${plugOpacity(state, 'outer')}" transform="${plugTransform(state, 'outer')}">
    <rect x="14" y="128" width="40" height="44" rx="12" ${paintExp('clay')}/>
    <path d="M 14,158 L 40,158 L 40,128 L 42,128 Q 54,128 54,140 L 54,160 Q 54,172 42,172 L 26,172 Q 14,172 14,160 Z" fill="${EXP_PALETTE.clay[1]}"/>
  </g>

  <!-- 축 쪽 마개 — 나중에, 더 얕게 막는다 -->
  <g id="plug-inner" opacity="${plugOpacity(state, 'inner')}" transform="${plugTransform(state, 'inner')}">
    <rect x="350" y="132" width="32" height="36" rx="10" ${paintExp('clay')}/>
    <path d="M 350,156 L 370,156 L 370,132 L 372,132 Q 382,132 382,142 L 382,158 Q 382,168 372,168 L 360,168 Q 350,168 350,158 Z" fill="${EXP_PALETTE.clay[1]}"/>
  </g>

  <!-- 깨진 자리 -->
  <g id="crack" opacity="${crackOpacity(state)}">
    <path d="M 220,130 L 233,141 L 221,150 L 236,159 L 226,170" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 233,141 L 250,134 L 244,150 Z" ${paint('glass', { shade: true, stroke: 'detail' })}/>
    <path d="M 236,159 L 253,161 L 243,170 Z" ${paint('glass', { shade: true, stroke: 'detail' })}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const column = root.querySelector('#column');
  column.setAttribute('transform', columnTransform(state));
  column.setAttribute('opacity', columnOpacity(state));

  const outer = root.querySelector('#plug-outer');
  outer.setAttribute('opacity', plugOpacity(state, 'outer'));
  outer.setAttribute('transform', plugTransform(state, 'outer'));

  const inner = root.querySelector('#plug-inner');
  inner.setAttribute('opacity', plugOpacity(state, 'inner'));
  inner.setAttribute('transform', plugTransform(state, 'inner'));

  root.querySelector('#band').setAttribute('opacity', bandOpacity(state));
  root.querySelector('#crack').setAttribute('opacity', crackOpacity(state));
}
