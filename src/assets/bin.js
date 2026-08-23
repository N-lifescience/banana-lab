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
  <ellipse cx="200" cy="268" rx="86" ry="14" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 쓰레기통 본체 (몸통 · 뚜껑 · 페달 · 라벨) -->
  <g id="trash">
    <!-- 몸통 외벽 (불투명 다크 바디) -->
    <path d="M 126,90 L 138,252 C 138,256 142,260 148,260 L 252,260 C 258,260 262,256 262,252 L 274,90 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 하단 베이스 림 (금속 테두리) -->
    <rect x="132" y="250" width="136" height="12" rx="3" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 풋 페달 (Foot pedal mechanism) -->
    <rect x="188" y="256" width="24" height="10" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="180" y="263" width="40" height="7" rx="2" fill="${PALETTE.rubber[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="190" y1="264" x2="190" y2="269" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="264" x2="200" y2="269" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="210" y1="264" x2="210" y2="269" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 측면 손잡이 홈 -->
    <rect x="125" y="130" width="5" height="24" rx="2" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="270" y="130" width="5" height="24" rx="2" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 라벨 (고형 폐기물 식별 표기) -->
    <rect x="154" y="138" width="92" height="58" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="154" y="138" width="92" height="15" fill="${PALETTE.rubber[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <text x="200" y="149" font-size="9" font-weight="bold" text-anchor="middle" fill="${PALETTE.paper[0]}">고형 폐기물</text>
    <text x="200" y="167" font-size="8.5" font-weight="bold" text-anchor="middle" fill="${INK}">SOLID WASTE</text>
    <line x1="162" y1="174" x2="238" y2="174" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <text x="200" y="186" font-size="7.5" text-anchor="middle" fill="${INK}">덮개유리 · 소모품</text>

    <!-- 상단 투입 개구부 (뚜껑 밑 투입구) -->
    <ellipse cx="200" cy="98" rx="54" ry="8" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 뚜껑 본체 (도선형 스테인리스 캡) -->
    <path d="M 124,76 C 124,56 276,56 276,76 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 하단 테두리 림 -->
    <rect x="118" y="74" width="164" height="16" rx="4" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 상단 손잡이 -->
    <path d="M 186,48 C 186,40 214,40 214,48" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="182" y="46" width="36" height="6" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 버린 고형 폐기물 (쓴 덮개 유리 조각들, 비어 있으면 opacity=0) -->
  <g id="trash-fill" opacity="${fOpacity}">
    <!-- 덮개유리 1 -->
    <rect x="168" y="86" width="24" height="24" rx="1.5" transform="rotate(18 180 98)" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 170,108 L 190,108 A 1.5,1.5 0 0 0 191.5,106.5 L 191.5,88 L 188.5,91 L 188.5,105 L 173,105 Z" transform="rotate(18 180 98)" fill="${PALETTE.glass[1]}"/>
    <!-- 덮개유리 2 -->
    <rect x="194" y="88" width="22" height="22" rx="1.5" transform="rotate(-22 205 99)" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 196,108 L 214,108 A 1.5,1.5 0 0 0 215.5,106.5 L 215.5,90 L 212.5,93 L 212.5,105 L 199,105 Z" transform="rotate(-22 205 99)" fill="${PALETTE.glass[1]}"/>
    <!-- 덮개유리 3 -->
    <rect x="182" y="93" width="20" height="20" rx="1.5" transform="rotate(5 192 103)" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <g id="trash-shade">
    <path d="M 200,56 C 248,56 276,64 276,76 L 276,90 L 200,90 Z" fill="${PALETTE.metal[1]}"/>
    <path d="M 200,90 L 274,90 L 262,252 C 262,256 258,260 252,260 L 200,260 L 200,248 C 238,248 248,244 248,238 L 258,98 L 200,98 Z" fill="${PALETTE.bodyDark[1]}"/>
    <rect x="200" y="250" width="68" height="12" fill="${PALETTE.metal[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const fill = root.querySelector('#trash-fill');
  if (fill) fill.setAttribute('opacity', fillOpacity(state));
}

