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
import { isSpinning, sampleSlot, SLOT_ITEMS, SLOTS, TUBE_KINDS } from '../sim/state.js';
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
 * 이 실험에는 **문지르는 동작이 없다.**
 *
 * 바나나랩에는 시료를 문질러 바르는 조작이 있어서, 끄는 동안 움직인 거리를 세는 장치가
 * 실험대에 붙어 있었다. 여기서는 손끝 일이 전부 확대 뷰로 갔다 (각도·누름·당김).
 * 실험대에서는 **집어 옮기는 큰 동작만** 한다 (PLAYBOOK §4).
 */

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
   * 선반·작업면 **어느 선에도 안 걸친** 자리. 편집 모드에서 높이까지 잡으면 이 꼴로 나온다.
   *
   * **둘째 인자는 「윗변」이다.** 「바닥」으로 읽으면 물건 높이만큼 어긋나는데, 화면에서는
   * 그럴듯해 보여서 안 걸린다. 아래 `.map` 이 `y = bottom - 높이` 로 되돌려 놓으므로
   * 여기서 `bottom` 을 `y + 높이` 로 두어야 **넣은 y 가 그대로 돌아온다.**
   */
  const at = (x, y, rest) => ({ x, y, bottom: y + heightMm(rest.asset), ...rest });
  void at;   // 지금 배치는 다 선 위에 있다. 편집 모드가 뱉는 코드가 이것을 쓴다.
  const I = UI.bench.items;
  return [
    // 상단 선반 — 꺼내 쓰는 것들
    shelf(455, { id: 'capbox', asset: 'capbox', kind: 'capbox', labelKey: 'capbox' }),
    shelf(620, { id: 'clay', asset: 'clay', kind: 'clay', labelKey: 'clay' }),
    shelf(740, { id: 'lancet', asset: 'lancet', kind: 'lancet', labelKey: 'lancet' }),
    shelf(840, { id: 'swab', asset: 'swab', kind: 'swab', labelKey: 'swab' }),
    shelf(930, { id: 'ruler', asset: 'ruler', kind: 'ruler', labelKey: 'ruler' }),
    // 작업면 — 손이 닿는 것들.
    // **손끝 · 모세관 · 회전판을 이 차례로 둔다.** 절차가 그 차례로 흐르기 때문이다:
    // 손끝에서 받아 → 모세관에 담아 → 회전판에 문다.
    surface(120, { id: 'finger', asset: 'finger', kind: 'finger', labelKey: 'finger' }),
    surface(300, { id: 'capillary', asset: 'capillary', kind: 'capillary', labelKey: 'capillary' }),
    surface(470, { id: 'rotor', asset: 'rotor', kind: 'rotor', labelKey: 'rotor' }),
    // 폐기물 통. **버리는 곳이 아니라 되돌리는 곳이다** — 잘못 채운 모세관을 여기 대면
    // 버리고 새것을 꺼낸다. 침 폐기함·개수대·휴지는 안전 조작을 걷어내면서 함께 뺐다:
    // 그 물건들은 오직 안전 조작에만 쓰여서, 남겨 두면 **눌러도 아무 일 없는 물건**이 된다.
    // 손상성 폐기물·손 씻기·지혈은 2쪽(준비물)에 적어 두기만 한다.
    surface(930, { id: 'bin', asset: 'bin', kind: 'bin', labelKey: 'bin' }),
    // 이름은 키로만 적어 둔다. 편집 모드가 배치를 다시 코드로 뱉을 때
    // `label: I.rotor` 를 되살리려면 어느 키였는지를 알아야 한다.
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
    // 소독솜 · 채혈침 · 휴지 → 손끝
    swab: {
      finger: () => store.dispatch('SWAB_FINGER', {}),
    },
    lancet: {
      finger: () => store.dispatch('PRICK_FINGER', {}),
    },
    // 모세관이 이 실험의 손도구다. 대는 곳마다 다른 일이 일어난다.
    capillary: {
      // 빨아올리기는 손끝 일이다 — 각도와 대고 있는 시간을 실험대에서는 못 정한다.
      finger: () => openZoom('draw'),
      // 막는 것도 손끝 일이다 — 누르는 깊이가 결과를 가른다.
      clay: () => openZoom('seal'),
      rotor: () => store.dispatch('LOAD_ROTOR', { what: SLOT_ITEMS.SAMPLE }),
      // 잘못 채운 것을 되돌리는 길 둘. 통에 대면 새것, 폐기물 통에 대면 버리고 새것.
      capbox: () => store.dispatch('NEW_CAPILLARY', {}),
      // 폐기물 통에 대면 쓰던 것을 버리고 새것을 꺼낸다. **이 통은 안전 점검이 아니라
      // 되돌리는 길이다** — 잘못 채운 모세관에서 빠져나가는 두 갈래 중 하나.
      bin: () => store.dispatch('NEW_CAPILLARY', {}),
    },
    // 자를 대면 층의 길이를 읽는다. 헤마토크릿은 **학생이** 두 길이를 나눠 구한다.
    ruler: {
      capillary: () => store.dispatch('MEASURE', {}),
    },
    // 반대쪽 빨대에 넣을 빈 모세관은 통에서 나온다.
    capbox: {
      rotor: () => store.dispatch('LOAD_ROTOR', { what: SLOT_ITEMS.COUNTER }),
    },
  };
}

/**
 * 물건을 클릭(또는 Enter/Space)했을 때. 끌어다 놓는 조작과 달리 대상이 필요 없는 것들.
 *
 * **안전 수칙을 위한 탭은 없다.** 손 씻기·침 버리기·지혈은 조작으로 두지 않고
 * 2쪽(준비물)에 **적어 두기만 한다** — 이 앱은 그것을 확인하지 않는다.
 * 그 넷만 쓰이던 물건(개수대·휴지·침 폐기함)은 눌러도 아무 일 없는 물건이 되므로
 * 실험대에서 함께 뺐다. **말없이 먹통인 물건을 남기지 않는다.**
 */
export function tapTable(store, onOpenZoom) {
  return {
    // 회전판을 누르면 끈을 당기는 확대 뷰가 열린다. **이 실험의 몸통이다.**
    rotor: (item, el) => onOpenZoom('spin', el),
    // 모세관을 누르면 막는 확대 뷰가 열린다. 고무찰흙까지 끌고 가지 않아도 되는 지름길이다.
    capillary: (item, el) => onOpenZoom('seal', el),
    // 헤파린 칸과 민무늬 칸을 오간다. **이것이 변인이다** — 화면이 대신 고르지 않는다.
    capbox: () => {
      const now = store.getState().tools.pickKind;
      store.dispatch('PICK_CAPILLARY', {
        kind: now === TUBE_KINDS.HEPARIN ? TUBE_KINDS.PLAIN : TUBE_KINDS.HEPARIN,
      });
    },
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

/**
 * 실험대를 열려면 아직 읽어야 하는 쪽들.
 *
 * **한 곳에서만 센다.** 탐구 노트도 이 값을 봐야 하는데, 거기서 따로 세면 두 쪽이
 * 갈라진다 — 노트는 「실험대에서 해 보세요」라 하고 실험대는 잠겨 있는 식이다.
 * (osmosis 세션이 「지금 자리」를 두 곳에서 세다 아무것도 안 펼쳐지는 화면을 만들었다)
 */
export function benchLeft(st) {
  const read = st.session.readStages ?? [];
  return UI.bench.lock.required.filter((id) => !read.includes(id));
}

/** 실험대가 잠겨 있는가. 편집 모드는 여기서 보지 않는다 — 그건 학생 화면이 아니다. */
export function benchLocked(st) {
  return benchLeft(st).length > 0;
}

/** 실험대에 놓인 물건들. 배치를 몰라도 종류만 알면 되는 검사에 쓴다. */
export const BENCH_KINDS = [
  'finger', 'capillary', 'capbox', 'clay', 'lancet', 'swab', 'ruler',
  'rotor', 'bin',
];

/**
 * 배치를 다시 코드로 뱉는다 — 편집 모드에서 옮긴 자리를 그대로 `defaultItems()` 에 붙여 넣는다.
 *
 * 눈으로 옮긴 것을 손으로 숫자로 옮겨 적는 일은 반드시 어딘가 틀린다.
 * 옮긴 사람이 스크린샷만 보내면 되도록, 화면이 스스로 좌표를 말하게 한다.
 */
function layoutCode(items) {
  const lines = items.map((it) => {
    const props = [
      `id: '${it.id}'`,
      `asset: '${it.asset}'`,
      `kind: '${it.kind}'`,
      `labelKey: '${it.labelKey}'`,
    ].filter(Boolean).join(', ');
    /*
     * **높이를 버리지 않는다.** 예전에는 `shelf(x, …)`·`surface(x, …)` 둘 중 하나로만 뱉었는데,
     * 그 둘은 바닥을 선에 붙이므로 **선 사이에 놓은 자리가 통째로 사라졌다.**
     * 붙는 자리를 없애 놓고(`placeFreely`) 뱉는 쪽은 선으로 되돌리고 있었으니,
     * 폰에서 미세하게 잡은 것이 「코드 복사」 한 번에 날아간다.
     *
     * 선에 정확히 앉은 것은 읽기 쉬운 `shelf`·`surface` 로 두고, 그 밖은 `at(x, y, …)` 로 뱉는다.
     * 어느 쪽이든 **붙여 넣으면 같은 자리로 돌아온다** (`check-bench` 가 왕복을 잰다).
     */
    const onShelf = Math.abs(it.bottom - SHELF_MM) < 1;
    const onSurface = Math.abs(it.bottom - SURFACE_MM) < 1;
    if (onShelf || onSurface) {
      return `    ${onShelf ? 'shelf' : 'surface'}(${Math.round(it.x)}, { ${props} }),`;
    }
    return `    at(${Math.round(it.x)}, ${Math.round(it.y)}, { ${props} }),`;
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

  /*
   * **폭이 바뀌면 이름표 자리를 다시 잰다.**
   *
   * `layoutNames()` 는 픽셀로 재서 부딪히는 것만 한 줄씩 내린다. 그런데 그리는 순간에만
   * 불렀다 — 폭이 달라지면 답도 달라지는데 다시 재지 않았다. 폰을 가로에서 세로로
   * 돌리거나 창을 줄이면 이름표가 겹친 채 남는다. 재 봤다:
   *
   *     1600 으로 열었을 때            겹친 쌍 0개
   *     1600 → 420 · 375 · 320 으로 줄이면  겹친 쌍 3개
   *     처음부터 375 로 열면            겹친 쌍 0개   ← 그래서 좁게 열어 재면 안 보인다
   *
   * `layoutNames()` 는 이름표의 `--name-row` 만 바꾸므로 무대 크기를 되바꾸지 않는다.
   * 그래도 한 박자 미뤄, 줄이는 동안 매 프레임 재지 않게 한다.
   */
  let nameFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(nameFrame);
    nameFrame = requestAnimationFrame(() => layoutNames());
  }).observe(root.querySelector('.bench-stage'));
  const tipEl = root.querySelector('.bench-tip');
  const unmountBtn = root.querySelector('#unmount');

  root.querySelector('#undo').addEventListener('click', () => store.dispatch('UNDO', {}));
  unmountBtn.addEventListener('click', () => {
    // 돌고 있으면 먼저 멈춘다. 돌고 있는 회전판에 손을 대면 모세관이 부러진다 —
    // 그건 규칙 엔진이 답할 일이지, 단추가 대신 저질러 줄 일이 아니다.
    if (isSpinning(store.getState().rotor)) store.dispatch('STOP_ROTOR', {});
    else store.dispatch('UNLOAD', {});
  });

  // 확대 뷰는 셋뿐이다 — 빨아올리기(draw) · 막기(seal) · 끈 당기기(spin).
  // 어느 물건에서 열렸는지를 함께 넘겨, 닫을 때 그 물건으로 포커스를 돌려준다.
  const DROPS = dropTable(store, (mode) => onOpenZoom(mode, elFor(mode === 'spin' ? 'rotor' : 'capillary')));

  const TAPS = tapTable(store, onOpenZoom);

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let drag = null;

  /* ---------------- 편집 모드 ---------------- */

  /**
   * 편집 모드에서 놓은 자리에 **그대로** 둔다.
   *
   * 앞서는 두 선(선반·작업면) 중 가까운 쪽에 바닥을 붙였다. 「그림에 중간 높이가 없다」는
   * 이유였는데, **자리를 정하는 사람이 그렇게 결정할 일**이었다. 사장님이 짚으셨다 —
   * 「가능한 포지션을 네가 정해 두지 마. 내가 미세하게 조정할 거야.」
   * 붙는 자리가 둘뿐이면 그 둘 사이 어디에도 못 두므로 미세 조정이 아예 불가능하다.
   *
   * 실험대 밖으로 나가는 것만 막는다. 나가면 화면에서 사라져 되찾을 길이 없다 —
   * 그건 취향이 아니라 **되돌릴 수 없는 것**이라 남긴다.
   *
   * `bottom` 은 여전히 둘 중 가까운 쪽으로 적어 둔다. 「코드 복사」 가 뱉는
   * `shelf(x, …)`·`surface(x, …)` 가 그 값을 쓰기 때문이다. **그리는 자리는 `y` 가 정한다.**
   */
  function placeFreely(item) {
    const h = heightMm(item.asset);
    item.x = clamp(item.x, 0, STAGE_W_MM - CONTRACT[item.asset].realSizeMm);
    item.y = clamp(item.y, 0, STAGE_H_MM - h);
    /*
     * **`bottom` 에 실제 바닥을 적는다.** 앞서는 여기서도 두 선 중 가까운 쪽으로 적어 두었다 —
     * 「코드 복사」가 `shelf`·`surface` 를 고를 때 쓰려고. 그런데 그러면 `bottom` 이
     * **물건이 실제로 있는 자리를 더는 말하지 않는다.** 자유롭게 놓은 높이는 `y` 에만 남고,
     * `bottom` 을 읽는 쪽은 전부 선 위에 있는 것으로 본다 —
     * 그래서 「코드 복사」가 늘 `surface(…)` 를 뱉어 **잡아 둔 높이가 날아갔다.**
     * 붙는 자리를 없앤 김에 이 값도 진짜 자리를 말하게 둔다.
     */
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

  function renderEditPanel() {
    if (!edit) return;
    const bad = overlaps();
    root.querySelector('#edit-rows').innerHTML = items.map((it) => {
      const d = drawnBoxMm(it.asset);
      return `
      <tr${bad.has(it.id) ? ' class="edit-bad"' : ''}>
        <td>${it.id}</td>
        <td>${Math.abs(it.bottom - SHELF_MM) < 1 ? UI.edit.shelf
          : Math.abs(it.bottom - SURFACE_MM) < 1 ? UI.edit.surface
          : UI.edit.free(Math.round(it.y))}</td>
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

  /**
   * 실험대의 모세관 그림에 넘길 상태.
   *
   * **여기서 갈린 층을 그리지 않는다.** 층은 결과 렌더러(`src/render/tube.js`)의 몫이고,
   * 결과색(암적색·회백색·담황색)은 기구 애셋에 쓰면 안 된다 (`tests/palette.test.js`).
   * 실험대에서 보이는 것은 **선홍색 생혈**뿐이다 — 그 대비가 "다져져서 어두워졌다" 를 만든다.
   */
  function capillaryRenderState() {
    const t = store.getState().tube;
    return {
      fill: t.fill * (1 - t.lost),
      kind: t.kind,
      seal: { ...t.seal },
      broken: t.broken,
      seed: t.seed,
    };
  }

  function assetState(item) {
    const st = store.getState();
    switch (item.kind) {
      case 'capillary':
        return capillaryRenderState();
      case 'capbox':
        return { kind: st.tools.pickKind };
      case 'clay':
        // 누를 때마다 자국이 는다. 몇 개인지가 아니라 **썼다는 것**이 보이면 된다.
        return { dents: Math.min(6, st.session.log.filter((l) => l.action === 'SEAL_END').length) };
      case 'lancet':
        return { used: st.lancet.used };
      case 'swab':
        return { used: st.finger.swabbed };
      case 'finger':
        return { swabbed: st.finger.swabbed, drop: st.finger.drop, wiped: st.finger.wiped };
      case 'rotor':
        return {
          speed: st.rotor.speed,
          slotA: st.rotor.slots.A,
          slotB: st.rotor.slots.B,
          // 균형이 안 맞고 돌고 있을 때만 흔들린다. 멎어 있으면 흔들릴 것이 없다.
          wobble: (st.rotor.slots.A && st.rotor.slots.B) ? 0 : (st.rotor.speed > 0 ? 1 : 0),
        };
      case 'sharpsbin':
        return { fill: st.lancet.disposed ? 0.7 : 0.3 };
      case 'bin':
        return { fill: 1 };
      case 'sink':
        return { water: 0 };
      default:
        return {};
    }
  }

  /**
   * 회전판에 물린 모세관은 실험대에서 사라진다 — 그 자리에 있으니까.
   *
   * 나머지는 사라지지 않는다. 모세관 통·고무찰흙은 계속 꺼내 쓰는 것이라
   * 사라지면 곧바로 막다른 길이 된다.
   */
  function isHidden(item) {
    return item.kind === 'capillary' && sampleSlot(store.getState().rotor) !== null;
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
      // **넓히기 전의 그림**도 함께 낸다. 겹쳤을 때 「진짜 그림 위인 것」을 먼저 고르는 데 쓴다.
      art: { left, top, right: left + dw, bottom: top + dh },
    };
  }

  const inRect = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  /** 점에서 사각형까지의 거리(제곱). 안에 있으면 0 이다. */
  function distToRect(r, x, y) {
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    return dx * dx + dy * dy;
  }

  /**
   * 겹친 후보 가운데 하나를 고른다. **그림에 가장 가까운 것이 이긴다.**
   *
   * 처음에는 「그림 **한가운데**가 가장 가까운 것」으로 두었다. 그랬더니
   * **큰 그림이 자기 모서리에서 졌다** — 개수대(67×70 px)의 왼쪽 위 모서리는 개수대
   * 한가운데보다 옆의 휴지 한가운데가 더 가까워서, 개수대 그림을 눌렀는데 휴지가 집혔다.
   * 320 px 에서 재다가 나왔다 (420 px 에서만 재면 안 보인다).
   * 물건이 클수록 손해를 보는 규칙이었다.
   *
   * 그래서 **한가운데까지가 아니라 그림까지**의 거리로 잰다. 그림 안이면 0 이라,
   * 그림 위를 누르면 언제나 그 물건이 이긴다 — 실험대의 그림들은 서로 겹치지 않으므로
   * (어느 폭에서 재도 겹친 짝 0) 그 자리에서 다투는 일이 없다.
   * 아무 그림 위도 아닌 halo 안에서는 가까운 쪽이 이긴다.
   *
   * @param {Array<{item:object, rect:object, cx:number, cy:number}>} cands 넓힌 자리에 든 후보들
   */
  function pickAimed(cands, x, y) {
    let best = null;
    let bestArt = Infinity;
    let bestMid = Infinity;
    for (const c of cands) {
      const art = distToRect(c.rect.art, x, y);
      const mid = (x - c.cx) ** 2 + (y - c.cy) ** 2;
      // 그림까지가 더 가까우면 이긴다. 똑같이 0 이면(둘 다 그림 위) 한가운데로 가른다.
      // 같은 값이면 먼저 온 것을 그대로 둔다 — 흔들리지 않게.
      if (art < bestArt || (art === bestArt && mid < bestMid)) {
        bestArt = art; bestMid = mid; best = c;
      }
    }
    return best;
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
   * 끄는 물건의 **그림** 중심이 지금 어느 물건 위에 있는가. 프레임 중심은 그림 밖일 수 있다.
   *
   * ── 겹칠 때 무엇을 고르는가 ────────────────────────────────────
   * `hitRect` 는 그림이 손가락보다 작으면 `MIN_HIT_PX`(44) 까지 넓혀 준다. 데스크톱에서는
   * 물건들이 충분히 떨어져 있어 넓혀도 안 겹치는데, **폰(420 px)에서는 물건 자체가
   * 3~70 px 이라 넓힌 사각형들이 서로 포개진다** — 재어 보니 네 짝이 겹쳤고,
   * 선반 다섯(모세관 통·고무찰흙·채혈침·소독솜·자)이 사슬처럼 이어져 있었다.
   *
   * 앞서는 **목록에서 먼저 오는 것**을 골랐다. 그래서 모세관을 고무찰흙에 겨눠도
   * 목록에서 앞선 **모세관 통**이 가로챘고, 모세관을 통에 대는 것은 「새것을 꺼낸다」라
   * 애써 채운 혈액 기둥이 그 자리에서 사라졌다. 데스크톱에서는 안 겹쳐서 영영 안 보인다.
   * 교실에서 쓰는 것이 태블릿이므로 그냥 둘 자리가 아니다.
   *
   * 이제 **그림 한가운데가 가장 가까운 것**이 이긴다.
   *
   * **받는 물건을 골라 주지는 않는다.** 「이 물건을 받아 줄 수 있는 것」만 후보로 두면
   * 폐기물 통을 겨눴을 때 옆의 개수대가 잡혀 엉뚱한 일이 일어난다. 겨눈 것이 답해야 한다 —
   * 못 받는 것을 겨눴으면 못 받는다는 말을 듣는 것이 옳다 (AGENTS.md §2.1).
   */
  function targetUnder() {
    const g = hitRect(drag.el, drag.item.asset);
    const cx = (g.left + g.right) / 2;
    const cy = (g.top + g.bottom) / 2;
    const cands = [];
    for (const other of items) {
      const or_ = drag.rects.get(other.id);
      if (!or_ || !inRect(or_, cx, cy)) continue;
      cands.push({
        item: other, rect: or_,
        cx: (or_.art.left + or_.art.right) / 2, cy: (or_.art.top + or_.art.bottom) / 2,
      });
    }
    return pickAimed(cands, cx, cy)?.item ?? null;
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
    tipEl.style.marginLeft = '0px';
    tipEl.hidden = false;

    /*
     * **퍼센트로 묶는 것만으로는 안 잡힌다.** 위의 `clamp(…, 12, 88)` 은 말풍선의 **가운데**를
     * 실험대 안에 두지만, 말풍선은 `translate(-50%)` 라 제 너비의 절반만큼 더 왼쪽으로 간다.
     * 글이 길면 그 절반이 12% 보다 커서 **밖으로 나간다.** 손끝 말풍선이 왼쪽으로 39px 나가
     * 줄마다 첫 글자가 잘려 있었다 — 배포본을 플레이하다 봤다.
     *
     * 그래서 **띄운 뒤 실제로 재서** 넘친 만큼 되민다. 글 길이·글꼴·화면 폭이 무엇이든 같다.
     */
    const box = tipEl.getBoundingClientRect();
    const stage = tipEl.offsetParent?.getBoundingClientRect();
    if (stage) {
      const pad = 4;
      const over = box.left < stage.left + pad ? (stage.left + pad) - box.left
        : box.right > stage.right - pad ? (stage.right - pad) - box.right : 0;
      if (over) tipEl.style.marginLeft = `${Math.round(over)}px`;
    }
  }

  /** 닫기 예약. 새 포커스가 오면 showTip 이 취소한다. */
  let hideTimer = 0;

  function hideTip() {
    clearTimeout(hideTimer);
    hideTimer = 0;
    tipEl.hidden = true;
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

  /**
   * 이 자리에서 **정말로 집으려던 물건**은 무엇인가.
   *
   * `.token::after` 가 손가락에 잡히도록 그림을 `MIN_HIT_PX`(44) 까지 넓혀 준다.
   * 데스크톱에서는 물건이 충분히 떨어져 있어 안 겹치는데, **폰(420 px)에서는 물건 자체가
   * 3~70 px 이라 넓힌 자리들이 서로 포개진다** — 재어 보니 네 짝이 겹쳤다.
   *
   * 그때는 **DOM 에서 나중에 그려진 것**이 이벤트를 가져간다. 그래서 그림 위를 눌렀는데도
   * 이웃이 집혔다. 재어 보니 그림 300 점 가운데 **15 점**이 그랬다 —
   * **채혈침의 오른쪽 끝을 누르면 소독솜이, 휴지 아래쪽과 폐기물 통 오른쪽 끝을 누르면
   * 개수대가** 집혔다. 채혈하려고 손끝으로 끌었는데 소독이 되는 식이라, 아무 말도 없이
   * 엉뚱한 일이 일어난다. 데스크톱에서는 안 겹쳐서 영영 안 보인다.
   * 교실에서 쓰는 것은 태블릿이다.
   *
   * 그래서 **그림 한가운데가 가장 가까운 것**으로 바꿔 준다. 겹치지 않는 화면에서는
   * 자기 자신이 뽑히므로 아무것도 달라지지 않는다.
   */
  function aimedAt(e, item) {
    const cands = [];
    // 원래 눌린 것을 맨 앞에 둔다 — 같은 값이면 그것이 이겨 흔들리지 않는다.
    for (const other of [item, ...items.filter((o) => o.id !== item.id)]) {
      if (isHidden(other)) continue;
      const oe = elFor(other.id);
      if (!oe) continue;
      const r = hitRect(oe, other.asset);
      if (!inRect(r, e.clientX, e.clientY)) continue;
      cands.push({
        item: other, rect: r,
        cx: (r.art.left + r.art.right) / 2, cy: (r.art.top + r.art.bottom) / 2,
      });
    }
    return pickAimed(cands, e.clientX, e.clientY)?.item ?? item;
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
    layer.innerHTML = '';
    for (const item of items) {
      if (isHidden(item)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `token token--${item.kind}`;
      el.dataset.id = item.id;
      el.dataset.tool = item.asset;
      // 확대 뷰가 열리는 물건에만 표시를 붙인다 — 검사 스크립트가 이 표시로 찾는다.
      if (item.kind === 'rotor') el.dataset.zoom = 'spin';
      else if (item.kind === 'capillary') el.dataset.zoom = 'seal';
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
      // 이름은 **집힐 물건**의 것이어야 한다. 넓힌 자리가 겹친 곳에서는 눌린 것과 실제로
      // 집히는 것이 다르므로(`aimedAt`), 말풍선도 **같은 판정**을 써야 한다. 집는 것만
      // 고치면 「고무찰흙」 이라 적힌 것을 눌렀는데 모세관 통이 끌린다 — 화면이 거짓말을
      // 하는 것이고, 고치기 전보다 나쁘다. 앞서는 아무 일도 안 일어났지만 이제는
      // **엉뚱한 일이 이름표를 달고** 일어난다.
      // 재어 보니 320 px 에서 그림 위 300점 가운데 **55점**, 420 px 에서 12점이 그랬다.
      const hoverTip = (e) => {
        if (e.pointerType !== 'mouse') return;
        showTip(aimedAt(e, item));
      };
      el.addEventListener('pointerenter', hoverTip);
      // **들어올 때 한 번만 재면 이름이 굳는다.** 겹친 자리 **안에서** 조금 움직이면
      // 겨눈 것이 바뀌는데 pointerenter 는 그때 오지 않는다 — 그래서 pointermove 도 듣는다.
      // 끄는 중에는 말풍선을 안 쓰므로 그때는 넘긴다.
      el.addEventListener('pointermove', (e) => { if (!drag) hoverTip(e); });
      el.addEventListener('pointerleave', () => hideTip());
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
    const left = benchLeft(store.getState());
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
    const spinning = isSpinning(st.rotor);
    unmountBtn.hidden = !(spinning || st.rotor.slots.A || st.rotor.slots.B);
    unmountBtn.textContent = spinning ? UI.bench.stop : UI.bench.unload;
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
