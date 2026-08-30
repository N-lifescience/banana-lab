/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. 애셋과 결과 렌더러가 살아 있는지,
 * 상태를 바꾸면 그림이 따라오는지 **눈으로** 확인하는 페이지다.
 *
 * 린터는 색과 두께만 본다. 시점·실루엣·"상태가 눈에 보이는가" 는 사람이 봐야 하고,
 * 그것을 보는 자리가 아래의 **애셋 시트**다 (PLAYBOOK §3).
 */

import * as paper from './assets/paper.js';
import { ASSETS, SAMPLE_STATES, PENDING } from './assets/index.js';
import { renderStrip } from './render/strip.js';
import { observability } from './sim/quality.js';
import { ORIGIN_MM, PAPER_H_MM, MIN_SPOT_MM } from './sim/develop.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);

/**
 * 손잡이가 잡는 값. **이 실험의 변인들**이다 —
 * 몇 번 찍는가 · 원점이 얼마나 커졌는가 · 전개액이 얼마나 깊은가 · 얼마나 올랐는가 ·
 * 뚜껑을 덮었는가 · 시료가 신선한가 · 무엇으로 원점을 그었는가.
 */
const state = {
  spots: 14,
  spotMm: MIN_SPOT_MM,
  depthMm: 5,
  frontMm: 90,
  capped: true,
  fresh: 1,
  marker: 'pencil',
  grit: 0,
  wetness: 0.4,
  markedFront: true,
  rulerPlaced: true,
  seed: 31337,
};

/** 손잡이 값들을 렌더러가 받는 한 벌로 바꾼다. `stripParams()` 와 같은 모양이어야 한다. */
function params() {
  const load = Math.min(1, state.spots * 0.062) * state.fresh;
  const submerged = state.depthMm >= ORIGIN_MM;
  return {
    originMm: ORIGIN_MM,
    marker: state.marker,
    spots: state.spots,
    spotMm: state.spotMm,
    load: submerged ? 0 : load,
    rawLoad: load,
    grit: state.grit,
    frontMm: state.frontMm,
    overrun: state.frontMm >= PAPER_H_MM,
    markedFront: state.markedFront && state.frontMm < PAPER_H_MM ? state.frontMm : null,
    markedBands: true,
    rulerPlaced: state.rulerPlaced,
    submerged,
    washedOut: submerged ? 1 : 0,
    // 뚜껑을 열어 두면 빛이 든다. 엽록소 두 가지가 먼저 옅어진다.
    chlorophyllKept: state.capped ? 1 : 0.2,
    wetness: state.wetness,
    torn: false,
    depthMm: state.depthMm,
    inVial: false,
    seed: state.seed,
  };
}

function paint() {
  const p = params();

  $('#paper-slot').innerHTML = paper.render({
    origin: ORIGIN_MM, spots: state.spots, spotMm: state.spotMm, wet: state.wetness,
  });
  $('#strip-slot').innerHTML = renderStrip(p, { idPrefix: 'harness-' });

  const q = observability(p);
  $('#q-fill').style.width = `${q.score}%`;
  $('#q-value').textContent = q.score;
  $('#q-hint').textContent = q.worst
    ? UI.observability.hint(UI.observability.worst[q.worst])
    : UI.observability.allGood;

  $('#v-spots').textContent = UI.units.times(state.spots);
  $('#v-spotMm').textContent = UI.units.mm(state.spotMm.toFixed(1));
  $('#v-depth').textContent = UI.units.mm(state.depthMm.toFixed(0));
  $('#v-front').textContent = UI.units.mm(state.frontMm.toFixed(0));
  $('#v-fresh').textContent = state.fresh.toFixed(2);
  $('#v-grit').textContent = state.grit.toFixed(2);
}

function bindRange(id, key, scale = 1) {
  $(id).addEventListener('input', (e) => {
    state[key] = Number(e.target.value) / scale;
    paint();
  });
}

bindRange('#spots', 'spots', 1);
bindRange('#spotMm', 'spotMm', 10);
bindRange('#depth', 'depthMm', 1);
bindRange('#front', 'frontMm', 1);
bindRange('#fresh', 'fresh', 100);
bindRange('#grit', 'grit', 100);

// 켜고 끄는 것들. 켜면 그림이 어떻게 달라지는지 보는 것이 이 페이지의 일이다.
document.querySelectorAll('#flags button').forEach((b) => {
  b.addEventListener('click', () => {
    const flag = b.dataset.flag;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    state[flag] = on;
    paint();
  });
});

document.querySelectorAll('#marker button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#marker button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    state.marker = b.dataset.value;
    paint();
  });
});

/**
 * 애셋 시트. 전 종을 같은 폭으로 늘어놓아 선 두께·음영 방향·크기 감각을 눈으로 대조한다.
 * 상태는 SAMPLE_STATES 의 첫 번째 것을 쓴다 — 린터가 검사하는 상태와 같아야 하기 때문이다.
 */
function paintSheet() {
  // id 는 `#asset-sheet` 다. `#sheet` 는 거름종이 애셋 안의 `<rect id="sheet">` 와 부딪힌다 —
  // 애셋이 페이지에 먼저 그려지므로 querySelector('#sheet') 가 **그 사각형**을 집어,
  // 애셋 시트가 종이 그림 속으로 들어가 버린다. **에러 없이 조용히** 틀린다.
  $('#asset-sheet').innerHTML = Object.entries(ASSETS).map(([name, mod]) => {
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
