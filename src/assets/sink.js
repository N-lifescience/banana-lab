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
  <ellipse cx="200" cy="262" rx="146" ry="16" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 개수대 본체 (외벽 · 상판 턱 · 내벽 · 바닥 배수구) -->
  <g id="basin">
    <!-- 개수대 뒷벽 상판 턱 -->
    <polygon points="46,88 354,88 344,72 56,72" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 개수대 외곽 본체 (앞면/옆면 에이프런) -->
    <path d="M 44,98 L 62,252 C 63,256 68,260 74,260 L 326,260 C 332,260 337,256 338,252 L 356,98 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 상판 테두리 림 플랜지 -->
    <rect x="40" y="88" width="320" height="12" rx="4" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 싱크볼 내부 개구부 (안쪽 깊이감) -->
    <polygon points="62,100 338,100 324,118 76,118" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 안쪽 바닥면 -->
    <polygon points="76,118 324,118 308,224 92,224" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 싱크볼 안쪽 경계 디테일 선 -->
    <line x1="62" y1="100" x2="76" y2="118" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="338" y1="100" x2="324" y2="118" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="76" y1="224" x2="92" y2="224" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="324" y1="224" x2="308" y2="224" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 스테인리스 바닥 배수 경사선 (드레인 피치 라인) -->
    <line x1="76" y1="118" x2="200" y2="188" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="324" y1="118" x2="200" y2="188" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="224" x2="200" y2="188" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="308" y1="224" x2="200" y2="188" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 배수구 (Drain) -->
    <ellipse cx="200" cy="188" rx="26" ry="10" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="189" rx="20" ry="7.5" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 배수 거름망 (Strainer plate) -->
    <ellipse cx="200" cy="188" rx="15" ry="5.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="187" y1="188" x2="213" y2="188" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="183.5" x2="200" y2="192.5" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="194" cy="187" r="1" fill="${PALETTE.bodyDark[1]}"/>
    <circle cx="206" cy="187" r="1" fill="${PALETTE.bodyDark[1]}"/>
    <circle cx="197" cy="189.5" r="1" fill="${PALETTE.bodyDark[1]}"/>
    <circle cx="203" cy="189.5" r="1" fill="${PALETTE.bodyDark[1]}"/>

    <!-- 넘침 방지 구멍 (Overflow) -->
    <ellipse cx="200" cy="108" rx="7" ry="3.5" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="105.5" x2="200" y2="110.5" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 수도꼭지 (구스넥 수전 + 밸브 레버) -->
  <g id="faucet">
    <!-- 수전 기둥 밑둥 플랜지 -->
    <ellipse cx="148" cy="74" rx="14" ry="5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="139" y="58" width="18" height="16" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 밸브 핸들 (좌측 수평 레버) -->
    <rect x="110" y="60" width="30" height="8" rx="3" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <circle cx="112" cy="64" r="4" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 구스넥 곡관 파이프 (좌측 기둥에서 솟아 중앙 위로 굽어 내려오는 형태) -->
    <path d="M 141,58 L 141,34 C 141,18 160,14 180,14 C 198,14 207,24 207,46 L 207,72 L 193,72 L 193,46 C 193,30 188,24 180,24 C 168,24 155,28 155,38 L 155,58 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 파이프 우측 음영 디테일 -->
    <path d="M 178,14 C 198,14 207,24 207,46 L 207,72 L 201,72 L 201,46 C 201,28 194,20 178,20 Z" fill="${PALETTE.metal[1]}"/>

    <!-- 토수구 노즐 (Aerator spout) -->
    <rect x="190" y="70" width="20" height="10" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="80" rx="8" ry="2.5" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 물줄기 (잠겨 있으면 opacity=0) -->
  <g id="water" opacity="${wOpacity}">
    <!-- 낙수 물줄기 -->
    <path d="M 196,80 L 195,184 C 195,188 205,188 205,184 L 204,80 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 배수구 수면 파문 및 물방울 -->
    <ellipse cx="200" cy="188" rx="22" ry="8" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="188" rx="14" ry="5" fill="${PALETTE.glass[1]}"/>
    <circle cx="188" cy="178" r="2" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="212" cy="180" r="1.5" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <g id="basin-shade">
    <path d="M 200,260 L 326,260 C 332,260 337,256 338,252 L 356,98 L 344,98 L 328,248 C 327,250 324,252 320,252 L 200,252 Z" fill="${PALETTE.metal[1]}"/>
    <polygon points="308,224 324,118 338,100 324,100 308,224" fill="${PALETTE.metal[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const water = root.querySelector('#water');
  if (water) water.setAttribute('opacity', waterOpacity(state));
}

