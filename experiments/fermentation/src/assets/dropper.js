/**
 * 스포이트(점적기) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = [
  '#bulb', '#bulb-shade', '#tube', '#tube-shade', '#liquid', '#drop',
];

/**
 * 담긴 시약에 따른 액체 색상
 */
export function liquidFill(state = {}) {
  const holds = state.holds;
  if (!holds) return PALETTE.glass[0];
  const k = String(holds ?? '').toUpperCase();
  if (k === 'GLUCOSE' || k === 'MIX') return EXP_PALETTE.glucose[0];
  if (k === 'WATER') return EXP_PALETTE.water[0];
  if (k === 'YEAST') return EXP_PALETTE.yeast[0];
  // 팽대부에서 빼낸 것은 포도당 수용액과 효모액이 섞인 것이다.
  if (k === 'BREW') return EXP_PALETTE.brew[0];
  if (k === 'KOH') return EXP_PALETTE.koh[0];
  return PALETTE.glass[0];
}

/**
 * 액체 기둥의 기하학적 수치 (y, height, opacity)
 */
export function liquidGeometry(state = {}) {
  const level = clamp(state.level ?? 0, 0, 1);
  const hasLiquid = Boolean(state.holds && level > 0);
  const maxHeight = 140;
  const baseY = 238;
  const height = (maxHeight * level).toFixed(1);
  const y = (baseY - maxHeight * level).toFixed(1);
  const opacity = hasLiquid ? '1' : '0';
  return { y, height, opacity };
}

/**
 * 고무 캡(bulb) 쥐어짜기 변형
 */
export function bulbTransform(state = {}) {
  if (state.squeezed) {
    return 'translate(24, 0) scale(0.88, 1)';
  }
  return '';
}

/**
 * 끝 방울(drop)의 불투명도
 */
export function dropOpacity(state = {}) {
  if (state.squeezed && state.holds) return '1';
  if (state.dropVisible) return '1';
  return '0';
}

/**
 * 스포이트 SVG 문자열 렌더링
 *
 * @param {{holds?: string|null, level?: number, squeezed?: boolean, dropTransform?: string}} state
 */
export function render(state = {}) {
  const fill = liquidFill(state);
  const { y, height, opacity: lOpacity } = liquidGeometry(state);
  const bTransform = bulbTransform(state);
  const dOpacity = dropOpacity(state);
  const dTransform = state.dropTransform ?? '';
  const dTransformAttr = dTransform ? ` transform="${dTransform}"` : '';

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="dropper">
  <!-- 접지 그림자 -->
  <ellipse cx="204" cy="275" rx="16" ry="5" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 유리관 본체 -->
  <path id="tube" d="M 188,88 L 212,88 L 212,225 L 204,245 L 196,245 L 188,225 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 유리관 우하단 음영 (광원 좌상단 45°) -->
  <path id="tube-shade" d="M 206,90 L 210,90 L 210,224 L 203,243 L 199,243 L 206,223 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 유리관 눈금 -->
  <line x1="202" y1="130" x2="209" y2="130" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="198" y1="155" x2="209" y2="155" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="202" y1="180" x2="209" y2="180" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="198" y1="205" x2="209" y2="205" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 관 내부 액체 기둥 -->
  <rect id="liquid" x="191" y="${y}" width="18" height="${height}" rx="1" fill="${fill}" opacity="${lOpacity}"/>

  <!-- 고무 캡(벌브) 그룹 -->
  <g id="bulb"${bTransform ? ` transform="${bTransform}"` : ''}>
    <!-- 고무 캡 본체 -->
    <path d="M 186,85 C 170,80 170,40 185,32 C 192,28 208,28 215,32 C 230,40 230,80 214,85 Z" fill="${PALETTE.rubber[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 고무 캡 우하단 음영 -->
    <path id="bulb-shade" d="M 200,30 C 210,31 228,42 228,65 C 228,78 220,83 214,85 C 212,80 216,65 210,50 C 206,40 200,34 200,30 Z" fill="${PALETTE.rubber[1]}"/>
    <!-- 고무 캡 하단 턱 -->
    <rect x="184" y="82" width="32" height="6" rx="2" fill="${PALETTE.rubber[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 끝 방울 (액체 방울) -->
  <path id="drop" d="M 200,246 C 194,253 194,262 200,262 C 206,262 206,253 200,246 Z" fill="${fill}" opacity="${dOpacity}"${dTransformAttr}/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const bulb = root.querySelector('#bulb');
  const bTransform = bulbTransform(state);
  if (bTransform) {
    bulb.setAttribute('transform', bTransform);
  } else {
    bulb.removeAttribute('transform');
  }

  const liquid = root.querySelector('#liquid');
  const fill = liquidFill(state);
  const { y, height, opacity } = liquidGeometry(state);
  liquid.setAttribute('fill', fill);
  liquid.setAttribute('y', y);
  liquid.setAttribute('height', height);
  liquid.setAttribute('opacity', opacity);

  const drop = root.querySelector('#drop');
  drop.setAttribute('fill', fill);
  drop.setAttribute('opacity', dropOpacity(state));
  const dTransform = state.dropTransform ?? '';
  if (dTransform) {
    drop.setAttribute('transform', dTransform);
  } else {
    drop.removeAttribute('transform');
  }
}
