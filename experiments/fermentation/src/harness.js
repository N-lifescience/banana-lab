/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. **발효 모형이 실제 실험과 같은 순서를 내는지**
 * 눈으로 대조하는 페이지다. 이 실험은 결과가 색이 아니라 **양 하나**라, 숫자가 틀리면
 * 그림이 아무리 예뻐도 틀린 시뮬레이터가 된다. 그래서 조건 → 기체 양을 먼저 본다.
 *
 * 오른쪽 「조건 계열 대조」가 이 페이지의 본체다. 여기서 확인할 것 셋:
 *   · 온도 계열에서 **30 ℃ 근처가 가장 많고 55 ℃ 는 거의 안 난다**
 *   · 온도 계열에서 **10 ℃ 도 거의 안 난다** — 다만 그것은 죽어서가 아니다
 *   · 포도당 계열에서 **0 % 는 아예 안 나고 10 % 가 5 % 의 두 배쯤 난다**
 * 셋 중 하나라도 어긋나면 모형이 깨진 것이다.
 */

import { ASSETS, SAMPLE_STATES, PENDING } from './assets/index.js';
import {
  gasVolume, gasRate, gasAfterKoh, fillFraction,
  OBSERVE_LIMIT_MIN, CLOSED_ARM_CAPACITY_ML, KOH_POUR_ML, GLUCOSE_POUR_ML, YEAST_POUR_ML,
} from './sim/fermentation.js';
import { renderTube, observationState } from './render/tube.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);
const H = UI.harness;

const state = {
  tempC: 30,
  glucosePct: 10,
  yeastMl: YEAST_POUR_ML,
  plugged: true,
  elapsedMin: 0,
};

/** 지금 조건 한 벌. 총 부피는 표준 배치로 둔다 — 여기서 보려는 것은 부피가 아니다. */
const conditions = () => ({
  tempC: state.tempC,
  glucosePct: state.glucosePct,
  yeastMl: state.yeastMl,
  totalMl: GLUCOSE_POUR_ML + state.yeastMl,
  plugged: state.plugged,
});

/** 화면에 그릴 발효관 하나. 조건을 얼려 둔 것으로 만든다. */
const tubeOf = () => ({
  glucosePct: state.glucosePct,
  glucoseMl: GLUCOSE_POUR_ML,
  yeastMl: state.yeastMl,
  waterMl: state.yeastMl > 0 ? 0 : YEAST_POUR_ML,
  plugged: state.plugged,
  tempC: state.tempC,
  inIncubator: state.elapsedMin < OBSERVE_LIMIT_MIN,
  runConditions: conditions(),
  elapsedMin: state.elapsedMin,
  drained: false,
  kohMl: 0,
});

/* ------------------------------------------------------------------ */
/* 왼쪽 — 조건 하나                                                     */
/* ------------------------------------------------------------------ */

function paint() {
  const c = conditions();
  const ml = gasVolume(c, OBSERVE_LIMIT_MIN);

  // 막대는 **많이 날수록 길다.** 맹관부 용량을 가득으로 본다.
  $('#q-fill').style.width = `${Math.min(100, (ml / CLOSED_ARM_CAPACITY_ML) * 100)}%`;
  $('#q-value').textContent = `${ml.toFixed(1)} mL`;
  $('#q-hint').textContent =
    `${H.fill} ${(fillFraction(c, OBSERVE_LIMIT_MIN) * 100).toFixed(0)} %`
    + ` · ${H.afterKoh} ${gasAfterKoh(ml, KOH_POUR_ML).toFixed(2)} mL`;

  // 결과 렌더러. 발효관 상태만 주면 그림이 나온다 — 물리를 여기서 다시 계산하지 않는다.
  const tube = tubeOf();
  $('#result-slot').innerHTML = renderTube(tube, { idPrefix: 'harness' });
  $('#v-elapsed').textContent = `${state.elapsedMin} 분`;
  $('#obs-state').textContent = H.observation[observationState(tube)];

  $('#v-tempC').textContent = `${state.tempC} ℃`;
  $('#v-glucosePct').textContent = `${state.glucosePct.toFixed(1)} %`;
  $('#v-yeastMl').textContent = `${state.yeastMl} mL`;
}

function bindRange(id, key, scale = 1) {
  $(id).addEventListener('input', (e) => {
    state[key] = Number(e.target.value) / scale;
    paint();
    paintSeries();
  });
}

bindRange('#tempC', 'tempC', 1);
bindRange('#glucosePct', 'glucosePct', 10);
bindRange('#yeastMl', 'yeastMl', 1);
bindRange('#elapsed', 'elapsedMin', 1);

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
 * 막대 길이는 **그 계열 안에서 가장 많이 난 조건**에 맞춰 잡는다. 계열마다 크기가
 * 다르므로 전체 최댓값에 맞추면 작은 계열이 전부 한 점으로 뭉개진다.
 * 계열 안의 **순서**를 보러 온 페이지라 계열 안에서 잰다.
 */
function seriesBlock(title, points) {
  const values = points.map((p) => gasVolume(p.conditions, OBSERVE_LIMIT_MIN));
  const max = Math.max(...values, 0.001);
  const rows = points.map((p, i) => {
    const ml = values[i];
    const w = Math.max(1, (ml / max) * 100);
    // 0.05 mL 미만은 「사실상 안 난다」다. 숫자를 그대로 적으면 0.0 이라 안 난 것과 같아 보이는데,
    // 실제로는 아주 조금 나는 것과 아예 안 나는 것이 다른 일이다.
    const label = ml < 0.05 ? '—' : `${ml.toFixed(1)}`;
    return `<div class="row${ml < 0.05 ? ' none' : ''}">`
      + `<span class="k">${p.label}</span>`
      + `<span class="b" style="width:${w}%"></span>`
      + `<span class="t">${label}</span>`
      + '</div>';
  }).join('');
  return `<div><h3>${title}</h3>${rows}</div>`;
}

/** 계열의 조작변인만 바꾸고 **나머지는 지금 화면의 조건 그대로** 둔다 — 통제변인의 뜻 그대로다. */
function paintSeries() {
  const base = conditions();
  $('#series').className = 'series';
  $('#series').innerHTML = [
    seriesBlock(H.seriesTemp, [0, 10, 20, 30, 33, 40, 45, 55, 60].map((tempC) => ({
      label: `${tempC} ℃`, conditions: { ...base, tempC },
    }))),
    seriesBlock(H.seriesGlucose, [0, 2.5, 5, 10].map((glucosePct) => ({
      label: `${glucosePct} %`, conditions: { ...base, glucosePct, tempC: 33 },
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
    return `<div class="cell">${mod.render(sample)}<span class="name">${label}${pending}</span></div>`;
  }).join('');
}

/* ------------------------------------------------------------------ */

$('#harness-note').textContent = UI.harnessNote;
$('#h-conditions').textContent = H.conditions;
$('#h-series').textContent = H.series;
$('#series-note').textContent = H.seriesNote;
$('#l-elapsed').textContent = H.elapsed;
$('#l-tempC').textContent = H.tempC;
$('#l-glucosePct').textContent = H.glucosePct;
$('#l-yeastMl').textContent = H.yeastMl;
$('#l-plugged').textContent = H.plugged;
$('#l-gas').textContent = H.gas;

bindToggle('#plugged', 'plugged', [H.pluggedOff, H.pluggedOn]);

paint();
paintSeries();
paintSheet();

// 콘솔에서 모형을 직접 만져 볼 수 있게 둔다. 하네스는 배포본에 안 들어간다.
void gasRate;
