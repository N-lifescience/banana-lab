/**
 * 현미경(microscope) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { clamp } from './geometry.js';

export const NODES = [
  '#base', '#arm', '#stage', '#stage-slot', '#clip-left', '#clip-right',
  '#nosepiece', '#objective-4', '#objective-10', '#objective-40',
  '#tube', '#eyepiece', '#knob-coarse', '#knob-fine', '#lamp', '#diaphragm',
];

/**
 * 대물렌즈 회전 위치 변형 계산
 * 3구 회전판: 활성 렌즈는 수직(0°), 나머지 둘은 좌우(-35°, +35°)
 */
export function objectiveTransform(lensMag, activeMag = 4) {
  const current = activeMag ?? 4;
  if (current === lensMag) {
    return '';
  }
  if (current === 4) {
    return lensMag === 10
      ? 'translate(14, -2) rotate(35 160 126)'
      : 'translate(-14, -2) rotate(-35 160 126)';
  }
  if (current === 10) {
    return lensMag === 40
      ? 'translate(14, -2) rotate(35 160 126)'
      : 'translate(-14, -2) rotate(-35 160 126)';
  }
  // current === 40
  return lensMag === 4
    ? 'translate(-14, -2) rotate(-35 160 126)'
    : 'translate(14, -2) rotate(35 160 126)';
}

/**
 * 조동나사 회전 변형
 */
export function knobCoarseTransform(state = {}) {
  if (typeof state.coarse === 'number') {
    const deg = (state.coarse * 360) % 360;
    return `rotate(${deg.toFixed(1)} 252 205)`;
  }
  return '';
}

/**
 * 미동나사 회전 변형
 */
export function knobFineTransform(state = {}) {
  if (typeof state.fine === 'number') {
    const deg = (state.fine * 360) % 360;
    return `rotate(${deg.toFixed(1)} 252 205)`;
  }
  return '';
}

/**
 * 재물대 상하 변형
 */
export function stageTransform(state = {}) {
  if (typeof state.stageY === 'number') {
    return `translate(0, ${state.stageY.toFixed(1)})`;
  }
  return '';
}

/**
 * 재물대 슬라이드 불투명도
 */
export function stageSlotOpacity(state = {}) {
  return state.stage ? '1' : '0';
}

/**
 * 재물대에 놓인 슬라이드 표본 도형
 */
export function stageSlotContent(stageState) {
  if (!stageState) return '';
  return `<rect x="132" y="176" width="56" height="6" rx="1" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>` +
    `<path d="M 134,181 L 186,181 A 1,1 0 0 0 187,180 L 187,178 L 185,180 L 136,180 Z" fill="${PALETTE.glass[1]}"/>` +
    `<rect x="154" y="177" width="12" height="4" rx="1" fill="${PALETTE.flesh[0]}"/>`;
}

/**
 * 좌측/우측 클립 변형
 */
export function clipLeftTransform(state = {}) {
  return state.clipLeftTransform ?? '';
}

export function clipRightTransform(state = {}) {
  return state.clipRightTransform ?? '';
}

/**
 * 회전판 변형
 */
export function nosepieceTransform(state = {}) {
  return state.nosepieceTransform ?? '';
}

/**
 * 조리개 불투명도 및 변형
 */
export function diaphragmOpacity(state = {}) {
  const d = clamp(state.diaphragm ?? 1, 0, 1);
  return (0.4 + d * 0.6).toFixed(2);
}

export function diaphragmTransform(state = {}) {
  if (typeof state.diaphragm === 'number') {
    const shift = ((1 - clamp(state.diaphragm, 0, 1)) * 8).toFixed(1);
    return `translate(${shift}, 0)`;
  }
  return '';
}

/**
 * 광원 램프 색상 및 불투명도
 */
export function lampFill(state = {}) {
  return state.lamp ? PALETTE.lamp[0] : PALETTE.metal[1];
}

export function lampOpacity(state = {}) {
  return state.lamp ? '1' : '0.4';
}

/**
 * 현미경 SVG 문자열 렌더링
 *
 * @param {{objective?: number, coarse?: number, fine?: number, diaphragm?: number, lamp?: boolean, stage?: string|boolean}} state
 */
export function render(state = {}) {
  const activeObj = state.objective ?? 4;
  const obj4Tf = objectiveTransform(4, activeObj);
  const obj10Tf = objectiveTransform(10, activeObj);
  const obj40Tf = objectiveTransform(40, activeObj);

  const cKnobTf = knobCoarseTransform(state);
  const fKnobTf = knobFineTransform(state);
  const sTf = stageTransform(state);
  const sOpacity = stageSlotOpacity(state);
  const sContent = stageSlotContent(state.stage);

  const clTf = clipLeftTransform(state);
  const crTf = clipRightTransform(state);
  const npTf = nosepieceTransform(state);

  const dOpacity = diaphragmOpacity(state);
  const dTf = diaphragmTransform(state);
  const lFill = lampFill(state);
  const lOpacity = lampOpacity(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="microscope">
  <!-- 접지 그림자 -->
  <ellipse cx="195" cy="275" rx="105" ry="14" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 받침대 (기저부) 본체 및 음영 -->
  <g id="base">
    <path d="M 90,268 C 90,252 110,248 135,248 L 265,248 C 280,248 290,254 290,268 L 285,272 L 95,272 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 받침대 우하단 음영 (광원 좌상단 45°) -->
    <path d="M 190,272 L 285,272 L 290,268 C 290,256 282,250 270,250 L 265,254 C 275,254 280,258 280,266 L 190,266 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 광원 램프 기구부 -->
  <path d="M 146,242 L 174,242 L 170,256 L 150,256 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <!-- 광원 램프 조리개/렌즈창 -->
  <ellipse id="lamp" cx="160" cy="242" rx="12" ry="4" fill="${lFill}" opacity="${lOpacity}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <!-- 손잡이 / 기둥(Arm) -->
  <g id="arm">
    <path d="M 228,248 L 265,248 C 275,248 280,225 278,160 C 276,115 255,80 200,80 L 195,80 L 195,95 L 205,95 C 240,95 254,120 254,165 C 254,215 248,235 235,238 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 손잡이 우하단 음영 -->
    <path d="M 268,248 L 265,248 C 275,248 280,225 278,160 C 276,125 262,95 230,88 L 235,84 C 270,92 284,120 284,165 C 284,225 276,248 268,248 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 조동나사(coarse knob) -->
  <g id="knob-coarse"${cKnobTf ? ` transform="${cKnobTf}"` : ''}>
    <circle cx="252" cy="205" r="22" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 252,227 A 22,22 0 0,0 274,205 L 268,205 A 16,16 0 0,1 252,221 Z" fill="${PALETTE.bodyDark[1]}"/>
    <line x1="252" y1="184" x2="252" y2="188" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="252" y1="222" x2="252" y2="226" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="231" y1="205" x2="235" y2="205" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="269" y1="205" x2="273" y2="205" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 미동나사(fine knob) -->
  <g id="knob-fine"${fKnobTf ? ` transform="${fKnobTf}"` : ''}>
    <circle cx="252" cy="205" r="12" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 252,217 A 12,12 0 0,0 264,205 L 260,205 A 8,8 0 0,1 252,213 Z" fill="${PALETTE.metal[1]}"/>
    <line x1="252" y1="195" x2="252" y2="201" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 조리개(diaphragm) 및 집광기 -->
  <g id="diaphragm" opacity="${dOpacity}"${dTf ? ` transform="${dTf}"` : ''}>
    <path d="M 148,192 L 172,192 L 168,212 L 152,212 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 166,194 L 170,194 L 167,210 L 163,210 Z" fill="${PALETTE.metal[1]}"/>
    <line x1="150" y1="202" x2="140" y2="202" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <circle cx="140" cy="202" r="3" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 재물대(stage) 그룹 -->
  <g id="stage"${sTf ? ` transform="${sTf}"` : ''}>
    <path d="M 115,182 L 210,182 L 210,192 L 120,192 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 122,190 L 208,190 L 208,184 L 204,186 L 204,188 L 122,188 Z" fill="${PALETTE.bodyDark[1]}"/>
    <ellipse cx="160" cy="182" rx="10" ry="2" fill="${PALETTE.glass[0]}"/>

    <!-- 슬라이드 표본 영역 -->
    <g id="stage-slot" opacity="${sOpacity}">${sContent}</g>

    <!-- 재물대 클립(좌/우) -->
    <path id="clip-left" d="M 125,181 L 142,181 L 140,177 L 125,177 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}${clTf ? ` transform="${clTf}"` : ''}/>
    <path id="clip-right" d="M 178,181 L 195,181 L 195,177 L 180,177 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}${crTf ? ` transform="${crTf}"` : ''}/>
  </g>

  <!-- 경통(body tube) -->
  <g id="tube">
    <path d="M 152,80 L 195,80 L 195,115 L 152,115 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 188,82 L 193,82 L 193,113 L 188,113 Z" fill="${PALETTE.metal[1]}"/>
  </g>

  <!-- 접안렌즈(eyepiece) -->
  <g id="eyepiece">
    <path d="M 160,82 L 175,74 L 148,32 L 133,40 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 168,78 L 173,75 L 147,33 L 142,36 Z" fill="${PALETTE.metal[1]}"/>
    <path d="M 130,42 L 145,34 L 140,26 L 125,34 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <line x1="126" y1="33" x2="139" y2="26" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 회전판(nosepiece) -->
  <g id="nosepiece"${npTf ? ` transform="${npTf}"` : ''}>
    <path d="M 144,115 L 186,115 L 182,126 L 148,126 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 178,116 L 184,116 L 181,125 L 175,125 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 4배 대물렌즈 (빨간색 띠) -->
  <g id="objective-4"${obj4Tf ? ` transform="${obj4Tf}"` : ''}>
    <path d="M 153,126 L 167,126 L 165,146 L 155,146 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 164,127 L 166,127 L 164,145 L 162,145 Z" fill="${PALETTE.metal[1]}"/>
    <rect x="154" y="132" width="12" height="3" fill="${PALETTE.stainLipid[0]}"/>
  </g>

  <!-- 10배 대물렌즈 (노란색 띠) -->
  <g id="objective-10"${obj10Tf ? ` transform="${obj10Tf}"` : ''}>
    <path d="M 153,126 L 167,126 L 165,156 L 155,156 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 164,127 L 166,127 L 164,155 L 162,155 Z" fill="${PALETTE.metal[1]}"/>
    <rect x="154" y="134" width="12" height="3" fill="${PALETTE.lamp[1]}"/>
  </g>

  <!-- 40배 대물렌즈 (파란색 띠) -->
  <g id="objective-40"${obj40Tf ? ` transform="${obj40Tf}"` : ''}>
    <path d="M 153,126 L 167,126 L 165,168 L 155,168 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 164,127 L 166,127 L 164,167 L 162,167 Z" fill="${PALETTE.metal[1]}"/>
    <rect x="154" y="136" width="12" height="3" fill="${PALETTE.stainStarch[0]}"/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const stage = root.querySelector('#stage');
  const sTransform = stageTransform(state);
  if (sTransform) stage.setAttribute('transform', sTransform);
  else stage.removeAttribute('transform');

  const stageSlot = root.querySelector('#stage-slot');
  stageSlot.setAttribute('opacity', stageSlotOpacity(state));
  stageSlot.innerHTML = stageSlotContent(state.stage);

  const clipL = root.querySelector('#clip-left');
  const clTransform = clipLeftTransform(state);
  if (clTransform) clipL.setAttribute('transform', clTransform);
  else clipL.removeAttribute('transform');

  const clipR = root.querySelector('#clip-right');
  const crTransform = clipRightTransform(state);
  if (crTransform) clipR.setAttribute('transform', crTransform);
  else clipR.removeAttribute('transform');

  const nosepiece = root.querySelector('#nosepiece');
  const npTransform = nosepieceTransform(state);
  if (npTransform) nosepiece.setAttribute('transform', npTransform);
  else nosepiece.removeAttribute('transform');

  const activeObj = state.objective ?? 4;
  const obj4 = root.querySelector('#objective-4');
  const obj10 = root.querySelector('#objective-10');
  const obj40 = root.querySelector('#objective-40');
  const tf4 = objectiveTransform(4, activeObj);
  const tf10 = objectiveTransform(10, activeObj);
  const tf40 = objectiveTransform(40, activeObj);

  if (tf4) obj4.setAttribute('transform', tf4);
  else obj4.removeAttribute('transform');

  if (tf10) obj10.setAttribute('transform', tf10);
  else obj10.removeAttribute('transform');

  if (tf40) obj40.setAttribute('transform', tf40);
  else obj40.removeAttribute('transform');

  const knobC = root.querySelector('#knob-coarse');
  const cTransform = knobCoarseTransform(state);
  if (cTransform) knobC.setAttribute('transform', cTransform);
  else knobC.removeAttribute('transform');

  const knobF = root.querySelector('#knob-fine');
  const fTransform = knobFineTransform(state);
  if (fTransform) knobF.setAttribute('transform', fTransform);
  else knobF.removeAttribute('transform');

  const lamp = root.querySelector('#lamp');
  lamp.setAttribute('fill', lampFill(state));
  lamp.setAttribute('opacity', lampOpacity(state));

  const diaphragm = root.querySelector('#diaphragm');
  diaphragm.setAttribute('opacity', diaphragmOpacity(state));
  const dTransform = diaphragmTransform(state);
  if (dTransform) diaphragm.setAttribute('transform', dTransform);
  else diaphragm.removeAttribute('transform');
}
