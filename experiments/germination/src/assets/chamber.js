/**
 * 바이오챔버(chamber) 애셋 — 라인 + 플랫 구현.
 *
 * **이 실험의 몸통이다.** 학생이 결과를 보는 그림이 이것이고,
 * 결과 화면은 이 그림을 그대로 키워 쓴다. 그래서 여기서는 「예쁜가」가 아니라
 * **「상태가 눈에 갈리는가」** 가 전부다.
 *
 * 갈려야 하는 것 넷:
 *   1. 발아 콩 / 마른 콩      — 흰 싹이 있고 없고 (색만으로 가르지 않는다)
 *   2. BTB 세 단계            — 색상뿐 아니라 **명도**까지 벌어져 있다 (palette.experiment.js)
 *   3. 뚜껑 열림 / 밀봉      — #lid 의 기울기 + #seal 의 유무 (둘이 함께 움직인다)
 *   4. 센서 안 꽂음/떠 있음/콩에 파묻힘 — 탐침 끝이 콩 더미 위인가 속인가
 *
 * docs/01-art-direction.md · docs/02-asset-contract.md 규칙을 따른다.
 * 색은 tokens.js 의 PALETTE(기구) 와 palette.experiment.js 의 EXP_PALETTE(BTB·콩) 뿐이고,
 * 선은 INK 한 가지, 두께는 STROKE 의 셋뿐이다. 난수는 rng(seed) 로만 만든다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng, clamp } from './geometry.js';

export const NODES = [
  '#jar', '#jar-shade', '#lid', '#seal', '#dish', '#btb',
  '#beans', '#sensor', '#thermo', '#thermo-fill',
];

/* ── 챔버 안의 기준선 ────────────────────────────────────────────────
 * 물건이 바닥을 대고 서는 선. 이 값을 옮기면 접시·콩·온도계 전구·탐침 끝이
 * 한꺼번에 어긋나므로, 자리를 옮길 때는 여기 하나만 고치고 아래를 따라 맞춘다.
 */
const FLOOR = 268;

/** 콩 한 알의 반지름. 한 숟갈이 한 켜다. */
const BEAN_RX = 8.5;
const BEAN_RY = 7;
/** 켜 사이 간격. 아래에서 위로 쌓인다. */
const ROW_H = 13;
/** 맨 아래 켜의 중심 y — 바닥에 닿아 있다. */
const ROW0_Y = FLOOR - 8;
/** 짝수 켜 4알 · 홀수 켜 3알 (반 칸 어긋나게 쌓아야 더미로 보인다) */
const BEAN_X_EVEN = [180, 198.5, 217, 235.5];
const BEAN_X_ODD = [189.25, 207.75, 226.25];
const MAX_SCOOPS = 6;

/** 센서 탐침 끝. 깊이 0 이면 뚜껑 바로 밑, 1 이면 바닥에 닿는다. */
const TIP_Y0 = 170;
const TIP_TRAVEL = FLOOR - 2 - TIP_Y0;   // 96

/** 온도계 — 눈금은 견주라고 있는 것이라 숫자를 넣지 않는다. */
const THERMO_BASE_Y = 254;
const THERMO_MAX_H = 140;
/**
 * 실온(20 ℃)에서의 기둥 높이. **0 이 아니다.**
 *
 * 앞서는 「올라간 만큼」만 그려서, 시작 상태의 온도계가 **텅 비어 있었다.**
 * 실제 온도계는 실온에서도 수은이 어느 높이에 서 있으므로, 빈 관은 0 ℃ 로 읽힌다.
 * (사장님 — 「지금 수은 온도계는 높이가 하나도 없네. 0도인것 같잖아」)
 *
 * 46 은 눈금의 **가장 아래 긴 눈금**(y=208)에 정확히 닿는 높이다 — 실온이 표시된 선이 된다.
 * 남은 칸(46→140)에 올라간 만큼을 그리므로 **두 챔버를 견주는 일은 그대로다.**
 */
const THERMO_REST_H = 46;

/** 뚜껑을 열면 비스듬히 얹힌다. 옆으로 치우면 400 폭을 벗어나므로 기울여서 들어 올린다. */
const LID_OPEN = 'translate(0, 24) rotate(-13 200 46)';

/* ------------------------------------------------------------------ */
/* 상태 → 수치                                                          */
/* ------------------------------------------------------------------ */

/**
 * 뚜껑이 열려 있는가. **`sealed` 가 곧 답이다.**
 *
 * ── 왜 다른 것으로 짐작하지 않는가 ────────────────────────────────
 * 처음에는 「센서를 넣었으면 뚜껑은 덮은 것」으로 짐작했다. 그러자 센서를 꽂고
 * **밀봉을 잊은 챔버**가 밀봉한 챔버와 거의 같아 보였다 — 가느다란 밀봉 테 하나만
 * 달랐다. 그런데 **밀봉을 잊는 것이 이 실험에서 가장 흔한 실수**이고, 밀봉은
 * 두 챔버에서 같아야 하는 통제변인이다. 화면이 그것을 숨기면 결과가 대신 답할 수 없다.
 *
 * 규칙 쪽에도 뚜껑은 `open` 과 `sealed` 둘뿐이다 (`src/sim/state.js` 의 `LID`).
 * 그림이 상태에 없는 세 번째를 지어내면 두 층이 어긋난다.
 *
 * 하네스에서 뚜껑만 따로 보고 싶을 때는 `lidOpen` 을 명시한다.
 */
export function isLidOpen(state = {}) {
  if (typeof state.lidOpen === 'boolean') return state.lidOpen;
  return !state.sealed;
}

export function lidTransform(state = {}) {
  return isLidOpen(state) ? LID_OPEN : '';
}

/** 숟갈 수 — 0~6. 그 이상은 챔버에 들어가지 않는다. */
export function scoopCount(state = {}) {
  const n = Math.round(clamp(state.scoops ?? 0, 0, MAX_SCOOPS));
  return state.beans ? n : 0;
}

/** 콩 더미 꼭대기의 y. 콩이 없으면 바닥이다 (센서 깊이를 정할 때 쓴다). */
export function pileTopY(state = {}) {
  const n = scoopCount(state);
  if (n === 0) return FLOOR;
  return ROW0_Y - ROW_H * (n - 1) - BEAN_RY;
}

/**
 * 센서를 얼마나 깊이 꽂았는가 (0~1).
 *
 * `sensorDepth` 가 주인이지만, **그림이 낱말과 어긋나면 안 된다** —
 * `'buried'` 라고 말해 놓고 탐침이 콩 위에 떠 있으면 학생은 그림을 믿지 않는다.
 * 그래서 콩 더미 높이에 맞춰 최소/최대만 잡아 준다.
 */
export function sensorDepth(state = {}) {
  const kind = state.sensor ?? 'none';
  if (kind === 'none') return 0;
  const asked = state.sensorDepth ?? (kind === 'buried' ? 0.9 : 0.25);
  let d = clamp(asked, 0, 1);
  const pile = pileTopY(state);
  if (kind === 'buried') {
    d = Math.max(d, (pile + 14 - TIP_Y0) / TIP_TRAVEL);
  } else {
    d = Math.min(d, (pile - 10 - TIP_Y0) / TIP_TRAVEL);
  }
  return clamp(d, 0, 1);
}

export function sensorTransform(state = {}) {
  const dy = TIP_TRAVEL * sensorDepth(state);
  return dy === 0 ? '' : `translate(0, ${dy.toFixed(1)})`;
}

/** BTB 를 안 넣었으면 색 칸이 **없다.** 「투명한 물」이 아니라 아무것도 없는 접시다. */
export function btbFill(state = {}) {
  const pair = EXP_PALETTE[
    state.btbStage === 'yellow' ? 'btbYellow'
      : state.btbStage === 'green' ? 'btbGreen'
        : 'btbBlue'
  ];
  return pair[0];
}

export function btbOpacity(state = {}) {
  return state.btbStage ? '1' : '0';
}

/** 온도계 기둥. 읽으라는 눈금이 아니라 **두 챔버를 견주라는 높이**다. */
export function thermoGeometry(state = {}) {
  const t = clamp(state.tempFill ?? 0, 0, 1);
  const height = THERMO_REST_H + (THERMO_MAX_H - THERMO_REST_H) * t;
  return { y: (THERMO_BASE_Y - height).toFixed(1), height: height.toFixed(1) };
}

/* ------------------------------------------------------------------ */
/* 콩                                                                   */
/* ------------------------------------------------------------------ */

function oneBean(cx, cy, tilt, kind, dir) {
  const tone = kind === 'sprout' ? EXP_PALETTE.beanSprout : EXP_PALETTE.beanDry;
  const g = [];
  g.push(
    `<ellipse cx="${cx}" cy="${cy}" rx="${BEAN_RX}" ry="${BEAN_RY}" transform="rotate(${tilt} ${cx} ${cy})" ` +
    `fill="${tone[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`
  );
  // 음영은 언제나 형태의 우하단 — 광원이 좌상단 45° 다.
  g.push(
    `<path d="M ${(cx - 4).toFixed(1)},${(cy + 5.4).toFixed(1)} ` +
    `Q ${(cx + 3).toFixed(1)},${(cy + 8.2).toFixed(1)} ${(cx + 8).toFixed(1)},${(cy + 0.6).toFixed(1)} ` +
    `Q ${(cx + 3).toFixed(1)},${(cy + 4.4).toFixed(1)} ${(cx - 4).toFixed(1)},${(cy + 5.4).toFixed(1)} Z" ` +
    `fill="${tone[1]}"/>`
  );

  if (kind === 'sprout') {
    // 흰 싹. **발아 콩과 마른 콩을 가르는 것은 색이 아니라 이 모양이다.**
    // 짧게 그리면 축소했을 때 사라져 두 챔버가 같아 보인다 — 콩 지름보다 길게 뽑는다.
    const x = (v) => (cx + dir * v).toFixed(1);
    const y = (v) => (cy + v).toFixed(1);
    g.push(
      `<path d="M ${x(-0.5)},${y(-6.4)} Q ${x(3)},${y(-16)} ${x(12.5)},${y(-21.5)} ` +
      `Q ${x(6.5)},${y(-11)} ${x(7)},${y(-3)} Z" ` +
      `fill="${EXP_PALETTE.beanSproutTip[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`
    );
    // 음영은 싹의 아래쪽 모서리를 따라 간다 (형태의 우하단)
    g.push(
      `<path d="M ${x(7)},${y(-3)} Q ${x(6.5)},${y(-11)} ${x(12.5)},${y(-21.5)} ` +
      `Q ${x(4.6)},${y(-11.6)} ${x(5)},${y(-3.6)} Z" ` +
      `fill="${EXP_PALETTE.beanSproutTip[1]}"/>`
    );
  } else {
    // 마른 콩의 배꼽(제). 싹이 없다는 것을 한 번 더 말해 준다.
    g.push(
      `<line x1="${(cx - 5.5).toFixed(1)}" y1="${(cy - 1.5).toFixed(1)}" ` +
      `x2="${(cx - 1).toFixed(1)}" y2="${(cy + 1.5).toFixed(1)}" ` +
      `stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`
    );
  }
  return g.join('\n      ');
}

/**
 * 숟갈 수만큼 바닥부터 쌓인 콩.
 *
 * 난수는 반드시 `rng(seed)` 다. 켜를 아래에서 위로 순서대로 만들기 때문에,
 * 숟갈을 더 넣어도 이미 쌓인 콩은 자리를 지킨다 (같은 표본을 같은 순서로 뽑는다).
 */
export function beanShapes(state = {}) {
  const kind = state.beans;
  const n = scoopCount(state);
  if (!kind || n === 0) return '';

  const rand = rng((state.seed ?? 1) >>> 0);
  const out = [];
  for (let s = 0; s < n; s++) {
    const xs = s % 2 === 0 ? BEAN_X_EVEN : BEAN_X_ODD;
    for (const bx of xs) {
      const cx = bx + (rand() - 0.5) * 4;
      const cy = ROW0_Y - ROW_H * s + (rand() - 0.5) * 3;
      const tilt = Math.round((rand() - 0.5) * 50);
      const dir = rand() < 0.35 ? -1 : 1;
      out.push(oneBean(Number(cx.toFixed(1)), Number(cy.toFixed(1)), tilt, kind, dir));
    }
  }
  return out.join('\n      ');
}

/* ------------------------------------------------------------------ */
/* 렌더                                                                 */
/* ------------------------------------------------------------------ */

/** 온도계 눈금. 숫자는 넣지 않는다 — 읽는 것이 아니라 견주는 것이다. */
function thermoTicks() {
  const out = [];
  for (let i = 0; i < 9; i++) {
    const y = 118 + i * 15;
    const x2 = i % 3 === 0 ? 279 : 276;
    out.push(
      `<line x1="270" y1="${y}" x2="${x2}" y2="${y}" ` +
      `stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`
    );
  }
  return out.join('\n      ');
}

/**
 * 바이오챔버 SVG 문자열.
 *
 * @param {{
 *   beans?: null|'sprout'|'dry', scoops?: number,
 *   btbStage?: null|'blue'|'green'|'yellow',
 *   sensor?: 'none'|'clear'|'buried', sensorDepth?: number|null,
 *   sealed?: boolean, tempFill?: number, seed?: number, lidOpen?: boolean,
 * }} state
 */
export function render(state = {}) {
  const lidT = lidTransform(state);
  const sensorT = sensorTransform(state);
  const sensorOn = (state.sensor ?? 'none') !== 'none' ? '1' : '0';
  const sealOn = state.sealed ? '1' : '0';
  const thermo = thermoGeometry(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="chamber">
  <!-- 접지 그림자 — 애셋에서 허용되는 유일한 반투명 요소 -->
  <ellipse cx="200" cy="277" rx="100" ry="7" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 통 몸통. 안이 들여다보이는 유리다 -->
  <path id="jar" d="M 102,60 L 102,256 Q 102,270 118,270 L 282,270 Q 298,270 298,256 L 298,60 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <!-- 통의 우하단 음영 (광원 좌상단 45°) -->
  <path id="jar-shade" d="M 288,64 L 288,254 Q 288,267 275,267 L 116,267 L 124,259 L 273,259 Q 280,259 280,252 L 280,64 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 바닥의 얕은 접시 -->
  <g id="dish">
    <path d="M 110,244 L 166,244 L 160,268 L 116,268 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 161,246 L 155.5,266 L 117,266 L 120,262 L 152.5,262 L 157,246 Z" fill="${PALETTE.glass[1]}"/>
  </g>
  <!-- BTB 용액. 안 넣었으면 opacity 0 — 「투명」이 아니라 **없는 것**이다 -->
  <path id="btb" d="M 114,248 L 162,248 L 157,264 L 119,264 Z" fill="${btbFill(state)}" opacity="${btbOpacity(state)}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <!-- 챔버에 넣은 센서 막대. 깊이는 translate 로 내려간다 -->
  <g id="sensor" opacity="${sensorOn}"${sensorT ? ` transform="${sensorT}"` : ''}>
    <rect x="194" y="68" width="28" height="46" rx="6" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 215,71 L 215,109 L 201,109 L 205,105 L 211,105 L 211,71 Z" fill="${PALETTE.bodyDark[1]}"/>
    <rect x="203" y="112" width="10" height="48" rx="4" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="209" y="116" width="2.5" height="40" rx="1" fill="${PALETTE.metal[1]}"/>
    <path d="M 203,156 L 213,156 L 209.5,168 Q 208,170.5 206.5,168 Z" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 콩. 숟갈 수만큼 바닥부터 쌓인다. 센서보다 뒤에 그려서, 파묻히면 탐침을 가린다 -->
  <g id="beans">
      ${beanShapes(state)}
  </g>

  <!-- 통 안쪽에 붙은 온도계 -->
  <g id="thermo">
    <rect x="252" y="100" width="16" height="150" rx="8" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="263" y="106" width="3" height="138" rx="1.5" fill="${PALETTE.glass[1]}"/>
    <circle cx="260" cy="256" r="12" fill="${PALETTE.rubber[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 268,250 A 12,12 0 0 1 254,266 A 12,12 0 0 0 268,250 Z" fill="${PALETTE.rubber[1]}"/>
      ${thermoTicks()}
  </g>
  <rect id="thermo-fill" x="256" y="${thermo.y}" width="8" height="${thermo.height}" rx="4" fill="${PALETTE.rubber[0]}"/>

  <!-- 뚜껑. 열면 비스듬히 얹힌다 -->
  <g id="lid"${lidT ? ` transform="${lidT}"` : ''}>
    <rect x="130" y="16" width="52" height="18" rx="6" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 175,19 L 177,31 L 139,31 L 143,27 L 173,27 L 171,19 Z" fill="${PALETTE.bodyDark[1]}"/>
    <rect x="98" y="32" width="204" height="30" rx="6" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 294,36 L 294,56 Q 294,59 291,59 L 112,59 L 120,53 L 288,53 L 288,36 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>

  <!-- 밀봉 테. 뚜껑이 제자리로 내려앉는 것과 함께, 밀봉했다는 것을 두 번 말해 준다 -->
  <g id="seal" opacity="${sealOn}">
    <rect x="104" y="58" width="192" height="14" rx="4" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 290,61 L 290,68 L 112,68 L 116,65 L 287,65 L 287,61 Z" fill="${PALETTE.metal[1]}"/>
    <rect x="97" y="54" width="12" height="22" rx="3" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <rect x="291" y="54" width="12" height="22" rx="3" fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 300,57 L 300,73 L 293,73 L 296,70 L 297,70 L 297,57 Z" fill="${PALETTE.metal[1]}"/>
  </g>
</svg>`;
}

/**
 * 이미 DOM 에 붙어 있는 SVG 를 상태에 맞게 갱신한다.
 * 계약(contract.js)에 mutable 로 선언된 속성만 건드린다.
 */
export function applyState(root, state = {}) {
  const lid = root.querySelector('#lid');
  const lidT = lidTransform(state);
  if (lidT) lid.setAttribute('transform', lidT);
  else lid.removeAttribute('transform');

  root.querySelector('#seal').setAttribute('opacity', state.sealed ? '1' : '0');

  const btb = root.querySelector('#btb');
  btb.setAttribute('fill', btbFill(state));
  btb.setAttribute('opacity', btbOpacity(state));

  root.querySelector('#beans').innerHTML = beanShapes(state);

  const sensor = root.querySelector('#sensor');
  sensor.setAttribute('opacity', (state.sensor ?? 'none') !== 'none' ? '1' : '0');
  const sensorT = sensorTransform(state);
  if (sensorT) sensor.setAttribute('transform', sensorT);
  else sensor.removeAttribute('transform');

  const fill = root.querySelector('#thermo-fill');
  const thermo = thermoGeometry(state);
  fill.setAttribute('y', thermo.y);
  fill.setAttribute('height', thermo.height);
}
