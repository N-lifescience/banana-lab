/**
 * 결과 렌더러 — 거름종이 위의 색 띠.
 *
 * 바나나랩의 `fov.js`(현미경 시야) 자리에 오는 파일이다. 이 실험에는 현미경이 없다.
 * 그림은 미리 그려 두지 않고 상태에서 매번 생성한다. 그래야 찍은 횟수·전개 시간·전개액
 * 깊이를 바꾼 결과가 정직하게 반영되고, 기록이 이미지 대신 값 한 벌만 담을 수 있다.
 *
 * 주의: 아트 디렉션(라인+플랫)은 **기구 애셋에만** 적용된다. 이 파일은 예외다 —
 * 젖은 자국과 번진 띠는 굵은 외곽선으로 그릴 수 없다. **애셋을 만드는 사람은 이 파일을
 * 읽지 마세요.** 따라 쓰면 애셋이 오염됩니다. 다만 색은 팔레트를 공유한다.
 *
 * docs/05-strip-renderer.md 참조.
 */

import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng, clamp } from '../assets/geometry.js';
import {
  PAPER_W_MM, PAPER_H_MM, ORIGIN_MM,
  PIGMENTS, INK_BANDS, bandMm, bandWidthMm,
} from '../sim/develop.js';

/**
 * 그림의 크기. mm 를 px 로 바꾸는 계수가 여기서 나온다.
 *
 * 폭은 **종이 폭에서 나온다** — 여기에 숫자를 따로 적어 두면 종이 비율을 바꿀 때
 * 어긋나서, 좁은 종이 옆에 빈 여백이 넓게 남는다. `padX` 는 왼쪽의 자 자리다.
 */
export const STRIP = { h: 460, padX: 46, padTop: 24, padBottom: 34, padRight: 16 };

/** 종이의 화면 크기 — 실물 2 × 10 cm 의 비를 그대로 지킨다. */
const PAPER_PX_H = STRIP.h - STRIP.padTop - STRIP.padBottom;
const PAPER_PX_W = (PAPER_PX_H * PAPER_W_MM) / PAPER_H_MM;
const PAPER_X = STRIP.padX;
const PAPER_BOTTOM = STRIP.h - STRIP.padBottom;
/** 그림 전체 폭. 자 + 종이 + 이름표 자리. */
STRIP.w = Math.round(STRIP.padX + PAPER_PX_W + STRIP.padRight + 56);

/** mm(아랫단 기준) → 화면 y */
const yOf = (mm) => PAPER_BOTTOM - (mm / PAPER_H_MM) * PAPER_PX_H;
/** mm 길이 → 화면 길이 */
const lenOf = (mm) => (mm / PAPER_H_MM) * PAPER_PX_H;

const PAPER_FILL = '#FBF8EE';
const PAPER_EDGE = 'rgba(120,116,100,.55)';
const WET_FILL = 'rgba(196,206,214,.34)';
const PENCIL = 'rgba(86,90,96,.85)';
const PEN_INK = '#3E4180';
const GRIT = 'rgba(96,86,58,.5)';
const RULER_FILL = 'rgba(255,255,255,.86)';
const RULER_LINE = 'rgba(70,74,80,.75)';

const esc = (n) => Number(n).toFixed(2);

/**
 * 띠 하나를 그린다.
 *
 * 세로로 옅어지는 것은 실제로 그렇다 — 띠의 가운데가 가장 진하고 위아래로 번진다.
 * 그라데이션 금지는 **기구 애셋의 규칙**이고, 이 파일은 그 예외다 (파일 머리말 참조).
 */
function bandShape(id, tone, centerMm, widthMm, alpha, seed) {
  const y = yOf(centerMm);
  const h = Math.max(3, lenOf(widthMm));
  const [base] = EXP_PALETTE[tone];
  const r = rng(seed);
  // 좌우 가장자리가 실제로는 반듯하지 않다. 시드에서 나오므로 다시 그려도 같다.
  const wobble = 1.5 + r() * 2.5;
  return {
    def: `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${base}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${base}" stop-opacity="${esc(alpha)}"/>
      <stop offset="1" stop-color="${base}" stop-opacity="0"/>
    </linearGradient>`,
    shape: `<rect x="${esc(PAPER_X + wobble)}" y="${esc(y - h / 2)}"
          width="${esc(PAPER_PX_W - wobble * 2)}" height="${esc(h)}"
          fill="url(#${id})" rx="${esc(Math.min(6, h / 2))}"/>`,
  };
}

/**
 * 지금 종이에 보이는 띠 목록.
 *
 * **화면과 품질 계산이 같은 답을 쓰게 하려고 밖으로 낸다.** 두 곳에서 따로 세면
 * "띠가 넷 보인다" 와 "넷 다 갈라졌다" 가 어긋난다.
 *
 * Rf 는 여기서 계산하지 않는다 — 앱은 정답 Rf 를 갖고 있지 않다 (develop.js).
 */
export function visibleBands(p) {
  const originMm = p.originMm ?? ORIGIN_MM;
  const front = p.frontMm ?? 0;
  const load = p.load ?? 0;
  if (load <= 0 || p.submerged) return [];

  const kept = p.chlorophyllKept ?? 1;
  const out = [];
  for (const pig of PIGMENTS) {
    const at = bandMm(pig.rf, front, originMm);
    const alpha = load * (pig.lightSensitive ? kept : 1);
    if (alpha <= 0.01) continue;
    out.push({
      id: pig.id,
      tone: pig.tone,
      atMm: at,
      widthMm: bandWidthMm(p.spotMm ?? 2, at - originMm),
      alpha: clamp(alpha, 0, 1),
      ink: false,
    });
  }
  // 볼펜으로 그었으면 잉크의 염료도 함께 올라간다. 색소가 아니므로 따로 붙인다.
  if (p.marker === 'pen') {
    for (const b of INK_BANDS) {
      const at = bandMm(b.rf, front, originMm);
      out.push({
        id: b.id, tone: b.tone, atMm: at,
        widthMm: bandWidthMm((p.spotMm ?? 2) * 0.8, at - originMm),
        alpha: 0.55, ink: true,
      });
    }
  }
  return out;
}

/**
 * 거름종이 한 장을 그린다.
 *
 * 같은 params + 같은 seed 면 **같은 문자열**이 나온다. 그래야 기록해 두었다가 탐구 노트와
 * 보고서에서 되살릴 수 있다.
 *
 * ── `idPrefix` 를 반드시 넘길 것 ────────────────────────────────────
 * 이 SVG 는 `<clipPath>` 와 `<linearGradient>` 를 id 로 참조한다. 같은 문서에 같은 id 가
 * 둘 이상 있으면 브라우저는 **먼저 나온 것 하나만** 쓴다. 결과 카드를 여러 장 늘어놓으면
 * 모든 카드가 첫 카드의 띠 색을 쓰게 되어 **에러 없이 조용히 틀린다.**
 *
 *   renderStrip(a, { idPrefix: 'card1-' })
 *   renderStrip(b, { idPrefix: 'card2-' })
 *
 * @param {object} p  state.stripParams() 의 결과
 * @param {{idPrefix?: string, labels?: boolean}} [opts]
 *   labels 는 **기본이 꺼짐**이다. 띠 이름을 기본으로 켜 두면 화면이 채점할 답을
 *   먼저 말하는 셈이 된다. 정리 단계에서 대조할 때만 켠다.
 * @returns {string} SVG 문자열
 */
export function renderStrip(p = {}, { idPrefix = '', labels = false } = {}) {
  const uid = (name) => `${idPrefix}strip-${name}`;
  const originMm = p.originMm ?? ORIGIN_MM;
  const seed = p.seed ?? 0;

  if (p.torn) return tornPaper(uid);

  const bands = visibleBands(p);
  const defs = [];
  const shapes = [];

  // 젖은 부분 — 전선 아래는 색이 살짝 짙다
  const wetTo = p.inVial ? (p.frontMm ?? 0) : (p.wetness > 0.05 ? (p.frontMm ?? 0) : 0);
  if (wetTo > 0) {
    shapes.push(`<rect x="${esc(PAPER_X)}" y="${esc(yOf(wetTo))}"
      width="${esc(PAPER_PX_W)}" height="${esc(PAPER_BOTTOM - yOf(wetTo))}" fill="${WET_FILL}"/>`);
  }

  // 전개액에 잠긴 부분
  if (p.inVial && (p.depthMm ?? 0) > 0) {
    shapes.push(`<rect x="${esc(PAPER_X)}" y="${esc(yOf(p.depthMm))}"
      width="${esc(PAPER_PX_W)}" height="${esc(PAPER_BOTTOM - yOf(p.depthMm))}"
      fill="${EXP_PALETTE.devSolvent[0]}" fill-opacity="0.5"/>`);
  }

  // 잎 부스러기 — 층이 갈리기 전에 뽑으면 원점에 얼룩이 남는다
  if ((p.grit ?? 0) > 0.02) {
    const r = rng(seed + 41);
    for (let i = 0; i < Math.round(p.grit * 14); i++) {
      const gx = PAPER_X + 4 + r() * (PAPER_PX_W - 8);
      const gy = yOf(originMm) + (r() - 0.5) * lenOf((p.spotMm ?? 2) * 1.6);
      shapes.push(`<circle cx="${esc(gx)}" cy="${esc(gy)}" r="${esc(0.8 + r() * 1.4)}" fill="${GRIT}"/>`);
    }
  }

  // 색 띠 — 아래에서 위로 그려 위엣것이 겹칠 때 앞에 오게 한다
  for (const b of [...bands].sort((a, c) => a.atMm - c.atMm)) {
    const { def, shape } = bandShape(uid(`band-${b.id}`), b.tone, b.atMm, b.widthMm, b.alpha, seed + b.id.length);
    defs.push(def);
    shapes.push(shape);
  }

  // 원점에 남은 자국 — 다 올라가지 못하고 남은 색소
  if (!p.submerged && (p.load ?? 0) > 0 && (p.frontMm ?? 0) <= originMm) {
    shapes.push(`<ellipse cx="${esc(PAPER_X + PAPER_PX_W / 2)}" cy="${esc(yOf(originMm))}"
      rx="${esc(lenOf((p.spotMm ?? 2) / 2))}" ry="${esc(lenOf((p.spotMm ?? 2) / 2))}"
      fill="${EXP_PALETTE.pigmentJuice[0]}" fill-opacity="${esc(clamp(p.load, 0, 1) * 0.85)}"/>`);
  }

  // 원점 선. 연필이면 흐린 회색, 볼펜이면 잉크색 — 볼펜은 위로 번져 올라간 자국도 남는다
  if (p.marker) {
    const color = p.marker === 'pen' ? PEN_INK : PENCIL;
    shapes.push(`<line x1="${esc(PAPER_X)}" y1="${esc(yOf(originMm))}"
      x2="${esc(PAPER_X + PAPER_PX_W)}" y2="${esc(yOf(originMm))}"
      stroke="${color}" stroke-width="1.4" stroke-dasharray="${p.marker === 'pen' ? 'none' : '5 3'}"/>`);
  }

  // 표시해 둔 용매 전선 (연필 선). 넘어갔으면 그리지 않는다 — 어디였는지 알 수 없다
  if (p.markedFront !== null && p.markedFront !== undefined && !p.overrun) {
    shapes.push(`<line x1="${esc(PAPER_X)}" y1="${esc(yOf(p.markedFront))}"
      x2="${esc(PAPER_X + PAPER_PX_W)}" y2="${esc(yOf(p.markedFront))}"
      stroke="${PENCIL}" stroke-width="1.4" stroke-dasharray="5 3"/>`);
  }

  // 아직 젖어 있으면 지금 전선이 눈에 보인다
  if (!p.overrun && (p.wetness ?? 0) > 0.15 && (p.frontMm ?? 0) > 0) {
    shapes.push(`<line x1="${esc(PAPER_X)}" y1="${esc(yOf(p.frontMm))}"
      x2="${esc(PAPER_X + PAPER_PX_W)}" y2="${esc(yOf(p.frontMm))}"
      stroke="rgba(120,140,160,.7)" stroke-width="2"/>`);
  }

  const marks = p.markedBands ? bandTicks(bands) : '';
  const ruler = p.rulerPlaced ? rulerShape(uid('ruler')) : '';
  const legend = labels ? bandLabels(bands) : '';

  return `<svg class="strip" viewBox="0 0 ${STRIP.w} ${STRIP.h}" width="${STRIP.w}" height="${STRIP.h}"
    xmlns="http://www.w3.org/2000/svg" role="img" aria-label="거름종이">
  <defs>
    <clipPath id="${uid('clip')}">
      <rect x="${esc(PAPER_X)}" y="${esc(STRIP.padTop)}" width="${esc(PAPER_PX_W)}" height="${esc(PAPER_PX_H)}" rx="2"/>
    </clipPath>
    ${defs.join('')}
  </defs>
  <rect x="${esc(PAPER_X)}" y="${esc(STRIP.padTop)}" width="${esc(PAPER_PX_W)}" height="${esc(PAPER_PX_H)}"
        rx="2" fill="${PAPER_FILL}" stroke="${PAPER_EDGE}" stroke-width="1"/>
  <g clip-path="url(#${uid('clip')})">${shapes.join('')}</g>
  ${marks}${ruler}${legend}
</svg>`;
}

/** 찢어진 종이. 여기서는 잴 것도 볼 것도 없다. */
function tornPaper(uid) {
  const midX = PAPER_X + PAPER_PX_W / 2;
  return `<svg class="strip strip--torn" viewBox="0 0 ${STRIP.w} ${STRIP.h}" width="${STRIP.w}" height="${STRIP.h}"
    xmlns="http://www.w3.org/2000/svg" role="img" aria-label="찢어진 거름종이">
  <path d="M${esc(PAPER_X)},${esc(STRIP.padTop)} H${esc(midX - 6)} l-5,${esc(PAPER_PX_H * 0.3)}
           l7,${esc(PAPER_PX_H * 0.22)} l-6,${esc(PAPER_PX_H * 0.24)} l4,${esc(PAPER_PX_H * 0.24)}
           H${esc(PAPER_X)} Z"
        fill="${PAPER_FILL}" stroke="${PAPER_EDGE}" stroke-width="1"/>
  <path d="M${esc(midX + 6)},${esc(STRIP.padTop)} H${esc(PAPER_X + PAPER_PX_W)} V${esc(PAPER_BOTTOM)}
           H${esc(midX + 2)} l4,${esc(-PAPER_PX_H * 0.24)} l-6,${esc(-PAPER_PX_H * 0.24)}
           l7,${esc(-PAPER_PX_H * 0.22)} Z"
        fill="${PAPER_FILL}" stroke="${PAPER_EDGE}" stroke-width="1"/>
</svg>`;
}

/** 색 띠 위치에 연필로 그은 짧은 표시 */
function bandTicks(bands) {
  return bands.filter((b) => !b.ink).map((b) => `<line
    x1="${esc(PAPER_X - 7)}" y1="${esc(yOf(b.atMm))}" x2="${esc(PAPER_X - 1)}" y2="${esc(yOf(b.atMm))}"
    stroke="${PENCIL}" stroke-width="1.4"/>`).join('');
}

/**
 * 띠 이름표. **기본으로 켜 두지 않는다** — 화면이 채점할 답을 먼저 말하게 된다.
 * 이름만 붙이고 **거리나 Rf 는 적지 않는다.** 그건 학생이 자로 재어 구하는 값이다.
 */
const BAND_LABEL = {
  carotene: '카로틴', xanthophyll: '잔토필',
  chlorophyllA: '엽록소 a', chlorophyllB: '엽록소 b',
  inkA: '볼펜 잉크', inkB: '볼펜 잉크',
};
function bandLabels(bands) {
  return bands.map((b) => `<text x="${esc(PAPER_X + PAPER_PX_W + 6)}" y="${esc(yOf(b.atMm) + 4)}"
    font-size="10" fill="currentColor" opacity="0.75">${BAND_LABEL[b.id] ?? b.id}</text>`).join('');
}

/**
 * 자. 종이 왼쪽에 붙는 mm 눈금이다.
 * **여기에 숫자로 답을 적어 두지 않는다** — 눈금만 그리고, 읽는 것은 학생이다.
 */
function rulerShape(id) {
  const ticks = [];
  for (let mm = 0; mm <= PAPER_H_MM; mm += 5) {
    const big = mm % 10 === 0;
    ticks.push(`<line x1="${esc(PAPER_X - 26)}" y1="${esc(yOf(mm))}"
      x2="${esc(PAPER_X - (big ? 12 : 17))}" y2="${esc(yOf(mm))}"
      stroke="${RULER_LINE}" stroke-width="${big ? 1.2 : 0.8}"/>`);
    if (big) {
      ticks.push(`<text x="${esc(PAPER_X - 30)}" y="${esc(yOf(mm) + 3.5)}" text-anchor="end"
        font-size="8.5" fill="${RULER_LINE}">${mm / 10}</text>`);
    }
  }
  return `<g id="${id}">
    <rect x="${esc(PAPER_X - 27)}" y="${esc(yOf(PAPER_H_MM) - 6)}" width="16"
          height="${esc(lenOf(PAPER_H_MM) + 12)}" fill="${RULER_FILL}" stroke="${RULER_LINE}" stroke-width="0.8" rx="1"/>
    ${ticks.join('')}
  </g>`;
}
