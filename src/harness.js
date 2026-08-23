/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. 애셋과 시야 렌더러가 살아 있는지,
 * 상태를 바꾸면 그림이 따라오는지 눈으로 확인하는 페이지다.
 * T04에서 진짜 조작 UI로 교체한다.
 */

import * as banana from './assets/banana.js';
import { ASSETS, SAMPLE_STATES } from './assets/index.js';
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
  reaction: 1,
  pan: 0,
  cracked: false,
  contaminated: false,
  bubbles: 0,
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
    contaminated: state.contaminated,
    bubbles: state.bubbles,
    cracked: state.cracked,
    reactionT: state.reaction,
    panX: state.pan,
    panY: 0,
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
  $('#v-reaction').textContent = state.reaction.toFixed(2);
  $('#v-pan').textContent = `${state.pan > 0 ? '+' : ''}${state.pan} px`;
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
bindRange('#reaction', 'reaction', 100);
bindRange('#pan', 'pan', 1);

// 슬라이드에 붙은 상태 셋. 켜고 끄면서 시야에 어떻게 나타나는지 본다.
document.querySelectorAll('#flags button').forEach((b) => {
  b.addEventListener('click', () => {
    const flag = b.dataset.flag;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    state[flag] = flag === 'bubbles' ? (on ? 3 : 0) : on;
    paint();
  });
});

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

/**
 * 애셋 시트. 전 종을 같은 폭으로 늘어놓아 선 두께·음영 방향·크기 감각을 눈으로 대조한다.
 * 상태는 SAMPLE_STATES 의 첫 번째 것을 쓴다 — 린터가 검사하는 상태와 같아야 하기 때문이다.
 */
function paintSheet() {
  $('#sheet').innerHTML = Object.entries(ASSETS).map(([name, mod]) => {
    const sample = SAMPLE_STATES[name]?.[0] ?? {};
    return `<div class="cell">${mod.render({ ...sample, seed: state.seed })}<span class="name">${name}</span></div>`;
  }).join('');
}

$('#harness-note').textContent = UI.harnessNote;
paint();
paintSheet();
