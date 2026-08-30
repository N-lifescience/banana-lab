/**
 * 채혈침(lancet) 애셋 — 라인 + 플랫 구현.
 *
 * 작은 일회용 란셋. 몸통 + 비틀어 뽑는 뚜껑 + 끝.
 *
 * **채혈은 가상이다.** 학생이 실제로 자기 손을 찌르는 활동이 아니다.
 * 그래서 바늘을 길고 날카롭게 그리지 않는다 — 뚜껑을 뽑으면 짧은 금속 끝이
 * 드러나는 정도로만 그린다. 무섭게 그리면 도구가 아니라 위협으로 읽힌다.
 *
 * 상태는 `used` 하나뿐이다. 다 쓰면 뚜껑이 벗겨져(#cap 이 옆에 놓이고)
 * 몸통에 사선 표시(#spent)가 뜬다. 다 쓴 것과 새것이 **한눈에** 갈려야
 * 학생이 쓴 란셋을 다시 집지 않는다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#body', '#body-shade', '#cap', '#tip', '#spent'];

/** 다 쓴 것인가. 숫자로 와도(0/1) 받아 준다. */
export function isUsed(state = {}) {
  return typeof state.used === 'number' ? state.used >= 1 : Boolean(state.used);
}

/** 뚜껑은 뽑히면 옆에 비스듬히 놓인다. 사라지지 않는다 — 어딘가에 두었을 것이기 때문이다. */
export function capTransform(state = {}) {
  return isUsed(state) ? 'translate(34,64) rotate(-14 304 150)' : 'translate(0,0)';
}

/** 뚜껑이 씌워져 있으면 끝이 안 보인다. */
export function tipOpacity(state = {}) {
  return isUsed(state) ? '1' : '0';
}

export function spentOpacity(state = {}) {
  return isUsed(state) ? '1' : '0';
}

export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="lancet">
  <!-- 접지 그림자 -->
  <ellipse cx="188" cy="192" rx="114" ry="10" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 몸통 (플라스틱 배럴 + 목 + 손잡이 홈 + 라벨판) -->
  <g id="body">
    <rect x="62" y="124" width="190" height="52" rx="12" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 목 — 배럴과 끝 사이 -->
    <rect x="250" y="136" width="30" height="28" rx="7" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 손가락 홈 -->
    <line x1="80" y1="134" x2="80" y2="166" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="92" y1="134" x2="92" y2="166" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="104" y1="134" x2="104" y2="166" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 라벨판 -->
    <rect x="124" y="134" width="108" height="32" rx="4" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="136" y1="144" x2="220" y2="144" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="136" y1="152" x2="200" y2="152" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="136" y1="160" x2="212" y2="160" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <g id="body-shade">
    <!-- 배럴 아랫면 -->
    <path d="M 70,166 L 244,166 L 244,170 C 244,173 240,175 236,175 L 78,175 C 73,175 70,172 70,168 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 배럴 오른쪽 끝 -->
    <path d="M 238,126 L 240,126 C 247,126 251,131 251,138 L 251,162 C 251,169 247,174 240,174 L 238,174 C 242,170 243,166 243,160 L 243,140 C 243,134 242,130 238,126 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 목 아랫면 -->
    <path d="M 254,158 L 278,158 L 278,160 C 278,163 276,164 273,164 L 257,164 C 255,164 254,162 254,160 Z" fill="${PALETTE.metal[1]}"/>
  </g>

  <!-- 다 쓴 표시 — 뚜껑을 뽑고 나면 몸통에 사선이 그어진다 -->
  <g id="spent" opacity="${spentOpacity(state)}">
    <polygon points="118,126 140,126 186,174 164,174" fill="${PALETTE.bodyDark[1]}"/>
    <polygon points="152,126 174,126 220,174 198,174" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 끝 — 뚜껑을 뽑아야 드러난다. 짧고 뭉툭하게 그린다 -->
  <g id="tip" opacity="${tipOpacity(state)}">
    <rect x="278" y="143" width="12" height="14" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="288,144 312,150 288,156" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="288,150 312,150 288,156" fill="${PALETTE.metal[1]}"/>
  </g>

  <!-- 비틀어 뽑는 뚜껑 -->
  <g id="cap" transform="${capTransform(state)}">
    <rect x="270" y="126" width="70" height="48" rx="16" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <line x1="292" y1="134" x2="292" y2="166" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="304" y1="132" x2="304" y2="168" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="316" y1="134" x2="316" y2="166" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 뚜껑 우하단 음영 -->
    <path d="M 324,128 L 328,131 C 335,134 338,141 338,150 C 338,159 335,166 328,169 L 324,172 C 329,166 331,159 331,150 C 331,141 329,134 324,128 Z" fill="${PALETTE.metal[1]}"/>
    <path d="M 288,166 L 330,166 L 326,172 C 323,173 320,174 316,174 L 294,174 C 290,174 288,171 288,168 Z" fill="${PALETTE.metal[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const cap = root.querySelector('#cap');
  if (cap) cap.setAttribute('transform', capTransform(state));

  const tip = root.querySelector('#tip');
  if (tip) tip.setAttribute('opacity', tipOpacity(state));

  const spent = root.querySelector('#spent');
  if (spent) spent.setAttribute('opacity', spentOpacity(state));
}
