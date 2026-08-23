/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. 애셋과 시야 렌더러가 살아 있는지,
 * 상태를 바꾸면 그림이 따라오는지 눈으로 확인하는 페이지다.
 * T04에서 진짜 조작 UI로 교체한다.
 */

import * as banana from './assets/banana.js';
import { renderFOV } from './render/fov.js';
import { observability } from './sim/quality.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  ripe: 0.35,
  peel: 0,
  reagent: 'IKI',
  drops: 2,
  objective: 40,
  focus: 0,
  diaphragm: 0.8,
  thickness: 0.3,
  seed: 31337,
};

function fieldParams() {
  const coverage = Math.min(state.drops / 2, 1);
  const excess = Math.max(0, Math.min((state.drops - 2) / 3, 1));
  const needed = state.objective === 40 ? 0.85 : state.objective === 10 ? 0.55 : 0.35;
  return {
    reagent: state.reagent === 'NONE' ? null : state.reagent,
    coverage,
    excess,
    floating: excess > 0.6,
    tooThick: state.thickness > 0.6,
    contaminated: false,
    bubbles: 0,
    objective: state.objective,
    focusErr: Math.abs(state.focus),
    brightness: Math.max(0, Math.min(1, state.diaphragm / needed)),
    seed: state.seed,
  };
}

function paint() {
  $('#banana-slot').innerHTML = banana.render({ ripe: state.ripe, peel: state.peel, seed: state.seed });

  const p = fieldParams();
  $('#fov-slot').innerHTML = renderFOV(p);

  const q = observability(p);
  $('#q-fill').style.width = `${q.score}%`;
  $('#q-value').textContent = q.score;
  $('#q-hint').textContent = UI.observability.hint(UI.observability.worst[q.worst]);

  $('#v-ripe').textContent = state.ripe.toFixed(2);
  $('#v-peel').textContent = state.peel.toFixed(2);
  $('#v-drops').textContent = UI.units.drops(state.drops);
  $('#v-objective').textContent = UI.units.mag(state.objective * 10);
  $('#v-focus').textContent = state.focus.toFixed(3);
  $('#v-diaphragm').textContent = state.diaphragm.toFixed(2);
  $('#v-thickness').textContent = state.thickness.toFixed(2);
}

function bindRange(id, key, scale = 1) {
  $(id).addEventListener('input', (e) => {
    state[key] = Number(e.target.value) / scale;
    paint();
  });
}

bindRange('#ripe', 'ripe', 100);
bindRange('#peel', 'peel', 100);
bindRange('#drops', 'drops', 1);
bindRange('#focus', 'focus', 1000);
bindRange('#diaphragm', 'diaphragm', 100);
bindRange('#thickness', 'thickness', 100);

$('#objective').addEventListener('input', (e) => {
  state.objective = [4, 10, 40][Number(e.target.value)];
  paint();
});

document.querySelectorAll('#reagent button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#reagent button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    state.reagent = b.dataset.value;
    paint();
  });
});

$('#harness-note').textContent = UI.harnessNote;
paint();
