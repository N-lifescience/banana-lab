/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. 애셋과 시야 렌더러가 살아 있는지,
 * 상태를 바꾸면 그림이 따라오는지 눈으로 확인하는 페이지다.
 * T04에서 진짜 조작 UI로 교체한다.
 */

import { ASSETS, SAMPLE_STATES, PENDING } from './assets/index.js';
import { renderFOV } from './render/fov.js';
import { observability } from './sim/quality.js';
import { umPerEyepieceDiv } from './sim/optics.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  on: 'stageMic',      // 재물대에 무엇이 올라가 있는가
  hasReticle: true,
  flipped: false,
  eyeAngle: 0,
  itemAngle: 6,
  objective: 40,
  focus: 0,
  diaphragm: 0.55,
  pan: 0,
  cracked: false,
  seed: 31337,
};

/**
 * 하네스가 시야 렌더러에 넘기는 값 한 벌.
 *
 * `src/sim/state.js` 의 `fieldParams()` 와 **키가 같아야 한다.** 여기서 손으로 만드는 이유는
 * 하네스가 규칙 엔진을 거치지 않고 슬라이더로 곧장 값을 흔들어 보는 자리이기 때문이다.
 * 키가 어긋나면 하네스에서만 멀쩡하고 앱에서는 다른 그림이 나온다.
 */
function fieldParams() {
  const b = Math.max(0, Math.min(1, state.diaphragm));
  const d = Math.abs(b - 0.55) / 0.55;
  return {
    on: state.on === 'none' ? null : state.on,
    hasReticle: state.hasReticle,
    flipped: state.flipped,
    eyeAngle: state.eyeAngle,
    itemAngle: state.itemAngle,
    cracked: state.cracked,
    objective: state.objective,
    focusErr: Math.abs(state.focus),
    contrast: b <= 0 ? 0 : Math.max(0, 1 - d * d),
    panX: state.pan,
    panY: 0,
    seed: state.seed,
  };
}

function paint() {
  const p = fieldParams();
  $('#fov-slot').innerHTML = renderFOV(p);
  $('#ocular-slot').innerHTML = ASSETS.ocular.render({
    inCase: false, flipped: state.flipped, seed: state.seed,
  });

  const q = observability(p);
  $('#q-fill').style.width = `${q.score}%`;
  $('#q-value').textContent = q.score;
  $('#q-hint').textContent = UI.observability.hint(UI.observability.worst[q.worst]);

  $('#v-eyeAngle').textContent = `${state.eyeAngle}°`;
  $('#v-itemAngle').textContent = `${state.itemAngle}°`;
  $('#v-objective').textContent = UI.units.mag(state.objective * 10);
  $('#v-focus').textContent = state.focus.toFixed(3);
  $('#v-diaphragm').textContent = state.diaphragm.toFixed(2);
  $('#v-pan').textContent = `${state.pan > 0 ? '+' : ''}${state.pan} px`;

  // 규칙 엔진을 거치지 않는 자리라, **눈으로 볼 수 없는 두 수**를 여기서만 드러낸다.
  // 어긋난 각은 표본일 때 0 이어야 한다 — 표본에는 맞출 눈금자가 없다.
  const gap = state.on !== 'stageMic' || !state.hasReticle
    ? 0
    : (() => {
        const folded = (((state.eyeAngle - state.itemAngle) % 180) + 180) % 180;
        return folded > 90 ? 180 - folded : folded;
      })();
  $('#v-gap').textContent = `${gap.toFixed(0)}°`;
  $('#v-um').textContent = `${umPerEyepieceDiv(state.objective).toFixed(2)} µm`;
}

function bindRange(id, key, scale = 1) {
  $(id).addEventListener('input', (e) => {
    state[key] = Number(e.target.value) / scale;
    paint();
  });
}

bindRange('#eyeAngle', 'eyeAngle', 1);
bindRange('#itemAngle', 'itemAngle', 1);
bindRange('#focus', 'focus', 1000);
bindRange('#diaphragm', 'diaphragm', 100);
bindRange('#pan', 'pan', 1);

document.querySelectorAll('#flags button').forEach((b) => {
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    state[b.dataset.flag] = on;
    paint();
  });
});

$('#objective').addEventListener('input', (e) => {
  state.objective = [4, 10, 40][Number(e.target.value)];
  paint();
});

/** 한 무리에서 하나만 눌린 상태로 두는 토글. */
function bindSeg(sel, apply) {
  document.querySelectorAll(`${sel} button`).forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll(`${sel} button`).forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      apply(b.dataset.value);
      paint();
    });
  });
}

bindSeg('#reticle', (v) => {
  state.hasReticle = v !== 'none';
  state.flipped = v === 'flipped';
});
bindSeg('#stage-item', (v) => { state.on = v; });

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
