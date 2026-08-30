/**
 * 발효관(fermtube) 애셋 — 큐네 발효관. 라인 + 플랫 구현.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 *
 * ── 형태를 이렇게 잡은 이유 ──────────────────────────────────────────
 * 이 실험은 「어느 쪽이 막힌 쪽인가」를 눈으로 알아야 성립한다.
 * 그래서 두 쪽을 **세 가지로 동시에** 갈라 두었다 — 하나만으로는 축소하면 무너진다.
 *
 *   맹관부(왼쪽)  : 가늘다 · 위가 **둥근 돔으로 막혀** 있다 · 안이 늘 비쳐 보인다
 *   팽대부(오른쪽): 굵다(배가 불룩하다) · 위가 **뚫려 있다**(입구 타원 + 벌어진 테두리)
 *
 * 관 전체는 아래에서 U 자로 이어져 있고, 액체는 **하나로 이어진 한 덩어리**다.
 * 그래서 `#liquid` 는 두 쪽에 걸치는 rect 하나이고, 맹관부의 액면이 내려가 보이는 것은
 * 액체를 깎아서가 아니라 **`#gas` 가 위에서부터 덮어 내려오기** 때문이다 — 실제 물리와 같다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = [
  '#glass', '#glass-shade', '#liquid', '#liquid-shade', '#gas', '#bubbles', '#plug',
];

/* ── 광학이 아니라 그림의 기준선. 여기 숫자를 옮기면 액면과 기체가 관 밖으로 나간다 ── */

/** 관 안쪽(bore)의 바닥. 액체가 level 0 일 때의 수면이자 바닥선이다. */
const LIQUID_BOTTOM_Y = 258;
/**
 * level 1 일 때의 수면. 맹관부의 막힌 천장에 닿는 높이다 —
 * **처음에는 관 전체가 용액으로 차 있어야** 하기 때문이다.
 * 팽대부 쪽에서는 bore 클립이 입구(y 44)에서 잘라 주므로 넘쳐 보이지 않는다.
 */
const LIQUID_TOP_Y = 36;
/**
 * 맹관부 막힌 천장. 기체는 **여기서부터 아래로** 자란다.
 * 천장이 둥글어서 이 y 는 관 안쪽보다 조금 위다 — 나머지는 bore 클립이 깎아 준다.
 */
const GAS_TOP_Y = 33;
/** fill 1 일 때 기체의 높이. 맹관부가 U 자 굽이에 닿는 데까지다. */
const GAS_MAX_H = 205;

/**
 * 담긴 것에 따른 액체 색. 없으면 null 을 돌려주고, 그때는 액체를 아예 그리지 않는다.
 *
 * **조건마다 다른 색을 주지 않는다.** 포도당 10 % 와 5 % 는 같은 `glucose` 색이다
 * (src/style/palette.experiment.js 주석 참조).
 */
export function liquidTone(state = {}) {
  const kind = String(state.liquid ?? '').toUpperCase();
  if (kind === 'GLUCOSE') return 'glucose';
  if (kind === 'WATER') return 'water';
  if (kind === 'BREW') return 'brew';
  if (kind === 'KOH') return 'koh';
  return null;
}

/**
 * 팽대부에 담긴 용액의 수면 위치.
 *
 * `drained` — 팽대부의 용액을 빼낸 상태. 새로 부은 것이 없으면(`liquid` 가 null) 관이 빈다.
 * 빼낸 뒤에 다른 것을 부었다면(수산화 칼륨 수용액 등) 그것을 `level` 만큼 그린다.
 * **어느 쪽이든 맹관부에 모인 기체(`#gas`)는 건드리지 않는다** — 그것이 이 실험의 결과다.
 */
export function liquidGeometry(state = {}) {
  const tone = liquidTone(state);
  const level = clamp(state.level ?? 0, 0, 1);
  const span = LIQUID_BOTTOM_Y - LIQUID_TOP_Y;
  const visible = Boolean(tone) && level > 0;
  const height = visible ? span * level : 0;
  return {
    y: (LIQUID_BOTTOM_Y - height).toFixed(1),
    height: height.toFixed(1),
    opacity: visible ? '1' : '0',
    surfaceY: LIQUID_BOTTOM_Y - height,
    tone,
  };
}

/**
 * 맹관부에 모인 이산화 탄소.
 * y 는 늘 천장(GAS_TOP_Y)에 붙어 있고 **height 만 자란다** — 위에서부터 고이기 때문이다.
 */
export function gasGeometry(state = {}) {
  const fill = clamp(state.fill ?? 0, 0, 1);
  const height = GAS_MAX_H * fill;
  return {
    y: String(GAS_TOP_Y),
    height: height.toFixed(1),
    opacity: height > 0 ? '1' : '0',
  };
}

/** 팽대부에서 올라오는 기포. 위치는 고정이다 — 난수를 쓰지 않는다(docs/02 §결정론). */
const BUBBLE_SEEDS = [
  { x: 232, t: 0.04, r: 5 },
  { x: 262, t: 0.18, r: 4 },
  { x: 244, t: 0.33, r: 6 },
  { x: 274, t: 0.46, r: 3.5 },
  { x: 226, t: 0.59, r: 4.5 },
  { x: 254, t: 0.72, r: 5 },
  { x: 241, t: 0.88, r: 3 },
];

/** `#bubbles` 안에 넣을 도형. 수면 아래에서만 올라온다. */
export function bubbleMarkup(state = {}) {
  if (!state.bubbling) return '';
  const { surfaceY } = liquidGeometry(state);
  const bottom = 250;
  const top = clamp(surfaceY + 16, 172, 244);
  if (top >= bottom) return '';
  return BUBBLE_SEEDS.map(({ x, t, r }) => {
    const y = (bottom - t * (bottom - top)).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${EXP_PALETTE.bubble[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`;
  }).join('');
}

/* ── 형태 ─────────────────────────────────────────────────────────── */

/** 유리 바깥 윤곽. 왼쪽은 돔으로 막고, 오른쪽은 배가 불룩하며 위가 벌어진다. */
const GLASS_OUTLINE =
  'M 108,50 ' +
  'Q 108,30 131,30 Q 154,30 154,50 ' +          // 맹관부 — 막힌 돔
  'L 154,214 C 154,226 162,232 176,232 L 198,232 ' +   // 오른벽 → U 자 굽이의 오목한 안쪽 모서리
  'C 192,214 196,188 232,158 ' +                // 팽대부 배의 왼쪽 옆구리를 타고 목까지
  'L 232,54 L 220,50 L 220,34 ' +               // 목 왼벽 → 벌어진 입구 테두리
  'L 286,34 L 286,50 L 274,54 ' +
  'L 274,158 C 306,178 310,232 288,256 ' +      // 배의 오른쪽
  'C 274,270 250,270 232,268 ' +                // 배의 바닥
  'L 150,268 C 122,268 108,258 108,240 Z';      // 아래 가로관 → 맹관부 왼벽

/**
 * 관 안쪽. 액체·기체·기포는 전부 이 안에서만 그려진다.
 *
 * **맹관부 쪽 천장을 둥글게 닫아 둔 것이 중요하다.** 여기를 직선으로 그으면
 * 왼쪽 관도 위가 뚫린 것처럼 보여서 어느 쪽이 막힌 쪽인지 알 수 없게 된다.
 */
const GLASS_BORE =
  'M 144,44 L 144,226 C 144,236 152,242 168,242 L 204,242 ' +
  'C 200,224 202,194 242,166 L 242,44 L 264,44 L 264,166 ' +
  'C 296,180 302,226 284,246 C 272,256 250,258 232,258 ' +
  'L 140,258 C 126,258 118,252 118,242 L 118,44 ' +
  'C 118,36 125,33 131,33 C 137,33 144,36 144,44 Z';

/** 우하단 음영 — 광원이 좌상단 45° 라 늘 오른쪽·아래에 온다. */
const GLASS_SHADE =
  // 맹관부 돔의 오른쪽과 오른벽
  'M 141,33 C 150,35 154,42 154,52 L 154,216 C 154,228 162,236 178,236 ' +
  'L 178,242 C 158,242 148,232 148,216 L 148,52 C 148,44 146,37 141,33 Z ' +
  // 팽대부 목 오른벽 → 배의 오른쪽 → 배의 바닥
  'M 268,58 L 274,54 L 274,158 C 306,178 310,232 288,256 C 274,270 250,270 232,268 ' +
  'L 233,262 C 251,264 271,264 284,252 C 302,231 300,183 268,163 Z ' +
  // 아래 가로관의 밑면 — 형태의 하단이라 여기도 음영이 온다
  'M 236,268 L 150,268 C 134,268 122,261 116,250 L 122,247 ' +
  'C 127,256 137,262 150,262 L 236,262 Z';

/**
 * 발효관 SVG 문자열 렌더링.
 *
 * @param {{fill?: number, liquid?: string|null, level?: number,
 *          plugged?: boolean, bubbling?: boolean, drained?: boolean}} state
 */
export function render(state = {}) {
  const liq = liquidGeometry(state);
  const gas = gasGeometry(state);
  const bubbles = bubbleMarkup(state);
  const plugOpacity = state.plugged ? '1' : '0';

  const liquidFill = liq.tone ? EXP_PALETTE[liq.tone][0] : 'none';
  const shadeFill = liq.tone ? EXP_PALETTE[liq.tone][1] : 'none';

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="fermtube">
  <defs>
    <clipPath id="ftBore"><path d="${GLASS_BORE}"/></clipPath>
  </defs>

  <!-- 접지 그림자 — 애셋에서 허용되는 유일한 반투명 요소 -->
  <ellipse cx="200" cy="272" rx="108" ry="8" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 유리관 본체. 왼쪽 = 맹관부(막힘), 오른쪽 = 팽대부(열림) -->
  <path id="glass" d="${GLASS_OUTLINE}" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 팽대부 입구. 이 타원 하나가 「이쪽은 뚫려 있다」를 말한다 -->
  <ellipse cx="253" cy="41" rx="27" ry="6" fill="${PALETTE.glass[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>

  <g clip-path="url(#ftBore)">
    <!-- 관 전체에 이어진 용액 한 덩어리. 수면은 level 이 정한다 -->
    <rect id="liquid" x="106" y="${liq.y}" width="200" height="${liq.height}" opacity="${liq.opacity}" fill="${liquidFill}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 용액의 우하단 음영 — 팽대부 오른쪽 가장자리에만 온다 (광원 좌상단 45°) -->
    <rect id="liquid-shade" x="262" y="${liq.y}" width="46" height="${liq.height}" opacity="${liq.opacity}" fill="${shadeFill}"/>
    <!-- 맹관부에 모인 이산화 탄소. **이 실험의 결과가 여기 보인다** — 위에서부터 자란다 -->
    <rect id="gas" x="112" y="${gas.y}" width="40" height="${gas.height}" opacity="${gas.opacity}" fill="${EXP_PALETTE.gas[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <!-- 팽대부에서 올라오는 기포 -->
    <g id="bubbles" opacity="${bubbles ? '1' : '0'}">${bubbles}</g>
  </g>

  <!-- 관 안쪽 벽선. 액체 위에 얹어야 유리 안에 든 것으로 읽힌다 -->
  <path d="${GLASS_BORE}" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>

  <!-- 유리의 우하단 음영 -->
  <path id="glass-shade" d="${GLASS_SHADE}" fill="${PALETTE.glass[1]}"/>

  <!-- 솜마개. 꽂으면 팽대부 입구를 막는다 -->
  <g id="plug" opacity="${plugOpacity}">
    <path d="M 224,44 C 224,26 236,20 253,20 C 270,20 282,26 282,44 C 282,52 270,56 253,56 C 236,56 224,52 224,44 Z" fill="${EXP_PALETTE.cotton[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 268,24 C 278,29 280,36 280,44 C 280,50 270,54 256,55 C 268,52 274,48 274,42 C 274,34 272,28 268,24 Z" fill="${EXP_PALETTE.cotton[1]}"/>
    <line x1="238" y1="30" x2="246" y2="46" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <line x1="252" y1="26" x2="258" y2="48" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>
</svg>`;
}

/**
 * 이미 DOM 에 붙어 있는 SVG 를 상태에 맞게 갱신합니다.
 * **계약에 mutable 로 적힌 속성만** 건드립니다 (src/assets/contract.js).
 */
export function applyState(root, state = {}) {
  const liq = liquidGeometry(state);
  const gas = gasGeometry(state);

  const liquid = root.querySelector('#liquid');
  liquid.setAttribute('fill', liq.tone ? EXP_PALETTE[liq.tone][0] : 'none');
  liquid.setAttribute('y', liq.y);
  liquid.setAttribute('height', liq.height);
  liquid.setAttribute('opacity', liq.opacity);

  const liquidShade = root.querySelector('#liquid-shade');
  liquidShade.setAttribute('fill', liq.tone ? EXP_PALETTE[liq.tone][1] : 'none');
  liquidShade.setAttribute('y', liq.y);
  liquidShade.setAttribute('height', liq.height);
  liquidShade.setAttribute('opacity', liq.opacity);

  const gasEl = root.querySelector('#gas');
  gasEl.setAttribute('y', gas.y);
  gasEl.setAttribute('height', gas.height);
  gasEl.setAttribute('opacity', gas.opacity);

  const bubbles = root.querySelector('#bubbles');
  const markup = bubbleMarkup(state);
  bubbles.innerHTML = markup;
  bubbles.setAttribute('opacity', markup ? '1' : '0');

  root.querySelector('#plug').setAttribute('opacity', state.plugged ? '1' : '0');
}
