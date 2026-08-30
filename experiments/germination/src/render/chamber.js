/**
 * 챔버 그림 — **이 실험의 몸통.**
 *
 * ── 왜 그림이 몸통인가 ─────────────────────────────────────────────
 * 교과서에서 이 활동은 무선 센서로 재는 디지털 활동이고, 결과가 센서 곡선 하나다.
 * 그대로 옮기면 그래프 뷰어가 된다. 그래서 결과를 **눈으로 보는 것**부터 만든다 —
 * 어느 챔버의 BTB 가 더 노래졌는가, 어느 쪽 온도계가 더 올라갔는가.
 * 그래프(`src/render/graph.js`)는 그다음이다.
 *
 * ── 눈으로 아는 것과 센서로 아는 것을 갈라 둔다 ────────────────────
 * BTB 색과 온도계는 **챔버를 들여다보면 보인다.** 센서가 없어도 보인다.
 * CO₂ 농도는 **센서가 있어야 안다** — 없으면 「센서 없음」이라고 적는다.
 * 이 경계가 「센서는 재는 도구이지 일어나는 일이 아니다」를 화면에서 말해 준다.
 *
 * ── 순수 함수다 ────────────────────────────────────────────────────
 * 같은 뷰면 같은 HTML 이 나오고, `idPrefix` 를 받아 한 화면에 여러 개를 그려도
 * `id` 가 부딪히지 않는다 (보고서가 두 챔버 × 기록 여러 개를 한 장에 그린다).
 */

import { ASSETS } from '../assets/index.js';
import { SENSOR } from '../sim/state.js';
import { ROOM_TEMP_C, OBSERVE_LIMIT_MIN } from '../sim/metabolism.js';
import { UI } from '../ui/strings.js';

/**
 * 온도계가 찬 정도 (0~1).
 *
 * **실온이 바닥, 실온+`TEMP_SPAN_C` 가 꼭대기**다. 0 ℃ 부터 그리면 이 실험에서
 * 견주는 1~2 ℃ 차이가 눈금 하나 안에 뭉개져 **두 챔버가 같아 보인다.**
 */
export const TEMP_SPAN_C = 3;
export const tempFillOf = (v) => Math.max(0, Math.min((v.tempC - ROOM_TEMP_C) / TEMP_SPAN_C, 1));

/**
 * 뷰 → 챔버 애셋이 받는 상태 한 벌.
 *
 * **이 함수가 유일한 통로다.** 실험대 토큰도 확대 뷰도 보고서도 여기를 거친다 —
 * 세 곳에서 따로 만들면 상태를 하나 더할 때 어긋난다.
 */
export function chamberAssetState(v) {
  return {
    beans: v.beans,
    scoops: v.scoops,
    btbStage: v.btbStage,
    sensor: v.sensor,
    sensorDepth: v.sensorDepth,
    sealed: v.sealed,
    tempFill: tempFillOf(v),
    seed: v.seed ?? 0,
  };
}

/**
 * 그림 안에서 **챔버 속**이 차지하는 세로 구간 (0~1).
 * 센서 손잡이를 놓는 자리다. `src/ui/zoom.js` 가 같은 값을 읽는다 —
 * 두 곳에 따로 적으면 손잡이를 끈 자리와 센서가 그려지는 자리가 어긋난다.
 */
export const INSIDE_TOP = 0.18;
export const INSIDE_BOTTOM = 0.86;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * 애셋 안의 `id` 에 앞가지를 붙인다.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 애셋은 `#lid`·`#beans` 처럼 **고정된 id** 로 노드를 약속한다 (계약이 그렇다).
 * 그런데 이 실험은 챔버를 **한 화면에 둘** 그린다. 그대로 두면 문서에 같은 id 가
 * 두 벌 생기고, `document.querySelector('#lid')` 는 **언제나 왼쪽 것만** 집는다 —
 * 에러 없이 조용히 틀린다. 보고서는 기록마다 두 장씩 그리므로 열 벌이 될 수도 있다.
 *
 * 애셋 파일 자체는 계약대로 두고, **화면에 넣을 때** 여기서 갈라 준다.
 * 애셋에는 `url(#…)`·`href="#…"` 같은 내부 참조가 없다 (그라데이션·필터가 금지라
 * 참조할 것이 없다) — 그래서 이름만 바꿔도 그림이 깨지지 않는다.
 */
const prefixIds = (svg, p) => svg.replace(/id="([^"]+)"/g, `id="${p}-$1"`);

/** 읽을 값 한 줄. 눈으로 아는 것과 센서로 아는 것을 표시로 갈라 둔다. */
function row(label, value, how) {
  return `<div class="cr-row" data-how="${how}">`
    + `<dt>${label}<span class="cr-how">${how === 'eye' ? UI.chamber.byEye : UI.chamber.bySensor}</span></dt>`
    + `<dd>${esc(value)}</dd></div>`;
}

/**
 * 챔버 한 칸.
 *
 * @param {object} v      `chamberView(state.chambers[id])`
 * @param {{idPrefix?: string, big?: boolean}} opts
 *   `big` — 확대 뷰. 센서 깊이를 끄는 손잡이가 함께 나온다.
 */
export function renderChamberCard(v, { idPrefix = 'c', big = false } = {}) {
  const C = UI.chamber;
  const svg = prefixIds(ASSETS.chamber.render(chamberAssetState(v)), idPrefix)
    .replace('<svg ', `<svg id="${idPrefix}-svg" `);

  /**
   * 센서 깊이 손잡이. **확대 뷰에서만** 나온다 —
   * 실험대의 작은 그림에서는 손가락보다 작아 잡히지 않는다.
   *
   * 가운데가 아니라 **왼쪽에** 둔다. 처음에는 가운데에 두었는데, 그러면 손잡이가
   * 센서 탐침을 통째로 가려서 **지금 콩에 닿았는지 보이지 않았다** — 이 조작에서
   * 봐야 하는 것이 바로 그것이다.
   */
  const handle = big && v.sensor !== SENSOR.NONE
    ? `<button type="button" class="sensor-handle" id="${idPrefix}-handle"
        style="top:${((INSIDE_TOP + (INSIDE_BOTTOM - INSIDE_TOP) * (v.sensorDepth ?? 0)) * 100).toFixed(1)}%"
        data-sensor="${v.sensor}"
        aria-label="${C.depthLabel}" aria-valuenow="${Math.round((v.sensorDepth ?? 0) * 100)}"
        aria-valuemin="0" aria-valuemax="100" role="slider">${C.depthGrip}</button>`
    : '';

  const rows = [
    row(C.btb, v.btbStage ? C.btbStages[v.btbStage] : C.btbNone, 'eye'),
    row(C.temp, UI.units.celsius(v.tempC), 'eye'),
    row(C.co2, v.sensor === SENSOR.NONE ? C.noSensorValue : UI.units.ppm(v.reading.co2Ppm), 'sensor'),
    row(C.elapsed, v.running || v.elapsedMin > 0
      ? `${UI.units.minutes(v.elapsedMin)}${v.finished ? ` / ${OBSERVE_LIMIT_MIN}분` : ''}`
      : C.notStarted, 'eye'),
  ].join('');

  const beans = v.mixed ? C.beansMixed
    : v.beans ? `${UI.beans[v.beans]} ${UI.units.scoops(v.scoops)}`
      : C.beansNone;

  return `<figure class="chamber-card${big ? ' chamber-card--big' : ''}" data-chamber="${v.id}"
    data-btb="${v.btbStage ?? 'none'}" data-sealed="${v.sealed}" data-sensor="${v.sensor}">
    <figcaption>
      ${big ? '' : `<b>${UI.chambers[v.id].name}</b>`}
      <span class="cr-beans">${esc(beans)}</span>
    </figcaption>
    <div class="chamber-figure" id="${idPrefix}-figure">${svg}${handle}</div>
    <dl class="chamber-read" id="${idPrefix}-read">${rows}</dl>
  </figure>`;
}

/**
 * 끄는 동안 **그림만** 다시 그린다.
 *
 * 통째로 다시 그리면 붙잡아 둔 손잡이가 문서에서 떨어져 나가고, 떨어져 나간 요소는
 * `setPointerCapture` 가 무효가 되어 **끌기가 조용히 끊긴다.** 실제로 바나나랩에서
 * 겪은 함정이라 여기서는 애초에 그림과 손잡이를 형제로 두었다.
 */
export function repaintFigure(figureEl, v) {
  const svg = figureEl.querySelector('svg');
  if (svg) {
    // 앞가지는 `<svg>` 의 id 에서 되찾는다 — 만들 때 쓴 것과 같아야 한다.
    const p = svg.id.replace(/-svg$/, '');
    svg.outerHTML = prefixIds(ASSETS.chamber.render(chamberAssetState(v)), p)
      .replace('<svg ', `<svg id="${svg.id}" `);
  }
  const handle = figureEl.querySelector('.sensor-handle');
  if (handle) {
    handle.style.top = `${((INSIDE_TOP + (INSIDE_BOTTOM - INSIDE_TOP) * (v.sensorDepth ?? 0)) * 100).toFixed(1)}%`;
    handle.setAttribute('aria-valuenow', String(Math.round((v.sensorDepth ?? 0) * 100)));
  }
}

/**
 * 두 챔버를 **나란히**. 견주는 것이 이 실험의 전부라, 한 화면에 함께 있어야 한다.
 */
export function renderComparison(views, { idPrefix = 'cmp' } = {}) {
  return `<div class="chamber-pair" id="${idPrefix}">`
    + ['L', 'R'].map((id) => renderChamberCard(views[id], { idPrefix: `${idPrefix}-${id}` })).join('')
    + '</div>';
}
