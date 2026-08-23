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
import { fieldParams, focusError, brightness, isFloating, PAN_LIMIT, SLIDE_IDS } from '../sim/state.js';
import { UI } from './strings.js';
import { ASSETS } from '../assets/index.js';
import * as slideModule from '../assets/slide.js';
import { REAGENT_TINT } from '../assets/slide.js';

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
  /** 결과를 기록한 직후 화면에 남길 확인 문구. 열 때마다 지운다. */
  let captureNotice = null;
  /** 실험대에서 들고 온 도구. 이것만 확대 뷰에 나온다. */
  let zoomTool = null;
  /**
   * 손에 쥔 도구의 자리와 기울기.
   *
   * 화면을 다시 그릴 때마다 도구가 처음 자리로 튕겨 돌아가면, 한 방울 떨어뜨릴 때마다
   * 다시 끌고 와야 한다 — 쥐고 있다는 느낌이 사라진다. 손은 그대로 있어야 한다.
   */
  let toolPos = { x: 0, y: 0 };
  let coverDeg = 45;
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

  /**
   * @param {string} openMode 'slide' | 'scope'
   * @param {string|null} openSlideId
   * @param {HTMLElement} openerEl
   * @param {'forceps'|'dropper'|null} tool 실험대에서 **들고 온** 도구.
   *   들고 온 것만 화면에 나온다 — 바나나만 문질렀는데 핀셋과 스포이트가 함께 떠 있으면
   *   내가 무엇을 하고 있는지 알 수 없다.
   */
  function open(openMode, openSlideId, openerEl, tool = null) {
    mode = openMode;
    slideId = openSlideId;
    zoomTool = tool;
    captureNotice = null;
    toolPos = { x: 0, y: 0 };
    coverDeg = COVER_START_DEG;
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
        ${zoomTool === 'forceps' && canCover(s) ? `
          <button type="button" class="cover-tool" id="cover-tool"
            aria-label="${UI.zoom.coverToolLabel}"></button>` : ''}
        ${zoomTool === 'dropper' ? `
          <button type="button" class="dropper-tool" id="dropper-tool"
            aria-label="${UI.zoom.dropperLabel}"></button>` : ''}
        <div class="zoom-slide-stage" id="slide-stage"></div>
      </div>
      <p class="cover-hint" id="cover-hint">${toolHintText(s)}</p>
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

    // 받침 유리 그림을 **먼저** 넣는다. 도구는 자기가 유리 위에 있는지를 크기로 재는데,
    // 그림이 없는 동안에는 그 칸의 높이가 0 이라 언제나 "유리 밖" 이 된다.
    body.querySelector('#slide-stage').innerHTML = slideModule.render({
      sample: s.sample, stain: s.stain, reaction: s.reactionT,
      coverslip: s.coverslip.placed, bubbles: s.coverslip.bubbles, seed: s.seed,
    });

    body.querySelector('#cover-lift')?.addEventListener('click', () => {
      store.dispatch('LIFT_COVERSLIP', { slide: slideId });
    });

    const dropper = body.querySelector('#dropper-tool');
    if (dropper) bindDropperTool(dropper);

    const tool = body.querySelector('#cover-tool');
    if (tool) bindCoverTool(tool);
  }

  /**
   * 지금 덮을 수 있는가. 이미 덮여 있거나, 핀셋에 **쓴** 덮개 유리가 물려 있으면 아니다 —
   * 쓴 것을 든 채로 덮개 유리를 내밀면 될 것처럼 보이는데 실제로는 안 되고,
   * 안내 문구도 각도 표시에 덮여 사라진다.
   */
  function canCover(s) {
    return !s.coverslip.placed && store.getState().tools.forceps.holding !== 'usedCoverslip';
  }

  /** 지금 손에 든 도구가 무엇이냐에 따라 다른 말을 한다. 도구를 안 들고 열었으면 아무 말도 안 한다. */
  function toolHintText(s) {
    if (zoomTool === 'dropper') {
      const d = store.getState().tools.dropper;
      return d.holds ? UI.zoom.dropperHint(UI.reagents[d.holds]) : UI.zoom.dropperEmpty;
    }
    if (zoomTool !== 'forceps') return UI.zoom.noToolHint;
    if (s.coverslip.placed) return UI.zoom.coverPlaced;
    if (store.getState().tools.forceps.holding === 'usedCoverslip') return UI.zoom.coverUsed;
    return UI.zoom.coverDragHint;
  }

  /**
   * 스포이트를 손에 쥔다. 받침 유리 위로 옮기고 **고무를 누를 때마다 한 방울**.
   *
   * 버튼 하나로 떨어뜨리게 두면 스포이트가 어디에 있든 상관이 없어져, 조작이 아니라
   * 계산기 두드리기가 된다. 핀셋과 같은 방식으로 쥐고 옮긴다.
   */
  function bindDropperTool(el) {
    // 붙잡아 두지 않고 쓸 때마다 찾는다 — 위 el$ 주석 참조.
    const hint = () => el$('#cover-hint');
    const stage = () => el$('#slide-stage');
    let drag = null;

    function paint() {
      const d = store.getState().tools.dropper;
      el.innerHTML = dropperSvg(d);
      const over = overlaps(el, stage());
      el.dataset.over = String(over);
      const h = hint();
      if (!h) return;
      if (!d.holds) h.textContent = UI.zoom.dropperEmpty;
      else h.textContent = over ? UI.zoom.dropperOver : UI.zoom.dropperHint(UI.reagents[d.holds]);
      h.dataset.good = String(over && Boolean(d.holds));
    }

    // 다시 그려져도 손은 있던 자리에 있다.
    el.style.transform = `translate(${toolPos.x}px, ${toolPos.y}px)`;

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId, x0: e.clientX, y0: e.clientY,
        tx: toolPos.x, ty: toolPos.y, moved: false,
        onBulb: Boolean(e.target.closest?.('[data-bulb]')) || e.offsetY < el.clientHeight * 0.34,
      };
      busy = true;
      el.classList.add('cover-tool--dragging');
    });

    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      toolPos = { x: drag.tx + dx, y: drag.ty + dy };
      el.style.transform = `translate(${toolPos.x}px, ${toolPos.y}px)`;
      paint();
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove('cover-tool--dragging');
      const squeeze = !drag.moved && drag.onBulb;
      drag = null;
      busy = false;
      // 고무를 눌렀고, 스포이트 끝이 받침 유리 위에 있으면 한 방울.
      if (squeeze && overlaps(el, stage())) store.dispatch('DROP', { slide: slideId, count: 1 });
      else paint();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      store.dispatch('DROP', { slide: slideId, count: 1 });
    });

    paint();
    // 방금 넣은 받침 유리 그림은 아직 제 높이를 갖기 전이라, 여기서 바로 재면
    // 스포이트가 유리 위에 있는데도 "옮기세요" 라고 말한다. 한 프레임 뒤에 다시 잰다.
    requestAnimationFrame(() => { if (el.isConnected) paint(); });
  }

  function dropperSvg(dropper) {
    const level = Math.max(0, Math.min(1, dropper.level ?? 0));
    const fill = dropper.holds === 'IKI' ? REAGENT_TINT.IKI : REAGENT_TINT.SUDAN3;
    const h = (34 * level).toFixed(1);
    const M = slideModule.TOOL_METAL;
    return `<svg viewBox="0 0 44 140" class="dropper-svg" aria-hidden="true">
      <rect data-bulb="1" x="11" y="6" width="22" height="34" rx="11"
        fill="${slideModule.RUBBER}" stroke="${M}" stroke-width="3"/>
      <rect x="15" y="40" width="14" height="64" rx="3"
        fill="${slideModule.COVERSLIP_FILL}" fill-opacity="0.35" stroke="${M}" stroke-width="3"/>
      <rect x="18" y="${(102 - Number(h) * 1.7).toFixed(1)}" width="8" height="${(Number(h) * 1.7).toFixed(1)}" fill="${fill}"/>
      <path d="M 15,104 L 22,132 L 29,104 Z"
        fill="none" stroke="${M}" stroke-width="3" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ---------------------------------------------------------------- */
  /* 핀셋에 물린 덮개 유리                                              */
  /* ---------------------------------------------------------------- */

  /** 처음 잡았을 때의 기울기. 여기서 좌우로 움직여 조절한다. */
  const COVER_START_DEG = 45;
  /** 좌우로 이만큼 움직이면 기울기가 90° 만큼 바뀐다. */
  const COVER_DEG_PER_PX = 90 / 240;

  /**
   * 핀셋이 덮개 유리 한쪽 끝을 집고 있다.
   *
   * 좌우로 움직이면 핀셋이 기울고, 물린 덮개 유리가 그 각도로 따라 기운다 —
   * 화장지 한 장을 손끝으로 집고 흔드는 것과 같다. 아래로 내려 받침 유리에 닿으면 그 각도로 덮인다.
   *
   * 끌어온 방향으로 각도를 정하던 앞 판은 각도를 바꾸려면 위치도 함께 바뀌어서,
   * 무엇이 각도를 정하는지 화면에서 읽히지 않았다. 여기서는 좌우가 각도, 위아래가 높이다.
   */
  function coverToolSvg(deg) {
    // 집는 지점(핀셋 끝)을 회전 중심으로 둔다. 손끝은 그대로 있고 종이만 나풀거린다.
    const px = 30, py = 26;
    return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="rotate(${-deg} ${px} ${py})">
        <rect x="${px}" y="${py - 3}" width="96" height="60" rx="2"
          fill="${slideModule.COVERSLIP_FILL}" fill-opacity="0.9"
          stroke="${slideModule.COVERSLIP_INK}" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round"/>
      </g>
      <path d="M ${px - 30},${py - 44} L ${px},${py - 2}" stroke="${slideModule.TOOL_METAL}"
        stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M ${px - 2},${py - 48} L ${px},${py + 2}" stroke="${slideModule.TOOL_METAL_SHADE}"
        stroke-width="6" stroke-linecap="round" fill="none"/>
    </svg>`;
  }

  /**
   * 화면 안 요소는 **쓸 때마다 다시 찾는다.**
   *
   * 확대 뷰는 상태가 바뀔 때마다 통째로 다시 그려진다 — 색이 변하는 동안에는 1초마다.
   * 붙잡아 둔 참조는 그때 DOM 에서 떨어져 나가는데, 떨어져 나간 요소의 사각형은 전부 0 이라
   * "받침 유리와 겹치지 않는다" 는 답이 나온다. 스포이트가 유리 한가운데 있는데도
   * 계속 "받침 유리 위로 옮기세요" 라고 말하던 원인이 이것이었다.
   */
  const el$ = (sel) => body.querySelector(sel);

  function bindCoverTool(tool) {
    const hint = () => el$('#cover-hint');
    const stage = () => el$('#slide-stage');
    let drag = null;
    // 다시 그려져도 기울기와 자리를 그대로 이어받는다.
    tool.style.transform = `translate(${toolPos.x}px, ${toolPos.y}px)`;

    function paint() {
      tool.innerHTML = coverToolSvg(coverDeg);
      const deg = coverDeg;
      const bubbles = bubblesFromAngle(deg);
      const h = hint();
      if (!h) return;
      h.textContent =
        `${UI.zoom.coverAngle} ${UI.zoom.coverAngleDeg(deg)} · ` +
        (bubbles === 0 ? UI.zoom.coverAngleGood : UI.zoom.coverAngleBad);
      h.dataset.good = String(bubbles === 0);
    }

    function place() {
      // 핀셋으로 미리 집어 오지 않았어도 여기서는 집는 동작까지 함께 한 것으로 본다.
      // 확대 뷰는 그 손놀림을 가까이서 보는 화면이지, 다른 규칙이 도는 곳이 아니다.
      if (store.getState().tools.forceps.holding !== 'coverslip') {
        store.dispatch('PICK_COVERSLIP', {});
      }
      store.dispatch('PLACE_COVERSLIP', { slide: slideId, angleDeg: coverDeg });
    }

    tool.addEventListener('pointerdown', (e) => {
      tool.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, deg0: coverDeg, tx: toolPos.x, ty: toolPos.y, moved: false };
      busy = true;
      tool.classList.add('cover-tool--dragging');
    });

    tool.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      coverDeg = clamp(Math.round(drag.deg0 + dx * COVER_DEG_PER_PX), 0, 90);
      toolPos = { x: drag.tx + dx, y: drag.ty + dy };
      tool.style.transform = `translate(${toolPos.x}px, ${toolPos.y}px)`;
      paint();
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      tool.releasePointerCapture(e.pointerId);
      tool.classList.remove('cover-tool--dragging');
      const moved = drag.moved;
      const touched = overlaps(tool, stage());
      drag = null;
      busy = false;
      if (!moved || !touched) {
        // 받침 유리에 닿지 않았다. 손만 움직였을 뿐 아무 일도 일어나지 않는다.
        return;
      }
      place();
    };
    tool.addEventListener('pointerup', end);
    tool.addEventListener('pointercancel', end);

    // 키보드 — 좌우로 각도, Enter 로 덮기. 끌기만 되면 마우스 없이는 못 덮는다.
    tool.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        coverDeg = clamp(coverDeg + (e.key === 'ArrowRight' ? 5 : -5), 0, 90);
        paint();
      } else if (e.key === 'Enter' || e.key === ' ') {
        place();
      } else return;
      e.preventDefault();
    });

    paint();
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
    // 재물대에 무엇이 올라가 있는지는 **지금** 상태에서 읽는다.
    //
    // 열 때 붙잡은 번호를 계속 쓰면, 보는 도중에 슬라이드가 내려가도(고배율에서 조동나사를
    // 돌려 금이 가면 그렇게 된다) 화면은 옛 시야를 그대로 그린다. 멀쩡해 보이는 화면에서
    // 결과 기록을 누르면 "재물대에 슬라이드가 없습니다" 가 뜬다 — 화면이 거짓말을 하고 있었다.
    slideId = st.microscope.stage;
    if (!slideId) {
      const cracked = SLIDE_IDS.filter((id) => st.slides[id].cracked);
      body.innerHTML = `
        <h2>${UI.zoom.scopeMode}</h2>
        <p class="zoom-empty">${UI.zoom.emptyStage}</p>
        ${cracked.length
          ? `<p class="zoom-empty" data-why="cracked">${
              UI.zoom.crackedNote(cracked.map((id) => UI.slideShort[id]).join(' '))
            }</p>`
          : ''}`;
      return;
    }
    const p = fieldParams(st, slideId);
    // 배율은 어느 단계에서나 학생이 고른다.
    //
    // 1단계에서 올리자마자 400배로 맞춰 주던 것을 걷어냈다. 그러면 `SET_OBJECTIVE` 가
    // "저배율에서 초점을 맞추지 않고 올렸습니다" 라고 경고하는데, 정작 학생은 아무것도
    // 하지 않았고 초점은 이미 맞아 있는 것처럼 보인다 — 화면과 문구가 서로 다른 말을 했다.
    // 저배율부터 올라가는 것이 이 실험에서 배우는 절차이므로 그 손을 뺏지 않는다.
    const objectivePicker = `
        <div class="ctrl-group" role="group" aria-label="${UI.controls.objective}">
          <span>${UI.controls.objective}</span>
          ${[4, 10, 40].map((o) => `<button type="button" data-obj="${o}"
            aria-pressed="${st.microscope.objective === o}">${UI.units.mag(o * 10)}</button>`).join('')}
        </div>`;
    body.innerHTML = `
      <h2>${UI.zoom.scopeMode}</h2>
      <p class="zoom-slide-label">${UI.slideShort[slideId]} · ${UI.reagents[p.reagent ?? 'NONE']}</p>
      <div class="scope-stage">
        <div class="scope-figure" id="scope-figure" aria-hidden="true"></div>
        <div class="zoom-fov" id="fov-slot" tabindex="0"></div>
      </div>
      <div class="zoom-gauge" id="quality">
        <div class="bar"><div class="fill" id="zoom-gauge-fill"></div></div>
        <div class="cap"><span>${UI.observability.label}</span><b id="quality-score"></b></div>
        <div class="hint" id="zoom-gauge-hint"></div>
      </div>
      <div class="zoom-scope-controls">
        ${objectivePicker}
        <div class="dial-row">
          ${dialHtml('coarse', UI.zoom.coarseGroup, st.microscope.coarse)}
          ${dialHtml('fine', UI.controls.focus, st.microscope.fine)}
        </div>
        <div class="ctrl-group">
          <label for="zoom-diaphragm">${UI.controls.diaphragm}</label>
          <input type="range" id="zoom-diaphragm" min="0" max="1" step="0.02" value="${st.microscope.diaphragm}">
        </div>
        <button type="button" class="zoom-action" id="capture">${UI.zoom.capture}</button>
        <button type="button" id="scope-unmount">${UI.bench.unmount(UI.slideShort[slideId])}</button>
      </div>
      ${captureNotice ? `<p class="capture-note" id="capture-note">${captureNotice}</p>` : ''}`;

    const fovWrap = body.querySelector('#fov-slot');
    fovWrap.innerHTML = renderFOV(p);
    paintScopeFigure();
    updateGauge();
    bindPan(fovWrap);

    body.querySelectorAll('[data-obj]').forEach((b) => {
      b.addEventListener('click', () => store.dispatch('SET_OBJECTIVE', { objective: Number(b.dataset.obj) }));
    });
    body.querySelector('#scope-unmount').addEventListener('click', () => store.dispatch('UNMOUNT', {}));
    bindDial('coarse', 'COARSE_FOCUS', 0.5);
    bindDial('fine', 'FINE_FOCUS', 0.16);
    // 기록이 됐다는 말은 규칙이 아니라 화면이 한다.
    // reduce() 쪽에서 말하게 하면 성공한 조작에 결과 태그가 붙어, 정상 경로가
    // "태그 하나 없이 끝난다" 는 계약이 깨진다 (tests/rules.test.js).
    body.querySelector('#capture').addEventListener('click', () => {
      const before = store.getState().session.captures.length;
      const r = store.dispatch('CAPTURE', {});
      const after = r.state.session.captures.length;
      // dispatch 가 이미 화면을 다시 그렸다. 남길 말은 상태로 들고 있다가 다시 그린다.
      captureNotice = after > before ? UI.zoom.captureSaved(after) : null;
      renderBody();
    });

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

  /* ---------------------------------------------------------------- */
  /* 나사 다이얼 · 현미경 그림                                          */
  /* ---------------------------------------------------------------- */

  function dialHtml(name, label, value) {
    return `
      <div class="dial-cell">
        <div class="dial" id="dial-${name}" role="slider" tabindex="0"
          aria-label="${label}" aria-valuenow="${value.toFixed(3)}">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="27"
              fill="${slideModule.TOOL_METAL}" stroke="${slideModule.TOOL_METAL_SHADE}" stroke-width="3"/>
            <g class="dial-mark">
              <!-- 손잡이 홈. 돌리는 물건이라는 것이 눈에 보여야 돌려 볼 생각을 한다. -->
              ${Array.from({ length: 12 }, (_, i) => {
                const a = (i * 30 * Math.PI) / 180;
                const x1 = 32 + 21 * Math.sin(a), y1 = 32 - 21 * Math.cos(a);
                const x2 = 32 + 26 * Math.sin(a), y2 = 32 - 26 * Math.cos(a);
                return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                  stroke="${slideModule.TOOL_METAL_SHADE}" stroke-width="2" stroke-linecap="round"/>`;
              }).join('')}
              <line x1="32" y1="32" x2="32" y2="10"
                stroke="${slideModule.TOOL_METAL_SHADE}" stroke-width="4" stroke-linecap="round"/>
            </g>
          </svg>
        </div>
        <span class="dial-label">${label}</span>
      </div>`;
  }

  /**
   * 나사를 돌린다. 다이얼 한가운데를 축으로 삼아, 포인터가 돈 각도만큼 값을 바꾼다.
   *
   * 슬라이더나 ▲▼ 버튼이 아니라 **돌리는 것**이어야 하는 이유는 실물이 그렇기 때문이다.
   * 한 바퀴가 `perTurn` 만큼 움직인다 — 조동나사는 크게, 미동나사는 잘게.
   */
  function bindDial(name, action, perTurn) {
    const el = body.querySelector(`#dial-${name}`);
    if (!el) return;
    const mark = el.querySelector('.dial-mark');
    let drag = null;
    let spin = 0;   // 화면에서 돌아간 각도. 값이 한계에 걸려도 손은 계속 돌 수 있다.

    const angleAt = (e) => {
      const r = el.getBoundingClientRect();
      return (Math.atan2(e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
    };

    /** 값이 바뀌면 시야를 다시 그리지 않고 필요한 속성만 손본다 (fov.js 머리말 참조). */
    function apply(delta) {
      const r = store.dispatch(action, { delta }, { skipNotify: true });
      // 고배율에서 조동나사를 돌리면 슬라이드에 금이 가고 재물대에서 내려간다.
      // 이건 속성 몇 개로 될 일이 아니다 — 손을 놓고 화면을 새로 그린다.
      if (r.tag === 'cracked') {
        drag = null;
        busy = false;
        renderBody();
        return false;
      }
      updateBlur();
      updateGauge();
      paintScopeFigure();
      return true;
    }

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, last: angleAt(e) };
      busy = true;
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const now = angleAt(e);
      let step = now - drag.last;
      if (step > 180) step -= 360;
      if (step < -180) step += 360;
      drag.last = now;
      spin += step;
      mark.setAttribute('transform', `rotate(${spin.toFixed(1)} 32 32)`);
      if (!apply((step / 360) * perTurn)) return;
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      el.releasePointerCapture(e.pointerId);
      drag = null;
      busy = false;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    // 키보드 — 다이얼을 마우스로만 돌릴 수 있으면 초점을 맞출 길이 하나뿐이다.
    el.addEventListener('keydown', (e) => {
      const dir = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? 1
        : (e.key === 'ArrowDown' || e.key === 'ArrowLeft') ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      spin += dir * 15;
      mark.setAttribute('transform', `rotate(${spin.toFixed(1)} 32 32)`);
      apply((dir * 15 / 360) * perTurn);
    });
  }

  /**
   * 확대 뷰 안의 현미경 그림. 나사를 돌리면 **재물대가 위아래로 움직인다.**
   *
   * 초점이 왜 맞고 안 맞는지는 시야만 봐서는 알 수 없다 — 재물대와 대물렌즈 사이가
   * 얼마나 떨어졌는지가 원인이기 때문이다. 그림이 그 원인을 보여 준다.
   */
  function paintScopeFigure() {
    const fig = body.querySelector('#scope-figure');
    if (!fig) return;
    const m = store.getState().microscope;
    // 초점이 맞은 자리를 0 으로 두고, 어긋난 만큼 재물대를 내린다 (애셋 viewBox 단위).
    const stageY = clamp((m.coarse + m.fine) * 26, -18, 18);
    const svg = fig.querySelector('svg');
    if (!svg) {
      fig.innerHTML = ASSETS.microscope.render({
        objective: m.objective, coarse: m.coarse, fine: m.fine,
        diaphragm: m.diaphragm, lamp: m.lamp, stage: m.stage, stageY,
      });
      return;
    }
    // 이미 그려져 있으면 계약된 노드만 손본다 (docs/02).
    ASSETS.microscope.applyState(svg, {
      objective: m.objective, coarse: m.coarse, fine: m.fine,
      diaphragm: m.diaphragm, lamp: m.lamp, stage: m.stage, stageY,
    });
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
