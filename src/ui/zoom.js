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
import { bubblesFromAngle } from '../sim/rules.js';
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
    // 제목에 "(나) 아이오딘–아이오딘화 칼륨" 을 그대로 쓰면 화면이 무엇을 떨어뜨릴지
    // 미리 알려 주는 꼴이 된다. 어느 유리인지만 밝히고, 무엇을 할지는 탐구 노트가 안내한다.
    body.innerHTML = `
      <h2>${UI.zoom.slideMode(UI.slideShort[slideId])}</h2>
      <div class="zoom-slide-workspace">
        ${s.coverslip.placed ? '' : `
          <button type="button" class="cover-chip" id="cover-chip"
            aria-label="${UI.zoom.coverDragLabel}"></button>`}
        <div class="zoom-slide-stage" id="slide-stage"></div>
      </div>
      <p class="cover-hint" id="cover-hint">${
        s.coverslip.placed ? UI.zoom.coverPlaced : UI.zoom.coverDragHint
      }</p>
      <dl class="zoom-readout">
        <div><dt>${UI.controls.reagent}</dt><dd>${UI.reagents[s.stain ?? 'NONE']}</dd></div>
        <div><dt>${UI.controls.drops}</dt><dd>${UI.units.drops(s.drops)}</dd></div>
        <div><dt>${UI.zoom.coverDragLabel}</dt><dd>${
          s.coverslip.placed ? `놓임 (기포 ${s.coverslip.bubbles}개)` : '없음'
        }</dd></div>
      </dl>
      ${s.coverslip.placed
        ? `<button type="button" class="zoom-action" id="cover-lift">${UI.zoom.liftCoverslip}</button>`
        : ''}`;

    body.querySelector('#slide-stage').innerHTML = slideModule.render({
      sample: s.sample, stain: s.stain, reaction: s.reactionT,
      coverslip: s.coverslip.placed, bubbles: s.coverslip.bubbles, seed: s.seed,
    });

    body.querySelector('#cover-lift')?.addEventListener('click', () => {
      store.dispatch('LIFT_COVERSLIP', { slide: slideId });
    });

    const chip = body.querySelector('#cover-chip');
    if (chip) {
      chip.innerHTML = coverChipSvg();
      bindCoverDrag(chip);
    }
  }

  /** 끌고 다니는 덮개 유리 조각. 받침 유리 애셋의 덮개 유리와 같은 모양을 쓴다. */
  function coverChipSvg() {
    // 받침 유리 위에 놓인 덮개 유리는 밝은 유리에 겹쳐서 옅어도 보이지만(fill-opacity 0.3),
    // 손에 들려 허공에 있는 동안에는 배경에 묻힌다 — 다크 모드에서 특히.
    // 들고 있을 때만 진하게 그린다. 같은 물건이지만 뒤에 무엇이 있느냐가 다르다.
    return `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="10" y="10" width="60" height="60" rx="2"
        fill="${slideModule.COVERSLIP_FILL}" fill-opacity="0.9"
        stroke="${slideModule.COVERSLIP_INK}" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * 덮개 유리를 끌어 내려 덮는다.
   *
   * 끌어온 **전체 방향**이 곧 놓는 각도다 — 옆으로 끌면 0°(눕혀 놓기), 곧장 내리면 90°,
   * 비스듬히 내리면 45° 근처. 기포는 이 각도에서 나온다 (`bubblesFromAngle`).
   * 마지막 한 프레임의 방향이 아니라 시작점부터의 방향을 쓴다 — 손이 떨려도 값이 튀지 않는다.
   */
  function bindCoverDrag(chip) {
    let drag = null;
    const hint = body.querySelector('#cover-hint');
    const stage = body.querySelector('#slide-stage');

    const angleOf = (dx, dy) => Math.round(
      (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI
    );

    chip.addEventListener('pointerdown', (e) => {
      chip.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      busy = true;
      chip.classList.add('cover-chip--dragging');
    });

    chip.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      const deg = angleOf(dx, dy);
      drag.deg = deg;
      chip.style.transform = `translate(${dx}px, ${dy}px) rotate(${deg}deg)`;
      const bubbles = bubblesFromAngle(deg);
      hint.textContent =
        `${UI.zoom.coverAngle} ${UI.zoom.coverAngleDeg(deg)} · ` +
        (bubbles === 0 ? UI.zoom.coverAngleGood : UI.zoom.coverAngleBad);
      hint.dataset.good = String(bubbles === 0);
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      chip.releasePointerCapture(e.pointerId);
      chip.classList.remove('cover-chip--dragging');
      const deg = drag.deg;
      const over = overlaps(chip, stage);
      drag = null;
      busy = false;
      if (deg === undefined || !over) {
        // 받침 유리에 닿지 않았다. 아무 일도 일어나지 않고 제자리로 돌아간다.
        chip.style.transform = '';
        renderSlideMode();
        return;
      }
      // 핀셋으로 미리 집어 오지 않았어도 여기서는 집는 동작까지 함께 한 것으로 본다.
      // 확대 뷰는 그 손놀림을 가까이서 보는 화면이지, 다른 규칙이 도는 곳이 아니다.
      if (store.getState().tools.forceps.holding !== 'coverslip') {
        store.dispatch('PICK_COVERSLIP', {});
      }
      store.dispatch('PLACE_COVERSLIP', { slide: slideId, angleDeg: deg });
    };
    chip.addEventListener('pointerup', end);
    chip.addEventListener('pointercancel', end);
  }

  /** 두 요소가 화면에서 겹치는가. 덮개 유리는 받침 유리 어디에 닿아도 덮인 것으로 본다. */
  function overlaps(a, b) {
    const r = a.getBoundingClientRect();
    const q = b.getBoundingClientRect();
    return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
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
      <p class="zoom-slide-label">${UI.slideShort[slideId]} · ${UI.reagents[p.reagent ?? 'NONE']}</p>
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
        <button type="button" class="zoom-action" id="capture">${UI.zoom.capture}</button>
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
