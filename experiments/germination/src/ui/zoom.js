/**
 * 확대 뷰 — 챔버 화면과 물건 화면.
 *
 * ── 틀은 공용이다 ──────────────────────────────────────────────────
 * 덮개·패널·「닫기 (Esc)」·포커스 되돌리기·스크롤 맨 위는 `packages/lab-kit/ui/zoom-shell.js`
 * 가 한다 (docs/09-uniformity.md §3). 여기는 **무엇을 그릴지**만 갖는다.
 * 앞서는 이 실험만 `.zoom-sheet`(제목과 닫기가 한 줄)라 다른 일곱과 뼈대가 달랐다.
 *
 * ── 챔버 화면 — 실험대는 큰 동작, 여기는 손끝 동작 ─────────────────
 * 이 실험에서 손끝이 정하는 값은 **센서 깊이 하나뿐**이다. 실험대에서 끌어다 대는
 * 것으로는 「얼마나 깊이」를 정할 수 없고, 그 값이 결과를 가르므로 여기서 정한다.
 * 챔버 그림이 이 실험의 몸통이기도 하다 — 실험대의 작은 그림으로는 BTB 색이 파랑인지
 * 녹색인지 교실 프로젝터에서 갈리지 않는다. 그래서 뚜껑·측정 단추도 여기 둔다.
 *
 * ── 물건 화면 — 누르면 본다 ────────────────────────────────────────
 * 콩 통·숟가락·BTB 병·센서·개수대·휴지·폐액통·쓰레기통은 누르면 자기 화면이 열린다.
 * 차례는 공용 `renderItemView` 가 정한다 — 제목·어디에 있나·하는 일·그림·덧붙일 말·
 * 받는 것·단추. 여기서는 **이 실험의 사실**만 채운다.
 *
 * ── 막지 않는다 ────────────────────────────────────────────────────
 * 센서를 콩에 파묻는 깊이도 그대로 정해진다. 막는 대신 **지금 닿아 있다고 말해 주고**,
 * 재면 그래프가 튄다. 뚜껑을 안 닫고 시작하는 것도 그대로 된다.
 */

import { renderChamberCard, repaintFigure, INSIDE_TOP, INSIDE_BOTTOM } from '../render/chamber.js';
import { chamberView, SENSOR } from '../sim/state.js';
import { createZoomShell } from '../../../../packages/lab-kit/ui/zoom-shell.js';
import { renderItemView, acceptsFrom, escapeHtml } from '../../../../packages/lab-kit/ui/item-view.js';
import { dropTable } from './bench.js';
import { ASSETS } from '../assets/index.js';
import { UI } from './strings.js';

const Z = UI.zoom;

/**
 * @param {HTMLElement} root  `#zoom`
 * @param {{getState:Function, dispatch:Function, subscribe:Function, notify:Function}} store
 */
export function createZoom(root, store) {
  const shell = createZoomShell(root, {
    closeLabel: Z.close,
    // 센서 깊이는 끄는 동안 skipNotify 로 조용히 갱신됐다. 닫을 때 한 번 실험대에 반영한다.
    onClose: () => store.notify(),
  });
  const { body } = shell;
  /** 놓기 표 — 「여기에 끌어다 놓을 수 있는 것」을 거꾸로 읽는다. 실행하지 않는다. */
  const DROPS = dropTable(store);

  /** 'chamber' | 'item' */
  let mode = null;
  /** 챔버 화면이면 'L'|'R'. */
  let openId = null;
  /** 물건 화면이면 실험대 물건 id (`jarSprout` · `sensorL` …). */
  let itemId = null;
  let drag = null;

  function close() { shell.close(); }

  function renderBody() {
    if (mode === 'chamber') renderChamberMode();
    else if (mode === 'item') renderItemMode();
  }

  /* ---------------------------------------------------------------- */
  /* 물건 화면 — 누르면 본다 (docs/09 §2·§3)                             */
  /* ---------------------------------------------------------------- */

  /** 실험대 물건 id → 놓기 표의 종류. */
  const kindOf = (id) => (id.startsWith('jar') ? 'beanjar'
    : id.startsWith('bottle') ? 'bottle'
      : id.startsWith('sensor') ? 'sensor' : id);
  /** 종류 → 화면에 쓸 이름. 끄는 쪽 이름이라 그림 종류 이름(`UI.assetNames`)을 쓴다. */
  const nameOfKind = (kind) => UI.assetNames[kind] ?? kind;
  /** 준비물 표의 「하는 일」. 두 곳에 따로 쓰면 반드시 갈린다. */
  const roleOf = (asset, name = null) =>
    UI.notebook.materials.find((m) => m.asset === asset && (!name || m.name === name))?.role ?? null;

  function renderItemMode() {
    const st = store.getState();
    const id = itemId;
    const kind = kindOf(id);
    const I = Z.item;
    const v = { title: UI.bench.items[id] ?? nameOfKind(kind), where: null, role: null, note: null, figure: '', actions: [] };
    const act = (aid, label, type, payload = {}, quiet = false) =>
      v.actions.push({ id: aid, label, quiet, run: () => store.dispatch(type, payload) });

    if (kind === 'beanjar') {
      // 통 — 열린 통 안을 그리고, 「꺼내기」는 숟가락으로 한 숟갈 담는 것이다.
      const beans = id === 'jarDry' ? 'dry' : 'sprout';
      v.where = I.jarHolds(UI.beans[beans]);
      v.role = roleOf('beanjar', UI.beans[beans]);
      v.figure = ASSETS.beanjar.render({ kind: beans, level: 0.8, capOpen: true });
      act('act-scoop', I.scoopFromJar, 'SCOOP_BEANS', { kind: beans });
    } else if (kind === 'scoop') {
      const holds = st.scoop.holds;
      v.where = holds ? I.scoopHolds(UI.beans[holds]) : I.scoopEmpty;
      v.role = roleOf('scoop');
      v.figure = ASSETS.scoop.render({ holds });
    } else if (kind === 'bottle') {
      v.where = I.bottleHolds;
      v.role = roleOf('bottle');
      v.figure = ASSETS.bottle.render({ kind: 'BTB', level: 0.7 });
    } else if (kind === 'sensor') {
      const which = id.endsWith('L') ? 'L' : 'R';
      const ch = st.chambers[which];
      v.where = ch.sensorIn ? I.sensorIn(UI.chambers[which].short) : I.sensorOnShelf;
      v.role = roleOf('sensor');
      v.figure = ASSETS.sensor.render({ on: ch.running, fouled: ch.sensorFouled });
      if (ch.sensorFouled) v.note = I.sensorFouled;
      if (ch.sensorIn) act('act-remove', Z.removeSensor, 'REMOVE_SENSOR', { chamber: which }, true);
    } else if (kind === 'sink') {
      v.role = roleOf('sink');
      v.figure = ASSETS.sink.render({ water: 0 });
      v.note = I.sinkNote;
    } else if (kind === 'tissue') {
      v.role = roleOf('tissue');
      v.figure = ASSETS.tissue.render({ used: 0 });
      v.note = I.tissueNote;
    } else if (kind === 'waste') {
      v.role = roleOf('waste');
      v.figure = ASSETS.waste.render({ level: 0.2 });
      v.note = I.wastePractice;
    } else if (kind === 'bin') {
      v.role = roleOf('bin');
      v.figure = ASSETS.bin.render({ fill: 0 });
      v.note = I.binPractice;
    }
    v.accepts = acceptsFrom(DROPS, kind, nameOfKind);
    v.acceptsLabel = Z.acceptsLabel;
    renderItemView(body, v);
  }

  /* ---------------------------------------------------------------- */
  /* 챔버 화면                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * 단추 표.
   *
   * **하나뿐인 표에 적는다.** 실제 실행과 문구가 따로 적히면 조작을 하나 늘릴 때마다
   * 두 곳이 어긋난다. `when` 이 false 면 그 단추가 **안 나오는 것이 아니라**,
   * 지금 상태에서 뜻이 없어서 다른 단추로 갈린 것이다 (열림↔닫힘처럼 짝을 이룬다).
   * 갈 수 있는 곳만 낸다 — 못 가는 곳을 회색으로 죽여 두지 않는다.
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
        label: Z.capture,
        primary: true,
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
    const handle = body.querySelector('.sensor-handle');
    if (!handle) return;
    const track = body.querySelector('.chamber-figure');

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
     * 다시 그려진 뒤 손이 손잡이에 남는 것은 공용 틀(`repaint`)이 id 로 돌려준다.
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
    const figure = body.querySelector('.chamber-figure');
    if (figure) repaintFigure(figure, v);
    // 안내 문구는 바로 따라와야 한다 — 지금 닿았는지가 이 조작의 전부다.
    const noteEl = body.querySelector('#zoom-note');
    if (noteEl) {
      noteEl.textContent = noteFor(v);
      noteEl.dataset.good = String(noteGood(v));
    }
  }

  function noteFor(v) {
    if (v.sensor === SENSOR.NONE) return Z.noSensor;
    if (v.sensor === SENSOR.BURIED) return Z.buried;
    if (v.sensorFouled) return Z.fouled;
    if (!v.sealed) return Z.notSealed;
    return Z.depthHint;
  }

  /** 상태 한 줄의 색 — 잘 됐으면 초록, 아니면 경고색. 막지 않고 말한다. */
  function noteGood(v) {
    return v.sensor === SENSOR.CLEAR && !v.sensorFouled && v.sealed;
  }

  /**
   * 챔버 화면 — 제목(실험대의 이름) · 콩·값이 붙은 큰 챔버 카드 · 상태 한 줄 ·
   * 여기에 끌어다 놓을 수 있는 것 · 단추. 물건 화면과 같은 차례다 (docs/09 §3).
   *
   * 단추마다 id 를 둔다 — 재는 동안 1초마다 TICK 이 들어와 다시 그리는데, 공용 틀이
   * **같은 id 의 새 요소로 포커스를 돌려준다.** 없으면 키보드로 단추를 고르는 중에
   * 1초마다 포커스가 `<body>` 로 빠진다.
   */
  function renderChamberMode() {
    const v = chamberView(store.getState().chambers[openId]);
    const accepts = acceptsFrom(DROPS, 'chamber', nameOfKind);
    body.innerHTML = `
      <h2>${escapeHtml(UI.bench.items[`chamber${v.id}`])}</h2>
      ${renderChamberCard(v, { idPrefix: 'zc', big: true })}
      <p class="zoom-hint" id="zoom-note" role="status" aria-live="polite"
        data-good="${noteGood(v)}">${escapeHtml(noteFor(v))}</p>
      ${accepts.length ? `<p class="zoom-hint zoom-accepts">${escapeHtml(Z.acceptsLabel)} ${accepts.map(escapeHtml).join(' · ')}</p>` : ''}
      <p class="zoom-hint">${escapeHtml(Z.recordHint)}</p>
      <div class="zoom-scope-controls" id="zoom-actions" style="margin-top:12px">
        ${buttons(v).map((b) => `<button type="button" id="act-${b.key}"
          class="zoom-action${b.primary ? '' : ' zoom-action--quiet'}">${escapeHtml(b.label)}</button>`).join('')}
      </div>`;
    for (const b of buttons(v)) {
      body.querySelector(`#act-${b.key}`)?.addEventListener('click', b.run);
    }
    bindDepth();
  }

  // 드래그 중에는 다시 그리지 않는다 — 손잡이가 문서에서 떨어져 나가면 끌기가 끊긴다.
  store.subscribe(() => { if (!drag) shell.repaint(); });

  return {
    /**
     * @param {'chamber'|'item'} openMode
     * @param {string} id  chamber 면 'L'|'R', item 이면 실험대 물건 id
     * @param {HTMLElement} [from]  포커스를 돌려줄 곳
     */
    open(openMode, id, from) {
      if (!id) return;
      mode = openMode;
      openId = openMode === 'chamber' ? id : null;
      itemId = openMode === 'item' ? id : null;
      shell.open(renderBody, from ?? null);
    },
    close,
  };
}
