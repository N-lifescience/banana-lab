/**
 * 항온기(incubator) 애셋 — 라인 + 플랫 구현.
 *
 * 탁상용 소형 항온기. 발효관을 넣어 일정 온도로 유지한다.
 *
 * ── 색이 답을 말하지 않게 한다 ────────────────────────────────────
 * 실험대에 다섯 대(10 · 20 · 30 · 40 · 55 ℃)가 나란히 선다.
 * **다섯 대의 몸통 색이 전부 같다.** 온도를 말하는 것은 `#gauge-text` 하나뿐이다.
 * 뜨거운 것을 붉게, 찬 것을 푸르게 칠하면 학생이 결과 그래프를 보기 전에
 * 색으로 답을 짐작한다 — 그러면 이 실험이 가르치려는 것이 사라진다.
 * 그래서 render({tempC:10}) 과 render({tempC:55}) 의 차이는 **숫자 두 자리뿐**이다.
 * (palette.experiment.js 의 같은 주석 참조)
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#body', '#body-shade', '#door', '#gauge', '#gauge-text'];

/**
 * 눈금판에 뜰 글자. 상태에서 **이것 하나만** 나온다.
 *
 * @param {{tempC?: number}} state
 * @returns {string} 예: '30 ℃'
 */
export function gaugeLabel(state = {}) {
  const t = Number.isFinite(state.tempC) ? state.tempC : 30;
  return `${t} ℃`;
}

/**
 * 항온기 SVG 문자열 렌더링
 *
 * @param {{tempC?: number}} state  tempC 는 10 · 20 · 30 · 40 · 55 중 하나
 */
export function render(state = {}) {
  const label = gaugeLabel(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="incubator">
  <!-- 접지 그림자 — 애셋에서 허용되는 유일한 반투명 요소 -->
  <polygon points="72,266 302,266 336,238 106,238" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 몸통 우측면 = 음영. 광원이 좌상단 45° 이므로 어두운 면은 우하단에 온다 -->
  <polygon id="body-shade" points="298,78 334,46 334,226 298,258" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 몸통(금속 상자) -->
  <g id="body">
    <!-- 윗면 -->
    <polygon points="68,78 298,78 334,46 104,46" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 앞면 -->
    <rect x="68" y="78" width="230" height="180" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 앞면 아래쪽 음영 띠 (우하단) -->
    <rect x="68" y="248" width="230" height="10" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 방열 슬릿 — 조작판 오른쪽. 다섯 대가 전부 같다 -->
    <rect x="254" y="94" width="32" height="7" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="254" y="106" width="32" height="7" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="254" y="118" width="32" height="7" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 전원 표시등. 온도와 무관하게 다섯 대가 같은 색이다 -->
    <circle cx="232" cy="109" r="10" fill="${PALETTE.lamp[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 234,117 A 10,10 0 0 0 240,109" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 받침 다리 -->
    <rect x="84" y="258" width="26" height="8" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="256" y="258" width="26" height="8" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  </g>

  <!-- 온도 눈금판 (테두리 + 표시창). 숫자는 #gauge-text 가 따로 든다 -->
  <g id="gauge">
    <rect x="80" y="84" width="128" height="50" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="88" y="92" width="112" height="34" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 표시창 우측·하단 음영 -->
    <rect x="190" y="92" width="10" height="34" fill="${PALETTE.paper[1]}"/>
    <rect x="88" y="118" width="112" height="8" fill="${PALETTE.paper[1]}"/>
  </g>

  <!-- ★ 온도를 말하는 것은 이 글자 하나뿐이다 -->
  <text id="gauge-text" x="144" y="114" font-size="22" font-weight="bold" text-anchor="middle" fill="${INK}">${label}</text>

  <!-- 유리문 — 안이 보여야 발효관을 넣었다는 것이 눈에 보인다 -->
  <g id="door">
    <!-- 문틀 -->
    <rect x="84" y="146" width="198" height="100" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 유리판 -->
    <rect x="96" y="156" width="156" height="80" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 유리 너머로 보이는 선반 두 단 -->
    <rect x="108" y="182" width="128" height="5" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="108" y="206" width="128" height="5" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 유리 우측·하단 음영 -->
    <rect x="240" y="156" width="12" height="80" fill="${PALETTE.glass[1]}"/>
    <rect x="96" y="224" width="156" height="12" fill="${PALETTE.glass[1]}"/>
    <!-- 손잡이 -->
    <rect x="258" y="172" width="12" height="48" rx="5" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM 에 붙어 있는 SVG 를 상태에 맞게 갱신합니다.
 *
 * 계약상 바뀌는 것은 `#gauge-text` 의 children 하나뿐입니다.
 */
export function applyState(root, state = {}) {
  const text = root.querySelector('#gauge-text');
  if (text) text.textContent = gaugeLabel(state);
}
