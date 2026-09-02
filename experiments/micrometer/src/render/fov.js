/**
 * 현미경 시야 렌더러 — 「현미경으로 세포의 크기 측정하기」
 *
 * 시야는 미리 그린 그림이 아니라 `state.fieldParams()` 한 벌에서 매번 생성한다.
 * 그래야 배율·초점·정렬을 바꾼 결과가 정직하게 반영되고, 기록이 이미지 대신 값만 저장할 수 있다.
 *
 * ── 이 파일이 지켜야 하는 단 하나의 규칙 ────────────────────────────
 * **접안 눈금 레이어는 배율에 반응하지 않는다.**
 *
 * 접안 마이크로미터는 접안렌즈 **안**(중간상 평면)에 있고, 대물 마이크로미터와 표본은
 * 재물대 **위**에 있다. 대물렌즈를 4배에서 40배로 올리면 재물대 위의 것만 4배로 벌어지고
 * 접안 눈금은 한 치도 안 변한다. 학생이 발견해야 하는 것이 바로 이 비대칭이다.
 *
 * 실수로 둘을 함께 확대하면 이 실험은 아무것도 가르치지 않는다. 그런데 **화면만 봐서는
 * 티가 안 난다** — 눈금이 두 겹으로 잘 그려져 있으니까. 그래서 세 겹으로 막는다:
 *
 *   1. `reticleLayer()` 가 `objective` 를 **인자로 받지 않는다.** 시그니처로 막는다
 *   2. `optics.js` 의 `eyepieceDivPx(fieldPx)` 도 같은 이유로 배율을 받지 않는다
 *   3. `tests/fov.test.js` 가 4·10·40배에서 접안 레이어 문자열이 **바이트까지 같은지** 본다
 *
 * ── 레이어 ──────────────────────────────────────────────────────
 * 바나나랩은 시야 전체에 블러 하나를 걸었다. 여기서는 그러면 안 된다 —
 * 접안 눈금은 렌즈 안에 있어 **초점 나사와 무관하게 늘 선명하다**.
 * 눈금은 선명한데 표본만 뿌옇다는 것 자체가 "초점이 안 맞았다"는 단서가 된다.
 *
 *   #fov-scene    재물대 위 — 이동(pan) · 표본 회전 · 초점 블러가 **여기에만** 걸린다
 *   #fov-reticle  접안렌즈 안 — 이동도 배율도 초점도 닿지 않는다. 접안렌즈 회전만 받는다
 *   #fov-dark     안개 — 조리개가 만든 대비 손실. 두 레이어 위를 함께 덮는다
 *
 * ── 성능 ────────────────────────────────────────────────────────
 * 아래 셋은 이미 있는 노드의 속성만 바꾸면 되므로 드래그 중에 `renderFOV` 를 다시 부르지 마라.
 *
 *   시야 이동  →  #fov-scene 의 transform = translate(-panX, -panY)
 *   초점       →  #fov-blur 의 stdDeviation = focusBlurPx(p)
 *   대비       →  #fov-dark 의 opacity = hazeOpacity(p)
 *
 * 초점·대비 식을 부르는 쪽에서 다시 적지 말고 이 파일이 내보내는 함수를 쓸 것.
 * 두 곳에 같은 식을 적으면 한쪽만 고쳐지는 날이 오고, 그때 화면은 **에러 없이 조용히 틀린다.**
 *
 * ── id ──────────────────────────────────────────────────────────
 * 이 SVG 는 `<clipPath>` · `<filter>` · `<radialGradient>` 를 id 로 참조한다.
 * 같은 문서에 같은 id 가 둘 이상이면 브라우저는 **먼저 나온 것 하나만** 쓴다.
 * 기록 카드를 여러 장 늘어놓으면 모든 카드가 첫 카드의 흐림을 쓰게 된다 — 조용히 틀린다.
 *
 *   renderFOV(a, { idPrefix: 'card1-' })
 *   renderFOV(b, { idPrefix: 'card2-' })
 *
 * 주의: 아트 디렉션(라인+플랫)은 기구 애셋에 적용된다. 시야는 광학 시뮬레이션이라
 * 초점 흐림에 필터를 쓴다. 색만은 팔레트를 공유한다 — 이 파일에 새 색 리터럴을 만들지 않는다.
 *
 * docs/05-fov-renderer.md · tasks/DESIGN-optics.md 참조.
 */

import { INK, PALETTE, STROKE } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng, hash, clamp } from '../assets/geometry.js';
import {
  RETICLE_DIVS, MAJOR_EVERY_DIV, STAGE_DIV_UM, STAGE_RULED_UM,
  STAGE_MICROMETER_FOCUS_EASE, focusTolerance,
  eyepieceDivPx, stageDivPx, pxPerUm, magnification,
  canResolveEyepieceTicks, canResolveEyepieceMajor,
  canResolveStageTicks, canResolveStageMajor,
  guardCellLengthPx,
} from '../sim/optics.js';

/** 시야 원의 기하. `radius × 2` 는 `optics.js` 의 `FIELD_PX_REF` 와 같아야 한다. */
export const FOV = { size: 360, radius: 164, cx: 180, cy: 180 };

/** 시야 원 지름 (px). 확대 뷰처럼 밖에서 같은 값을 써야 하는 곳을 위해 내보낸다. */
export const FIELD_PX = FOV.radius * 2;

/* ------------------------------------------------------------------ *
 * 색 — 전부 PALETTE 에서 온다. 여기서 새 색을 만들지 않는다.
 * ------------------------------------------------------------------ */

/** 밝은 시야의 바탕. 무염색 표본이라 유리색에 가깝다. */
const FIELD_BG = PALETTE.glass[0];

/**
 * 접안 눈금선은 잉크색, 대물 눈금선은 금속색으로 **갈라 둔다.**
 *
 * 실물은 둘 다 검게 보이지만, 학생이 해야 하는 일이 「접안 몇 칸 = 대물 몇 칸」을 세는 것이라
 * 두 자를 눈으로 못 가르면 셀 수가 없다. 대물 마이크로미터는 유리에 크롬을 입힌 것이므로
 * 금속색(bodyDark)이 거짓말도 아니다.
 */
const RETICLE_INK = INK;
const STAGE_INK = PALETTE.bodyDark[1];

/**
 * 공변세포 — 엽록체를 품고 있어 무염색으로도 연둣빛이 돈다.
 *
 * `EXP_PALETTE.leaf` 를 쓴다. 공용 PALETTE 의 초록은 `peelUnripe`(덜 익은 바나나 껍질)
 * 하나뿐이라 바나나를 쓰지 않는 이 실험이 거기 기대면, 그 색이 지워지는 날 표본이
 * 조용히 색을 잃는다 (`src/style/palette.experiment.js`).
 * 슬라이드 애셋 속 잎 조각과 같은 색이라, 재물대에 올린 것과 시야에 보이는 것이 이어진다.
 */
const GUARD = EXP_PALETTE.leaf;
/** 기공(구멍). 아래가 비어 있어 주변보다 짙게 보인다. */
const PORE = PALETTE.glass[1];

/** 금 간 유리 — 밝은 쪽과 어두운 쪽 두 줄을 겹쳐 그어 갈라진 면을 만든다. */
const CRACK_LIGHT = PALETTE.glass[0];
const CRACK_DARK = INK;

/**
 * 대비를 잃은 시야를 덮는 안개.
 *
 * 조리개는 **닫아도 열어도** 선을 흐린다 — 닫으면 어둡고, 활짝 열면 산란광이 대비를 씻는다
 * (`state.lineContrast`). 어둡게 덮으면 앞쪽만, 희게 덮으면 뒤쪽만 맞다.
 * 중간 회색으로 덮으면 두 경우 모두 「모든 것이 중간톤으로 몰려 구별이 안 된다」가 되어
 * 대비 손실 자체를 그린 것이 된다.
 */
const HAZE = PALETTE.metal[0];

/* ------------------------------------------------------------------ *
 * 렌더링 판정값 — 광학 상수가 아니라 "화면에 그릴 수 있는가"의 문제다.
 * ------------------------------------------------------------------ */

/** 판정 · 눈금 번호 크기 (px). 시야 원 328 px 에 굵은눈금 11개가 들어가는 크기다. */
const LABEL_SIZE = 8;

/** 판정 · 등폭 숫자 한 글자의 폭 (px). font-size 의 약 0.6 배다. */
const LABEL_CHAR_PX = LABEL_SIZE * 0.6;

/** 판정 · 옆 숫자와 벌려 둘 최소 틈 (px). 붙으면 두 숫자가 한 숫자로 읽힌다. */
const LABEL_GAP_PX = 2;

/**
 * 번호를 적을 수 있는가.
 *
 * `MAJOR_RESOLVE_PX(6)` 는 굵은 **선**을 가릴 수 있는 한계고, 이쪽은 **숫자가 옆 숫자와
 * 안 겹치는** 한계라 값이 다르다. 그리고 눈금자마다 가장 긴 번호가 다르므로
 * (접안은 「100」 세 글자, 대물은 「1000」 네 글자) 상수 하나로 정할 수 없다.
 * 잘못 적힌 번호는 없는 것보다 나쁘다 — 학생이 그 숫자를 그대로 받아 적기 때문이다.
 */
function labelFits(majorPitchPx, maxLabel) {
  return majorPitchPx >= String(maxLabel).length * LABEL_CHAR_PX + LABEL_GAP_PX;
}

/** 판정 · 잔눈금·굵은눈금이 축에서 뻗는 길이 (px). */
const TICK_LEN = 6;
const MAJOR_LEN = 11;

/**
 * 판정 · 표피세포 한 변을 공변세포 길이의 몇 배로 볼 것인가.
 *
 * **측정 대상이 아니다.** 학생이 재는 것은 공변세포 장축(`guardCellLengthUm`)뿐이고,
 * 표피세포는 그 세포가 어디에 박혀 있는지 보여 주는 배경이다. 그래서 실측 상수를 새로
 * 지어내는 대신 공변세포 길이에 묶어 둔다 — 배율을 바꿔도 둘의 비가 유지되고,
 * 시드가 달라도 배경이 따로 놀지 않는다. 자주달개비 표피세포가 공변세포보다 훨씬 크다는
 * 사실만 담으면 되는 자리다 (약 150 µm).
 */
const EPI_PER_GUARD = 2.6;

/**
 * 판정 · 표피세포 몇 칸에 기공 하나를 둘 것인가 (0~1).
 * 표피세포 한 변 150 µm 기준으로 약 33 /mm² — 400배 시야(0.16 mm²)에 5~6개가 들어온다.
 * 한 시야에 재 볼 세포가 여럿 있되, 세느라 헷갈릴 만큼 빽빽하지는 않은 밀도다.
 */
const STOMA_FRACTION = 0.75;

/**
 * 판정 · 기공 구멍을 개별 도형으로 그릴 수 있는 최소 높이 (px).
 * 이보다 얇으면 위아래 선이 붙어 버려 구멍이 아니라 얼룩이 된다.
 * 그 아래에서는 기공 복합체를 **한 덩어리 타원 하나**로 그린다 — 실제로도 분해되지 않는다.
 */
const PORE_MIN_PX = 2;

/* ------------------------------------------------------------------ *
 * 부르는 쪽이 속성만 갱신할 때 쓰는 식. **여기 한 곳에만 적는다.**
 * ------------------------------------------------------------------ */

/**
 * 초점 흐림 (px). **재물대 위의 것에만 걸린다.**
 *
 * 대물 마이크로미터는 유리에 증착한 크롬 선이라 두께가 없어 초점면이 하나뿐이다.
 * 조직 절편보다 잡기 쉬우므로 같은 `focusErr` 라도 덜 흐리다
 * (`STAGE_MICROMETER_FOCUS_EASE`). 「100배에서 눈금에 먼저 초점을 맞춘다」는
 * 절차가 성립하는 이유가 이것이라 화면에도 나와야 한다.
 */
export function focusBlurPx(p) {
  const ease = p.on === 'stageMic' ? STAGE_MICROMETER_FOCUS_EASE : 1;
  /**
   * ★ **허용 범위 안은 초점 심도(depth of field) 안이다 — 흐리지 않는다.**
   *
   * 앞서는 오차에 그대로 비례해 흐렸다. 그러면 화면이 「초점이 맞았습니다」라고 말하고
   * 게이지가 99 를 찍는 동안에도 상은 조금 흐렸고, **세는 띠(8배)에서는 그 「조금」이
   * 여덟 배**가 되어 대물 눈금선이 뭉개졌다. 플레이해 보니 100배·오차 0.06 (허용 0.24 의
   * 4분의 1)에서 띠의 대물 눈금이 회색 얼룩이었다 — 「맞았다」는 자리에서 셀 수가 없었다.
   *
   * 초점 허용 범위(`focusTolerance`)는 곧 초점 심도다. 그 안에서는 상이 또렷하고, 벗어난
   * 만큼만 흐려진다. 그래서 「맞았습니다」·게이지 1.0·또렷한 그림이 **같은 경계**를 쓴다.
   * 22 라는 기울기는 그대로다 — 벗어난 뒤 얼마나 빨리 흐려지는지는 바꾸지 않았다.
   */
  const tol = focusTolerance(p.objective ?? 10, p.on === 'stageMic' ? 'micrometer' : 'specimen');
  const beyond = Math.max(0, (p.focusErr || 0) - tol);
  return (beyond * 22) / ease;
}

/** 안개의 진하기 0~1. 대비를 다 잃어도 형체는 남긴다 — 무엇이 있었는지는 보여야 한다. */
export function hazeOpacity(p) {
  return (1 - clamp(p.contrast ?? 1, 0, 1)) * 0.55;
}

/* ------------------------------------------------------------------ *
 * 접안 눈금 레이어 — 배율이 닿지 않는 곳
 * ------------------------------------------------------------------ */

/**
 * 접안 마이크로미터 한 겹.
 *
 * **`objective` 를 인자로 받지 않는다.** 이 함수가 배율을 알 방법이 없어야
 * 실수로도 함께 확대할 수가 없다. `optics.js` 의 `eyepieceDivPx(fieldPx)` 도 같은 모양이다.
 * 인자를 늘리고 싶어지면 그 전에 이 파일 머리말을 다시 읽을 것.
 *
 * 시야를 꽉 채우지 않는다 — 눈금자는 10 mm 인데 시야는 18 mm 라 **55.6 %** 만 가로지른다.
 * 남는 자리가 있는 것이 맞다. 채우려고 칸을 늘리면 한 칸의 µm 값이 통째로 틀어진다.
 *
 * @param {number} fieldPx  시야 원의 지름 (px)
 * @param {{flipped?: boolean, angleDeg?: number}} [opts]
 * @returns {string} SVG 조각
 */
export function reticleLayer(fieldPx, { flipped = false, angleDeg = 0 } = {}) {
  const { cx: CX, cy: CY } = FOV;
  const divPx = eyepieceDivPx(fieldPx);
  const span = RETICLE_DIVS * divPx;
  const x0 = CX - span / 2;
  const at = (k) => x0 + k * divPx;

  // 잔눈금 — 시야 원에서는 한 칸이 1.8 px 라 개별 선으로 그릴 수가 없다.
  // 억지로 그으면 앨리어싱으로 없는 무늬가 생겨, 세라고 그린 것이 셀 수 없게 그려진다.
  // 못 그리는 자리에는 옅은 띠를 둔다 — 「여기 눈금이 있지만 여기서는 못 센다」가
  // 화면으로 전해져야 학생이 확대 뷰를 열 이유가 생긴다.
  let ticks = '';
  if (canResolveEyepieceTicks(fieldPx)) {
    for (let k = 0; k <= RETICLE_DIVS; k++) {
      if (k % MAJOR_EVERY_DIV === 0) continue;   // 굵은 눈금 자리는 아래에서 그린다
      const x = at(k).toFixed(2);
      ticks += `<line x1="${x}" y1="${CY}" x2="${x}" y2="${CY + TICK_LEN}"/>`;
    }
  } else {
    ticks += `<rect x="${x0.toFixed(2)}" y="${CY}" width="${span.toFixed(2)}"` +
      ` height="${TICK_LEN}" fill="${RETICLE_INK}" stroke="none" opacity="0.16"/>`;
  }

  let majors = '', labels = '';
  if (canResolveEyepieceMajor(fieldPx)) {
    const label = labelFits(divPx * MAJOR_EVERY_DIV, RETICLE_DIVS);
    for (let k = 0; k <= RETICLE_DIVS; k += MAJOR_EVERY_DIV) {
      const x = at(k).toFixed(2);
      majors += `<line x1="${x}" y1="${CY}" x2="${x}" y2="${CY + MAJOR_LEN}"/>`;
      if (label) labels += `<text x="${x}" y="${CY + MAJOR_LEN + LABEL_SIZE + 2}">${k}</text>`;
    }
  }

  // 뒤집어 끼운 눈금자 — 새겨진 면을 뒤에서 보는 것이라 숫자가 좌우로 뒤집히고
  // 번호 순서도 거꾸로가 된다. **눈금선 자리는 하나도 안 변한다** (좌우 대칭이므로).
  // 그래서 값은 틀리지 않고 읽기만 불편해진다 — 거울 변환 하나가 그 사실을 통째로 담는다.
  // 눈금선 문자열을 손대지 않으므로 「뒤집어도 간격은 같다」가 코드에서 눈으로 보인다.
  const labelGroup = labels
    ? `<g font-family="ui-monospace, monospace" font-size="${LABEL_SIZE}" text-anchor="middle"` +
      ` fill="${RETICLE_INK}"` +
      (flipped ? ` transform="translate(${(CX * 2).toFixed(2)},0) scale(-1,1)"` : '') +
      `>${labels}</g>`
    : '';

  const axis = `<line x1="${x0.toFixed(2)}" y1="${CY}" x2="${(x0 + span).toFixed(2)}" y2="${CY}"/>`;

  return `<g transform="rotate(${angleDeg.toFixed(2)} ${CX} ${CY})">` +
    `<g stroke="${RETICLE_INK}" fill="none" stroke-linecap="butt">` +
    `<g stroke-width="${STROKE.hair}">${axis}${ticks}</g>` +
    `<g stroke-width="${STROKE.detail}">${majors}</g>` +
    `</g>${labelGroup}</g>`;
}

/* ------------------------------------------------------------------ *
 * 재물대 위 — 배율을 그대로 따라가는 곳
 * ------------------------------------------------------------------ */

/**
 * 대물 마이크로미터 한 겹. **이쪽은 `objective` 를 받는다** — 재물대 위에 있으므로
 * 배율을 올린 만큼 화면에서 벌어진다. 접안 눈금과의 이 차이가 실험의 전부다.
 *
 * 눈금이 새겨진 부분은 슬라이드 한가운데 1 mm 뿐이다. 4배에서 73 px 짜리 작은 자국이라
 * 「저배율로 찾아서 중앙에 놓는다」는 단계가 하드 게이트 없이 저절로 생긴다.
 *
 * 접안 눈금은 축에서 **아래로**, 대물 눈금은 **위로** 뻗는다. 두 자가 같은 선을 공유하되
 * 겹쳐 뭉개지지 않아야 어느 눈금선끼리 짝인지 눈으로 고를 수 있다.
 */
function stageMicrometerLayer(objective, fieldPx) {
  const { cx: CX, cy: CY } = FOV;
  const divPx = stageDivPx(objective, fieldPx);
  const divs = STAGE_RULED_UM / STAGE_DIV_UM;
  const span = divs * divPx;
  const x0 = CX - span / 2;
  const at = (k) => x0 + k * divPx;

  let ticks = '';
  if (canResolveStageTicks(objective, fieldPx)) {
    for (let k = 0; k <= divs; k++) {
      if (k % MAJOR_EVERY_DIV === 0) continue;
      const x = at(k).toFixed(2);
      ticks += `<line x1="${x}" y1="${CY}" x2="${x}" y2="${CY - TICK_LEN}"/>`;
    }
  } else {
    // 4·10배에서는 한 칸이 0.7~1.8 px 라 개별 선이 안 된다. 여기서도 띠로 대신한다.
    ticks += `<rect x="${x0.toFixed(2)}" y="${CY - TICK_LEN}" width="${span.toFixed(2)}"` +
      ` height="${TICK_LEN}" fill="${STAGE_INK}" stroke="none" opacity="0.20"/>`;
  }

  let majors = '', labels = '';
  if (canResolveStageMajor(objective, fieldPx)) {
    const label = labelFits(divPx * MAJOR_EVERY_DIV, STAGE_RULED_UM);
    for (let k = 0; k <= divs; k += MAJOR_EVERY_DIV) {
      const x = at(k).toFixed(2);
      majors += `<line x1="${x}" y1="${CY}" x2="${x}" y2="${CY - MAJOR_LEN}"/>`;
      // 번호는 µm 로 적는다. **이 실험에서 학생이 아는 값은 이것뿐**이라
      // 단위를 바꿔 적으면 보정식의 출발점이 사라진다.
      if (label) labels += `<text x="${x}" y="${CY - MAJOR_LEN - 3}">${k * STAGE_DIV_UM}</text>`;
    }
  }

  const axis = `<line x1="${x0.toFixed(2)}" y1="${CY}" x2="${(x0 + span).toFixed(2)}" y2="${CY}"/>`;
  const labelGroup = labels
    ? `<g font-family="ui-monospace, monospace" font-size="${LABEL_SIZE}" text-anchor="middle"` +
      ` fill="${STAGE_INK}">${labels}</g>`
    : '';

  return `<g stroke="${STAGE_INK}" fill="none" stroke-linecap="butt">` +
    `<g stroke-width="${STROKE.hair}">${axis}${ticks}</g>` +
    `<g stroke-width="${STROKE.detail}">${majors}</g>` +
    `</g>${labelGroup}`;
}

/**
 * 자주달개비 잎 표피 — 표피세포 바탕에 기공 복합체가 흩어져 있다.
 *
 * 세포 길이는 `optics.js` 의 `guardCellLengthPx()` 에서 온다. **여기서 숫자를 짓지 않는다** —
 * 학생이 재서 얻을 답이 그 함수 하나로 정해져 있어야 화면과 기록이 어긋나지 않는다.
 *
 * 모양은 그리는 순서가 아니라 **좌표의 순수 함수**다 (`hash`). 그래서 재물대를 옮겨도
 * 같은 세포는 같은 자리에 같은 모양으로 남고, 보이는 범위만 만들면 된다.
 */
function specimenLayer(objective, fieldPx, seed, panX, panY) {
  const FS = FOV.size;
  const guardPx = guardCellLengthPx(objective, fieldPx, seed);
  const epi = guardPx * EPI_PER_GUARD;

  // 보이는 세계 좌표 창 [pan, pan + FS] 을 덮는 칸만 만든다.
  // 생성 범위를 통째로 넓히면 4배에서 요소가 몇 배로 늘어 성능이 무너진다.
  const i0 = Math.floor(panX / epi) - 1, i1 = Math.ceil((panX + FS) / epi) + 1;
  const j0 = Math.floor(panY / epi) - 1, j1 = Math.ceil((panY + FS) / epi) + 1;

  // 표피세포 벽은 색이 하나뿐이라 <g> 에 한 번만 적고 도형에는 좌표만 남긴다.
  // 저배율에서는 칸이 10 px 남짓이라 선이 그물처럼 뭉치므로 옅게 깐다.
  const wallOpacity = clamp(epi / 90, 0.14, 0.42).toFixed(2);
  const w = (epi * 0.92).toFixed(1), rx = (epi * 0.18).toFixed(1);
  const pore = guardPx * 0.06 >= PORE_MIN_PX;

  let walls = '', bodies = '', pores = '';
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const x = i * epi + (hash(seed, 1, i, j) - 0.5) * epi * 0.18;
      const y = j * epi + (hash(seed, 2, i, j) - 0.5) * epi * 0.18;
      walls += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${w}" rx="${rx}"/>`;

      if (hash(seed, 3, i, j) >= STOMA_FRACTION) continue;
      // 기공은 표피세포 한가운데가 아니라 조금씩 비껴 앉는다.
      const sx = x + epi * (0.30 + hash(seed, 4, i, j) * 0.34);
      const sy = y + epi * (0.30 + hash(seed, 5, i, j) * 0.34);
      const g = `rotate(${(hash(seed, 6, i, j) * 180).toFixed(0)} ${sx.toFixed(1)} ${sy.toFixed(1)})`;
      const L = guardPx;

      if (pore) {
        // 공변세포 두 개가 구멍을 사이에 두고 마주 본다.
        // **장축 반지름이 L/2 다** — 학생이 재는 「세포 하나의 길이」가 정확히 L 이 되게 한다.
        for (const s of [-1, 1]) {
          bodies += `<ellipse cx="${sx.toFixed(1)}" cy="${(sy + s * L * 0.15).toFixed(1)}"` +
            ` rx="${(L / 2).toFixed(2)}" ry="${(L * 0.16).toFixed(2)}" transform="${g}"/>`;
        }
        pores += `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}"` +
          ` rx="${(L * 0.32).toFixed(2)}" ry="${(L * 0.06).toFixed(2)}" transform="${g}"/>`;
      } else {
        // 저배율 — 구멍이 분해되지 않는다. 성능 때문이 아니라 실제로 그렇다.
        // 여기서 「하나로 뭉친 점」으로만 보이는 것이 배율을 올릴 이유가 된다.
        bodies += `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}"` +
          ` rx="${(L / 2).toFixed(2)}" ry="${(L * 0.28).toFixed(2)}" transform="${g}"/>`;
      }
    }
  }

  return `<g fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" opacity="${wallOpacity}">${walls}</g>` +
    `<g fill="${GUARD[0]}" stroke="${GUARD[1]}" stroke-width="${STROKE.hair}">${bodies}</g>` +
    (pores ? `<g fill="${PORE}" stroke="${GUARD[1]}" stroke-width="${STROKE.hair}">${pores}</g>` : '');
}

/** 금 간 유리 — 가장자리에서 시작해 시야를 가로지르는 선 3~5개. 슬라이드에 붙어 함께 움직인다. */
function crackLayer(seed) {
  const { radius: R, cx: CX, cy: CY } = FOV;
  const r = rng(seed);
  let out = '';
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    let x = CX + Math.cos(a) * R, y = CY + Math.sin(a) * R;
    let dir = a + Math.PI + (r() - 0.5) * 0.9;
    const pts = [`${x.toFixed(1)},${y.toFixed(1)}`];
    for (let k = 0; k < 5; k++) {
      dir += (r() - 0.5) * 0.7;
      x += Math.cos(dir) * R * 0.46;
      y += Math.sin(dir) * R * 0.46;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const d = pts.join(' ');
    out += `<polyline points="${d}" fill="none" stroke="${CRACK_LIGHT}" stroke-width="${STROKE.detail}" stroke-linejoin="round"/>` +
      `<polyline points="${d}" fill="none" stroke="${CRACK_DARK}" stroke-width="${STROKE.hair}" opacity="0.45" stroke-linejoin="round"/>`;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 시야 한 장
 * ------------------------------------------------------------------ */

const ON_LABEL = { stageMic: '대물 마이크로미터', specimen: '자주달개비 잎 표피' };

/**
 * 시야 아래에 적는 말에 **시야 지름(µm)을 적지 않는다.**
 *
 * 바나나랩은 「시야 지름 약 450 µm」를 적었다. 여기서 그러면 안 된다 —
 * 눈금자가 시야의 55.6 % 를 가로지르는 것이 화면에 보이므로, 시야 지름을 알려 주는 순간
 * 「눈금자 전체 = 지름 × 0.556, 그것을 100으로 나눈다」로 한 칸의 µm 값이 바로 나온다.
 * 그건 이 실험이 학생에게 시키려는 보정 그 자체다.
 *
 * 총배율은 대물렌즈에 인쇄돼 있어 실물에서도 아는 값이라 적어도 된다.
 *
 * @param {object} p  `state.fieldParams()` 의 결과
 * @param {{idPrefix?: string}} [opts]  한 문서에 여러 장을 그릴 때 서로 다르게 준다
 * @returns {string} SVG 문자열
 */
export function renderFOV(p, { idPrefix = '' } = {}) {
  const id = (name) => `${idPrefix}${name}`;
  const ref = (name) => `url(#${idPrefix}${name})`;
  const { size: FS, radius: R, cx: CX, cy: CY } = FOV;
  const fieldPx = R * 2;
  const seed = p.seed || 1;
  const panX = p.panX || 0, panY = p.panY || 0;

  // 재물대 위의 것. 놓인 각도(itemAngle)만큼 함께 돈다 — 접안 눈금자와 이 각도의 차이가
  // `state.angleGap()` 이고, 그 차이가 셀 수 있는 칸 수를 깎는다 (`optics.usableRunDiv`).
  let onStage = '';
  if (p.on === 'stageMic') onStage = stageMicrometerLayer(p.objective, fieldPx);
  else if (p.on === 'specimen') onStage = specimenLayer(p.objective, fieldPx, seed, panX, panY);

  const tilted = onStage
    ? `<g transform="rotate(${(p.itemAngle || 0).toFixed(2)} ${CX} ${CY})">${onStage}</g>` : '';
  const cracks = p.cracked && p.on ? crackLayer(seed) : '';

  // 상은 재물대와 반대로 움직인다. 실제 현미경은 상이 뒤집혀 있어서
  // 재물대를 오른쪽으로 밀면 상은 왼쪽으로 간다.
  // **transform 문자열의 모양을 바꾸지 말 것** — 드래그 중에는 src/ui 가 이 속성만 갱신한다.
  const scene = `<g id="${id('fov-scene')}" transform="translate(${(-panX).toFixed(1)},${(-panY).toFixed(1)})">${tilted}${cracks}</g>`;

  // 접안 눈금 — pan 도 배율도 초점도 닿지 않는 자리. **scene 밖이어야 한다.**
  const reticle = p.hasReticle
    ? reticleLayer(fieldPx, { flipped: p.flipped, angleDeg: p.eyeAngle || 0 })
    : '';

  const blur = focusBlurPx(p);
  const haze = hazeOpacity(p);
  const mag = magnification(p.objective);
  const aria = `현미경 시야 — ${ON_LABEL[p.on] ?? '빈 재물대'}, 총 ${mag}배` +
    (p.hasReticle ? ', 접안 눈금 있음' : '');

  return `<svg viewBox="0 0 ${FS} ${FS}" role="img" aria-label="${aria}">
  <defs>
    <clipPath id="${id('fov-clip')}"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
    <filter id="${id('fov-blur')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/></filter>
    <radialGradient id="${id('fov-vig')}"><stop offset=".7" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".28"/></radialGradient>
  </defs>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="${FIELD_BG}"/>
  <g clip-path="${ref('fov-clip')}">
    <g filter="${ref('fov-blur')}">${scene}</g>
    <g id="${id('fov-reticle')}">${reticle}</g>
    <rect id="${id('fov-dark')}" x="0" y="0" width="${FS}" height="${FS}" fill="${HAZE}" opacity="${haze.toFixed(2)}"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${ref('fov-vig')}"/>
  </g>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${INK}" stroke-opacity="0.3" stroke-width="4"/>
  <text x="${CX}" y="${FS - 6}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="${INK}" fill-opacity="0.42">총 ${mag}배</text>
</svg>`;
}

/** µm → px. **재물대 위의 것에만 쓴다.** 접안 눈금에 쓰면 배율이 새어 들어간다. */
export function stagePxPerUm(objective) {
  return pxPerUm(objective, FIELD_PX);
}
