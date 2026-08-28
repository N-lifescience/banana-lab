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

    <!-- 4. 바닥 — 벽과 바닥이 만나는 모서리. 실험대 옆으로 이 선이 보여야 「방」 이 된다 -->
    <rect x="0" y="226" width="400" height="74" fill="${PALETTE.paper[1]}" ${PATH_ATTRS}/>
    <line x1="0" y1="226" x2="400" y2="226" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!--
      5. **누운 면 둘.** 이 두 사다리꼴이 입체를 만든다.

      선반도 작업면도 「앞에서 본 네모」 였다. 물건은 앞 모서리에 서는데 그 뒤로 아무것도
      없으니 벽에 붙은 띠로 읽혔다. 물건이 **딛고 선 면**을 뒤로 물러나게 그린다.

      누운 면은 서 있는 면보다 **빛을 더 받는다** — 그래서 각 짝의 밝은 쪽을 여기 쓴다.
      뒤로 갈수록 좁아진다(원근). 그라데이션이 아니라 면을 나눈 것이다.

      두 면은 #room 에 둔다 — #shelf·#surface 의 맨 위 y 는 **물건이 서는 선**이고,
      그 계약을 tests/assets.contract.test.js 가 지킨다. 그 위로 뻗는 면을 그 안에 넣으면
      선이 밀려 올라가고, 실험대 위 물건이 **전부 허공에 뜬다.**
    -->
    <!-- 선반이 딛고 선 면 (y=65 앞 모서리 → y=52 뒤) -->
    <polygon points="10,65 390,65 372,52 28,52" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 작업면이 딛고 선 면 (y=155 앞 모서리 → y=134 뒤) -->
    <polygon points="0,155 400,155 380,134 20,134" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  </g>

  <!-- 상부 시약 선반 (shelf) 본체 (상판 윗면 y=65 고정) -->
  <g id="shelf">
    <!--
      선반의 **서 있는 면** — 판의 두께다. 누운 면(#room)보다 한 단 어둡다.
      맨 위 y 는 65 여야 한다. 물건이 여기에 바닥을 대고 선다.
    -->
    <polygon points="10,65 390,65 390,79 10,79" fill="${PALETTE.paper[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!--
      선반이 벽에 드리우는 그늘. **떠 있는 판은 이 그늘로 뜬다** —
      기둥을 걷어냈으므로 이것 말고는 판이 벽에서 떨어져 있다고 말해 줄 것이 없다.
      판보다 좁게 두어 아래로 갈수록 옅어지는 것처럼 보이게 한다.
    -->
    <rect x="30" y="79" width="340" height="7" fill="${PALETTE.bench[1]}" ${PATH_ATTRS}/>
  </g>

  <!-- 실험대 작업면(surface) 본체 (상판 앞 모서리 y=155 고정) -->
  <g id="surface">
    <!--
      1. 상판의 **서 있는 면** — 에폭시 상판의 두께다 (누운 면은 #room 에 있다).
      누운 면보다 어둡다. 이 한 단 차이가 「상판이 앞으로 떨어진다」 를 만든다.
    -->
    <rect x="0" y="155" width="400" height="23" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!--
      2. 상판 아래 몸통. **상판보다 좁다.**

      상판이 좌우로 조금 튀어나오고 그 옆으로 벽이 보인다 — 앞에서 본 네모를 아무리
      칠해도 안 나오는 것이 이것이다. 물러나 보이도록 상판보다 밝고 벽보다 어둡게 둔다.
    -->
    <rect x="40" y="178" width="320" height="70" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!--
      3. 걸레받이 — 몸통보다 **더 안으로** 들어가 있고 가장 어둡다.
      바닥에 닿는 자리가 어두워야 실험대가 바닥에 놓인 것으로 보인다. 떠 보이지 않는다.
    -->
    <rect x="62" y="234" width="276" height="14" fill="${PALETTE.bodyDark[1]}" ${PATH_ATTRS}/>

    <!-- 바닥에 지는 그림자 — 이것이 없으면 실험대가 바닥에 놓인 게 아니라 떠 있다 -->
    <rect x="30" y="248" width="340" height="8" fill="${PALETTE.bench[1]}" ${PATH_ATTRS}/>
  </g>

  <!--
    상판이 몸통에 드리우는 그늘 (surface-shade).

    상판이 앞으로 튀어나와 있으니 그 밑은 그늘진다. 몸통 폭에 맞춰 얹는다 —
    상판 두께면과 이어져 하나의 어두운 덩어리로 읽히고, 그 아래가 물러난다.
  -->
  <rect id="surface-shade" x="40" y="178" width="320" height="10" fill="${PALETTE.bodyDark[1]}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(_root, _state = {}) {
  // bench 애셋은 가변 상태가 없습니다.
}

