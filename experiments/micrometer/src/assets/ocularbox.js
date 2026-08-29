/**
 * 접안 마이크로미터 통(ocularbox) 애셋 — 라인 + 플랫 구현.
 *
 * 지름 20 mm 리클(접안 마이크로미터 원판)을 담아 두는, 지름 55 mm 짜리 작고 납작한
 * 플라스틱 통. 뚜껑을 돌려 여닫고, 열면 안에 원판이 놓여 있는 것이 보인다.
 *
 * **원판이 아니라 통으로 읽혀야 한다.** 앞서는 `ocular` 애셋에 `inCase` 상태를 켜서
 * 통을 대신했는데, 원판 둘레에 테두리 한 겹이 더 그려질 뿐이라 실험대에서는
 * 「통에 든 자」가 아니라 「테가 굵은 유리」로 보였다. 통이라고 말하는 것은 색이 아니라
 * **선**이다 — 벽 두께가 보이는 림, 뚜껑 옆면의 손잡이 결, 자리 홈, 바닥선.
 * 그래서 원판은 통 안쪽 깊숙이 작게 두고(실제 비율도 그렇다) 통의 구조를 크게 그린다.
 *
 * 상태 둘 (`open` · `empty`) 이 서로 다른 것을 말한다 —
 * 뚜껑이 열렸는가, 그리고 안에 원판이 있는가. 넷 다 성립한다.
 * 닫힌 뚜껑(`#lid`)은 맨 뒤에 그려 통 속을 통째로 덮고, 젖혀진 뚜껑(`#lid-open`)은
 * 몸통보다 **앞서** 그려 뒤쪽에 서 있게 한다. 둘은 언제나 반대로 켜진다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#case', '#case-shade', '#lid', '#lid-open', '#disc'];

/** 뚜껑을 덮었는가. 닫힌 뚜껑과 젖혀진 뚜껑은 언제나 반대로 켜진다. */
export function lidOpacity(state = {}) {
  return state.open ? '0' : '1';
}

export function openLidOpacity(state = {}) {
  return state.open ? '1' : '0';
}

/**
 * 안에 원판이 있는가.
 *
 * 접안렌즈에 끼워져 있는 동안에는 통이 비어 있다 — 그 사실이 실험대에서 보여야
 * 「지금 자는 렌즈 안에 있다」 는 이 실험의 중심 구분이 화면에도 남는다.
 */
export function discOpacity(state = {}) {
  return state.empty ? '0' : '1';
}

/**
 * 접안 마이크로미터 통 SVG 문자열 렌더링
 *
 * @param {{open?: boolean, empty?: boolean}} state
 */
export function render(state = {}) {
  const lid = lidOpacity(state);
  const lidOpen = openLidOpacity(state);
  const disc = discOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="ocularbox">
  <!-- 접지 그림자. 통 바닥보다 우하단으로 조금 밀려 나와 있다 (광원 좌상단 45°) -->
  <ellipse cx="212" cy="202" rx="118" ry="52" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 젖혀 놓은 뚜껑. 몸통보다 먼저 그려서 아래쪽이 통 뒤로 가려진다 -->
  <g id="lid-open" opacity="${lidOpen}">
    <ellipse cx="200" cy="74" rx="110" ry="32" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 안쪽 면 -->
    <ellipse cx="200" cy="77" rx="92" ry="22" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 통 몸통 -->
  <g id="case">
    <!-- 옆벽. 위아래 두 타원 사이의 띠 — 이 띠가 「높이가 있는 통」이라고 말한다 -->
    <path d="M 82,150 L 82,196 A 118,52 0 0 0 318,196 L 318,150 A 118,52 0 0 1 82,150 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 윗면 -->
    <ellipse cx="200" cy="150" rx="118" ry="52" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 아가리. 윗면보다 한 겹 작아서 그 사이에 **벽 두께**가 남는다 -->
    <ellipse cx="200" cy="152" rx="96" ry="38" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 원판이 앉는 자리 홈. 비었을 때도 여기가 무엇을 담는 통인지 남는다 -->
    <ellipse cx="200" cy="154" rx="72" ry="28" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 바닥 굽 -->
    <path d="M 92,214 A 118,52 0 0 0 308,214" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 통에 든 리클 원판. 통 지름 55 mm 에 원판 20 mm 이므로 안쪽에 작게 앉는다 -->
  <g id="disc" opacity="${disc}">
    <ellipse cx="200" cy="154" rx="52" ry="21" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 우하단 음영 -->
    <path d="M 233.4,137.9 A 52,21 0 0 1 166.6,170.1 L 171.7,167.0 A 44,17 0 0 0 228.3,141.0 Z" fill="${PALETTE.glass[1]}"/>
    <!-- 새겨진 눈금. 실험대 크기에서는 「자가 새겨진 유리」로만 읽히면 된다 -->
    <line x1="162" y1="157" x2="238" y2="157" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="162" y1="157" x2="162" y2="146" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="181" y1="157" x2="181" y2="151" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="157" x2="200" y2="146" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="219" y1="157" x2="219" y2="151" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="238" y1="157" x2="238" y2="146" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <g id="case-shade">
    <!-- 옆벽 오른쪽 절반 -->
    <path d="M 318,150 L 318,196 A 118,52 0 0 1 200,248 L 200,202 A 118,52 0 0 0 318,150 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 윗면 테두리의 우하단 -->
    <path d="M 290.4,116.6 A 118,52 0 0 1 159.6,198.9 L 167.2,187.7 A 96,38 0 0 0 273.5,127.6 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 덮은 뚜껑. 맨 뒤에 그려 통 속을 통째로 덮는다 -->
  <g id="lid" opacity="${lid}">
    <ellipse cx="200" cy="138" rx="124" ry="55" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 옆면 -->
    <path d="M 76,138 L 76,158 A 124,55 0 0 0 324,158 L 324,138 A 124,55 0 0 1 76,138 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 우하단 음영 -->
    <path d="M 324,138 L 324,158 A 124,55 0 0 1 200,213 L 200,193 A 124,55 0 0 0 324,138 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 뚜껑 윗면의 단 -->
    <ellipse cx="200" cy="136" rx="100" ry="44" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 손잡이 결. 돌려 여는 플라스틱 뚜껑이라고 말하는 선이다 -->
    <line x1="140" y1="189" x2="140" y2="203" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="170" y1="194" x2="170" y2="208" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="196" x2="200" y2="210" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="230" y1="194" x2="230" y2="208" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="260" y1="189" x2="260" y2="203" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  root.querySelector('#lid').setAttribute('opacity', lidOpacity(state));
  root.querySelector('#lid-open').setAttribute('opacity', openLidOpacity(state));
  root.querySelector('#disc').setAttribute('opacity', discOpacity(state));
}
