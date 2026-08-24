/**
 * 덮개 유리 통(상자) 애셋 — 라인 + 플랫 자리표시 그림.
 *
 * 낱장 덮개 유리는 22 mm 라 실험대에서 12 px 남짓으로 그려진다. 세 장을 늘어놓아 봐야
 * 무엇인지 알아볼 수 없어서, 통 하나에서 꺼내 쓰는 것으로 바꿨다 — 실제 실험실도 그렇다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 따른다.
 * 그림 자체는 자리표시다. 다시 그릴 때는 tasks/T17-PROMPT.md 를 읽을 것.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#box', '#box-shade', '#stack'];

/**
 * 덮개 유리 통 SVG 문자열 렌더링.
 *
 * 상태를 받지 않는다 — 덮개 유리는 통에서 얼마든지 꺼내 쓴다.
 * 한 번 쓴 것은 쓰레기통으로 가지 이 통으로 돌아오지 않으므로 남은 장수를 셀 이유도 없다.
 */
export function render() {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="coverbox">
  <!-- 접지 그림자 -->
  <polygon points="86,222 256,222 300,188 130,188" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 통에서 꺼내 쓰는 덮개 유리 묶음. 통 안쪽에 비스듬히 쌓여 있다. -->
  <g id="stack">
    <polygon points="128,126 208,126 240,104 160,104" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="126,116 206,116 238,94 158,94" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="124,106 204,106 236,84 156,84" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 묶음의 우하단 두께면 -->
    <polygon points="204,106 236,84 238,94 206,116" fill="${PALETTE.glass[1]}"/>
  </g>

  <!-- 통 본체 -->
  <g id="box">
    <!-- 윗면 (열려 있다) -->
    <polygon points="96,140 246,140 290,106 140,106" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 안쪽 트임 -->
    <polygon points="116,134 232,134 268,112 152,112" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 앞면 -->
    <polygon points="96,140 246,140 246,206 96,206" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 오른쪽 면 -->
    <polygon points="246,140 290,106 290,172 246,206" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 앞면 이름표 -->
    <rect x="112" y="158" width="118" height="30" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <text x="171" y="178" font-size="15" font-weight="bold" text-anchor="middle" fill="${INK}">덮개 유리</text>
  </g>

  <!-- 우하단 음영 — 광원이 좌상단 45°이므로 오른쪽 면과 앞면 아래가 그늘이다 -->
  <path id="box-shade" d="M 246,140 L 290,106 L 290,172 L 246,206 Z" fill="${PALETTE.bodyDark[1]}"/>
</svg>`;
}

/** 상태가 없으므로 갱신할 것도 없다. 계약상 두 함수를 모두 내보낸다. */
export function applyState() {}
