/**
 * 확대 뷰 — 「현미경으로 세포의 크기 측정하기」
 *
 * 실험대에서 하는 일은 물건을 옮기는 것뿐이고, **손끝으로 하는 일은 전부 여기서** 일어난다
 * (`tasks/DESIGN-optics.md` §5.4). 그래서 이 파일이 이 실험의 몸통이다.
 *
 * 세 가지 모드로 열린다 (`src/ui/bench.js` 의 `dropTable`·`tapTable`).
 *
 *   'ocular'  접안 마이크로미터를 접안렌즈에 끼운다. **방향을 학생이 고른다**
 *   'scope'   현미경 관찰 — 찍고, 세고, 기록한다. 여기가 몸통이다
 *   'item'    기구를 크게 그려 라벨을 읽는다. 조작은 없다
 *
 * ── 이 화면이 절대 하지 않는 일 ────────────────────────────────────
 *
 * 1. **겹친 자리를 찾아 주지 않는다.** 강조 표시도, 스냅도 없다 (`DESIGN-rules.md` M-25).
 *    `scale.js` 의 `coincidences()` 를 이 파일에서 부르지 않는 이유가 그것이다 —
 *    형광펜을 칠하는 순간 앱이 학생 대신 본 것이 된다.
 * 2. **눈금값을 배율로 거르지 않는다.** 「이 배율 아님」·「만료」 같은 딱지를 붙이지 않고,
 *    다른 배율에서 구한 값을 골라도 막지 않는다. 목록은 **배율을 함께 사실대로 적을 뿐**이다.
 *    이 셋 중 하나만 해도 이 실험의 학습 목표가 통째로 사라진다 (`DESIGN-rules.md` §6.3).
 * 3. **세어 주지 않는다.** 두 표시 사이가 몇 칸인지 시뮬레이터는 알지만 화면에 내지 않는다.
 *    찍은 자리의 눈금 번호는 규칙이 토스트로 말하고, 뺄셈은 기록이 한다.
 *
 * ── 시야를 두 장 그린다 ────────────────────────────────────────────
 * 시야 원에서는 접안 눈금 한 칸이 1.82 px 라 **셀 수가 없다.** 배율을 올려도 그 값은
 * 변하지 않는다 (`optics.js` §5). 그래서 같은 시야를 한 번 더, 8배로 그리는 띠를 둔다.
 * 600×140 px 은 400배 보정 구간(접안 40칸)이 스크롤 없이 들어오는 크기다 (`ZOOM`).
 *
 * **띠는 시야 원을 확대한 그림이 아니라 `fieldPx` 만 8배로 준 그림이다.**
 * 처음에는 renderFOV 출력의 viewBox 를 좁혀 8배로 보이게 했는데, 그러면 「이 크기에서는
 * 잔눈금을 개별 선으로 못 그린다」는 판정(`canResolveEyepieceTicks`)까지 함께 확대된다 —
 * 옅은 띠가 여덟 배로 커질 뿐 **칸은 여전히 안 보인다.** 세라고 만든 화면에서 셀 수가 없다.
 * 그래서 같은 레이어 함수에 `FIELD_PX × ZOOM.scale` 을 넘겨 다시 그린다.
 *
 * 접안 눈금은 `reticleLayer()` 를 그대로 부른다. 대물 눈금은 `fov.js` 가 내보내지 않아
 * 여기서 같은 기하로 다시 적었다 (`stageStrip`) — **그 함수가 바뀌면 여기도 함께 바꾼다.**
 * 표본은 다시 그리지 않고 시야 원에 그려진 것을 그대로 8배로 키운다. 세포는 눈금자가
 * 아니라서 「이 크기에서 그릴 수 있는가」 판정에 걸리지 않기 때문이다.
 *
 * ── 성능 (`src/render/fov.js` 머리말) ──────────────────────────────
 * 재물대를 끌거나 슬라이더를 쥐고 있는 동안에는 `renderFOV()` 를 다시 부르지 않는다.
 * `#fov-scene` 의 transform, `#fov-blur` 의 stdDeviation, `#fov-dark` 의 opacity 만 손댄다.
 * 뒤의 둘은 반드시 `focusBlurPx(p)`·`hazeOpacity(p)` 를 불러 채운다 — 식을 여기 다시 적으면
 * 전체 렌더와 조용히 어긋난다.
 */

import { renderFOV, reticleLayer, FOV, FIELD_PX, focusBlurPx, hazeOpacity } from '../render/fov.js';
import { observabilityOf } from '../sim/quality.js';
import {
  EYEPIECE, OBJECTIVES, RETICLE_DIVS, ZOOM, MAJOR_EVERY_DIV, STAGE_DIV_UM, STAGE_RULED_UM,
  eyepieceDivPx, stageDivPx, canResolveStageTicks, canResolveStageMajor, magnification,
  focusTolerance,
} from '../sim/optics.js';
import { ITEM_IDS, PICK_KINDS, PAN_LIMIT, fieldParams, focusError } from '../sim/state.js';
import { visibleRange } from '../sim/scale.js';
import { UI } from './strings.js';
import { ASSETS } from '../assets/index.js';
import { PALETTE, INK, STROKE } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';

/**
 * ⚠ `strings.js` 에 아직 없는 문구. **여기 임시로 둔다.**
 *
 * 이 파일을 쓰는 동안 `src/ui/strings.js` 는 다른 사람이 고치고 있어서 손대지 않았다.
 * `UI.zoom` 에 자리가 생기면 그리로 옮기고 이 블록을 통째로 지운다.
 * 어느 문장도 **배율과 한 칸의 길이를 잇는 말**을 하지 않는다 (`strings.js` 머리말).
 */

/** 띠(확대 뷰)에 쓰는 id 앞가지. 한 문서에 같은 id 가 둘이면 앞엣것만 쓰인다 (fov.js 머리말). */
const COUNT = 'count-';

/**
 * `fov.js` 안에만 있는 값들. 내보내지 않으므로 같은 값을 여기 적는다.
 * **그 파일에서 바뀌면 여기도 함께 바꾼다** — 어긋나면 두 그림의 눈금이 서로 다른
 * 길이로 그려지는데, 에러는 나지 않는다.
 */
const TICK_LEN = 6;
const MAJOR_LEN = 11;
const LABEL_SIZE = 8;
/** 접안은 잉크색, 대물은 금속색. 두 자를 눈으로 못 가르면 셀 수가 없다 (fov.js). */
const STAGE_INK = PALETTE.bodyDark[1];
const FIELD_BG = PALETTE.glass[0];
const HAZE = PALETTE.metal[0];

/** 찍은 표시의 색. 눈금선(잉크)·대물 눈금(금속)과 눈으로 갈라져야 학생이 자기 표시를 찾는다. */
/**
 * 찍은 자리 표시 색.
 *
 * 앞서는 바나나랩에서 물려받은 **염색약 색**이었다 — 눈금 찍기가 아이오딘 반응색
 * (`stainStarch`, 거의 검정), 세포 찍기가 수단 Ⅲ 색(붉은색). 이 실험에는 염색약이
 * 없으므로 그 구분에 뜻이 없고, 무엇보다 **검정 표시는 검정 눈금선 위에서 안 보인다.**
 * 「눈금 겹치는 걸 찍었는데 안 보인다」고 걸렸다. 둘 다 **눈금선과 안 겹치는 빨강**을 쓴다.
 */
const MARK = {
  [PICK_KINDS.SCALE]: EXP_PALETTE.mark[0],
  [PICK_KINDS.CELL]: EXP_PALETTE.mark[0],
};

/** 끌었는가 눌렀는가를 가르는 거리 (px). 이보다 안 움직였으면 찍은 것이다. */
const TAP_SLOP_PX = 5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** 재물대에 오르는 기구의 애셋 이름. 상태의 id 와 애셋 키가 다르다. */
const ASSET_OF = { stageMic: 'stagemic', specimen: 'specimen' };

/**
 * 초점 안내 한 줄. **나사가 끝까지 갔으면 그것부터 말한다.**
 *
 * 100배로 올리면 초점이 풀리고, 그때 미동나사만 돌리면 끝에 닿고도 안 맞는다.
 * 그 자리에서 「나사를 돌려 보세요」만 하면 학생은 자기가 잘못하는 줄 알고 계속 돌린다.
 * 재어 보니 끝에 닿은 뒤 스무 번을 더 돌려도 값도 말도 그대로였다.
 * 범위는 `dialHtml` 에 넘기는 span 과 같다 (조동 ±1 · 미동 ±0.2).
 *
 * ★ **고배율(대물 10배 초과)에서는 조동나사로 보내지 않는다** — 거기서 조동나사를 돌리면
 *   유리에 금이 간다 (`rules.js` COARSE_FOCUS). 배율을 내려 맞추고 다시 올리는 길을 말한다.
 *   DOM 없이 판정되도록 `createZoom` 밖에 둔다 — `tests/ui.contract.test.js` 가 잰다.
 */
export function focusLineFor(m, focused) {
  if (focused) return UI.zoom.focusInRange;
  const at = (v, span) => Math.abs(Math.abs(v) - span) < 1e-6;
  if (at(m.fine ?? 0, 0.2)) {
    return (m.objective ?? 4) > 10 ? UI.zoom.focusFineAtEndHighMag : UI.zoom.focusFineAtEnd;
  }
  if (at(m.coarse ?? 0, 1)) return UI.zoom.focusCoarseAtEnd;
  return UI.zoom.focusOutOfRange;
}

export function createZoom(root, store) {
  root.className = 'zoom-overlay';
  root.hidden = true;
  // 닫기 단추는 패널의 **첫 자식**이고 sticky 다. 절대 위치로 두면 창보다 긴 내용이 들어간
  // 작은 화면에서 아래로 스크롤할 때 화면 밖으로 밀려 나가, 나갈 방법이 없어진다.
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
  /** 'item' 모드에서 무엇을 보고 있는가. */
  let itemId = null;
  let opener = null;
  let openerId = null;
  /** 결과를 기록한 직후 화면에 남길 확인 문구. 열 때마다 지운다. */
  let captureNotice = null;
  /**
   * 지금 무엇을 찍는 중인가. **학생이 고른다.**
   * 재물대에 무엇이 올라가 있는지로 앱이 정해 주면, 표본을 올린 채 눈금을 찍어 보는 길이 막힌다.
   */
  let pickKind = PICK_KINDS.SCALE;
  /**
   * 크기를 기록할 때 어느 눈금값을 쓸 것인가.
   *
   * **배율로 거르지 않는다.** 처음 값은 가장 최근에 기록한 것이다 — 「지금 배율의 것」이
   * 아니다. 배율로 고르면 앱이 이 실험의 답을 먼저 말한 것이 되고, 아무것도 안 고르면
   * 학생이 어렵게 구한 눈금값이 안 쓰인 채 빈칸으로 기록된다.
   */
  let chosenCalibration = null;
  /**
   * 재물대를 끌거나 슬라이더를 쥐고 있는 동안에는 구독으로 들어오는 전체 다시 그리기를
   * 건너뛴다. 그리는 도중에 `body.innerHTML` 이 새로 만들어지면 잡고 있던 요소가
   * 통째로 사라져 조작이 끊긴다.
   */
  let busy = false;

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.removeEventListener('keydown', onKeydown);
    // 재물대 이동·초점·조리개·접안렌즈 회전은 드래그 중 skipNotify 로 조용히 갱신됐다.
    // 닫을 때 한 번 전체를 동기화해 실험대(배경)가 최신 상태를 반영하게 한다.
    // 이 notify 가 실험대를 다시 그리면 opener 로 잡아 둔 버튼이 새 요소로 바뀌므로,
    // notify 를 먼저 하고 나서 data-id 로 같은 자리를 찾아 포커스한다.
    store.notify();
    const target = openerId ? document.querySelector(`[data-id="${openerId}"]`) : opener;
    if (target && target.isConnected) target.focus();
    opener = null;
    openerId = null;
  }
  closeBtn.addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });

  /**
   * @param {'scope'|'ocular'|'item'} openMode
   * @param {string|null} openItemId  'item' 모드에서 볼 기구 ('stageMic'|'specimen')
   * @param {HTMLElement|null} openerEl 닫을 때 포커스를 돌려줄 곳
   */
  function open(openMode, openItemId = null, openerEl = null) {
    mode = openMode;
    itemId = openItemId;
    captureNotice = null;
    /**
     * ★ **찍기 모드는 재물대에 올린 것을 따라간다.**
     *
     * 앞서는 열 때마다 늘 「눈금이 겹친 지점 찍기」로 시작했다. 그런데 눈금값을 다 구하고
     * **표본으로 바꾼 뒤**에도 그 모드였고, 안내는 「두 눈금이 딱 맞아떨어진 곳을 두 군데
     * 누르세요」라고 했다 — **겹칠 대물 눈금이 이미 없는데.** 바로 아래 단추는
     * 「세포 크기 기록」이었다. **안내와 단추가 서로 다른 일을 시킨다.**
     * 시킨 대로 하면 엉뚱한 것을 찍고 뜻 없는 크기가 기록된다.
     *
     * **막는 것이 아니다** — 두 단추는 그대로 있고 언제든 바꿔 누를 수 있다
     * (`pickHtml` 머리말). 처음에 무엇이 눌려 있는지만 지금 올린 것에 맞춘다.
     * 배포본을 학생처럼 밟다 찾았다.
     */
    pickKind = store.getState().microscope.stage === 'specimen'
      ? PICK_KINDS.CELL : PICK_KINDS.SCALE;
    // 문자열이 넘어오는 통로가 있다 (bench.js 의 dropTable). 포커스를 줄 수 있는 것만 잡는다.
    opener = (openerEl && typeof openerEl.focus === 'function') ? openerEl : document.activeElement;
    openerId = opener?.dataset?.id ?? null;
    root.hidden = false;
    document.addEventListener('keydown', onKeydown);
    renderBody();
    /**
     * **열 때마다 맨 위에서 시작한다.**
     *
     * 아래쪽 단추(「눈금값 기록」 같은 것)를 누르려고 패널을 내리면 그 자리가 남는다.
     * Esc 로 닫았다 현미경을 다시 눌러도 **내려간 자리 그대로** 열려서, 시야 원이
     * 화면 위로 잘려 **아예 안 보인다** (재어 보니 y = -149). 재물대에 올린 것을 바꾸고
     * 돌아오는 절차(STEP 4·6)에서 매번 지나는 길이라 그때마다 시야가 사라진 것처럼 보인다.
     * 창이 작아서가 아니라 스크롤이 남아서다.
     */
    root.scrollTop = 0;
    panel.scrollTop = 0;
    panel.focus();
  }

  function renderBody() {
    if (mode === 'scope') renderScopeMode();
    else if (mode === 'ocular') renderOcularMode();
    else if (mode === 'item') renderItemMode();
  }

  /* ---------------------------------------------------------------- */
  /* ① 끼우기 모드 — 방향을 학생이 고른다                               */
  /* ---------------------------------------------------------------- */

  /**
   * 접안 마이크로미터를 접안렌즈에 넣는다.
   *
   * **어느 쪽이 옳은지 미리 알려 주지 않는다.** 뒤집어 끼워도 값은 안 틀린다 —
   * 칸 간격이 같기 때문이다. 숫자가 좌우로 뒤집혀 읽기 불편할 뿐이고, 그 사실은
   * 시야가 말한다 (`DESIGN-rules.md` §6.2). 그래서 두 단추를 나란히 둔다.
   */
  /**
   * 접안 마이크로미터 — **원판이 있을 수 있는 자리는 셋이다.**
   *
   *   통 안(`stowed`) · 실험대 위(둘 다 거짓) · 접안렌즈 안(`micrometer`)
   *
   * 세 자리를 오가는 길이 **모두 이 한 화면에 있어야** 한다. 앞서는 통을 누르면
   * 곧장 「넣기」가 일어나 원판이 통 속으로 사라졌고, 꺼내는 길이 없었다 —
   * 다시 누르면 또 넣기라 **되돌아갈 길이 없었다.**
   *
   * 지금 있는 자리에서 **갈 수 있는 곳만** 단추로 낸다. 못 가는 곳을 회색으로 죽여 두지는
   * 않는다 (AGENTS.md §2.1) — 애초에 그 자리에서 할 수 있는 일이 아니면 안 그린다.
   */
  function renderOcularMode() {
    const eye = store.getState().eyepiece;
    const mat = materialFor('ocular');
    const where = eye.micrometer
      ? (eye.flipped ? UI.zoom.insertedFlipped : UI.zoom.inserted)
      : (eye.stowed ? UI.zoom.inCase : UI.zoom.outOfCase);

    // 통 안에 있으면 먼저 꺼내야 끼울 수 있다. 실물이 그렇다.
    const actions = eye.micrometer
      ? `<button type="button" id="ocular-remove">${UI.zoom.remove}</button>`
      : eye.stowed
        ? `<button type="button" class="zoom-action" id="ocular-take-out">${UI.zoom.takeOut}</button>`
        : `<button type="button" class="zoom-action" data-insert="0">${UI.zoom.insert}</button>
           <button type="button" class="zoom-action" data-insert="1">${UI.zoom.insertFlipped}</button>
           <button type="button" id="ocular-put-away">${UI.zoom.putAway}</button>`;

    // 제목도 **어디에 있는지**를 따라간다. 늘 「통」이라고 하면 꺼내 놓았을 때도,
    // 렌즈에 끼웠을 때도 통이라고 말하게 된다 — 바로 아래 단추가 「통에 넣기」인데.
    const title = eye.micrometer ? UI.zoom.ocularModeIn
      : eye.stowed ? UI.zoom.caseMode
        : UI.zoom.ocularMode;

    body.innerHTML = `
      <h2>${title}</h2>
      <div class="zoom-slide-stage" id="ocular-figure"></div>
      <p class="zoom-slide-label" style="margin-top:10px">${where}</p>
      ${mat ? `<p class="zoom-empty">${mat.role}</p>` : ''}
      <div class="zoom-scope-controls" style="margin-top:12px">${actions}</div>`;

    body.querySelector('#ocular-figure').innerHTML =
      ASSETS.ocular.render({ flipped: eye.flipped, inCase: eye.stowed });

    body.querySelectorAll('[data-insert]').forEach((b) => {
      b.addEventListener('click', () => {
        store.dispatch('INSERT_OCULAR', { flipped: b.dataset.insert === '1' });
      });
    });
    // 빼내는 길은 늘 열려 있다 — 뒤집어 끼운 것을 고치는 길이기도 하다 (M-02).
    body.querySelector('#ocular-remove')
      ?.addEventListener('click', () => store.dispatch('REMOVE_OCULAR', {}));
    body.querySelector('#ocular-take-out')
      ?.addEventListener('click', () => store.dispatch('TAKE_OUT_OCULAR', {}));
    body.querySelector('#ocular-put-away')
      ?.addEventListener('click', () => store.dispatch('PUT_AWAY_OCULAR', {}));
  }

  /* ---------------------------------------------------------------- */
  /* ③ 기구 모드 — 크게 보고 라벨을 읽는다. 조작은 없다                  */
  /* ---------------------------------------------------------------- */

  function renderItemMode() {
    const st = store.getState();
    const assetKey = ASSET_OF[itemId];
    if (!assetKey) { body.innerHTML = `<h2>${UI.zoom.scopeMode}</h2>`; return; }
    const it = st.items[itemId];
    const mat = materialFor(assetKey);

    // 지금 재물대에 올라가 있으면 **여기서 내릴 수 있어야** 한다.
    // 상자를 눌러 들여다봤는데 「저기 재물대에 있습니다」만 하고 아무것도 못 하면,
    // 학생은 확대 뷰를 닫고 현미경을 다시 눌러 돌아가야 한다.
    const onStage = st.microscope.stage === itemId;
    const putAway = onStage
      ? (itemId === 'specimen'
        ? `<button type="button" class="zoom-action" id="item-put-away">${UI.zoom.putAwaySpecimen}</button>`
        : `<button type="button" class="zoom-action" id="item-unmount">${UI.bench.unmount(UI.stageShort[itemId])}</button>`)
      : '';

    body.innerHTML = `
      <h2>${UI.zoom.itemMode(UI.stageItems[itemId])}</h2>
      <div class="zoom-slide-stage" id="item-figure"></div>
      <p class="zoom-slide-label" style="margin-top:10px">${
        onStage ? UI.zoom.itemOnStage : UI.zoom.itemInBox}</p>
      ${mat ? `<p class="zoom-empty" style="margin-top:12px">${mat.role}</p>` : ''}
      <div class="zoom-scope-controls" style="margin-top:12px">
        ${putAway}
        ${it.cracked ? `<button type="button" id="item-new">${UI.zoom.newItem}</button>` : ''}
      </div>
      ${it.cracked
        ? `<p class="zoom-empty" data-why="cracked">${UI.zoom.crackedNote(UI.stageShort[itemId])}</p>`
        : ''}`;

    body.querySelector('#item-figure').innerHTML =
      ASSETS[assetKey].render({ cracked: it.cracked, seed: it.seed });
    body.querySelector('#item-new')
      ?.addEventListener('click', () => store.dispatch('NEW_ITEM', { item: itemId }));
    body.querySelector('#item-put-away')
      ?.addEventListener('click', () => store.dispatch('REMOVE_FROM_STAGE', {}));
    body.querySelector('#item-unmount')
      ?.addEventListener('click', () => store.dispatch('REMOVE_FROM_STAGE', {}));
  }

  /** 준비물 표에 적힌 「하는 일」. 기구를 크게 볼 때 읽을 것이 그 한 줄이다. */
  function materialFor(assetKey) {
    return UI.notebook.materials.find((m) => m.asset === assetKey) ?? null;
  }

  /* ---------------------------------------------------------------- */
  /* ② 관찰 모드 — 이 실험의 몸통                                       */
  /* ---------------------------------------------------------------- */

  function renderScopeMode() {
    const st = store.getState();
    const m = st.microscope;
    // 재물대에 무엇이 올라가 있는지는 **지금** 상태에서 읽는다.
    // 열 때 붙잡은 값을 계속 쓰면, 보는 도중에 유리에 금이 가 내려가도(고배율 조동나사)
    // 화면은 옛 시야를 그대로 그린다 — 멀쩡해 보이는 화면이 거짓말을 하게 된다.
    const on = m.stage;
    syncChosenCalibration(st);

    /**
     * 지금 초점이 맞았는가. **절차가 요구하는 바로 그 조건**이다
     * (`progress.js` 의 `focusedOn` 과 같은 식이어야 한다 — 둘이 어긋나면
     * 화면은 「맞았다」는데 노트의 ✓ 가 안 켜진다).
     * 재물대가 비어 있으면 맞출 상대가 없으므로 판정하지 않는다.
     */
    const focused = Boolean(on)
      && focusError(m) <= focusTolerance(m.objective, on === 'stageMic' ? 'micrometer' : 'specimen');

    // 재물대가 비어도 **화면을 접지 않는다.** 정리(조명·최저배율)로 가는 통로가 여기뿐이라,
    // 표본을 상자에 넣고 나면 조명을 끌 길이 사라진다. 시야는 빈 시야를 그리면 된다.
    body.innerHTML = `
      <h2>${UI.zoom.scopeMode}</h2>
      ${on
        ? `<p class="zoom-slide-label">${UI.notebook.onStageLabel} — ${UI.stageItems[on]}</p>`
        : `<p class="zoom-empty">${UI.zoom.emptyStage}</p>`}
      ${crackedHtml(st)}
      ${st.eyepiece.micrometer ? '' : `<p class="zoom-empty">${UI.zoom.noReticle}</p>`}
      <div class="scope-stage">
        <div class="scope-figure" id="scope-figure" aria-hidden="true"></div>
        <div class="zoom-fov" id="fov-slot" tabindex="0" style="touch-action:none"
          role="group" aria-label="${UI.zoom.stageGroup}"></div>
      </div>
      <div class="zoom-fov" id="count-slot" style="touch-action:none;margin-top:10px"
        role="group" aria-label="${UI.zoom.countMode}"></div>
      <p class="zoom-mag-line">${UI.zoom.magLine(EYEPIECE, m.objective, magnification(m.objective))}</p>
      <div class="zoom-gauge" id="quality">
        <div class="bar"><div class="fill" id="zoom-gauge-fill"></div></div>
        <div class="cap"><span>${UI.observability.label}</span><b id="quality-score"></b></div>
        <div class="hint" id="zoom-gauge-hint"></div>
      </div>
      <div class="zoom-scope-controls">
        ${pickHtml(st)}
        ${objectiveHtml(m)}
        <div class="dial-row" id="ctrl-focus">
          ${dialHtml('coarse', UI.zoom.coarseGroup, m.coarse, 1, focused)}
          ${dialHtml('fine', UI.controls.focus, m.fine, 0.2, focused)}
        </div>
        <p class="pick-how" id="focus-readout">${focusLine(m, focused)}</p>
        <div class="ctrl-group" id="ctrl-diaphragm">
          <label for="zoom-diaphragm">${UI.controls.diaphragm}</label>
          <input type="range" id="zoom-diaphragm" min="0" max="1" step="0.02" value="${m.diaphragm}">
        </div>
        ${rotateHtml()}
        ${on === 'stageMic'
          ? `<button type="button" class="zoom-action" id="record-cal">${UI.zoom.recordCalibration}</button>`
          : ''}
        ${calibrationListHtml(st)}
        ${on === 'specimen'
          ? `<button type="button" class="zoom-action" id="record-meas">${UI.zoom.recordMeasurement}</button>`
          : ''}
        <button type="button" class="zoom-action" id="capture">${UI.zoom.capture}</button>
        ${on ? `<button type="button" id="scope-unmount">${UI.bench.unmount(UI.stageShort[on])}</button>` : ''}
        <!--
          「정리」 단추 묶음(조명 끄기 · 최저배율로 내리기)을 뺐다.

          **오직 안전 점수를 위해 있던 것**이다. 최저배율로 내리는 것은 위의 대물렌즈
          단추(4배)가 이미 하고, 조명은 한 번 끄면 다시 켤 길도 없었다.
          지금은 자기 평가가 아무것도 지켜보지 않으므로 남길 이유가 없다 —
          「실제 실험에서는 이런 것들을 해야 합니다」 안내가 그 일을 대신한다.
        -->
      </div>
      ${captureNotice ? `<p class="zoom-empty" id="capture-note">${captureNotice}</p>` : ''}`;

    paintFov();
    paintScopeFigure();
    updateGauge();
    bindGaugeJump();
    bindScopeControls();
  }

  /** 금 간 것이 있으면 왜 그렇게 됐는지까지 말하고, 새것을 꺼내는 길을 연다 (M-23). */
  function crackedHtml(st) {
    const cracked = ITEM_IDS.filter((id) => st.items[id].cracked);
    if (!cracked.length) return '';
    return cracked.map((id) => `
      <p class="zoom-empty" data-why="cracked">${UI.zoom.crackedNote(UI.stageShort[id])}</p>
      <button type="button" data-new-item="${id}">${UI.zoom.newItem}</button>`).join('');
  }

  /**
   * 무엇을 찍는 중인가. 두 단추 중 하나가 눌려 있고, 시야를 누르면 그것으로 찍힌다.
   * **못 하는 조작도 눌린다** — 눈금자가 없는 채로 찍으면 규칙이 결과로 답한다 (`no-scale`).
   */
  function pickHtml(st) {
    const n = st.picks.length;
    return `
      <div class="ctrl-group" role="group" aria-label="${UI.zoom.pickGroup}">
        <span>${UI.zoom.pickGroup}</span>
        <button type="button" data-pick="${PICK_KINDS.SCALE}"
          aria-pressed="${pickKind === PICK_KINDS.SCALE}">${UI.zoom.pickScale}</button>
        <button type="button" data-pick="${PICK_KINDS.CELL}"
          aria-pressed="${pickKind === PICK_KINDS.CELL}">${UI.zoom.pickCell}</button>
        <span>${UI.zoom.pickCount(n)}</span>
        <button type="button" id="clear-picks">${UI.zoom.clearPicks}</button>
      </div>
      <p class="pick-how">${
        pickKind === PICK_KINDS.CELL ? UI.zoom.pickHowCell : UI.zoom.pickHowScale
      } ${UI.zoom.dragHint}</p>`;
  }

  /**
   * 단추에 적히는 숫자는 **대물렌즈 배율**이다. 아래 한 줄이 접안렌즈(고정 10배)와
   * 총배율을 함께 적어 준다 — 곱하는 일만 학생에게 남는다.
   * 배율을 바꾸는 것에 대해 화면은 **눈금값 이야기를 하지 않는다.**
   */
  function objectiveHtml(m) {
    return `
      <div class="ctrl-group" role="group" aria-label="${UI.controls.objective}">
        <span>${UI.controls.objective}</span>
        ${OBJECTIVES.map((o) => `<button type="button" data-obj="${o}"
          aria-pressed="${m.objective === o}">${UI.units.mag(o)}</button>`).join('')}
      </div>`;
  }

  /**
   * 접안렌즈 돌리기. **연속값이다** — 1° 안으로 들어가야 두 눈금자가 나란해진다
   * (`DESIGN-optics.md` §5.3). 슬라이더로 크게 잡고 단추로 1° 씩 다듬는다.
   * 각도를 숫자로 띄우지 않는다 — 학생이 눈금자가 아니라 숫자를 보게 된다 (§5.3 (e)).
   */
  function rotateHtml() {
    return `
      <div class="ctrl-group" id="ctrl-rotate" role="group" aria-label="${UI.zoom.rotateGroup}">
        <span>${UI.controls.rotate}</span>
        <button type="button" id="rotate-left">${UI.zoom.rotateLeft}</button>
        <button type="button" id="rotate-right">${UI.zoom.rotateRight}</button>
      </div>`;
  }

  /**
   * 기록해 둔 눈금값 목록. **배율을 함께 사실대로 적을 뿐**이다.
   *
   * 지금 배율의 것만 남기지 않고, 다른 배율의 것에 딱지도 붙이지 않는다. 어느 것을 골라도
   * 기록되고, 배율이 다르면 규칙이 **두 사실을 나란히 말한다** (`calib-other-mag`).
   * 그 문장은 틀렸다고 하지 않는다 — 무엇이 맞는지는 학생이 두 숫자를 견주어 정한다.
   */
  function calibrationListHtml(st) {
    const rows = st.session.calibrations;
    if (!rows.length) return '';
    return `
      <div class="ctrl-group" style="flex-direction:column;align-items:stretch;gap:6px">
        <span style="min-width:0">${UI.zoom.chooseCalibration}</span>
        ${rows.map((c) => `
          <div style="display:flex;align-items:center;gap:8px">
            <label style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
              <input type="radio" name="cal-pick" value="${c.at}"
                ${c.at === chosenCalibration ? 'checked' : ''}>
              <span>${c.umPerDiv == null
                ? UI.zoom.calibrationBlank
                : UI.zoom.calibrationRow(c.objective, c.umPerDiv.toFixed(2))}</span>
            </label>
            <button type="button" data-del-cal="${c.at}">${UI.zoom.recordDelete}</button>
          </div>`).join('')}
      </div>`;
  }

  /** 지운 기록을 계속 가리키고 있지 않게 한다. 아직 아무것도 안 골랐으면 가장 최근 것. */
  function syncChosenCalibration(st) {
    const rows = st.session.calibrations;
    if (chosenCalibration !== null && !rows.some((c) => c.at === chosenCalibration)) {
      chosenCalibration = null;
    }
    if (chosenCalibration === null && rows.length) chosenCalibration = rows[rows.length - 1].at;
  }

  /* ---------------------------------------------------------------- */
  /* 시야 두 장 — 원과 띠                                               */
  /* ---------------------------------------------------------------- */

  /** 지금 화면에 있는 시야 SVG 들. 원과 띠 둘 다 잡힌다. */
  const fovSvgs = () => [...body.querySelectorAll('.zoom-fov svg')];

  /** SVG 의 지금 viewBox. 원과 띠는 **같은 자리를 중심으로** 그려진다. */
  function viewOf(svg) {
    const [x, y, w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }

  function paintFov() {
    const st = store.getState();
    const p = fieldParams(st);
    const slot = body.querySelector('#fov-slot');
    const strip = body.querySelector('#count-slot');
    if (!slot) return;

    slot.innerHTML = renderFOV(p);
    decorate(slot.querySelector('svg'), 1);
    bindField(slot.querySelector('svg'));

    if (!strip) return;
    // 표본은 다시 그리지 않고 시야 원에 그려진 것을 그대로 가져와 8배로 키운다.
    // 세포는 눈금자가 아니라서 「이 크기에서 그릴 수 있는가」 판정에 걸리지 않는다.
    const cells = p.on === 'specimen' ? (slot.querySelector('#fov-scene')?.innerHTML ?? '') : '';
    strip.innerHTML = countStrip(p, cells);
    const svg = strip.querySelector('svg');
    // `.zoom-fov svg` 의 max-width 290 px 를 넘겨야 한 칸이 14.6 px 로 그려진다.
    svg.style.maxWidth = `${ZOOM.width}px`;
    decorate(svg, ZOOM.scale);
    bindField(svg);
  }

  /**
   * 세는 곳 — 접안 눈금과 대물 눈금을 8배로 그린 띠.
   *
   * 레이어 순서와 변환은 `renderFOV()` 와 같다. 재물대 위의 것만 이동·회전·흐림을 받고,
   * 접안 눈금은 아무것도 안 받는다 — 접안렌즈 **안**에 있기 때문이다.
   * id 를 `count-` 로 시작하게 두어 부분 갱신(`[id$="fov-scene"]` 등)이 그대로 닿게 한다.
   */
  function countStrip(p, cells) {
    const fieldPx = FIELD_PX * ZOOM.scale;
    const { cx: CX, cy: CY } = FOV;
    const x0 = CX - ZOOM.width / 2;
    const y0 = CY - ZOOM.height / 2;
    const id = (name) => `${COUNT}${name}`;

    let inner = '';
    if (p.on === 'stageMic') {
      inner = `<g transform="rotate(${(p.itemAngle || 0).toFixed(2)} ${CX} ${CY})">`
        + `${stageStrip(p.objective, fieldPx)}</g>`;
    } else if (cells) {
      // 시야 원의 그림을 시야 중심을 축으로 8배. 안에 든 것은 이미 회전까지 마쳤다.
      inner = `<g transform="translate(${CX},${CY}) scale(${ZOOM.scale}) translate(${-CX},${-CY})">${cells}</g>`;
    }

    const blur = focusBlurPx(p) * ZOOM.scale;
    const pan = `translate(${(-(p.panX || 0) * ZOOM.scale).toFixed(1)},`
      + `${(-(p.panY || 0) * ZOOM.scale).toFixed(1)})`;

    return `<svg viewBox="${x0} ${y0} ${ZOOM.width} ${ZOOM.height}" role="img"
  aria-label="${UI.zoom.countMode}">
  <defs>
    <filter id="${id('fov-blur')}" data-scale="${ZOOM.scale}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/></filter>
  </defs>
  <rect x="${x0}" y="${y0}" width="${ZOOM.width}" height="${ZOOM.height}" fill="${FIELD_BG}"/>
  <g filter="url(#${id('fov-blur')})">
    <g id="${id('fov-scene')}" data-scale="${ZOOM.scale}" transform="${pan}">${inner}</g>
  </g>
  <g id="${id('fov-reticle')}">${
    p.hasReticle ? reticleLayer(fieldPx, { flipped: p.flipped, angleDeg: p.eyeAngle || 0 }) : ''
  }</g>
  <rect id="${id('fov-dark')}" x="${x0}" y="${y0}" width="${ZOOM.width}" height="${ZOOM.height}"
    fill="${HAZE}" opacity="${hazeOpacity(p).toFixed(2)}"/>
</svg>`;
  }

  /**
   * 대물 마이크로미터 한 겹 — `fov.js` 의 `stageMicrometerLayer` 와 **같은 기하**다.
   * 그 함수를 내보내지 않아 여기 다시 적었다. 한쪽만 고치면 두 그림의 눈금이
   * 서로 다른 자리에 서는데 에러는 나지 않는다. 고칠 일이 생기면 둘을 함께 본다.
   *
   * 접안 눈금은 축에서 **아래로**, 대물 눈금은 **위로** 뻗는다. 두 자가 같은 선을 쓰되
   * 겹쳐 뭉개지지 않아야 어느 눈금선끼리 짝인지 눈으로 고를 수 있다.
   */
  function stageStrip(objective, fieldPx) {
    const { cx: CX, cy: CY } = FOV;
    const divPx = stageDivPx(objective, fieldPx);
    const divs = STAGE_RULED_UM / STAGE_DIV_UM;
    const span = divs * divPx;
    const x0 = CX - span / 2;
    const at = (k) => x0 + k * divPx;

    let ticks = '';
    if (canResolveStageTicks(objective, fieldPx)) {
      for (let k = 0; k <= divs; k++) {
        if (k % MAJOR_EVERY_DIV === 0) continue;
        const x = at(k).toFixed(2);
        ticks += `<line x1="${x}" y1="${CY}" x2="${x}" y2="${CY - TICK_LEN}"/>`;
      }
    }
    let majors = '', labels = '';
    if (canResolveStageMajor(objective, fieldPx)) {
      for (let k = 0; k <= divs; k += MAJOR_EVERY_DIV) {
        const x = at(k).toFixed(2);
        majors += `<line x1="${x}" y1="${CY}" x2="${x}" y2="${CY - MAJOR_LEN}"/>`;
        // 번호는 µm 로 적는다. **이 실험에서 학생이 아는 값은 이것뿐**이다.
        // 8배에서는 굵은 눈금 간격이 늘 58 px 이상이라 네 자리도 여유 있게 들어간다.
        labels += `<text x="${x}" y="${CY - MAJOR_LEN - 3}">${k * STAGE_DIV_UM}</text>`;
      }
    }
    const axis = `<line x1="${x0.toFixed(2)}" y1="${CY}" x2="${(x0 + span).toFixed(2)}" y2="${CY}"/>`;
    return `<g stroke="${STAGE_INK}" fill="none" stroke-linecap="butt">`
      + `<g stroke-width="${STROKE.hair}">${axis}${ticks}</g>`
      + `<g stroke-width="${STROKE.detail}">${majors}</g></g>`
      + (labels
        ? `<g font-family="ui-monospace, monospace" font-size="${LABEL_SIZE}" text-anchor="middle"`
          + ` fill="${STAGE_INK}">${labels}</g>`
        : '');
  }

  /**
   * 찍은 지점을 시야 위에 얹는다. **그림에 손대지 않고 위에 한 겹 더 올린다** —
   * 그린 것과 학생이 표시한 것이 섞이면 무엇이 관찰이고 무엇이 자기 표시인지 알 수 없다.
   *
   * @param {number} scale 이 뷰가 접안 눈금을 몇 배로 그렸는가 (원 1배, 띠 8배)
   */
  function decorate(svg, scale) {
    svg.dataset.scale = String(scale);
    svg.querySelector('.picks-layer')?.remove();
    svg.insertAdjacentHTML('beforeend', picksLayer(store.getState(), svg, scale));
  }

  /** 접안 눈금 100칸이 그 뷰에서 차지하는 길이의 절반 (SVG 좌표). */
  const halfSpan = (scale) => (RETICLE_DIVS * eyepieceDivPx(FIELD_PX * scale)) / 2;

  /**
   * 찍은 자리를 다시 화면 위치로 옮긴다.
   *
   * `pickAt()` 이 −1~1 을 「시야에 남아 있는 눈금 구간」에 펴 바르므로 (`scale.js`),
   * 되돌리는 식도 같은 구간을 쓴다. 그래야 **누른 자리에 표시가 뜬다** —
   * 다른 식으로 되돌리면 재물대를 옮겼을 때 표시가 손끝에서 떨어져 나간다.
   */
  function pointOfDiv(st, eyeDiv, center, scale) {
    const r = visibleRange(st);
    const span = r.to - r.from;
    const t = (span > 0 ? ((eyeDiv - r.from) / span) * 2 - 1 : 0) * halfSpan(scale);
    const a = ((st.eyepiece.angleDeg ?? 0) * Math.PI) / 180;
    return { x: center.cx + t * Math.cos(a), y: center.cy + t * Math.sin(a) };
  }

  function picksLayer(st, svg, scale) {
    if (!st.picks.length) return '';
    const center = viewOf(svg);
    const a = ((st.eyepiece.angleDeg ?? 0) * Math.PI) / 180;
    // 표시는 접안 눈금자와 **직각**으로 선다. 눈금자를 돌리면 표시도 함께 돈다.
    const nx = -Math.sin(a), ny = Math.cos(a);
    // 표시의 길이. 두 뷰 모두 1 단위가 화면 1 px 안팎이라 같은 값을 쓴다.
    const arm = Math.min(14, center.h * 0.3);
    const marks = st.picks.map((pick, i) => {
      const c = MARK[pick.kind] ?? INK;
      const q = pointOfDiv(st, pick.eyeDiv, center, scale);
      const x1 = (q.x - nx * arm).toFixed(2), y1 = (q.y - ny * arm).toFixed(2);
      const x2 = (q.x + nx * arm).toFixed(2), y2 = (q.y + ny * arm).toFixed(2);
      return `<g stroke="${c}" fill="${c}">`
        + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`
        + ` stroke-width="${STROKE.detail}"/>`
        + `<circle cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="2.4" stroke="none"/>`
        + `<text x="${(q.x + 3).toFixed(2)}" y="${(q.y - 5).toFixed(2)}"`
        + ` font-family="ui-monospace, monospace" font-size="9"`
        + ` stroke="none">${i + 1}</text></g>`;
    }).join('');
    return `<g class="picks-layer" aria-hidden="true">${marks}</g>`;
  }

  /* ---------------------------------------------------------------- */
  /* 시야에서 찍기와 재물대 옮기기                                      */
  /* ---------------------------------------------------------------- */

  /** 화면 좌표를 이 SVG 의 좌표로. viewBox 와 그려진 상자의 가로세로비가 같아 선형이다. */
  function svgPointOf(svg, e) {
    const r = svg.getBoundingClientRect();
    const v = viewOf(svg);
    return {
      x: v.x + ((e.clientX - r.left) / (r.width || 1)) * v.w,
      y: v.y + ((e.clientY - r.top) / (r.height || 1)) * v.h,
    };
  }

  /**
   * 시야를 누르면 찍고, 끌면 재물대가 움직인다.
   *
   * **겹친 자리로 끌어당기지 않는다** (스냅 없음). 안 겹친 자리를 찍으면 그 어긋남이
   * `gap` 으로 남아 눈금값에 그대로 섞인다 (M-26). 찾는 일은 학생 눈이 한다.
   */
  function bindField(svg) {
    let drag = null;

    svg.addEventListener('pointerdown', (e) => {
      // 포인터를 잡는 데 실패해도 끌기 자체는 이어져야 한다. 잡기는 편의이지 전제가 아니다.
      // 여기서 예외가 새면 **그 뒤 코드가 통째로 안 돌아** 찍기가 조용히 안 먹는다.
      try { svg.setPointerCapture(e.pointerId); } catch { /* 잡지 못해도 계속한다 */ }
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
      busy = true;
    });

    svg.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX; drag.lastY = e.clientY;
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > TAP_SLOP_PX) drag.moved = true;
      if (!drag.moved) return;
      // 상은 재물대와 반대로 움직인다 — 손가락을 따라 그림이 움직이려면 부호를 뒤집는다.
      store.dispatch('MOVE_STAGE', { dx: -dx, dy: -dy }, { skipNotify: true });
      updateScene();
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      try { svg.releasePointerCapture(e.pointerId); } catch { /* 안 잡혔으면 놓을 것도 없다 */ }
      const tapped = !drag.moved;
      drag = null;
      busy = false;
      if (tapped) pickAtPoint(svg, e);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }

  function pickAtPoint(svg, e) {
    const st = store.getState();
    const v = viewOf(svg);
    const pt = svgPointOf(svg, e);
    const a = ((st.eyepiece.angleDeg ?? 0) * Math.PI) / 180;
    // 누른 자리를 **접안 눈금자의 축 위로** 내린다. 눈금자를 돌려 놓아도
    // 눈금 위를 누르면 그 눈금이 잡힌다.
    const t = (pt.x - v.cx) * Math.cos(a) + (pt.y - v.cy) * Math.sin(a);
    dispatchPick(clamp(t / halfSpan(scaleOf(svg)), -1, 1));
  }

  /** 이 뷰가 접안 눈금을 몇 배로 그렸는가. 시야 원은 1배, 세는 띠는 8배. */
  const scaleOf = (el) => Number(el.dataset.scale) || 1;

  function dispatchPick(xNorm) {
    store.dispatch(pickKind === PICK_KINDS.CELL ? 'PICK_CELL' : 'PICK_SCALE', { x: xNorm });
  }

  /* ---------------------------------------------------------------- */
  /* 부분 갱신 — 시야를 다시 그리지 않고 속성만 손본다                   */
  /* ---------------------------------------------------------------- */

  /**
   * `#fov-scene` 의 transform 만 갱신한다. 문자열 모양은 fov.js 와 같아야 한다.
   * 세는 띠는 8배로 그려져 있으므로 같은 이동을 8배로 준다 (`data-scale`).
   */
  function updateScene() {
    const m = store.getState().microscope;
    body.querySelectorAll('[id$="fov-scene"]').forEach((el) => {
      const s = scaleOf(el);
      el.setAttribute('transform',
        `translate(${(-m.panX * s).toFixed(1)},${(-m.panY * s).toFixed(1)})`);
    });
  }

  /** `#fov-blur` 의 stdDeviation 만 갱신한다. **식은 fov.js 가 갖는다.** */
  function updateBlur() {
    const blur = focusBlurPx(fieldParams(store.getState()));
    body.querySelectorAll('[id$="fov-blur"]').forEach((f) => {
      f.querySelector('feGaussianBlur')?.setAttribute('stdDeviation', (blur * scaleOf(f)).toFixed(2));
    });
  }

  /** `#fov-dark` 의 opacity 만 갱신한다. **식은 fov.js 가 갖는다.** */
  function updateDark() {
    const haze = hazeOpacity(fieldParams(store.getState()));
    body.querySelectorAll('[id$="fov-dark"]').forEach((el) => el.setAttribute('opacity', haze.toFixed(2)));
  }

  /**
   * 접안 눈금 레이어의 회전만 갱신한다.
   *
   * 시야 한 장을 다시 그리는 것은 비싸고(저배율 표피세포가 천 개 넘는다) 슬라이더는
   * 한 번 끄는 동안 수십 번 값을 낸다. 회전각은 상태에서 그대로 오므로 식이 없다 —
   * `rotate()` 문자열 모양만 fov.js 의 `reticleLayer` 와 같게 적는다.
   */
  function updateReticle() {
    const st = store.getState();
    const deg = (st.eyepiece.angleDeg ?? 0).toFixed(2);
    for (const svg of fovSvgs()) {
      const v = viewOf(svg);
      const g = svg.querySelector('[id$="fov-reticle"] > g');
      if (g) g.setAttribute('transform', `rotate(${deg} ${v.cx} ${v.cy})`);
      // 찍은 표시도 눈금자를 따라 돈다. 안 돌리면 표시가 눈금에서 떨어져 나간다.
      decorate(svg, scaleOf(svg));
    }
  }

  function updateGauge() {
    const q = observabilityOf(store.getState());
    const fill = body.querySelector('#zoom-gauge-fill');
    if (!fill) return;
    fill.style.width = `${q.score}%`;
    body.querySelector('#quality-score').textContent = q.score;
    // 깎인 것이 없으면(worst === null) 나무랄 것이 없다. 없는 잘못을 지어내지 않는다.
    body.querySelector('#zoom-gauge-hint').innerHTML = q.worst
      // 항목 이름만으로는 **무엇을 만지라는 것인지 알 수 없다.** 손잡이까지 말한다.
      ? UI.observability.hint(`<b id="quality-worst">${UI.observability.worst[q.worst]}</b>`,
                              fixHtml(q.worst))
      : UI.observability.allGood;
  }

  /* ---------------------------------------------------------------- */
  /* 조작 붙이기                                                        */
  /* ---------------------------------------------------------------- */

  function bindScopeControls() {
    // 무엇을 찍을지 고르기 — 상태를 바꾸지 않으므로 화면만 다시 그린다.
    body.querySelectorAll('[data-pick]').forEach((b) => {
      b.addEventListener('click', () => { pickKind = b.dataset.pick; renderBody(); });
    });
    body.querySelector('#clear-picks')
      .addEventListener('click', () => store.dispatch('CLEAR_PICKS', {}));

    body.querySelectorAll('[data-obj]').forEach((b) => {
      b.addEventListener('click', () =>
        store.dispatch('SET_OBJECTIVE', { objective: Number(b.dataset.obj) }));
    });
    body.querySelectorAll('[data-new-item]').forEach((b) => {
      b.addEventListener('click', () => store.dispatch('NEW_ITEM', { item: b.dataset.newItem }));
    });

    bindDial('coarse', 'COARSE_FOCUS', 0.5);
    bindDial('fine', 'FINE_FOCUS', 0.16);
    bindDiaphragm();
    bindRotate();
    bindFovKeys();

    // 재물대에 그것이 올라가 있을 때만 있는 단추다 (`renderScopeMode`).
    // 표본을 올려 놓고 「눈금값 기록」을 누를 일은 없다 — 눈금자가 거기 없다.
    body.querySelector('#record-cal')
      ?.addEventListener('click', () => store.dispatch('RECORD_CALIBRATION', {}));
    body.querySelector('#record-meas')?.addEventListener('click', () => {
      store.dispatch('RECORD_MEASUREMENT', { calibrationAt: chosenCalibration });
    });
    body.querySelectorAll('input[name="cal-pick"]').forEach((r) => {
      r.addEventListener('change', () => { chosenCalibration = Number(r.value); });
    });
    body.querySelectorAll('[data-del-cal]').forEach((b) => {
      b.addEventListener('click', () =>
        store.dispatch('DELETE_CALIBRATION', { at: Number(b.dataset.delCal) }));
    });

    // 기록이 됐다는 말은 규칙이 아니라 화면이 한다. reduce() 쪽에서 말하게 하면
    // 성공한 조작에 결과 태그가 붙어 "정상 경로는 태그 없이 끝난다" 는 계약이 깨진다.
    body.querySelector('#capture').addEventListener('click', () => {
      const before = store.getState().session.captures.length;
      const r = store.dispatch('CAPTURE', {});
      const after = r.state.session.captures.length;
      captureNotice = after > before ? UI.zoom.captureSaved(after) : null;
      renderBody();
    });

    body.querySelector('#scope-unmount')
      ?.addEventListener('click', () => store.dispatch('REMOVE_FROM_STAGE', {}));
    // 정리 — 시야로는 말할 수 없는 것들. 실험대에 자리가 없어 여기가 유일한 통로다.

  }

  function bindDiaphragm() {
    const el = body.querySelector('#zoom-diaphragm');
    el.addEventListener('pointerdown', () => { busy = true; });
    el.addEventListener('input', () => {
      store.dispatch('SET_DIAPHRAGM', { value: Number(el.value) }, { skipNotify: true });
      updateDark();
      updateGauge();
    });
    el.addEventListener('change', () => { busy = false; });
  }

  /**
   * 접안렌즈 돌리기 — **단추만 있다.** 규칙이 받는 것은 절대각이 아니라 **차이**다.
   *
   * 앞서는 0~360° 절대각 슬라이더가 함께 있었다. 그런데 시작 각도가 시드에 따라
   * 6~22° 어디든 될 수 있어서 **손잡이가 눈금자와 엉뚱한 자리에서 만난다** —
   * 학생이 보기에 슬라이더 위치와 화면의 눈금자가 서로 안 맞는다. 실제로 걸렸다.
   * 맞추는 일은 「지금보다 조금 왼쪽/오른쪽」이지 「몇 도로」가 아니므로 단추가 맞다
   * (`DESIGN-optics.md` §5.3 (e) — 각도를 숫자로 띄우지 않는다).
   */
  function bindRotate() {
    const step = (d) => store.dispatch('ROTATE_EYEPIECE', { deltaDeg: d });
    body.querySelector('#rotate-left').addEventListener('click', () => step(-1));
    body.querySelector('#rotate-right').addEventListener('click', () => step(1));
  }

  /**
   * 시야에서의 키보드.
   *
   * 화살표로 재물대를 옮기고, Enter 로 **시야 한가운데**를 찍는다. 마우스 없이 쓰는 사람에게
   * 「가운데에 놓고 찍는다」가 곧 이 실험의 중앙 정렬 단계이기도 하다.
   */
  function bindFovKeys() {
    const slot = body.querySelector('#fov-slot');
    slot.addEventListener('keydown', (e) => {
      const step = PAN_LIMIT / 12;
      if (e.key === 'ArrowLeft') store.dispatch('MOVE_STAGE', { dx: -step });
      else if (e.key === 'ArrowRight') store.dispatch('MOVE_STAGE', { dx: step });
      else if (e.key === 'ArrowUp') store.dispatch('MOVE_STAGE', { dy: -step });
      else if (e.key === 'ArrowDown') store.dispatch('MOVE_STAGE', { dy: step });
      else if (e.key === 'Enter' || e.key === ' ') dispatchPick(0);
      else return;
      e.preventDefault();
    });
  }

  /* ---------------------------------------------------------------- */
  /* 나사 다이얼 · 현미경 그림                                          */
  /* ---------------------------------------------------------------- */

  /**
   * 나사 다이얼. **테두리에 지금 값이 게이지로 찬다.**
   *
   * 앞서는 손잡이 홈과 바늘뿐이라, 돌려도 **얼마나 돌렸는지도 초점이 맞았는지도**
   * 알 수 없었다. 그래서 「초점을 맞추세요」가 무엇을 하라는 말인지 알 수 없는 절차였다.
   * 게이지가 답을 말해 주지는 않는다 — 숫자를 띄우지 않고, 지금 자리와 **맞은 자리에
   * 들어왔는지**만 보인다. 어디로 돌릴지는 화면의 눈금을 보고 학생이 정한다.
   *
   * `focused` 는 지금 배율·재물대에서 초점이 허용 범위 안인가다. 이 실험의 절차
   * 「또렷해지도록 초점 맞추기」가 바로 이 조건이라(`progress.js` 의 `focusedOn`),
   * **학생이 그 조건을 눈으로 볼 수 있어야** 절차가 성립한다.
   *
   * @param {number} value  지금 값
   * @param {number} span   이 나사가 돌 수 있는 폭 (±span)
   * @param {boolean} focused  지금 초점이 맞았는가
   */
  /**
   * 테두리 게이지 호 하나. **그리는 곳과 갱신하는 곳이 같은 함수를 써야** 한다 —
   * 따로 적으면 돌렸을 때와 처음 그렸을 때의 모양이 어긋난다.
   */
  /**
   * 게이지가 가리키는 조작으로 **데려간다.**
   *
   * 안내는 손잡이 이름을 말한다 — 「**「접안렌즈 돌리기」**로 두 눈금자를 나란히 맞추세요」.
   * 그런데 그 단추는 **화면 밖 아래**에 있다. 폰(390×844)에서 재 보니 확대 뷰는
   * 1430px 인데 보이는 것은 812px 뿐이고, 돌리기 단추는 **1.5화면 아래**였다.
   * 이름을 말해 놓고 어디 있는지는 안 알려 주면, 학생은 있는 것을 못 찾고 멈춘다.
   * 배포본을 폰 폭으로 플레이하다 재서 알았다.
   *
   * 문장을 누르면 그 손잡이로 굴러간다. 문장은 그대로 두고 **누를 수 있게만** 한다 —
   * 새 단추를 만들면 화면에 글자가 하나 더 늘고, 늘어난 만큼 또 아래로 밀린다.
   */
  const JUMP_TO = { align: 'ctrl-rotate', focus: 'ctrl-focus', contrast: 'ctrl-diaphragm' };

  function fixHtml(worst) {
    const fix = UI.observability.fix[worst];
    if (!fix) return fix;
    const to = JUMP_TO[worst];
    // 갈 곳이 없는 것(`equipped` 는 실험대, `span` 은 시야 자체)은 그냥 문장으로 둔다.
    return to ? `<button type="button" class="gauge-jump" data-jump="${to}">${fix}</button>` : fix;
  }

  /** 게이지 칸은 통째로 다시 그려지므로, 듣는 자리는 **바깥**(`#quality`)에 한 번만 둔다. */
  function bindGaugeJump() {
    const g = body.querySelector('#quality');
    if (!g || g.dataset.jumpBound) return;
    g.dataset.jumpBound = '1';
    g.addEventListener('click', (e) => {
      const to = e.target.closest('[data-jump]')?.dataset.jump;
      if (!to) return;
      const el = body.querySelector(`#${to}`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      // 굴러간 자리를 눈으로 찾게 한다 — 화면이 움직인 것만으로는 어디를 보라는 것인지 모른다.
      el.classList.add('ctrl-hilite');
      setTimeout(() => el.classList.remove('ctrl-hilite'), 1400);
    });
  }

  function gaugeArc(value, span, focused) {
    // 게이지는 12시에서 시작해 좌우로 찬다 — 0 이 한가운데다.
    const t = clamp(value / span, -1, 1);
    const sweep = 150;                       // 한쪽으로 도는 최대 각도(°)
    const ang = t * sweep;
    const R = 27;
    const pt = (deg) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return [(32 + R * Math.cos(a)).toFixed(2), (32 + R * Math.sin(a)).toFixed(2)];
    };
    const [x0, y0] = pt(0);
    const [x1, y1] = pt(ang);
    if (Math.abs(ang) < 0.5) return '';
    return `<path class="dial-gauge"
      d="M ${x0} ${y0} A ${R} ${R} 0 ${Math.abs(ang) > 180 ? 1 : 0} ${ang > 0 ? 1 : 0} ${x1} ${y1}"
      fill="none" stroke="${focused ? EXP_PALETTE.mark[0] : PALETTE.metal[1]}"
      stroke-width="${STROKE.outline}" stroke-linecap="round"/>`;
  }

  /**
   * 초점 안내 한 줄. **나사가 끝까지 갔으면 그것부터 말한다.**
   *
   * 100배로 올리면 초점이 풀리고, 그때 미동나사만 돌리면 끝에 닿고도 안 맞는다.
   * 그 자리에서 「나사를 돌려 보세요」만 하면 학생은 자기가 잘못하는 줄 알고 계속 돌린다.
   * 재어 보니 끝에 닿은 뒤 스무 번을 더 돌려도 값도 말도 그대로였다.
   * 범위는 `dialHtml` 에 넘기는 span 과 같다 (조동 ±1 · 미동 ±0.2).
   */
  /**
   * ★ **`role="slider"` 에는 범위가 있어야 한다.**
   *
   * `aria-valuenow` 만 두고 `aria-valuemin`/`max` 를 안 주면, 낭독기는 **0~100 을 가정**하고
   * `0.800` 을 「100 중 0.8」로 읽는다. 눈으로 보는 학생은 손잡이가 어디쯤인지 그림으로
   * 아는데, 낭독기로 오는 학생은 **끝에 닿았는지조차 알 수 없다.**
   * 이 저장소가 `disabled` 를 안 쓰는 것과 같은 이유다 — 그 길로 오는 학생을 안 버린다.
   * 범위는 `rules.js` 의 clamp 와 같다 (조동 ±1 · 미동 ±0.2).
   */
  const focusLine = focusLineFor;

  function dialHtml(name, label, value, span, focused) {
    const arc = gaugeArc(value, span, focused);
    return `
      <div class="dial-cell">
        <div class="dial" id="dial-${name}" role="slider" tabindex="0"
          data-focused="${focused}"
          aria-label="${label}" aria-valuenow="${value.toFixed(3)}"
          aria-valuemin="${(-span).toFixed(3)}" aria-valuemax="${span.toFixed(3)}"
          aria-valuetext="${focused ? UI.zoom.focusInRange : UI.zoom.focusOutOfRange}">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="27"
              fill="${PALETTE.metal[0]}" stroke="${PALETTE.metal[1]}" stroke-width="${STROKE.outline}"/>
            ${arc}
            <g class="dial-mark">
              <!-- 손잡이 홈. 돌리는 물건이라는 것이 눈에 보여야 돌려 볼 생각을 한다. -->
              ${Array.from({ length: 12 }, (_, i) => {
                const a = (i * 30 * Math.PI) / 180;
                const x1 = 32 + 21 * Math.sin(a), y1 = 32 - 21 * Math.cos(a);
                const x2 = 32 + 26 * Math.sin(a), y2 = 32 - 26 * Math.cos(a);
                return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                  stroke="${PALETTE.metal[1]}" stroke-width="${STROKE.detail}" stroke-linecap="round"/>`;
              }).join('')}
              <line x1="32" y1="32" x2="32" y2="10"
                stroke="${PALETTE.metal[1]}" stroke-width="${STROKE.outline}" stroke-linecap="round"/>
            </g>
          </svg>
        </div>
        <span class="dial-label">${label}</span>
      </div>`;
  }

  /**
   * 나사를 돌린다. 다이얼 한가운데를 축으로 삼아, 포인터가 돈 각도만큼 값을 바꾼다.
   * 슬라이더나 ▲▼ 가 아니라 **돌리는 것**이어야 하는 이유는 실물이 그렇기 때문이다.
   */
  /**
   * 나사를 돌린 뒤 **테두리 게이지와 초점 문장을 다시 그린다.**
   *
   * ★ 나사는 `skipNotify: true` 로 보낸다 — 매 프레임 `renderFOV` 를 다시 부르지 않으려는
   *   것이다. 그래서 `store.subscribe` 가 안 불리고, **손으로 갱신하는 것만 바뀐다.**
   *   앞서는 흐림·게이지·현미경 그림만 갱신했다. 그러니 나사를 끝까지 돌려 초점이 맞아도
   *   테두리 호는 처음 자리에 멈춰 있고, 밑의 문장은 계속 「아직 초점이 맞지 않았습니다」
   *   라고 말했다 — **눈금은 칼같이 또렷하고 점수는 99인데** 화면이 아니라고 우겼다.
   *   (조리개·재물대 끌기 뒤에도 안 풀리고, 보통 dispatch 를 한 번 태워야 풀렸다)
   *
   *   `skipNotify` 로 보내는 조작은 **바뀌는 것을 하나도 빠짐없이 손으로 갱신해야 한다.**
   *   하나 빠뜨리면 화면의 그 부분만 옛날을 말하고, 콘솔에는 아무것도 안 남는다.
   */
  function updateFocusReadout() {
    const st = store.getState();
    const m = st.microscope;
    const on = m.stage;
    const focused = Boolean(on)
      && focusError(m) <= focusTolerance(m.objective, on === 'stageMic' ? 'micrometer' : 'specimen');
    for (const [name, span] of [['coarse', 1], ['fine', 0.2]]) {
      const el = body.querySelector(`#dial-${name}`);
      if (!el) continue;
      const value = m[name] ?? 0;
      el.dataset.focused = String(focused);
      el.setAttribute('aria-valuenow', value.toFixed(3));
      el.setAttribute('aria-valuetext', focused ? UI.zoom.focusInRange : UI.zoom.focusOutOfRange);
      // 호는 **채워진 원 바로 뒤**에 온다 — 앞에 두면 원이 덮어 안 보인다.
      // 처음 그릴 때(`dialHtml`)와 같은 자리여야 돌렸을 때 모양이 안 바뀐다.
      const svg = el.querySelector('svg');
      svg.querySelector('.dial-gauge')?.remove();
      svg.querySelector('circle')?.insertAdjacentHTML('afterend', gaugeArc(value, span, focused));
    }
    const line = body.querySelector('#focus-readout');
    if (line) line.textContent = focusLine(m, focused);
  }

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

    function apply(delta) {
      const r = store.dispatch(action, { delta }, { skipNotify: true });
      // 고배율에서 조동나사를 돌리면 유리에 금이 가고 재물대에서 내려간다.
      // 속성 몇 개로 될 일이 아니다 — 손을 놓고 화면을 새로 그린다.
      if (r.tag === 'cracked') {
        drag = null;
        busy = false;
        renderBody();
        return false;
      }
      updateBlur();
      updateGauge();
      paintScopeFigure();
      updateFocusReadout();
      return true;
    }

    el.addEventListener('pointerdown', (e) => {
      try { el.setPointerCapture(e.pointerId); } catch { /* 위와 같다 */ }
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
      apply((step / 360) * perTurn);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      el.releasePointerCapture(e.pointerId);
      drag = null;
      busy = false;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    // 키보드 — 마우스로만 돌릴 수 있으면 초점을 맞출 길이 하나뿐이다.
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
   * 초점이 왜 안 맞는지는 시야만 봐서는 알 수 없다 — 재물대와 대물렌즈 사이가
   * 얼마나 떨어졌는지가 원인이기 때문이다. 그림이 그 원인을 보여 준다.
   */
  function paintScopeFigure() {
    const fig = body.querySelector('#scope-figure');
    if (!fig) return;
    const m = store.getState().microscope;
    // 초점이 맞은 자리를 0 으로 두고, 어긋난 만큼 재물대를 내린다 (애셋 viewBox 단위).
    const stageY = clamp((m.coarse + m.fine) * 26, -18, 18);
    const state = {
      objective: m.objective, coarse: m.coarse, fine: m.fine,
      diaphragm: m.diaphragm, lamp: m.lamp, stage: m.stage, stageY,
    };
    const svg = fig.querySelector('svg');
    // 이미 그려져 있으면 계약된 노드만 손본다 (docs/02).
    if (svg) ASSETS.microscope.applyState(svg, state);
    else fig.innerHTML = ASSETS.microscope.render(state);
  }

  /**
   * 재물대에 올린 것이 바뀌면 **찍기 모드도 따라간다** — 확대 뷰를 **열어 둔 채**
   * 바꾸는 길이 있기 때문이다(확대 뷰 안의 「재물대에서 내리기」, 실험대로 끌어다 놓기).
   * 여는 자리(`open`)에서만 맞추면 그때는 옛 모드가 그대로 남아, 안내와 단추가
   * 서로 다른 일을 시킨다.
   */
  let lastStage = store.getState().microscope.stage;
  store.subscribe(() => {
    const now = store.getState().microscope.stage;
    if (now !== lastStage) {
      lastStage = now;
      if (now) pickKind = now === 'specimen' ? PICK_KINDS.CELL : PICK_KINDS.SCALE;
    }
    if (!root.hidden && !busy) renderBody();
  });

  return { open, close };
}
