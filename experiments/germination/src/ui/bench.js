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
import { chamberView } from '../sim/state.js';
import { chamberAssetState } from '../render/chamber.js';
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
  /*
   * **선 위가 아닌 자리.** 배치 편집 모드에서 자유롭게 놓은 것이 이 모양으로 나온다.
   * `bottom` 은 배치 코드가 읽는 값이라 함께 낸다 — 이제 「붙인 선」이 아니라 바닥 높이다.
   */
  const at = (x, y, rest) => ({ x, y, bottom: y + heightMm(rest.asset), ...rest });
  void at;   // 기본 배치는 아직 두 선 위에 있다. 편집 모드가 내는 코드가 이것을 쓴다.
  const I = UI.bench.items;
  return [
    // 상단 선반 — 꺼내 쓰는 것들.
    // 콩 통 둘을 **나란히** 둔다. 이 실험에서 학생이 고르는 것은 이 둘 중 하나이므로,
    // 떨어져 있으면 「고른다」가 아니라 「찾는다」가 된다.
    shelf(300, { id: 'jarSprout', asset: 'beanjar', kind: 'beanjar', beans: 'sprout', labelKey: 'jarSprout' }),
    shelf(420, { id: 'jarDry', asset: 'beanjar', kind: 'beanjar', beans: 'dry', labelKey: 'jarDry' }),
    shelf(560, { id: 'scoop', asset: 'scoop', kind: 'scoop', labelKey: 'scoop' }),
    shelf(760, { id: 'bottleBTB', asset: 'bottle', kind: 'bottle', reagent: 'BTB', labelKey: 'bottleBTB' }),
    // 센서 둘. 챔버와 **같은 순서**(왼쪽 것이 왼쪽)로 둔다 — 순서가 어긋나면
    // 학생이 어느 센서를 어느 챔버에 꽂는지 매번 확인해야 한다.
    shelf(900, { id: 'sensorL', asset: 'sensor', kind: 'sensor', chamber: 'L', labelKey: 'sensorL' }),
    shelf(1000, { id: 'sensorR', asset: 'sensor', kind: 'sensor', chamber: 'R', labelKey: 'sensorR' }),

    // 작업면 — 챔버 둘을 **가운데 나란히**. 견주는 것이 이 실험의 전부라, 둘이 멀리
    // 떨어져 있으면 한 화면에서 나란히 보는 일 자체가 안 된다.
    surface(520, { id: 'chamberL', asset: 'chamber', kind: 'chamber', chamber: 'L', labelKey: 'chamberL' }),
    surface(760, { id: 'chamberR', asset: 'chamber', kind: 'chamber', chamber: 'R', labelKey: 'chamberR' }),
    surface(60, { id: 'sink', asset: 'sink', kind: 'sink', labelKey: 'sink' }),
    surface(1010, { id: 'tissue', asset: 'tissue', kind: 'tissue', labelKey: 'tissue' }),
    surface(1180, { id: 'waste', asset: 'waste', kind: 'waste', labelKey: 'waste' }),
    surface(1320, { id: 'bin', asset: 'bin', kind: 'bin', labelKey: 'bin' }),
    // 이름은 키로만 적어 둔다. 편집 모드가 배치를 다시 코드로 뱉을 때
    // `label: I.scoop` 을 되살리려면 어느 키였는지를 알아야 한다.
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
    scoop: {
      // 어느 통에 댔는지가 곧 어느 콩인지다.
      beanjar: (item, target) => store.dispatch('SCOOP_BEANS', { kind: target.beans }),
      chamber: (item, target) => store.dispatch('POUR_BEANS', { chamber: target.chamber }),
    },
    bottle: {
      chamber: (item, target) => store.dispatch('POUR_BTB', { chamber: target.chamber }),
    },
    sensor: {
      /**
       * 센서를 챔버에 꽂으면 **확대 뷰가 열린다.**
       *
       * 깊이는 손끝으로 정하는 값이라 실험대에서 끌어다 대는 것으로는 정할 수 없다.
       * 실험대는 큰 동작, 확대 뷰는 손끝 동작이다.
       */
      chamber: (item, target) => {
        store.dispatch('INSTALL_SENSOR', { chamber: target.chamber });
        openZoom(target.chamber);
      },
    },
    tissue: {
      // 콩 부스러기가 묻은 센서를 닦는다. 파묻었다 뺐을 때 돌아오는 길이다.
      sensor: (item, target) => store.dispatch('WIPE_SENSOR', { chamber: target.chamber }),
    },
    chamber: {
      // 비우고 처음부터. **막다른 길을 없애는 유일한 길이다.**
      sink: (item) => store.dispatch('EMPTY_CHAMBER', { chamber: item.chamber }),
    },
  };
}

/**
 * 물건을 클릭(또는 Enter/Space)했을 때.
 *
 * **누르면 본다, 끌면 옮긴다, 단추로 한다** (docs/09-uniformity.md §2).
 * 눌러서 상태가 바뀌는 물건은 하나도 없다 — 모든 물건이 누르면 자기 화면을 연다.
 * 실험대에서 상태를 바꾸는 손짓은 끌어다 놓기(`dropTable`)뿐이고, 손끝 조작(센서 깊이·
 * 뚜껑·측정)은 챔버 화면 안의 손잡이와 단추다.
 *
 * ── 안전 수칙 조작을 걷어내면서 생긴 자리 ──────────────────────────
 * 앞서는 BTB 병·폐액통·휴지를 누르면 「마개를 닫았다」·「폐액을 버렸다」·「손을 씻었다」가
 * 기록되고, 자기 평가에서 지켰는지 세었다. 그것을 전부 걷어냈다 — 그러면 평가되는 것이
 * 안전 습관이 아니라 **화면 속 단추를 눌렀다는 사실**이기 때문이다.
 * 그 뒤 한동안 폐액통·쓰레기통은 누르면 알림(`NOTE_PRACTICE`)만 띄웠다. 이제 그 말은
 * 물건 화면의 덧붙일 말이다 — 누르는 것으로 dispatch 가 일어나는 물건은 없다.
 *
 * `onOpenZoom(mode, id, el)` — `chamber` 면 id 는 'L'|'R', `item` 이면 실험대 물건 id.
 */
export function tapTable(store, onOpenZoom) {
  void store;   // 표의 모양을 다른 일곱과 맞춘다 — 누르는 것만으로는 아무것도 dispatch 하지 않는다.
  const view = (item, el) => onOpenZoom('item', item.id, el);
  return {
    // 챔버를 누르면 크게 본다. **결과를 보는 곳이자 뚜껑·측정·센서 깊이를 다루는 곳**이다.
    chamber: (item, el) => onOpenZoom('chamber', item.chamber, el),
    // 센서는 자기 화면 — 어디에 꽂혀 있나, 끝이 더러운가. 꽂힌 센서는 챔버 화면에서 뺀다.
    sensor: view,
    beanjar: view, scoop: view, bottle: view,
    sink: view, tissue: view, waste: view, bin: view,
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
  'chamber', 'sensor', 'beanjar', 'scoop', 'bottle', 'sink', 'tissue', 'waste', 'bin',
];

/**
 * 배치를 다시 코드로 뱉는다 — 편집 모드에서 옮긴 자리를 그대로 `defaultItems()` 에 붙여 넣는다.
 *
 * 눈으로 옮긴 것을 손으로 숫자로 옮겨 적는 일은 반드시 어딘가 틀린다.
 * 옮긴 사람이 스크린샷만 보내면 되도록, 화면이 스스로 좌표를 말하게 한다.
 */
function layoutCode(items) {
  const lines = items.map((it) => {
    /*
     * **선에 딱 맞을 때만 선 이름으로 적는다.**
     *
     * 앞서는 「가장 가까운 선」으로 적었다. 그래서 자유롭게 놓아도 **붙여 넣는 순간
     * 선으로 되돌아갔다** — 화면에서는 옮겨 놓고 코드로는 안 옮겨진 셈이라, 배치를
     * 정하는 사람이 같은 일을 몇 번이고 다시 하게 된다. 실제로 70 px 내린 것이
     * `surface(...)` 로 적혀 사라졌다.
     * 선 위가 아니면 `at(x, y)` 로 **놓은 자리를 그대로** 적는다.
     * (osmosis 세션이 찾았다)
     */
    const onShelf = Math.abs(it.bottom - SHELF_MM) < 1;
    const onSurface = Math.abs(it.bottom - SURFACE_MM) < 1;
    const fn = onShelf ? 'shelf' : (onSurface ? 'surface' : 'at');
    const props = [
      `id: '${it.id}'`,
      `asset: '${it.asset}'`,
      `kind: '${it.kind}'`,
      it.chamber ? `chamber: '${it.chamber}'` : null,
      it.beans ? `beans: '${it.beans}'` : null,
      it.reagent ? `reagent: '${it.reagent}'` : null,
      `labelKey: '${it.labelKey}'`,
    ].filter(Boolean).join(', ');
    const where = fn === 'at'
      ? `${Math.round(it.x)}, ${Math.round(it.y)}` : `${Math.round(it.x)}`;
    return `    ${fn}(${where}, { ${props} }),`;
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
      <span id="bench-clock" class="bench-clock" role="status" aria-live="polite" hidden></span>
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
  const stageEl = root.querySelector('.bench-stage');
  const tipEl = root.querySelector('.bench-tip');
  const clockEl = root.querySelector('#bench-clock');

  root.querySelector('#undo').addEventListener('click', () => store.dispatch('UNDO', {}));

  const DROPS = dropTable(store, (id) => onOpenZoom('chamber', id, elFor(`chamber${id}`)));

  const TAPS = tapTable(store, onOpenZoom);

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let drag = null;

  /* ---------------- 편집 모드 ---------------- */

  /**
   * **놓은 자리에 그대로 둔다.** 실험대 밖으로만 안 나가게 잡아 준다.
   *
   * 앞서는 선반 선과 작업면 선 중 가까운 쪽에 바닥을 딱 붙였다. 그러면 **놓을 수 있는
   * 자리를 앱이 정해 버린다** — 배치를 정하는 사람은 교실에서 쓰는 선생님이고,
   * 미세하게 옮기고 싶어도 손이 놓은 자리에서 튕겨 나갔다.
   * (사장님 지시 — 「가능한 포지션을 정해 두지 마라」)
   */
  function placeFreely(item) {
    const h = heightMm(item.asset);
    item.x = clamp(item.x, 0, STAGE_W_MM - CONTRACT[item.asset].realSizeMm);
    item.y = clamp(item.y, 0, STAGE_H_MM - h);
    // `bottom` 은 배치 코드가 읽는 값이라 계속 낸다 — 이제 「붙인 선」이 아니라 **바닥 높이**다.
    item.bottom = item.y + h;
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

  /**
   * 좌표 입력칸 하나. **끌어서도, 숫자로도 옮길 수 있어야 한다** (사장님 지시 2026-09-03).
   *
   * 끌기만 되면 1 mm 를 맞추려고 화면을 확대했다 줄였다 하게 된다. 숫자를 직접 치거나
   * 위·아래 화살표로 1 mm 씩 미는 길을 함께 둔다 — y 도 x 와 똑같이.
   * 이름표는 `x`·`y` 와 단위뿐이라 문자열 파일로 뺄 말이 없다.
   */
  function numCell(it, axis) {
    return `<input type="number" class="edit-num" data-axis="${axis}" step="1"
      value="${Math.round(it[axis])}" aria-label="${it.id} ${axis} (mm)"
      style="width:5.2em;font:inherit;text-align:right;padding:1px 4px;border:1px solid currentColor;
             border-radius:4px;background:transparent;color:inherit">`;
  }

  function renderEditPanel() {
    if (!edit) return;
    const bad = overlaps();
    root.querySelector('#edit-rows').innerHTML = items.map((it) => {
      const d = drawnBoxMm(it.asset);
      return `
      <tr data-row="${it.id}">
        <td>${it.id}</td>
        <td class="edit-line"></td>
        <td class="edit-x">${numCell(it, 'x')}</td>
        <td class="edit-x">${numCell(it, 'y')}</td>
        <td class="edit-span"></td>
        <td class="edit-flag"></td>
      </tr>`;
    }).join('');
    syncEditPanel();
  }

  /** 표에 적는 선 이름. 칸을 다시 그릴 때와 값만 맞출 때가 같은 말을 해야 한다. */
  function lineLabel(it) {
    return `${Math.abs(it.bottom - SHELF_MM) < 1 ? UI.edit.shelf : UI.edit.surface}`;
  }

  /**
   * 표의 **읽는 칸**만 다시 칠한다. 입력칸은 값만 맞추되 **지금 손이 가 있는 칸은 건드리지
   * 않는다** — 타이핑 도중 값을 덮으면 커서가 튀어 두 자리 수를 칠 수가 없다.
   */
  function syncEditPanel() {
    if (!edit) return;
    const bad = overlaps();
    for (const it of items) {
      const tr = root.querySelector(`#edit-rows tr[data-row="${it.id}"]`);
      if (!tr) continue;
      const d = drawnBoxMm(it.asset);
      tr.classList.toggle('edit-bad', bad.has(it.id));
      tr.querySelector('.edit-line').textContent = lineLabel(it);
      tr.querySelector('.edit-flag').textContent = bad.has(it.id) ? UI.edit.overlap : '';
      tr.querySelector('.edit-span').textContent = `~${Math.round(it.x + d.dx + d.w)}`;
      for (const axis of ['x', 'y']) {
        const input = tr.querySelector(`input[data-axis="${axis}"]`);
        if (input && document.activeElement !== input) input.value = String(Math.round(it[axis]));
      }
    }
    root.querySelector('#edit-warn').textContent = bad.size ? UI.edit.overlapWarn(bad.size) : '';
  }

  if (edit) {
    root.querySelector('#edit-copy').addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(layoutCode(items));
      e.target.textContent = UI.edit.copied;
      setTimeout(() => { e.target.textContent = UI.edit.copy; }, 1500);
    });
    /*
     * 숫자로 옮기기. `input` 으로 듣는다 — 화살표를 누르는 순간 물건이 따라 움직여야
     * 「이만큼이 1 mm 구나」가 눈에 보인다. 값을 지우는 중(빈 칸)에는 아무 일도 하지 않는다.
     */
    root.querySelector('#edit-rows').addEventListener('input', (e) => {
      const input = e.target.closest('.edit-num');
      if (!input) return;
      const item = items.find((it) => it.id === input.closest('tr')?.dataset.row);
      const v = Number(input.value);
      if (!item || input.value.trim() === '' || !Number.isFinite(v)) return;
      item[input.dataset.axis] = v;
      placeFreely(item);
      renderTokens();
      syncEditPanel();
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

  /**
   * 애셋에 넘길 상태 한 벌.
   *
   * 챔버는 `chamberView()` → `chamberAssetState()` 를 그대로 거친다.
   * **결과 화면과 같은 통로다** — 여기서 따로 만들면 상태를 하나 더할 때
   * 실험대의 작은 그림과 확대 뷰의 큰 그림이 다른 것을 보여 준다.
   */
  function assetState(item) {
    const st = store.getState();
    switch (item.kind) {
      case 'chamber':
        return chamberAssetState(chamberView(st.chambers[item.chamber]));
      case 'sensor': {
        const ch = st.chambers[item.chamber];
        return { on: ch.running, fouled: ch.sensorFouled };
      }
      case 'beanjar':
        return { kind: item.beans, level: 0.8 };
      case 'scoop':
        return { holds: st.scoop.holds };
      case 'bottle':
        return { kind: item.reagent, level: 0.7 };
      case 'waste':
        return { level: 0.2 };
      default:
        return {};
    }
  }

  /**
   * 챔버에 꽂힌 센서는 선반에서 사라진다 — 그 자리에 있으니까.
   *
   * 콩 통과 BTB 병은 사라지지 않는다. 몇 숟갈이든 꺼내 쓰는 물건이고,
   * 세다가 바닥나면 그건 결과가 아니라 그냥 막다른 길이다.
   */
  function isHidden(item) {
    return item.kind === 'sensor' && store.getState().chambers[item.chamber].sensorIn;
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
    return {
      left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2,
      // **그려진 부분**도 함께 돌려준다. 겹쳤을 때 누가 이기는지는 넓힌 자리가 아니라
      // 그림까지의 거리로 가른다 (`distTo`).
      drawn: { left, right: left + dw, top, bottom: top + dh },
    };
  }

  /**
   * 그 점이 **그림에서** 얼마나 떨어져 있는가. 그림 안이면 0.
   *
   * 앞서는 **그림 한가운데까지의 거리**로 갈랐다. 그러면 **크거나 긴 그림이 불리하다** —
   * 자기 가장자리가 자기 한가운데보다 옆 물건의 한가운데에 더 가깝기 때문이다.
   * 바나나랩은 개수대(100×75) 그림 위의 68점이 폐액통·휴지에게 갔고, centrifuge 는
   * 27×7 px 자에서 같은 일을 찾았다.
   *
   * **이 저장소에서는 그 버그가 없었다.** 320·420·768·1400 px 에서 그림 안 1 px 격자를
   * 전부 훑어(4만 1천 점) 두 규칙이 갈리는 점이 **0점**이었다 — 여기 물건은 가장 큰
   * 개수대가 320 px 에서 38×40 이고 크기가 고만고만해서, 한가운데로 재도 남에게 안 간다.
   * 그래도 여덟 저장소가 같은 계보라 규칙을 맞춰 둔다. **지금 무엇을 고친 것이 아니라,
   * 배치를 옮겨 큰 그림이 이웃에 닿았을 때 조용히 새지 않게 하는 것이다.**
   */
  function distTo(rect, x, y) {
    const d = rect.drawn ?? rect;
    const dx = Math.max(d.left - x, 0, x - d.right);
    const dy = Math.max(d.top - y, 0, y - d.bottom);
    return dx * dx + dy * dy;
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

  /**
   * 끄는 물건의 **그림** 중심 아래 있는 것. 프레임 중심은 그림 밖일 수 있다.
   *
   * ── 겹칠 때 무엇을 고르는가 ────────────────────────────────────
   * `hitRect` 는 그림이 손가락보다 작으면 `MIN_HIT_PX`(44) 까지 넓혀 준다. 데스크톱에서는
   * 물건들이 충분히 떨어져 있어 넓혀도 안 겹치는데, **폰에서는 물건 자체가 5~50 px 이라
   * 넓힌 사각형들이 서로 포개진다** — 420 px 에서 재어 보니 여섯 짝, 320 px 에서 일곱 짝이
   * 겹쳤다.
   *
   * 앞서는 **목록에서 먼저 오는 것**을 골랐다. 그래서 콩 통 둘이 겹치는 띠에서는
   * **마른 콩 통 쪽에 더 가까이 대어도 언제나 발아 콩 통이 받았다.** 재어 보니 그 띠가
   * 12 px 이었다. 이것은 「아무 일도 안 일어난다」보다 나쁘다 — **다른 콩이 담기고 말은
   * 맞게 나온다.** 두 챔버에 같은 콩이 들어간 채로 실험이 끝나고, 그 순간 이 실험이
   * 가르치려던 것(무엇을 같게 두어야 하는가)이 통째로 사라진다.
   *
   * 이제 **그림까지의 거리가 가장 가까운 것**(그림 안이면 0)이 이긴다. 안 겹치는 화면에서는
   * 후보가 하나뿐이라 아무것도 달라지지 않는다.
   *
   * **받는 물건을 골라 주지는 않는다.** 「이 물건을 받아 줄 수 있는 것」만 후보로 두면
   * 개수대를 겨눴을 때 옆의 휴지가 잡혀 엉뚱한 일이 일어난다. 겨눈 것이 답해야 한다 —
   * 못 받는 것을 겨눴으면 못 받는다는 말을 듣는 것이 옳다 (docs/04-interaction-rules.md).
   */
  function targetUnder() {
    const g = hitRect(drag.el, drag.item.asset);
    const cx = (g.left + g.right) / 2;
    const cy = (g.top + g.bottom) / 2;
    let best = null;
    let bestDist = Infinity;
    for (const other of items) {
      const or_ = drag.rects.get(other.id);
      if (!or_) continue;
      if (cx < or_.left || cx > or_.right || cy < or_.top || cy > or_.bottom) continue;
      const dist = distTo(or_, cx, cy);
      // 거리가 같으면 **나중에 그려진 것** — 위에 보이는 것이 받는다. `items` 는 그린 차례다.
      if (dist <= bestDist) { bestDist = dist; best = other; }
    }
    return best;
  }

  /**
   * 이 자리에서 **정말로 집으려던 물건**은 무엇인가.
   *
   * `.token::after` 가 손가락에 잡히도록 그림을 `MIN_HIT_PX`(44) 까지 넓혀 준다.
   * 그 넓힌 자리가 폰에서 서로 포개지면, **DOM 에서 나중에 그려진 것**이 이벤트를 가져간다.
   * 320 px 에서 재어 보니 **센서 둘이 서로의 한가운데를 먹고 있었다** — 왼쪽 센서 그림
   * 정중앙을 눌러도 오른쪽 센서가 집혔다. 그것을 왼쪽 챔버로 끌면 오른쪽 센서가 왼쪽
   * 챔버에 꽂힌다. 화면은 아무 말도 하지 않는다.
   *
   * 그래서 **그림까지의 거리가 가장 가까운 것**(`distTo`)으로 바꿔 준다. 겹치지 않는
   * 화면에서는 자기 자신이 뽑히므로 아무것도 달라지지 않는다.
   */
  function aimedAt(e, item) {
    let best = item;
    let bestDist = Infinity;
    for (const other of items) {
      if (isHidden(other)) continue;
      const oe = elFor(other.id);
      if (!oe) continue;
      const r = hitRect(oe, other.asset);
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const d = distTo(r, e.clientX, e.clientY);
      // **거리가 같으면 나중에 그려진 것이 이긴다.** 그림끼리 진짜로 겹치는 자리에서는
      // 둘 다 거리 0 이 되는데, 그때 앞선 것을 고르면 **눈에 보이는 것 뒤에 있는 것**이
      // 집힌다. 학생은 보이는 것을 겨눈다. `items` 는 그린 차례라 뒤가 위다.
      if (d <= bestDist) { bestDist = d; best = other; }
    }
    return best;
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
   * 이 실험에서 손짓이 정하는 값은 **센서 깊이 하나뿐**이고 그것은 확대 뷰에서 정하므로,
   * 끌어다 놓는 조작은 마우스로 하는 것과 키보드로 하는 것이 **완전히 같다.**
   */

  function dropTargetsFor(item) {
    const accepts = DROPS[item.kind] ?? {};
    return items.filter((o) => o.id !== item.id && !isHidden(o) && accepts[o.kind]);
  }

  function runDrop(item, target) {
    const run = DROPS[item.kind]?.[target.kind];
    if (!run) return;
    // 이 실험에서 손짓이 정하는 값은 **센서 깊이 하나뿐**이고, 그것은 확대 뷰에서
    // 정한다. 그래서 끌어다 놓는 조작에는 키보드로 못 정하는 값이 없다 —
    // 마우스로 하는 것과 키보드로 하는 것이 완전히 같다.
    run(item, target, { lastDx: 0, lastDy: 0 });
    renderTokens();
    // 놓고 나면 그 물건으로 포커스를 돌려준다. 그러지 않으면 포커스가 <body> 로 빠져
    // 키보드로 쓰는 사람은 매번 처음부터 Tab 해서 돌아와야 한다.
    // focus() 가 focus 이벤트를 쏘고, 그 핸들러가 말풍선을 다시 낸다 — 여기서 또 부르지 않는다.
    // 놓은 물건이 화면에서 사라졌으면(재물대에 올라간 받침 유리) **놓은 자리**로 옮긴다.
    // 그냥 두면 포커스가 <body> 로 빠져, 키보드로 쓰는 사람은 처음부터 Tab 해 돌아와야 한다.
    (elFor(item.id) ?? elFor(target.id))?.focus();
  }

  function showTip(item, withActions = false) {
    if (drag) return;
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
    // 지금 누구를 말하고 있는지 남겨 둔다. `pointermove` 마다 다시 그리지 않으려면
    // 「이미 그 이름을 말하는 중인가」를 알아야 한다.
    tipEl.dataset.for = item.id;
    // 단추가 붙어 나갔으면 키보드로 뜬 것이다. 마우스가 지나간다고 지우면 안 된다.
    tipFromKeyboard = targets.length > 0;
    /**
     * 말풍선을 **포커스한 물건 바로 뒤로 옮긴다.**
     *
     * 안 옮기면 Tab 이 말풍선의 「여기에 놓기」로 안 들어간다 — 말풍선은 물건 층
     * 바깥(문서 순서로 모든 물건 뒤)에 있어서, 물건에서 Tab 하면 **옆 물건으로 튄다.**
     * 그러면 키보드로 쓰는 사람은 단추가 보이는데 닿을 수가 없다 —
     * 보이는 것과 쓸 수 있는 것이 어긋나는 자리다.
     *
     * `.bench-tokens` 는 `.bench-stage` 에 `inset:0` 으로 겹쳐 있으므로 % 좌표는 그대로다.
     * 다시 그릴 때 `layer.innerHTML = ''` 이 말풍선을 지워 버리므로,
     * `renderTokens()` 가 먼저 무대로 꺼내 둔다.
     */
    const own = elFor(item.id);
    // 다시 그리는 도중이면 붙잡아 둔 물건이 이미 문서에서 떨어져 나갔을 수 있다.
    // 떨어져 나간 것 뒤에 끼우면 말풍선까지 함께 사라진다 — 지금 층에 붙어 있을 때만 옮긴다.
    if (targets.length && own && own.parentNode === layer) own.after(tipEl);
    else parkTip();

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

  /**
   * 말풍선을 무대 바로 밑(제자리)으로 되돌린다.
   *
   * 물건 층 안에 끼워 둔 채로 두면 다시 그릴 때 `layer.innerHTML = ''` 에 함께 지워진다.
   * 이미 제자리면 아무것도 하지 않는다 — 옮기는 것 자체가 포커스를 흔들기 때문이다.
   */
  /**
   * 옮기는 중에 **또 옮기라는 요청이 들어온다.**
   *
   * 말풍선을 떼는 순간 그 안에 있던 단추가 포커스를 잃고, `focusout` 핸들러가
   * 그 자리에서 `hideTip()` → `parkTip()` 을 부른다. 안쪽이 먼저 옮겨 버리면
   * 바깥쪽이 「이 노드는 더 이상 자식이 아니다」로 터진다 — 실제로 그랬고,
   * 화면에는 아무 표시도 안 났다(콘솔에만 났다).
   *
   * 옮기는 동안에는 두 번째 요청을 흘려보낸다.
   */
  let parking = false;

  function parkTip() {
    if (parking || tipEl.parentNode === stageEl) return;
    parking = true;
    try {
      tipEl.remove();
      stageEl.appendChild(tipEl);
    } finally {
      parking = false;
    }
  }

  /** 닫기 예약. 새 포커스가 오면 showTip 이 취소한다. */
  let hideTimer = 0;

  /**
   * 지금 말풍선이 **키보드로** 뜬 것인가 — 「여기에 놓기」 단추가 붙은 그것.
   *
   * 그 단추는 마우스 없이 놓는 **유일한 길**이라, 마우스가 근처를 지난다고 사라지면
   * 키보드로 쓰는 사람은 단추가 보이는데 닿을 수가 없다. 포커스가 물건 층을 떠나면
   * 저절로 거짓이 된다 — 따로 끄지 않아도 된다.
   */
  let tipFromKeyboard = false;
  const keyboardTipAlive = () => tipFromKeyboard && layer.contains(document.activeElement);

  function hideTip() {
    clearTimeout(hideTimer);
    hideTimer = 0;
    tipFromKeyboard = false;
    tipEl.hidden = true;
    parkTip();
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

  function onPointerDown(e, item, el) {
    if (e.button !== undefined && e.button !== 0) return;
    // 넓힌 자리가 겹쳤으면 **겨눈 것**으로 바꾼다.
    const aimed = aimedAt(e, item);
    if (aimed.id !== item.id) {
      const ael = elFor(aimed.id);
      if (ael) { item = aimed; el = ael; }
    }
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
    clearMarks();

    if (!moved) {
      // 움직이지 않았다면 조작이 아니라 탭이다.
      drag = null;
      pointerTapAt = performance.now();
      handleTap(item, el);
      renderTokens();
      return;
    }

    // 편집 모드 — 조작은 일어나지 않고, 놓은 자리에 그대로 남는다.
    if (edit) {
      placeFreely(item);
      item.homeX = item.x;
      item.homeY = item.y;
      drag = null;
      renderTokens();
      renderEditPanel();
      return;
    }

    const target = targetUnder();
    const run = target ? DROPS[item.kind]?.[target.kind] : null;
    if (run) run(item, target, { lastDx: drag.lastDx, lastDy: drag.lastDy });

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
    // 말풍선이 물건 층 안에 들어가 있을 수 있다 (showTip 참조). 지워지지 않게 먼저 꺼낸다.
    parkTip();
    layer.innerHTML = '';
    for (const item of items) {
      if (isHidden(item)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `token token--${item.kind}`;
      el.dataset.id = item.id;
      if (item.chamber) el.dataset.chamber = item.chamber;
      el.dataset.tool = item.asset;
      // 챔버를 누르면 그 챔버의 확대 뷰가 열린다 — 검사 스크립트가 이 표시를 찾는다.
      // (센서는 자기 물건 화면이 열린다. 꽂으면 챔버 화면이 열린다 — `dropTable`.)
      if (item.kind === 'chamber') el.dataset.zoom = item.chamber;
      // 크기와 위치를 전부 무대 비율로 낸다. 배경 애셋과 같은 자로 재어지므로
      // 창 크기가 바뀌어도 realSizeMm 비례와 배경 위 자리가 함께 유지된다.
      el.style.left = `${xPct(item.x)}%`;
      el.style.top = `${yPct(item.y)}%`;
      el.style.width = `${widthPct(item.asset)}%`;
      // 그림이 손가락보다 작으면 여백까지 잡을 수 있게 표시해 둔다 (`.token[data-small]`).
      // 화면 폭을 모르는 자리라 mm 로 잰다 — 44 px 는 실험대 1500 mm 를 화면 폭으로 나눈 값이다.
      //
      // **가로만 재면 안 된다.** 숟가락은 넓적하고 납작해서 폭은 58 px 인데 높이가 28 px 이라,
      // 가로만 보고 「크다」로 판정하면 손가락으로는 잡히지 않는다.
      // 잡히는 것은 **짧은 쪽**이 정한다.
      const drawn = drawnBoxMm(item.asset);
      if (Math.min(drawn.w, drawn.h) < MIN_HIT_PX * pxToMm()) el.dataset.small = 'true';
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
      if (edit) el.insertAdjacentHTML('beforeend', `<i class="edit-x-tag">${Math.round(item.x)}, ${Math.round(item.y)}</i>`);

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
      // **집는 것만 고치면 이름과 손이 다른 것을 가리킨다.** 넓힌 자리가 겹친 곳에서는
      // 브라우저가 사건을 주는 물건(`item`)과 `aimedAt` 이 고르는 물건이 다를 수 있다.
      // 그러면 「폐액통」이라 적힌 말풍선을 보고 눌렀는데 **휴지가 끌린다.**
      // 재어 보니 320 px 에서 300점 중 열여섯 점, 768 px 에서 열네 점이 그랬다.
      // 화면이 거짓말을 하는 것이고, 그건 이 저장소에서 가장 하면 안 되는 일이다.
      const hoverTip = (e) => {
        if (e.pointerType !== 'mouse') return;
        // 키보드로 뜬 말풍선은 마우스가 지나가도 그대로 둔다. 지우면 「여기에 놓기」
        // 단추가 함께 사라져, 키보드로 쓰는 사람이 그 단추에 닿을 수가 없다.
        if (keyboardTipAlive()) return;
        const aimed = aimedAt(e, item);
        // 같은 이름을 말하는 중이면 그냥 둔다. 안 그러면 마우스를 조금 움직일 때마다
        // 말풍선을 통째로 다시 그리게 된다.
        if (!tipEl.hidden && tipEl.dataset.for === aimed.id) return;
        showTip(aimed);
      };
      el.addEventListener('pointerenter', hoverTip);
      // **`pointermove` 도 들어야 한다.** 겹친 자리 **안에서** 조금만 움직여도 겨눈 것이
      // 바뀌는데, 들어올 때 한 번만 재면 그 사이 이름이 굳는다.
      // 끄는 중에는 말풍선을 안 쓰므로(showTip 이 `drag` 를 보고 되돌아간다) 그때는 넘긴다.
      el.addEventListener('pointermove', (e) => { if (!drag) hoverTip(e); });
      el.addEventListener('pointerleave', () => { if (!keyboardTipAlive()) hideTip(); });
      // 포커스로 뜬 말풍선에는 **놓을 곳 버튼**이 함께 나온다 — 키보드로 놓는 길이다.
      // :focus-visible 일 때만 낸다. 손가락으로 눌러도 <button> 은 포커스를 받는데,
      // 그때까지 이 말풍선을 띄우면 누를 때마다 떠서 안 사라지는 창이 된다.
      el.addEventListener('focus', () => { if (el.matches(':focus-visible')) showTip(item, true); });
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
   * **무대 폭이 바뀌면 이름표를 다시 앉힌다.**
   *
   * `layoutNames()` 는 다시 그릴 때만 돌았다. 그래서 **넓게 열어 두고 창을 줄이면**
   * 이름표가 그대로 남아 겹쳤다 — 재어 보니 1400 → 390 에서 두 쌍, 1400 → 320 에서
   * 다섯 쌍이었다. **처음부터 좁게 열면 안 나타난다.** 넓게 열어서 줄여야 드러난다.
   *
   * `resize` 가 아니라 `ResizeObserver` 다. 옆 칸(탐구 노트)이 늘고 줄 때도 무대 폭이
   * 바뀌는데 **그때는 `resize` 가 안 온다.** 보는 것은 창이 아니라 이 무대다.
   * (chromatography 세션이 찾았다)
   */
  if (typeof ResizeObserver !== 'undefined') {
    let lastW = 0;
    new ResizeObserver(() => {
      const w = layer.getBoundingClientRect().width;
      if (Math.abs(w - lastW) < 1) return;   // 세로만 바뀐 것에는 안 움직인다
      lastW = w;
      layoutNames();
    }).observe(layer);
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
    // 재고 있는 챔버가 있으면 몇 분째인지 늘 보인다.
    // 시간은 실제보다 빠르게 흐르므로 그 사실도 함께 밝힌다 — 안 밝히면
    // 학생이 이 속도를 실제 실험 시간으로 읽는다.
    const running = Object.values(st.chambers).filter((c) => c.running);
    clockEl.hidden = running.length === 0;
    if (running.length) {
      clockEl.textContent = UI.bench.clock(
        running.map((c) => `${UI.chambers[c.id].short} ${c.elapsedMin}분`).join(' · '));
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
