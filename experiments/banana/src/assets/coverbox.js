/**
 * 덮개 유리 통(coverbox) 애셋 — 라인 + 플랫 구현.
 *
 * 22 × 22 mm 덮개 유리(커버글라스) 낱장을 담아 두는 작은 사각 통.
 * 핀셋으로 한 장을 집을 수 있도록 뚜껑이 열려 있고, 얇은 유리 여러 장이
 * 겹쳐진 묶음(#stack)이 통 위로 드러나 있는 구조.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#box', '#box-shade', '#stack'];

/**
 * 덮개 유리 통 SVG 문자열 렌더링.
 *
 * 상태를 받지 않는다 — 덮개 유리는 통에서 얼마든지 꺼내 쓴다.
 * 한 번 쓴 것은 쓰레기통으로 가며, 이 통으로 돌아오지 않는다.
 */
export function render() {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="coverbox">
  <!-- 접지 그림자 -->
  <polygon points="80,246 270,246 330,198 140,198" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 통 본체 (열린 뚜껑 · 내부 수납부 · 유리 묶음 · 앞/옆 외벽) -->
  <g id="box">
    <!-- 1. 열린 뚜껑 외벽 (뒤로 젖혀진 뚜껑) -->
    <polygon points="128,48 296,48 314,124 146,124" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 안쪽 림 (열린 뚜껑 내부면) -->
    <polygon points="136,56 288,56 304,118 152,118" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 뚜껑 상단 손잡이 턱 (Lid lip) -->
    <path d="M 192,48 L 232,48 L 230,41 L 194,41 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 뚜껑 우측 음영 -->
    <polygon points="280,48 296,48 314,124 302,124" fill="${PALETTE.bodyDark[1]}"/>

    <!-- 힌지(경첩) 연결부 -->
    <rect x="172" y="120" width="18" height="9" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <rect x="272" y="120" width="18" height="9" rx="2" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 2. 통 내부 어두운 바닥/안쪽 벽 (Glass stack 뒤쪽 암부) -->
    <polygon points="106,162 254,162 304,124 156,124" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 3. 통에 담긴 덮개 유리 묶음 (뚜껑 앞으로 솟아오른 5장의 얇은 유리) -->
    <g id="stack">
      <!-- 1번 유리 (맨 뒤 — 뚜껑 앞쪽으로 가장 높이 솟아 있음) -->
      <g>
        <polygon points="152,168 268,168 306,106 190,106" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
        <polygon points="268,168 306,106 308,108 270,170" fill="${PALETTE.glass[1]}"/>
      </g>

      <!-- 2번 유리 -->
      <g>
        <polygon points="146,174 262,174 300,112 184,112" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
        <polygon points="262,174 300,112 302,114 264,176" fill="${PALETTE.glass[1]}"/>
      </g>

      <!-- 3번 유리 -->
      <g>
        <polygon points="140,180 256,180 294,118 178,118" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
        <polygon points="256,180 294,118 296,120 258,182" fill="${PALETTE.glass[1]}"/>
      </g>

      <!-- 4번 유리 -->
      <g>
        <polygon points="134,186 250,186 288,124 172,124" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
        <polygon points="250,186 288,124 290,126 252,188" fill="${PALETTE.glass[1]}"/>
      </g>

      <!-- 5번 유리 (맨 앞 — 핀셋으로 집기 직전의 대표 낱장) -->
      <g>
        <!-- 유리 윗면 -->
        <polygon points="128,192 244,192 282,130 166,130" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
        <!-- 유리 우측 두께면 (광원 좌상단 45°에 따른 우측 음영) -->
        <polygon points="244,192 282,130 285,133 247,195" fill="${PALETTE.glass[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
        <!-- 유리 하단 모서리면 -->
        <polygon points="128,192 244,192 247,195 131,195" fill="${PALETTE.glass[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
        <!-- 유리 표면 45° 대각선 반사광 디테일 -->
        <line x1="172" y1="138" x2="256" y2="182" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
        <line x1="188" y1="136" x2="264" y2="174" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
      </g>
    </g>

    <!-- 4. 몸통 윗면 테두리 림 (Top rim) -->
    <polygon points="96,162 264,162 314,124 146,124" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 5. 몸통 전면 외벽 (핀셋 접근용 U자 홈 포함 — 유리 묶음 아래를 감싸 안음) -->
    <path d="M 96,162 L 138,162 C 146,162 148,196 160,196 L 200,196 C 212,196 214,162 222,162 L 264,162 L 264,236 C 264,240 260,242 256,242 L 104,242 C 100,242 96,240 96,236 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 6. 몸통 우측면 외벽 -->
    <path d="M 264,162 L 314,124 L 314,198 C 314,202 310,204 306,204 L 264,236 Z" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

    <!-- 전면 U자 홈 안쪽 테두리 라인 디테일 -->
    <path d="M 138,162 C 146,162 148,196 160,196 L 200,196 C 212,196 214,162 222,162" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

    <!-- 전면 하단 베이스 턱 라인 -->
    <line x1="104" y1="232" x2="256" y2="232" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

    <!-- 우측면 베이스 턱 라인 -->
    <line x1="264" y1="232" x2="306" y2="200" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45° — 우측면 전체 및 전면 하단부) -->
  <g id="box-shade">
    <!-- 우측면 전체 음영 -->
    <path d="M 264,162 L 314,124 L 314,198 C 314,202 310,204 306,204 L 264,236 Z" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 전면 하단부 음영 슬라이스 -->
    <path d="M 96,232 L 264,232 L 264,236 C 264,240 260,242 256,242 L 104,242 C 100,242 96,240 96,236 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>
</svg>`;
}

/** 상태가 없으므로 갱신할 것도 없다. 계약상 두 함수를 모두 내보낸다. */
export function applyState() {}

