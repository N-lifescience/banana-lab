/**
 * 결과 그래프 — 조건 대 떠오르는 시간.
 *
 * ── 이 화면이 이 실험의 대답이다 ───────────────────────────────────
 * 실험대는 **잘못된 조작을 막지 않는다.** 통제변인을 안 맞춘 채로 재도, 조작변인을 도중에
 * 바꿔도 그대로 진행된다. 그 대신 **여기서 대답한다** — 어긋난 시행은 선에서 떨어져 나오고,
 * 무엇이 어긋났는지 이름으로 말한다.
 *
 * 이 그래프가 없으면 T04 의 변인 설계는 채워 놓고 아무 일도 일어나지 않는 양식이 된다.
 *
 * ── 지우지 않는다 ──────────────────────────────────────────────────
 * 어긋난 시행을 숨기거나 지우지 않는다. 지우면 학생은 자기가 무엇을 잘못했는지 모른 채
 * 깨끗한 그래프만 본다. **떨어져 나온 점을 보는 것**이 이 실험이 가르치려는 것이다.
 *
 * ── 안 뜬 시행에 시간을 지어내지 않는다 ────────────────────────────
 * 관찰 시간 안에 안 뜬 시행은 축 위쪽 「뜨지 않음」 칸에 놓는다. 300 에 점을 찍으면
 * 학생이 **없는 값을 읽는다.** `riseTime()` 이 `seconds: null` 을 주는 이유가 이것이다.
 *
 * 순수 함수다. 같은 `trials` 면 같은 그림이 나오고, `idPrefix` 를 받아 한 화면에 여러 개를
 * 그려도 `id` 가 부딪히지 않는다 (보고서가 그렇게 쓴다).
 */

import { INK } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { CHOICES, VARIABLE_KEY, offDesign } from '../sim/state.js';
import { OBSERVE_LIMIT_S } from '../sim/kinetics.js';
import { UI } from '../ui/strings.js';

export const GRAPH = {
  w: 460, h: 320,
  left: 74, right: 18, top: 26, bottom: 48,
  /** 「뜨지 않음」 칸의 높이. 시간 축과 **선으로 갈라** 둔다 — 같은 축이 아니기 때문이다. */
  noFloatBand: 34,
};

const plot = () => ({
  x0: GRAPH.left,
  x1: GRAPH.w - GRAPH.right,
  y0: GRAPH.top + GRAPH.noFloatBand,
  y1: GRAPH.h - GRAPH.bottom,
});

/**
 * 가로축에 놓을 값들.
 *
 * 조작변인을 골랐으면 그 조건이 고를 수 있는 값 전부다 — **재지 않은 조건도 축에 남긴다.**
 * 잰 것만 그리면 「37 ℃ 만 재고 끝냈다」와 「다섯 조건을 다 쟀다」가 같은 그림이 된다.
 */
export function axisValues(design) {
  const key = VARIABLE_KEY[design?.independent];
  return key ? CHOICES[key] : [];
}

/** 값 하나가 가로축 어디에 오는가. 값 사이 간격은 같게 둔다 (눈금이지 자가 아니다). */
function xOf(values, v) {
  const p = plot();
  if (values.length <= 1) return (p.x0 + p.x1) / 2;
  const i = values.indexOf(v);
  // 축에 없는 값(고를 수 있는 목록 밖)은 오른쪽 끝 너머에 둔다 — 숨기지 않는다.
  const t = i < 0 ? 1.06 : i / (values.length - 1);
  return p.x0 + (p.x1 - p.x0) * t;
}

/**
 * 세로축의 꼭대기 값 (초).
 *
 * ── 왜 관찰 시간(300초)으로 고정하지 않나 ─────────────────────────
 * 고정해 두었더니 **37 ℃ 8초와 20 ℃ 25초가 축에 붙어 한 점처럼 보였다.** 이 실험에서
 * 견주는 것이 바로 그 차이인데, 가장 중요한 것이 안 보였다.
 *
 * 그렇다고 데이터에 딱 맞추면 눈금이 「93.7초」 같은 수가 된다. **읽을 수 있는 수**로
 * 올림한다. 아직 아무것도 안 쟀을 때의 바닥값(30초)도 둔다 — 축이 0 이면 눈금이 무너진다.
 *
 * 안 뜬 시행은 여기 들어오지 않는다. 그것은 시간이 **없는** 것이라 위쪽 칸에 따로 놓인다.
 */
export function yMaxOf(trials = []) {
  const NICE = [10, 20, 30, 60, 90, 120, 180, 240, OBSERVE_LIMIT_S];
  const top = Math.max(0, ...trials.filter((t) => t.floated).map((t) => t.seconds ?? 0));
  return NICE.find((n) => n >= top) ?? OBSERVE_LIMIT_S;
}

function yOf(seconds, yMax) {
  const p = plot();
  const t = Math.min(seconds / yMax, 1);
  return p.y1 - (p.y1 - p.y0) * t;
}

/**
 * 시행 하나가 어느 갈래인가.
 *
 * `line` 만 선으로 이어진다. **이어지는 것이 곧 「비교할 수 있다」는 뜻**이라,
 * 어긋난 시행과 조작변인이 다른 시행은 이어 붙이지 않는다.
 *
 * ── 저장된 `offDesign` 을 쓰지 않고 **지금 설계로 다시 잰다** ──────
 * `trial.offDesign` 은 기록하던 그 순간의 판정이라 그 뒤로 얼어 있다. 그런데 그래프의
 * 가로축은 **지금 설계**로 그려진다. 둘을 섞어 읽으면 같은 두 측정인데 「통제값을 언제
 * 정했느냐」에 따라 라벨이 뒤집히고, 그 차이가 화면 어디에도 안 나온다 —
 * 설계와 **같은** 조건인데 빈 네모, 설계와 **다른** 조건인데 깨끗한 점이 나왔다.
 *
 * 지금 설계로 다시 재면 설계를 고칠 때 어떤 점이 쓸 수 있는지가 함께 바뀐다.
 * 그것이 이 화면이 말해야 하는 것이다.
 */
export function classify(trial, design) {
  if (!design?.independent) return 'unknown';
  if (trial.independent !== design.independent) return 'other-variable';
  if (offDesign(design, trial.conditions).length > 0) return 'off-design';
  return trial.floated ? 'line' : 'no-float';
}

/**
 * 점 하나의 모양.
 *
 * **색만으로 가르지 않는다.** 색각 이상이 있으면 색으로만 갈린 점은 같아 보인다.
 * 모양이 먼저이고 색은 거들 뿐이다.
 */
function marker(kind, x, y, id) {
  const c = {
    line: EXP_PALETTE.bathWater[1],
    'off-design': EXP_PALETTE.potatoBoiled[1],
    'no-float': INK,
    'other-variable': EXP_PALETTE.potatoBoiled[1],
    unknown: INK,
  }[kind];
  if (kind === 'line') {
    return `<circle id="${id}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${c}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  if (kind === 'no-float') {
    // 가위표. 「여기까지 기다렸는데 안 됐다」를 뜻한다.
    return `<g id="${id}" stroke="${c}" stroke-width="2.4" stroke-linecap="round">`
      + `<path d="M ${x - 5},${y - 5} L ${x + 5},${y + 5}"/><path d="M ${x + 5},${y - 5} L ${x - 5},${y + 5}"/></g>`;
  }
  // 어긋난 시행은 **속이 빈 네모**다. 채워진 동그라미와 한눈에 갈린다.
  return `<rect id="${id}" x="${(x - 5).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="10" height="10"`
    + ` fill="none" stroke="${c}" stroke-width="2.4"/>`;
}

/**
 * @param {object[]} trials  `state.trials`
 * @param {object} design    `state.design`
 * @param {{idPrefix?: string}} opts
 */
export function renderGraph(trials = [], design = {}, { idPrefix = 'g' } = {}) {
  const G = UI.graph;
  const p = plot();
  const values = axisValues(design);
  const key = VARIABLE_KEY[design?.independent];
  const id = (n) => `${idPrefix}-${n}`;

  const yMax = yMaxOf(trials);
  const points = trials.map((t) => ({
    t,
    kind: classify(t, design),
    x: key ? xOf(values, t.conditions[key]) : (p.x0 + p.x1) / 2,
  }));

  // 선으로 이을 것만 골라 가로축 순서대로 잇는다.
  const linePts = points.filter((q) => q.kind === 'line')
    .map((q) => ({ x: q.x, y: yOf(q.t.seconds, yMax) }))
    .sort((a, b) => a.x - b.x);
  const path = linePts.length > 1
    ? `<path id="${id('line')}" d="M ${linePts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' L ')}"
        fill="none" stroke="${EXP_PALETTE.bathWater[1]}" stroke-width="2" stroke-linejoin="round"/>`
    : '';

  // 세로 눈금 — 0 부터 관찰 시간까지 다섯 칸.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = p.y1 - (p.y1 - p.y0) * f;
    const s = Math.round(yMax * f);
    return `<path d="M ${p.x0},${y.toFixed(1)} L ${p.x1},${y.toFixed(1)}" stroke="${INK}" stroke-opacity="0.14" stroke-width="1"/>`
      + `<text x="${p.x0 - 8}" y="${(y + 4).toFixed(1)}" font-size="11" text-anchor="end" fill="${INK}" fill-opacity="0.75">${s}</text>`;
  }).join('');

  const xLabels = values.map((v) => {
    const x = xOf(values, v);
    return `<text x="${x.toFixed(1)}" y="${p.y1 + 18}" font-size="11" text-anchor="middle" fill="${INK}" fill-opacity="0.8">${UI.units[key](v)}</text>`;
  }).join('');

  const marks = points.map((q, i) => marker(
    q.kind, q.x,
    q.kind === 'no-float' ? GRAPH.top + GRAPH.noFloatBand / 2 : yOf(q.t.seconds ?? 0, yMax),
    id(`p${q.t.at ?? i}`),
  )).join('');

  return `<svg viewBox="0 0 ${GRAPH.w} ${GRAPH.h}" xmlns="http://www.w3.org/2000/svg"
  role="img" data-render="graph" data-points="${trials.length}">
  <!-- 「뜨지 않음」 칸. 시간 축과 선으로 갈라 둔다 — 같은 축이 아니다 -->
  <rect x="${p.x0}" y="${GRAPH.top}" width="${p.x1 - p.x0}" height="${GRAPH.noFloatBand}"
    fill="${INK}" fill-opacity="0.05"/>
  <text x="${p.x0 - 8}" y="${GRAPH.top + GRAPH.noFloatBand / 2 + 4}" font-size="10"
    text-anchor="end" fill="${INK}" fill-opacity="0.75">${G.noFloatLabel}</text>
  <path d="M ${p.x0},${p.y0} L ${p.x1},${p.y0}" stroke="${INK}" stroke-opacity="0.35"
    stroke-width="1.5" stroke-dasharray="4 3"/>

  <g id="${id('ticks')}">${ticks}</g>

  <!-- 축 -->
  <path d="M ${p.x0},${GRAPH.top} L ${p.x0},${p.y1} L ${p.x1},${p.y1}"
    fill="none" stroke="${INK}" stroke-width="2"/>
  <!-- 세로축 이름을 **가로로 위에** 둔다. 회전해서 축 왼쪽에 붙였더니 글자가 잘렸다 -->
  <text x="4" y="14" font-size="11" fill="${INK}" fill-opacity="0.85">${G.yLabel}</text>
  <text x="${(p.x0 + p.x1) / 2}" y="${GRAPH.h - 8}" font-size="11" text-anchor="middle" fill="${INK}">${
    key ? UI.conditions[key] : G.noIndependent}</text>

  <g id="${id('xlabels')}">${xLabels}</g>
  ${path}
  <g id="${id('points')}">${marks}</g>
</svg>`;
}

/**
 * 그래프 밑에 붙는 설명.
 *
 * **점을 보고도 왜 떨어져 나왔는지 모르면 소용이 없다.** 어긋난 통제변인의 이름을
 * 그대로 말해 준다 — 「통제변인이 다릅니다」로는 무엇을 고쳐야 할지 알 수 없다.
 */
export function graphNotes(trials = [], design = {}) {
  const G = UI.graph;
  const out = [];
  const kinds = trials.map((t) => classify(t, design));

  if (trials.length === 0) return [G.empty];
  if (!design?.independent) out.push(G.noIndependentNote);

  const off = trials.filter((t, i) => kinds[i] === 'off-design');
  for (const t of off) {
    // 여기서도 **지금 설계로 다시 잰다** (classify 주석 참조).
    const names = offDesign(design, t.conditions).map((k) => UI.conditions[k]).join(' · ');
    out.push(G.offDesignNote(t.at + 1, names));
  }
  const other = kinds.filter((k) => k === 'other-variable').length;
  if (other > 0) out.push(G.otherVariableNote(other));

  const noFloat = trials.filter((t, i) => kinds[i] === 'no-float');
  if (noFloat.length > 0) out.push(G.noFloatNote(noFloat.length, OBSERVE_LIMIT_S));

  const usable = kinds.filter((k) => k === 'line').length;
  out.push(usable >= 2 ? G.usable(usable) : G.needMore(usable));
  return out;
}
