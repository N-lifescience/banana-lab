/**
 * 쓰레기통(bin) 애셋 — 라인 + 플랫 구현.
 *
 * 고형 폐기물(쓴 덮개 유리, 소모품 등) 전용 실험실 페달 쓰레기통.
 * 폐액통(waste.js)과 명확히 구별되는 뚜껑 달린 불투명 용기 구조.
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = ['#trash', '#trash-shade', '#trash-fill'];

/** 안에 버린 것이 있는가. 0이면 비어 있다. */
export function fillOpacity(state = {}) {
  return clamp(state.fill ?? 0, 0, 1).toFixed(2);
}

export function render(state = {}) {
  const fOpacity = fillOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="bin">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="265" rx="80" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 쓰레기통 본체 (몸통 · 뚜껑 · 페달 · 라벨) -->
  <g id="trash">
    <!-- 열린 뚜껑 셸 (Hinged lid tilted open to the rear) -->
    <path d="M 142,96 C 140,62 162,38 200,38 C 238,38 260,62 258,96 L 250,97 C 246,68 230,48 200,48 C 170,48 154,68 150,97 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 상단 손잡이 -->
    <path d="M 188,38 C 188,30 212,30 212,38" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="185" y="36" width="30" height="5" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 뚜껑 안쪽 림 -->
    <ellipse cx="200" cy="96" rx="58" ry="9" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 몸통 외벽 (불투명 다크 바디) -->
    <path d="M 136,106 L 146,244 C 146,252 170,257 200,257 C 230,257 254,252 254,244 L 264,106 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 상단 투입 개구부 및 림 (Top rim and open mouth) -->
    <ellipse cx="200" cy="106" rx="64" ry="14" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="106" rx="56" ry="10" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 하단 베이스 림 (금속 테두리) -->
    <path d="M 144,238 L 145,248 C 145,254 170,260 200,260 C 230,260 255,254 255,248 L 256,238 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 풋 페달 (Foot pedal — 금속/다크 톤) -->
    <rect x="191" y="252" width="18" height="8" rx="2" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="182,258 218,258 214,266 186,266" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="192" y1="259" x2="190" y2="265" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="259" x2="200" y2="265" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="208" y1="259" x2="210" y2="265" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 측면 손잡이 홈 -->
    <rect x="134" y="142" width="5" height="22" rx="2" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="261" y="142" width="5" height="22" rx="2" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 라벨 (고형 폐기물 한글 표기) -->
    <rect x="156" y="150" width="88" height="42" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="156" y="150" width="88" height="10" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="156" y1="160" x2="244" y2="160" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <text x="200" y="177" font-size="11" font-weight="bold" text-anchor="middle" fill="${INK}">고형 폐기물</text>
    <line x1="170" y1="184" x2="230" y2="184" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 버린 고형 폐기물 (투입구에 보이는 쓴 덮개 유리 조각들, 비어 있으면 opacity=0) -->
  <g id="trash-fill" opacity="${fOpacity}">
    <!-- 덮개유리 1 (좌측 경사) -->
    <rect x="170" y="94" width="24" height="24" rx="1.5" transform="rotate(-15 182 106)" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 172,116 L 192,116 A 1.5,1.5 0 0 0 193.5,114.5 L 193.5,96 L 190.5,99 L 190.5,113 L 175,113 Z" transform="rotate(-15 182 106)" fill="${PALETTE.glass[1]}"/>
    <!-- 덮개유리 2 (우측 경사) -->
    <rect x="196" y="92" width="22" height="22" rx="1.5" transform="rotate(20 207 103)" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 198,112 L 216,112 A 1.5,1.5 0 0 0 217.5,110.5 L 217.5,94 L 214.5,97 L 214.5,109 L 201,109 Z" transform="rotate(20 207 103)" fill="${PALETTE.glass[1]}"/>
    <!-- 덮개유리 3 (중앙) -->
    <rect x="184" y="98" width="22" height="22" rx="1.5" transform="rotate(4 195 109)" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 186,118 L 204,118 A 1.5,1.5 0 0 0 205.5,116.5 L 205.5,100 L 202.5,103 L 202.5,115 L 189,115 Z" transform="rotate(4 195 109)" fill="${PALETTE.glass[1]}"/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45° — 몸통·뚜껑·베이스 외곽선 안쪽에만 위치) -->
  <g id="trash-shade">
    <!-- 뚜껑 우측 음영 -->
    <path d="M 200,38 C 238,38 260,62 258,96 L 250,97 C 246,68 230,48 200,48 Z" fill="${PALETTE.metal[1]}"/>
    <!-- 몸통 우측 음영 -->
    <path d="M 200,106 C 230,106 264,102 264,106 L 254,244 C 254,252 230,257 200,257 L 200,243 C 224,243 242,238 242,232 L 250,115 C 236,117 218,118 200,118 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 하단 림 우측 음영 -->
    <path d="M 200,238 L 256,238 L 255,248 C 255,254 230,260 200,260 L 200,252 C 224,252 244,246 244,242 L 246,238 L 200,238 Z" fill="${PALETTE.metal[1]}"/>
    <!-- 페달 우측 음영 -->
    <polygon points="200,258 218,258 214,266 200,266" fill="${PALETTE.metal[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const fill = root.querySelector('#trash-fill');
  if (fill) fill.setAttribute('opacity', fillOpacity(state));
}

