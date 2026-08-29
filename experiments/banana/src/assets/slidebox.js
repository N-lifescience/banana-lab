/**
 * 받침 유리 통(slidebox) 애셋 — 라인 + 플랫 구현.
 *
 * 76 × 26 mm 슬라이드글라스를 겹쳐 담아 두는 얕은 상자.
 * 덮개 유리 통(`coverbox.js`)과 같은 사고방식이다 — 받침 유리는 세는 물건이 아니라
 * 통에서 꺼내 쓰는 물건이다. 고배율에서 조동나사를 돌려 금이 갔을 때
 * 여기서 새것을 꺼낸다 (`rules.js` 의 NEW_SLIDE).
 *
 * 뚜껑이 없다. 덮개 유리와 달리 받침 유리는 손이 아니라 통째로 집어 가는 물건이라
 * 열고 닫는 동작이 실험 절차에 없다 — 그림에 없는 동작을 넣으면 눌러 보게 된다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#tray', '#tray-shade', '#stack'];

/** 통에 겹쳐 담긴 받침 유리 넉 장. 위로 갈수록 한 칸씩 올라와 겹친 것이 보인다. */
const SHEETS = 4;
const SHEET_STEP = 10;

function sheet(y0, top) {
  const w = top ? STROKE.detail : STROKE.hair;
  return `
      <g>
        <polygon points="96,${y0} 296,${y0} 334,${y0 - 36} 134,${y0 - 36}" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${w}" ${PATH_ATTRS}/>
        <polygon points="296,${y0} 334,${y0 - 36} 336,${y0 - 33} 298,${y0 + 3}" fill="${PALETTE.glass[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
        <polygon points="96,${y0} 296,${y0} 298,${y0 + 3} 98,${y0 + 3}" fill="${PALETTE.glass[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
      </g>`;
}

/**
 * 받침 유리 통 SVG 문자열 렌더링.
 *
 * 상태를 받지 않는다 — 통은 늘 같은 모습이다. 꺼낸 유리가 몇 장인지 세지 않는 것이
 * 이 통을 놓는 이유다 (석 장을 세다가 막다른 길이 되는 것을 없애려고 놓았다).
 */
export function render() {
  let stack = '';
  for (let i = 0; i < SHEETS; i++) {
    stack += sheet(228 - i * SHEET_STEP, i === SHEETS - 1);
  }

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="slidebox">
  <!-- 접지 그림자 -->
  <polygon points="84,266 324,266 364,224 124,224" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 통 안쪽 바닥 · 뒤쪽 벽 (유리 묶음 뒤의 암부) -->
  <polygon points="80,232 320,232 360,190 120,190" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <!-- 통에 겹쳐 담긴 받침 유리 -->
  <g id="stack">${stack}
  </g>

  <!-- 통 본체 (앞/옆 외벽 · 윗면 테두리 림) -->
  <g id="tray">
    <!-- 윗면 테두리 림 -->
    <polygon points="80,232 320,232 360,190 120,190" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 전면 외벽. 가운데를 파 두어 유리 끝을 손으로 밀어 낼 수 있다 -->
    <path d="M 80,232 L 148,232 C 156,232 158,250 168,250 L 232,250 C 242,250 244,232 252,232 L 320,232 L 320,262 C 320,266 316,268 312,268 L 88,268 C 84,268 80,266 80,262 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 우측면 외벽 -->
    <path d="M 320,232 L 360,190 L 360,220 C 360,224 356,226 352,226 L 320,262 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 전면 홈 안쪽 테두리 -->
    <path d="M 148,232 C 156,232 158,250 168,250 L 232,250 C 242,250 244,232 252,232" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 전면 하단 베이스 턱 -->
    <line x1="88" y1="260" x2="312" y2="260" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <g id="tray-shade">
    <path d="M 320,232 L 360,190 L 360,220 C 360,224 356,226 352,226 L 320,262 Z" fill="${PALETTE.bodyDark[1]}"/>
    <path d="M 80,260 L 320,260 L 320,262 C 320,266 316,268 312,268 L 88,268 C 84,268 80,266 80,262 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>
</svg>`;
}

/** 상태가 없으므로 갱신할 것도 없다. 계약상 두 함수를 모두 내보낸다. */
export function applyState() {}
