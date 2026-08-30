/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. **반응 속도 모형이 실제 실험과 같은 순서를 내는지**
 * 눈으로 대조하는 페이지다. 이 실험은 결과가 색이 아니라 **시간 하나**라, 숫자가 틀리면
 * 그림이 아무리 예뻐도 틀린 시뮬레이터가 된다. 그래서 조건 → 시간을 먼저 본다.
 *
 * 오른쪽 「조건 계열 대조」가 이 페이지의 본체다. 여기서 확인할 것 셋:
 *   · 온도 계열에서 **37 ℃ 가 가장 빠르고 100 ℃ 는 안 뜬다**
 *   · 완충한 pH 계열에서 **pH 7 이 가장 빠르다**
 *   · 완충하지 않은 pH 계열에서 **pH 11 이 pH 7 보다 빠르다** (AGENTS.md §2.5 의 역전)
 * 셋 중 하나라도 어긋나면 모형이 깨진 것이다.
 */

import { ASSETS, SAMPLE_STATES, PENDING } from './assets/index.js';
import { riseTime, oxygenRate, preFizz, OBSERVE_LIMIT_S } from './sim/kinetics.js';
import { renderBeaker, observationState } from './render/beaker.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);
const H = UI.harness;

const state = {
  tempC: 20,
  ph: 7,
  h2o2Pct: 3,
  extractPct: 100,
  buffered: true,
  extractBoiled: false,
  elapsedS: 0,
  seed: 31337,
};

/** 초를 화면에 쓸 글자로. 안 뜬 조건은 숫자를 만들지 않는다 — 없는 값이지 큰 값이 아니다. */
const fmt = (r) => (r.floated ? `${r.seconds.toFixed(1)} 초` : H.neverRises(OBSERVE_LIMIT_S));

/* ------------------------------------------------------------------ */
/* 왼쪽 — 조건 하나                                                     */
/* ------------------------------------------------------------------ */

function paint() {
  const r = riseTime(state);
  const rate = oxygenRate(state);

  // 막대는 **빠를수록 길다.** 시간을 그대로 쓰면 느린 조건이 길어져 눈이 거꾸로 읽는다.
  $('#q-fill').style.width = `${Math.min(100, rate.total * 40)}%`;
  $('#q-value').textContent = fmt(r);
  $('#q-hint').textContent =
    `${H.rateEnzyme} ${rate.enzyme.toFixed(3)} · ${H.rateBase} ${rate.base.toFixed(3)}`
    + ` · ${H.preFizz} ${preFizz(state).toFixed(2)}`;

  // 결과 렌더러. 조건과 흐른 시간만 주면 그림이 나온다 — 물리를 여기서 다시 계산하지 않는다.
  $('#result-slot').innerHTML = renderBeaker(
    { conditions: state, elapsedS: state.elapsedS, hasDisc: true, seed: state.seed },
    { idPrefix: 'harness' },
  );
  $('#v-elapsed').textContent = `${state.elapsedS} 초`;
  $('#obs-state').textContent = H.observation[observationState(state, state.elapsedS, true)];

  $('#v-tempC').textContent = `${state.tempC} ℃`;
  $('#v-ph').textContent = `pH ${state.ph.toFixed(1)}`;
  $('#v-h2o2Pct').textContent = `${state.h2o2Pct.toFixed(1)} %`;
  $('#v-extractPct').textContent = `${state.extractPct} %`;
}

function bindRange(id, key, scale = 1) {
  $(id).addEventListener('input', (e) => {
    state[key] = Number(e.target.value) / scale;
    paint();
    paintSeries();
  });
}

bindRange('#tempC', 'tempC', 1);
bindRange('#ph', 'ph', 10);
bindRange('#h2o2Pct', 'h2o2Pct', 10);
bindRange('#extractPct', 'extractPct', 1);
bindRange('#elapsed', 'elapsedS', 1);

/** 참/거짓 두 칸짜리 토글. 라벨은 strings.js 에서 온다. */
function bindToggle(id, key, [offLabel, onLabel]) {
  const box = $(id);
  box.innerHTML = [offLabel, onLabel]
    .map((label, i) => `<button type="button" data-on="${i === 1}" `
      + `aria-pressed="${state[key] === (i === 1)}">${label}</button>`).join('');
  box.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      state[key] = b.dataset.on === 'true';
      box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed',
        String(x.dataset.on === String(state[key]))));
      paint();
      paintSeries();
    });
  });
}

/* ------------------------------------------------------------------ */
/* 오른쪽 — 계열 대조. 이 페이지의 본체다                                */
/* ------------------------------------------------------------------ */

/**
 * 계열 하나를 막대로 그린다.
 *
 * 막대 길이는 **그 계열 안에서 가장 오래 걸린 조건**에 맞춰 잡는다. 계열마다 시간대가
 * 열 배씩 차이 나므로(37 ℃ 8 초 · 60 ℃ 231 초), 전체 최댓값에 맞추면 빠른 계열이
 * 전부 한 점으로 뭉개진다. 계열 안의 **순서**를 보러 온 페이지라 계열 안에서 잰다.
 */
function seriesBlock(title, points) {
  const times = points.map((p) => riseTime(p.conditions));
  const max = Math.max(...times.map((t) => t.seconds ?? 0), 1);
  const rows = points.map((p, i) => {
    const t = times[i];
    const w = t.floated ? Math.max(2, (t.seconds / max) * 100) : 100;
    return `<div class="row${t.floated ? '' : ' none'}">`
      + `<span class="k">${p.label}</span>`
      + `<span class="b" style="width:${w}%"></span>`
      + `<span class="t">${t.floated ? `${t.seconds.toFixed(0)}s` : '—'}</span>`
      + '</div>';
  }).join('');
  return `<div><h3>${title}</h3>${rows}</div>`;
}

/** 계열의 조작변인만 바꾸고 **나머지는 지금 화면의 조건 그대로** 둔다 — 통제변인의 뜻 그대로다. */
function paintSeries() {
  const base = { ...state };
  $('#series').className = 'series';
  $('#series').innerHTML = [
    seriesBlock(H.seriesTemp, [0, 20, 37, 60, 100].map((tempC) => ({
      label: `${tempC} ℃`, conditions: { ...base, tempC, ph: 7 },
    }))),
    seriesBlock(H.seriesPhBuffered, [3, 5, 7, 9, 11].map((ph) => ({
      label: `pH ${ph}`, conditions: { ...base, ph, buffered: true },
    }))),
    seriesBlock(H.seriesPhRaw, [3, 5, 7, 9, 11].map((ph) => ({
      label: `pH ${ph}`, conditions: { ...base, ph, buffered: false },
    }))),
  ].join('');
}

/* ------------------------------------------------------------------ */
/* 애셋 시트                                                            */
/* ------------------------------------------------------------------ */

/**
 * 전 종을 같은 폭으로 늘어놓아 선 두께·음영 방향·크기 감각을 눈으로 대조한다.
 * 상태는 SAMPLE_STATES 의 첫 번째 것을 쓴다 — 린터가 검사하는 상태와 같아야 하기 때문이다.
 */
function paintSheet() {
  $('#sheet').innerHTML = Object.entries(ASSETS).map(([name, mod]) => {
    const sample = SAMPLE_STATES[name]?.[0] ?? {};
    // 한글 이름과 함께 파일 키도 보여 준다 — 그림을 고칠 사람이 찾아야 할 것은 키다.
    const label = `${UI.assetNames[name] ?? name} <code>${name}.js</code>`;
    const pending = PENDING.includes(name) ? ' <b>자리표시</b>' : '';
    return `<div class="cell">${mod.render({ ...sample, seed: state.seed })}<span class="name">${label}${pending}</span></div>`;
  }).join('');
}

/* ------------------------------------------------------------------ */

$('#harness-note').textContent = UI.harnessNote;
$('#h-conditions').textContent = H.conditions;
$('#h-series').textContent = H.series;
$('#series-note').textContent = H.seriesNote;
$('#l-elapsed').textContent = H.elapsed;
$('#l-tempC').textContent = H.tempC;
$('#l-ph').textContent = H.ph;
$('#l-h2o2Pct').textContent = H.h2o2Pct;
$('#l-extractPct').textContent = H.extractPct;
$('#l-buffered').textContent = H.buffered;
$('#l-extractBoiled').textContent = H.extractBoiled;
$('#l-riseTime').textContent = H.riseTime;

bindToggle('#buffered', 'buffered', [H.bufferedOff, H.bufferedOn]);
bindToggle('#extractBoiled', 'extractBoiled', [H.boiledOff, H.boiledOn]);

paint();
paintSeries();
paintSheet();
