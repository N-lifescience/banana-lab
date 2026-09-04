/**
 * 확대 뷰 — **손끝으로 하는 일**과 **물건 화면**.
 *
 * 실험대에서는 물건을 집어 옮기는 큰 동작만 한다. 결과를 가르는 값(각도 · 누르는 깊이 ·
 * 당기는 세기와 박자)은 전부 이 화면에서 손이 정한다 (PLAYBOOK §4).
 *
 * 모드 넷:
 *   draw  손끝에 모세관을 **비스듬히** 대어 혈액을 빨아올린다 — 손끝을 누르면 여기다
 *   seal  모세관 끝을 고무찰흙에 **눌러** 막는다
 *   spin  끈을 **박자에 맞춰** 당긴다 — 이 실험의 몸통
 *   item  물건 화면 — 누르면 본다 (docs/09-uniformity.md §2·§3). 모세관 통·고무찰흙·채혈침·
 *         소독솜·자·쓰레기통. 종류를 골라 꺼내는 것(헤파린/민무늬)은 통 화면의 단추다.
 *
 * 덮개·패널·「닫기 (Esc)」·포커스 되돌리기·스크롤은 공용 틀(`createZoomShell`)이 한다.
 * 여기는 **무엇을 그릴지**만 갖는다.
 */

import { renderTube } from '../render/tube.js';
import { observability } from '../sim/quality.js';
import {
  tubeParams, imbalanceOf, rhythmQuality, sampleSlot, columnLength,
  ENDS, SLOTS, TUBE_KINDS, ANGLE_RANGE_DEG, ANGLE_BEST_DEG, PRESS_BREAK, PRESS_GOOD,
} from '../sim/state.js';
import { timingError, MAX_SPEED } from '../sim/spin.js';
import { createZoomShell } from '../../../../packages/lab-kit/ui/zoom-shell.js';
import { renderItemView, acceptsFrom } from '../../../../packages/lab-kit/ui/item-view.js';
import { dropTable } from './bench.js';
import { UI } from './strings.js';
import { ASSETS } from '../assets/index.js';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/**
 * 「지금 당길 때」로 치는 박자의 너비.
 *
 * 0 이면 맞힐 수가 없고, 크면 아무 때나 눌러도 되어 박자가 변인이 아니게 된다.
 * `spin.js` 의 `pullGain` 은 연속값이라 이 창 밖에서도 조금은 보태진다 —
 * 여기 있는 것은 **화면이 「지금!」이라고 말해 주는 구간**일 뿐, 판정선이 아니다.
 */
const BEAT_WINDOW = 0.11;

export function createZoom(root, store) {
  const shell = createZoomShell(root, {
    closeLabel: UI.zoom.close,
    // 회전 중에는 skipNotify 로 조용히 갱신됐다. 닫을 때 한 번 전체를 동기화해
    // 실험대(배경) 뷰가 최신 상태를 반영하게 한다.
    onClose: () => store.notify(),
  });
  const { body } = shell;
  /** 놓기 표 — 「여기에 끌어다 놓을 수 있는 것」을 거꾸로 읽는다. 실행하지 않는다. */
  const DROPS = dropTable(store);

  let mode = null;
  /** 물건 화면에 열린 물건 (실험대의 id — 이 실험은 id 와 종류가 같다). */
  let itemId = null;
  /** 결과를 기록한 직후 화면에 남길 확인 문구. 열 때마다 지운다. */
  let captureNotice = null;
  /**
   * 손에 쥔 모세관의 기울기. 화면을 다시 그릴 때마다 처음 각도로 튕겨 돌아가면
   * 한 번 빨아올릴 때마다 다시 맞춰야 한다 — 쥐고 있다는 느낌이 사라진다.
   */
  let angleDeg = ANGLE_BEST_DEG;
  /** 지금 막으려는 끝. 두 끝을 한 화면에서 오간다. */
  let sealEnd = ENDS.OUTER;
  /** 고무찰흙에 눌러 넣은 깊이 (놓기 전까지의 미리보기) */
  let pressNow = 0;
  /** 링을 당긴 세기 (놓기 전까지의 미리보기) */
  let pullNow = 0;
  /**
   * 끌고 있는 동안에는 구독으로 들어오는 전체 다시 그리기를 건너뛴다.
   * TICK 처럼 사용자와 무관한 상태 변경이 body.innerHTML 을 새로 만들면
   * 끌고 있던 요소가 통째로 사라져 조작이 끊긴다.
   */
  let busy = false;

  function close() { shell.close(); }

  /**
   * @param {'draw'|'seal'|'spin'|'item'} openMode
   * @param {HTMLElement|null} openerEl  닫을 때 포커스를 돌려줄 물건
   * @param {string|null} openId  item 이면 실험대 물건 id
   */
  function open(openMode, openerEl = null, openId = null) {
    mode = openMode;
    itemId = openMode === 'item' ? openId : null;
    captureNotice = null;
    pressNow = 0;
    pullNow = 0;
    shell.open(renderBody, openerEl);
  }

  /**
   * 다시 그린다. **다시 그려도 손은 그 자리에 남는다** — 틀의 `repaint` 가 같은 id 의
   * 새 요소로 포커스를 되돌린다. Enter 로 링을 당기면 그 링이 새 요소로 바뀌면서 포커스가
   * `<body>` 로 떨어지던 자리다 (PLAYTEST-REVIEW #8). 이 실험의 몸통이 마우스 전용이
   * 되지 않게 하는 줄이니, 조작 뒤에는 `renderBody()` 가 아니라 이것을 부른다.
   */
  const repaint = () => shell.repaint();

  function renderBody() {
    if (mode === 'draw') renderDraw();
    else if (mode === 'seal') renderSeal();
    else if (mode === 'spin') renderSpin();
    else if (mode === 'item') renderItemMode();
  }

  /* ---------------------------------------------------------------- */
  /* 공통 조각                                                          */
  /* ---------------------------------------------------------------- */

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  /** 읽기값 표 한 줄 */
  const row = (label, value) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;

  /**
   * 방향 안내. **왼쪽이 회전 바깥쪽**이라는 것을 글자로 적는다.
   * 이 두 줄이 없으면 보는 사람이 위/아래로 되돌려 생각하다가 뒤집는다.
   */
  const compass = () => `<p class="zoom-compass">${esc(UI.zoom.outerNote)} ${esc(UI.zoom.innerNote)}</p>`;

  function captureButton() {
    return `<button type="button" class="zoom-action" id="zoom-capture">${esc(UI.zoom.capture)}</button>`
      + (captureNotice ? `<p class="zoom-hint" data-good="true">${esc(captureNotice)}</p>` : '');
  }

  function bindCapture() {
    body.querySelector('#zoom-capture')?.addEventListener('click', () => {
      const r = store.dispatch('CAPTURE', {});
      if (r.outcome !== 'blocked') {
        captureNotice = UI.zoom.captureSaved(r.state.session.captures.length);
      }
      repaint();
    });
  }

  /** 그림 하나를 애셋에서 뽑아 온다. 애셋이 아직 없으면 빈 칸으로 둔다 — 화면이 죽지 않게. */
  function assetSvg(name, state) {
    try {
      return ASSETS[name].render(state);
    } catch {
      return '';
    }
  }

  /* ---------------------------------------------------------------- */
  /* item — 물건 화면. 누르면 본다 (docs/09 §2·§3)                      */
  /* ---------------------------------------------------------------- */

  /** 종류 → 화면에 쓸 이름. 끄는 쪽 이름이라 짧은 것(`UI.assetNames`)을 쓴다. */
  const nameOfKind = (kind) => UI.assetNames[kind] ?? kind;
  /** 준비물 표의 「하는 일」. 두 곳에 따로 쓰면 반드시 갈린다. */
  const roleOf = (asset) => UI.notebook.materials.find((m) => m.asset === asset)?.role ?? null;

  /**
   * 물건 하나의 화면. 제목 · 어디에 있나 · 하는 일 · 그림 · 덧붙일 말 · 받는 것 · 단추 —
   * 차례는 공용 `renderItemView` 가 정한다. 여기서는 **이 실험의 사실**만 채운다.
   *
   * 실험대에서 상태를 바꾸는 손짓은 끌어다 놓기뿐이다. 눌러서 하던 것(모세관 통에서
   * 헤파린/민무늬 고르기)은 **이 화면의 단추**로 왔다 — 말없이 종류가 바뀌던 자리다.
   */
  function renderItemMode() {
    const st = store.getState();
    const kind = itemId;
    const Z = UI.zoom.item;
    const v = {
      title: UI.bench.items[kind] ?? nameOfKind(kind),
      where: null, role: roleOf(kind), note: null, figure: '', actions: [],
    };
    const act = (id, label, run, quiet = false) => v.actions.push({ id, label, quiet, run });
    const go = (type, payload = {}) => () => store.dispatch(type, payload);

    if (kind === 'capbox') {
      // 통 — 열린 통 안 그림 + 종류별 「… 꺼내기」. 꺼내면 새 모세관이라 처음부터 다시다
      // (NEW_CAPILLARY). 어느 쪽을 쓸지가 변인이니 화면이 대신 집어 주지 않는다.
      const pick = st.tools.pickKind;
      v.where = Z.capboxHolds(UI.tubeKinds[pick]);
      v.note = Z.capboxNote;
      v.figure = assetSvg('capbox', { kind: pick });
      act('act-take-heparin', Z.takeKind(UI.tubeKinds.heparin), go('NEW_CAPILLARY', { kind: TUBE_KINDS.HEPARIN }));
      act('act-take-plain', Z.takeKind(UI.tubeKinds.plain), go('NEW_CAPILLARY', { kind: TUBE_KINDS.PLAIN }));
    } else if (kind === 'clay') {
      const dents = Math.min(6, st.session.log.filter((l) => l.action === 'SEAL_END').length);
      v.where = dents > 0 ? Z.clayDents(dents) : Z.clayFresh;
      v.figure = assetSvg('clay', { dents });
      // 막는 화면으로 가는 지름길. 모세관을 끌어다 대는 것과 같은 화면이 열린다.
      act('act-seal', Z.sealNow, () => { mode = 'seal'; pressNow = 0; repaint(); });
    } else if (kind === 'lancet') {
      v.where = st.lancet.used ? Z.lancetUsed : Z.lancetNew;
      v.figure = assetSvg('lancet', { used: st.lancet.used });
    } else if (kind === 'swab') {
      v.where = st.finger.swabbed ? Z.swabUsed : Z.swabNew;
      v.figure = assetSvg('swab', { used: st.finger.swabbed });
    } else if (kind === 'ruler') {
      v.where = st.tools.rulerPlaced ? Z.rulerPlaced : Z.rulerIdle;
      v.figure = assetSvg('ruler', {});
      if (st.tools.rulerPlaced) act('act-lift-ruler', Z.liftRuler, go('LIFT_RULER'), true);
    } else if (kind === 'bin') {
      // 받는 곳 — 「무엇을 받는지」가 몸통이다. 버리는 곳이 아니라 되돌리는 길이기도 하다.
      v.note = Z.binNote;
      v.figure = assetSvg('bin', { fill: 1 });
    } else if (kind === 'sharpsbin') {
      v.note = Z.sharpsbinNote;
      v.figure = assetSvg('sharpsbin', { fill: st.lancet.disposed ? 0.7 : 0.3 });
    } else {
      v.figure = assetSvg(kind, kind === 'sink' ? { water: 0 } : kind === 'tissue' ? { used: 0 } : {});
    }
    v.accepts = acceptsFrom(DROPS, kind, nameOfKind);
    v.acceptsLabel = UI.zoom.acceptsLabel;
    renderItemView(body, v);
  }

  /* ---------------------------------------------------------------- */
  /* draw — 혈액 빨아올리기                                            */
  /* ---------------------------------------------------------------- */

  /**
   * **각도가 변인이다.** 좌우로 끌어 각도를 정하고, 손끝에 눌러 대고 있으면 빨려 올라온다.
   *
   * 각도를 화면이 알아서 잡아 주면 "왜 비스듬히 대는가" 가 학생 손을 떠난다.
   * 어느 각도든 막지 않는다 — 세워서 대면 공기가 함께 들어와 기포가 낄 뿐이다.
   */
  function renderDraw() {
    const st = store.getState();
    const t = st.tube;
    const good = Math.abs(angleDeg - ANGLE_BEST_DEG) <= 22;
    body.innerHTML = `
      <h2>${esc(UI.bench.items.finger)}</h2>
      <p class="zoom-slide-label">${esc(UI.zoom.drawMode)}</p>
      <p class="zoom-hint">${esc(UI.zoom.drawHint)}</p>
      ${st.finger.drop <= 0 ? `<p class="zoom-hint" data-good="false">${esc(UI.zoom.drawNoDrop)}</p>` : ''}
      <div class="zoom-stage">
        <div class="zoom-figure zoom-figure--finger">${assetSvg('finger', {
    swabbed: st.finger.swabbed, drop: st.finger.drop, wiped: st.finger.wiped,
  })}</div>
        <button type="button" class="zoom-tool" id="draw-tool"
          aria-label="${esc(UI.zoom.drawLabel)}"
          style="transform:rotate(${(90 - angleDeg).toFixed(1)}deg)">
          ${assetSvg('capillary', { fill: t.fill, kind: t.kind, seal: t.seal, broken: t.broken })}
        </button>
      </div>
      <p class="zoom-hint" id="draw-angle-note" data-good="${good}">
        ${esc(good ? UI.zoom.drawAngleGood : UI.zoom.drawAngleBad)}</p>
      <dl class="zoom-readout">
        ${row(UI.zoom.drawAngle, UI.units.deg(Math.round(angleDeg)))}
        ${row(UI.zoom.drawColumn, UI.zoom.drawColumnOf(Math.round(columnLength(t) * 100)))}
        ${row(UI.zoom.drawBubbles, UI.units.percent(Math.round(t.bubbles * 100)))}
      </dl>
      <p class="zoom-hint">${esc(UI.zoom.drawHold)}</p>`;
    bindDrawTool(body.querySelector('#draw-tool'));
  }

  /**
   * 모세관을 쥔 손.
   *
   * 좌우로 끌면 각도가 바뀌고, **누르고 있는 동안** 계속 빨아올린다.
   * 눌러 두는 시간이 곧 기둥의 길이라, 절차의 "충분히 빨아올린다" 가 손에 남는다.
   */
  function bindDrawTool(el) {
    if (!el) return;
    let drag = null;
    let holdTimer = 0;

    const stopHold = () => { clearInterval(holdTimer); holdTimer = 0; };

    const suck = () => {
      const r = store.dispatch('DRAW_BLOOD', { angleDeg, dwell: 0.14 }, { skipNotify: true });
      if (r.state.finger.drop <= 0) stopHold();
      renderTubeReadout();
    };

    /** 기둥 길이만 바꿔 그린다 — 통째로 다시 그리면 누르고 있던 손이 사라진다. */
    function renderTubeReadout() {
      const t = store.getState().tube;
      const dd = body.querySelectorAll('.zoom-readout dd');
      if (dd[1]) dd[1].textContent = UI.zoom.drawColumnOf(Math.round(columnLength(t) * 100));
      if (dd[2]) dd[2].textContent = UI.units.percent(Math.round(t.bubbles * 100));
      const fig = el.querySelector('svg');
      if (fig) {
        el.innerHTML = assetSvg('capillary', {
          fill: t.fill, kind: t.kind, seal: t.seal, broken: t.broken,
        });
      }
    }

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      busy = true;
      drag = { id: e.pointerId, x: e.clientX, startAngle: angleDeg, moved: false };
      // 누르는 동안 계속 빨아올린다. 첫 모금은 곧바로 — 눌렀는데 아무 일도 안 일어나면
      // 학생은 이 화면이 무엇을 하는 곳인지 알 수 없다.
      suck();
      holdTimer = setInterval(suck, 130);
    });

    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      const [lo, hi] = ANGLE_RANGE_DEG;
      angleDeg = clamp(drag.startAngle + dx * 0.35, lo, hi);
      el.style.transform = `rotate(${(90 - angleDeg).toFixed(1)}deg)`;
      // **숫자도 함께 움직여야 한다.** 그림만 기울면 지금 몇 도인지 알 수 없고,
      // 「비스듬히」가 몇 도인지 손으로 익힐 방법이 없다.
      const dd = body.querySelectorAll('.zoom-readout dd');
      if (dd[0]) dd[0].textContent = UI.units.deg(Math.round(angleDeg));
      const note = body.querySelector('#draw-angle-note');
      if (note) {
        const good = Math.abs(angleDeg - ANGLE_BEST_DEG) <= 22;
        note.textContent = good ? UI.zoom.drawAngleGood : UI.zoom.drawAngleBad;
        note.dataset.good = String(good);
      }
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      el.releasePointerCapture(e.pointerId);
      stopHold();
      drag = null;
      busy = false;
      store.notify();
      repaint();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    /**
     * 키보드·보조기기 경로. 포인터만 들으면 `element.click()` 이 아무 일도 안 한다.
     * 손짓이 정하던 「대고 있는 시간」 자리에 가운뎃값을 넣는다.
     */
    el.addEventListener('click', (e) => {
      if (e.detail !== 0) return;   // 포인터로 이미 처리한 것은 넘긴다
      store.dispatch('DRAW_BLOOD', { angleDeg, dwell: 0.5 });
      repaint();
    });
  }

  /* ---------------------------------------------------------------- */
  /* seal — 모세관 끝 막기                                             */
  /* ---------------------------------------------------------------- */

  /**
   * **누르는 깊이가 변인이다.** 얕으면 새고, 너무 세게 누르면 유리가 부러진다.
   * 부러지는 것은 허용된 하드 게이트 둘 중 하나이고, 빠져나갈 길은 규칙 엔진의 문장에 있다.
   */
  function renderSeal() {
    const st = store.getState();
    const t = st.tube;
    const label = UI.ends[sealEnd];
    const sealed = t.seal[sealEnd] > 0;
    body.innerHTML = `
      <h2>${esc(UI.bench.items.capillary)}</h2>
      <p class="zoom-slide-label">${esc(UI.zoom.sealMode)}</p>
      ${compass()}
      <p class="zoom-hint">${esc(UI.zoom.sealHint)}</p>
      <div class="ctrl-group" role="group" aria-label="${esc(UI.zoom.sealPickEnd)}">
        <span>${esc(UI.zoom.sealPickEnd)}</span>
        ${Object.values(ENDS).map((e) => `
          <button type="button" data-end="${e}" id="seal-end-${e}"
            aria-pressed="${e === sealEnd}">${esc(UI.ends[e])}${t.seal[e] > 0 ? ' ✓' : ''}</button>`).join('')}
      </div>
      <div class="zoom-stage zoom-stage--seal">
        <button type="button" class="zoom-tool zoom-tool--tube" id="seal-tool"
          aria-label="${esc(UI.zoom.sealLabel)}"
          style="--press:${pressNow.toFixed(3)}">
          ${assetSvg('capillary', { fill: t.fill, kind: t.kind, seal: t.seal, broken: t.broken })}
        </button>
        <div class="zoom-figure zoom-figure--clay">${assetSvg('clay', { dents: 3 })}</div>
      </div>
      <div class="zoom-press">
        <div class="bar">
          <i class="zone zone--weak" style="width:${(PRESS_GOOD * 100).toFixed(0)}%"></i>
          <i class="zone zone--break" style="left:${(PRESS_BREAK * 100).toFixed(0)}%"></i>
          <i class="fill" style="width:${(pressNow * 100).toFixed(0)}%"></i>
        </div>
        <div class="cap">
          <span>${esc(UI.zoom.sealTooSoft)}</span>
          <span>${esc(UI.zoom.sealTooHard)}</span>
        </div>
      </div>
      <dl class="zoom-readout">
        ${row(UI.controls.press, UI.units.percent(Math.round(pressNow * 100)))}
        ${row(UI.ends.outer, t.seal.outer > 0 ? UI.units.percent(Math.round(t.seal.outer * 100)) : '—')}
        ${row(UI.ends.inner, t.seal.inner > 0 ? UI.units.percent(Math.round(t.seal.inner * 100)) : '—')}
      </dl>
      <p class="zoom-hint" data-good="${sealed}">${esc(sealed ? UI.zoom.sealDone(label) : UI.zoom.sealOpen(label))}</p>
      ${sealed ? `<button type="button" class="zoom-secondary" id="seal-peel">${esc(UI.zoom.sealPeel(label))}</button>` : ''}`;

    body.querySelectorAll('[data-end]').forEach((b) => {
      b.addEventListener('click', () => { sealEnd = b.dataset.end; pressNow = 0; repaint(); });
    });
    body.querySelector('#seal-peel')?.addEventListener('click', () => {
      store.dispatch('PEEL_CLAY', { end: sealEnd });
      repaint();
    });
    bindSealTool(body.querySelector('#seal-tool'));
  }

  function bindSealTool(el) {
    if (!el) return;
    let drag = null;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      busy = true;
      drag = { id: e.pointerId, y: e.clientY };
    });

    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      // 아래로 끌수록 깊이 눌린다. 140 px 이 통째로 눌러 넣은 것.
      pressNow = clamp((e.clientY - drag.y) / 140, 0, 1);
      el.style.setProperty('--press', pressNow.toFixed(3));
      const fill = body.querySelector('.zoom-press .fill');
      if (fill) fill.style.width = `${(pressNow * 100).toFixed(0)}%`;
      const dd = body.querySelectorAll('.zoom-readout dd');
      if (dd[0]) dd[0].textContent = UI.units.percent(Math.round(pressNow * 100));
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      el.releasePointerCapture(e.pointerId);
      drag = null;
      busy = false;
      // 살짝 스친 것은 막으려 한 것이 아니다. 그 정도로 「얕게 막았습니다」를 띄우면
      // 화면이 하지도 않은 일을 나무란다.
      if (pressNow > 0.05) store.dispatch('SEAL_END', { end: sealEnd, press: pressNow });
      pressNow = 0;
      repaint();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    /** 키보드·보조기기 경로. 손짓이 정하던 깊이 자리에 **안전한 가운뎃값**을 넣는다. */
    el.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      store.dispatch('SEAL_END', { end: sealEnd, press: 0.72 });
      repaint();
    });
  }

  /* ---------------------------------------------------------------- */
  /* spin — 끈 당기기. **이 실험의 몸통**                               */
  /* ---------------------------------------------------------------- */

  /** 회전 빠르기를 **말로** 낸다. 회전수는 `[확인 필요]` 라 숫자를 쓰지 않는다. */
  function speedWord(speed) {
    const words = UI.zoom.speedWords;
    if (speed <= 0.02) return words[0];
    const i = Math.min(words.length - 1, 1 + Math.floor((speed / MAX_SPEED) * (words.length - 1)));
    return words[i];
  }

  /**
   * 게이지 밑 한 줄. **100 아래면 언제나 무엇을 하면 되는지 말한다** (docs/09 §3.1) —
   * 난이도와 무관하다 (banana·micrometer 와 같다). 난이도가 가르는 것은 알림의 「다음 행동」이다.
   */
  function gaugeHint(obs) {
    if (!obs.worst) return UI.observability.allGood;
    return UI.observability.hint(UI.observability.worst[obs.worst], UI.observability.fix[obs.worst]);
  }

  function renderSpin() {
    const st = store.getState();
    const level = st.session.level;
    const imbalance = imbalanceOf(st.rotor);
    const params = tubeParams(st);
    const obs = observability(params);

    body.innerHTML = `
      <h2>${esc(UI.bench.items.rotor)}</h2>
      <p class="zoom-slide-label">${esc(UI.zoom.spinMode)}</p>
      ${level === 1 ? `<p class="zoom-hint">${UI.zoom.pullHint.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>` : ''}
      <div class="zoom-stage zoom-stage--spin">
        <div class="zoom-figure zoom-figure--rotor" id="rotor-figure">${assetSvg('rotor', {
    speed: st.rotor.speed, slotA: st.rotor.slots.A, slotB: st.rotor.slots.B,
    wobble: imbalance,
  })}</div>
        <button type="button" class="zoom-ring" id="pull-ring" aria-label="${esc(UI.zoom.pullLabel)}">
          <span class="zoom-ring-cap">${esc(UI.zoom.pullButton)}</span>
        </button>
      </div>

      <div class="zoom-beat ${level >= 3 ? 'zoom-beat--small' : ''}" id="beat">
        <span class="zoom-beat-label" id="beat-label"></span>
        <div class="bar"><i class="fill" id="beat-fill"></i></div>
      </div>
      <p class="zoom-hint">${esc(UI.zoom.pullStrengthHint)}</p>

      <!-- 앞의 둘은 손을 놓은 뒤에도 계속 바뀐다 (회전이 잦아든다). 그래서 id 를 달아
           paintSpin 이 직접 고쳐 쓴다 — 없으면 회전이 멎는 동안에도 「아주 빠르게 돎」이
           그대로 붙어 있어, 화면이 눈에 보이는 것과 다른 말을 한다.
           셋째(당기는 세기)는 끌고 있는 손의 미리보기라 여기서 건드리지 않는다. -->
      <dl class="zoom-readout">
        <dt>${esc(UI.zoom.pullSpeedLabel)}</dt><dd id="spin-speed">${esc(speedWord(st.rotor.speed))}</dd>
        <dt>${esc(UI.zoom.pullRhythm)}</dt>
        <dd id="spin-rhythm">${esc(UI.units.percent(Math.round(rhythmQuality(st.rotor) * 100)))}</dd>
        ${row(UI.controls.strength, UI.units.percent(Math.round(pullNow * 100)))}
      </dl>
      <p class="zoom-hint" id="spin-note">${esc(UI.zoom.pullCount(st.rotor.pulls))}</p>
      ${balanceNote(st, imbalance)}
      ${!st.rotor.slots.A && !st.rotor.slots.B ? `<p class="zoom-hint" data-good="false">${esc(UI.zoom.pullEmpty)}</p>` : ''}

      ${seatControls(st)}

      <div class="zoom-result" id="spin-result">${renderTube(params, { idPrefix: 'zoom-', labels: true })}</div>
      ${compass()}

      <div class="zoom-gauge">
        <div class="bar"><i class="fill" id="spin-obs-fill" style="width:${obs.score}%"></i></div>
        <div class="cap"><span>${esc(UI.observability.label)}</span><span id="spin-obs">${obs.score}</span></div>
        <p class="hint" id="spin-obs-hint">${esc(gaugeHint(obs))}</p>
      </div>

      <button type="button" class="zoom-secondary" id="spin-stop">${esc(UI.zoom.stopButton)}</button>
      ${captureButton()}`;

    body.querySelector('#spin-stop')?.addEventListener('click', () => {
      store.dispatch('STOP_ROTOR', {});
      repaint();
    });
    body.querySelectorAll('[data-seat]').forEach((input) => {
      input.addEventListener('pointerdown', () => { busy = true; });
      input.addEventListener('input', () => {
        store.dispatch('SEAT', { slot: input.dataset.seat, depth: Number(input.value) / 100 },
          { skipNotify: true });
        paintSpin();
      });
      const done = () => { busy = false; store.notify(); repaint(); };
      input.addEventListener('pointerup', done);
      input.addEventListener('change', done);
    });
    bindPullRing(body.querySelector('#pull-ring'));
    bindCapture();
    paintSpin();
  }

  /**
   * 균형 안내.
   *
   * **시료가 빠져 있을 때는 「흔들립니다」라고 하지 않는다.** 자는 실험대의 모세관에만 댈 수
   * 있어서 학생은 재려고 시료를 꺼낸 뒤 이 화면에서 「결과 기록」을 누른다. 그때 빨대에는
   * 빈 모세관만 남아 있어 `imbalanceOf` 가 1 이고, 화면은 균형을 맞춰 돌린 학생에게
   * 주황으로 「반대쪽에 빈 모세관을 넣어 균형을 맞추세요」라고 했다 — 하지도 않은 잘못을
   * 나무라는 자리였다 (플레이테스트 — PLAYTEST-REVIEW #5). 시료가 없으면 어디 있는지만 말한다.
   */
  function balanceNote(st, imbalance) {
    if (sampleSlot(st.rotor) === null) {
      return `<p class="zoom-hint">${esc(UI.zoom.sampleOut)}</p>`;
    }
    return `<p class="zoom-hint" data-good="${imbalance <= 0.25}">
        ${esc(imbalance > 0.25 ? UI.zoom.pullWobble : UI.zoom.pullBalanced)}</p>`;
  }

  /**
   * 두 모세관을 얼마나 밀어 넣었는가.
   *
   * 두 쪽의 깊이가 다르면 무게 중심이 축에서 벗어나 그만큼 흔들린다.
   * **자리가 빈 쪽은 조절기를 내지 않는다** — 없는 것의 깊이를 정하라고 하면 안 된다.
   */
  function seatControls(st) {
    const rows = Object.values(SLOTS)
      .filter((slot) => st.rotor.slots[slot])
      .map((slot) => `
        <label class="zoom-seat">
          <span>${esc(UI.zoom.seatLabel(slot))}</span>
          <input type="range" min="30" max="100" step="1" data-seat="${slot}"
            value="${Math.round(st.rotor.seat[slot] * 100)}">
        </label>`);
    return rows.length ? `<div class="zoom-seats">${rows.join('')}</div>` : '';
  }

  /**
   * 박자와 회전만 다시 칠한다.
   *
   * 통째로 다시 그리면 60 분의 1 초마다 <button> 이 새로 만들어져 **끌고 있던 링이 사라진다.**
   * 그래서 값이 바뀌는 자리만 골라 고쳐 쓴다.
   *
   * ── 왜 읽기값까지 여기서 고치는가 ──────────────────────────────────
   * 앞서는 박자 표시·회전판 그림·결과 그림 셋만 칠했다. 그런데 **손을 놓은 뒤에도 결과는
   * 계속 바뀐다** — 회전이 잦아들고, 그동안에도 층은 계속 갈린다. 그 셋만 칠하면
   * 회전판이 거의 멎었는데도 「회전 빠르기 — 아주 빠르게 돎」이 그대로 붙어 있었다.
   * 직접 재어 보니 속도 0.79 → 0.097 로 떨어지는 3초 내내 글자가 한 번도 안 바뀌었다.
   * 화면이 눈에 보이는 것과 다른 말을 하면, 학생은 눈이 아니라 글자를 믿는다.
   */
  function paintSpin() {
    if (mode !== 'spin' || root.hidden) return;
    const st = store.getState();
    const err = timingError(st.rotor.phase);
    const now = err < BEAT_WINDOW;
    const fill = body.querySelector('#beat-fill');
    const label = body.querySelector('#beat-label');
    const beat = body.querySelector('#beat');
    // 막대가 **차오르다가** 「지금!」에서 가득 찬다. 당기면 0 으로 떨어지고 다시 차오른다 —
    // 그 오르내림이 곧 손이 맞춰야 할 리듬이다.
    if (fill) fill.style.width = `${(Math.max(0, 1 - err * 2) * 100).toFixed(0)}%`;
    if (label) label.textContent = now ? UI.zoom.pullBeatNow : UI.zoom.pullBeatWait;
    if (beat) beat.classList.toggle('is-now', now);
    const rotor = body.querySelector('#rotor-figure');
    if (rotor) {
      rotor.innerHTML = assetSvg('rotor', {
        speed: st.rotor.speed, slotA: st.rotor.slots.A, slotB: st.rotor.slots.B,
        wobble: imbalanceOf(st.rotor),
      });
    }
    const params = tubeParams(st);
    const result = body.querySelector('#spin-result');
    if (result) result.innerHTML = renderTube(params, { idPrefix: 'zoom-', labels: true });
    const speed = body.querySelector('#spin-speed');
    if (speed) speed.textContent = speedWord(st.rotor.speed);
    const rhythm = body.querySelector('#spin-rhythm');
    if (rhythm) rhythm.textContent = UI.units.percent(Math.round(rhythmQuality(st.rotor) * 100));
    // 「관찰 가능성」도 손을 놓은 뒤에 오른다 — 회전이 잦아드는 동안에도 계속 갈리므로.
    const obs = observability(params);
    const obsFill = body.querySelector('#spin-obs-fill');
    if (obsFill) obsFill.style.width = `${obs.score}%`;
    const obsNum = body.querySelector('#spin-obs');
    if (obsNum) obsNum.textContent = String(obs.score);
    const obsHint = body.querySelector('#spin-obs-hint');
    if (obsHint) obsHint.textContent = gaugeHint(obs);
  }

  /**
   * 링을 당긴다.
   *
   * 아래로 끌수록 세게 당기고, **놓는 순간** 당겨진다. 놓는 때가 곧 박자다 —
   * 세기와 박자를 한 손짓으로 정하게 두는 것이 이 조작의 전부다.
   */
  function bindPullRing(el) {
    if (!el) return;
    let drag = null;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      busy = true;
      drag = { id: e.pointerId, y: e.clientY };
      pullNow = 0.2;
      el.classList.add('is-pulling');
    });

    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      pullNow = clamp(0.2 + (e.clientY - drag.y) / 120, 0.2, 1);
      el.style.setProperty('--pull', pullNow.toFixed(3));
      const dd = body.querySelectorAll('.zoom-readout dd');
      if (dd[2]) dd[2].textContent = UI.units.percent(Math.round(pullNow * 100));
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove('is-pulling');
      drag = null;
      busy = false;
      store.dispatch('PULL', { strength: pullNow });
      pullNow = 0;
      repaint();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    /**
     * 키보드·보조기기 경로.
     *
     * 손짓으로 정하던 세기 자리에 가운뎃값을 넣는다. **박자는 그대로 손에 남는다** —
     * 언제 누르는지가 그대로 박자이기 때문에, 키보드로도 리듬을 맞출 수 있다.
     * 이 실험의 변인이 마우스 전용이 되지 않는 자리다.
     */
    el.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      store.dispatch('PULL', { strength: 0.75 });
      repaint();
    });
  }

  /* ---------------------------------------------------------------- */

  store.subscribe(() => { if (!busy) repaint(); });

  /** 확대 뷰가 열려 있는가. 시계(main.js)가 얼마나 자주 알릴지 정할 때 본다. */
  return { open, close, isOpen: shell.isOpen, paint: paintSpin };
}
