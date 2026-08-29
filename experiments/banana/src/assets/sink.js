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
  <ellipse cx="200" cy="252" rx="96" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 개수대 본체 (상판 데크 · 전면 에이프런 · 싱크볼 · 배수구) -->
  <g id="basin">
    <!-- 상판 뒷벽 데크 (Deck surface in 3/4 perspective) -->
    <polygon points="115,115 285,115 300,145 100,145" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 전면 에이프런 외벽 (Front apron body) -->
    <path d="M 100,145 L 108,238 C 108,242 112,245 116,245 L 284,245 C 288,242 292,242 292,238 L 300,145 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 상판 전면 모서리 림 (Front rim lip) -->
    <rect x="98" y="142" width="204" height="6" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 내부 입구 테두리 (Bowl opening rim) -->
    <ellipse cx="200" cy="130" rx="75" ry="13" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 안쪽 뒷벽/측벽 (Bowl inner walls) -->
    <path d="M 125,130 C 125,119 158,117 200,117 C 242,117 275,119 275,130 C 275,138 266,145 252,148 L 252,168 C 238,172 220,174 200,174 C 180,174 162,172 148,168 L 148,148 C 134,145 125,138 125,130 Z" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 싱크볼 안쪽 바닥면 (Bowl floor) -->
    <ellipse cx="200" cy="175" rx="58" ry="11" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 앞쪽 내벽 림 라인 -->
    <path d="M 125,130 C 125,141 158,143 200,143 C 242,143 275,141 275,130" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 측면 곡률 디테일 선 -->
    <path d="M 130,135 C 134,148 138,162 144,170" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 270,135 C 266,148 262,162 256,170" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 넘침 방지 구멍 (Overflow) -->
    <ellipse cx="200" cy="138" rx="5" ry="2.5" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="136" x2="200" y2="140" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 배수구 (Drain) -->
    <ellipse cx="200" cy="175" rx="16" ry="6" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="175.5" rx="12" ry="4.5" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 배수 거름망 (Strainer plate) -->
    <ellipse cx="200" cy="175" rx="8" ry="3" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="193" y1="175" x2="207" y2="175" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="172.5" x2="200" y2="177.5" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="196" cy="174.5" r="0.7" fill="${PALETTE.bodyDark[1]}"/>
    <circle cx="204" cy="174.5" r="0.7" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 수도꼭지 (구스넥 수전 + 밸브 레버) -->
  <g id="faucet">
    <!-- 수전 기둥 밑둥 플랜지 (상판 좌후방에 마운트) -->
    <ellipse cx="155" cy="115" rx="9" ry="3.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="150" y="104" width="10" height="11" rx="1.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 밸브 핸들 (좌측 수평 레버) -->
    <rect x="134" y="106" width="17" height="5" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <circle cx="135" cy="108.5" r="2.8" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 구스넥 곡관 파이프 (수전 기둥에서 솟아 싱크볼 중심 위로 굽어 내려오는 형태) -->
    <path d="M 151,104 L 151,76 C 151,56 166,50 182,50 C 198,50 205,62 205,76 L 205,92 L 195,92 L 195,76 C 195,66 190,60 182,60 C 172,60 161,64 161,76 L 161,104 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 파이프 우측 음영 디테일 -->
    <path d="M 182,50 C 198,50 205,62 205,76 L 205,92 L 200,92 L 200,76 C 200,64 194,56 182,56 Z" fill="${PALETTE.metal[1]}"/>

    <!-- 토수구 노즐 (Aerator spout — 싱크볼 안쪽 중앙 상공에 위치) -->
    <rect x="193" y="90" width="14" height="7" rx="1.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="97" rx="5.5" ry="2" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 물줄기 (잠겨 있으면 opacity=0) -->
  <g id="water" opacity="${wOpacity}">
    <!-- 낙수 물줄기 (토수구에서 배수구로 곧장 낙하) -->
    <path d="M 197.5,97 L 196.5,171 C 196.5,174 203.5,174 203.5,171 L 202.5,97 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 배수구 수면 파문 및 물방울 -->
    <ellipse cx="200" cy="175" rx="14" ry="5" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="175" rx="9" ry="3" fill="${PALETTE.glass[1]}"/>
    <circle cx="191" cy="169" r="1.2" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="209" cy="170" r="1" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45° — 몸통 및 볼 우하단 실루엣을 따름) -->
  <g id="basin-shade">
    <!-- 상판 데크 우측 음영 -->
    <polygon points="278,115 285,115 300,145 292,145" fill="${PALETTE.metal[1]}"/>
    <!-- 에이프런 우측단 및 하단 음영 -->
    <path d="M 260,245 L 284,245 C 288,242 292,242 292,238 L 300,145 L 290,145 L 282,236 C 281,238 278,240 274,240 L 260,240 Z" fill="${PALETTE.metal[1]}"/>
    <!-- 싱크볼 안쪽 우측벽 음영 -->
    <path d="M 235,119 C 255,121 275,124 275,130 L 252,168 C 238,172 220,174 200,174 L 200,169 C 218,169 234,167 244,163 L 263,132 C 253,126 238,121 235,119 Z" fill="${PALETTE.metal[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const water = root.querySelector('#water');
  if (water) water.setAttribute('opacity', waterOpacity(state));
}

