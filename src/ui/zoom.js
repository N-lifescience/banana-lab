/**
 * 확대 뷰 — 슬라이드 제작 모드 / 현미경 관찰 모드.
 *
 * Esc 로 나간다. 여는 요소가 <button> 이므로 키보드로도 들어올 수 있다 (bench.js 참조).
 * 열렸을 때 포커스를 뷰 안으로 옮기고, 닫으면 열었던 곳으로 되돌린다.
 *
 * 성능 — src/render/fov.js 머리말 참조:
 *   현미경 모드에서 시야를 드래그하는 동안, 초점/조리개를 슬라이더로 움직이는 동안에는
 *   renderFOV() 를 다시 부르지 않는다. #fov-scene 의 transform, #fov-blur 의 stdDeviation,
 *   #fov-dark 의 opacity 세 속성만 직접 갱신한다.
 */

import { renderFOV } from '../render/fov.js';
import { observability } from '../sim/quality.js';
import { fieldParams, focusError, brightness, isFloating, PAN_LIMIT } from '../sim/state.js';
import { UI } from './strings.js';
import * as slideModule from '../assets/slide.js';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function createZoom(root, store) {
  root.className = 'zoom-overlay';
  root.hidden = true;
  root.innerHTML = `
    <div class="zoom-panel" role="dialog" aria-modal="true" tabindex="-1">
      <button type="button" id="zoom-close" class="zoom-close"></button>
      <div class="zoom-body"></div>
    </div>`;
  const panel = root.querySelector('.zoom-panel');
  const body = root.querySelector('.zoom-body');
  const closeBtn = root.querySelector('.zoom-close');
  closeBtn.textContent = UI.zoom.close;

  let mode = null;
  let slideId = null;
  let opener = null;
  let openerId = null;
  let panDrag = null;
  // 재물대를 끌거나 슬라이더를 쥐고 있는 동안에는 구독으로 들어오는 전체 다시 그리기를
  // 건너뛴다. TICK 처럼 사용자와 무관한 상태 변경이 body.innerHTML 을 새로 만들면
  // 드래그 중인 요소(#fov-slot, <input type=range>)가 통째로 사라져 조작이 끊긴다.
  let busy = false;

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.removeEventListener('keydown', onKeydown);
    // 재물대 이동·초점·조리개는 드래그 중 skipNotify 로 조용히 갱신됐다.
    // 닫을 때 한 번 전체를 동기화해 실험대(배경) 뷰가 최신 상태를 반영하게 한다.
    // 이 notify 가 bench 를 다시 그리면 opener 로 잡아 둔 버튼 자체가 새 요소로 바뀌므로,
    // notify 를 먼저 하고 나서 data-id 로 (다시 만들어졌을 수도 있는) 같은 자리를 찾아 포커스한다.
    store.notify();
    const target = openerId ? document.querySelector(`[data-id="${openerId}"]`) : opener;
    if (target && target.isConnected) target.focus();
    opener = null;
    openerId = null;
  }
  closeBtn.addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });

  function open(openMode, openSlideId, openerEl) {
    mode = openMode;
    slideId = openSlideId;
    opener = openerEl ?? document.activeElement;
    openerId = opener?.dataset?.id ?? null;
    root.hidden = false;
    document.addEventListener('keydown', onKeydown);
    renderBody();
    panel.focus();
  }

  function renderBody() {
    if (mode === 'slide') renderSlideMode();
    else if (mode === 'scope') renderScopeMode();
  }

  /* ---------------------------------------------------------------- */
  /* 슬라이드 제작 모드                                                 */
  /* ---------------------------------------------------------------- */

  function renderSlideMode() {
    const s = store.getState().slides[slideId];
    const label = UI.slides[slideId];
    body.innerHTML = `
      <h2>${UI.zoom.slideMode(label)}</h2>
      <div class="zoom-slide-stage"></div>
      <dl class="zoom-readout">
        <div><dt>${UI.controls.reagent}</dt><dd>${UI.reagents[s.stain ?? 'NONE']}</dd></div>
        <div><dt>${UI.controls.drops}</dt><dd>${UI.units.drops(s.drops)}</dd></div>
        <div><dt>덮개 유리</dt><dd>${s.coverslip.placed ? `놓임 (기포 ${s.coverslip.bubbles}개)` : '없음'}</dd></div>
      </dl>
      <div class="zoom-cover-control">
        <label for="zoom-cover-angle">${UI.zoom.coverAngle}</label>
        <input type="range" id="zoom-cover-angle" min="0" max="90" step="1" value="45">
        <button type="button" id="zoom-cover-place">${UI.zoom.placeCoverslip}</button>
      </div>`;
    body.querySelector('.zoom-slide-stage').innerHTML = slideModule.render({
      sample: s.sample, stain: s.stain, reaction: s.reactionT,
      coverslip: s.coverslip.placed, bubbles: s.coverslip.bubbles, seed: s.seed,
    });
    body.querySelector('#zoom-cover-place').addEventListener('click', () => {
      const angleDeg = Number(body.querySelector('#zoom-cover-angle').value);
      store.dispatch('PLACE_COVERSLIP', { slide: slideId, angleDeg });
    });
  }

  /* ---------------------------------------------------------------- */
  /* 현미경 관찰 모드                                                   */
  /* ---------------------------------------------------------------- */

  function renderScopeMode() {
    const st = store.getState();
    if (!slideId) {
      body.innerHTML = `<h2>${UI.zoom.scopeMode}</h2><p class="zoom-empty">${UI.zoom.emptyStage}</p>`;
      return;
    }
    const p = fieldParams(st, slideId);
    // T07 1단계 — 배율 선택 UI 를 내주지 않는다(고정 400배). 대신 색만으로 용액을 구분하지
    // 않도록 어느 슬라이드·용액인지 글자로 밝혀 둔다(청람/선홍 색맹 대응).
    const objectivePicker = st.session.level === 1 ? '' : `
        <div class="ctrl-group" role="group" aria-label="${UI.controls.objective}">
          <span>${UI.controls.objective}</span>
          <button type="button" data-obj="4">${UI.units.mag(40)}</button>
          <button type="button" data-obj="10">${UI.units.mag(100)}</button>
          <button type="button" data-obj="40">${UI.units.mag(400)}</button>
        </div>`;
    body.innerHTML = `
      <h2>${UI.zoom.scopeMode}</h2>
      <p class="zoom-slide-label">${UI.slides[slideId]} · ${UI.reagents[p.reagent ?? 'NONE']}</p>
      <div class="zoom-fov" id="fov-slot" tabindex="0"></div>
      <div class="zoom-gauge" id="quality">
        <div class="bar"><div class="fill" id="zoom-gauge-fill"></div></div>
        <div class="cap"><span>${UI.observability.label}</span><b id="quality-score"></b></div>
        <div class="hint" id="zoom-gauge-hint"></div>
      </div>
      <div class="zoom-scope-controls">
        ${objectivePicker}
        <div class="ctrl-group">
          <span>${UI.zoom.coarseGroup}</span>
          <button type="button" id="coarse-out">${UI.zoom.coarseFocusOut}</button>
          <button type="button" id="coarse-in">${UI.zoom.coarseFocusIn}</button>
        </div>
        <div class="ctrl-group">
          <label for="zoom-fine-focus">${UI.controls.focus}</label>
          <input type="range" id="zoom-fine-focus" min="-0.2" max="0.2" step="0.002" value="${st.microscope.fine}">
        </div>
        <div class="ctrl-group">
          <label for="zoom-diaphragm">${UI.controls.diaphragm}</label>
          <input type="range" id="zoom-diaphragm" min="0" max="1" step="0.02" value="${st.microscope.diaphragm}">
        </div>
        <button type="button" id="capture">${UI.zoom.capture}</button>
      </div>`;

    const fovWrap = body.querySelector('#fov-slot');
    fovWrap.innerHTML = renderFOV(p);
    updateGauge();
    bindPan(fovWrap);

    body.querySelectorAll('[data-obj]').forEach((b) => {
      b.addEventListener('click', () => store.dispatch('SET_OBJECTIVE', { objective: Number(b.dataset.obj) }));
    });
    body.querySelector('#coarse-in').addEventListener('click', () => store.dispatch('COARSE_FOCUS', { delta: 0.08 }));
    body.querySelector('#coarse-out').addEventListener('click', () => store.dispatch('COARSE_FOCUS', { delta: -0.08 }));
    body.querySelector('#capture').addEventListener('click', () => store.dispatch('CAPTURE', {}));

    const fineInput = body.querySelector('#zoom-fine-focus');
    let lastFine = st.microscope.fine;
    fineInput.addEventListener('pointerdown', () => { busy = true; });
    fineInput.addEventListener('input', () => {
      const val = Number(fineInput.value);
      store.dispatch('FINE_FOCUS', { delta: val - lastFine }, { skipNotify: true });
      lastFine = val;
      updateBlur();
      updateGauge();
    });
    fineInput.addEventListener('change', () => { busy = false; });

    const diaInput = body.querySelector('#zoom-diaphragm');
    let lastDia = st.microscope.diaphragm;
    diaInput.addEventListener('pointerdown', () => { busy = true; });
    diaInput.addEventListener('input', () => {
      const val = Number(diaInput.value);
      store.dispatch('SET_DIAPHRAGM', { value: val }, { skipNotify: true });
      lastDia = val;
      updateDark();
      updateGauge();
    });
    diaInput.addEventListener('change', () => { busy = false; });
  }

  /** #fov-scene 의 transform 만 갱신한다 — renderFOV 를 다시 부르지 않는다. */
  function updateSceneTransform() {
    const m = store.getState().microscope;
    const scene = body.querySelector('#fov-scene');
    if (scene) scene.setAttribute('transform', `translate(${(-m.panX).toFixed(1)},${(-m.panY).toFixed(1)})`);
  }

  /** #fov-blur 의 stdDeviation 만 갱신한다. */
  function updateBlur() {
    const st = store.getState();
    if (!slideId) return;
    const m = st.microscope;
    const blurEl = body.querySelector('#fov-blur feGaussianBlur');
    if (!blurEl) return;
    const blur = focusError(m) * 22 + (isFloating(st.slides[slideId]) ? 2.4 : 0);
    blurEl.setAttribute('stdDeviation', blur.toFixed(2));
  }

  /** #fov-dark 의 opacity 만 갱신한다. */
  function updateDark() {
    const m = store.getState().microscope;
    const darkEl = body.querySelector('#fov-dark');
    if (!darkEl) return;
    const dark = 1 - clamp(brightness(m), 0, 1);
    darkEl.setAttribute('opacity', (dark * 0.55).toFixed(2));
  }

  function updateGauge() {
    if (!slideId) return;
    const p = fieldParams(store.getState(), slideId);
    const q = observability(p);
    const fill = body.querySelector('#zoom-gauge-fill');
    const value = body.querySelector('#quality-score');
    const hint = body.querySelector('#zoom-gauge-hint');
    if (!fill) return;
    fill.style.width = `${q.score}%`;
    value.textContent = q.score;
    // worst 이름 자체는 #quality-worst 로 태그해 둔다 — 기존 hint() 문장을 그대로 재사용한다.
    hint.innerHTML = UI.observability.hint(`<b id="quality-worst">${UI.observability.worst[q.worst]}</b>`);
  }

  /** 재물대 이동. 드래그 중에는 transform 만 갱신하고, 놓았을 때 한 번 전체를 동기화한다. */
  function bindPan(container) {
    container.addEventListener('pointerdown', (e) => {
      container.setPointerCapture(e.pointerId);
      panDrag = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      busy = true;
    });
    container.addEventListener('pointermove', (e) => {
      if (!panDrag || e.pointerId !== panDrag.pointerId) return;
      const dx = e.clientX - panDrag.lastX, dy = e.clientY - panDrag.lastY;
      panDrag.lastX = e.clientX; panDrag.lastY = e.clientY;
      // 상은 재물대와 반대로 움직인다 — 손가락을 따라 그림이 움직이려면 부호를 뒤집는다.
      store.dispatch('MOVE_STAGE', { dx: -dx, dy: -dy }, { skipNotify: true });
      updateSceneTransform();
    });
    // 드래그가 끝나도 renderFOV 를 다시 부르지 않는다 — transform 은 이미 최신 상태다.
    const end = (e) => {
      if (!panDrag || e.pointerId !== panDrag.pointerId) return;
      container.releasePointerCapture(e.pointerId);
      panDrag = null;
      busy = false;
    };
    container.addEventListener('pointerup', end);
    container.addEventListener('pointercancel', end);
    container.addEventListener('keydown', (e) => {
      const step = PAN_LIMIT / 12;
      if (e.key === 'ArrowLeft') store.dispatch('MOVE_STAGE', { dx: -step });
      else if (e.key === 'ArrowRight') store.dispatch('MOVE_STAGE', { dx: step });
      else if (e.key === 'ArrowUp') store.dispatch('MOVE_STAGE', { dy: -step });
      else if (e.key === 'ArrowDown') store.dispatch('MOVE_STAGE', { dy: step });
      else return;
      e.preventDefault();
    });
  }

  store.subscribe(() => { if (!root.hidden && !busy) renderBody(); });

  return { open, close };
}
