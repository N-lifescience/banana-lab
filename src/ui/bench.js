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
 * 실험대의 좌표계는 **밀리미터**다. 픽셀이 아니다.
 *
 * 배경(실험대 애셋)은 패널 크기에 맞춰 늘어나는데 도구를 고정 px 로 놓으면,
 * 창 크기가 바뀔 때 둘이 어긋나고 realSizeMm 비례도 한 크기에서만 성립한다.
 * 그래서 무대 전체를 실험대 실물 크기로 잡고, 크기와 위치를 모두 그 비율로 낸다.
 * 배경과 도구가 같은 자로 재어지므로 어느 창 크기에서도 비례가 유지된다.
 *
 * 실험대 폭 1500 mm, 배경 애셋 viewBox 가 4:3 이므로 높이는 1125 mm.
 */
const STAGE_W_MM = CONTRACT.bench.realSizeMm;          // 1500
const STAGE_H_MM = (STAGE_W_MM * 3) / 4;               // 1125

/**
 * 애셋의 실물 긴 변을 무대 폭에 대한 비율(%)로 바꾼다.
 * 실험대 위 크기는 반드시 이 함수 하나만 거친다 — 두 곳에서 따로 계산하면 어긋난다.
 */
export function widthPct(assetName) {
  return (CONTRACT[assetName].realSizeMm / STAGE_W_MM) * 100;
}

/** mm 좌표를 무대 비율(%)로 */
const xPct = (mm) => (mm / STAGE_W_MM) * 100;
const yPct = (mm) => (mm / STAGE_H_MM) * 100;

/** 애셋 그림의 세로/가로 비. 대부분 400×300 이고 바나나만 400×312 다. */
function aspect(assetName) {
  const [, , w, h] = CONTRACT[assetName].viewBox.split(/\s+/).map(Number);
  return h / w;
}

/** 화면에서 차지할 높이 (mm). 실물 긴 변 × 그림 비율. */
const heightMm = (assetName) => CONTRACT[assetName].realSizeMm * aspect(assetName);

/**
 * 배경 애셋(`src/assets/bench.js`, viewBox 400×300) 의 랜드마크를 mm 로 옮긴 것.
 * 물건은 허공이 아니라 이 높이에 **바닥을 대고** 선다.
 * 숫자를 바꾸려면 배경 애셋의 좌표를 먼저 보라 — 둘이 어긋나면 물건이 떠 보인다.
 */
const SHELF_MM = (65 / 300) * STAGE_H_MM;     // 선반 상판 윗면 (viewBox y=65)
const SURFACE_MM = (155 / 300) * STAGE_H_MM;  // 작업면 앞 모서리 (viewBox y=155)

const DRAG_THRESHOLD_PX = 6;

/**
 * 손에 들고 쓰는 도구. 대상에 놓아 조작을 마치면 제자리(선반)로 돌아온다.
 * 그러지 않으면 대상 위에 그대로 남아, 나중에 그 대상(슬라이드 등)을 다시 누를 수 없게 가린다.
 */
const HAND_TOOLS = new Set(['banana', 'dropper', 'forceps']);

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/**
 * 실험대 위 배치. 좌표는 전부 **mm** 다.
 * `x` 는 왼쪽 끝, `bottom` 은 물건이 바닥을 대는 높이 — 선반 위인지 작업면 위인지.
 * 위쪽 좌표(y)는 실물 크기에서 계산하므로, `realSizeMm` 을 고치면 자리도 알아서 따라온다.
 */
function defaultItems() {
  const shelf = (x, rest) => ({ x, bottom: SHELF_MM, ...rest });
  const surface = (x, rest) => ({ x, bottom: SURFACE_MM, ...rest });
  const I = UI.bench.items;
  return [
    // 상단 선반
    shelf(40, { id: 'banana', asset: 'banana', kind: 'banana', label: I.banana }),
    shelf(260, { id: 'slideA', asset: 'slide', kind: 'slide', slide: 'A', label: I.slideA }),
    shelf(350, { id: 'slideB', asset: 'slide', kind: 'slide', slide: 'B', label: I.slideB }),
    shelf(440, { id: 'slideC', asset: 'slide', kind: 'slide', slide: 'C', label: I.slideC }),
    shelf(545, { id: 'coverslip1', asset: 'coverslip', kind: 'coverslip', label: I.coverslip }),
    shelf(580, { id: 'coverslip2', asset: 'coverslip', kind: 'coverslip', label: I.coverslip }),
    shelf(615, { id: 'coverslip3', asset: 'coverslip', kind: 'coverslip', label: I.coverslip }),
    shelf(680, { id: 'dropper', asset: 'dropper', kind: 'dropper', label: I.dropper }),
    shelf(850, { id: 'forceps', asset: 'forceps', kind: 'forceps', label: I.forceps }),
    shelf(1000, { id: 'bottleIKI', asset: 'bottle', kind: 'bottle', reagent: 'IKI', label: I.bottleIKI }),
    shelf(1130, { id: 'bottleSUDAN', asset: 'bottle', kind: 'bottle', reagent: 'SUDAN3', label: I.bottleSUDAN }),
    // 작업면
    surface(80, { id: 'dish', asset: 'dish', kind: 'dish', label: I.dish }),
    surface(400, { id: 'microscope', asset: 'microscope', kind: 'microscope', label: I.microscope }),
    surface(850, { id: 'waste', asset: 'waste', kind: 'waste', label: I.waste }),
    surface(1150, { id: 'tissue', asset: 'tissue', kind: 'tissue', label: I.tissue }),
  ].map((it) => ({ ...it, y: it.bottom - heightMm(it.asset) }));
}

/**
 * @param {HTMLElement} root
 * @param {{getState:Function, dispatch:Function, subscribe:Function}} store
 * @param {{onOpenZoom:(mode:string, slideId:string|null, opener:HTMLElement)=>void}} handlers
 */
export function createBench(root, store, { onOpenZoom }) {
  root.classList.add('bench');
  // 배경과 물건을 같은 무대 안에 둔다. 무대가 4:3 을 지키므로 둘이 함께 스케일된다.
  root.innerHTML =
    `<div class="bench-stage"><div class="bench-bg" aria-hidden="true"></div><div class="bench-tokens"></div></div>`;
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
      // T07 1단계 — 변인 조작을 고정해 둔다: 방울 수 선택 UI 를 따로 내주는 대신,
      // 한 번의 조작이 정확한 두 방울이 되게 한다. 그래도 반복해서 놓으면 넘칠 수 있다 — 막지 않는다.
      const count = store.getState().session.level === 1 ? 2 : 1;
      store.dispatch('DROP', { slide: target.slide, count });
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
      // T07 1단계 — 배율도 고정한다: 대물렌즈 선택 UI 를 안 주는 대신 400배로 맞춰 둔다.
      if (store.getState().session.level === 1) {
        store.dispatch('SET_OBJECTIVE', { objective: 40 });
      }
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

  /** 화면에서 끈 픽셀을 실험대 위 밀리미터로 바꾼다. 무대가 커지든 작아지든 같은 거리를 옮긴다. */
  function pxToMm() {
    const w = layer.getBoundingClientRect().width || 1;
    return STAGE_W_MM / w;
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const tx = e.clientX - drag.startClientX;
    const ty = e.clientY - drag.startClientY;
    drag.lastDx = tx - drag.prevTx;
    drag.lastDy = ty - drag.prevTy;
    drag.prevTx = tx; drag.prevTy = ty;
    if (Math.hypot(tx, ty) > DRAG_THRESHOLD_PX) drag.moved = true;
    const k = pxToMm();
    drag.item.x = drag.startX + tx * k;
    drag.item.y = drag.startY + ty * k;
    drag.el.style.left = `${xPct(drag.item.x)}%`;
    drag.el.style.top = `${yPct(drag.item.y)}%`;
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
    // 키보드 활성화(Enter/Space)로 조작하면 상태가 바뀌어 여기로 다시 들어오는데,
    // 매번 새 <button> 을 만들면 포커스가 <body> 로 빠져 Tab 흐름이 끊긴다.
    // 같은 id 를 가진 새 요소로 포커스를 옮겨 준다.
    const focusedId = layer.contains(document.activeElement) ? document.activeElement.dataset.id : null;
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
      // 크기와 위치를 전부 무대 비율로 낸다. 배경 애셋과 같은 자로 재어지므로
      // 창 크기가 바뀌어도 realSizeMm 비례와 배경 위 자리가 함께 유지된다.
      el.style.left = `${xPct(item.x)}%`;
      el.style.top = `${yPct(item.y)}%`;
      el.style.width = `${widthPct(item.asset)}%`;
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
    if (focusedId) layer.querySelector(`[data-id="${focusedId}"]`)?.focus();
  }

  // 드래그 도중에는 다시 그리지 않는다. TICK 처럼 사용자와 무관하게 들어오는 상태 변경이
  // DOM 을 새로 만들면 setPointerCapture 가 무효화돼 드래그가 조용히 끊긴다.
  // 드래그가 끝나면 onPointerUp 이 최신 상태로 어차피 다시 그린다.
  store.subscribe(() => { if (!drag) renderTokens(); });
  renderTokens();
}
