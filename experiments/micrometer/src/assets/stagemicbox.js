/**
 * 대물 마이크로미터 보관함(stagemicbox) 애셋 — 라인 + 플랫 구현.
 *
 * 대물 마이크로미터(76 × 26 mm 유리판) 한 장을 눕혀 담는 납작한 상자. 긴 변 95 mm.
 * 뚜껑이 있고, 앞면에 무엇이 든 상자인지 적은 라벨이 붙어 있다.
 *
 * **왜 상자가 따로 필요한가.** 대물 마이크로미터는 이 실험에서 유일하게 길이를 이미 아는
 * 기구다. 고배율에서 조동나사를 돌려 금이 가면 잴 기준이 사라지는데, 앞서는 새것을 꺼낼
 * 자리가 표본 상자뿐이었다 — 대물 마이크로미터를 표본 상자에서 꺼내는 그림은 거짓말이다.
 * 제자리가 있어야 「깨졌으면 제자리에서 새것을 꺼낸다」 가 성립한다 (`rules.js` 의 NEW_ITEM).
 *
 * 받침 유리 통(`slidebox.js`)과 같은 각도로 그린다 — 두 상자가 같은 방향으로 놓여 있어야
 * 실험대가 한 세트로 읽힌다. 다른 것은 **뚜껑**과 **한 장만 담는 자리 홈**이다.
 * 뚜껑은 둘로 나뉜다: 덮은 뚜껑(`#lid`)은 맨 뒤에 그려 속을 덮고, 젖힌 뚜껑(`#lid-open`)은
 * 몸통보다 **앞서** 그려 뒤쪽으로 넘어가 있게 한다. 둘은 언제나 반대로 켜진다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#box', '#box-shade', '#lid', '#lid-open', '#slide', '#label'];

/** 뚜껑을 덮었는가. 덮은 뚜껑과 젖힌 뚜껑은 언제나 반대로 켜진다. */
export function lidOpacity(state = {}) {
  return state.open ? '0' : '1';
}

export function openLidOpacity(state = {}) {
  return state.open ? '1' : '0';
}

/**
 * 안에 유리판이 있는가.
 *
 * 재물대에 올라가 있는 동안에는 상자가 비어 있다. 자리 홈(`#well`)은 그대로 남으므로
 * 비어도 「무엇을 담는 상자인지」 는 없어지지 않는다.
 */
export function slideOpacity(state = {}) {
  return state.empty ? '0' : '1';
}

/**
 * 대물 마이크로미터 보관함 SVG 문자열 렌더링
 *
 * @param {{open?: boolean, empty?: boolean}} state
 */
export function render(state = {}) {
  const lid = lidOpacity(state);
  const lidOpen = openLidOpacity(state);
  const slide = slideOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="stagemicbox">
  <!-- 접지 그림자 -->
  <polygon points="78,256 318,256 356,218 116,218" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 젖혀 놓은 뚜껑. 뒤쪽 모서리에 경첩으로 달려 뒤로 넘어가 있다.
       몸통보다 먼저 그려서 아래쪽이 상자 뒤로 가려진다 -->
  <g id="lid-open" opacity="${lidOpen}">
    <!-- 뚜껑 바깥면 -->
    <polygon points="92,108 332,108 350,176 110,176" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 안쪽 면 -->
    <polygon points="104,119 320,119 336,166 120,166" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 우측 음영 -->
    <polygon points="312,108 332,108 350,176 330,176" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 경첩. 뚜껑 아래 모서리에 걸쳐 두고 아래쪽은 상자 테두리가 덮는다 —
         뚜껑이 떨어져 나온 것이 아니라 **뒤로 젖혀진** 것임을 말한다 -->
    <rect x="150" y="169" width="20" height="10" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="282" y="169" width="20" height="10" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 상자 몸통 -->
  <g id="box">
    <!-- 윗면 테두리 -->
    <polygon points="72,214 312,214 350,176 110,176" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 속. 유리판을 꺼내 가도 이 어두운 자리는 남는다 -->
    <polygon points="90,208 294,208 322,180 118,180" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 유리판 한 장이 앉는 자리 홈. 여러 장을 세워 담는 받침 유리 통과 갈리는 지점이다 -->
    <polygon id="well" points="100,205 288,205 310,183 122,183" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 전면 외벽 -->
    <path d="M 72,214 L 312,214 L 312,246 C 312,250 308,252 304,252 L 80,252 C 76,252 72,250 72,246 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 우측면 외벽 -->
    <path d="M 312,214 L 350,176 L 350,208 C 350,212 346,214 342,214 L 312,246 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 전면 하단 베이스 턱 -->
    <line x1="80" y1="245" x2="304" y2="245" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 라벨 바탕 -->
    <rect x="100" y="221" width="176" height="22" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 라벨 글씨 -->
  <g id="label">
    <text x="188" y="231" font-size="12" font-weight="bold" text-anchor="middle" fill="${INK}">대물 마이크로미터</text>
    <text x="188" y="240" font-size="8" text-anchor="middle" fill="${INK}">1 mm 를 100 등분 · 한 칸 0.01 mm</text>
  </g>

  <!-- 담긴 대물 마이크로미터. 가운데 금속 테가 받침 유리와 갈리는 단서다 -->
  <g id="slide" opacity="${slide}">
    <polygon points="102,204 286,204 306,184 122,184" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 유리 두께 (전면·우측) -->
    <polygon points="102,204 286,204 289,207 105,207" fill="${PALETTE.glass[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <polygon points="286,204 306,184 309,187 289,207" fill="${PALETTE.glass[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 좌측 젖빛 라벨 부위 -->
    <polygon points="102,204 134,204 154,184 122,184" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 눈금을 두른 금속 테 -->
    <ellipse cx="200" cy="194" rx="22" ry="8" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <ellipse cx="200" cy="194" rx="15" ry="5" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="189" y1="196" x2="211" y2="196" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="192" y1="196" x2="192" y2="192" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="196" x2="200" y2="192" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="208" y1="196" x2="208" y2="192" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <g id="box-shade">
    <path d="M 312,214 L 350,176 L 350,208 C 350,212 346,214 342,214 L 312,246 Z" fill="${PALETTE.bodyDark[1]}"/>
    <path d="M 72,245 L 312,245 L 312,246 C 312,250 308,252 304,252 L 80,252 C 76,252 72,250 72,246 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 덮은 뚜껑. 맨 뒤에 그려 상자 속을 통째로 덮는다 -->
  <g id="lid" opacity="${lid}">
    <!-- 뚜껑 윗면 -->
    <polygon points="72,204 312,204 350,166 110,166" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 두께 (전면·우측) -->
    <polygon points="72,204 312,204 312,214 72,214" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <polygon points="312,204 350,166 350,176 312,214" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 우하단 음영 -->
    <polygon points="312,204 350,166 350,176 312,214" fill="${PALETTE.bodyDark[1]}"/>
    <polygon points="72,209 312,209 312,214 72,214" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 윗면의 단 -->
    <polygon points="86,197 298,197 322,173 110,173" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 손잡이 턱. 여기를 잡고 연다 -->
    <path d="M 178,214 L 214,214 L 212,220 L 180,220 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  root.querySelector('#lid').setAttribute('opacity', lidOpacity(state));
  root.querySelector('#lid-open').setAttribute('opacity', openLidOpacity(state));
  root.querySelector('#slide').setAttribute('opacity', slideOpacity(state));
}
