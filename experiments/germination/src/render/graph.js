/**
 * 결과 그래프 — 시간에 따른 CO₂ 농도와 온도.
 *
 * ── 이 화면은 **보조**다 ───────────────────────────────────────────
 * 이 실험의 몸통은 챔버 그림이다 (`src/render/chamber.js`). BTB 색이 어느 쪽에서 더
 * 노래졌는지, 온도계가 어느 쪽에서 더 올라갔는지를 **눈으로 먼저 본다.**
 * 그래프만 남으면 이 실험은 교과서와 똑같은 그래프 뷰어가 된다.
 *
 * 그래도 그래프가 있어야 하는 이유는 하나다 — **언제 꺾였는지**는 그림이 못 보여 준다.
 * 재는 도중에 뚜껑을 열면 그 자리에서 곡선이 꺾이는데, 그 꺾임이 「밀봉」이 왜
 * 통제변인인지에 대한 답이다.
 *
 * ── 색만으로 가르지 않는다 ─────────────────────────────────────────
 * 두 챔버는 **선 모양(실선/점선)** 으로 먼저 갈리고, 선 끝에 **이름이 직접 붙는다.**
 * 색은 거들 뿐이다. 색각 이상이 있어도, 흑백으로 인쇄해도 갈려야 한다.
 * 범례를 따로 두지 않는 것도 같은 이유다 — 범례와 선을 눈으로 잇는 일을 없앤다.
 *
 * ── 순수 함수다 ────────────────────────────────────────────────────
 * 같은 상태면 같은 그림이 나오고, `idPrefix` 를 받아 한 화면에 여러 개를 그려도
 * `id` 가 부딪히지 않는다 (보고서가 그렇게 쓴다).
 */

import { INK } from '../style/tokens.js';
import {
  ATMOSPHERIC_CO2_PPM, ROOM_TEMP_C, OBSERVE_LIMIT_MIN,
  BTB_GREEN_PPM, BTB_YELLOW_PPM,
} from '../sim/metabolism.js';
import { UI } from '../ui/strings.js';

export const GRAPH = {
  w: 460, h: 340,
  left: 62, right: 58, top: 24, gap: 26, bottom: 40,
  /** 위 칸(CO₂)과 아래 칸(온도)의 높이 비. CO₂ 쪽이 이 실험의 주된 값이다. */
  split: 0.62,
};

/** 두 칸의 좌표. **한 칸에 두 단위를 겹쳐 그리지 않는다** — 어느 눈금을 읽는지 알 수 없다. */
function panels() {
  const x0 = GRAPH.left;
  const x1 = GRAPH.w - GRAPH.right;
  const usable = GRAPH.h - GRAPH.top - GRAPH.bottom - GRAPH.gap;
  const co2H = usable * GRAPH.split;
  return {
    x0,
    x1,
    co2: { y0: GRAPH.top, y1: GRAPH.top + co2H },
    temp: { y0: GRAPH.top + co2H + GRAPH.gap, y1: GRAPH.h - GRAPH.bottom },
  };
}

/**
 * 세로축 꼭대기를 **읽을 수 있는 수**로 올림한다.
 *
 * 데이터에 딱 맞추면 눈금이 「2809 ppm」 같은 수가 된다. 그렇다고 고정해 두면
 * 아직 조금밖에 안 쟀을 때 두 곡선이 바닥에 붙어 **견줄 것이 안 보인다.**
 * 바닥값을 두어 아무것도 안 쟀을 때도 축이 무너지지 않게 한다.
 */
export function co2Max(chambers = []) {
  const NICE = [800, 1000, 1500, 2000, 3000, 4000, 6000];
  const top = Math.max(ATMOSPHERIC_CO2_PPM,
    ...chambers.flatMap((c) => (c.samples ?? []).map((s) => s.co2Ppm)));
  return NICE.find((n) => n >= top) ?? NICE[NICE.length - 1];
}

export function tempMax(chambers = []) {
  const NICE = [0.5, 1, 2, 3, 5, 8];
  const rise = Math.max(0,
    ...chambers.flatMap((c) => (c.samples ?? []).map((s) => s.tempC - ROOM_TEMP_C)));
  return ROOM_TEMP_C + (NICE.find((n) => n >= rise) ?? NICE[NICE.length - 1]);
}

/**
 * CO₂ 칸의 세로 눈금 값. **읽을 수 있는 수**여야 한다.
 *
 * 앞서는 바닥·가운데·꼭대기 셋을 그대로 찍어 「380 · 1190 · 2000」이 나왔다 — 바닥이 380
 * (대기 농도 밑에 둔 여백)이라 가운데가 늘 어중간한 수가 됐다. 보고서를 손에 든 선생님이
 * 「1190 ppm 눈금」을 보면 그래프 자체를 못 믿는다 (플레이테스트).
 * 바닥은 눈금 없이 두고(거기는 「대기 농도」 선이 이미 말한다), 꼭대기와 그 절반만 찍는다 —
 * 절반이 어중간하면(1500 의 절반 750) 500 단위로 쪼갠다.
 */
export function co2Ticks(lo, hi) {
  const half = hi / 2;
  const ticks = half % 100 === 0 ? [half, hi] : [500, 1000, 1500].filter((v) => v <= hi);
  return ticks.filter((v) => v > lo);
}

const xOf = (p, min) => p.x0 + (p.x1 - p.x0) * Math.min(min / OBSERVE_LIMIT_MIN, 1);
const yOf = (pane, v, lo, hi) => pane.y1 - (pane.y1 - pane.y0) * ((v - lo) / (hi - lo));

/** 챔버 하나의 선. 왼쪽은 실선, 오른쪽은 점선 — **모양이 먼저이고 색은 거들 뿐이다.** */
const STYLE = {
  L: { dash: '', opacity: 1 },
  R: { dash: '6 4', opacity: 0.62 },
};

function polyline(view, pane, lo, hi, pick, p, id) {
  const pts = (view.samples ?? []).map((s) => `${xOf(p, s.min).toFixed(1)},${yOf(pane, pick(s), lo, hi).toFixed(1)}`);
  if (pts.length < 2) return '';
  const st = STYLE[view.id] ?? STYLE.L;
  return `<path id="${id}" d="M ${pts.join(' L ')}" fill="none" stroke="${INK}"
    stroke-opacity="${st.opacity}" stroke-width="2.2" stroke-linejoin="round"
    stroke-linecap="round"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`;
}

/**
 * 선 끝에 이름을 직접 붙인다. **범례를 두지 않는 이유**는 §머리말에 있다.
 *
 * 이름표는 **판 안쪽 오른쪽 끝**에 놓는다. 처음에는 선 끝 바로 오른쪽(여백)에 두었는데,
 * 그 여백은 기준선 이름(「대기 농도」·「BTB 녹색」)이 쓰는 자리라 **글자가 겹쳐 둘 다
 * 못 읽었다.** 마른 콩 쪽 선은 늘 대기 농도 선 가까이에 있어서 거의 매번 겹쳤다.
 * 그래프를 눈으로 보다가 잡았다.
 *
 * 두 선의 끝이 서로 겹치면 아래쪽 것을 조금 내린다.
 */
function endLabels(views, pane, lo, hi, pick, p, idPrefix) {
  const ends = views
    .map((v) => {
      const last = (v.samples ?? [])[(v.samples ?? []).length - 1];
      return last ? { id: v.id, x: xOf(p, last.min), y: yOf(pane, pick(last), lo, hi) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);
  if (ends.length === 2 && ends[1].y - ends[0].y < 14) ends[1].y = ends[0].y + 14;
  return ends.map((e) => `<text id="${idPrefix}-end-${e.id}" x="${(p.x1 - 5).toFixed(1)}"
    y="${(e.y - 6).toFixed(1)}" font-size="11" text-anchor="end" fill="${INK}"
    fill-opacity="${STYLE[e.id].opacity}">${UI.chambers[e.id].short}</text>`).join('');
}

/**
 * @param {object[]} views  `chamberViews(state)` 의 값들 — `[L, R]`
 * @param {{idPrefix?: string}} opts
 */
export function renderGraph(views = [], { idPrefix = 'g' } = {}) {
  const G = UI.graph;
  const p = panels();
  const id = (n) => `${idPrefix}-${n}`;
  const cMax = co2Max(views);
  const tMax = tempMax(views);
  const cLo = Math.min(ATMOSPHERIC_CO2_PPM - 40, 380);

  const grid = (pane, lo, hi, fmt, values = [lo, (lo + hi) / 2, hi]) => values.map((v) => {
    const y = yOf(pane, v, lo, hi);
    return `<path d="M ${p.x0},${y.toFixed(1)} L ${p.x1},${y.toFixed(1)}" stroke="${INK}"
        stroke-opacity="0.12" stroke-width="1"/>`
      + `<text x="${p.x0 - 7}" y="${(y + 4).toFixed(1)}" font-size="10" text-anchor="end"
        fill="${INK}" fill-opacity="0.7">${fmt(v)}</text>`;
  }).join('');

  // 가로 눈금 — 0 부터 관찰 시간까지. 두 칸이 **같은 시간축**을 쓴다.
  // 넷으로 나누면 30분에서 「8 · 15 · 23」이 됐다(7.5·22.5 를 반올림). 셋으로 나눠 10 단위로 읽힌다.
  const xTicks = [0, 1 / 3, 2 / 3, 1].map((f) => {
    const x = p.x0 + (p.x1 - p.x0) * f;
    const m = Math.round(OBSERVE_LIMIT_MIN * f);
    return `<text x="${x.toFixed(1)}" y="${GRAPH.h - 20}" font-size="10" text-anchor="middle"
      fill="${INK}" fill-opacity="0.75">${m}</text>`;
  }).join('');

  /**
   * BTB 색이 갈리는 자리를 CO₂ 칸에 옅게 그어 둔다.
   *
   * **그림과 그래프를 잇는 유일한 선이다.** 이것이 없으면 학생은 「BTB 가 노래졌다」와
   * 「곡선이 여기까지 올라갔다」가 같은 이야기인 줄 모른다.
   */
  const btbLines = [[BTB_GREEN_PPM, G.btbGreen], [BTB_YELLOW_PPM, G.btbYellow]]
    .filter(([v]) => v <= cMax)
    .map(([v, label]) => {
      const y = yOf(p.co2, v, cLo, cMax);
      return `<path d="M ${p.x0},${y.toFixed(1)} L ${p.x1},${y.toFixed(1)}" stroke="${INK}"
          stroke-opacity="0.28" stroke-width="1" stroke-dasharray="2 4"/>`
        + `<text x="${p.x1 + 5}" y="${(y + 3.5).toFixed(1)}" font-size="9.5" fill="${INK}"
          fill-opacity="0.65">${label}</text>`;
    }).join('');

  // 대기 농도 기준선. 챔버는 여기서 출발한다 — 0 에서 출발하는 것이 아니다.
  const airY = yOf(p.co2, ATMOSPHERIC_CO2_PPM, cLo, cMax);
  const airLine = `<path d="M ${p.x0},${airY.toFixed(1)} L ${p.x1},${airY.toFixed(1)}"
      stroke="${INK}" stroke-opacity="0.4" stroke-width="1.2" stroke-dasharray="5 3"/>`
    + `<text x="${p.x1 + 5}" y="${(airY + 3.5).toFixed(1)}" font-size="9.5" fill="${INK}"
      fill-opacity="0.7">${G.airLabel}</text>`;

  const lines = (pane, lo, hi, pick, kind) =>
    views.map((v) => polyline(v, pane, lo, hi, pick, p, id(`${kind}-${v.id}`))).join('');

  const points = views.reduce((n, v) => n + (v.samples ?? []).length, 0);

  return `<svg viewBox="0 0 ${GRAPH.w} ${GRAPH.h}" xmlns="http://www.w3.org/2000/svg"
  role="img" data-render="graph" data-points="${points}">
  <text x="4" y="13" font-size="11" fill="${INK}" fill-opacity="0.85">${G.co2Label}</text>
  <g id="${id('co2-grid')}">${grid(p.co2, cLo, cMax, (v) => Math.round(v), co2Ticks(cLo, cMax))}</g>
  ${btbLines}
  ${airLine}
  <path d="M ${p.x0},${p.co2.y0} L ${p.x0},${p.co2.y1} L ${p.x1},${p.co2.y1}"
    fill="none" stroke="${INK}" stroke-width="1.8"/>
  ${lines(p.co2, cLo, cMax, (s) => s.co2Ppm, 'co2')}
  ${endLabels(views, p.co2, cLo, cMax, (s) => s.co2Ppm, p, id('co2'))}

  <text x="4" y="${(p.temp.y0 - 6).toFixed(1)}" font-size="11" fill="${INK}"
    fill-opacity="0.85">${G.tempLabel}</text>
  <g id="${id('temp-grid')}">${grid(p.temp, ROOM_TEMP_C, tMax, (v) => v.toFixed(1))}</g>
  <path d="M ${p.x0},${p.temp.y0} L ${p.x0},${p.temp.y1} L ${p.x1},${p.temp.y1}"
    fill="none" stroke="${INK}" stroke-width="1.8"/>
  ${lines(p.temp, ROOM_TEMP_C, tMax, (s) => s.tempC, 'temp')}
  ${endLabels(views, p.temp, ROOM_TEMP_C, tMax, (s) => s.tempC, p, id('temp'))}

  <g id="${id('xticks')}">${xTicks}</g>
  <text x="${((p.x0 + p.x1) / 2).toFixed(1)}" y="${GRAPH.h - 5}" font-size="10.5"
    text-anchor="middle" fill="${INK}" fill-opacity="0.85">${G.xLabel}</text>
</svg>`;
}

/**
 * 그래프와 챔버 그림 밑에 붙는 설명 — **이 실험이 가르치려는 것이 여기 있다.**
 *
 * 어긋난 것을 보고도 무엇이 어긋났는지 모르면 소용이 없다.
 * 「통제변인이 다릅니다」로는 무엇을 고쳐야 할지 알 수 없으므로,
 * **어긋난 조건의 이름과 두 챔버의 값**을 그대로 말한다.
 *
 * 나무라지 않는다. 아직 콩을 안 넣었으면 「아직 시작 전」이라고 말할 뿐이다 —
 * 아무것도 안 한 학생에게 「전부 어긋났다」고 하면 그것은 꾸짖음이지 안내가 아니다.
 *
 * @param {{L: object, R: object}} views    `chamberViews(state)`
 * @param {string} comparison               `comparisonKind(state)`
 * @param {string[]} mismatched             `mismatches(state)`
 */
/**
 * 잰 시간이 이만큼까지 다른 것은 **다르다고 말하지 않는다** (분).
 *
 * 화면의 1초가 1분이고 두 챔버는 **한 손으로 차례로** 시작한다 — 왼쪽을 시작하고 오른쪽
 * 확대 뷰를 열어 시작하면 그 사이에 1분이 흐른다. 앞서는 그 1분에도 「잰 시간이 다릅니다 —
 * 왼쪽 18분 · 오른쪽 17분」이 붙어, **제대로 한 학생의 거의 모든 기록**에 어긋났다는 말이
 * 달렸다 (플레이테스트 — 정상 경로·실패 경로 열 벌 전부). 그건 학생의 실수가 아니라 이 앱의
 * 시계 눈금이다. 시계 한 눈금(1분)까지는 같은 것으로 본다. 그보다 크면 그대로 말한다.
 */
export const TIME_SLACK_MIN = 1;

export function resultNotes(views, comparison, mismatched = []) {
  const G = UI.graph;
  const out = [];

  if (comparison === 'empty') return [G.notes.empty];
  if (comparison === 'mixed') {
    const which = ['L', 'R'].filter((id) => views[id]?.mixed).map((id) => UI.chambers[id].short);
    return [G.notes.mixed(which.join(' · '))];
  }
  if (comparison === 'same-beans') {
    out.push(G.notes.sameBeans(UI.beans[views.L.beans]));
  }

  for (const key of mismatched) {
    out.push(G.notes.mismatch(UI.controls[key], describe(key, views.L), describe(key, views.R)));
  }

  const measured = Math.min(views.L.elapsedMin, views.R.elapsedMin);
  if (comparison === 'ok' && mismatched.length === 0) {
    out.push(measured > 0 ? G.notes.ok(measured) : G.notes.readyToStart);
  }
  /**
   * **잰 값을 적어 준다** — 그림으로는 안 보이는 쪽이 있기 때문이다.
   * 마른 콩 쪽 변화는 판 높이의 5 % 도 안 되고 BTB 색도 안 바뀐다.
   * 여기 값이 없으면 학생은 「아무 일도 안 일어났다」로 읽는다.
   */
  if (measured > 0) {
    const read = (v) => (v.samples?.length ? Math.round(v.samples[v.samples.length - 1].co2Ppm) : null);
    const l = read(views.L);
    const r = read(views.R);
    if (l === null && r === null) out.push(G.notes.co2NoSensor);
    else out.push(G.notes.co2Readout(l ?? '—', r ?? '—', ATMOSPHERIC_CO2_PPM));
  }
  // 한쪽만 오래 잰 것도 견주기 어렵다. 통제변인은 아니지만 말해 주지 않으면 모른다.
  if (Math.abs(views.L.elapsedMin - views.R.elapsedMin) > TIME_SLACK_MIN) {
    out.push(G.notes.differentTime(views.L.elapsedMin, views.R.elapsedMin));
  }
  return out;
}

/** 통제변인 하나가 그 챔버에서 어떤 값인가. **값을 말해야** 무엇을 고칠지 알 수 있다. */
function describe(key, v) {
  const G = UI.graph.values;
  if (key === 'scoops') return G.scoops(v.scoops);
  if (key === 'btb') return v.btb ? G.btbIn : G.btbOut;
  if (key === 'sealed') return v.sealed ? G.sealed : G.open;
  if (key === 'sensor') return G.sensor[v.sensor];
  return '';
}
