/**
 * 거름종이(paper) 애셋 — 라인 + 플랫 구현.
 *
 * 실물 2 × 10 cm 스트립이다. 결과(색 띠)를 그리는 것은 이 애셋이 아니라
 * `src/render/strip.js` 다 — 여기는 **실험대에 놓인 종이 한 장**이고,
 * 원점 선과 찍은 자국까지만 보여 준다.
 *
 * **색소 네 색(주황·노랑·청록·황록)을 쓰지 않는다.** 기구에 결과색이 있으면 헷갈린다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = ['#sheet', '#sheet-shade', '#origin', '#spot', '#wet'];

/** 종이의 화면 자리. 실물 4 : 10 의 비를 지킨다. */
/**
 * 종이의 화면 자리.
 *
 * **실물 2 : 10 의 비를 지키면서 프레임 높이를 채운다.** 세로로 아주 긴 모양이라
 * 프레임(4 : 3)을 가로로 채울 수가 없다 — 억지로 채우면 종이 모양이 거짓이 된다.
 * 그래서 높이를 먼저 채우고 폭은 비율에서 나온 값을 쓴다 (274 × 0.2 = 55).
 */
const SHEET = { x: 172, y: 12, w: 55, h: 274 };

/** 원점 선의 y. 아래에서 2.5 cm(=종이 높이의 25 %)가 기본이다. */
export function originY(state = {}) {
  const mm = clamp(state.origin ?? 25, 0, 100);
  return SHEET.y + SHEET.h * (1 - mm / 100);
}

/** 찍은 자국의 진하기와 크기 */
export function spotGeometry(state = {}) {
  const spots = clamp(state.spots ?? 0, 0, 20);
  return {
    opacity: spots === 0 ? '0' : String(Math.min(1, 0.25 + spots / 18).toFixed(2)),
    r: (4 + clamp(state.spotMm ?? 2, 2, 12) * 0.9).toFixed(1),
  };
}

/**
 * @param {{origin?: number, spots?: number, spotMm?: number, wet?: number, torn?: boolean}} state
 */
export function render(state = {}) {
  const oy = originY(state);
  const sp = spotGeometry(state);
  const wet = clamp(state.wet ?? 0, 0, 1);
  const wetH = (SHEET.h * 0.55 * wet).toFixed(1);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="paper">
  <ellipse cx="200" cy="292" rx="36" ry="7" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 종이 한 장 -->
  <rect id="sheet" x="${SHEET.x}" y="${SHEET.y}" width="${SHEET.w}" height="${SHEET.h}" rx="3"
        fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 젖은 부분 — 아래에서부터 올라온다 -->
  <rect id="wet" x="${SHEET.x + 3}" y="${(SHEET.y + SHEET.h - Number(wetH)).toFixed(1)}"
        width="${SHEET.w - 6}" height="${wetH}"
        fill="${EXP_PALETTE.devSolvent[0]}" opacity="0.55"/>

  <!-- 원점 선 (연필) -->
  <path id="origin" d="M ${SHEET.x + 4},${oy.toFixed(1)} L ${SHEET.x + SHEET.w - 4},${oy.toFixed(1)}"
        fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" stroke-dasharray="6 4" ${PATH_ATTRS}/>

  <!-- 찍은 자국 -->
  <ellipse id="spot" cx="${SHEET.x + SHEET.w / 2}" cy="${oy.toFixed(1)}" rx="${sp.r}" ry="${sp.r}"
           fill="${EXP_PALETTE.pigmentJuice[0]}" opacity="${sp.opacity}"/>

  <!-- 음영은 언제나 우하단 -->
  <path id="sheet-shade"
        d="M ${SHEET.x + SHEET.w - 9},${SHEET.y + 2} L ${SHEET.x + SHEET.w - 2},${SHEET.y + 2}
           L ${SHEET.x + SHEET.w - 2},${SHEET.y + SHEET.h - 2} L ${SHEET.x + 2},${SHEET.y + SHEET.h - 2}
           L ${SHEET.x + 2},${SHEET.y + SHEET.h - 9} L ${SHEET.x + SHEET.w - 9},${SHEET.y + SHEET.h - 9} Z"
        fill="${PALETTE.paper[1]}"/>
</svg>`;
}

export function applyState(root, state = {}) {
  const oy = originY(state).toFixed(1);
  const sp = spotGeometry(state);
  const origin = root.querySelector('#origin');
  origin.setAttribute('d', `M ${SHEET.x + 4},${oy} L ${SHEET.x + SHEET.w - 4},${oy}`);
  const spot = root.querySelector('#spot');
  spot.setAttribute('cy', oy);
  spot.setAttribute('rx', sp.r);
  spot.setAttribute('ry', sp.r);
  spot.setAttribute('opacity', sp.opacity);
  const wet = clamp(state.wet ?? 0, 0, 1);
  const wetH = SHEET.h * 0.55 * wet;
  const wetNode = root.querySelector('#wet');
  wetNode.setAttribute('y', (SHEET.y + SHEET.h - wetH).toFixed(1));
  wetNode.setAttribute('height', wetH.toFixed(1));
}
