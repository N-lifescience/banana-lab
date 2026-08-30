/**
 * 소독솜(swab) 애셋 — 라인 + 플랫 구현.
 *
 * 알코올 솜 한 장. 포장(#wrapper)이 덮여 있으면 아직 뜯지 않은 것이고,
 * 사라지면 뜯어서 솜이 드러난 것이다. 다 쓰면 #damp 로 젖은 자리가 보인다.
 *
 * 알코올은 이 실험의 색(EXP_PALETTE.alcohol)이다. **결과색(packedCells ·
 * buffyCoat · plasma · serum · clot)은 기구에 쓰지 않는다** — 실험대의
 * 물건이 결과와 같은 색이면 학생이 층을 그 색으로 기억한다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';

export const NODES = ['#cotton', '#cotton-shade', '#wrapper', '#damp'];

/** 다 쓴 것인가. 숫자로 와도(0/1) 받아 준다. */
export function isUsed(state = {}) {
  return typeof state.used === 'number' ? state.used >= 1 : Boolean(state.used);
}

/** 포장은 뜯기 전에만 보인다. 뜯고 나면 솜이 드러난다. */
export function wrapperOpacity(state = {}) {
  return isUsed(state) ? '0' : '1';
}

/** 젖은 자리 — 알코올이 밴 정도. */
export function dampOpacity(state = {}) {
  return isUsed(state) ? '1' : '0';
}

export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="swab">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="238" rx="118" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 접은 솜 한 장. 네 귀가 조금씩 어긋난 사각형이라야 천으로 읽힌다 -->
  <g id="cotton">
    <path d="M 122,100 L 278,96 C 284,96 288,100 288,106 L 284,214 C 284,220 280,224 274,224 L 124,222 C 118,222 114,218 114,212 L 116,108 C 116,102 118,100 122,100 Z" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 접힌 겹 (왼쪽 모서리에 층이 보인다) -->
    <path d="M 136,99 L 134,223" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 146,99 L 144,223" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 접힌 자국 -->
    <path d="M 152,160 C 190,154 234,156 286,160" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 210,98 C 216,132 214,180 210,223" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 — 들린 모서리를 겸한다 (광원 좌상단 45°) -->
  <path id="cotton-shade" d="M 286,158 L 284,214 C 284,220 280,224 274,224 L 176,223 Z" fill="${PALETTE.paper[1]}"/>

  <!-- 알코올이 밴 자리 — 번진 얼룩이다. 반듯한 타원은 천에 밴 것으로 안 보인다 -->
  <g id="damp" opacity="${dampOpacity(state)}">
    <path d="M 176,140 C 186,126 208,122 224,130 C 238,137 244,150 240,163 C 236,178 216,186 200,182 C 184,178 172,170 170,158 C 168,150 171,145 176,140 Z" fill="${EXP_PALETTE.alcohol[0]}"/>
    <path d="M 224,130 C 238,137 244,150 240,163 C 236,178 216,186 200,182 C 218,180 232,172 237,160 C 241,149 233,138 224,130 Z" fill="${EXP_PALETTE.alcohol[1]}"/>
  </g>

  <!-- 뜯지 않은 포장 (알루미늄 파우치) -->
  <g id="wrapper" opacity="${wrapperOpacity(state)}">
    <rect x="86" y="82" width="228" height="152" rx="8" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 포장 우하단 음영 (압착선·라벨보다 먼저 깔아야 디테일을 덮지 않는다) -->
    <path d="M 300,92 L 310,92 L 310,222 L 94,222 L 94,214 L 300,214 Z" fill="${PALETTE.metal[1]}"/>
    <!-- 좌우 압착선 -->
    <line x1="108" y1="86" x2="108" y2="230" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="292" y1="86" x2="292" y2="230" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="100" x2="104" y2="100" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="122" x2="104" y2="122" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="144" x2="104" y2="144" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="166" x2="104" y2="166" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="188" x2="104" y2="188" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="210" x2="104" y2="210" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="296" y1="100" x2="308" y2="100" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="296" y1="122" x2="308" y2="122" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="296" y1="144" x2="308" y2="144" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="296" y1="166" x2="308" y2="166" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="296" y1="188" x2="308" y2="188" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="296" y1="210" x2="308" y2="210" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 뜯는 자리 (오른쪽 위 노치) -->
    <polygon points="302,90 314,84 314,100" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 라벨 -->
    <rect x="130" y="126" width="140" height="52" rx="4" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <text x="200" y="150" font-size="15" font-weight="bold" text-anchor="middle" fill="${INK}">알코올 솜</text>
    <line x1="146" y1="162" x2="254" y2="162" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="164" y1="170" x2="236" y2="170" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const wrapper = root.querySelector('#wrapper');
  if (wrapper) wrapper.setAttribute('opacity', wrapperOpacity(state));

  const damp = root.querySelector('#damp');
  if (damp) damp.setAttribute('opacity', dampOpacity(state));
}
