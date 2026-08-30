/**
 * 회전판(rotor) 애셋 — 라인 + 플랫 구현.
 *
 * 교과서 1단계(공작)를 건너뛰고 **완성품으로 주는** 종이 회전판이다.
 * 종이 원심분리기(paperfuge)와 같은 구조 — 원판 가운데를 끈이 두 번 통과하고,
 * 끈 양끝의 링에 손가락을 건다. 좌우로 당겼다 놓으면 꼬인 끈이 풀리며 원판이 돈다.
 *
 * **회전판은 모세관을 「수평으로」 문다.** 원판을 가로질러 빨대 두 개가 마주 보게 붙어 있고,
 * 그 안에 모세관이 눕는다. 교과서 그림의 「아래」는 회전 **바깥쪽 끝** — 여기서는
 * 왼쪽 빨대의 왼쪽 끝, 오른쪽 빨대의 오른쪽 끝이다 (AGENTS.md §2.5).
 * 그래서 바깥쪽 끝에 밀봉 마개를 두고, 혈액 기둥을 그 끝에 붙여 그리고,
 * 빨대마다 바깥을 가리키는 홑화살을 얹었다. 위/아래로 그리면 틀린 그림이다.
 *
 * 정면에서 본 그림 — 원판이 정면으로 보이고 끈이 좌우로 뻗어 링에 닿는다.
 * 끈은 원판 **뒤에** 깔아, 원판을 가로지르는 부분이 모세관을 덮지 않게 했다.
 * 보이는 것은 테두리 밖으로 나온 부분과 중심의 구멍 둘이다.
 *
 * 노드 계약은 src/assets/contract.js 의 rotor 항목.
 * 색·선 규칙은 docs/01-art-direction.md.
 */

import { PALETTE, INK, STROKE, PATH_ATTRS, paint } from '../style/tokens.js';
import { EXP_PALETTE, paintExp } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = [
  '#disc', '#disc-shade', '#hub',
  '#straw-a', '#straw-b', '#tube-a', '#tube-b',
  '#string', '#ring-left', '#ring-right',
  '#spin-marks', '#wobble',
];

/** 원판 기하 — 이 값들이 「축 쪽」과 「바깥쪽」을 정한다. */
const CX = 200, CY = 150, R_DISC = 86, R_HUB = 22, R_MARK = 95;

/* ------------------------------------------------------------------ *
 * 기하 헬퍼 — 형태는 애셋 안에서만 만든다
 * ------------------------------------------------------------------ */

function pt(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)];
}

/**
 * 두 반지름 사이의 호 띠. 음영 도형에 쓴다.
 * 각도는 화면 좌표(오른쪽 0°, 아래 90°)이므로 -40°~140° 가 곧 우하단이다.
 */
function arcBand(cx, cy, rO, rI, a0, a1) {
  const [x0, y0] = pt(cx, cy, rO, a0);
  const [x1, y1] = pt(cx, cy, rO, a1);
  const [x2, y2] = pt(cx, cy, rI, a1);
  const [x3, y3] = pt(cx, cy, rI, a0);
  const big = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0},${y0} A ${rO},${rO} 0 ${big},1 ${x1},${y1} L ${x2},${y2} A ${rI},${rI} 0 ${big},0 ${x3},${y3} Z`;
}

/** 가운데가 뚫린 고리. evenodd 로 안쪽을 비운다. */
function annulus(cx, cy, R, r) {
  return `M ${cx - R},${cy} A ${R},${R} 0 1,0 ${cx + R},${cy} A ${R},${R} 0 1,0 ${cx - R},${cy} Z`
       + ` M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
}

/**
 * 꼬인 끈 한 가닥. 눈(lens) 모양을 이어 붙여 꼬임을 만든다.
 * dir = -1 이면 왼쪽, +1 이면 오른쪽으로 뻗는다.
 */
function cord(x0, dir, segs = 7, len = 16) {
  const body = [], shade = [];
  for (let i = 0; i < segs; i++) {
    const a = x0 + dir * len * i;
    const m = a + dir * (len / 2);
    const b = a + dir * len;
    body.push(`M ${a},${CY} Q ${m},${CY - 8} ${b},${CY} Q ${m},${CY + 8} ${a},${CY} Z`);
    // 음영은 가닥의 아래쪽 반 — 광원이 좌상단이므로 그늘은 아래에 온다
    shade.push(`M ${a},${CY} Q ${m},${CY + 8} ${b},${CY} Z`);
  }
  return { body: body.join(' '), shade: shade.join(' ') };
}

/* ------------------------------------------------------------------ *
 * 상태 → 값
 * ------------------------------------------------------------------ */

/** 물린 모세관이 있는가. 없으면 #tube-x 는 아예 보이지 않는다. */
export function tubeOpacity(slot) {
  return slot === 'sample' || slot === 'counter' ? '1' : '0';
}

/** 선홍 혈액이 차 있는가. 균형추(counter)는 빈 모세관이다. */
export function bloodOpacity(slot) {
  return slot === 'sample' ? '1' : '0';
}

/** 회전 표시의 개수. rpm 이 아니라 0~1 의 speed 를 그대로 개수로 읽는다. */
export function spinMarkCount(state = {}) {
  return Math.round(clamp(state.speed ?? 0, 0, 1) * 10);
}

/** 회전 표시의 짙기. 0 이면 표시가 없다. */
export function spinOpacity(state = {}) {
  const s = clamp(state.speed ?? 0, 0, 1);
  return s <= 0 ? '0' : (0.35 + 0.6 * s).toFixed(2);
}

/** 균형이 안 맞아 흔들리는 정도. */
export function wobbleOpacity(state = {}) {
  return clamp(state.wobble ?? 0, 0, 1).toFixed(2);
}

/** 회전 표시 호의 패스 데이터 목록. 개수만 speed 를 따른다. */
export function spinMarkPaths(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = -90 + (360 / n) * i;
    const [x0, y0] = pt(CX, CY, R_MARK, a - 12);
    const [x1, y1] = pt(CX, CY, R_MARK, a + 12);
    out.push(`M ${x0},${y0} A ${R_MARK},${R_MARK} 0 0,1 ${x1},${y1}`);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 부품
 * ------------------------------------------------------------------ */

/**
 * 빨대 한 개. 원판 위에 수평으로 붙어 있고 안쪽 끝이 열려 있다.
 * side = -1 이면 왼쪽(바깥쪽 끝이 왼쪽), +1 이면 오른쪽.
 */
function straw(id, side) {
  const x = side < 0 ? 118 : 224;          // 사각형 왼쪽 모서리
  const mouthX = side < 0 ? 176 : 224;     // 열린 입 — 언제나 축 쪽
  const tipX = side < 0 ? 130 : 270;       // 홑화살이 가리키는 곳 — 바깥쪽
  const backX = side < 0 ? 144 : 256;
  return `  <g id="${id}">
    <!-- 빨대 몸통 (원판을 가로질러 수평으로 눕는다) -->
    <rect x="${x}" y="133" width="58" height="34" rx="9" ${paint('bodyDark')}/>
    <!-- 우하단 음영 -->
    <rect x="${x + 5}" y="157" width="48" height="8" rx="3" fill="${PALETTE.bodyDark[1]}"/>
    <!-- 주름 자국 -->
    <line x1="${x + 14}" y1="136" x2="${x + 14}" y2="142" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="${x + 40}" y1="136" x2="${x + 40}" y2="142" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 열린 입 — 모세관은 축 쪽에서 밀어 넣는다 -->
    <ellipse cx="${mouthX}" cy="150" rx="3.5" ry="15" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 바깥쪽(회전 바깥)을 가리키는 홑화살 — 교과서 그림의 「아래」가 이쪽이다 -->
    <path d="M ${backX},109 L ${tipX},118 L ${backX},127" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>`;
}

/**
 * 빨대에 물린 모세관 한 개. 수평으로 눕는다.
 * 밀봉 마개와 혈액 기둥이 모두 **바깥쪽 끝**에 붙는다 — 그것이 회전 바깥이라는 표시다.
 */
function tube(id, side, slot) {
  const x = side < 0 ? 124 : 230;                 // 유리관 왼쪽 모서리
  const plugX = side < 0 ? 124 : 266;             // 마개 — 언제나 바깥쪽 끝
  const bloodX = side < 0 ? 135 : 239;            // 혈액 기둥도 바깥쪽 끝부터 찬다
  return `  <g id="${id}" opacity="${tubeOpacity(slot)}" transform="translate(0,0)">
    <!-- 유리 모세관 (수평) -->
    <rect x="${x}" y="145" width="46" height="11" rx="4" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="${x + 4}" y="152.5" width="38" height="2.5" rx="1" fill="${PALETTE.glass[1]}"/>
    <!-- 선홍 혈액 기둥 (균형추면 비어 있다) -->
    <g id="${id}-blood" opacity="${bloodOpacity(slot)}">
      <rect x="${bloodX}" y="146.5" width="26" height="8" rx="2" ${paintExp('bloodFresh', { stroke: 'hair' })}/>
      <rect x="${bloodX + 2}" y="151.5" width="22" height="3" rx="1" fill="${EXP_PALETTE.bloodFresh[1]}"/>
    </g>
    <!-- 고무찰흙 밀봉 마개 — 바깥쪽 끝 -->
    <rect x="${plugX}" y="144" width="10" height="13" rx="4" ${paintExp('clay', { stroke: 'detail' })}/>
    <rect x="${plugX + 1}" y="152" width="8" height="4" rx="2" fill="${EXP_PALETTE.clay[1]}"/>
  </g>`;
}

/* ------------------------------------------------------------------ *
 * 렌더
 * ------------------------------------------------------------------ */

export function render(state = {}) {
  const left = cord(178, -1);
  const right = cord(222, +1);
  const marks = spinMarkPaths(spinMarkCount(state));

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="rotor">
  <!-- 끈 — 원판 뒤로 지나간다. 보이는 것은 테두리 밖으로 나온 부분이다 -->
  <g id="string">
    <path d="${left.body}" ${paint('metal', { stroke: 'hair' })}/>
    <path d="${left.shade}" fill="${PALETTE.metal[1]}"/>
    <path d="${right.body}" ${paint('metal', { stroke: 'hair' })}/>
    <path d="${right.shade}" fill="${PALETTE.metal[1]}"/>
  </g>

  <!-- 종이 원판 -->
  <g id="disc">
    <circle cx="${CX}" cy="${CY}" r="${R_DISC}" ${paint('paper')}/>
    <circle cx="${CX}" cy="${CY}" r="66" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 원판 우하단 음영 (광원 좌상단 45°) -->
  <path id="disc-shade" d="${arcBand(CX, CY, R_DISC - 1.5, 66, -40, 140)}" fill="${PALETTE.paper[1]}"/>

${straw('straw-a', -1)}
${tube('tube-a', -1, state.slotA ?? null)}
${straw('straw-b', +1)}
${tube('tube-b', +1, state.slotB ?? null)}

  <!-- 중심 보강판과 끈 구멍 둘 — 끈은 여기를 두 번 지난다 -->
  <g id="hub">
    <circle cx="${CX}" cy="${CY}" r="${R_HUB}" ${paint('paper', { stroke: 'detail' })}/>
    <path d="${arcBand(CX, CY, R_HUB - 1, 13, -40, 140)}" fill="${PALETTE.paper[1]}"/>
    <circle cx="${CX}" cy="141" r="3.5" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="${CX}" cy="159" r="3.5" fill="${PALETTE.bodyDark[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 손가락을 거는 링 -->
  <g id="ring-left" transform="translate(0,0)">
    <path d="${annulus(48, CY, 18, 11)}" fill-rule="evenodd" ${paint('bodyDark')}/>
    <path d="${arcBand(48, CY, 17, 12, -40, 140)}" fill="${PALETTE.bodyDark[1]}"/>
  </g>
  <g id="ring-right" transform="translate(0,0)">
    <path d="${annulus(352, CY, 18, 11)}" fill-rule="evenodd" ${paint('bodyDark')}/>
    <path d="${arcBand(352, CY, 17, 12, -40, 140)}" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 회전 표시 — 개수와 짙기가 speed 를 말한다 (rpm 이 아니다) -->
  <g id="spin-marks" opacity="${spinOpacity(state)}">
${marks.map((d) => `    <path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`).join('\n')}
  </g>

  <!-- 흔들림 — 한쪽만 물렸을 때 테두리가 겹쳐 보인다 -->
  <g id="wobble" opacity="${wobbleOpacity(state)}">
    <circle cx="${CX + 6}" cy="${CY + 6}" r="90" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <circle cx="${CX - 6}" cy="${CY - 6}" r="90" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ *
 * 상태 반영
 * ------------------------------------------------------------------ */

const SVG_NS = 'http://www.w3.org/2000/svg';

function setSlot(root, id, slot) {
  const g = root.querySelector(`#${id}`);
  if (g) g.setAttribute('opacity', tubeOpacity(slot));
  const blood = root.querySelector(`#${id}-blood`);
  if (blood) blood.setAttribute('opacity', bloodOpacity(slot));
}

export function applyState(root, state = {}) {
  setSlot(root, 'tube-a', state.slotA ?? null);
  setSlot(root, 'tube-b', state.slotB ?? null);

  const marks = root.querySelector('#spin-marks');
  if (marks) {
    while (marks.firstChild) marks.removeChild(marks.firstChild);
    for (const d of spinMarkPaths(spinMarkCount(state))) {
      const p = (root.ownerDocument ?? document).createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', INK);
      p.setAttribute('stroke-width', String(STROKE.detail));
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('stroke-linecap', 'round');
      marks.appendChild(p);
    }
    marks.setAttribute('opacity', spinOpacity(state));
  }

  const wob = root.querySelector('#wobble');
  if (wob) wob.setAttribute('opacity', wobbleOpacity(state));
}
