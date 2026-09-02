/**
 * 결과 렌더러 — 모세관 안의 층.
 *
 * 바나나랩의 `fov.js`(현미경 시야) 자리에 오는 파일이다. 이 실험에는 현미경이 없다.
 * 그림은 미리 그려 두지 않고 상태에서 매번 생성한다. 그래야 얼마나 돌렸는지·얼마나
 * 흔들렸는지·응고했는지를 바꾼 결과가 정직하게 반영되고, 기록이 이미지 대신 값 한 벌만
 * 담을 수 있다.
 *
 * ── 방향이 이 파일에서 가장 틀리기 쉬운 것 ──────────────────────────
 * **회전판은 모세관을 수평으로 문다.** 교과서 그림의 「아래」는 회전 **바깥쪽** 끝이고,
 * 혈장은 **축 쪽**이다. 그래서 여기서는 **왼쪽이 바깥쪽, 오른쪽이 축 쪽**이고,
 * 그 두 낱말을 **화면에 글자로 적는다** — 적어 두지 않으면 그리는 사람도 읽는 사람도
 * 위/아래로 되돌려 생각하다가 뒤집는다.
 *
 * 주의: 아트 디렉션(라인+플랫)은 **기구 애셋에만** 적용된다. 이 파일은 예외다 —
 * 흐리게 섞인 경계는 굵은 외곽선으로 그릴 수 없다. **애셋을 만드는 사람은 이 파일을
 * 읽지 마세요.** 따라 쓰면 애셋이 오염됩니다. 다만 색은 팔레트를 공유한다.
 *
 * docs/05-tube-renderer.md 참조.
 */

import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng, clamp } from '../assets/geometry.js';
import { TUBE_LEN_MM } from '../sim/spin.js';

/**
 * 그림의 크기.
 *
 * **관의 굵기는 실물 비례가 아니다.** 실제 모세관은 길이에 견주면 머리카락처럼 가늘어서,
 * 비례대로 그리면 층이 한 줄로 뭉개져 아무것도 안 보인다. 굵기는 읽히도록 부풀리고,
 * **길이 방향만 비례를 지킨다** — 학생이 재는 것이 길이이기 때문이다.
 */
export const TUBE = { w: 640, h: 220, padX: 46, midY: 96, bore: 30 };

const BORE_X0 = TUBE.padX;
const BORE_X1 = TUBE.w - TUBE.padX;
const BORE_LEN = BORE_X1 - BORE_X0;
const BORE_TOP = TUBE.midY - TUBE.bore / 2;
const BORE_BOT = TUBE.midY + TUBE.bore / 2;

/** 고무찰흙 마개가 관을 물고 들어오는 길이 (px) */
const PLUG_PX = 26;

/**
 * 띠 하나가 화면에서 가질 수 있는 가장 좁은 폭 (px).
 *
 * 연층은 실제로 **1 % 미만**이라 비례대로 그리면 한 줄도 안 된다. 그런데 학생이 봐야 하는
 * 것이 바로 그 얇은 띠다. **비율은 그대로 두고 획만 이만큼 굵게 긋는다.**
 */
const MIN_BAND_PX = 4;

const GLASS_FILL = 'rgba(228,239,238,.55)';
const GLASS_EDGE = 'rgba(70,74,80,.75)';
/*
 * 글자·지시선은 **테마를 따른다.** 다크 모드에서 이 그림은 어두운 판(`--sunk`) 위에 놓이는데
 * 잉크를 짙은 회색으로 박아 두었더니 「적혈구층 · 연층 · 혈장」 이름표와 「← 회전 바깥쪽」이
 * 거의 안 보였다 (플레이테스트 다크 모드 — PLAYTEST-REVIEW #10).
 * `var()` 에 **밝은 바탕용 값을 예비로** 둔다 — 보고서는 이 SVG 를 그림으로 구워 넣는데
 * 그때는 문서의 변수가 닿지 않으므로 예비값이 쓰인다 (종이는 흰 바탕이다).
 */
const LABEL_INK = 'var(--ink, rgba(52,56,62,.92))';
const LEADER = 'var(--ink-mute, rgba(96,100,108,.7))';
const RULER_FILL = 'rgba(255,255,255,.86)';
const RULER_LINE = 'rgba(70,74,80,.75)';
/** 자의 숫자는 자(흰 바탕) 위에 놓이므로 테마와 무관하게 짙어야 한다. */
const RULER_INK = 'rgba(52,56,62,.92)';
const AIR_FILL = 'rgba(244,246,241,.9)';

const n = (v) => Number(v).toFixed(2);

/**
 * 두 색을 섞는다. `t` 가 0 이면 a, 1 이면 b.
 *
 * **대문자로 낸다.** 팔레트가 대문자라, 소문자로 내면 `t` 가 0 이나 1 인 자리에서도
 * 글자가 달라져 「이 색이 그림에 있는가」를 보는 검사가 조용히 못 잡는다.
 */
function mixHex(a, b, t) {
  const k = clamp(t, 0, 1);
  const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2]
    .map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0'));
  return `#${out.join('')}`.toUpperCase();
}

/** 띠 하나의 실제 색. 적혈구층만 「덜 갈렸을수록 선홍에 가깝다」를 섞는다. */
function toneOf(band) {
  const base = EXP_PALETTE[band.tone][0];
  if (!band.fresh) return base;
  return mixHex(base, EXP_PALETTE.bloodFresh[0], clamp(band.fresh, 0, 1));
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

/**
 * 층 하나가 놓이는 자리. **왼쪽이 바깥쪽**이므로 적혈구층이 먼저 온다.
 *
 * 순수 함수로 따로 빼 둔 이유는 이 차례가 이 실험에서 가장 자주 뒤집히는 자리라서다.
 * 그림을 안 띄우고도 `tests/tube.test.js` 가 차례를 검사할 수 있다.
 *
 * @returns {Array<{id:string, tone:string, from:number, to:number}>}
 *   from·to 는 **관 전체**에 대한 비율 0~1 이고, 0 이 바깥쪽 끝이다.
 */
export function layerBands(p = {}) {
  const column = clamp(p.column ?? 0, 0, 1);
  if (column <= 0) return [];
  const packed = clamp(p.packedOfColumn ?? 1, 0, 1) * column;
  const buffy = clamp(p.buffyOfColumn ?? 0, 0, 1) * column;
  const sep = clamp(p.separation ?? 1, 0, 1);
  const bands = [];
  // ① 바깥쪽 — 적혈구층. 응고했으면 혈병이다.
  //
  // **갈리기 전의 생혈은 선홍이고, 다져진 적혈구층은 암적색이다** (AGENTS.md §2.5).
  // 한 색으로 칠하면 "다져져서 어두워졌다" 는 변화가 화면에서 사라진다 —
  // 이 실험에서 눈으로 보는 것의 절반이 그것이다. `fresh` 가 그 섞는 몫이다.
  bands.push({
    id: p.clotted ? 'clot' : 'packed',
    tone: p.clotted ? 'clot' : 'packedCells',
    fresh: p.clotted ? 0 : 1 - sep,
    from: 0,
    to: packed,
  });
  // ② 연층 — 다 갈려야 눈에 선다. 아주 얇다.
  if (buffy > 0) bands.push({ id: 'buffy', tone: 'buffyCoat', from: packed, to: packed + buffy });
  // ③ 축 쪽 — 혈장. 응고했으면 **혈청**이다 (응고인자가 혈병으로 빠져나갔다).
  if (packed + buffy < column) {
    bands.push({
      id: p.clotted ? 'serum' : 'plasma',
      tone: p.clotted ? 'serum' : 'plasma',
      from: packed + buffy,
      to: column,
    });
  }
  return bands;
}

/** 화면에 붙는 이름표. **연층은 뒤엣말을 병기한다** — 교과서 그림이 그렇게 단다. */
export const BAND_LABELS = {
  packed: '적혈구층',
  clot: '혈병',
  buffy: '연층(백혈구·혈소판)',
  plasma: '혈장',
  serum: '혈청',
};

/** 비율(관 전체 기준) → 화면 x. 0 이 바깥쪽 끝이다. */
const xOf = (frac) => BORE_X0 + PLUG_PX + frac * (BORE_LEN - PLUG_PX * 2);
/** 비율 길이 → 화면 길이 */
const lenOf = (frac) => frac * (BORE_LEN - PLUG_PX * 2);

/**
 * 경계가 흐린 만큼 번지는 폭 (px).
 * 또렷하면 0 이고, 흔들려 섞였거나 덜 갈렸으면 넓어진다.
 */
function blurPx(sharpness) {
  return 2 + (1 - clamp(sharpness ?? 1, 0, 1)) * 34;
}

/**
 * 띠 하나. 경계는 좌우로 번진다 — 그라데이션 금지는 **기구 애셋의 규칙**이고
 * 이 파일은 그 예외다 (파일 머리말 참조).
 */
function bandShape(uid, band, blur, prevBand, nextBand) {
  const x0 = xOf(band.from);
  const x1 = xOf(band.to);
  // **그리는 바닥값이지 비율을 바꾸는 것이 아니다.**
  // 연층은 실제로 1 % 미만이라 비례대로 그리면 화면에서 2 px 이 안 되고, 그러면
  // 학생이 봐야 하는 바로 그 띠가 안 보인다. 여기서 넓히는 것은 **획의 굵기**뿐이고,
  // 비율은 `layerBands()` 가 내는 값 그대로다 — 검사도 그 값을 본다.
  const w = Math.max(MIN_BAND_PX, x1 - x0);
  const base = toneOf(band);
  // 번짐이 띠보다 넓으면 띠가 사라진다. 띠 폭의 절반을 넘지 않게 눌러 둔다.
  const b = Math.min(blur, w * 0.45);
  const f = (t) => (w > 0 ? clamp(t / w, 0, 1) : 0);
  const prev = prevBand ? toneOf(prevBand) : base;
  const next = nextBand ? toneOf(nextBand) : base;
  const id = `${uid}-g`;
  return {
    def: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">`
      + `<stop offset="0" stop-color="${prev}"/>`
      + `<stop offset="${n(f(b))}" stop-color="${base}"/>`
      + `<stop offset="${n(1 - f(b))}" stop-color="${base}"/>`
      + `<stop offset="1" stop-color="${next}"/>`
      + '</linearGradient>',
    shape: `<rect data-band="${band.id}" x="${n(x0)}" y="${n(BORE_TOP)}" `
      + `width="${n(w)}" height="${n(TUBE.bore)}" fill="url(#${id})"/>`,
  };
}

/** 기둥에 낀 공기. 시드에서 나오므로 다시 그려도 같은 자리에 있다. */
function bubbleShapes(p, column) {
  const amount = clamp(p.bubbles ?? 0, 0, 1);
  if (amount <= 0.02 || column <= 0) return '';
  const r = rng((p.seed ?? 0) + 313);
  const count = Math.round(1 + amount * 5);
  let out = '';
  for (let i = 0; i < count; i++) {
    const at = (0.12 + r() * 0.76) * column;
    const w = (0.012 + r() * 0.03 * amount) * 1;
    out += `<rect data-bubble="${i}" x="${n(xOf(at))}" y="${n(BORE_TOP)}" `
      + `width="${n(Math.max(2, lenOf(w)))}" height="${n(TUBE.bore)}" fill="${AIR_FILL}"/>`;
  }
  return out;
}

/**
 * 자. **바깥쪽 끝을 0 으로 놓는다** — 학생이 재는 것이 「바깥쪽 끝에서 경계까지」이기
 * 때문이다. 눈금의 mm 는 `TUBE_LEN_MM` 에서 나오고, 그 값은 `[확인 필요]` 지만
 * **헤마토크릿은 길이의 비**라 결과가 여기에 좌우되지 않는다 (`spin.js`).
 */
function rulerShape(uid) {
  const y = BORE_BOT + 16;
  let ticks = '';
  const step = 5;
  for (let mm = 0; mm <= TUBE_LEN_MM; mm += step) {
    const x = xOf(mm / TUBE_LEN_MM);
    const big = mm % 10 === 0;
    ticks += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x)}" y2="${n(y + (big ? 11 : 6))}" `
      + `stroke="${RULER_LINE}" stroke-width="1"/>`;
    if (big) {
      ticks += `<text x="${n(x)}" y="${n(y + 24)}" text-anchor="middle" `
        + `font-size="10" fill="${RULER_INK}">${mm}</text>`;
    }
  }
  return `<g data-ruler="1" id="${uid}-ruler">`
    + `<rect x="${n(xOf(0) - 6)}" y="${n(y)}" width="${n(lenOf(1) + 12)}" height="28" `
    + `rx="3" fill="${RULER_FILL}" stroke="${RULER_LINE}" stroke-width="1"/>${ticks}</g>`;
}

/** 이름표 하나 — 띠 가운데에서 위로 뽑아 올린다 */
function labelShape(band, text, row) {
  // 얇은 띠는 가운데를 재도 왼쪽 끝과 거의 같다. 그래도 그 자리에서 뽑아야
  // 어디를 가리키는지 알 수 있다.
  const cx = (xOf(band.from) + Math.max(xOf(band.to), xOf(band.from) + MIN_BAND_PX)) / 2;
  const y = BORE_TOP - 12 - row * 20;
  return `<g data-label="${band.id}">`
    + `<line x1="${n(cx)}" y1="${n(BORE_TOP - 2)}" x2="${n(cx)}" y2="${n(y + 3)}" `
    + `stroke="${LEADER}" stroke-width="1"/>`
    + `<text x="${n(cx)}" y="${n(y)}" text-anchor="middle" font-size="12" `
    + `fill="${LABEL_INK}">${esc(text)}</text></g>`;
}

/**
 * 모세관 하나를 그린다.
 *
 * 같은 params + 같은 seed 면 **같은 문자열**이 나온다. 그래야 기록해 두었다가 탐구 노트와
 * 보고서에서 되살릴 수 있다.
 *
 * ── `idPrefix` 를 반드시 넘길 것 ────────────────────────────────────
 * 한 화면에 여러 장을 그리는 순간 `id` 가 부딪혀 **에러 없이 조용히** 틀린 그림이 된다
 * (뒤엣것의 그라데이션을 앞엣것이 쓴다). 미리 받아 둔다.
 *
 *   renderTube(a, { idPrefix: 'card1-' })
 *   renderTube(b, { idPrefix: 'card2-' })
 *
 * @param {object} p          state.js 의 `tubeParams()` 가 내는 값
 * @param {{idPrefix?: string, labels?: boolean}} [opts]
 */
export function renderTube(p = {}, { idPrefix = '', labels = false } = {}) {
  const uid = `${idPrefix}tube`;
  const column = clamp(p.column ?? 0, 0, 1);
  const bands = layerBands(p);
  const blur = blurPx(p.sharpness);

  let defs = '';
  let fills = '';
  for (let i = 0; i < bands.length; i++) {
    const { def, shape } = bandShape(
      `${uid}-${bands[i].id}`, bands[i], blur, bands[i - 1], bands[i + 1],
    );
    defs += def;
    fills += shape;
  }

  // 고무찰흙 마개. 안 막은 쪽은 그리지 않는다 — 안 막힌 것이 눈에 보여야 한다.
  const plug = (side, quality) => {
    if (!(quality > 0)) return '';
    const x = side === 'outer' ? BORE_X0 : BORE_X1 - PLUG_PX;
    // 얕게 막으면 물린 길이가 짧다. 눈으로도 얕은 것이 보여야 한다.
    const w = PLUG_PX * (0.45 + 0.55 * clamp(quality, 0, 1));
    const px = side === 'outer' ? x : BORE_X1 - w;
    return `<rect data-plug="${side}" x="${n(px)}" y="${n(BORE_TOP - 3)}" width="${n(w)}" `
      + `height="${n(TUBE.bore + 6)}" rx="3" fill="${EXP_PALETTE.clay[0]}" `
      + `stroke="${EXP_PALETTE.clay[1]}" stroke-width="1.5"/>`;
  };

  const seal = p.seal ?? {};
  const broken = p.broken
    ? `<g data-broken="1"><line x1="${n(BORE_X0 + BORE_LEN * 0.58)}" y1="${n(BORE_TOP - 10)}" `
      + `x2="${n(BORE_X0 + BORE_LEN * 0.62)}" y2="${n(BORE_BOT + 10)}" `
      + `stroke="${GLASS_EDGE}" stroke-width="2.5"/></g>`
    : '';

  // **연층은 얇다고 이름표를 빼지 않는다.** 얇아서 안 보이는 것을 이름표까지 빼면
  // 화면에 아예 없는 것이 된다 — 그게 이 실험에서 학생이 찾아야 하는 것이다.
  const labelRows = labels
    ? bands.map((b, i) => labelShape(b, BAND_LABELS[b.id] ?? b.id, i % 2)).join('')
    : '';

  // **방향을 글자로 적는다.** 이 두 낱말이 없으면 위/아래로 되돌려 생각하다 뒤집는다.
  const compass = `<g data-compass="1">`
    + `<text x="${n(BORE_X0)}" y="${n(TUBE.h - 12)}" font-size="12" fill="${LABEL_INK}">`
    + '← 회전 바깥쪽 (교과서 그림의 「아래」)</text>'
    + `<text x="${n(BORE_X1)}" y="${n(TUBE.h - 12)}" text-anchor="end" font-size="12" `
    + `fill="${LABEL_INK}">축 쪽 →</text></g>`;

  // 헤파린이 발린 관에는 구분 띠를 두른다.
  // **실물의 색 코드가 무엇인지는 [확인 필요]** 라 여기 색은 규격이 아니라 구분 표시다.
  // 헤파린 구분 띠. **관 바깥에 붙인다** — 관 안에 그리면 갈라진 층 하나로 읽힌다.
  // 실물의 색 코드가 무엇인지는 [확인 필요] 라, 여기 색은 규격이 아니라 구분 표시다.
  const heparin = p.kind === 'heparin'
    ? `<g data-heparin="1">`
      + `<rect x="${n(BORE_X1 - 26)}" y="${n(BORE_TOP - 9)}" width="22" height="5" `
      + `rx="2" fill="${EXP_PALETTE.heparinBand[0]}"/>`
      + `<text x="${n(BORE_X1 - 30)}" y="${n(BORE_TOP - 12)}" text-anchor="end" font-size="10" `
      + `fill="${LABEL_INK}">헤파린</text></g>`
    : '';

  return `<svg viewBox="0 0 ${TUBE.w} ${TUBE.h}" xmlns="http://www.w3.org/2000/svg" `
    + `data-render="tube" data-column="${n(column)}" role="img">`
    + (defs ? `<defs>${defs}</defs>` : '')
    + `<rect data-bore="1" x="${n(BORE_X0)}" y="${n(BORE_TOP)}" width="${n(BORE_LEN)}" `
    + `height="${n(TUBE.bore)}" rx="4" fill="${GLASS_FILL}"/>`
    + fills
    // 혈액이 끝나는 자리에 선을 긋는다. 안 그으면 빈 관이 「또 하나의 맑은 층」으로 읽힌다.
    + (column > 0 && column < 1
      ? `<line data-column-end="1" x1="${n(xOf(column))}" y1="${n(BORE_TOP)}" `
        + `x2="${n(xOf(column))}" y2="${n(BORE_BOT)}" stroke="${GLASS_EDGE}" stroke-width="1"/>`
      : '')
    + bubbleShapes(p, column)
    + plug('outer', seal.outer)
    + plug('inner', seal.inner)
    + heparin
    + `<rect x="${n(BORE_X0)}" y="${n(BORE_TOP)}" width="${n(BORE_LEN)}" `
    + `height="${n(TUBE.bore)}" rx="4" fill="none" stroke="${GLASS_EDGE}" stroke-width="1.5"/>`
    + broken
    + labelRows
    + (p.rulerPlaced ? rulerShape(uid) : '')
    + compass
    + '</svg>';
}
