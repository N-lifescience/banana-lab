/**
 * 시약병(bottle) 애셋 — 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = [
  '#body', '#body-shade', '#liquid', '#cap', '#label', '#label-text',
];

/**
 * 시약 종류에 따른 액체 채움 색상
 */
export function liquidFill(state = {}) {
  const kind = String(state.kind ?? '').toUpperCase();
  // 이 실험의 용액은 전부 무색투명하다. 그래도 색을 주는 이유는, 유리색으로 두면
  // **선반의 병이 그냥 비어 보이기** 때문이다. 무엇이 든 병인지 알 수 없으면 집을 이유도 없다.
  //
  // **포도당 수용액 10 % 와 5 % 는 같은 색이다.** 농도마다 색을 달리하면 학생이
  // 그래프를 보기 전에 병 색으로 답을 짐작한다 (palette.experiment.js 주석 참조).
  if (kind === 'GLUCOSE') return EXP_PALETTE.glucose[0];
  if (kind === 'WATER') return EXP_PALETTE.water[0];
  if (kind === 'YEAST') return EXP_PALETTE.yeast[0];
  if (kind === 'KOH') return EXP_PALETTE.koh[0];
  // 만든 병은 **포도당 수용액과 같은 색**이다. 10 % 와 5 % 도 서로 같다 —
  // 색으로 갈라 두면 학생이 라벨을 안 읽고 색으로 고른다.
  if (kind === 'MIX') return EXP_PALETTE.glucose[0];
  return PALETTE.glass[0];
}

/**
 * 액체 기하학적 수치 (y, height)
 */
export function liquidGeometry(state = {}) {
  const level = clamp(state.level ?? 0, 0, 1);
  const maxHeight = 135;
  const baseY = 258;
  const height = (maxHeight * level).toFixed(1);
  const y = (baseY - maxHeight * level).toFixed(1);
  return { y, height };
}

/**
 * 마개(cap) 열림 변형
 */
export function capTransform(state = {}) {
  if (state.capOpen) {
    return 'translate(55, -28) rotate(22 200 50)';
  }
  return '';
}

/**
 * 라벨 텍스트 생성
 */
export function labelTextContent(kind, state = {}) {
  const k = String(kind ?? '').toUpperCase();
  const big = (t) => `<text x="200" y="162" font-size="11" font-weight="bold" text-anchor="middle" fill="${INK}">${t}</text>`;
  const mid = (t) => `<text x="200" y="180" font-size="9" text-anchor="middle" fill="${INK}">${t}</text>`;
  const small = (t) => `<text x="200" y="197" font-size="8" text-anchor="middle" fill="${INK}">${t}</text>`;

  // **농도를 라벨에 적는다.** 이 실험에서 농도는 안전에 걸리는 값이고(AGENTS.md §2.5),
  // 통제변인이기도 하다. 병을 보고 몇 % 인지 알 수 없으면 통제할 수가 없다.
  const pct = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  if (k === 'GLUCOSE') {
    return big('포도당 수용액') + mid(`${pct(state.pct ?? 10)} %`) + small('C₆H₁₂O₆');
  }
  if (k === 'WATER') {
    return big('증류수') + mid('H₂O') + small('희석·대조군용');
  }
  if (k === 'YEAST') {
    return big('효모액') + mid('건조 효모 6 g') + small('증류수 50 mL');
  }
  if (k === 'KOH') {
    // 농도를 라벨에 적는 것이 **안전에 걸린다.** 40 % 수산화 칼륨은 강한 부식성 물질이다.
    return big('수산화 칼륨') + mid('40 %') + small('KOH · 부식성');
  }
  // 만든 병은 **지금 든 것의 농도**를 말한다. 비어 있으면 비었다고 말한다 —
  // 「0 %」로 적으면 포도당이 0 % 인 용액이 든 것으로 읽힌다.
  if (k === 'MIX') {
    if (state.pct === undefined || state.pct === null) {
      return big('만든 병') + mid('비어 있음') + small('여기서 희석');
    }
    return big('만든 병') + mid(`포도당 ${pct(state.pct)} %`) + small('직접 만든 것');
  }
  return `<text x="200" y="178" font-size="10" text-anchor="middle" fill="${INK}">시약병</text>`;
}

/**
 * 시약병 SVG 문자열 렌더링
 *
 * @param {{kind?: string, level?: number, capOpen?: boolean}} state
 */
export function render(state = {}) {
  const fill = liquidFill(state);
  const { y, height } = liquidGeometry(state);
  const cTransform = capTransform(state);
  const lText = labelTextContent(state.kind, state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="bottle">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="272" rx="68" ry="12" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 시약병 몸통 본체 -->
  <path id="body" d="M 180,65 L 220,65 L 220,80 C 220,95 260,105 260,120 L 260,252 C 260,258 254,264 248,264 L 152,264 C 146,264 140,258 140,252 L 140,120 C 140,105 180,95 180,80 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 병 내부 액체 -->
  <rect id="liquid" x="146" y="${y}" width="108" height="${height}" rx="2" fill="${fill}"/>

  <!-- 병 몸통 우하단 음영 (광원 좌상단 45°) -->
  <path id="body-shade" d="M 215,67 L 218,67 L 218,80 C 218,94 256,104 256,120 L 256,252 C 256,257 251,262 246,262 L 160,262 L 166,256 L 246,256 C 248,256 250,254 250,252 L 250,122 C 250,110 214,98 214,80 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 종이 라벨 -->
  <rect id="label" x="155" y="142" width="90" height="66" rx="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <line x1="155" y1="168" x2="245" y2="168" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <g id="label-text">${lText}</g>

  <!-- 병마개(뚜껑) 그룹 -->
  <g id="cap"${cTransform ? ` transform="${cTransform}"` : ''}>
    <path d="M 174,44 L 226,44 C 228,44 230,46 230,48 L 228,66 L 172,66 L 170,48 C 170,46 172,44 174,44 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 마개 우하단 음영 -->
    <path d="M 205,45 L 225,45 C 227,45 228,46 228,48 L 226,65 L 218,65 L 220,49 L 205,49 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 마개 손잡이 돌기 디테일 -->
    <line x1="184" y1="48" x2="184" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="192" y1="48" x2="192" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="48" x2="200" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="208" y1="48" x2="208" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="216" y1="48" x2="216" y2="62" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(root, state = {}) {
  const liquid = root.querySelector('#liquid');
  const fill = liquidFill(state);
  const { y, height } = liquidGeometry(state);
  liquid.setAttribute('fill', fill);
  liquid.setAttribute('y', y);
  liquid.setAttribute('height', height);

  const cap = root.querySelector('#cap');
  const cTransform = capTransform(state);
  if (cTransform) {
    cap.setAttribute('transform', cTransform);
  } else {
    cap.removeAttribute('transform');
  }

  const labelText = root.querySelector('#label-text');
  labelText.innerHTML = labelTextContent(state.kind, state);
}
