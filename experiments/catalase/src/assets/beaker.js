/**
 * 비커(beaker) 애셋 — 라인 + 플랫.
 *
 * 이 실험의 시행이 일어나는 그릇이다. 실험대에서는 **무엇이 얼마나 들었는지**와
 * **금이 갔는지**만 보이면 된다. 원반이 떠오르는 모습은 결과 렌더러가 크게 그린다
 * (`src/render/beaker.js`) — 실험대의 작은 토큰에서 그것까지 보이길 기대하면
 * 둘 다 어중간해진다.
 *
 * docs/01-art-direction.md · docs/02-asset-contract.md 규칙을 따른다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = ['#glass', '#glass-shade', '#spout', '#graduations', '#liquid', '#liquid-shade', '#crack'];

/** 비커 안쪽 바닥과 입구의 y. 액체 높이를 여기서만 계산한다. */
const FLOOR_Y = 252;
const BRIM_Y = 92;

/**
 * 담긴 것의 색.
 *
 * `contents` 는 무엇이 들었는가다 — 과산화수소수인지, 감자즙인지, 아무것도 없는지.
 * 이 실험에는 색 변화가 없으므로 색이 결과를 말하지 않는다 (palette.experiment.js 주석).
 */
export function liquidFill(contents) {
  const k = String(contents ?? '').toUpperCase();
  if (k === 'H2O2') return EXP_PALETTE.h2o2;
  if (k === 'POTATO') return EXP_PALETTE.potato;
  if (k === 'POTATO_BOILED') return EXP_PALETTE.potatoBoiled;
  return EXP_PALETTE.h2o2;
}

/** 액면의 y 와 높이. `level` 0~1 을 안쪽 바닥~입구 사이로 옮긴다. */
export function liquidGeometry(level = 0) {
  const t = clamp(level, 0, 1);
  const height = (FLOOR_Y - BRIM_Y) * t;
  return { y: (FLOOR_Y - height).toFixed(1), height: height.toFixed(1) };
}

/**
 * 금.
 *
 * 열 충격으로 깨진 비커는 **한눈에 달라 보여야 한다.** 안 그러면 학생이 왜 조작이
 * 막히는지 화면에서 읽을 수 없고, 토스트 문구 하나에 기대게 된다.
 */
function crackPath(cracked) {
  if (!cracked) return '';
  return `<path d="M 128,150 L 146,176 L 133,190 L 158,214 L 148,236"`
    + ` fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`
    + `<path d="M 146,176 L 168,168" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`;
}

/** 눈금. 250 mL 비커의 50 mL 눈금 다섯 줄. */
function graduationLines() {
  return [0.2, 0.35, 0.5, 0.65, 0.8].map((t) => {
    const y = (FLOOR_Y - (FLOOR_Y - BRIM_Y) * t).toFixed(1);
    return `<path d="M 130,${y} h 26" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`;
  }).join('');
}

/**
 * @param {{level?: number, contents?: string, cracked?: boolean}} state
 */
export function render(state = {}) {
  const [base, shade] = liquidFill(state.contents);
  const { y, height } = liquidGeometry(state.level ?? 0);
  const show = (state.level ?? 0) > 0 ? 1 : 0;

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="beaker">
  <ellipse cx="200" cy="262" rx="86" ry="14" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 유리 몸통. 위가 살짝 넓은 원통 -->
  <path id="glass" d="M 122,90 L 132,254 C 132,262 268,262 268,254 L 278,90 Z"
    fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 담긴 액체. 유리보다 먼저 그리지 않는다 — 유리 위에 얹혀야 안이 비쳐 보인다 -->
  <rect id="liquid" x="128" y="${y}" width="144" height="${height}" opacity="${show}"
    fill="${base}" stroke="none"/>
  <!-- 액체의 우하단 음영 (광원 좌상단 45°) -->
  <rect id="liquid-shade" x="228" y="${y}" width="44" height="${height}" opacity="${show}"
    fill="${shade}" stroke="none"/>

  <!-- 유리의 우하단 음영 -->
  <path id="glass-shade" d="M 250,90 L 240,254 C 258,253 268,259 268,254 L 278,90 Z"
    fill="${PALETTE.glass[1]}" stroke="none"/>

  <!-- 주둥이. 비커를 비커답게 만드는 유일한 형태라 빼면 컵이 된다 -->
  <path id="spout" d="M 122,90 L 106,80 L 118,72 L 136,84"
    fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 눈금 -->
  <g id="graduations">${graduationLines()}</g>

  <!-- 입구 테두리 -->
  <path d="M 122,90 L 278,90" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 금. 깨지지 않았으면 비어 있다 -->
  <g id="crack">${crackPath(state.cracked)}</g>
</svg>`;
}

export function applyState(root, state = {}) {
  const [base, shade] = liquidFill(state.contents);
  const { y, height } = liquidGeometry(state.level ?? 0);
  const show = (state.level ?? 0) > 0 ? '1' : '0';

  const liquid = root.querySelector('#liquid');
  liquid.setAttribute('y', y);
  liquid.setAttribute('height', height);
  liquid.setAttribute('fill', base);
  liquid.setAttribute('opacity', show);

  const ls = root.querySelector('#liquid-shade');
  ls.setAttribute('y', y);
  ls.setAttribute('height', height);
  ls.setAttribute('fill', shade);
  ls.setAttribute('opacity', show);

  root.querySelector('#crack').innerHTML = crackPath(state.cracked);
}
