/**
 * 확대 뷰 — 챔버 하나를 크게 보면서 손끝으로 하는 조작을 한다.
 *
 * ── 실험대는 큰 동작, 여기는 손끝 동작 ────────────────────────────
 * 이 실험에서 손끝이 정하는 값은 **센서 깊이 하나뿐**이다. 실험대에서 끌어다 대는
 * 것으로는 「얼마나 깊이」를 정할 수 없고, 그 값이 결과를 가르므로 여기서 정한다.
 *
 * ── 여기가 결과를 보는 곳이기도 하다 ──────────────────────────────
 * 챔버 그림이 이 실험의 몸통이다. 실험대의 작은 그림으로는 BTB 색이 파랑인지
 * 녹색인지 교실 프로젝터에서 갈리지 않는다. 그래서 뚜껑·측정 단추도 여기 둔다 —
 * **큰 그림을 보면서** 닫고 시작하는 것이 자연스럽다.
 *
 * ── 막지 않는다 ────────────────────────────────────────────────────
 * 센서를 콩에 파묻는 깊이도 그대로 정해진다. 막는 대신 **지금 닿아 있다고 말해 주고**,
 * 재면 그래프가 튄다. 뚜껑을 안 닫고 시작하는 것도 그대로 된다.
 */

import { renderChamberCard, repaintFigure, INSIDE_TOP, INSIDE_BOTTOM } from '../render/chamber.js';
import { chamberView, SENSOR } from '../sim/state.js';
import { UI } from './strings.js';

const Z = UI.zoom;

/**
 * @param {HTMLElement} root  `#zoom`
 * @param {{getState:Function, dispatch:Function, subscribe:Function}} store
 */
export function createZoom(root, store) {
  let openId = null;
  let opener = null;
  let drag = null;

  root.innerHTML = `
    <div class="zoom-sheet" role="dialog" aria-modal="true" aria-labelledby="zoom-title">
      <div class="zoom-head">
        <b id="zoom-title"></b>
        <button type="button" id="zoom-close">${Z.close}</button>
      </div>
      <div class="zoom-stage" id="zoom-stage"></div>
      <p class="zoom-note" id="zoom-note" role="status" aria-live="polite"></p>
      <div class="zoom-actions" id="zoom-actions"></div>
    </div>`;

  const stage = root.querySelector('#zoom-stage');
  const noteEl = root.querySelector('#zoom-note');
  const actionsEl = root.querySelector('#zoom-actions');

  root.querySelector('#zoom-close').addEventListener('click', close);
  // 바깥을 눌러도 닫힌다. 손가락으로 쓰는 사람에게는 이쪽이 먼저 나온다.
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openId) close(); });

  function close() {
    root.hidden = true;
    openId = null;
    // 포커스를 열었던 물건으로 돌려준다. 그러지 않으면 키보드로 쓰는 사람이
    // 매번 처음부터 Tab 해서 돌아와야 한다.
    opener?.focus?.();
    opener = null;
  }

  /**
   * 단추 표.
   *
   * **하나뿐인 표에 적는다.** 실제 실행과 문구가 따로 적히면 조작을 하나 늘릴 때마다
   * 두 곳이 어긋난다. `when` 이 false 면 그 단추가 **안 나오는 것이 아니라**,
   * 지금 상태에서 뜻이 없어서 다른 단추로 갈린 것이다 (열림↔닫힘처럼 짝을 이룬다).
   */
  function buttons(v) {
    const id = v.id;
    return [
      {
        key: 'lid',
        label: v.sealed ? Z.openLid : Z.sealLid,
        primary: !v.sealed,
        run: () => store.dispatch(v.sealed ? 'OPEN_LID' : 'SEAL', { chamber: id }),
      },
      {
        key: 'run',
        label: v.running ? Z.stop : Z.start,
        primary: v.running ? false : v.sealed,
        run: () => store.dispatch(v.running ? 'STOP' : 'START', { chamber: id }),
      },
      {
        key: 'sensor',
        label: Z.removeSensor,
        when: v.sensor !== SENSOR.NONE,
        run: () => store.dispatch('REMOVE_SENSOR', { chamber: id }),
      },
      {
        key: 'record',
        label: Z.record,
        run: () => store.dispatch('RECORD', {}),
      },
    ].filter((b) => b.when !== false);
  }

  /**
   * 센서 깊이를 끄는 손잡이.
   *
   * 끄는 동안은 `skipNotify` 로 보내 화면을 통째로 다시 그리지 않는다 —
   * 다시 그리면 붙잡아 둔 DOM 이 문서에서 떨어져 나가고, 떨어져 나간 요소는
   * `setPointerCapture` 가 무효가 되어 **끌기가 조용히 끊긴다.**
   */
  function bindDepth() {
    const handle = stage.querySelector('.sensor-handle');
    if (!handle) return;
    const track = stage.querySelector('.chamber-figure');

    const setFrom = (clientY, quiet) => {
      const r = track.getBoundingClientRect();
      // 그림 안에서 챔버 속이 차지하는 세로 구간. `render/chamber.js` 와 같은 값을 쓴다.
      const t = (clientY - (r.top + r.height * INSIDE_TOP)) / (r.height * (INSIDE_BOTTOM - INSIDE_TOP));
      // **여기서 자르지 않는다.** 자르면 규칙이 「끝에서 더 밀었다」를 알 수 없어,
      // 끌어서 끝까지 간 학생만 아무 말도 못 듣는다. 자르는 것은 규칙이 한다.
      store.dispatch('SET_SENSOR_DEPTH', { chamber: openId, depth: t }, { skipNotify: quiet });
    };

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      drag = e.pointerId;
      setFrom(e.clientY, true);
      paintQuiet();
    });
    handle.addEventListener('pointermove', (e) => {
      if (drag !== e.pointerId) return;
      setFrom(e.clientY, true);
      paintQuiet();
    });
    const end = (e) => {
      if (drag !== e.pointerId) return;
      handle.releasePointerCapture(e.pointerId);
      drag = null;
      // 끌기가 끝난 뒤에 한 번만 제대로 알린다 — 그때 토스트도 뜬다.
      store.notify();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);

    /**
     * 키보드로도 깊이를 정한다.
     *
     * 이 실험에서 손끝이 정하는 유일한 값이라, 키보드 경로가 없으면
     * **마우스를 못 쓰는 학생은 이 실험을 아예 할 수 없다.**
     */
    handle.addEventListener('keydown', (e) => {
      const step = { ArrowUp: -0.05, ArrowDown: 0.05, PageUp: -0.2, PageDown: 0.2 }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      const v = chamberView(store.getState().chambers[openId]);
      store.dispatch('SET_SENSOR_DEPTH', { chamber: openId, depth: (v.sensorDepth ?? 0) + step });
    });
  }

  /** 끄는 동안은 **그림만** 다시 그린다. 통째로 다시 그리면 끌기가 끊긴다. */
  function paintQuiet() {
    const v = chamberView(store.getState().chambers[openId]);
    const figure = stage.querySelector('.chamber-figure');
    if (figure) repaintFigure(figure, v);
    // 안내 문구는 바로 따라와야 한다 — 지금 닿았는지가 이 조작의 전부다.
    noteEl.textContent = noteFor(v);
    noteEl.dataset.warn = String(v.sensor === SENSOR.BURIED);
  }

  function noteFor(v) {
    if (v.sensor === SENSOR.NONE) return Z.noSensor;
    if (v.sensor === SENSOR.BURIED) return Z.buried;
    if (v.sensorFouled) return Z.fouled;
    if (!v.sealed) return Z.notSealed;
    return Z.depthHint;
  }

  /**
   * 다시 그리기 전에 **포커스가 어디였는지**를 이름으로 적어 둔다.
   *
   * `paint()` 는 그림 칸과 단추 칸을 innerHTML 로 통째로 갈아 끼운다. 그러면 그 안에
   * 포커스가 있던 요소는 문서에서 떨어져 나가고 **포커스는 `<body>` 로 빠진다.**
   * 요소 자체를 기억해 봐야 소용이 없다 — 그 요소는 이제 화면에 없다. 그래서 **어느
   * 자리였는지**만 적어 두고, 새로 그린 뒤 같은 자리를 다시 찾아 포커스를 돌려준다.
   *
   * 이것이 없으면 두 곳이 조용히 죽는다.
   *   - **센서 깊이 손잡이** — ↓ 한 번에 0.05 만큼 내려가고, 그 dispatch 가 부른
   *     다시 그리기가 손잡이를 갈아 끼워 포커스를 앗아 간다. 두 번째 ↓ 는 `<body>` 로
   *     가서 **아무 일도 안 일어난다.** 마우스를 못 쓰는 학생은 깊이를 한 칸씩밖에
   *     못 정하고, 매번 Tab 으로 손잡이를 다시 찾아와야 한다.
   *   - **아래쪽 단추들** — 재는 동안에는 1초마다 TICK 이 들어와 다시 그린다.
   *     확대 뷰를 열어 놓고 키보드로 단추를 고르는 중이면 **1초마다 포커스가 빠진다.**
   * 둘 다 콘솔 에러가 한 줄도 없다.
   */
  function focusKey() {
    const a = document.activeElement;
    if (!a || !root.contains(a)) return null;
    if (a.classList.contains('sensor-handle')) return { sel: '.sensor-handle' };
    if (a.dataset.act) return { sel: `[data-act="${a.dataset.act}"]` };
    return null;
  }

  function paint() {
    if (!openId) return;
    const keep = focusKey();
    const v = chamberView(store.getState().chambers[openId]);
    root.querySelector('#zoom-title').textContent = UI.chambers[v.id].name;
    stage.innerHTML = renderChamberCard(v, { idPrefix: 'zc', big: true });
    noteEl.textContent = noteFor(v);
    noteEl.dataset.warn = String(v.sensor === SENSOR.BURIED);
    actionsEl.innerHTML = buttons(v).map((b) =>
      `<button type="button" data-act="${b.key}"${b.primary ? ' class="primary"' : ''}>${b.label}</button>`).join('');
    for (const b of buttons(v)) {
      actionsEl.querySelector(`[data-act="${b.key}"]`)?.addEventListener('click', b.run);
    }
    bindDepth();
    // 같은 자리가 다시 그려졌으면 포커스를 돌려준다. 사라진 자리(뚜껑을 열어 「측정 시작」이
    // 없어진 경우 같은 것)면 그냥 둔다 — 없는 자리로 옮길 수는 없다.
    if (keep) root.querySelector(keep.sel)?.focus();
  }

  store.subscribe(() => { if (openId && !drag) paint(); });

  return {
    /** @param {'L'|'R'} id  @param {HTMLElement} [from] 포커스를 돌려줄 곳 */
    open(id, from) {
      if (!id) return;
      openId = id;
      opener = from ?? null;
      root.hidden = false;
      paint();
      root.querySelector('#zoom-close').focus();
    },
    close,
  };
}

