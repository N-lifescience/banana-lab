/**
 * 실험대(bench) 애셋 — 라인 + 플랫 구현.
 *
 * 한 사람이 작업하는 실험실 벤치 공간:
 * - `#room`: 천장 격자 및 매입 조명, 서비스 채널 및 콘센트/가스 밸브가 있는 뒷벽
 * - `#shelf`: 상부 시약 선반 (수직 지지 기둥 및 선반 상판, y=65 고정)
 * - `#surface`: 흑색 에폭시 레진 작업면 및 하부 서랍 캐비닛 (작업면 상단 모서리 y=155 고정)
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

    <!-- 2구 전원 콘센트 1 (개수대와 휴지 사이 빈 공간) -->
    <rect x="80" y="135" width="22" height="16" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="86" cy="143" r="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="96" cy="143" r="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 가스/진공 밸브 노즐 (현미경과 폐액통 사이 빈 공간) -->
    <rect x="248" y="136" width="9" height="19" rx="1" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 246,136 L 259,136 L 252.5,129 Z" fill="${PALETTE.rubber[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 2구 전원 콘센트 2 (폐액통과 쓰레기통 사이 빈 공간) -->
    <rect x="312" y="135" width="22" height="16" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="318" cy="143" r="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="328" cy="143" r="3" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 5. 선반 지지 메인 기둥 상단부 (y: 28 ~ 65) -->
    <!-- 좌측 기둥 상단 -->
    <rect x="52" y="28" width="14" height="37" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="62" y="28" width="4" height="37" fill="${PALETTE.metal[1]}"/>
    <!-- 우측 기둥 상단 -->
    <rect x="334" y="28" width="14" height="37" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="344" y="28" width="4" height="37" fill="${PALETTE.metal[1]}"/>
  </g>

  <!-- 상부 시약 선반 (shelf) 본체 (상판 윗면 y=65 고정) -->
  <g id="shelf">
    <!-- 선반 상판 슬래브 (y=65) -->
    <polygon points="10,65 390,65 390,78 10,78" fill="${PALETTE.bench[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 선반 상판 앞면 하단 음영 -->
    <rect x="11" y="73" width="378" height="4" fill="${PALETTE.bench[1]}"/>
    <line x1="10" y1="65" x2="390" y2="65" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 선반 지지 기둥 중간부 (y: 78 ~ 155) -->
    <!-- 좌측 기둥 -->
    <rect x="52" y="78" width="14" height="77" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="62" y="78" width="4" height="77" fill="${PALETTE.metal[1]}"/>
    <line x1="59" y1="82" x2="59" y2="150" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 우측 기둥 -->
    <rect x="334" y="78" width="14" height="77" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="344" y="78" width="4" height="77" fill="${PALETTE.metal[1]}"/>
    <line x1="341" y1="82" x2="341" y2="150" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 선반 지지 삼각 브래킷 -->
    <polygon points="48,78 66,78 52,102" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <polygon points="334,78 352,78 348,102" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
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
    <rect x="0" y="248" width="400" height="12" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 3. 하부 서랍 캐비닛 프레임 (밝은 아이보리 캐비닛) -->
    <rect x="0" y="260" width="400" height="40" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 서랍 3개 구획 -->
    <!-- 서랍 1 (좌측) -->
    <rect x="10" y="264" width="118" height="32" rx="2" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="52" y="268" width="34" height="4" rx="1.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 서랍 2 (중앙) -->
    <rect x="141" y="264" width="118" height="32" rx="2" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="183" y="268" width="34" height="4" rx="1.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 서랍 3 (우측) -->
    <rect x="272" y="264" width="118" height="32" rx="2" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="314" y="268" width="34" height="4" rx="1.5" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 캐비닛 하단 걸레받이 (Toe-kick) -->
    <rect x="0" y="296" width="400" height="4" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 상판 전면 하단 모서리 음영 (surface-shade) -->
  <rect id="surface-shade" x="0" y="255" width="400" height="5" fill="${PALETTE.bodyDark[1]}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(_root, _state = {}) {
  // bench 애셋은 가변 상태가 없습니다.
}

