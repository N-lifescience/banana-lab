/**
 * 개수대(sink) 애셋 — 라인 + 플랫 구현.
 *
 * 실험실 개수대: 스테인리스 싱크볼 + 구스넥 수전 + 배수구 + 물줄기.
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = ['#basin', '#basin-shade', '#faucet', '#water'];

/** 물이 흐르는 중인가. 0이면 잠겨 있다. */
export function waterOpacity(state = {}) {
  return clamp(state.water ?? 0, 0, 1).toFixed(2);
}

export function render(state = {}) {
  const wOpacity = waterOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="sink">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="254" rx="128" ry="14" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 개수대 본체 (상판 데크 · 에이프런 · 싱크볼 · 배수구) -->
  <g id="basin">
    <!-- 상판 뒷벽 데크 (Deck surface) -->
    <polygon points="86,96 314,96 328,124 72,124" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 전면 에이프런 외벽 (Front apron body) -->
    <path d="M 72,124 L 86,242 C 86,246 90,249 96,249 L 304,249 C 310,249 314,246 314,242 L 328,124 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 상판 전면 모서리 림 (Front rim lip) -->
    <rect x="70" y="122" width="260" height="7" rx="2.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 내부 입구 테두리 (Bowl opening rim) -->
    <ellipse cx="200" cy="120" rx="104" ry="19" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 안쪽 뒷벽/측벽 (Bowl inner walls) -->
    <path d="M 96,120 C 96,106 142,104 200,104 C 258,104 304,106 304,120 C 304,130 292,138 274,142 L 274,166 C 256,171 230,173 200,173 C 170,173 144,171 126,166 L 126,142 C 108,138 96,130 96,120 Z" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 싱크볼 안쪽 바닥면 (Bowl floor) -->
    <ellipse cx="200" cy="176" rx="74" ry="17" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 앞쪽 내벽 림 라인 -->
    <path d="M 96,120 C 96,135 142,139 200,139 C 258,139 304,135 304,120" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 측면 곡률 디테일 선 -->
    <path d="M 104,127 C 110,144 118,159 128,169" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 296,127 C 290,144 282,159 272,169" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 넘침 방지 구멍 (Overflow) -->
    <ellipse cx="200" cy="126" rx="6" ry="3" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="123.5" x2="200" y2="128.5" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 배수구 (Drain) -->
    <ellipse cx="200" cy="176" rx="20" ry="7.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="177" rx="15" ry="5.5" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 배수 거름망 (Strainer plate) -->
    <ellipse cx="200" cy="176" rx="10" ry="3.8" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="191" y1="176" x2="209" y2="176" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="172.5" x2="200" y2="179.5" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="195" cy="175" r="0.8" fill="${PALETTE.bodyDark[1]}"/>
    <circle cx="205" cy="175" r="0.8" fill="${PALETTE.bodyDark[1]}"/>
    <circle cx="197.5" cy="177" r="0.8" fill="${PALETTE.bodyDark[1]}"/>
    <circle cx="202.5" cy="177" r="0.8" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 수도꼭지 (구스넥 수전 + 밸브 레버) -->
  <g id="faucet">
    <!-- 수전 기둥 밑둥 플랜지 (상판 좌후방에 마운트) -->
    <ellipse cx="145" cy="96" rx="11" ry="4" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="138" y="83" width="14" height="13" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 밸브 핸들 (좌측 수평 레버) -->
    <rect x="116" y="85" width="22" height="6" rx="2.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <circle cx="118" cy="88" r="3.5" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 구스넥 곡관 파이프 (수전 기둥에서 솟아 싱크볼 중심 위로 굽어 내려오는 형태) -->
    <path d="M 139,83 L 139,54 C 139,32 160,26 182,26 C 202,26 206,40 206,54 L 206,76 L 194,76 L 194,54 C 194,42 188,36 178,36 C 166,36 151,42 151,54 L 151,83 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 파이프 우측 음영 디테일 -->
    <path d="M 180,26 C 202,26 206,40 206,54 L 206,76 L 200,76 L 200,54 C 200,38 192,32 180,32 Z" fill="${PALETTE.metal[1]}"/>

    <!-- 토수구 노즐 (Aerator spout — 싱크볼 안쪽 중앙 상공에 위치) -->
    <rect x="191" y="74" width="18" height="9" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="83" rx="7" ry="2.5" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 물줄기 (잠겨 있으면 opacity=0) -->
  <g id="water" opacity="${wOpacity}">
    <!-- 낙수 물줄기 (토수구에서 배수구로 곧장 낙하) -->
    <path d="M 196.5,83 L 195.5,172 C 195.5,176 204.5,176 204.5,172 L 203.5,83 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 배수구 수면 파문 및 물방울 -->
    <ellipse cx="200" cy="176" rx="18" ry="6.5" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="176" rx="11" ry="4" fill="${PALETTE.glass[1]}"/>
    <circle cx="188" cy="168" r="1.5" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="212" cy="170" r="1.2" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45° — 몸통 및 볼 우하단 실루엣을 따름) -->
  <g id="basin-shade">
    <!-- 상판 데크 우측 음영 -->
    <polygon points="305,96 314,96 328,124 319,124" fill="${PALETTE.metal[1]}"/>
    <!-- 에이프런 우측단 및 하단 음영 -->
    <path d="M 270,249 L 304,249 C 310,249 314,246 314,242 L 328,124 L 314,124 L 302,237 C 301,240 298,243 294,243 L 270,243 Z" fill="${PALETTE.metal[1]}"/>
    <!-- 싱크볼 안쪽 우측벽 음영 -->
    <path d="M 240,105 C 270,108 304,112 304,120 L 274,166 C 256,171 230,173 200,173 L 200,167 C 224,167 248,165 262,161 L 288,122 C 274,114 254,108 240,105 Z" fill="${PALETTE.metal[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const water = root.querySelector('#water');
  if (water) water.setAttribute('opacity', waterOpacity(state));
}

