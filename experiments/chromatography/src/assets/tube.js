/**
 * 원심관(tube) 애셋 — 라인 + 플랫 구현.
 *
 * 색소를 뽑는 곳이다. 흔들면 섞이고, 두면 층이 갈린다 —
 * 갈리기 전에 뽑으면 아래층의 잎 부스러기가 딸려 온다. 그 사정이 그림에 보여야 한다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = ['#tube', '#tube-shade', '#lower', '#upper', '#cap'];

/** 관 안쪽에서 액이 차지할 수 있는 세로 범위 */
const FLUID = { top: 64, bottom: 254 };

/**
 * 두 층의 자리.
 *
 * 층이 갈리기 전(`settleT` 0)에는 위아래가 한 덩어리로 섞여 있다 — 아래층이 통째로
 * 차오른 것으로 그린다. 갈릴수록 위쪽에 맑은 상층액이 생긴다.
 */
export function layerGeometry(state = {}) {
  const fill = clamp((state.leaf ?? 0) * 0.4 + (state.extract ?? 0) * 0.6, 0, 1);
  const settled = clamp(state.settleT ?? 0, 0, 1);
  const total = (FLUID.bottom - FLUID.top) * fill;
  const top = FLUID.bottom - total;
  // 갈리면 아래층(잎 부스러기)이 바닥으로 가라앉는다. 남은 위쪽이 상층액이다.
  const lowerH = total * (settled ? 0.28 : 1);
  return {
    upper: { y: top.toFixed(1), height: Math.max(0, total - lowerH).toFixed(1) },
    lower: { y: (FLUID.bottom - lowerH).toFixed(1), height: lowerH.toFixed(1) },
  };
}

/**
 * 마개를 연 모습.
  // 뚜껑을 **떼어 멀리 던지지 않는다.** 프레임 밖으로 나가면 CONTENT_BOX(잡는 영역)와
  // 어긋나 실험대에서 옆 물건의 클릭을 가로챈다 — 화면에서는 그것이 안 보인다.
  // 경첩처럼 한쪽을 축으로 들어 올린다.
 */
export function capTransform(state = {}) {
  return state.capped === false ? 'translate(0,-8) rotate(-20 152 24)' : '';
}

/**
 * @param {{leaf?: number, extract?: number, settleT?: number, capped?: boolean}} state
 */
export function render(state = {}) {
  const g = layerGeometry(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="tube">
  <ellipse cx="200" cy="288" rx="56" ry="10" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 관 몸통 — 아래가 원뿔로 좁아지는 원심관. **프레임 높이를 채운다** —
       프레임 가운데에만 그리면 실험대에서 실물보다 훨씬 작게 나온다 -->
  <path id="tube"
        d="M 152,42 L 248,42 L 248,222 L 200,286 L 152,222 Z"
        fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 담긴 것. 관 밖으로 새지 않게 잘라 낸다 -->
  <clipPath id="tube-inside">
    <path d="M 155,45 L 245,45 L 245,221 L 200,281 L 155,221 Z"/>
  </clipPath>
  <g clip-path="url(#tube-inside)">
    <rect id="upper" x="153" y="${g.upper.y}" width="94" height="${g.upper.height}"
          fill="${EXP_PALETTE.pigmentJuice[0]}"/>
    <rect id="lower" x="153" y="${g.lower.y}" width="94" height="${g.lower.height}"
          fill="${EXP_PALETTE.leafFresh[1]}"/>
  </g>

  <!-- 눈금 — 몇 mL 인지는 적지 않는다. 이 실험에서 부피를 숫자로 읽는 자리가 없다 -->
  <g fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}>
    <path d="M 220,86 L 244,86"/>
    <path d="M 220,122 L 244,122"/>
    <path d="M 220,158 L 244,158"/>
    <path d="M 220,194 L 244,194"/>
  </g>

  <!-- 음영은 언제나 우하단 -->
  <path id="tube-shade"
        d="M 238,45 L 245,45 L 245,221 L 200,281 L 190,268 L 226,220 L 238,220 Z"
        fill="${PALETTE.glass[1]}"/>

  <!-- 마개 -->
  <g id="cap" transform="${capTransform(state)}">
    <rect x="146" y="8" width="108" height="36" rx="5"
          fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 242,12 L 250,12 L 250,40 L 242,40 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const g = layerGeometry(state);
  const upper = root.querySelector('#upper');
  upper.setAttribute('y', g.upper.y);
  upper.setAttribute('height', g.upper.height);
  const lower = root.querySelector('#lower');
  lower.setAttribute('y', g.lower.y);
  lower.setAttribute('height', g.lower.height);
  root.querySelector('#cap').setAttribute('transform', capTransform(state));
}
