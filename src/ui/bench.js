/**
 * 실험대 — 배치와 집기/놓기.
 *
 * 물건이 실험대 어디에 놓여 있는지(좌표)는 결과에 영향을 주지 않는 표현일 뿐이라
 * 이 파일 안에서만 관리한다 (src/sim/ 에는 넣지 않는다).
 * 결과를 바꾸는 조작은 전부 store.dispatch() 를 거쳐 reduce() 로 간다.
 *
 * 포인터 이벤트로만 드래그를 구현한다 (pointerdown/move/up + setPointerCapture).
 * 잘못된 조작을 막지 않는다 — 어디에 무엇을 놓았는지만 보고 맞는 액션을 골라 보낸다.
 * 나머지는 reduce() 가 결과로 답한다.
 */

import { ASSETS } from '../assets/index.js';
import { CONTRACT } from '../assets/contract.js';
import { UI } from './strings.js';

/**
 * 화면 배율 (px / mm). realSizeMm 을 화면 크기로 바꾸는 단 하나의 상수.
 * 현미경(340mm)·실험대(1500mm)는 다른 기구보다 훨씬 크므로, 작은 기구들이
 * 손에 잡을 만한 크기로 나오면서도 현미경이 화면을 압도하지 않는 값으로 잡았다.
 */
const SCALE = 0.55;

/** realSizeMm × 화면배율. 실험대 위 크기는 반드시 이 함수 하나만 거친다. */
export function pxFor(assetName) {
  return CONTRACT[assetName].realSizeMm * SCALE;
}

const DRAG_THRESHOLD_PX = 6;

/**
 * 손에 들고 쓰는 도구. 대상에 놓아 조작을 마치면 제자리(선반)로 돌아온다.
 * 그러지 않으면 대상 위에 그대로 남아, 나중에 그 대상(슬라이드 등)을 다시 누를 수 없게 가린다.
 */
const HAND_TOOLS = new Set(['banana', 'dropper', 'forceps']);

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function defaultItems() {
  return [
    { id: 'banana', asset: 'banana', kind: 'banana', label: UI.bench.items.banana, x: 24, y: 16 },
    { id: 'slideA', asset: 'slide', kind: 'slide', slide: 'A', label: UI.bench.items.slideA, x: 16, y: 300 },
    { id: 'slideB', asset: 'slide', kind: 'slide', slide: 'B', label: UI.bench.items.slideB, x: 16, y: 372 },
    { id: 'slideC', asset: 'slide', kind: 'slide', slide: 'C', label: UI.bench.items.slideC, x: 16, y: 444 },
    { id: 'coverslip1', asset: 'coverslip', kind: 'coverslip', label: UI.bench.items.coverslip, x: 210, y: 20 },
    { id: 'coverslip2', asset: 'coverslip', kind: 'coverslip', label: UI.bench.items.coverslip, x: 246, y: 20 },
    { id: 'coverslip3', asset: 'coverslip', kind: 'coverslip', label: UI.bench.items.coverslip, x: 282, y: 20 },
    { id: 'dropper', asset: 'dropper', kind: 'dropper', label: UI.bench.items.dropper, x: 340, y: 4 },
    { id: 'forceps', asset: 'forceps', kind: 'forceps', label: UI.bench.items.forceps, x: 400, y: 8 },
    { id: 'bottleIKI', asset: 'bottle', kind: 'bottle', reagent: 'IKI', label: UI.bench.items.bottleIKI, x: 460, y: 6 },
    { id: 'bottleSUDAN', asset: 'bottle', kind: 'bottle', reagent: 'SUDAN3', label: UI.bench.items.bottleSUDAN, x: 540, y: 6 },
    { id: 'dish', asset: 'dish', kind: 'dish', label: UI.bench.items.dish, x: 180, y: 300 },
    { id: 'microscope', asset: 'microscope', kind: 'microscope', label: UI.bench.items.microscope, x: 340, y: 260 },
    { id: 'waste', asset: 'waste', kind: 'waste', label: UI.bench.items.waste, x: 540, y: 280 },
    { id: 'tissue', asset: 'tissue', kind: 'tissue', label: UI.bench.items.tissue, x: 610, y: 300 },
  ];
}

/**
 * @param {HTMLElement} root
 * @param {{getState:Function, dispatch:Function, subscribe:Function}} store
 * @param {{onOpenZoom:(mode:string, slideId:string|null, opener:HTMLElement)=>void}} handlers
 */
export function createBench(root, store, { onOpenZoom }) {
  root.classList.add('bench');
  root.innerHTML = `<div class="bench-bg" aria-hidden="true"></div><div class="bench-tokens"></div>`;
  root.querySelector('.bench-bg').innerHTML = ASSETS.bench.render({});
  const layer = root.querySelector('.bench-tokens');

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let pickedCoverslipId = null;
  let drag = null;

  function findItem(id) {
    return items.find((it) => it.id === id);
  }

  function slideRenderState(slideId) {
    const s = store.getState().slides[slideId];
    return {
      sample: s.sample,
      stain: s.stain,
      reaction: s.reactionT,
      coverslip: s.coverslip.placed,
      bubbles: s.coverslip.bubbles,
      seed: s.seed,
    };
  }

  function assetState(item) {
    const st = store.getState();
    switch (item.kind) {
      case 'banana':
        return { ripe: st.tools.banana.ripe, peel: st.tools.banana.peeled ? 1 : 0, seed: st.session.seed };
      case 'slide':
        return slideRenderState(item.slide);
      case 'coverslip':
        return {};
      case 'dropper':
        return { holds: st.tools.dropper.holds, level: st.tools.dropper.level };
      case 'forceps':
        return { holding: st.tools.forceps.holding };
      case 'bottle':
        return { kind: item.reagent, level: 0.7 };
      case 'microscope':
        return {
          objective: st.microscope.objective, coarse: st.microscope.coarse, fine: st.microscope.fine,
          diaphragm: st.microscope.diaphragm, lamp: st.microscope.lamp, stage: st.microscope.stage,
        };
      case 'waste':
        return { level: 0.2 };
      default:
        return {};
    }
  }

  function isHidden(item) {
    const st = store.getState();
    if (item.kind === 'slide') return st.microscope.stage === item.slide;
    if (item.kind === 'coverslip') return Boolean(item.used) || item.id === pickedCoverslipId;
    return false;
  }

  /** 드래그 중인 요소의 중심점 아래 있는, 자기 자신이 아닌 첫 토큰. */
  function findDropTarget(item) {
    const el = layer.querySelector(`[data-id="${item.id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (const other of items) {
      if (other.id === item.id || isHidden(other)) continue;
      const oe = layer.querySelector(`[data-id="${other.id}"]`);
      if (!oe) continue;
      const or_ = oe.getBoundingClientRect();
      if (cx >= or_.left && cx <= or_.right && cy >= or_.top && cy <= or_.bottom) return other;
    }
    return null;
  }

  function applyDrop(item, target, dragInfo) {
    if (!target) return;
    const t = target.kind;
    if (item.kind === 'banana' && t === 'slide') {
      const thickness = clamp(dragInfo.heldMs / 2500, 0.12, 0.9);
      store.dispatch('SMEAR', { slide: target.slide, thickness });
    } else if (item.kind === 'dropper' && t === 'bottle') {
      store.dispatch('FILL_DROPPER', { reagent: target.reagent });
    } else if (item.kind === 'dropper' && t === 'slide') {
      store.dispatch('DROP', { slide: target.slide, count: 1 });
    } else if (item.kind === 'dropper' && t === 'waste') {
      store.dispatch('RINSE_DROPPER', {});
    } else if (item.kind === 'forceps' && t === 'coverslip') {
      const result = store.dispatch('PICK_COVERSLIP', {});
      if (result.state.tools.forceps.holding === 'coverslip') pickedCoverslipId = target.id;
    } else if (item.kind === 'forceps' && t === 'slide') {
      // 마지막 이동 방향으로 놓는 각도를 정한다. 대각선으로 내려놓을수록 45°에 가깝다.
      const angleDeg = clamp(
        (Math.atan2(Math.abs(dragInfo.lastDy), Math.abs(dragInfo.lastDx)) * 180) / Math.PI, 0, 90
      );
      const result = store.dispatch('PLACE_COVERSLIP', { slide: target.slide, angleDeg });
      if (result.state.tools.forceps.holding !== 'coverslip' && pickedCoverslipId) {
        const c = findItem(pickedCoverslipId);
        if (c) c.used = true;
        pickedCoverslipId = null;
      }
    } else if (item.kind === 'slide' && t === 'microscope') {
      store.dispatch('MOUNT', { slide: item.slide });
    }
  }

  function onPointerDown(e, item, el) {
    if (e.button !== undefined && e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    drag = {
      pointerId: e.pointerId, item, el,
      startClientX: e.clientX, startClientY: e.clientY,
      startX: item.x, startY: item.y,
      downAt: performance.now(),
      moved: false, lastDx: 0, lastDy: 0, prevTx: 0, prevTy: 0,
    };
    el.classList.add('token--dragging');
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const tx = e.clientX - drag.startClientX;
    const ty = e.clientY - drag.startClientY;
    drag.lastDx = tx - drag.prevTx;
    drag.lastDy = ty - drag.prevTy;
    drag.prevTx = tx; drag.prevTy = ty;
    if (Math.hypot(tx, ty) > DRAG_THRESHOLD_PX) drag.moved = true;
    drag.item.x = drag.startX + tx;
    drag.item.y = drag.startY + ty;
    drag.el.style.left = `${drag.item.x}px`;
    drag.el.style.top = `${drag.item.y}px`;
  }

  /** 탭(포인터로 움직임 없이 누르고 뗌) 또는 키보드 활성화(Enter/Space) 로 여는 동작. */
  function handleTap(item, el) {
    if (item.kind === 'slide') onOpenZoom('slide', item.slide, el);
    else if (item.kind === 'microscope') onOpenZoom('scope', store.getState().microscope.stage, el);
    else if (item.kind === 'banana') store.dispatch('PEEL_BANANA', {});
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { item, el, moved, downAt } = drag;
    el.releasePointerCapture(e.pointerId);
    el.classList.remove('token--dragging');
    const heldMs = performance.now() - downAt;

    if (!moved) {
      // 움직이지 않았다면 조작이 아니라 탭이다.
      handleTap(item, el);
      drag = null;
      renderTokens();
      return;
    }

    const target = findDropTarget(item);
    applyDrop(item, target, { heldMs, lastDx: drag.lastDx, lastDy: drag.lastDy });
    if (target && HAND_TOOLS.has(item.kind)) {
      item.x = item.homeX;
      item.y = item.homeY;
    }
    drag = null;
    renderTokens();
  }

  function renderTokens() {
    layer.innerHTML = '';
    for (const item of items) {
      if (isHidden(item)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `token token--${item.kind}`;
      el.dataset.id = item.id;
      if (item.kind === 'slide') el.dataset.slide = item.slide;
      else el.dataset.tool = item.asset;
      if (item.kind === 'slide') el.dataset.zoom = 'slide';
      else if (item.kind === 'microscope') el.dataset.zoom = 'scope';
      el.style.left = `${item.x}px`;
      el.style.top = `${item.y}px`;
      el.style.height = `${pxFor(item.asset)}px`;
      el.setAttribute('aria-label', item.label);
      el.innerHTML = ASSETS[item.asset].render(assetState(item));

      el.addEventListener('pointerdown', (e) => onPointerDown(e, item, el));
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);

      // 키보드 활성화(Enter/Space). 포인터 탭은 위 pointerup 경로가 이미 처리한다.
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        handleTap(item, el);
      });

      layer.appendChild(el);
    }
  }

  // 드래그 도중에는 다시 그리지 않는다. TICK 처럼 사용자와 무관하게 들어오는 상태 변경이
  // DOM 을 새로 만들면 setPointerCapture 가 무효화돼 드래그가 조용히 끊긴다.
  // 드래그가 끝나면 onPointerUp 이 최신 상태로 어차피 다시 그린다.
  store.subscribe(() => { if (!drag) renderTokens(); });
  renderTokens();
}
