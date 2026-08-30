/**
 * 해부칼(blade) 애셋 — 라인 + 플랫 구현.
 *
 * 비늘잎에 5×5 mm 칼집을 내는 데 쓴다. 칼집이 없으면 표피가 통째로 찢겨
 * 두껍게 벗겨진다 (`docs/04-interaction-rules.md` R-03).
 *
 * 상태가 없다. 칼은 쓰든 안 쓰든 같은 모양이고, 칼집이 났는지는 비늘잎이 갖고 있다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#handle', '#handle-shade', '#blade', '#blade-shade'];

/** 해부칼 SVG 문자열 렌더링. */
export function render() {
  // 그림 전체를 프레임 아래쪽으로 내려 둔다.
  //
  // 애셋은 **프레임 아래가 바닥에 닿는 것으로** 배치된다 (src/ui/bench.js).
  // 칼을 프레임 한가운데 그려 두면 선반 위에서 허공에 떠 보이는데, 그림만 보면 멀쩡해서
  // 아무도 눈치채지 못한다. 실제로 그렇게 떠 있었다.
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="blade">
  <g transform="translate(0,78)">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="196" rx="128" ry="10" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 손잡이 -->
  <path id="handle" d="M 78,132 L 214,126 C 220,126 224,130 224,136 L 224,152 C 224,158 220,162 214,162 L 78,156 C 72,156 68,152 68,146 L 68,142 C 68,136 72,132 78,132 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <path id="handle-shade" d="M 78,150 L 214,156 C 219,156 222,153 222,149 L 222,144 L 216,148 L 216,150 L 78,144 Z" fill="${PALETTE.bodyDark[1]}"/>

  <!-- 손잡이 미끄럼 방지 홈 -->
  <line x1="96" y1="136" x2="96" y2="153" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="108" y1="136" x2="108" y2="153" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="120" y1="136" x2="120" y2="154" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="132" y1="135" x2="132" y2="154" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 날. 끝이 위로 살짝 휘어 있다 -->
  <path id="blade" d="M 224,132 L 300,128 C 322,127 338,132 340,140 C 342,148 328,155 306,157 L 224,156 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <path id="blade-shade" d="M 224,150 L 306,151 C 324,150 336,146 339,141 C 338,150 324,155 306,157 L 224,156 Z" fill="${PALETTE.metal[1]}"/>

  <!-- 날 등의 능선 -->
  <path d="M 230,137 L 302,133" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 손잡이와 날의 이음매 -->
  <rect x="218" y="126" width="10" height="36" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/** 상태가 없으므로 바꿀 것도 없다. 계약을 맞추기 위해 둔다. */
export function applyState() {}
