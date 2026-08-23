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
 * 잡을 수 있는 최소 크기 (px). `.token::after` 가 화면에서 보장하는 값과 같아야 한다.
 * 덮개 유리는 실물 22 mm 라 그림이 아주 작은데, 놓기 판정을 그림 크기로 하면
 * 눈에 보이는 넓은 영역에 갖다 대도 아무 일이 안 일어난다 — 잡히지 않는 것처럼 보인다.
 */
const MIN_HIT_PX = 44;

/**
 * 문질러 바르기 — 받침 유리 **위에서 움직인 거리**(mm)로 두께가 정해진다.
 *
 * 누르고 있던 시간이 아니다. 허공에 오래 들고 있었다고 두껍게 발릴 수는 없고,
 * 실제로 문지르는 동작은 왕복 운동이기 때문이다.
 * 이 거리만큼 움직이면 가장 두껍게 발린다 (받침 유리 긴 변이 76 mm 이므로 여러 번 왕복).
 */
const SMEAR_FULL_MM = 700;
const SMEAR_MIN = 0.12;
const SMEAR_MAX = 0.9;

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
    // 받침 유리 사이를 120 mm 씩 벌려 둔다. 바나나가 180 mm 라 90 mm 간격에서는
    // 끄는 동안 바나나 그림이 이웃한 유리 두 장을 함께 덮어, 어디에 발리는지 보이지 않았다.
    shelf(40, { id: 'banana', asset: 'banana', kind: 'banana', label: I.banana }),
    shelf(290, { id: 'slideA', asset: 'slide', kind: 'slide', slide: 'A', label: I.slideA }),
    shelf(410, { id: 'slideB', asset: 'slide', kind: 'slide', slide: 'B', label: I.slideB }),
    shelf(530, { id: 'slideC', asset: 'slide', kind: 'slide', slide: 'C', label: I.slideC }),
    shelf(660, { id: 'coverslip1', asset: 'coverslip', kind: 'coverslip', label: I.coverslip }),
    shelf(700, { id: 'coverslip2', asset: 'coverslip', kind: 'coverslip', label: I.coverslip }),
    shelf(740, { id: 'coverslip3', asset: 'coverslip', kind: 'coverslip', label: I.coverslip }),
    shelf(820, { id: 'dropper', asset: 'dropper', kind: 'dropper', label: I.dropper }),
    shelf(990, { id: 'forceps', asset: 'forceps', kind: 'forceps', label: I.forceps }),
    shelf(1120, { id: 'bottleIKI', asset: 'bottle', kind: 'bottle', reagent: 'IKI', label: I.bottleIKI }),
    shelf(1250, { id: 'bottleSUDAN', asset: 'bottle', kind: 'bottle', reagent: 'SUDAN3', label: I.bottleSUDAN }),
    // 작업면. 씻는 곳(개수대)과 버리는 곳(쓰레기통·폐액통)을 나눠 둔다 —
    // 실험 접시 하나가 둘을 겸하고 있었는데, 그림도 이름도 그 일과 맞지 않았다.
    // 접시는 실험대에서 뺐다. 두 물건이 그 일을 나눠 가진 뒤로는 놓아 둘 자리라는 뜻밖에
    // 남지 않는데, 자리를 차지하면 학생은 "이걸로 뭘 해야 하나" 를 계속 묻게 된다.
    surface(15, { id: 'sink', asset: 'sink', kind: 'sink', label: I.sink }),
    surface(410, { id: 'tissue', asset: 'tissue', kind: 'tissue', label: I.tissue }),
    surface(640, { id: 'microscope', asset: 'microscope', kind: 'microscope', label: I.microscope }),
    surface(995, { id: 'waste', asset: 'waste', kind: 'waste', label: I.waste }),
    surface(1255, { id: 'bin', asset: 'bin', kind: 'bin', label: I.bin }),
  ].map((it) => ({ ...it, y: it.bottom - heightMm(it.asset) }));
}

/**
 * 끌어다 놓았을 때 무슨 일이 일어나는가. **종류 쌍**으로만 적는다.
 *
 * 상태(핀셋이 지금 덮개 유리를 들고 있는가 같은 것)는 여기서 보지 않는다.
 * 빈손 핀셋을 받침 유리에 대면 rules.js 가 "손으로 집으려 하니 미끄러집니다" 라고 답해 주는데,
 * 그 답을 듣는 것이 이 실험에서 배우는 내용이다. 여기서 미리 걸러 내면 들을 기회가 사라진다.
 * 그래서 드래그 중 하이라이트는 "된다" 가 아니라 **"여기에 무언가 일어난다"** 는 표시다.
 *
 * 이 표 하나가 세 곳에 함께 쓰인다 — 실제 실행, 드래그 중 대상 하이라이트, 안내 문구 유무.
 * 셋을 따로 적으면 조작을 하나 늘릴 때마다 세 곳이 어긋난다.
 */
export function dropTable(store, openZoom = () => {}) {
  return {
    banana: {
      slide: (item, target, d) => {
        const thickness = clamp(d.smearMm / SMEAR_FULL_MM, SMEAR_MIN, SMEAR_MAX);
        store.dispatch('SMEAR', { slide: target.slide, thickness });
      },
    },
    dropper: {
      bottle: (item, target) => store.dispatch('FILL_DROPPER', { reagent: target.reagent }),
      // 받침 유리에 대면 확대 뷰가 열린다 — 방울은 거기서 고무를 눌러 한 방울씩 떨어뜨린다.
      // 무엇을 들고 왔는지 함께 넘긴다. 들고 온 도구만 그 화면에 나온다.
      slide: (item, target) => openZoom('slide', target.slide, 'dropper'),
      waste: () => store.dispatch('RINSE_DROPPER', {}),
    },
    forceps: {
      coverslip: () => store.dispatch('PICK_COVERSLIP', {}),
      // 덮는 것도 들어내는 것도 손끝 일이다. 실험대에서 끌어다 대는 것으로는 각도를 못 정하고,
      // 덮인 유리를 집어 드는 것은 더 어렵다. 대면 확대 뷰가 열리고 거기서 한다.
      slide: (item, target) => openZoom('slide', target.slide, 'forceps'),
      // 쓴 덮개 유리는 고형 폐기물이다. 폐액통이 아니라 쓰레기통에 버린다.
      bin: () => store.dispatch('DISCARD_COVERSLIP', {}),
    },
    // 휴지로 대물렌즈를 닦는다. 덮개 유리 없이 고배율로 올려 렌즈가 더러워졌을 때
    // 되돌릴 길이 여태 없었다 — 한 번의 실수로 현미경을 못 쓰게 두지 않는다.
    tissue: {
      microscope: () => store.dispatch('CLEAN_LENS', {}),
    },
    slide: {
      /**
       * 재물대에 올린다.
       *
       * 1단계는 여기서 저배율 초점까지 **대신 맞춰 주고** 400배로 올려 준다.
       * 나사 조작을 잘못하면 슬라이드가 깨져 되돌릴 길이 좁아지는데, 1단계는 그걸
       * 감당하는 자리가 아니다. 2·3단계는 저배율부터 직접 올라간다.
       *
       * **순서가 전부다.** 조동나사는 고배율에서 돌리면 슬라이드를 깨뜨린다.
       * 배율은 슬라이드를 바꿔도 그대로 남아 있으므로, 앞 슬라이드를 400배로 보다가
       * 새것을 올리면 곧바로 400배에서 조동나사를 돌리는 셈이 된다 — 올리자마자 깨진다.
       * 그래서 저배율로 **먼저 내리고**, 초점을 맞추고, 그다음 올린다.
       * 이 순서라야 `SET_OBJECTIVE` 가 "저배율에서 초점을 맞추지 않고 올렸습니다" 라는,
       * 학생이 한 적 없는 일로 나무라지도 않는다.
       */
      microscope: (item) => {
        store.dispatch('MOUNT', { slide: item.slide });
        if (store.getState().session.level !== 1) return;
        store.dispatch('SET_OBJECTIVE', { objective: 4 });
        store.dispatch('COARSE_FOCUS', { delta: -store.getState().microscope.coarse });
        store.dispatch('SET_OBJECTIVE', { objective: 40 });
      },
      sink: (item) => store.dispatch('RINSE_SLIDE', { slide: item.slide }),
    },
  };
}

/**
 * 물건을 클릭(또는 Enter/Space)했을 때. 끌어다 놓는 조작과 달리 대상이 필요 없는 것들.
 *
 * 시약병·폐액통·휴지의 안전 수칙은 늦게라도 하면 자기 평가의 위반 기록에서 지워진다
 * (rules.js 의 safetyAction). 그 셋을 부르는 곳이 여기 말고는 없다 —
 * 없으면 위반 기록이 한 번 남고 영영 지워지지 않는다.
 */
export function tapTable(store, onOpenZoom) {
  return {
    banana: () => store.dispatch('PEEL_BANANA', {}),
    slide: (item, el) => onOpenZoom('slide', item.slide, el),
    microscope: (item, el) => onOpenZoom('scope', store.getState().microscope.stage, el),
    bottle: () => store.dispatch('CLOSE_CAP', {}),
    waste: () => store.dispatch('DISPOSE_WASTE', {}),
    tissue: () => store.dispatch('WASH_HANDS', {}),
  };
}

/**
 * 실험대 배치를 mm 사각형으로 낸다.
 *
 * 물건이 서로 겹치면 나중에 그려진 쪽이 앞선 쪽의 클릭을 통째로 가로챈다.
 * 실제로 개수대를 500 mm 로 잡았더니 세로 375 mm 로 자라 선반 위 받침 유리를 덮었고,
 * 받침 유리를 끌 수가 없었다. 눈으로는 개수대가 아래쪽에만 그려져 있어 보이지 않는다 —
 * 애셋은 저마다 400×300 프레임을 채워 그리므로 **빈 여백까지 잡는 영역**이기 때문이다.
 */
export function benchLayout() {
  return defaultItems().map((it) => ({
    id: it.id,
    x: it.x,
    y: it.y,
    w: CONTRACT[it.asset].realSizeMm,
    h: heightMm(it.asset),
  }));
}

/** 실험대에 놓인 물건들. 배치를 몰라도 종류만 알면 되는 검사에 쓴다. */
export const BENCH_KINDS = [
  'banana', 'slide', 'coverslip', 'dropper', 'forceps',
  'bottle', 'microscope', 'waste', 'sink', 'bin', 'tissue',
];

/**
 * @param {HTMLElement} root
 * @param {{getState:Function, dispatch:Function, subscribe:Function}} store
 * @param {{onOpenZoom:(mode:string, slideId:string|null, opener:HTMLElement)=>void}} handlers
 */
export function createBench(root, store, { onOpenZoom }) {
  root.classList.add('bench');
  // 배경과 물건을 같은 무대 안에 둔다. 무대가 4:3 을 지키므로 둘이 함께 스케일된다.
  // 안내 말풍선은 무대 바로 아래에 둔다 — 물건 층(.bench-tokens)은 조작할 때마다
  // 통째로 다시 그려지므로, 그 안에 두면 말풍선이 같이 사라진다.
  root.innerHTML = `
    <div class="bench-bar">
      <button type="button" id="undo">${UI.undo.label}</button>
      <span id="undo-left"></span>
      <button type="button" id="unmount" hidden></button>
    </div>
    <div class="bench-stage">
      <div class="bench-bg" aria-hidden="true"></div>
      <div class="bench-tokens"></div>
      <div class="bench-tip" id="bench-tip" role="tooltip" hidden></div>
    </div>`;
  root.querySelector('.bench-bg').innerHTML = ASSETS.bench.render({});
  const layer = root.querySelector('.bench-tokens');
  const tipEl = root.querySelector('.bench-tip');
  const unmountBtn = root.querySelector('#unmount');

  root.querySelector('#undo').addEventListener('click', () => store.dispatch('UNDO', {}));
  unmountBtn.addEventListener('click', () => store.dispatch('UNMOUNT', {}));

  const DROPS = dropTable(store, (mode, id, tool) => onOpenZoom(mode, id, elFor(`slide${id}`), tool));

  const TAPS = tapTable(store, onOpenZoom);

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let drag = null;

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

  /**
   * 재물대에 올라간 받침 유리는 실험대에서 사라진다 — 그 자리에 있으니까.
   *
   * 덮개 유리는 사라지지 않는다. 한 상자에서 계속 꺼내 쓰는 물건이고,
   * 석 장을 세고 있다가 잘못 덮은 뒤 씻고 다시 하면 곧바로 바닥나 막다른 길이 된다.
   */
  function isHidden(item) {
    return item.kind === 'slide' && store.getState().microscope.stage === item.slide;
  }

  const elFor = (id) => layer.querySelector(`[data-id="${id}"]`);

  /**
   * 놓기 판정에 쓰는 사각형. 그림이 작아도 최소 MIN_HIT_PX 는 잡아 준다 —
   * 화면에서 눌리는 영역(.token::after)과 같은 크기여야 손에 잡히는 대로 동작한다.
   */
  function hitRect(el) {
    const r = el.getBoundingClientRect();
    const w = Math.max(r.width, MIN_HIT_PX);
    const h = Math.max(r.height, MIN_HIT_PX);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
  }

  /**
   * 드래그가 시작될 때 다른 물건들의 판정 사각형을 한 번만 재어 둔다.
   * 드래그 중에는 끄는 물건 말고는 아무것도 움직이지 않으므로(재렌더도 건너뛴다) 안전하고,
   * 포인터가 움직일 때마다 열몇 개를 다시 재는 일을 없앤다.
   */
  function captureRects(selfId) {
    const rects = new Map();
    for (const other of items) {
      if (other.id === selfId || isHidden(other)) continue;
      const oe = elFor(other.id);
      if (oe) rects.set(other.id, hitRect(oe));
    }
    return rects;
  }

  /** 끄는 물건의 중심점 아래 있는 첫 토큰. */
  function targetUnder() {
    const r = drag.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (const other of items) {
      const or_ = drag.rects.get(other.id);
      if (!or_) continue;
      if (cx >= or_.left && cx <= or_.right && cy >= or_.top && cy <= or_.bottom) return other;
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* 안내 말풍선 — 이름과 지금 할 수 있는 조작                          */
  /* ---------------------------------------------------------------- */

  function showTip(item) {
    if (drag) return;
    const level = store.getState().session.level;
    const lines = UI.bench.hints[item.kind]?.[level] ?? [];
    tipEl.innerHTML =
      `<b>${item.label}</b>${lines.map((t) => `<span>${t}</span>`).join('')}`;
    // 무대 밖으로 밀려나지 않게 가로 위치를 안쪽으로 묶는다.
    const centerMm = item.x + CONTRACT[item.asset].realSizeMm / 2;
    tipEl.style.left = `${clamp(xPct(centerMm), 12, 88)}%`;
    // 위쪽에 있는 물건은 말풍선을 아래로 — 위로 띄우면 실험대 밖으로 나간다.
    const below = yPct(item.y) < 26;
    tipEl.dataset.below = String(below);
    tipEl.style.top = `${yPct(below ? item.y + heightMm(item.asset) : item.y)}%`;
    tipEl.hidden = false;
  }

  function hideTip() {
    tipEl.hidden = true;
  }

  /* ---------------------------------------------------------------- */
  /* 드래그                                                            */
  /* ---------------------------------------------------------------- */

  /** 지금 끄는 물건이 무언가 일으킬 수 있는 상대들을 표시한다. */
  function markTargets(item) {
    const accepts = DROPS[item.kind] ?? {};
    for (const other of items) {
      const oe = elFor(other.id);
      if (!oe || other.id === item.id) continue;
      oe.classList.toggle('token--target', Boolean(accepts[other.kind]));
      oe.classList.toggle('token--inert', !accepts[other.kind]);
    }
  }

  function clearMarks() {
    layer.querySelectorAll('.token').forEach((el) => {
      el.classList.remove('token--target', 'token--inert', 'token--target-hot');
    });
  }

  /** 문지르는 동안 얼마나 발렸는지 보여 준다. 안 보이면 문지르는 중인 줄을 모른다. */
  function updateSmearMeter() {
    let meter = drag.el.querySelector('.smear-meter');
    if (drag.smearMm <= 0) {
      meter?.remove();
      return;
    }
    if (!meter) {
      meter = document.createElement('div');
      meter.className = 'smear-meter';
      meter.innerHTML = '<i></i>';
      drag.el.appendChild(meter);
    }
    const t = clamp(drag.smearMm / SMEAR_FULL_MM, 0, 1);
    meter.querySelector('i').style.width = `${(t * 100).toFixed(0)}%`;
  }

  function onPointerDown(e, item, el) {
    if (e.button !== undefined && e.button !== 0) return;
    hideTip();
    el.setPointerCapture(e.pointerId);
    drag = {
      pointerId: e.pointerId, item, el,
      startClientX: e.clientX, startClientY: e.clientY,
      startX: item.x, startY: item.y,
      moved: false, lastDx: 0, lastDy: 0, prevTx: 0, prevTy: 0,
      smearMm: 0,
      rects: captureRects(item.id),
    };
    el.classList.add('token--dragging');
    markTargets(item);
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

    const target = targetUnder();
    // 지금 무엇 위에 있는지 표시한다.
    for (const other of items) elFor(other.id)?.classList.remove('token--target-hot');
    if (target && DROPS[drag.item.kind]?.[target.kind]) {
      elFor(target.id)?.classList.add('token--target-hot');
    }
    // 문지르기는 받침 유리 **위에서 움직인 거리**만 센다. 허공에서 흔든 것은 세지 않는다.
    if (drag.item.kind === 'banana' && target?.kind === 'slide') {
      drag.smearMm += Math.hypot(drag.lastDx, drag.lastDy) * k;
      drag.smearTarget = target;
      updateSmearMeter();
    }
  }

  /**
   * 마지막으로 **포인터로** 탭을 처리한 시각.
   *
   * 마우스로 누르면 pointerup 뒤에 click 이벤트가 이어서 온다. 둘 다 처리하면 한 번 눌렀는데
   * 두 번 일어난다. 그렇다고 click 을 안 들으면, 포인터를 쓰지 않고 `element.click()` 으로
   * 누르는 길(음성 제어·스크린리더 같은 보조기기)이 통째로 막힌다.
   * 그래서 click 은 듣되, 방금 포인터로 처리한 것이면 넘긴다.
   */
  let pointerTapAt = 0;
  const POINTER_TAP_GRACE_MS = 500;

  /** 탭(포인터로 움직임 없이 누르고 뗌) 또는 키보드 활성화(Enter/Space) 로 여는 동작. */
  function handleTap(item, el) {
    TAPS[item.kind]?.(item, el);
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    // 손을 뗀 자리를 마지막으로 한 번 더 반영한다.
    //
    // 아주 빠르게 끌어 놓으면 중간 이동 이벤트가 한 번도 안 올 수 있다 (기기·브라우저에 따라
    // 눌렀다 뗀 두 지점만 온다). 그때 이동만 보고 판정하면 실제로 끌었는데도 제자리 탭으로
    // 처리돼 아무 일도 일어나지 않는다. **누른 곳과 뗀 곳이 얼마나 떨어졌는가**로 가른다.
    onPointerMove(e);
    const { item, el, moved } = drag;
    el.releasePointerCapture(e.pointerId);
    el.classList.remove('token--dragging');
    el.querySelector('.smear-meter')?.remove();
    clearMarks();

    if (!moved) {
      // 움직이지 않았다면 조작이 아니라 탭이다.
      drag = null;
      pointerTapAt = performance.now();
      handleTap(item, el);
      renderTokens();
      return;
    }

    let target = targetUnder();
    // 문지르다 보면 손을 뗄 때 받침 유리 밖에 있기 쉽다 — 왕복 운동이라 매번 가장자리를 넘어간다.
    // 받침 유리(76 mm)는 화면에서 40 px 남짓이라 자연스러운 왕복이 대부분 유리 밖에서 끝난다.
    // 여기서 놓쳐 버리면 계량기가 다 찼는데도 아무 일이 안 일어난다. 문지른 것은 문지른 것이다.
    if (!target && drag.smearMm > 0 && drag.smearTarget) target = drag.smearTarget;
    const run = target ? DROPS[item.kind]?.[target.kind] : null;
    if (run) run(item, target, { smearMm: drag.smearMm, lastDx: drag.lastDx, lastDy: drag.lastDy });

    // 쓴 물건은 언제나 제자리로 돌아간다.
    //
    // 놓인 자리는 결과에 아무 영향을 주지 않는데, 물건이 놓인 채로 남으면 자리가 뜻을 갖는 것처럼
    // 보인다 — 현미경 위에 얹힌 받침 유리는 재물대에 올라간 것처럼 보인다(실제로는 아니다).
    // 재물대에 올라가 화면에서 사라진 받침 유리도 마찬가지로 되돌려 둔다.
    // 그러지 않으면 내렸을 때 현미경 위에 겹쳐 나타나 다시 집을 수가 없다.
    item.x = item.homeX;
    item.y = item.homeY;
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
      el.setAttribute('aria-describedby', 'bench-tip');
      el.innerHTML = ASSETS[item.asset].render(assetState(item));

      el.addEventListener('pointerdown', (e) => onPointerDown(e, item, el));
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);

      el.addEventListener('pointerenter', () => showTip(item));
      el.addEventListener('pointerleave', hideTip);
      el.addEventListener('focus', () => showTip(item));
      el.addEventListener('blur', hideTip);

      // 포인터를 거치지 않고 눌리는 경우 — 보조기기의 element.click() 등.
      // 방금 포인터로 처리했으면 같은 누름이므로 넘긴다.
      el.addEventListener('click', () => {
        if (performance.now() - pointerTapAt < POINTER_TAP_GRACE_MS) return;
        handleTap(item, el);
      });

      // 키보드 활성화(Enter/Space).
      // 브라우저는 <button> 에서 Enter/Space 를 click 으로도 바꿔 주지만, 그 전에
      // Space 가 페이지를 스크롤시킨다. preventDefault 하려면 keydown 을 직접 들어야 한다.
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        pointerTapAt = performance.now();   // 뒤따라올 click 을 삼킨다
        handleTap(item, el);
      });

      layer.appendChild(el);
    }
    if (focusedId) layer.querySelector(`[data-id="${focusedId}"]`)?.focus();
  }

  function renderBar() {
    const st = store.getState();
    const undosLeft = st.session.undosLeft;
    root.querySelector('#undo-left').textContent =
      undosLeft === Infinity ? UI.undo.unlimited : UI.undo.left(undosLeft);
    unmountBtn.hidden = !st.microscope.stage;
    if (st.microscope.stage) {
      unmountBtn.textContent = UI.bench.unmount(UI.slideShort[st.microscope.stage]);
    }
  }

  // 드래그 도중에는 다시 그리지 않는다. TICK 처럼 사용자와 무관하게 들어오는 상태 변경이
  // DOM 을 새로 만들면 setPointerCapture 가 무효화돼 드래그가 조용히 끊긴다.
  // 드래그가 끝나면 onPointerUp 이 최신 상태로 어차피 다시 그린다.
  store.subscribe(() => { renderBar(); if (!drag) renderTokens(); });
  renderTokens();
  renderBar();
}
