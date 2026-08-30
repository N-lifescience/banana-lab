/**
 * 손상성 폐기물 통(sharpsbin) 애셋 — 라인 + 플랫 구현.
 *
 * 쓴 채혈침을 넣는 통. 뚜껑에 좁은 투입구(#slot)가 있어 **넣을 수는 있어도
 * 꺼낼 수는 없다** — 그것이 이 통이 일반 쓰레기통(bin.js)과 다른 이유이고,
 * 그림에서도 그렇게 보여야 한다. 그래서 뚜껑은 열리지 않고 투입구만 뚫려 있다.
 *
 * #mark 는 실제 의료 폐기물 표지를 베끼지 않는다. 몸통을 두르는 굵은 띠 +
 * 삼각형 경고 도형으로만 알아보게 한다.
 *
 * 색은 공용 팔레트의 기구색(bodyDark · metal · paper · glass)만 쓴다.
 * 노란 통으로 그리고 싶은 유혹이 있지만 `lamp`(#FFDF8A)는 혈장(#EFDC9A)과
 * 가까워서, 실험대에 두면 학생이 결과색을 기구색으로 기억하게 된다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = ['#body', '#body-shade', '#lid', '#slot', '#mark', '#fill'];

/** 안에 버린 것이 있는가. 0이면 비어 있다. */
export function fillOpacity(state = {}) {
  return clamp(state.fill ?? 0, 0, 1).toFixed(2);
}

export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="sharpsbin">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="264" rx="88" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 몸통 (아래로 살짝 좁아지는 통 + 내용물 확인창) -->
  <g id="body">
    <path d="M 128,104 L 272,104 L 262,254 C 262,258 257,260 250,260 L 150,260 C 143,260 138,258 138,254 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 내용물 확인창 -->
    <rect x="174" y="176" width="52" height="70" rx="5" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 가득 참 선 -->
    <line x1="178" y1="192" x2="222" y2="192" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <g id="body-shade">
    <!-- 오른쪽 벽 -->
    <path d="M 250,104 L 272,104 L 262,254 C 262,258 257,260 250,260 L 232,260 C 240,258 242,256 242,251 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 바닥 -->
    <path d="M 139,246 L 261,246 L 262,254 C 262,258 257,260 250,260 L 150,260 C 143,260 138,258 138,254 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 뚜껑 — 열리지 않는다 -->
  <g id="lid">
    <rect x="110" y="68" width="180" height="38" rx="8" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 290,84 L 290,98 C 290,102 286,106 280,106 L 120,106 L 120,98 L 276,98 C 282,98 284,94 284,84 Z" fill="${PALETTE.metal[1]}"/>
  </g>

  <!-- 투입구 — 넣을 수는 있어도 꺼낼 수는 없는 좁은 구멍 -->
  <rect id="slot" x="158" y="78" width="84" height="15" rx="7" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <!-- 날붙이 폐기물 표시 — 굵은 띠 + 삼각형. 실제 표지를 베끼지 않는다 -->
  <g id="mark">
    <path d="M 131,116 L 269,116 L 265,170 L 135,170 Z" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="200,122 224,164 176,164" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="200" y1="136" x2="200" y2="151" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="200" y1="157" x2="200" y2="158" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 띠 아랫면 음영 -->
    <path d="M 135,164 L 265,164 L 265,170 L 135,170 Z" fill="${PALETTE.paper[1]}"/>
  </g>

  <!-- 버려진 채혈침 — 확인창으로 보인다. 비어 있으면 opacity=0 -->
  <g id="fill" opacity="${fillOpacity(state)}">
    <rect x="180" y="208" width="36" height="10" rx="5" transform="rotate(-14 198 213)" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="182" y="222" width="38" height="10" rx="5" transform="rotate(9 201 227)" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="178" y="234" width="34" height="10" rx="5" transform="rotate(-6 195 239)" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="196" y="234" width="26" height="9" rx="4" transform="rotate(16 209 238)" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const fill = root.querySelector('#fill');
  if (fill) fill.setAttribute('opacity', fillOpacity(state));
}
