/**
 * 슬라이드 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng, clamp } from './geometry.js';

export const NODES = [
  '#glass', '#glass-shade', '#smear', '#spill', '#coverslip', '#bubbles', '#label',
];

/**
 * 확대 뷰가 끌고 다니는 덮개 유리 조각에 쓸 색.
 * UI 쪽에서 색을 새로 고르면 같은 물건이 두 화면에서 다른 색이 된다 — 여기서 한 번만 정한다.
 */
export const COVERSLIP_FILL = PALETTE.glass[0];
export const COVERSLIP_INK = INK;

/**
 * 확대 뷰의 스포이트에 담긴 시약 색. 시약병·시야와 같은 색을 쓴다.
 * 물은 무색이라 유리 음영색으로 둔다 — 관 안이 비어 보이지 않을 만큼만.
 */
export const REAGENT_TINT = {
  // 스포이트 관에 담긴 액도 병과 같은 색이어야 한다 — 옮겨 담았는데 색이 변하면
  // 학생은 다른 것을 담은 줄 안다 (zoom.js 가 이 표를 읽는다).
  WATER: EXP_PALETTE.water[0], IKI: PALETTE.iodine[0], SUDAN3: PALETTE.sudan[0],
};

/**
 * 확대 뷰의 손도구(핀셋 · 스포이트 관) 색.
 *
 * `INK` 는 어두운 잉크라 실험대 위(밝은 애셋 안)에서는 잘 보이지만,
 * 확대 뷰의 빈 바탕에 홀로 그리면 다크 모드에서 배경에 묻힌다.
 * 금속색을 쓰면 두 테마에서 모두 읽힌다 — 실제로도 핀셋은 금속이다.
 */
export const TOOL_METAL = PALETTE.metal[0];
export const TOOL_METAL_SHADE = PALETTE.metal[1];
export const RUBBER = PALETTE.rubber[0];

/**
 * 시료 및 시약 반응에 따른 도말(smear) 채움 색상을 결정합니다.
 */
export function smearFill(state = {}) {
  // 시료를 바르지 않았을 때의 색은 쓰이지 않는다 (불투명도가 0 이다).
  if (!state.sample) return PALETTE.flesh[1];
  const stain = state.stain;
  const reaction = state.reaction ?? (stain ? 1 : 0);

  // 시약을 안 쓴 (가) 대조군. 밝은 flesh[0] 은 받침 유리 색(glass[0])과 거의 같아
  // 발렸는지 안 발렸는지 화면에서 구분되지 않는다. 실제로도 옅지만 보이기는 해야 한다.
  if (!stain) return PALETTE.flesh[1];

  if (stain === 'IKI' || stain === 'iodine') {
    if (reaction >= 0.7) return PALETTE.stainStarch[0];
    if (reaction >= 0.3) return PALETTE.stainStarchPale[0];
    return PALETTE.iodine[0];
  }

  if (stain === 'SUDAN3' || stain === 'sudan') {
    if (reaction >= 0.7) return PALETTE.stainLipid[0];
    if (reaction >= 0.3) return PALETTE.stainLipidPale[0];
    return PALETTE.sudan[0];
  }

  return PALETTE.flesh[0];
}

/**
 * 시료 유무 및 두께에 따른 도말 불투명도
 */
export function smearOpacity(state = {}) {
  if (!state.sample) return '0';
  const thickness = typeof state.sample === 'object' && state.sample.thickness !== undefined
    ? state.sample.thickness
    : 0.5;
  // 얇게 발라도 발린 것은 보여야 한다. 두께 차이는 여전히 남는다 (0.60 ~ 0.96).
  return clamp(0.55 + thickness * 0.45, 0.5, 1).toFixed(2);
}

/**
 * 흘러넘친 액.
 *
 * 앞서는 "액이 받침 유리 밖으로 흘러넘쳤습니다" 라는 **말만** 있었다. 열여섯 방울을 떨어뜨려도
 * 그림은 두 방울 때와 똑같아서, 학생 눈에는 아무 일도 일어나지 않은 것과 같았다.
 * 결과로 답한다는 것은 화면이 달라진다는 뜻이다.
 *
 * `excess` 는 파생값이다 (`src/sim/state.js`) — 세 방울부터 생기고 다섯 방울에서 1이 된다.
 */
export function spillOpacity(state = {}) {
  const e = clamp(state.excess ?? 0, 0, 1);
  if (e <= 0) return '0';
  return clamp(0.35 + e * 0.55, 0, 1).toFixed(2);
}

/** 넘친 액의 색. 검출 용액을 넣었으면 그 색으로, 물뿐이면 유리색으로 고인다. */
export function spillFill(state = {}) {
  const stain = state.stain;
  const reaction = state.reaction ?? (stain ? 1 : 0);
  if (stain === 'IKI' || stain === 'iodine') {
    return reaction >= 0.7 ? PALETTE.stainStarchPale[0] : PALETTE.iodine[0];
  }
  if (stain === 'SUDAN3' || stain === 'sudan') {
    return reaction >= 0.7 ? PALETTE.stainLipidPale[0] : PALETTE.sudan[0];
  }
  // 물만 넘쳤으면 물빛이다. 유리색으로 두면 넘친 것이 안 보인다.
  return EXP_PALETTE.water[0];
}

/**
 * 덮개유리 불투명도
 */
export function coverslipOpacity(state = {}) {
  if (!state.coverslip) return '0';
  if (typeof state.coverslip === 'object' && state.coverslip.opacity !== undefined) {
    return clamp(state.coverslip.opacity, 0, 1).toFixed(2);
  }
  return '1';
}

/**
 * 덮개유리 변형 (각도/위치)
 */
export function coverslipTransform(state = {}) {
  if (typeof state.coverslip === 'object' && state.coverslip.transform) {
    return state.coverslip.transform;
  }
  return '';
}

/**
 * 기포 도형들 생성
 */
export function bubbleShapes(count = 0, seed = 1234) {
  if (!count || count <= 0) return '';
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const cx = 180 + r() * 40;
    const cy = 130 + r() * 40;
    const rad = 3 + r() * 4.5;
    out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`;
  }
  return out;
}

/**
 * 슬라이드 SVG 문자열 렌더링
 *
 * @param {{sample?: object|null, stain?: string|null, reaction?: number, coverslip?: boolean|object, bubbles?: number, seed?: number}} state
 */
export function render(state = {}) {
  const sFill = smearFill(state);
  const sOpacity = smearOpacity(state);
  const spFill = spillFill(state);
  const spOpacity = spillOpacity(state);
  const csOpacity = coverslipOpacity(state);
  const csTransform = coverslipTransform(state);
  const bubblesHtml = bubbleShapes(state.bubbles, state.seed);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="slide">
  <!-- 접지 그림자 -->
  <rect x="64" y="112" width="280" height="90" rx="8" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 슬라이드 유리 본체 -->
  <rect id="glass" x="60" y="105" width="280" height="90" rx="6" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 슬라이드 유리 우하단 음영 (광원 좌상단 45°) -->
  <path id="glass-shade" d="M 66,192 L 334,192 A 3,3 0 0 0 337,189 L 337,115 L 331,121 L 331,186 L 72,186 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 라벨 부위 (좌측 젖빛 유리 영역) -->
  <rect x="63" y="108" width="45" height="84" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <line x1="108" y1="105" x2="108" y2="195" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <g id="label"></g>

  <!-- 시료 도말 (중앙) -->
  <path id="smear" d="M 180,140 C 168,145 165,155 175,162 C 185,168 215,166 228,158 C 238,150 232,138 218,136 C 202,134 190,136 180,140 Z" fill="${sFill}" fill-opacity="${sOpacity}"/>

  <!-- 흘러넘친 액. 덮개 유리 밖으로 번져 받침 유리 앞 모서리까지 닿고, 아래로 한 방울 맺힌다.
       **유리 밖으로 크게 흘리지 않는다.** 그림이 프레임 아래까지 자라면 그려진 범위가
       그만큼 넓어지고, 실험대에서 이 물건이 잡히는 영역과 이름표 자리가 함께 내려간다
       (contract.js 의 CONTENT_BOX.slide · scripts/check-bench.mjs 가 이 어긋남을 잡는다).
       넘쳤다는 것은 크기가 아니라 **덮개 유리 밖까지 색이 번졌다는 것**으로 말한다. -->
  <g id="spill" opacity="${spOpacity}">
    <path d="M 118,152 C 112,126 148,110 200,108 C 254,106 296,120 300,150 C 304,178 268,196 226,199 C 226,205 214,208 206,203 C 200,200 194,199 188,198 C 146,196 124,178 118,152 Z" fill="${spFill}" fill-opacity="0.55"/>
    <ellipse cx="214" cy="201" rx="7" ry="6" fill="${spFill}" fill-opacity="0.65"/>
  </g>

  <!-- 덮개유리 (커버글라스)
       유리는 비쳐야 한다. 불투명하게 두면 덮는 순간 시료가 통째로 사라져,
       덮은 뒤에 일어나는 일(색 변화, 가장자리로 새는 용액)이 화면에서 보이지 않는다. -->
  <g id="coverslip" opacity="${csOpacity}" transform="${csTransform}">
    <rect x="170" y="120" width="60" height="60" rx="2" fill="${PALETTE.glass[0]}" fill-opacity="0.3" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 172,178 L 228,178 A 2,2 0 0 0 230,176 L 230,122 L 226,126 L 226,174 L 176,174 Z" fill="${PALETTE.glass[1]}" fill-opacity="0.55"/>
  </g>

  <!-- 기포 -->
  <g id="bubbles">${bubblesHtml}</g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const smear = root.querySelector('#smear');
  smear.setAttribute('fill', smearFill(state));
  smear.setAttribute('fill-opacity', smearOpacity(state));

  const spill = root.querySelector('#spill');
  spill.setAttribute('opacity', spillOpacity(state));
  // 계약상 #spill 은 opacity 만 바꾼다. 색은 안쪽 도형이 갖고 있으므로 함께 손본다 —
  // 반응이 진행되면 넘친 액의 색도 따라 변한다.
  const spFill = spillFill(state);
  spill.querySelectorAll('[fill]').forEach((el) => el.setAttribute('fill', spFill));

  const cs = root.querySelector('#coverslip');
  cs.setAttribute('opacity', coverslipOpacity(state));
  const csTransform = coverslipTransform(state);
  if (csTransform) {
    cs.setAttribute('transform', csTransform);
  }

  const bubbles = root.querySelector('#bubbles');
  bubbles.innerHTML = bubbleShapes(state.bubbles, state.seed);
}
