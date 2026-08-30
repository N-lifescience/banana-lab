/**
 * 적양파 비늘잎(onion) 애셋 — 라인 + 플랫 구현.
 *
 * ── 이 그림이 해야 하는 일 ──────────────────────────────────────────
 * **어느 면인지가 그림에서 읽혀야 한다.** 안토시아닌은 바깥쪽(볼록한 면) 표피 세포의
 * 액포에만 있고 안쪽은 거의 무색이다 (`AGENTS.md` §2.5). 학생은 병 이름표가 아니라
 * 이 색을 보고 어느 면을 벗길지 고른다. 두 면의 색이 뚜렷이 갈리지 않으면
 * 이 실험에서 가장 중요한 선택이 화면에서 사라진다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';

export const NODES = ['#scale', '#scale-shade', '#scale-rim', '#cut', '#peeled'];

const OUTER = 'onionOuter';
const INNER = 'onionInner';

/** 지금 위를 향하고 있는 면의 색 이름 */
export function faceTone(state = {}) {
  return state.side === 'inner' ? INNER : OUTER;
}

/** 뒤집으면 보이는 면(테두리에 살짝 드러나는 쪽)의 색 이름 */
export function backTone(state = {}) {
  return state.side === 'inner' ? OUTER : INNER;
}

export const faceFill = (state) => EXP_PALETTE[faceTone(state)][0];
export const faceShade = (state) => EXP_PALETTE[faceTone(state)][1];
export const rimFill = (state) => EXP_PALETTE[backTone(state)][0];

/** 5×5 mm 칼집. 내기 전에는 보이지 않는다. */
export const cutOpacity = (state = {}) => (state.cut ? '1' : '0');

/** 칼집 자리에서 들려 올라간 표피 한 겹. 벗기고 나면 보인다. */
export function peeledOpacity(state = {}) {
  const p = typeof state.peeled === 'number' ? state.peeled : (state.peeled ? 1 : 0);
  return Math.max(0, Math.min(1, p)).toFixed(2);
}

/**
 * 적양파 비늘잎 조각 SVG 문자열 렌더링.
 *
 * @param {{side?: 'outer'|'inner', cut?: boolean, peeled?: number|boolean}} state
 */
export function render(state = {}) {
  const face = faceFill(state);
  const shade = faceShade(state);
  const rim = rimFill(state);
  const cOpacity = cutOpacity(state);
  const pOpacity = peeledOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="onion">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="252" rx="130" ry="18" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 비늘잎 한 조각. 통에서 떼어 낸 껍질이라 가운데가 볼록하고 네 귀가 살짝 들린다.
       위를 향한 면의 색이 곧 「어느 면을 벗기는가」다. -->
  <path id="scale" d="M 76,190 C 66,140 96,88 152,66 C 206,45 268,52 312,86 C 344,111 344,166 318,206 C 292,246 232,262 172,252 C 122,244 86,224 76,190 Z" fill="${face}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 반대쪽 면이 드러나는 테두리. 뒤집으면 색이 서로 바뀐다. -->
  <path id="scale-rim" d="M 172,252 C 232,262 292,246 318,206 C 330,187 336,166 336,146 C 330,182 312,218 278,238 C 244,258 206,258 172,252 Z" fill="${rim}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <path id="scale-shade" d="M 300,74 C 336,102 344,160 318,206 C 300,236 264,254 224,258 C 268,244 300,214 314,178 C 328,142 322,104 300,74 Z" fill="${shade}"/>

  <!-- 비늘잎 결. 세로로 길게 뻗는다 -->
  <path d="M 118,96 C 156,146 176,196 178,246" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <path d="M 166,72 C 196,124 210,182 208,250" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <path d="M 218,60 C 242,116 250,178 244,246" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <path d="M 268,62 C 286,114 290,170 282,232" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 5×5 mm 칼집. 네모나게 얕은 금을 긋는다.
       실물 비례로 이 비늘잎의 5 mm 는 프레임에서 20 px 남짓이다. -->
  <g id="cut" opacity="${cOpacity}">
    <rect x="150" y="128" width="22" height="22" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 칼집 자리에서 들려 올라간 표피 한 겹. 얇아서 아래가 비친다. -->
  <g id="peeled" opacity="${pOpacity}">
    <path d="M 150,128 L 172,128 L 186,104 L 162,102 Z" fill="${face}" fill-opacity="0.45" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 172,128 L 186,104 L 180,102 L 166,127 Z" fill="${shade}" fill-opacity="0.5"/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  root.querySelector('#scale').setAttribute('fill', faceFill(state));
  root.querySelector('#scale-shade').setAttribute('fill', faceShade(state));
  root.querySelector('#scale-rim').setAttribute('fill', rimFill(state));
  root.querySelector('#cut').setAttribute('opacity', cutOpacity(state));
  root.querySelector('#peeled').setAttribute('opacity', peeledOpacity(state));
}
