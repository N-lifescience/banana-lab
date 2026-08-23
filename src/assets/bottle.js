/**
 * 시약병(bottle) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = [
  '#body', '#body-shade', '#liquid', '#cap', '#label', '#label-text',
];

/**
 * 시약 종류에 따른 액체 채움 색상
 */
export function liquidFill(state = {}) {
  const kind = state.kind;
  if (kind === 'IKI' || kind === 'iodine') return PALETTE.iodine[0];
  if (kind === 'SUDAN3' || kind === 'sudan') return PALETTE.sudan[0];
  return PALETTE.glass[0];
}

/**
 * 액체 기하학적 수치 (y, height)
 */
export function liquidGeometry(state = {}) {
  const level = clamp(state.level ?? 0, 0, 1);
  const maxHeight = 135;
  const baseY = 258;
  const height = (maxHeight * level).toFixed(1);
  const y = (baseY - maxHeight * level).toFixed(1);
  return { y, height };
}

/**
 * 마개(cap) 열림 변형
 */
export function capTransform(state = {}) {
  if (state.capOpen) {
    return 'translate(55, -28) rotate(22 200 50)';
  }
  return '';
}

/**
 * 라벨 텍스트 생성
 */
export function labelTextContent(kind) {
  if (kind === 'IKI' || kind === 'iodine') {
    return `<text x="200" y="162" font-size="11" font-weight="bold" text-anchor="middle" fill="${INK}">아이오딘</text>` +
      `<text x="200" y="178" font-size="9" text-anchor="middle" fill="${INK}">아이오딘화 칼륨</text>` +
      `<text x="200" y="196" font-size="8" text-anchor="middle" fill="${INK}">I₂-KI (녹말)</text>`;
  }
  if (kind === 'SUDAN3' || kind === 'sudan') {
    return `<text x="200" y="162" font-size="11" font-weight="bold" text-anchor="middle" fill="${INK}">수단 Ⅲ</text>` +
      `<text x="200" y="178" font-size="9" text-anchor="middle" fill="${INK}">용액</text>` +
      `<text x="200" y="196" font-size="8" text-anchor="middle" fill="${INK}">Sudan Ⅲ (지질)</text>`;
  }
  return `<text x="200" y="178" font-size="10" text-anchor="middle" fill="${INK}">시약병</text>`;
}

/**
 * 시약병 SVG 문자열 렌더링
 *
 * @param {{kind?: string, level?: number, capOpen?: boolean}} state
 */
export function render(state = {}) {
  const fill = liquidFill(state);
  const { y, height } = liquidGeometry(state);
  const cTransform = capTransform(state);
  const lText = labelTextContent(state.kind);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="bottle">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="272" rx="68" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 시약병 몸통 본체 -->
  <path id="body" d="M 180,65 L 220,65 L 220,80 C 220,95 260,105 260,120 L 260,252 C 260,258 254,264 248,264 L 152,264 C 146,264 140,258 140,252 L 140,120 C 140,105 180,95 180,80 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 병 내부 액체 -->
  <rect id="liquid" x="146" y="${y}" width="108" height="${height}" rx="2" fill="${fill}"/>

  <!-- 병 몸통 우하단 음영 (광원 좌상단 45°) -->
  <path id="body-shade" d="M 215,67 L 218,67 L 218,80 C 218,94 256,104 256,120 L 256,252 C 256,257 251,262 246,262 L 160,262 L 166,256 L 246,256 C 248,256 250,254 250,252 L 250,122 C 250,110 214,98 214,80 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 종이 라벨 -->
  <rect id="label" x="155" y="142" width="90" height="66" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <line x1="155" y1="168" x2="245" y2="168" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <g id="label-text">${lText}</g>

  <!-- 병마개(뚜껑) 그룹 -->
  <g id="cap"${cTransform ? ` transform="${cTransform}"` : ''}>
    <path d="M 174,44 L 226,44 C 228,44 230,46 230,48 L 228,66 L 172,66 L 170,48 C 170,46 172,44 174,44 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 마개 우하단 음영 -->
    <path d="M 205,45 L 225,45 C 227,45 228,46 228,48 L 226,65 L 218,65 L 220,49 L 205,49 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 마개 손잡이 돌기 디테일 -->
    <line x1="184" y1="48" x2="184" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="192" y1="48" x2="192" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="48" x2="200" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="208" y1="48" x2="208" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="216" y1="48" x2="216" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const liquid = root.querySelector('#liquid');
  const fill = liquidFill(state);
  const { y, height } = liquidGeometry(state);
  liquid.setAttribute('fill', fill);
  liquid.setAttribute('y', y);
  liquid.setAttribute('height', height);

  const cap = root.querySelector('#cap');
  const cTransform = capTransform(state);
  if (cTransform) {
    cap.setAttribute('transform', cTransform);
  } else {
    cap.removeAttribute('transform');
  }

  const labelText = root.querySelector('#label-text');
  labelText.innerHTML = labelTextContent(state.kind);
}
