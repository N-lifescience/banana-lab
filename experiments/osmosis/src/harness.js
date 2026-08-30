/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. 애셋과 시야 렌더러가 살아 있는지,
 * 상태를 바꾸면 그림이 따라오는지 **눈으로** 확인하는 페이지다.
 *
 * 여기서 봐야 하는 것 (린터가 못 잡는 것들):
 *   · 바깥쪽과 안쪽 표피의 색이 화면에서 실제로 갈리는가
 *   · 농도를 올릴수록 **원형질체만** 줄고 세포벽은 제자리에 있는가
 *   · 증류수에서 세포가 터진 것처럼 보이지 않는가
 *   · 애셋 시트에서 선 두께·음영 방향·크기 감각이 옆 칸과 맞는가
 */

import * as onion from './assets/onion.js';
import { ASSETS, SAMPLE_STATES, PENDING } from './assets/index.js';
import { renderFOV } from './render/fov.js';
import { observability } from './sim/quality.js';
import { pctOf, effectivePct, plasmolysedFraction } from './sim/osmosis.js';
import { hash } from './assets/geometry.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  side: 'outer',
  cut: false,
  peeled: false,
  solution: 'WATER',
  exchange: 1,
  osmosis: 1,
  thickness: 0.28,
  drops: 2,
  objective: 10,
  focus: 0,
  diaphragm: 0.8,
  pan: 0,
  cracked: false,
  folded: false,
  bubbles: 0,
  seed: 31337,
};

/**
 * 시야에 넘길 값. `src/sim/state.js` 의 `fieldParams` 와 **같은 모양**이라야 한다 —
 * 여기서만 도는 별도 계산을 두면 하네스에서 멀쩡한 것이 앱에서 깨진다.
 */
function fieldParams() {
  // 치환이 덜 됐으면 섞인 농도다. 그 농도까지 삼투가 얼마나 진행됐는지가 osmosis 다.
  const target = effectivePct(0, pctOf(state.solution), state.exchange);
  return {
    side: state.side,
    folded: state.folded,
    tooThick: state.thickness > 0.6,
    equivPct: target * state.osmosis,
    targetPct: target,
    exchange: state.exchange,
    coverage: Math.min(state.drops / 2, 1),
    excess: Math.max(0, Math.min((state.drops - 2) / 3, 1)),
    floating: Math.max(0, Math.min((state.drops - 2) / 3, 1)) > 0.6,
    contaminated: false,
    bubbles: state.bubbles,
    cracked: state.cracked,
    lensTouched: false,
    objective: state.objective,
    focusErr: Math.abs(state.focus),
    brightness: Math.max(0, Math.min(1, state.diaphragm / (state.objective === 40 ? 0.85 : state.objective === 10 ? 0.55 : 0.35))),
    panX: state.pan,
    panY: 0,
    seed: state.seed,
  };
}

function paint() {
  $('#onion-slot').innerHTML = onion.render({
    side: state.side, cut: state.cut, peeled: state.peeled ? 1 : 0,
  });

  const p = fieldParams();
  $('#fov-slot').innerHTML = renderFOV(p);

  const q = observability(p);
  $('#q-fill').style.width = `${q.score}%`;
  $('#q-value').textContent = q.score;
  $('#q-hint').textContent = q.worst
    ? UI.observability.hint(UI.observability.worst[q.worst])
    : UI.observability.allGood;

  // 모형이 뜻대로 도는지 보는 숫자. **앱 화면에는 절대 내보내지 않는다** —
  // 이 비율을 시야에서 읽어 내는 것이 학생의 일이다 (docs/04 「화면이 답을 먼저 말하지 않는다」).
  const h = (...ints) => hash(state.seed, ...ints);
  const frac = plasmolysedFraction(p.equivPct, h);
  $('#fov-note').textContent =
    `[하네스 전용] 지금 조건에서 원형질분리 세포 비율 ${(frac * 100).toFixed(0)} % · `
    + `실효 농도 ${p.equivPct.toFixed(1)} %. 앱 화면에는 이 숫자가 나오지 않습니다.`;

  $('#v-exchange').textContent = state.exchange.toFixed(2);
  $('#v-osmosis').textContent = state.osmosis.toFixed(2);
  $('#v-thickness').textContent = state.thickness.toFixed(2);
  $('#v-drops').textContent = UI.units.drops(state.drops);
  $('#v-objective').textContent = UI.units.mag(state.objective * 10);
  $('#v-focus').textContent = state.focus.toFixed(3);
  $('#v-diaphragm').textContent = state.diaphragm.toFixed(2);
  $('#v-pan').textContent = `${state.pan > 0 ? '+' : ''}${state.pan} px`;
}

function bindRange(id, key, scale = 1) {
  $(id).addEventListener('input', (e) => {
    state[key] = Number(e.target.value) / scale;
    paint();
  });
}

bindRange('#exchange', 'exchange', 100);
bindRange('#osmosis', 'osmosis', 100);
bindRange('#thickness', 'thickness', 100);
bindRange('#drops', 'drops', 1);
bindRange('#focus', 'focus', 1000);
bindRange('#diaphragm', 'diaphragm', 100);
bindRange('#pan', 'pan', 1);

/** 하나만 켜지는 단추 묶음 */
function bindSegment(sel, apply) {
  document.querySelectorAll(`${sel} button`).forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll(`${sel} button`).forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      apply(b.dataset.value);
      paint();
    });
  });
}

bindSegment('#side', (v) => { state.side = v; });
bindSegment('#solution', (v) => { state.solution = v; });

// 켜고 끄는 단추 묶음. 시야에 어떻게 나타나는지 본다.
document.querySelectorAll('#flags button, #onionFlags button').forEach((b) => {
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

/**
 * 애셋 시트. 전 종을 같은 폭으로 늘어놓아 선 두께·음영 방향·크기 감각을 눈으로 대조한다.
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

$('#harness-note').textContent = UI.harnessNote;
paint();
paintSheet();
