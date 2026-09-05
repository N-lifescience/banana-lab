/**
 * 실험대(bench) 애셋 — 라인 + 플랫 구현.
 *
 * 사장님이 주신 참고 이미지(`Lab ref.png`)의 **구조**를 그대로 가져왔다.
 * 그림 자체는 못 쓴다 — 그라데이션이 들어 있고(docs/01), 래스터라 다크 모드에서
 * 색이 안 따라오고, 5 MB 다.
 *
 * 가져온 것 다섯:
 *   ① 벽에 붙은 **유리 시약 선반** — 앞에 난간이 있고 벽 브래킷이 받친다
 *   ② 그 위의 **상부 수납장** (유리문)
 *   ③ **밝은 회색 상판** + 그 아래로 떨어지는 어두운 두께면
 *   ④ 상판보다 좁은 **캐비닛 문**과 세로 이음선
 *   ⑤ 바닥에 닿는 **검은 걸레받이** — 참고 이미지에서 가장 진한 덩어리
 *
 * 구성:
 * - `#room`: 천장·조명·뒷벽·바닥, 그리고 **누운 면 둘**(선반 유리판·작업면 상판)
 * - `#shelf`: 선반의 **서 있는 면**(앞 난간)과 벽 브래킷 (물건이 서는 선 y=65 고정)
 * - `#surface`: 상판 두께면 · 캐비닛 · 걸레받이 (물건이 서는 선 y=155 고정)
 * - `#surface-shade`: 상판이 캐비닛에 드리우는 그늘
 *
 * **누운 면은 왜 `#room` 에 있나.** `#shelf`·`#surface` 의 맨 위 y 가 곧 물건이 서는 선이고
 * (`tests/assets.contract.test.js`), 그 위로 뻗는 면을 그 안에 넣으면 선이 밀려 올라가
 * **실험대 위 물건이 전부 허공에 뜬다.**
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
  <!-- 방 배경 (천장 · 매입 조명 · 뒷벽 · 바닥 · 누운 면 둘) -->
  <g id="room">
    <!-- 1. 뒷벽 -->
    <rect x="0" y="0" width="400" height="300" fill="${PALETTE.bench[0]}"/>

    <!-- 2. 천장 -->
    <rect x="0" y="0" width="400" height="26" fill="${PALETTE.roomLight[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <line x1="80" y1="0" x2="80" y2="26" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="160" y1="0" x2="160" y2="26" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="240" y1="0" x2="240" y2="26" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="320" y1="0" x2="320" y2="26" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="0" y1="26" x2="400" y2="26" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 3. 매입 조명 2조 -->
    <rect x="92" y="4" width="66" height="15" rx="2" fill="${PALETTE.roomLight[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="96" y="7" width="58" height="9" fill="${PALETTE.roomLight[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="242" y="4" width="66" height="15" rx="2" fill="${PALETTE.roomLight[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="246" y="7" width="58" height="9" fill="${PALETTE.roomLight[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!--
      4. 상부 수납장 (유리문) — 참고 이미지의 맨 윗단.

      선반 위 물건보다 **뒤에** 그려진다. 배경이지 물건이 아니다.
    -->
    <rect x="18" y="28" width="364" height="17" fill="${PALETTE.roomLight[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <rect x="25" y="32" width="172" height="9" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="203" y="32" width="172" height="9" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 수납장이 벽에 드리우는 그늘. 선반과 붙어 보이지 않게 사이를 띄운다 -->
    <rect x="26" y="45" width="348" height="3" fill="${PALETTE.bench[1]}"/>

    <!--
      5. **누운 면 둘.** 이 두 사다리꼴이 입체를 만든다.

      앞에서 본 네모만 쌓으면 아무리 칠해도 평평하다. 물건이 **딛고 선 면**을 뒤로
      물러나게 그린다. 누운 면은 서 있는 면보다 **빛을 더 받으므로** 각 짝의 밝은 쪽을 쓴다.
    -->
    <!--
      선반 유리판 (앞 모서리 y=65 → 뒤 y=53).

      **실험대 폭 전체(0~1500 mm)를 덮는다.** 처음에는 10~390(=37.5~1462.5 mm)으로
      좁게 그렸는데, 물건 배치는 0~1500 기준이라 **양 끝 물건이 유리판 밖으로 삐져나갔다.**
      난간과 브래킷이 생기기 전에는 눈에 안 띄던 것이 그때 드러났다 — 여덟 중 둘에서
      양 끝이 17.5 mm 씩 나갔고, 하나는 왼쪽으로 9.4 mm 나갔다.
      물건을 옮기는 대신 **유리판을 실험대에 맞췄다.** 배치는 실험마다 다르고, 선반은 하나다.
    -->
    <polygon points="0,65 400,65 380,53 20,53" fill="${PALETTE.shelfTop[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 아래 선반 유리판 (앞 모서리 y=116 → 뒤 y=105) -->
    <polygon points="0,116 400,116 380,105 20,105" fill="${PALETTE.shelfTop[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 작업면 상판 (앞 모서리 y=172 → 뒤 y=151) -->
    <polygon points="0,172 400,172 380,151 20,151" fill="${PALETTE.benchTop[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 6. 바닥 — 벽과 만나는 모서리. 실험대 옆으로 이 선이 보여야 「방」 이 된다 -->
    <rect x="0" y="252" width="400" height="48" fill="${PALETTE.bench[1]}" ${PATH_ATTRS}/>
    <line x1="0" y1="252" x2="400" y2="252" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  </g>

  <!-- 시약 선반 (물건이 서는 선 y=65 고정) -->
  <g id="shelf">
    <!--
      선반의 **서 있는 면** — 유리판의 두께이자 앞 난간이다. 참고 이미지의 그 난간이
      물건이 굴러 떨어지지 않게 한다. 누운 면보다 한 단 어둡다.
    -->
    <polygon points="0,65 400,65 400,77 0,77" fill="${PALETTE.shelfTop[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <line x1="0" y1="72" x2="400" y2="72" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!--
      **벽 브래킷 셋.** 참고 이미지에서 선반을 받치는 것이 이것이다.
      바닥까지 내려오던 기둥과는 다르다 — 그 기둥은 걷어냈고, 이건 벽에 붙는 작은 받침이다.
      이게 없으면 선반이 무엇에 걸려 있는지 알 수 없어 그냥 떠 보인다.
    -->
    <!--
      **그늘을 먼저, 브래킷을 나중에.** 뒤에 그린 것이 위에 온다 — 순서를 바꾸면
      그늘 띠가 브래킷을 덮어 버리고, 받치는 것이 안 보인 채 선반만 떠 있다.
    -->
    <rect x="20" y="77" width="360" height="6" fill="${PALETTE.bench[1]}" ${PATH_ATTRS}/>
    <polygon points="58,77 78,77 58,93" fill="${PALETTE.roomShade[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="190,77 210,77 190,93" fill="${PALETTE.roomShade[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="322,77 342,77 322,93" fill="${PALETTE.roomShade[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!--
      **아래 선반** — 위 선반과 같은 모양이다(누운 유리판은 #room 에, 여기는 난간·그늘·브래킷).

      선반이 하나뿐일 때는 병이 한 줄에 몰려, 폰 폭에서 물건이 10 px 로 줄자 **잡는 자리가
      서로 포개져 옆 것이 집혔다** — 학생의 실험 조건이 바뀐 채로 시행이 기록된다.
      줄을 갈라 놓으면 그 겹침이 크게 준다. (catalase 가 어느 폭에서나 14쌍이라고 재 왔다)
    -->
    <polygon points="0,116 400,116 400,128 0,128" fill="${PALETTE.shelfTop[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <line x1="0" y1="123" x2="400" y2="123" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="20" y="128" width="360" height="6" fill="${PALETTE.bench[1]}" ${PATH_ATTRS}/>
    <polygon points="58,128 78,128 58,144" fill="${PALETTE.roomShade[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="190,128 210,128 190,144" fill="${PALETTE.roomShade[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <polygon points="322,128 342,128 322,144" fill="${PALETTE.roomShade[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 실험대 몸체 (물건이 서는 선 y=172 고정) -->
  <g id="surface">
    <!--
      1. 상판의 **서 있는 면** — 두께다. 누운 면(#room)보다 한 단 어둡다.
      이 한 단 차이가 「상판이 앞으로 떨어진다」 를 만든다.
    -->
    <rect x="0" y="172" width="400" height="17" fill="${PALETTE.benchTop[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!--
      2. 캐비닛 문. **상판보다 좁다** — 상판이 좌우로 걸쳐 나오고 그 옆으로 벽이 보인다.
      앞에서 본 네모를 아무리 칠해도 안 나오는 것이 이것이다.
      세로 이음선은 문과 문 사이다. 손잡이는 없다 — 서랍은 걷어냈다.
    -->
    <rect x="32" y="189" width="336" height="66" fill="${PALETTE.roomLight[1]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <line x1="116" y1="200" x2="116" y2="255" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="200" y1="200" x2="200" y2="255" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="284" y1="200" x2="284" y2="255" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!--
      3. 걸레받이 — 참고 이미지에서 가장 진한 덩어리다. 캐비닛보다 **더 안으로** 들어가 있고
      바닥에 닿는다. 바닥에 닿는 자리가 어두워야 실험대가 놓인 것으로 보인다. 떠 보이지 않는다.
    -->
    <rect x="48" y="255" width="304" height="20" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 바닥에 지는 그림자 — 이것이 없으면 실험대가 바닥에 놓인 게 아니라 떠 있다 -->
    <rect x="38" y="275" width="324" height="7" fill="${PALETTE.bodyDark[0]}" ${PATH_ATTRS}/>
  </g>

  <!--
    상판이 캐비닛에 드리우는 그늘 (surface-shade).

    상판이 앞으로 튀어나와 있으니 그 밑은 그늘진다. 캐비닛 폭에 맞춰 얹는다 —
    상판 두께면과 이어져 하나의 어두운 덩어리로 읽히고, 그 아래가 물러난다.
  -->
  <rect id="surface-shade" x="32" y="189" width="336" height="10" fill="${PALETTE.roomShade[1]}"/>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 */
export function applyState(_root, _state = {}) {
  // bench 애셋은 가변 상태가 없습니다.
}
