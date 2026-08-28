/**
 * 실험대(bench) 애셋 — 라인 + 플랫 구현.
 *
 * 한 사람이 작업하는 실험실 벤치 공간:
 * - `#room`: 천장 격자 및 매입 조명, 서비스 채널이 있는 뒷벽
 * - `#shelf`: 상부 시약 선반 (선반 상판, y=65 고정)
 * - `#surface`: 흑색 에폭시 레진 작업면 및 그 아래 몸통 (작업면 상단 모서리 y=155 고정)
 * - `#surface-shade`: 작업면 전면 모서리 하단 음영
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#surface', '#surface-shade', '#shelf', '#room'];

/**
 * 실험대 SVG 문자열 렌더링
 *
 * @param {object} _state
 */
export function render(_state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="bench">
  <!-- 방 배경 (천장 · 매입 조명 기구 · 뒷벽 · 유틸리티 서비스 채널 · 양측 코너) -->
  <g id="room">
    <!-- 1. 뒷벽 전체 베이스 (밝고 깨끗한 연구실 벽면) -->
    <rect x="0" y="0" width="400" height="300" fill="${PALETTE.bench[0]}"/>

    <!-- 2. 천장 (격자 텍스처 천장 및 조명) -->
    <rect x="0" y="0" width="400" height="28" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 천장 타일 격자 이음매 -->
    <line x1="80" y1="0" x2="80" y2="28" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="160" y1="0" x2="160" y2="28" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="240" y1="0" x2="240" y2="28" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="320" y1="0" x2="320" y2="28" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 천장 하단 몰딩 트림 -->
    <line x1="0" y1="28" x2="400" y2="28" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 3. 천장 매입 조명 기구 2조 (매입형 LED/형광등 슬림 기구) -->
    <!-- 좌측 매입등 -->
    <rect x="90" y="5" width="70" height="17" rx="2" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="94" y="8" width="62" height="11" fill="${PALETTE.paper[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="114" y1="8" x2="114" y2="19" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="135" y1="8" x2="135" y2="19" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 우측 매입등 -->
    <rect x="240" y="5" width="70" height="17" rx="2" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="244" y="8" width="62" height="11" fill="${PALETTE.paper[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="264" y1="8" x2="264" y2="19" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="285" y1="8" x2="285" y2="19" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 4. 뒷벽 유틸리티 서비스 채널 (배선/배관 트렁킹 닥트) -->
    <rect x="0" y="132" width="400" height="23" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <line x1="0" y1="143" x2="400" y2="143" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  </g>

  <!-- 상부 시약 선반 (shelf) 본체 (상판 윗면 y=65 고정) -->
  <g id="shelf">
    <!-- 선반 상판 슬래브 (y=65) -->
    <polygon points="10,65 390,65 390,78 10,78" fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 선반 상판 앞면 하단 음영 -->
    <rect x="11" y="73" width="378" height="4" fill="${PALETTE.bench[1]}"/>
    <line x1="10" y1="65" x2="390" y2="65" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  </g>

  <!-- 실험대 작업면(surface) 본체 (상판 앞 모서리 y=155 고정) -->
  <g id="surface">
    <!-- 1. 에폭시 레진 상판 작업면 (Dark epoxy worktop surface) -->
    <polygon points="0,155 400,155 400,248 0,248" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 상판 뒤쪽 경계 라인 디테일 -->
    <line x1="0" y1="158" x2="400" y2="158" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 상판 중앙 세로 이음매 라인 1개 (타일 격자가 아님) -->
    <line x1="200" y1="155" x2="200" y2="248" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 2. 에폭시 상판 전면 모서리 두께면 (10 mm 두께의 단단한 덩어리감) -->
    <rect x="0" y="248" width="400" height="8" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!--
      3. 작업면 아래 몸통.

      예전에는 여기가 화면에서 **가장 밝은 아이보리**였다. 밝은 것은 앞으로 나와 보이므로
      작업면 아래가 아래로 안 읽히고 평평했다 — 어디가 상판이고 어디가 그 밑인지 모른다.
      상판보다 어두운 한 톤으로 내리고, 상판이 드리우는 그늘 띠를 위에 얹는다.
      그라데이션이 아니라 **색 두 단**이다 (docs/01-art-direction.md).
    -->
    <rect x="0" y="272" width="400" height="28" fill="${PALETTE.bench[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 몸통 하단 걸레받이 (Toe-kick) — 바닥에 닿는 자리는 다시 어둡다 -->
    <rect x="0" y="292" width="400" height="8" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!--
    상판이 드리우는 그늘 (surface-shade) — **이 띠 하나가 「그 밑」 을 만든다.**

    위에서부터 어둡게 → 가장 어둡게 → 물러난 밝기 → 어둡게 로 쌓인다.
    상판 두께면, 그 아래 그늘, 물러난 몸통, 바닥에 닿는 걸레받이.
    그라데이션이 아니라 **색 단**이다 (docs/01-art-direction.md).
  -->
  <rect id="surface-shade" x="0" y="256" width="400" height="16" fill="${PALETTE.bodyDark[1]}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(_root, _state = {}) {
  // bench 애셋은 가변 상태가 없습니다.
}

