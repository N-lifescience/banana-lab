/**
 * 무선 CO₂·온도 센서(sensor) 애셋 — 라인 + 플랫 구현.
 *
 * 세로로 선 막대다. 위쪽이 몸체(표시등이 있다), 아래로 가느다란 탐침이 뻗는다.
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 *
 * 이 애셋이 눈으로 말해야 하는 것 둘:
 *   - 켜져 있나 (`#led`)
 *   - 끝이 더러운가 (`#fouling`) — 닦으면 사라지는 것이라 opacity 로만 갈린다
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng } from './geometry.js';

export const NODES = ['#body', '#body-shade', '#probe', '#led', '#fouling'];

/**
 * 표시등 색과 불투명도.
 *
 * 꺼짐을 「색만 어둡게」로 두면 축소했을 때 켜짐과 구별되지 않는다.
 * 색(기본↔음영)과 불투명도를 **함께** 움직여 멀리서도 갈리게 한다.
 */
export function ledLook(state = {}) {
  return state.on
    ? { fill: PALETTE.lamp[0], opacity: '1' }
    : { fill: PALETTE.lamp[1], opacity: '0.3' };
}

/** 탐침 끝에 묻은 콩 부스러기. 닦으면 사라진다. */
export function foulingOpacity(state = {}) {
  return state.fouled ? '1' : '0';
}

/**
 * 부스러기 도형. 시드가 같으면 항상 같은 그림이 나온다 (docs/02-asset-contract.md 결정론).
 * 탐침(x 194~206, y 182~266) 을 살짝 벗어나 붙어야 「묻은 것」으로 읽힌다.
 */
export function foulingMarkup(state = {}) {
  const r = rng(state.seed ?? 7);
  const out = [];
  // 부스러기가 탐침보다 작으면 축소했을 때 흠집으로 보인다. 탐침 폭(12)만 하게 그린다.
  for (let i = 0; i < 6; i++) {
    const cx = (200 + (r() * 2 - 1) * 10).toFixed(1);
    const cy = (214 + r() * 42).toFixed(1);
    const rx = (5.5 + r() * 3.5).toFixed(1);
    const ry = (Number(rx) * 0.78).toFixed(1);
    out.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ` +
      `fill="${EXP_PALETTE.beanSprout[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`
    );
  }
  return out.join('');
}

/**
 * 센서 SVG 문자열 렌더링
 *
 * @param {{on?: boolean, fouled?: boolean, seed?: number}} state
 */
export function render(state = {}) {
  const led = ledLook(state);
  const fouling = foulingOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="sensor">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="270" rx="32" ry="6" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 몸체 -->
  <rect id="body" x="168" y="26" width="64" height="146" rx="12" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 몸체 우하단 음영 (광원 좌상단 45°) -->
  <path id="body-shade" d="M 218,32 L 224,32 C 227,32 229,35 229,38 L 229,158 C 229,163 226,166 221,166 L 178,166 L 184,160 L 219,160 C 221,160 223,158 223,156 L 223,38 Z" fill="${PALETTE.bodyDark[1]}"/>

  <!-- 표시등 자리 -->
  <circle cx="200" cy="52" r="13" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <circle id="led" cx="200" cy="52" r="9" fill="${led.fill}" opacity="${led.opacity}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 표시창 — 숫자를 넣지 않는다. 「읽는 기계」로만 읽히면 된다 -->
  <rect x="178" y="78" width="44" height="32" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <line x1="186" y1="90" x2="214" y2="90" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="186" y1="100" x2="206" y2="100" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 손으로 쥐는 자리 -->
  <line x1="180" y1="130" x2="220" y2="130" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="180" y1="140" x2="220" y2="140" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="180" y1="150" x2="220" y2="150" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 몸체와 탐침 사이의 목 -->
  <rect x="186" y="168" width="28" height="16" rx="3" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <!-- 탐침 -->
  <path id="probe" d="M 194,182 L 206,182 L 206,246 L 200,266 L 194,246 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <!-- 탐침 우측 음영 -->
  <path d="M 202,186 L 204,186 L 204,246 L 200,259 L 200,247 L 202,244 Z" fill="${PALETTE.metal[1]}"/>
  <line x1="194" y1="196" x2="206" y2="196" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <line x1="194" y1="208" x2="206" y2="208" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 끝에 묻은 콩 부스러기. 닦으면 사라진다 -->
  <g id="fouling" opacity="${fouling}">${foulingMarkup(state)}</g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 * 계약(contract.js)이 허용한 속성만 건드린다.
 */
export function applyState(root, state = {}) {
  const led = root.querySelector('#led');
  const look = ledLook(state);
  led.setAttribute('fill', look.fill);
  led.setAttribute('opacity', look.opacity);

  root.querySelector('#fouling').setAttribute('opacity', foulingOpacity(state));
}
