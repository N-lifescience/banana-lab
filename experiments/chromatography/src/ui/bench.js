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
import { extractStrength, isSettled } from '../sim/state.js';
import { ORIGIN_MM } from '../sim/develop.js';
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

/** 애셋 그림의 세로/가로 비. 이 실험의 애셋은 전부 400×300 이다. */
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
 * 흔들기 — 원심관을 **집어서 움직인 거리**(mm)로 얼마나 흔들렸는지가 정해진다.
 *
 * 누르고 있던 시간이 아니다. 가만히 들고만 있어서 색소가 뽑힐 수는 없고,
 * 실제로 흔드는 동작은 왕복 운동이기 때문이다.
 *
 * 바나나랩의 「문지르기」 자리에 오는 조작이다. 대상이 필요 없다는 점만 다르다 —
 * 원심관은 어디에 대고 흔드는 것이 아니라 그냥 흔든다.
 */
const SHAKE_FULL_MM = 900;

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
    // 상단 선반 — 꺼내 쓰는 것들. 왼쪽에서 오른쪽으로 절차 순서에 가깝게 놓는다.
    shelf(20, { id: 'leaf', asset: 'leaf', kind: 'leaf', labelKey: 'leaf' }),
    shelf(150, { id: 'bottleEXTRACT', asset: 'bottle', kind: 'bottle', liquid: 'EXTRACT', labelKey: 'bottleEXTRACT' }),
    shelf(265, { id: 'bottleSOLVENT', asset: 'bottle', kind: 'bottle', liquid: 'SOLVENT', labelKey: 'bottleSOLVENT' }),
    // 낱장 4 cm 폭은 화면에서 알아볼 수가 없다. 통 하나로 둔다 —
    // 실제 실험실도 통에서 꺼내 쓰고, 소모품이 바닥나면 그건 막다른 길이다.
    shelf(390, { id: 'paperbox', asset: 'paperbox', kind: 'paperbox', labelKey: 'paperbox' }),
    shelf(560, { id: 'capillary', asset: 'capillary', kind: 'capillary', labelKey: 'capillary' }),
    shelf(700, { id: 'pencil', asset: 'pencil', kind: 'pencil', labelKey: 'pencil' }),
    shelf(900, { id: 'ruler', asset: 'ruler', kind: 'ruler', labelKey: 'ruler' }),
    // 작업면 — 실험이 벌어지는 곳. 원심관 → 거름종이 → 바이알 순으로 왼쪽에서 오른쪽.
    surface(0, { id: 'bin', asset: 'bin', kind: 'bin', labelKey: 'bin' }),
    surface(255, { id: 'waste', asset: 'waste', kind: 'waste', labelKey: 'waste' }),
    // 셋을 60 mm 넘게 벌려 둔다. 그림은 30 mm 안팎이지만 **이름표가 그보다 넓어서**,
    // 붙여 놓으면 이름표끼리 부딪혀 두 줄로 밀려 내려간다 — 실험대가 지저분해지고
    // 어느 이름이 어느 물건인지 흐려진다. 겹침 검사는 그림만 보므로 이건 눈으로 잡는다.
    surface(400, { id: 'tube', asset: 'tube', kind: 'tube', labelKey: 'tube' }),
    surface(530, { id: 'paper', asset: 'paper', kind: 'paper', labelKey: 'paper' }),
    surface(660, { id: 'vial', asset: 'vial', kind: 'vial', labelKey: 'vial' }),
    surface(1010, { id: 'sink', asset: 'sink', kind: 'sink', labelKey: 'sink' }),
    // 이름은 키로만 적어 둔다. 편집 모드가 배치를 다시 코드로 뱉을 때
    // `label: I.leaf` 를 되살리려면 어느 키였는지를 알아야 한다.
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
    // 잎을 원심관에 넣는다. 시든 잎도 막지 않는다 — 뽑을 색소가 적을 뿐이다.
    leaf: {
      // 어느 잎인지는 **선반에서 고른 것**을 따른다 (tapTable 의 leaf).
      tube: () => store.dispatch('ADD_LEAF', { kind: store.getState().tools.leafKind }),
    },
    bottle: {
      // 어느 병인지는 **병이 안다.** 조작표는 종류 쌍만 적고, 무엇이 든 병인지는 item 이 갖고 있다.
      tube: (item) => (item.liquid === 'EXTRACT'
        ? store.dispatch('ADD_EXTRACT', {})
        : openZoom('vial', null, 'bottle')),
      // 전개액은 **깊이가 결과를 가른다.** 실험대에서 가져다 대기만 하면 그 변인이
      // 학생 손을 떠나므로, 확대 뷰에서 얼마나 부을지 직접 정하게 한다.
      vial: () => openZoom('vial', null, 'bottle'),
    },
    capillary: {
      tube: () => store.dispatch('LOAD_CAPILLARY', {}),
      // 몇 번 찍는가·한 번에 얼마나 오래 대는가가 이 실험의 변인이다. 손끝 일이라 확대 뷰에서.
      paper: () => openZoom('paper', null, 'capillary'),
      // 폐액통에 대도 개수대에 대도 헹궈진다 — 아래 종이·원심관·바이알과 **같은 원칙**이다.
      // 이것만 폐액통 하나였다. 개수대로 가져간 학생에게는 **아무 일도 안 일어났다.**
      waste: () => store.dispatch('RINSE_CAPILLARY', {}),
      sink: () => store.dispatch('RINSE_CAPILLARY', {}),
    },
    pencil: {
      // 원점 선·용매 전선·색소 위치. 셋 다 어디에 긋는지가 중요해서 확대 뷰에서 한다.
      paper: () => openZoom('paper', null, 'pencil'),
    },
    ruler: {
      // 젖은 종이에 대면 찢어진다. **막지 않는다** — 규칙 엔진이 답한다.
      paper: () => store.dispatch('MEASURE', {}),
    },
    paper: {
      vial: () => store.dispatch('INSERT_PAPER', {}),
      // 찢어졌거나 잘못 찍었을 때. 통에 대도 쓰레기통에 대도 새것이 나온다 —
      // 버리는 손짓이 먼저 나오는 학생도 있으므로 같은 길을 연다.
      paperbox: () => store.dispatch('NEW_PAPER', {}),
      bin: () => store.dispatch('NEW_PAPER', {}),
    },
    tube: {
      waste: () => store.dispatch('EMPTY_TUBE', {}),
      sink: () => store.dispatch('EMPTY_TUBE', {}),
    },
    vial: {
      waste: () => store.dispatch('EMPTY_VIAL', {}),
      sink: () => store.dispatch('EMPTY_VIAL', {}),
    },
  };
}

/**
 * 물건을 클릭(또는 Enter/Space)했을 때. 끌어다 놓는 조작과 달리 대상이 필요 없는 것들.
 *
 * (예전에는 여기서 안전 수칙을 판정해 자기 평가의 「위반 기록」을 지웠다. 그 판정도,
 *  휴지도 걷어냈다 — 가상 실험에서 그것을 따지면 **화면 속 단추를 눌렀다는 사실**을
 *  평가하게 된다. 안전은 이제 준비물 쪽에 **가만히 적힌 안내**로만 있다.)
 */
export function tapTable(store, onOpenZoom) {
  return {
    // 신선한 잎과 시든 잎을 오간다. 이것이 이 실험의 변인 하나다 —
    // 화면이 알아서 신선한 것을 집어 주면 학생이 고를 것이 없어진다.
    leaf: () => store.dispatch('PICK_LEAF', {
      kind: store.getState().tools.leafKind === 'fresh' ? 'wilted' : 'fresh',
    }),
    tube: (item, el) => onOpenZoom('tube', null, el),
    paper: (item, el) => onOpenZoom('paper', null, el),
    // 뚜껑은 열고 닫는 한 쌍이다. 지금 상태의 반대로 간다 —
    // 열려 있을 때만 종이가 들어가고, 덮여 있어야 용매가 안 날아가고 빛도 안 든다.
    vial: () => store.dispatch(store.getState().vial.capped ? 'UNCAP_VIAL' : 'CAP_VIAL', {}),
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
  'leaf', 'tube', 'paper', 'paperbox', 'capillary', 'vial',
  'pencil', 'ruler', 'bottle', 'waste', 'sink', 'bin',
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
      it.liquid ? `liquid: '${it.liquid}'` : null,
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
export function createBench(root, store, { onOpenZoom, edit: editStart = false }) {
  /**
   * 배치 편집 모드. **`Ctrl+P`(맥은 `Cmd+P`)로 껐다 켠다.**
   *
   * 주소에 `?edit=1` 을 치는 것보다 손이 빠르다 — 선생님이 배치를 잡는 동안 몇 번이고
   * 껐다 켜게 된다. `let` 인 이유가 그것이다.
   */
  let edit = editStart;
  root.classList.add('bench');
  // 배경과 물건을 같은 무대 안에 둔다. 무대가 4:3 을 지키므로 둘이 함께 스케일된다.
  // 안내 말풍선은 무대 바로 아래에 둔다 — 물건 층(.bench-tokens)은 조작할 때마다
  // 통째로 다시 그려지므로, 그 안에 두면 말풍선이 같이 사라진다.
  root.innerHTML = `
    <div class="bench-bar">
      <button type="button" id="undo">${UI.undo.label}</button>
      <span id="undo-left"></span>
      <button type="button" id="remove-paper" hidden></button>
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
`;
  root.querySelector('.bench-bg').innerHTML = ASSETS.bench.render({});
  const layer = root.querySelector('.bench-tokens');
  const tipEl = root.querySelector('.bench-tip');
  const removePaperBtn = root.querySelector('#remove-paper');

  root.querySelector('#undo').addEventListener('click', () => store.dispatch('UNDO', {}));
  removePaperBtn.addEventListener('click', () => store.dispatch('REMOVE_PAPER', {}));

  const DROPS = dropTable(store, (mode, id, tool) => onOpenZoom(mode, id, elFor(mode), tool));

  const TAPS = tapTable(store, onOpenZoom);

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let drag = null;

  /* ---------------- 편집 모드 ---------------- */

  /**
   * 물건은 두 선 중 **가까운 쪽**에 바닥을 댄다 — 선반 위 아니면 작업면 위다.
   * 중간 높이에 띄워 둘 수는 없다. 그림에 그런 자리가 없기 때문이다.
   */
  /**
   * 놓은 자리에 **그대로** 둔다. 실험대 밖으로만 안 나가게 한다.
   *
   * 예전에는 선반 선이나 작업면 선에 **자동으로 붙였다**(`snapToLine`). 「띄워 둘 자리가
   * 그림에 없다」는 생각이었는데, 그러면 **미세 조정이 아예 안 된다** — 몇 밀리미터를
   * 옮기려 해도 손을 떼는 순간 원래 선으로 돌아간다.
   *
   * **선생님 말씀: 「위치 가능한 포지션을 너가 정해두지 마. 내가 미세하게 조정할 거야.」**
   * 자리를 정하는 것은 사람이다. 화면은 옮긴 그대로 두고, 실험대 밖으로 나가는 것만 막는다
   * (밖으로 나가면 다시 잡을 수가 없다 — 그건 막다른 길이지 배치가 아니다).
   */
  function placeFreely(item) {
    const h = heightMm(item.asset);
    item.x = clamp(item.x, 0, STAGE_W_MM - CONTRACT[item.asset].realSizeMm);
    item.y = clamp(item.y, 0, STAGE_H_MM - h);
    // 표에 「선반/작업면」을 적으려면 어느 쪽에 가까운지는 여전히 알아야 한다.
    item.bottom = Math.abs(item.y + h - SHELF_MM) <= Math.abs(item.y + h - SURFACE_MM)
      ? SHELF_MM : SURFACE_MM;
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

  /**
   * 편집판을 **켤 때 만든다.**
   *
   * 처음부터 그려 두면 학생 화면의 DOM 에 편집 단추가 남는다. `?edit=1` 없이는 아무것도
   * 안 열려야 하고(`scripts/check-build.mjs` 가 지킨다), `Ctrl+P` 로 켜는 순간 생겨야 한다.
   */
  function buildEditPanel() {
    if (root.querySelector('#edit-panel')) return;
    const box = document.createElement('div');
    box.className = 'edit-panel';
    box.id = 'edit-panel';
    box.innerHTML = `
      <div class="edit-head">
        <b>${UI.edit.heading}</b>
        <button type="button" id="edit-copy">${UI.edit.copy}</button>
        <button type="button" id="edit-reset">${UI.edit.reset}</button>
      </div>
      <p class="edit-note">${UI.edit.note}</p>
      <p class="edit-warn" id="edit-warn"></p>
      <table class="edit-table"><tbody id="edit-rows"></tbody></table>`;
    root.appendChild(box);
    box.querySelector('#edit-copy').addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(layoutCode(items));
      e.target.textContent = UI.edit.copied;
      setTimeout(() => { e.target.textContent = UI.edit.copy; }, 1500);
    });
    box.querySelector('#edit-reset').addEventListener('click', () => {
      for (const [i, it] of defaultItems().entries()) Object.assign(items[i], it);
      renderTokens();
      renderEditPanel();
    });
    // 스크린샷만으로 배치를 옮겨 적을 수 있어야 한다. 콘솔에도 한 벌 남긴다 —
    // 붙여 넣기가 막힌 환경(권한 거부)에서도 길이 하나는 남는다.
    window.__layoutCode = () => layoutCode(items);
  }

  function setEdit(on) {
    edit = on;
    if (on) buildEditPanel();
    else {
      root.querySelector('#edit-panel')?.remove();
      delete window.__layoutCode;
    }
    hideTip();
    renderTokens();
    renderEditPanel();
  }

  if (edit) buildEditPanel();

  /*
   * **Ctrl+P 단축키는 여기 없다 — `src/main.js` 모듈 자리에 있다.**
   *
   * 여기(`createBench` 안)에 두었더니 **시작 화면에서는 아예 안 달렸다.** 이 함수는
   * `boot()` 안에서만 불리는데, 선생님이 실제로 여는 것은 **맨 주소**이고 거기서는
   * 아직 boot 전이다. 단계를 고르기 전까지 단축키가 죽어 있었다.
   * 문을 `main.js` 로 옮기고, 여기서는 **껐다 켜는 손잡이만 내준다.**
   */

  /**
   * 거름종이가 실험대에서 어떻게 보이는가.
   *
   * **결과(색 띠)는 여기서 그리지 않는다.** 그건 `src/render/strip.js` 가 확대 뷰와
   * 탐구 노트에서 그린다. 실험대에서는 원점 선과 찍은 자국까지만 보인다 —
   * 4 cm 짜리 종이 위의 띠는 실험대 크기에서 어차피 보이지 않는다.
   */
  function paperRenderState() {
    const st = store.getState();
    const p = st.paper;
    return {
      origin: p.originMm ?? ORIGIN_MM,
      spots: p.spots,
      spotMm: p.spotMm,
      wet: p.wetness,
      torn: p.torn,
    };
  }

  function assetState(item) {
    const st = store.getState();
    switch (item.kind) {
      case 'leaf':
        return { fresh: st.tools.leafKind === 'fresh' ? 1 : 0 };
      case 'tube':
        return {
          leaf: st.tube.leaf, extract: st.tube.extract,
          settleT: st.tube.settleT, capped: true,
        };
      case 'paper':
        return paperRenderState();
      case 'capillary':
        return { loaded: st.tools.capillary.strength };
      case 'vial':
        return { depth: st.vial.depthMm, capped: st.vial.capped, hasPaper: st.vial.hasPaper };
      case 'bottle':
        return { kind: item.liquid, level: 0.7 };
      case 'waste':
        return { level: 0.2 };
      default:
        return {};
    }
  }

  /**
   * 바이알에 세워 둔 거름종이는 실험대에서 사라진다 — 그 자리에 있으니까.
   * 바이알 그림이 안에 선 종이를 대신 보여 준다.
   *
   * 거름종이 통은 사라지지 않는다. 계속 꺼내 쓰는 물건이고,
   * 몇 장을 세고 있다가 바닥나면 그건 결과가 아니라 막다른 길이다.
   */
  function isHidden(item) {
    return item.kind === 'paper' && store.getState().paper.inVial;
  }

  const elFor = (id) => layer.querySelector(`[data-id="${id}"]`);

  /**
   * 놓기 판정에 쓰는 사각형. 그림이 작아도 최소 MIN_HIT_PX 는 잡아 준다 —
   * 화면에서 눌리는 영역(.token::after)과 같은 크기여야 손에 잡히는 대로 동작한다.
   */
  function hitRect(el, assetName) {
    const r = el.getBoundingClientRect();
    // 프레임이 아니라 **그려진 부분**을 잰다. 애셋 프레임은 그림보다 넉넉해서, 프레임으로
    // 재면 **옆 물건의 그림을 정확히 겨눠도 이쪽이 잡힌다.** (걷어낸 휴지와 개수대가
    // 실제로 그랬다 — 프레임은 겹치는데 그림은 한참 떨어져 있었다.)
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
    // 넓힌 사각형(누를 자리)과 **그림 자체의 네 변**을 같이 돌려준다.
    // 겹쳤을 때 누가 이길지는 목록 순서가 아니라 **그림까지의 거리**로 정한다 (distTo).
    return {
      left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2,
      dl: left, dt: top, dr: left + dw, db: top + dh,
    };
  }

  /**
   * **지금 겨눈 물건.** 브라우저가 집어 준 것을 그대로 믿지 않는다.
   *
   * 물건마다 `.token::after` 로 최소 44 px 짜리 누를 자리를 깔아 둔다. 좁은 화면에서는
   * 그림이 9~14 px 까지 작아지므로 **그 자리들이 서로 포개지고, 겹친 곳에서는 DOM 에서
   * 뒤에 그려진 쪽이 앞엣것의 누름을 가로챈다.** 재어 보니 실제로 그랬다:
   *
   *   320 px  추출액 병 한가운데 → 전개액 병 · 폐액통 한가운데 → 원심관 · 거름종이 → 바이알
   *   420 px  폐액통 한가운데 → 원심관
   *   1400 px 어긋남 없음
   *
   * **놓는 쪽(`targetUnder`)만 고쳐서는 모자랐다.** 추출액 병을 눌렀는데 전개액 병이
   * 끌리면, 원심관에 붓는 것은 전개액이다 — **아무 일도 안 일어나는 것보다 나쁘다.
   * 엉뚱한 일이 조용히 일어난다.** (허브 세션이 banana-lab 에서 열여섯 짝을 찾아 알려 줬다.)
   *
   * `overlaps()` 는 이것을 못 본다. 그쪽은 **밀리미터**로 재는데, 44 px 은 화면 쪽 이야기라
   * 배치가 안 겹쳐도 좁은 화면에서만 겹친다.
   *
   * 규칙은 `targetUnder` 와 같다 — **그림까지가 가장 가까운 것이 이긴다** (`distTo`).
   * 겹치지 않는 화면에서는 자기 자신이 뽑히므로 넓은 화면은 달라지는 것이 없다.
   */
  /**
   * **그림까지의 거리.** 그림 안이면 0.
   *
   * 처음에는 「그림 한가운데까지의 거리」로 갈랐는데, 그것은 **크거나 긴 그림에 불리하다** —
   * 자기 가장자리가 자기 한가운데보다 옆 물건 한가운데에 더 가깝기 때문이다.
   * 재어 보니 자(135×30 px)의 왼쪽 끝을 짚으면 연필이 잡혔고, 개수대·원심관·거름종이도
   * 가장자리에서 이웃에게 갔다. **넓은 화면에서도 났다** — 겹침 문제와 별개다.
   *
   * 안쪽 3×3 격자만 재면 안 보인다. 새는 것은 **가장자리 띠**다.
   * (centrifuge 세션이 자(27×7)의 0.3 px 띠에서 처음 찾았고 허브가 전해 줬다.)
   */
  function distTo(r, x, y) {
    const dx = Math.max(r.dl - x, 0, x - r.dr);
    const dy = Math.max(r.dt - y, 0, y - r.db);
    return dx * dx + dy * dy;
  }

  function aimedAt(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const other of items) {
      if (isHidden(other)) continue;
      const oe = elFor(other.id);
      if (!oe) continue;
      const r = hitRect(oe, other.asset);
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      // 같은 거리면 **나중에 그려진 것**(위에 보이는 것)이 이긴다 — 눈에 보이는 대로다.
      const d = distTo(r, x, y);
      if (d <= bestD) { bestD = d; best = other; }
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
   * **포인터가 가리키는** 첫 토큰.
   *
   * 앞서는 끄는 물건의 *그림 중심*으로 판정했다. 그런데 그림이 프레임 어디에 그려져
   * 있는지는 애셋마다 다르다 — 자는 프레임 아래쪽에 눕혀 그려서 그림 중심이 포인터보다
   * 80 mm 아래에 있다. 그래서 **자를 거름종이에 정확히 갖다 대도 아무 일이 없었다.**
   * 학생은 자기가 겨눈 자리를 보고 있는데 코드는 다른 곳을 보고 있었던 것이다.
   *
   * 포인터는 정의상 그림 위에 있다(누른 자리가 곧 그림이다). 그쪽으로 맞춘다.
   */
  /**
   * 지금 포인터 밑에 있는 물건.
   *
   * **겹치면 그림까지 가장 가까운 것이 이긴다.** 예전에는 목록에서 먼저 오는 것이 이겼는데,
   * 작은 화면에서 그것이 실제로 깨졌다 — 폰(420 px)에서는 물건이 14~38 px 라
   * `MIN_HIT_PX`(44) 로 넓힌 사각형들이 서로 포개진다. 원심관 **한가운데**를 겨눠도
   * 목록에서 앞선 폐액통이 가로챘고, 폐액통은 잎을 안 받으므로 **아무 일도 일어나지 않고
   * 아무 말도 안 나왔다.** 학생 눈에는 앱이 그냥 죽은 것으로 보인다.
   *
   * 받는 물건을 골라 주지는 않는다. 폐액통을 겨눴으면 폐액통이 답해야 한다 —
   * 겨눈 곳을 바꾸지 않고, **겨눈 곳에 가장 가까운 것**을 고를 뿐이다 (AGENTS.md §2.1).
   */
  function targetUnder() {
    const cx = drag.pointerX;
    const cy = drag.pointerY;
    let best = null;
    let bestD = Infinity;
    for (const other of items) {
      const or_ = drag.rects.get(other.id);
      if (!or_) continue;
      if (cx < or_.left || cx > or_.right || cy < or_.top || cy > or_.bottom) continue;
      const d = distTo(or_, cx, cy);
      if (d <= bestD) { bestD = d; best = other; }
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
   * 마우스로는 손짓이 정하던 값(문지른 정도·덮는 각도)을 키보드로는 정할 수 없으므로
   * 가운뎃값을 쓴다 — 정할 수 있는 것과 아예 못 하는 것 사이의 격차는 남지만,
   * 못 하는 쪽보다는 낫다. 말풍선에 그 값을 적어 둔다.
   */
  const KEYBOARD_SHAKE_MM = SHAKE_FULL_MM / 2;

  function dropTargetsFor(item) {
    const accepts = DROPS[item.kind] ?? {};
    return items.filter((o) => o.id !== item.id && !isHidden(o) && accepts[o.kind]);
  }

  function runDrop(item, target) {
    const run = DROPS[item.kind]?.[target.kind];
    if (!run) return;
    run(item, target, { shakeMm: KEYBOARD_SHAKE_MM });
    renderTokens();
    // 놓고 나면 그 물건으로 포커스를 돌려준다. 그러지 않으면 포커스가 <body> 로 빠져
    // 키보드로 쓰는 사람은 매번 처음부터 Tab 해서 돌아와야 한다.
    // focus() 가 focus 이벤트를 쏘고, 그 핸들러가 말풍선을 다시 낸다 — 여기서 또 부르지 않는다.
    // 놓은 물건이 화면에서 사라졌으면(재물대에 올라간 받침 유리) **놓은 자리**로 옮긴다.
    // 그냥 두면 포커스가 <body> 로 빠져, 키보드로 쓰는 사람은 처음부터 Tab 해 돌아와야 한다.
    (elFor(item.id) ?? elFor(target.id))?.focus();
  }

  /**
   * 지금 뜬 말풍선이 **키보드로 연 것인가.**
   *
   * 포커스로 뜬 말풍선에만 「여기에 놓기」 단추가 붙는다. 마우스를 못 쓰는 사람에게는
   * 그 단추가 끌어다 놓는 길의 **전부**라, 마우스가 그것을 빼앗으면 안 된다.
   * 마우스끼리 서로 덮어쓰는 것은 상관없다 — 지키는 것은 키보드로 연 하나다.
   */
  let tipFromKeyboard = false;
  /** 지금 말풍선을 연 물건. Shift+Tab 으로 되돌아갈 자리다. */
  let tipOwnerId = null;
  /**
   * Esc 로 닫은 물건. 그 물건에서 **손이나 포커스가 떠날 때까지** 다시 안 뜬다.
   *
   * 불리언이 아니라 **어느 물건이었는지**를 들고 있는다. 불리언이면 옆 물건으로 옮겨도
   * 계속 닫혀 있어, Esc 한 번에 실험대 전체의 안내가 사라진다.
   *
   * 여기가 없으면 Esc 가 헛수고가 된다 — `hideTip()` 만 부르면 가만히 있던 포인터 밑에서
   * `pointerenter` 가 다시 쏘여(재렌더) 방금 닫은 말풍선이 되살아난다. 실제로 그랬다.
   */
  let dismissedId = null;

  /**
   * 「Esc 로 닫은 것」을 언제 푸는가 — **떠났을 때**다. 그런데 `blur` · `pointerleave` 를
   * 그대로 믿으면 안 된다. **재렌더가 물건을 새로 만들면서 둘 다 쏘기 때문이다** —
   * 사람은 가만히 있는데 「떠났다」로 읽혀, 닫은 말풍선이 곧바로 되살아났다.
   *
   * 그래서 이벤트를 믿지 않고 **한 박자 뒤에 실제 상태를 본다.** 재렌더라면 그 사이
   * 새 물건이 같은 자리에 서서 다시 포커스를 받거나 포인터 밑에 있다.
   */
  function releaseDismissSoon(id) {
    setTimeout(() => {
      if (dismissedId !== id) return;
      const el = elFor(id);
      if (el && (document.activeElement === el || el.matches(':hover'))) return;
      dismissedId = null;
    }, 0);
  }

  function showTip(item, withActions = false) {
    if (drag) return;
    if (dismissedId === item.id) return;
    tipFromKeyboard = withActions;
    tipOwnerId = item.id;
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

  /**
   * **Esc 로 말풍선을 닫는다** (WCAG 1.4.13 — 떠 있는 것은 닫을 수 있어야 한다).
   *
   * 말풍선은 물건을 가린다. 확대경을 쓰는 사람에게는 화면의 상당 부분이고,
   * 마우스를 못 쓰면 「비켜 두려고 포인터를 치운다」는 방법이 없다.
   *
   * **포커스는 그대로 둔다.** Esc 로 자리까지 잃으면 Tab 을 처음부터 다시 해야 한다.
   * 확대 뷰도 Esc 로 닫히므로, 말풍선이 떠 있을 때만 가로채고 아래로 내려보내지 않는다.
   */
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || tipEl.hidden) return;
    e.stopPropagation();
    dismissedId = tipOwnerId;
    const owner = tipOwnerId && elFor(tipOwnerId);
    hideTip();
    // 「여기에 놓기」 단추 안에 포커스가 있었으면 그 단추가 사라진다 — 주인에게 돌려준다.
    owner?.focus();
  });

  /** 닫기 예약. 새 포커스가 오면 showTip 이 취소한다. */
  let hideTimer = 0;

  function hideTip() {
    clearTimeout(hideTimer);
    hideTimer = 0;
    tipFromKeyboard = false;
    tipOwnerId = null;
    tipEl.hidden = true;
  }

  /** 키보드로 연 말풍선이 지금 살아 있는가 — 포커스가 실험대 안에 남아 있어야 한다. */
  const keyboardTipAlive = () => tipFromKeyboard && layer.contains(document.activeElement);

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

  // 첫 단추에서 Shift+Tab 하면 말풍선을 연 물건으로 돌아간다.
  // 없으면 단추에 들어간 뒤 되돌아 나올 길이 없다 — 들어가는 길만 있고 나오는 길이 없으면
  // 그것도 갇힌 것이다.
  tipEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !e.shiftKey) return;
    const first = tipEl.querySelector('[data-put]');
    if (!first || document.activeElement !== first) return;
    const owner = tipOwnerId && elFor(tipOwnerId);
    if (!owner) return;
    e.preventDefault();
    owner.focus();
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

  /** 흔드는 동안 얼마나 흔들렸는지 보여 준다. 안 보이면 흔드는 중인 줄을 모른다. */
  function updateShakeMeter() {
    let meter = drag.el.querySelector('.smear-meter');
    if (drag.shakeMm <= 0) {
      meter?.remove();
      return;
    }
    if (!meter) {
      meter = document.createElement('div');
      meter.className = 'smear-meter';
      meter.innerHTML = '<i></i>';
      drag.el.appendChild(meter);
    }
    const t = clamp(drag.shakeMm / SHAKE_FULL_MM, 0, 1);
    meter.querySelector('i').style.width = `${(t * 100).toFixed(0)}%`;
  }

  function onPointerDown(e, item, el) {
    if (e.button !== undefined && e.button !== 0) return;
    // 브라우저가 이 물건의 차례라고 했어도, 겹친 자리에서는 겨눈 것이 다를 수 있다.
    const aimed = aimedAt(e.clientX, e.clientY);
    if (aimed && aimed !== item) {
      const ae = elFor(aimed.id);
      if (ae) { item = aimed; el = ae; }
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
      pointerX: e.clientX, pointerY: e.clientY,
      startX: item.x, startY: item.y,
      moved: false, lastDx: 0, lastDy: 0, prevTx: 0, prevTy: 0,
      shakeMm: 0,
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
    drag.pointerX = e.clientX;
    drag.pointerY = e.clientY;
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
    // 흔들기는 **대상이 없다.** 원심관은 어디에 대고 흔드는 것이 아니라 그냥 흔든다.
    if (drag.item.kind === 'tube') {
      drag.shakeMm += Math.hypot(drag.lastDx, drag.lastDy) * k;
      updateShakeMeter();
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
  /**
   * **손가락으로** 탭한 시각. `pointerTapAt` 과 갈라 둔다.
   *
   * `pointerTapAt` 은 「뒤따라올 합성 click 을 삼킨다」는 **다른 목적**이고,
   * 키보드 Enter 에서도 찍힌다. 그걸 「말풍선을 내지 말라」로 같이 읽으면
   * **키보드로 한 번 조작한 순간 그 뒤로 「여기에 놓기」 단추가 다시 안 나온다** —
   * 마우스를 못 쓰는 사람이 첫 조작에서 그대로 갇힌다. 실제로 그렇게 만들었다가 되돌렸다.
   *
   * 포커스 말풍선이 참아야 하는 것은 **손가락 탭 직후** 하나뿐이다.
   *
   * ── 이것은 **둘째 방어선**이다. 지우지 마라 ─────────────────────────
   * 평소에는 `focus` 이벤트가 아예 안 난다 — `onPointerDown` 의 `preventDefault()` 가
   * 포인터로는 포커스가 안 가게 막기 때문이다 (재어 보면 `activeElement` 가 **BODY**).
   * 그래서 한동안 「이 값은 일할 자리가 없다」고 적어 두었는데, **틀렸다.**
   *
   * 둘을 하나씩 빼 보고 알았다:
   *   · `preventDefault()` 만 빼면 → 포커스는 가지만 **말풍선은 안 뜬다** (이 값이 잡는다)
   *   · 둘 다 빼면 → 말풍선이 뜬다
   * 즉 첫째 줄이 뚫리는 순간 실제로 일하는 값이다. 「지금 안 보인다」와 「필요 없다」는 다르다.
   *
   * 그리고 첫째 줄이 뚫릴 자리는 있다. `preventDefault` 가 포커스까지 막는지는 엔진마다
   * 다를 수 있고, **웹킷(아이패드)에서는 확인하지 못했다** — 이 기계에 안 깔려 있다.
   *
   * `scripts/check-bench.mjs` 가 둘을 따로 잰다 — 결과만 보는 검사는
   * 「막았다」와 「막을 일이 없었다」를 구별하지 못한다.
   */
  let fingerTapAt = 0;
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
    el.querySelector('.smear-meter')?.remove();
    clearMarks();

    if (!moved) {
      // 움직이지 않았다면 조작이 아니라 탭이다.
      drag = null;
      pointerTapAt = performance.now();
      // 손가락 탭만 따로 잰다 — 포커스 말풍선이 참아야 하는 것은 이것뿐이다.
      if (e.pointerType !== 'mouse') fingerTapAt = performance.now();
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
    if (run) run(item, target, { shakeMm: drag.shakeMm, lastDx: drag.lastDx, lastDy: drag.lastDy });
    // 흔든 것은 흔든 것이다 — 어디에 놓았는지와 상관없다.
    // 놓을 곳을 찾다가 흔들림이 사라지면, 계량기가 다 찼는데도 아무 일이 안 일어난다.
    else if (item.kind === 'tube' && drag.shakeMm > 0) {
      store.dispatch('SHAKE', { amount: clamp(drag.shakeMm / SHAKE_FULL_MM, 0, 1) });
    }

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
      // 클릭으로 확대 뷰가 열리는 물건. 조작표(tapTable)와 같은 것을 가리켜야 한다.
      if (item.kind === 'paper') el.dataset.zoom = 'paper';
      else if (item.kind === 'tube') el.dataset.zoom = 'tube';
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
      // **마우스가 키보드 사용자의 말풍선을 빼앗지 않게 한다.** 두 자리에서 그랬다:
      //   · 조작하면 실험대가 다시 그려지는데, **가만히 있던 포인터 밑에 새 물건이 들어서면
      //     브라우저가 pointerenter 를 다시 쏜다.** 마우스는 움직이지도 않았다
      //   · pointerleave 가 조건 없이 닫아서, 마우스가 **아무 물건에서나** 벗어나도 닫혔다
      // 둘 다 「여기에 놓기」 단추를 지웠고, 마우스를 못 쓰는 사람에게는 그 단추가
      // 끌어다 놓는 길의 전부다. 마우스끼리 덮어쓰는 것은 그대로 둔다.
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (keyboardTipAlive()) return;
        // 말풍선도 **끌릴 것과 같은 물건**을 가리켜야 한다. 아니면 이름은 추출액인데
        // 끌리는 것은 전개액이 된다 — 화면이 거짓말을 하는 셈이다.
        showTip(aimedAt(e.clientX, e.clientY) ?? item);
      });
      el.addEventListener('pointerleave', () => {
        if (keyboardTipAlive()) return;
        releaseDismissSoon(item.id);
        hideTip();
      });
      // 포커스로 뜬 말풍선에는 **놓을 곳 버튼**이 함께 나온다 — 키보드로 놓는 길이다.
      //
      // 앞서는 `:focus-visible` 로 걸렀다. 그건 브라우저가 「지금 키보드를 쓰는 중인가」를
      // **어림잡는 값**이라, 마우스를 한 번 쓰고 나면 보조기기의 `element.focus()` 를
      // 키보드로 안 쳐 준다 — 그러면 단추가 아예 안 나온다.
      // 막고 싶었던 것은 **손가락 탭 직후** 하나뿐이고, 그건 fingerTapAt 이 정확히 잰다.
      // `pointerTapAt` 을 쓰면 안 된다 — 그건 키보드 Enter 에서도 찍혀서,
      // **키보드로 한 번 조작하면 그 뒤로 단추가 다시 안 나온다.**
      el.addEventListener('focus', () => {
        if (performance.now() - fingerTapAt < POINTER_TAP_GRACE_MS) return;
        showTip(item, true);
      });
      // 포커스가 옮겨 갈 때 blur 가 focus 보다 먼저 온다. 여기서 곧바로 닫으면
      // 옆 물건으로 Tab 한 순간 말풍선이 닫혔다가 다시 열리며 서로를 지운다.
      // 닫기를 한 프레임 미루고, 그 사이 새 포커스가 오면 취소한다.
      el.addEventListener('blur', () => {
        releaseDismissSoon(item.id);
        hideTipSoon();
      });

      // 포인터를 거치지 않고 눌리는 경우 — 보조기기의 element.click() 등.
      // 방금 포인터로 처리했으면 같은 누름이므로 넘긴다.
      el.addEventListener('click', () => {
        if (performance.now() - pointerTapAt < POINTER_TAP_GRACE_MS) return;
        handleTap(item, el);
      });

      /*
       * **Tab 으로 「여기에 놓기」 단추에 들어간다.**
       *
       * 말풍선은 DOM 에서 물건 층(.bench-tokens) **뒤**에 있다. 그냥 두면 물건에서 Tab 이
       * **옆 물건**으로 가고, 그 물건의 focus 가 말풍선을 갈아 끼워 **방금 열려 있던 단추를
       * 지운다.** 그러면 마우스를 못 쓰는 사람에게 그 길은 **아예 없는 길**이 된다.
       *
       * Tab 여든 번을 눌러 봐도 안 닿았다. 검사는 초록불이었다 —
       * `.click()` 으로 **부르고** 있었기 때문이다. 부르는 검사는
       * 「누르면 도는가」만 알려 주고 **「거기까지 갈 수 있는가」는 알려 주지 않는다.**
       * (catalase-lab 세션이 자기 저장소에서 먼저 찾았다.)
       */
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || e.shiftKey || tipEl.hidden) return;
        const first = tipEl.querySelector('[data-put]');
        if (!first) return;
        e.preventDefault();
        first.focus();
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

  /*
   * **화면 크기가 바뀌면 이름표를 다시 앉힌다.**
   *
   * 줄 내림(`--name-row`)은 **그때의 폭에서 잰 값**이다. 창을 줄이거나 폰을 돌리면
   * 물건이 촘촘해지는데 줄 배정은 넓을 때 것 그대로라 **이름표가 서로 겹친다.**
   * 배포본을 폰 폭으로 줄여 재어 보니 일곱 쌍이 겹쳤다 — 새로 열면 0쌍이라
   * 알고리즘이 아니라 **다시 부르지 않는 것**이 문제였다.
   *
   * `resize` 대신 `ResizeObserver` 를 쓴다. 창 크기만이 아니라 옆 칸이 늘고 줄어드는
   * 경우에도 무대 폭이 바뀌는데, 그때는 `resize` 가 안 온다.
   */
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => layoutNames()).observe(layer);
  }

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
    // 바이알 안에 종이가 서 있는 동안만 나온다. 무엇을 꺼내는지 버튼이 직접 말한다 —
    // 종이가 화면에서 사라져 있으므로, 이 버튼이 없으면 다시 집을 길이 없다.
    removePaperBtn.hidden = !st.paper.inVial;
    if (st.paper.inVial) removePaperBtn.textContent = UI.bench.removePaper;
  }

  // 드래그 도중에는 다시 그리지 않는다. TICK 처럼 사용자와 무관하게 들어오는 상태 변경이
  // DOM 을 새로 만들면 setPointerCapture 가 무효화돼 드래그가 조용히 끊긴다.
  // 드래그가 끝나면 onPointerUp 이 최신 상태로 어차피 다시 그린다.
  store.subscribe(() => { renderBar(); renderLock(); if (!drag) renderTokens(); });
  renderTokens();
  renderBar();
  renderLock();
  renderEditPanel();

  // 배치 편집을 껐다 켜는 손잡이. 단축키는 `main.js` 가 쥐고 있다.
  // **`edit` 을 밖으로 내주지 않는다** — 내주면 그 값을 복사해 둔 쪽이 어긋난다.
  return { toggleEdit: () => setEdit(!edit) };
}
