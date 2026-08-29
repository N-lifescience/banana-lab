/**
 * 바나나 애셋 — 라인 + 플랫 참조 구현.
 *
 * 나머지 12종 애셋은 이 파일을 본보기로 만든다. 지켜야 할 점:
 *   - 색은 PALETTE에서만 가져온다. 보간하지 않고 단계로 고른다 (플랫이므로).
 *   - 선 두께는 STROKE 셋 중 하나만.
 *   - 계약(contract.js)에 선언한 id를 전부 갖는다.
 *   - render()는 순수 문자열을, applyState()는 DOM 변형을 담당한다.
 *     둘 다 있는 이유: render는 정적 생성과 린터가, applyState는 실행 중 갱신이 쓴다.
 */

import { PALETTE, INK, STROKE, PATH_ATTRS } from '../style/tokens.js';
import { outline, band, offsetLine, pointAt, bezD, rng, clamp } from './geometry.js';

/** 바나나의 중심선과 폭 프로파일. 이 둘이 형태의 전부다. */
const C = [[100, 62], [44, 172], [132, 264], [340, 232]];
const W = (t) => 13 + 58 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.88)), 0.48);

/** 과육은 껍질보다 가늘다 */
const FW = (t) => 10 + 44 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.88)), 0.48);

/** 껍질 조각 세 개의 중심선 — 벗김 정도에 따라 아래로 벌어진다 */
const STRIP_C = [
  [[136, 206], [196, 244], [262, 258], [336, 236]],
  [[132, 208], [184, 256], [248, 282], [318, 278]],
  [[128, 210], [158, 254], [186, 286], [232, 296]],
];
const STRIP_W = [(t) => 30 - 19 * t, (t) => 27 - 17 * t, (t) => 23 - 15 * t];

export const NODES = [
  '#peel', '#peel-shade', '#peel-line', '#stem', '#tip', '#spots', '#flesh', '#peel-strips',
];

/**
 * 익은 정도를 색 단계로 바꾼다.
 * 플랫 스타일이므로 연속 보간하지 않는다 — 세 단계 중 하나를 고른다.
 */
export function peelTone(ripe) {
  if (ripe < 0.33) return 'peelUnripe';
  if (ripe < 0.72) return 'peelRipe';
  return 'peelOverripe';
}

/** 반점은 익어야 생긴다 */
export function spotCount(ripe) {
  return Math.round(clamp((ripe - 0.5) / 0.5, 0, 1) * 22);
}

function stemPath() {
  const s0 = pointAt(C, W, 0.005, 0.95);
  const s1 = pointAt(C, W, 0.005, -0.95);
  const d = bezD(C[0], C[1], C[2], C[3], 0);
  const l = Math.hypot(d[0], d[1]) || 1;
  const ux = -d[0] / l, uy = -d[1] / l;
  const A = [s0[0] + ux * 32 - 3, s0[1] + uy * 32 - 4];
  const B = [s1[0] + ux * 30 + 4, s1[1] + uy * 30 + 1];
  return `M${s0[0].toFixed(1)},${s0[1].toFixed(1)} ` +
    `C${(s0[0] + ux * 17).toFixed(1)},${(s0[1] + uy * 17).toFixed(1)} ${(A[0] - 4).toFixed(1)},${(A[1] - 2).toFixed(1)} ${A[0].toFixed(1)},${A[1].toFixed(1)} ` +
    `L${B[0].toFixed(1)},${B[1].toFixed(1)} ` +
    `C${(B[0] - 5).toFixed(1)},${(B[1] + 3).toFixed(1)} ${(s1[0] + ux * 15).toFixed(1)},${(s1[1] + uy * 15).toFixed(1)} ${s1[0].toFixed(1)},${s1[1].toFixed(1)} Z`;
}

function spotShapes(ripe, seed = 4242) {
  const r = rng(seed);
  const n = spotCount(ripe);
  let out = '';
  for (let i = 0; i < 24; i++) {
    const t = 0.14 + r() * 0.74;
    const f = (r() * 2 - 1) * 0.7;
    const p = pointAt(C, W, t, f);
    const rr = 1.0 + r() * 2.2;
    if (i >= n) continue;
    out += `<ellipse cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" ` +
      `rx="${(rr * 1.7).toFixed(1)}" ry="${(rr * 1.1).toFixed(1)}" fill="${PALETTE.peelSpot[0]}"/>`;
  }
  return out;
}

function stripShapes(peel) {
  if (peel <= 0.02) return '';
  return STRIP_C.map((base, i) => {
    const spread = peel * (1 + i * 0.35);
    const moved = base.map((p, k) => (k === 0 ? p : [p[0], p[1] + spread * (14 + k * 10)]));
    return `<path d="${outline(moved, STRIP_W[i], 40)}" fill="${PALETTE.peelRipe[0]}" ` +
      `stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>`;
  }).join('');
}

/**
 * @param {{ripe?:number, peel?:number, seed?:number}} state
 *   ripe 0~1 (0 덜 익음 · 0.35 알맞음 · 1 과숙), peel 0~1 (껍질 벗김)
 */
export function render(state = {}) {
  const ripe = state.ripe ?? 0.35;
  const peel = clamp(state.peel ?? 0, 0, 1);
  const tone = peelTone(ripe);
  const body = outline(C, W, 80);
  const tip = pointAt(C, W, 1, 0);
  const td = bezD(C[0], C[1], C[2], C[3], 1);
  const tipRot = (Math.atan2(td[1], td[0]) * 180) / Math.PI;
  const fleshOpacity = clamp(peel * 2.2, 0, 1).toFixed(2);

  return `<svg viewBox="0 0 400 312" xmlns="http://www.w3.org/2000/svg" data-asset="banana">
  <defs><clipPath id="banana-body"><path d="${body}"/></clipPath></defs>

  <g id="peel-strips" opacity="${fleshOpacity}">${stripShapes(peel)}</g>

  <path id="stem" d="${stemPath()}" fill="${PALETTE.stem[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <path id="peel" d="${body}" fill="${PALETTE[tone][0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <g clip-path="url(#banana-body)">
    <path id="peel-shade" d="${band(C, W, -0.34, -1, 56)}" fill="${PALETTE[tone][1]}"/>
    <g id="spots">${spotShapes(ripe, state.seed)}</g>
  </g>

  <path id="flesh" d="${outline(C, FW, 80)}" fill="${PALETTE.flesh[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS} opacity="${fleshOpacity}"/>

  <path id="peel-line" d="${offsetLine(C, W, -0.34, 56)}" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <ellipse id="tip" cx="${tip[0].toFixed(1)}" cy="${tip[1].toFixed(1)}" rx="9" ry="7" transform="rotate(${tipRot.toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)})" fill="${PALETTE.tip[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
</svg>`;
}

/**
 * 이미 붙어 있는 SVG를 상태에 맞게 갱신한다.
 * 계약에 선언된 노드의, 선언된 속성만 건드린다.
 */
export function applyState(root, state = {}) {
  const ripe = state.ripe ?? 0.35;
  const peel = clamp(state.peel ?? 0, 0, 1);
  const tone = peelTone(ripe);
  const fleshOpacity = clamp(peel * 2.2, 0, 1).toFixed(2);

  root.querySelector('#peel').setAttribute('fill', PALETTE[tone][0]);
  root.querySelector('#peel-shade').setAttribute('fill', PALETTE[tone][1]);
  root.querySelector('#spots').innerHTML = spotShapes(ripe, state.seed);
  root.querySelector('#flesh').setAttribute('opacity', fleshOpacity);
  const strips = root.querySelector('#peel-strips');
  strips.setAttribute('opacity', fleshOpacity);
  strips.innerHTML = stripShapes(peel);
}
