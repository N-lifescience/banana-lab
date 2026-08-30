/**
 * 확대 뷰 — **손끝으로 하는 일**만 여기 있다.
 *
 * 실험대에서는 물건을 집어 옮기는 큰 동작만 한다. 결과를 가르는 값(각도 · 누르는 깊이 ·
 * 당기는 세기와 박자)은 전부 이 화면에서 손이 정한다 (PLAYBOOK §4).
 *
 * 모드 셋:
 *   draw  손끝에 모세관을 **비스듬히** 대어 혈액을 빨아올린다
 *   seal  모세관 끝을 고무찰흙에 **눌러** 막는다
 *   spin  끈을 **박자에 맞춰** 당긴다 — 이 실험의 몸통
 *
 * Esc 로 나간다. 여는 요소가 <button> 이므로 키보드로도 들어올 수 있다 (bench.js 참조).
 * 열렸을 때 포커스를 뷰 안으로 옮기고, 닫으면 열었던 곳으로 되돌린다.
 */

import { renderTube } from '../render/tube.js';
import { observability } from '../sim/quality.js';
import {
  tubeParams, imbalanceOf, isSpinning, rhythmQuality, sampleSlot, columnLength,
  ENDS, SLOTS, ANGLE_RANGE_DEG, ANGLE_BEST_DEG, PRESS_BREAK, PRESS_GOOD,
} from '../sim/state.js';
import { timingError, MAX_SPEED } from '../sim/spin.js';
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
  root.className = 'zoom-overlay';
  root.hidden = true;
  // 닫기 단추는 패널의 **첫 자식**이고 sticky 다. 절대 위치로 두면 창보다 긴 내용이
  // 들어간 작은 화면에서 아래로 스크롤할 때 화면 밖으로 밀려 나가, 나갈 방법이 없어진다.
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
  let opener = null;
  let openerId = null;
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

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    mode = null;
    document.removeEventListener('keydown', onKeydown);
    // 회전 중에는 skipNotify 로 조용히 갱신됐다. 닫을 때 한 번 전체를 동기화해
    // 실험대(배경) 뷰가 최신 상태를 반영하게 한다.
    // 이 notify 가 bench 를 다시 그리면 opener 로 잡아 둔 버튼 자체가 새 요소로 바뀌므로,
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
   * @param {'draw'|'seal'|'spin'} openMode
   * @param {HTMLElement} openerEl
   */
  function open(openMode, openerEl) {
    mode = openMode;
    captureNotice = null;
    pressNow = 0;
    pullNow = 0;
    opener = openerEl ?? document.activeElement;
    openerId = opener?.dataset?.id ?? null;
    root.hidden = false;
    document.addEventListener('keydown', onKeydown);
    renderBody();
    panel.focus();
  }

  function renderBody() {
    if (mode === 'draw') renderDraw();
    else if (mode === 'seal') renderSeal();
    else if (mode === 'spin') renderSpin();
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
      + (captureNotice ? `<p class="zoom-note">${esc(captureNotice)}</p>` : '');
  }

  function bindCapture() {
    body.querySelector('#zoom-capture')?.addEventListener('click', () => {
      const r = store.dispatch('CAPTURE', {});
      if (r.outcome !== 'blocked') {
        captureNotice = UI.zoom.captureSaved(r.state.session.captures.length);
      }
      renderBody();
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
      <h2>${esc(UI.zoom.drawMode)}</h2>
      <p class="zoom-hint">${esc(UI.zoom.drawHint)}</p>
      ${st.finger.drop <= 0 ? `<p class="zoom-warn">${esc(UI.zoom.drawNoDrop)}</p>` : ''}
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
      <p class="zoom-note ${good ? 'zoom-note--good' : 'zoom-note--warn'}">
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
      const note = body.querySelector('.zoom-note');
      if (note) {
        const good = Math.abs(angleDeg - ANGLE_BEST_DEG) <= 22;
        note.textContent = good ? UI.zoom.drawAngleGood : UI.zoom.drawAngleBad;
        note.classList.toggle('zoom-note--good', good);
        note.classList.toggle('zoom-note--warn', !good);
      }
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      el.releasePointerCapture(e.pointerId);
      stopHold();
      drag = null;
      busy = false;
      store.notify();
      renderBody();
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
      renderBody();
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
      <h2>${esc(UI.zoom.sealMode)}</h2>
      ${compass()}
      <p class="zoom-hint">${esc(UI.zoom.sealHint)}</p>
      <div class="zoom-endpick" role="group" aria-label="${esc(UI.zoom.sealPickEnd)}">
        <span class="zoom-endpick-label">${esc(UI.zoom.sealPickEnd)}</span>
        ${Object.values(ENDS).map((e) => `
          <button type="button" data-end="${e}" class="${e === sealEnd ? 'is-on' : ''}"
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
      <p class="zoom-note">${esc(sealed ? UI.zoom.sealDone(label) : UI.zoom.sealOpen(label))}</p>
      ${sealed ? `<button type="button" class="zoom-secondary" id="seal-peel">${esc(UI.zoom.sealPeel(label))}</button>` : ''}`;

    body.querySelectorAll('[data-end]').forEach((b) => {
      b.addEventListener('click', () => { sealEnd = b.dataset.end; pressNow = 0; renderBody(); });
    });
    body.querySelector('#seal-peel')?.addEventListener('click', () => {
      store.dispatch('PEEL_CLAY', { end: sealEnd });
      renderBody();
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
      renderBody();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    /** 키보드·보조기기 경로. 손짓이 정하던 깊이 자리에 **안전한 가운뎃값**을 넣는다. */
    el.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      store.dispatch('SEAL_END', { end: sealEnd, press: 0.72 });
      renderBody();
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

  function renderSpin() {
    const st = store.getState();
    const level = st.session.level;
    const imbalance = imbalanceOf(st.rotor);
    const params = tubeParams(st);
    const obs = observability(params);
    const worstLabel = obs.worst ? UI.observability.worst[obs.worst] : null;

    body.innerHTML = `
      <h2>${esc(UI.zoom.spinMode)}</h2>
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
      <p class="zoom-note" id="spin-note">${esc(UI.zoom.pullCount(st.rotor.pulls))}</p>
      <p class="zoom-note ${imbalance > 0.25 ? 'zoom-note--warn' : 'zoom-note--good'}">
        ${esc(imbalance > 0.25 ? UI.zoom.pullWobble : UI.zoom.pullBalanced)}</p>
      ${!st.rotor.slots.A && !st.rotor.slots.B ? `<p class="zoom-warn">${esc(UI.zoom.pullEmpty)}</p>` : ''}

      ${seatControls(st)}

      <div class="zoom-result" id="spin-result">${renderTube(params, { idPrefix: 'zoom-', labels: true })}</div>
      ${compass()}

      <div class="zoom-gauge">
        <div class="bar"><i class="fill" id="spin-obs-fill" style="width:${obs.score}%"></i></div>
        <div class="cap"><span>${esc(UI.observability.label)}</span><span id="spin-obs">${obs.score}</span></div>
        ${level === 1 ? `<p class="hint">${esc(worstLabel ? UI.observability.hint(worstLabel) : UI.observability.allGood)}</p>` : ''}
      </div>

      <button type="button" class="zoom-secondary" id="spin-stop">${esc(UI.zoom.stopButton)}</button>
      ${captureButton()}`;

    body.querySelector('#spin-stop')?.addEventListener('click', () => {
      store.dispatch('STOP_ROTOR', {});
      renderBody();
    });
    body.querySelectorAll('[data-seat]').forEach((input) => {
      input.addEventListener('pointerdown', () => { busy = true; });
      input.addEventListener('input', () => {
        store.dispatch('SEAT', { slot: input.dataset.seat, depth: Number(input.value) / 100 },
          { skipNotify: true });
        paintSpin();
      });
      const done = () => { busy = false; store.notify(); renderBody(); };
      input.addEventListener('pointerup', done);
      input.addEventListener('change', done);
    });
    bindPullRing(body.querySelector('#pull-ring'));
    bindCapture();
    paintSpin();
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
    // 「결과의 읽을 만함」도 손을 놓은 뒤에 오른다 — 회전이 잦아드는 동안에도 계속 갈리므로.
    const obs = observability(params);
    const obsFill = body.querySelector('#spin-obs-fill');
    if (obsFill) obsFill.style.width = `${obs.score}%`;
    const obsNum = body.querySelector('#spin-obs');
    if (obsNum) obsNum.textContent = String(obs.score);
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
      renderBody();
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
      renderBody();
    });
  }

  /* ---------------------------------------------------------------- */

  /** 확대 뷰가 열려 있는가. 시계(main.js)가 얼마나 자주 알릴지 정할 때 본다. */
  const isOpen = () => !root.hidden;

  store.subscribe(() => {
    if (root.hidden || busy) return;
    renderBody();
  });

  return { open, close, isOpen, paint: paintSpin };
}
