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
import { CONTRACT, CONTENT_BOX, drawnBoxMm } from '../assets/contract.js';
import { excess } from '../sim/state.js';
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
const LANDMARKS = CONTRACT.bench.landmarks;
const SHELF_MM = (LANDMARKS.shelfTopY / 300) * STAGE_H_MM;      // 선반 상판 윗면
const SURFACE_MM = (LANDMARKS.surfaceFrontY / 300) * STAGE_H_MM; // 작업면 앞 모서리

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
    // 왼쪽에서 오른쪽으로 (가)·(나)·(다) 순이다. 앞서는 (다)·(나)·(가) 순이었는데,
    // 탐구 노트와 보고서는 어디서나 (가)→(다) 로 읽히므로 실험대만 거꾸로였다.
    // 세 번째 슬라이드를 만들면서 매번 왼쪽 끝으로 돌아가야 했다.
    shelf(455, { id: 'banana', asset: 'banana', kind: 'banana', labelKey: 'banana' }),
    shelf(685, { id: 'slideA', asset: 'slide', kind: 'slide', slide: 'A', labelKey: 'slideA' }),
    shelf(835, { id: 'slideB', asset: 'slide', kind: 'slide', slide: 'B', labelKey: 'slideB' }),
    shelf(985, { id: 'slideC', asset: 'slide', kind: 'slide', slide: 'C', labelKey: 'slideC' }),
    // 낱장 석 장을 늘어놓았더니 22 mm 짜리가 화면에서 12 px 이라 무엇인지 알아볼 수 없었다.
    // 통 하나로 바꾼다 — 실제 실험실도 통에서 꺼내 쓰고, 종류(kind)는 그대로라 조작표는 그대로다.
    shelf(1156, { id: 'coverbox', asset: 'coverbox', kind: 'coverslip', labelKey: 'coverbox' }),
    // 받침 유리도 통에서 꺼내 쓴다. 덮개 유리 통 **바로 왼쪽**에 붙여 둔다 —
    // 둘 다 "통에서 꺼내 쓰는 것" 이라 나란히 있어야 한 쌍으로 읽힌다.
    // 앞서는 받침 유리들 사이에 끼어 있어서, 낱장 유리와 통이 뒤섞여 보였다.
    shelf(1055, { id: 'slidebox', asset: 'slidebox', kind: 'slidebox', labelKey: 'slidebox' }),
    surface(1301, { id: 'dropper', asset: 'dropper', kind: 'dropper', labelKey: 'dropper' }),
    surface(1380, { id: 'forceps', asset: 'forceps', kind: 'forceps', labelKey: 'forceps' }),
    // 물도 시약병에 담겨 있다. 교과서 절차에서 시료 위에 먼저 떨어뜨리는 봉입액이고,
    // 이것이 없으면 (가) 대조군에 아무것도 할 일이 없어 대조군인 이유가 흐려진다.
    shelf(1221, { id: 'bottleWATER', asset: 'bottle', kind: 'bottle', reagent: 'WATER', labelKey: 'bottleWATER' }),
    shelf(1298, { id: 'bottleIKI', asset: 'bottle', kind: 'bottle', reagent: 'IKI', labelKey: 'bottleIKI' }),
    shelf(1375, { id: 'bottleSUDAN', asset: 'bottle', kind: 'bottle', reagent: 'SUDAN3', labelKey: 'bottleSUDAN' }),
    // 작업면. 씻는 곳(개수대)과 버리는 곳(쓰레기통·폐액통)을 나눠 둔다 —
    // 실험 접시 하나가 둘을 겸하고 있었는데, 그림도 이름도 그 일과 맞지 않았다.
    // 접시는 실험대에서 뺐다. 두 물건이 그 일을 나눠 가진 뒤로는 놓아 둘 자리라는 뜻밖에
    // 남지 않는데, 자리를 차지하면 학생은 "이걸로 뭘 해야 하나" 를 계속 묻게 된다.
    surface(477, { id: 'sink', asset: 'sink', kind: 'sink', labelKey: 'sink' }),
    surface(728, { id: 'tissue', asset: 'tissue', kind: 'tissue', labelKey: 'tissue' }),
    surface(905, { id: 'microscope', asset: 'microscope', kind: 'microscope', labelKey: 'microscope' }),
    surface(340, { id: 'waste', asset: 'waste', kind: 'waste', labelKey: 'waste' }),
    surface(0, { id: 'bin', asset: 'bin', kind: 'bin', labelKey: 'bin' }),
    // 이름은 키로만 적어 둔다. 편집 모드가 배치를 다시 코드로 뱉을 때
    // `label: I.banana` 를 되살리려면 어느 키였는지를 알아야 한다.
  ].map((it) => ({ ...it, label: I[it.labelKey], y: it.bottom - heightMm(it.asset) }));
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
      // 금이 간 유리는 씻어도 그대로다. 통에 대면 그 자리를 새것이 대신한다.
      slidebox: (item) => store.dispatch('NEW_SLIDE', { slide: item.slide }),
      // 깨진 유리는 고형 폐기물이다. 버리는 손짓이 먼저 나오는 학생도 있으므로 같은 길을 연다.
      bin: (item) => store.dispatch('NEW_SLIDE', { slide: item.slide }),
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
 * 실험대 배치를 mm 사각형으로 낸다. **그려진 부분**의 사각형이다 (프레임이 아니라).
 *
 * 물건이 서로 겹치면 나중에 그려진 쪽이 앞선 쪽의 클릭을 가로챈다.
 * 예전에는 애셋의 400×300 프레임 전체를 그 영역으로 쳤는데, 스포이트는 폭 400 중 55 만
 * 실제로 그려져 있다. 그 여백까지 세면 눈에는 한참 떨어져 보이는 물건 둘이 겹친 것이 되고,
 * 작업면에 놓을 물건 일곱을 재면 1695 mm 라 1500 mm 실험대에 아예 앉힐 수가 없었다.
 * 이제 칠해진 부분만 포인터를 받으므로(`index.html` 의 `.token`), 여기서도 그 부분만 잰다.
 */
export function benchLayout() {
  return defaultItems().map((it) => {
    const d = drawnBoxMm(it.asset);
    return { id: it.id, x: it.x + d.dx, y: it.y + d.dy, w: d.w, h: d.h };
  });
}

/** 실험대에 놓인 물건들. 배치를 몰라도 종류만 알면 되는 검사에 쓴다. */
export const BENCH_KINDS = [
  'banana', 'slide', 'coverslip', 'slidebox', 'dropper', 'forceps',
  'bottle', 'microscope', 'waste', 'sink', 'bin', 'tissue',
];

/**
 * 배치를 다시 코드로 뱉는다 — 편집 모드에서 옮긴 자리를 그대로 `defaultItems()` 에 붙여 넣는다.
 *
 * 눈으로 옮긴 것을 손으로 숫자로 옮겨 적는 일은 반드시 어딘가 틀린다.
 * 옮긴 사람이 스크린샷만 보내면 되도록, 화면이 스스로 좌표를 말하게 한다.
 */
function layoutCode(items) {
  const lines = items.map((it) => {
    const fn = Math.abs(it.bottom - SHELF_MM) < 1 ? 'shelf' : 'surface';
    const props = [
      `id: '${it.id}'`,
      `asset: '${it.asset}'`,
      `kind: '${it.kind}'`,
      it.slide ? `slide: '${it.slide}'` : null,
      it.reagent ? `reagent: '${it.reagent}'` : null,
      `labelKey: '${it.labelKey}'`,
    ].filter(Boolean).join(', ');
    return `    ${fn}(${Math.round(it.x)}, { ${props} }),`;
  });
  return `// src/ui/bench.js 의 defaultItems() 안, 배열 자리에 그대로 붙여 넣습니다.\n${lines.join('\n')}`;
}

/**
 * @param {HTMLElement} root
 * @param {{getState:Function, dispatch:Function, subscribe:Function}} store
 * @param {{onOpenZoom:Function, edit?:boolean}} handlers
 *   edit — 배치를 옮겨 보는 모드. 조작은 일어나지 않고 물건이 놓인 자리에 그대로 남는다.
 */
export function createBench(root, store, { onOpenZoom, edit = false }) {
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
      <div class="bench-lock" id="bench-lock" hidden>
        <div class="bench-lock-card">
          <b>${UI.bench.lock.title}</b>
          <p>${UI.bench.lock.lead}</p>
          <ul id="bench-lock-left"></ul>
        </div>
      </div>
    </div>
    ${edit ? `
      <div class="edit-panel" id="edit-panel">
        <div class="edit-head">
          <b>${UI.edit.heading}</b>
          <button type="button" id="edit-copy">${UI.edit.copy}</button>
          <button type="button" id="edit-reset">${UI.edit.reset}</button>
        </div>
        <p class="edit-note">${UI.edit.note}</p>
        <p class="edit-warn" id="edit-warn"></p>
        <table class="edit-table"><tbody id="edit-rows"></tbody></table>
      </div>` : ''}`;
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

  /* ---------------- 편집 모드 ---------------- */

  /**
   * 물건은 두 선 중 **가까운 쪽**에 바닥을 댄다 — 선반 위 아니면 작업면 위다.
   * 중간 높이에 띄워 둘 수는 없다. 그림에 그런 자리가 없기 때문이다.
   */
  function snapToLine(item) {
    const h = heightMm(item.asset);
    const bottom = item.y + h;
    item.bottom = Math.abs(bottom - SHELF_MM) <= Math.abs(bottom - SURFACE_MM) ? SHELF_MM : SURFACE_MM;
    item.x = clamp(item.x, 0, STAGE_W_MM - CONTRACT[item.asset].realSizeMm);
    item.y = item.bottom - h;
  }

  /**
   * 서로 겹치는 물건 짝. 겹치면 **뒤에 그려진 쪽이 앞엣것의 클릭을 가로챈다.**
   * 재는 것은 그려진 부분이다 — 포인터를 받는 것도 그 부분이다.
   */
  function overlaps() {
    const box = (it) => {
      const d = drawnBoxMm(it.asset);
      return { x: it.x + d.dx, y: it.y + d.dy, w: d.w, h: d.h };
    };
    const bad = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = box(items[i]);
        const b = box(items[j]);
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
          bad.add(items[i].id);
          bad.add(items[j].id);
        }
      }
    }
    return bad;
  }

  function renderEditPanel() {
    if (!edit) return;
    const bad = overlaps();
    root.querySelector('#edit-rows').innerHTML = items.map((it) => {
      const d = drawnBoxMm(it.asset);
      return `
      <tr${bad.has(it.id) ? ' class="edit-bad"' : ''}>
        <td>${it.id}</td>
        <td>${Math.abs(it.bottom - SHELF_MM) < 1 ? UI.edit.shelf : UI.edit.surface}</td>
        <td class="edit-x">${Math.round(it.x)}</td>
        <td class="edit-span">~${Math.round(it.x + d.dx + d.w)}</td>
        <td>${bad.has(it.id) ? UI.edit.overlap : ''}</td>
      </tr>`;
    }).join('');
    root.querySelector('#edit-warn').textContent = bad.size ? UI.edit.overlapWarn(bad.size) : '';
  }

  if (edit) {
    root.querySelector('#edit-copy').addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(layoutCode(items));
      e.target.textContent = UI.edit.copied;
      setTimeout(() => { e.target.textContent = UI.edit.copy; }, 1500);
    });
    root.querySelector('#edit-reset').addEventListener('click', () => {
      for (const [i, it] of defaultItems().entries()) Object.assign(items[i], it);
      renderTokens();
      renderEditPanel();
    });
    // 스크린샷만으로 배치를 옮겨 적을 수 있어야 한다. 콘솔에도 한 벌 남긴다 —
    // 붙여 넣기가 막힌 환경(권한 거부)에서도 길이 하나는 남는다.
    window.__layoutCode = () => layoutCode(items);
  }

  function slideRenderState(slideId) {
    const s = store.getState().slides[slideId];
    return {
      sample: s.sample,
      stain: s.stain,
      reaction: s.reactionT,
      // 넘친 액은 실험대에서도 보여야 한다. 확대 뷰를 열어야만 보이면
      // 열여섯 방울을 떨어뜨린 학생이 실험대만 보고는 아무 일도 없다고 여긴다.
      excess: excess(s),
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
  function hitRect(el, assetName) {
    const r = el.getBoundingClientRect();
    // 프레임이 아니라 **그려진 부분**을 잰다. 개수대 프레임(380 mm)은 휴지 프레임과 겹치는데,
    // 그림은 한참 떨어져 있다 — 프레임으로 재면 휴지 그림을 겨눠도 개수대가 잡힌다.
    const c = CONTENT_BOX[assetName];
    const [, , vw, vh] = CONTRACT[assetName].viewBox.split(/\s+/).map(Number);
    const left = r.left + r.width * (c.x0 / vw);
    const top = r.top + r.height * (c.y0 / vh);
    const dw = r.width * ((c.x1 - c.x0) / vw);
    const dh = r.height * ((c.y1 - c.y0) / vh);
    // 그림이 손가락보다 작으면 최소 크기까지 넓혀 준다 (덮개 유리 통·받침 유리).
    const w = Math.max(dw, MIN_HIT_PX);
    const h = Math.max(dh, MIN_HIT_PX);
    const cx = left + dw / 2;
    const cy = top + dh / 2;
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
      if (oe) rects.set(other.id, hitRect(oe, other.asset));
    }
    return rects;
  }

  /** 끄는 물건의 **그림** 중심 아래 있는 첫 토큰. 프레임 중심은 그림 밖일 수 있다. */
  function targetUnder() {
    const g = hitRect(drag.el, drag.item.asset);
    const cx = (g.left + g.right) / 2;
    const cy = (g.top + g.bottom) / 2;
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

  /**
   * 키보드로 끌어다 놓기.
   *
   * 끌어다 놓는 조작에는 키보드 경로가 없었다 — 문지르기·채우기·집기·올리기가 전부
   * 마우스 전용이라, 마우스를 쓰지 못하면 실험을 시작조차 할 수 없었다.
   *
   * 포커스로 말풍선이 떴을 때만 **놓을 곳 버튼**을 함께 낸다. Tab 으로 들어가 Enter 로 놓는다.
   * 마우스로는 손짓이 정하던 값(문지른 정도·덮는 각도)을 키보드로는 정할 수 없으므로
   * 가운뎃값을 쓴다 — 정할 수 있는 것과 아예 못 하는 것 사이의 격차는 남지만,
   * 못 하는 쪽보다는 낫다. 말풍선에 그 값을 적어 둔다.
   */
  const KEYBOARD_SMEAR_MM = SMEAR_FULL_MM / 2;
  const KEYBOARD_ANGLE_DEG = 45;

  function dropTargetsFor(item) {
    const accepts = DROPS[item.kind] ?? {};
    return items.filter((o) => o.id !== item.id && !isHidden(o) && accepts[o.kind]);
  }

  function runDrop(item, target) {
    const run = DROPS[item.kind]?.[target.kind];
    if (!run) return;
    // 손짓이 정하던 값의 자리에 가운뎃값을 넣는다.
    const rad = (KEYBOARD_ANGLE_DEG * Math.PI) / 180;
    run(item, target, {
      smearMm: KEYBOARD_SMEAR_MM,
      lastDx: Math.cos(rad) * 10,
      lastDy: Math.sin(rad) * 10,
    });
    renderTokens();
    // 놓고 나면 그 물건으로 포커스를 돌려준다. 그러지 않으면 포커스가 <body> 로 빠져
    // 키보드로 쓰는 사람은 매번 처음부터 Tab 해서 돌아와야 한다.
    // focus() 가 focus 이벤트를 쏘고, 그 핸들러가 말풍선을 다시 낸다 — 여기서 또 부르지 않는다.
    // 놓은 물건이 화면에서 사라졌으면(재물대에 올라간 받침 유리) **놓은 자리**로 옮긴다.
    // 그냥 두면 포커스가 <body> 로 빠져, 키보드로 쓰는 사람은 처음부터 Tab 해 돌아와야 한다.
    (elFor(item.id) ?? elFor(target.id))?.focus();
  }

  /**
   * 지금 떠 있는 말풍선이 **키보드로 연 것인가.**
   *
   * 키보드로 연 말풍선에는 「여기에 놓기」 버튼이 함께 나오고, 마우스를 못 쓰는 사람에게는
   * **그 버튼이 물건을 옮기는 길의 전부다.** 마우스가 그것을 덮어 버리면 길이 사라진다.
   */
  let tipFromKeyboard = false;

  function showTip(item, withActions = false) {
    if (drag) return;
    tipFromKeyboard = withActions;
    clearTimeout(hideTimer);   // 옆 물건으로 옮겨 오는 중이었다면 예약된 닫기를 취소한다
    hideTimer = 0;
    const level = store.getState().session.level;
    const lines = UI.bench.hints[item.kind]?.[level] ?? [];
    // 편집 모드에서는 놓을 곳 버튼을 내지 않는다. 그 버튼은 실제 조작을 일으키므로
    // "조작은 일어나지 않습니다" 라고 적어 둔 화면에 있으면 안 된다.
    const targets = withActions && !edit ? dropTargetsFor(item) : [];
    const actions = targets.length ? `
      <div class="tip-actions">
        <span class="tip-actions-label">${UI.bench.keyboardPut}</span>
        ${targets.map((t) => `<button type="button" data-put="${item.id}" data-onto="${t.id}"
          >${t.label}</button>`).join('')}
      </div>` : '';
    tipEl.innerHTML =
      `<b>${item.label}</b>${lines.map((t) => `<span>${t}</span>`).join('')}${actions}`;
    tipEl.querySelectorAll('[data-put]').forEach((b) => {
      b.addEventListener('click', () => {
        const from = items.find((i) => i.id === b.dataset.put);
        const onto = items.find((i) => i.id === b.dataset.onto);
        if (from && onto) runDrop(from, onto);
      });
    });
    // 무대 밖으로 밀려나지 않게 가로 위치를 안쪽으로 묶는다.
    const centerMm = item.x + CONTRACT[item.asset].realSizeMm / 2;
    tipEl.style.left = `${clamp(xPct(centerMm), 12, 88)}%`;
    // 위쪽에 있는 물건은 말풍선을 아래로 — 위로 띄우면 실험대 밖으로 나간다.
    const below = yPct(item.y) < 26;
    tipEl.dataset.below = String(below);
    tipEl.style.top = `${yPct(below ? item.y + heightMm(item.asset) : item.y)}%`;
    tipEl.hidden = false;
  }

  /** 닫기 예약. 새 포커스가 오면 showTip 이 취소한다. */
  let hideTimer = 0;

  function hideTip() {
    clearTimeout(hideTimer);
    hideTimer = 0;
    tipFromKeyboard = false;
    tipEl.hidden = true;
  }

  /** 키보드로 연 말풍선이 아직 살아 있는가 — 마우스가 덮으면 안 되는 상태. */
  function keyboardTipAlive() {
    return tipFromKeyboard && layer.contains(document.activeElement);
  }

  function hideTipSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      // 말풍선 **안으로** 포커스가 옮겨 갔으면 닫지 않는다.
      // 키보드로 놓으려면 Tab 해서 「여기에 놓기」 버튼으로 들어가야 하는데,
      // 그때 토큰에서 blur 가 나므로 그대로 닫으면 버튼이 눈앞에서 사라진다.
      if (tipEl.contains(document.activeElement)) return;
      hideTip();
    }, 0);
  }

  // 실험대 아무 데나 누르면 말풍선을 닫는다.
  // 마우스에는 pointerleave 가 있지만 손가락에는 없다 — 물건 밖을 눌렀을 때
  // 닫히지 않으면 말풍선이 실험대 위에 그대로 남는다.
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.token') || tipEl.contains(e.target)) return;
    hideTip();
  });

  // 말풍선 안 버튼에서 포커스가 완전히 빠져나가면 닫는다.
  tipEl.addEventListener('focusout', (e) => {
    if (tipEl.contains(e.relatedTarget) || layer.contains(e.relatedTarget)) return;
    hideTip();
  });

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
    // 손가락으로 물건을 꾹 눌러 끌면, 브라우저가 그것을 **글자를 고르려는 동작**으로 읽고
    // 돋보기와 「복사」 메뉴를 띄운다. 그러면 끌기는 그 자리에서 끊긴다.
    // touch-action:none 은 스크롤·확대만 막을 뿐 이 선택 동작은 못 막는다 — 여기서 막는다.
    e.preventDefault();
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
    // 편집 모드에서는 놓을 곳 표시가 없다. 조작이 일어나지 않으니 표시할 것도 없다.
    if (!edit) markTargets(item);
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

    if (edit) return;

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

  /**
   * **손가락으로** 탭한 시각. `pointerTapAt` 과 나눠 둔다.
   *
   * `pointerTapAt` 은 「뒤따라올 click 을 삼킨다」는 다른 일에도 쓰이고, 키보드 Enter 도
   * 그 목적으로 이 값을 찍는다. 그걸 「말풍선을 내지 말라」는 뜻으로 같이 읽으면
   * **키보드로 조작한 직후 포커스가 돌아와도 놓을 곳 버튼이 안 나온다** — 키보드로 쓰는
   * 사람은 한 번 조작하고 나면 다음 조작을 못 한다. 실제로 그렇게 깨뜨렸다.
   *
   * 포커스 말풍선이 막아야 하는 것은 **손가락 탭 직후** 하나뿐이다. 손가락으로 눌러도
   * <button> 은 포커스를 받는데, 그때 이 말풍선을 띄우면 누를 때마다 떠서 안 사라진다.
   */
  let fingerTapAt = 0;

  /** 탭(포인터로 움직임 없이 누르고 뗌) 또는 키보드 활성화(Enter/Space) 로 여는 동작. */
  function handleTap(item, el) {
    // 편집 모드에서 확대 뷰가 열리면 옮기던 흐름이 끊긴다. 자리만 옮기는 모드다.
    if (edit) return;
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
      if (e.pointerType !== 'mouse') fingerTapAt = performance.now();
      handleTap(item, el);
      renderTokens();
      return;
    }

    // 편집 모드 — 조작은 일어나지 않고, 놓은 자리에 그대로 남는다.
    if (edit) {
      snapToLine(item);
      item.homeX = item.x;
      item.homeY = item.y;
      drag = null;
      renderTokens();
      renderEditPanel();
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
      // 그림이 손가락보다 작으면 여백까지 잡을 수 있게 표시해 둔다 (`.token[data-small]`).
      // 화면 폭을 모르는 자리라 mm 로 잰다 — 44 px 는 실험대 1500 mm 를 화면 폭으로 나눈 값이다.
      if (drawnBoxMm(item.asset).w < MIN_HIT_PX * pxToMm()) el.dataset.small = 'true';
      el.setAttribute('aria-label', item.label);
      el.setAttribute('aria-describedby', 'bench-tip');
      el.innerHTML = ASSETS[item.asset].render(assetState(item));
      // 이름표는 **그림 아래**에 붙는다. 프레임 아래가 아니다 — 애셋마다 여백이 달라서
      // 프레임 기준으로 달면 어떤 것은 물건에 붙고 어떤 것은 한참 떨어진다.
      const c = CONTENT_BOX[item.asset];
      const [, , vw, vh] = CONTRACT[item.asset].viewBox.split(/\s+/).map(Number);
      el.insertAdjacentHTML('beforeend',
        `<i class="token-name" style="left:${((c.x0 + c.x1) / 2 / vw) * 100}%;`
        + `top:${(c.y1 / vh) * 100}%">${UI.bench.shortNames[item.labelKey] ?? item.label}</i>`);
      // 스크린샷 한 장으로 자리를 읽을 수 있어야 한다. 물건마다 x(mm)를 달아 둔다.
      if (edit) el.insertAdjacentHTML('beforeend', `<i class="edit-x-tag">${Math.round(item.x)}</i>`);

      el.addEventListener('pointerdown', (e) => onPointerDown(e, item, el));
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);

      // 말풍선은 **마우스로 올렸을 때만** 뜬다.
      //
      // 손가락에는 hover 가 없다. 그런데 브라우저는 터치에도 pointerenter 를 한 번 쏘므로,
      // 이걸 그대로 받으면 스마트폰에서 물건을 누를 때마다 말풍선이 떴다가
      // 화면 어딘가를 다시 누를 때까지 남아 실험대를 가린다. 실제로 그랬다.
      //
      // **키보드로 연 말풍선은 마우스가 덮지 않는다.** 마우스를 못 쓰는 사람에게는
      // 그 말풍선의 「여기에 놓기」 버튼이 물건을 옮기는 길의 전부다.
      //
      // pointerenter 가 특히 안 보이는 자리였다. 조작하면 실험대가 통째로 다시 그려지는데,
      // **가만히 있던 포인터 밑에 새 물건이 들어서면 브라우저가 pointerenter 를 다시 쏜다.**
      // 마우스는 움직인 적이 없는데도 키보드로 열어 둔 버튼들이 사라졌다.
      // (화면 검사가 여섯 번에 두세 번 실패했고, 멈춘 순간을 찍으니 포커스는 핀셋인데
      //  말풍선은 비커 것이고 놓기 버튼이 0개였다)
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (keyboardTipAlive()) return;
        showTip(item);
      });
      el.addEventListener('pointerleave', () => {
        if (keyboardTipAlive()) return;
        hideTip();
      });
      // 포커스로 뜬 말풍선에는 **놓을 곳 버튼**이 함께 나온다 — 키보드로 놓는 길이다.
      //
      // 앞서는 `:focus-visible` 로 걸렀다. 뜻은 맞지만 그것은 **브라우저가 「지금 키보드를
      // 쓰는 중인가」를 어림잡는 값**이라, 마우스를 한 번 쓰고 나면 뒤이은 `element.focus()`
      // 를 키보드로 안 쳐 준다 — **보조기기가 focus() 로 물건을 짚으면 버튼이 안 나왔다.**
      // 막으려던 것은 「손가락 탭 직후」 하나뿐이고 그건 이미 pointerTapAt 이 재고 있다.
      el.addEventListener('focus', () => {
        // **손가락 탭 직후에만** 참는다. 키보드 Enter 는 참지 않는다 —
        // 참으면 키보드로 한 번 조작한 뒤 놓을 곳 버튼이 다시 안 나온다.
        if (performance.now() - fingerTapAt < POINTER_TAP_GRACE_MS) return;
        showTip(item, true);
      });
      // 포커스가 옮겨 갈 때 blur 가 focus 보다 먼저 온다. 여기서 곧바로 닫으면
      // 옆 물건으로 Tab 한 순간 말풍선이 닫혔다가 다시 열리며 서로를 지운다.
      // 닫기를 한 프레임 미루고, 그 사이 새 포커스가 오면 취소한다.
      el.addEventListener('blur', () => hideTipSoon());

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
    layoutNames();
    if (focusedId) layer.querySelector(`[data-id="${focusedId}"]`)?.focus();
  }

  /**
   * 이름표가 서로 겹치면 아래 줄로 내린다.
   *
   * 물건 사이가 좁으면 이름표끼리 부딪혀 글자가 겹쳐 읽을 수 없게 된다.
   * 배치는 사람이 편집 모드에서 정하는 것이라 어떤 간격이 올지 여기서는 알 수 없다 —
   * 그러니 배치를 제한하지 말고, 부딪히는 것만 한 줄 내린다.
   * 왼쪽부터 훑으며 줄마다 "지금까지 찬 오른쪽 끝"을 기억해 첫 빈 줄에 앉힌다.
   */
  const NAME_ROW_PX = 15;   // index.html 의 .token-name 이 한 줄에 내려가는 거리와 같아야 한다
  const NAME_GAP_PX = 4;

  function layoutNames() {
    const names = [...layer.querySelectorAll('.token-name')];
    if (names.length === 0) return;
    for (const n of names) n.style.removeProperty('--name-row');
    // 선반 이름표와 작업면 이름표는 서로 부딪힐 일이 없다. 가로만 보고 밀면
    // 한참 위아래로 떨어진 둘을 겹친 것으로 치고 애먼 이름표를 내려 보낸다 — 실제로 그랬다.
    // 가로·세로를 함께 본다.
    const placed = [];
    const sorted = names
      .map((n) => ({ el: n, r: n.getBoundingClientRect() }))
      .sort((a, b) => a.r.left - b.r.left);
    for (const { el, r } of sorted) {
      let row = 0;
      const clash = (dy) => placed.some((p) =>
        r.left < p.right + NAME_GAP_PX && r.right + NAME_GAP_PX > p.left
        && r.top + dy < p.bottom && r.bottom + dy > p.top);
      while (clash(row * NAME_ROW_PX)) row++;
      const dy = row * NAME_ROW_PX;
      placed.push({ left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy });
      if (row > 0) el.style.setProperty('--name-row', row);
    }
  }

  /**
   * 실험대는 탐구 노트를 읽기 전에는 열리지 않는다.
   *
   * 이것은 **조작을 막는 것이 아니다.** 조작이 시작되기 전, 무엇을 하려는 실험인지
   * 읽는 자리를 만드는 것이다 — 열린 뒤로는 어떤 조작도 막지 않는다 (AGENTS.md §2.1).
   * 앞서는 실험대와 탐구 노트가 따로 놀아서, 노트를 한 번도 열지 않고 물건부터 끄는
   * 학생이 대부분이었다.
   *
   * 배치 편집 모드(`?edit=1`)는 자물쇠를 걸지 않는다 — 거기는 학생 화면이 아니다.
   */
  function lockState() {
    if (edit) return { locked: false, left: [] };
    const read = store.getState().session.readStages ?? [];
    const left = UI.bench.lock.required.filter((id) => !read.includes(id));
    return { locked: left.length > 0, left };
  }

  const lockEl = root.querySelector('#bench-lock');

  function renderLock() {
    const { locked, left } = lockState();
    lockEl.hidden = !locked;
    root.classList.toggle('bench--locked', locked);
    if (!locked) return;
    const titleOf = (id) => UI.notebook.stages.find((st) => st.id === id)?.title ?? id;
    root.querySelector('#bench-lock-left').innerHTML =
      left.map((id) => `<li>${id}. ${titleOf(id)}</li>`).join('');
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
  store.subscribe(() => { renderBar(); renderLock(); if (!drag) renderTokens(); });
  renderTokens();
  renderBar();
  renderLock();
  renderEditPanel();
}
