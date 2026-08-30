/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. **애셋과 결과 렌더러가 살아 있는지**,
 * 상태를 바꾸면 그림이 따라오는지 눈으로 확인하는 페이지다.
 *
 * 복제해서 새 실험을 만들 때 여기가 가장 먼저 죽는다 — 앞 실험의 상태값(익은 정도·
 * 방울 수 …)을 읽고 있어서 여는 순간 TypeError 가 난다. **손잡이를 이 실험 것으로 간다.**
 */

import { ASSETS, SAMPLE_STATES, PENDING } from './assets/index.js';
import { renderTube } from './render/tube.js';
import { observability } from './sim/quality.js';
import { HEMATOCRIT, layerFractions, packedFraction } from './sim/spin.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  speed: 0.6,
  slots: 'both',
  column: 0.7,
  separation: 0.95,
  mixed: 0,
  clot: 0,
  bubbles: 0,
  ruler: false,
  labels: true,
  female: false,
  seed: 31337,
};

/** 결과 렌더러에 넘길 값 한 벌. `src/sim/state.js` 의 `tubeParams()` 와 같은 모양이다. */
function tubeParams() {
  const hct = state.female ? HEMATOCRIT.female : HEMATOCRIT.male;
  const parts = layerFractions(hct);
  const clotted = state.clot >= 0.35;
  return {
    column: state.column,
    // **덜 갈리면 붉은 부분이 길다.** 이 곡선이 뒤집히면 그림이 거꾸로 간다 (spin.js).
    packedOfColumn: packedFraction(state.separation, hct),
    buffyOfColumn: parts.buffy * state.separation,
    separation: state.separation,
    sharpness: state.separation * (1 - state.mixed),
    clotted,
    clot: state.clot,
    bubbles: state.bubbles,
    mixed: state.mixed,
    lost: 0,
    broken: false,
    kind: 'heparin',
    donor: state.female ? 'female' : 'male',
    seal: { outer: 1, inner: 1 },
    rulerPlaced: state.ruler,
    seed: state.seed,
  };
}

function rotorState() {
  return {
    speed: state.speed,
    slotA: state.slots === 'none' ? null : 'sample',
    slotB: state.slots === 'both' ? 'counter' : null,
    wobble: state.slots === 'one' ? 1 : 0,
  };
}

function paint() {
  const p = tubeParams();
  $('#rotor-slot').innerHTML = ASSETS.rotor.render(rotorState());
  $('#capillary-slot').innerHTML = ASSETS.capillary.render({
    fill: state.column, kind: 'heparin', seal: { outer: 1, inner: 1 }, broken: false, seed: state.seed,
  });
  // **idPrefix 를 준다.** 안 주면 한 화면에 여러 장을 그리는 날 조용히 틀린다.
  $('#tube-slot').innerHTML = renderTube(p, { idPrefix: 'harness-', labels: state.labels });

  const q = observability(p);
  $('#q-fill').style.width = `${q.score}%`;
  $('#q-value').textContent = q.score;
  $('#q-hint').textContent = q.worst
    ? UI.observability.hint(UI.observability.worst[q.worst])
    : UI.observability.allGood;

  $('#v-speed').textContent = state.speed.toFixed(2);
  $('#v-column').textContent = state.column.toFixed(2);
  $('#v-separation').textContent = state.separation.toFixed(2);
  $('#v-mixed').textContent = state.mixed.toFixed(2);
  $('#v-clot').textContent = state.clot.toFixed(2);
  $('#v-bubbles').textContent = state.bubbles.toFixed(2);
}

function bindRange(id, key, scale = 1) {
  $(id).addEventListener('input', (e) => {
    state[key] = Number(e.target.value) / scale;
    paint();
  });
}

bindRange('#speed', 'speed', 100);
bindRange('#column', 'column', 100);
bindRange('#separation', 'separation', 100);
bindRange('#mixed', 'mixed', 100);
bindRange('#clot', 'clot', 100);
bindRange('#bubbles', 'bubbles', 100);

document.querySelectorAll('#flags button').forEach((b) => {
  b.addEventListener('click', () => {
    const flag = b.dataset.flag;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    state[flag] = on;
    paint();
  });
});

document.querySelectorAll('#slots button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#slots button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    state.slots = b.dataset.value;
    paint();
  });
});

/**
 * 애셋 시트. 전 종을 같은 폭으로 늘어놓아 선 두께·음영 방향·크기 감각을 눈으로 대조한다.
 * 상태는 SAMPLE_STATES 의 첫 번째 것을 쓴다 — 린터가 검사하는 상태와 같아야 하기 때문이다.
 *
 * **린터는 색과 두께만 본다.** 시점·실루엣·"상태가 눈에 보이는가" 는 사람이 봐야 하고,
 * 그래서 이 화면이 있다 (PLAYBOOK §3).
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

$('#harness-note').textContent = UI.harnessNote;
paint();
paintSheet();
