/**
 * 확대 뷰 — 색소 추출 / 거름종이 손질 / 전개.
 *
 * **실험대에서는 큰 동작만, 확대 뷰에서는 손끝 동작만** 한다 (PLAYBOOK §4).
 * 여기 있는 것은 전부 **결과를 가르는 값**이다 — 몇 번 찍는가, 한 번에 얼마나 오래 대는가,
 * 원점을 어디에 긋는가, 전개액을 얼마나 붓는가.
 *
 * 이 값들을 실험대에서 가져다 대기만 하면 알아서 정해지게 두면, 이 실험의 변인이
 * 학생 손을 떠나고 세어 볼 일 자체가 없어진다.
 *
 * Esc 로 나간다. 여는 요소가 <button> 이므로 키보드로도 들어올 수 있다 (bench.js 참조).
 * 열렸을 때 포커스를 뷰 안으로 옮기고, 닫으면 열었던 곳으로 되돌린다.
 */

import { renderStrip } from '../render/strip.js';
import { observability } from '../sim/quality.js';
import {
  stripParams, currentFrontMm, frontOverrun, isSettled, extractStrength, MARKERS,
} from '../sim/state.js';
import { ORIGIN_MM, ORIGIN_RANGE_MM, MAX_DEPTH_MM, PAPER_H_MM } from '../sim/develop.js';
import { UI } from './strings.js';
import { ASSETS } from '../assets/index.js';

const Z = UI.zoom;

/**
 * 손잡이의 **출발 자리**. 난이도에 따라 여기만 달라진다 (`open()` 참조).
 *
 * 1단계는 절차에 적힌 값에서 시작한다. 2·3단계는 범위 가운데에서 시작해 학생이 정한다.
 * 어느 쪽이든 **움직일 수 있는 범위는 같다.**
 */
const NEUTRAL_ORIGIN_MM = Math.round((ORIGIN_RANGE_MM[0] + ORIGIN_RANGE_MM[1]) / 2);
const SAFE_POUR_MM = 5;      // 원점(10 mm)보다 얕다
const NEUTRAL_POUR_MM = 6;   // 손잡이 범위(1~10)의 가운데

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

export function createZoom(root, store) {
  root.className = 'zoom-overlay';
  root.hidden = true;
  // 닫기 단추는 패널의 **첫 자식**이고 sticky 다. 절대 위치로 두면 창보다 긴 내용이
  // 들어간 작은 화면(스마트폰 가로)에서 아래로 스크롤할 때 화면 밖으로 밀려 나가,
  // Esc 도 배경 탭도 닿지 않는 자리에서 나갈 방법이 없어진다.
  root.innerHTML = `
    <div class="zoom-panel" role="dialog" aria-modal="true" tabindex="-1">
      <button type="button" id="zoom-close" class="zoom-close"></button>
      <div class="zoom-body"></div>
    </div>`;
  const panel = root.querySelector('.zoom-panel');
  const body = root.querySelector('.zoom-body');
  const closeBtn = root.querySelector('.zoom-close');
  closeBtn.textContent = Z.close;

  let mode = null;
  let opener = null;
  let openerId = null;
  /** 실험대에서 들고 온 도구. 이것만 확대 뷰에 나온다 — 안 가져온 도구가 떠 있으면 헷갈린다. */
  let zoomTool = null;
  /** 결과를 기록한 직후 화면에 남길 확인 문구. 열 때마다 지운다. */
  let captureNotice = null;
  /**
   * 손이 정하는 값들. 화면을 다시 그려도 그대로 남아야 한다 —
   * 한 번 찍을 때마다 손잡이가 처음 자리로 튕겨 돌아가면 매번 다시 맞춰야 한다.
   */
  let originMm = ORIGIN_MM;
  let marker = MARKERS.PENCIL;
  let dwell = 0.2;
  let pourMm = 5;
  /**
   * 슬라이더를 쥐고 있는 동안에는 구독으로 들어오는 전체 다시 그리기를 건너뛴다.
   * TICK 처럼 사용자와 무관한 상태 변경이 body.innerHTML 을 새로 만들면
   * 쥐고 있던 <input type=range> 가 통째로 사라져 조작이 끊긴다.
   */
  let busy = false;

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.removeEventListener('keydown', onKeydown);
    // 이 notify 가 실험대를 다시 그리면 opener 로 잡아 둔 버튼 자체가 새 요소로 바뀐다.
    // 그래서 notify 를 먼저 하고, data-id 로 (다시 만들어졌을 수도 있는) 같은 자리를 찾는다.
    store.notify();
    const target = openerId ? document.querySelector(`[data-id="${openerId}"]`) : opener;
    if (target && target.isConnected) target.focus();
    opener = null;
    openerId = null;
  }
  closeBtn.addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });

  /**
   * @param {'tube'|'paper'|'vial'} openMode
   * @param {null} _unused 바나나랩의 슬라이드 id 자리. 이 실험은 종이가 한 장이라 쓰지 않는다
   * @param {HTMLElement} openerEl
   * @param {'capillary'|'pencil'|'bottle'|null} tool 실험대에서 **들고 온** 도구
   */
  function open(openMode, _unused, openerEl, tool = null) {
    mode = openMode;
    zoomTool = tool;
    captureNotice = null;
    const st = store.getState();
    // 손잡이가 어디서 시작하는가 — **난이도가 다른 것은 이것뿐이다.**
    // 1단계는 기구를 대신 맞춰 주고, 2·3단계는 가운데에서 시작해 직접 정한다.
    // **할 수 있는 일은 세 단계가 똑같다** — 손잡이의 범위도, 누를 수 있는 단추도 같다.
    // 손잡이를 못 움직이게 만들면 그건 설명을 줄인 게 아니라 길을 막은 것이다.
    const assisted = st.session.level === 1;
    originMm = st.paper.originMm ?? (assisted ? ORIGIN_MM : NEUTRAL_ORIGIN_MM);
    pourMm = assisted ? SAFE_POUR_MM : NEUTRAL_POUR_MM;
    marker = st.paper.marker ?? MARKERS.PENCIL;
    opener = openerEl ?? document.activeElement;
    openerId = opener?.dataset?.id ?? null;
    root.hidden = false;
    document.addEventListener('keydown', onKeydown);
    renderBody();
    panel.focus();
  }

  function renderBody() {
    if (mode === 'tube') renderTubeMode();
    else if (mode === 'paper') renderPaperMode();
    else if (mode === 'vial') renderVialMode();
  }

  /**
   * 확대 뷰가 만드는 id 앞에 붙이는 것.
   *
   * **애셋 안의 id 와 부딪히지 않게 하려고 있다.** 애셋은 인라인 SVG 라 그 안의
   * `<ellipse id="spot">`·`<path id="origin">` 이 문서 전체의 id 공간에 그대로 올라온다.
   * 접두사가 없으면 `<label for="origin">` 이 **거름종이 그림의 선**을 가리키게 되어
   * 손잡이의 이름이 사라진다 — 화면은 멀쩡해 보이고 스크린리더에서만 틀린다.
   * `tests/dom-ids.test.js` 가 이것을 지킨다.
   */
  const ZID = 'z-';
  const zid = (name) => `${ZID}${name}`;

  /** 값 하나짜리 손잡이. 세 모드가 같은 모양을 쓴다. */
  function slider(id, label, value, { min, max, step, readout }) {
    return `
      <div class="zoom-slider">
        <div class="zoom-slider-head">
          <label for="${zid(id)}">${esc(label)}</label><span id="${zid(id)}-out">${esc(readout)}</span>
        </div>
        <input type="range" id="${zid(id)}" min="${min}" max="${max}" step="${step}" value="${value}">
      </div>`;
  }

  /**
   * 눈에 띄는 단추 하나.
   *
   * **단추를 잠그지 않는다.** 이 프로젝트는 잘못된 조작을 막지 않는다 —
   * 마른 종이에 「말리기」를 눌러도 규칙 엔진이 "이미 말라 있습니다" 라고 답해 주고,
   * **그 답을 듣는 것이 배우는 내용이다.** 미리 잠가 두면 들을 기회가 사라진다
   * (AGENTS.md §2.1 · tests/ui.contract.test.js).
   */
  const act = (id, label) =>
    `<button type="button" class="zoom-action" id="${zid(id)}">${esc(label)}</button>`;

  const note = (text, kind = '') =>
    `<p class="zoom-note${kind ? ` zoom-note--${kind}` : ''}">${esc(text)}</p>`;

  /* ---------------------------------------------------------------- */
  /* 색소 추출 — 원심관                                                 */
  /* ---------------------------------------------------------------- */

  function renderTubeMode() {
    const st = store.getState();
    const t = st.tube;
    const hasLeaf = t.leaf > 0;
    const hasExtract = t.extract > 0;
    const ready = hasLeaf && hasExtract;

    /*
     * **무엇이 들었는지 보고 말한다.**
     *
     * 예전에는 「잎이 없거나 추출액이 없거나」를 한 덩이로 묶어 `비어 있습니다` 를 냈다.
     * 그래서 **잎을 막 넣은 학생에게 「원심관이 비어 있습니다. 잎과 추출액을 가져다
     * 대세요」**가 떴다 — 방금 넣은 것이 안 들어간 줄 알고 같은 조작을 되풀이하게 만든다.
     */
    const missing = ready ? null
      : (!hasLeaf && !hasExtract ? Z.tubeEmpty : (hasLeaf ? Z.tubeNeedExtract : Z.tubeNeedLeaf));

    /*
     * **층이 갈리는 중**을 따로 말한다. 예전에는 「갈렸다/아직 섞여 있다」 둘뿐이라,
     * 가라앉는 내내 「지금 뽑으면 부스러기가 딸려 옵니다」만 떠서 기다리면 되는 것인지
     * 무언가 잘못한 것인지 알 수 없었다.
     */
    const settled = isSettled(t);
    const settling = !settled && t.settleT > 0;
    const layerNote = settled ? [Z.tubeSettled, 'good']
      : (settling ? [Z.tubeSettle, ''] : [Z.tubeUnsettled, 'warn']);

    /*
     * **뽑힌 정도를 보여 준다.**
     *
     * 「흔들수록 더 뽑힙니다」라고 적어 놓고 흔들어도 화면이 그대로였다 — 원심관 그림은
     * `shaken` 을 받지 않으므로(애셋 계약) 눌러도 눈에 보이는 변화가 없다.
     * 재어 보니 세 번 눌러 0 → 0.6 이 됐는데 화면은 한 글자도 안 바뀌었다.
     * **결과가 답한다는 것은 결과가 보인다는 뜻이다.**
     */
    const strength = extractStrength(t);
    const pct = Math.round(strength * 100);
    const gauge = ready ? `
      <div class="zoom-gauge">
        <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
        <div class="cap"><span>${esc(Z.tubeExtractLabel)}</span><b>${pct}</b></div>
        <div class="hint">${esc(pct >= 100 ? Z.tubeExtractFull : Z.tubeExtractHint)}</div>
      </div>` : '';

    body.innerHTML = `
      <h2>${esc(Z.tubeMode)}</h2>
      <div class="zoom-vessel-stage">${ASSETS.tube.render({
        leaf: t.leaf, extract: t.extract, settleT: t.settleT, capped: true,
      })}</div>
      ${missing ? note(missing) : `
        ${note(layerNote[0], layerNote[1])}
        ${note(Z.tubeShakeHint)}
        ${act('shake', Z.tubeShake)}
        ${zoomTool === 'capillary' ? act('load', UI.protocol[3].steps[0].label) : ''}
        ${gauge}
      `}`;

    body.querySelector(`#${zid('shake')}`)?.addEventListener('click', () => {
      store.dispatch('SHAKE', { amount: 0.2 });
      renderBody();
    });
    body.querySelector(`#${zid('load')}`)?.addEventListener('click', () => {
      store.dispatch('LOAD_CAPILLARY', {});
      renderBody();
    });
  }

  /* ---------------------------------------------------------------- */
  /* 거름종이 손질 — 원점 긋기 · 찍기 · 표시 · 재기                      */
  /* ---------------------------------------------------------------- */

  function renderPaperMode() {
    const st = store.getState();
    const p = st.paper;
    const params = stripParams(st);
    const q = observability(params);

    if (p.torn) {
      body.innerHTML = `
        <h2>${esc(Z.paperMode)}</h2>
        <div class="zoom-strip">${renderStrip(params, { idPrefix: 'zoom-' })}</div>
        ${note(Z.tornNote, 'warn')}`;
      return;
    }

    body.innerHTML = `
      <h2>${esc(Z.paperMode)}</h2>
      <div class="zoom-strip">${renderStrip(params, { idPrefix: 'zoom-' })}</div>
      ${captureNotice ? note(captureNotice, 'good') : ''}
      ${zoomTool === 'pencil' ? pencilControls(p) : ''}
      ${zoomTool === 'capillary' ? capillaryControls(st) : ''}
      ${zoomTool === null ? measureControls(p) : ''}
      <div class="zoom-gauge">
        <div class="bar"><div class="fill" style="width:${q.score}%"></div></div>
        <div class="cap"><span>${esc(UI.observability.label)}</span><b>${q.score}</b></div>
        <div class="hint">${esc(q.worst
          ? UI.observability.hint(UI.observability.worst[q.worst])
          : UI.observability.allGood)}</div>
      </div>`;

    bindPencil();
    bindCapillary();
    bindMeasure();
  }

  function pencilControls(p) {
    return `
      ${slider('origin', Z.originLabel, originMm, {
        min: ORIGIN_RANGE_MM[0], max: ORIGIN_RANGE_MM[1], step: 1,
        readout: UI.units.mm(Math.round(originMm)),
      })}
      ${note(Z.originHint)}
      <div class="zoom-choice" role="group" aria-label="${esc(Z.markerLabel)}">
        <span class="zoom-choice-label">${esc(Z.markerLabel)}</span>
        ${[MARKERS.PENCIL, MARKERS.PEN].map((m) => `
          <button type="button" data-marker="${m}" aria-pressed="${marker === m}"
            class="zoom-opt${marker === m ? ' zoom-opt--chosen' : ''}">${esc(UI.markers[m])}</button>`).join('')}
      </div>
      ${marker === MARKERS.PEN ? note(Z.markerPenWarn, 'warn') : ''}
      ${act('draw-origin', UI.protocol[2].steps[0].label)}
      ${act('mark-front', Z.markFrontLabel)}
      ${note(Z.markFrontHint)}
      ${act('dry-paper', Z.dryPaperLabel)}
      ${act('mark-bands', Z.markBandsLabel)}`;
  }

  function bindPencil() {
    const originEl = body.querySelector(`#${zid('origin')}`);
    if (originEl) {
      originEl.addEventListener('pointerdown', () => { busy = true; });
      originEl.addEventListener('input', (e) => {
        originMm = Number(e.target.value);
        body.querySelector(`#${zid('origin')}-out`).textContent = UI.units.mm(Math.round(originMm));
      });
      originEl.addEventListener('change', () => { busy = false; });
    }
    body.querySelectorAll('[data-marker]').forEach((b) => {
      b.addEventListener('click', () => { marker = b.dataset.marker; renderBody(); });
    });
    body.querySelector(`#${zid('draw-origin')}`)?.addEventListener('click', () => {
      store.dispatch('DRAW_ORIGIN', { heightMm: originMm, marker });
      renderBody();
    });
    body.querySelector(`#${zid('mark-front')}`)?.addEventListener('click', () => {
      store.dispatch('MARK_FRONT', {});
      renderBody();
    });
    body.querySelector(`#${zid('dry-paper')}`)?.addEventListener('click', () => {
      store.dispatch('DRY_PAPER', {});
      renderBody();
    });
    body.querySelector(`#${zid('mark-bands')}`)?.addEventListener('click', () => {
      store.dispatch('MARK_BANDS', {});
      renderBody();
    });
  }

  function capillaryControls(st) {
    const p = st.paper;
    if (st.tools.capillary.strength <= 0) return note(Z.capillaryEmpty, 'warn');
    return `
      ${slider('dwell', Z.dwellLabel, Math.round(dwell * 100), {
        min: 0, max: 100, step: 5,
        readout: dwell > 0.3 ? Z.dwellLong : Z.dwellShort,
      })}
      ${dwell > 0.3 ? note(Z.dwellWarn, 'warn') : ''}
      ${note(Z.spotHint)}
      ${note(Z.spotCount(p.spots))}
      ${act('spot', Z.spotLabel)}
      ${act('dry-spot', Z.dryLabel, p.spotWet <= 0)}`;
  }

  function bindCapillary() {
    const dwellEl = body.querySelector(`#${zid('dwell')}`);
    if (dwellEl) {
      dwellEl.addEventListener('pointerdown', () => { busy = true; });
      dwellEl.addEventListener('input', (e) => {
        dwell = Number(e.target.value) / 100;
        body.querySelector(`#${zid('dwell')}-out`).textContent = dwell > 0.3 ? Z.dwellLong : Z.dwellShort;
      });
      dwellEl.addEventListener('change', () => { busy = false; renderBody(); });
    }
    body.querySelector(`#${zid('spot')}`)?.addEventListener('click', () => {
      store.dispatch('SPOT', { dwell });
      renderBody();
    });
    body.querySelector(`#${zid('dry-spot')}`)?.addEventListener('click', () => {
      store.dispatch('DRY_SPOT', {});
      renderBody();
    });
  }

  function measureControls(p) {
    const wet = p.wetness > 0.6;
    return `
      ${wet ? note(Z.rulerWet, 'warn') : note(Z.rulerHint)}
      ${act(p.rulerPlaced ? 'lift-ruler' : 'place-ruler', p.rulerPlaced ? Z.rulerLift : Z.rulerLabel)}
      ${act('capture', Z.capture)}`;
  }

  function bindMeasure() {
    body.querySelector(`#${zid('place-ruler')}`)?.addEventListener('click', () => {
      store.dispatch('MEASURE', {});
      renderBody();
    });
    body.querySelector(`#${zid('lift-ruler')}`)?.addEventListener('click', () => {
      store.dispatch('LIFT_RULER', {});
      renderBody();
    });
    body.querySelector(`#${zid('capture')}`)?.addEventListener('click', () => {
      const r = store.dispatch('CAPTURE', {});
      const n = r.state.session.captures.length;
      captureNotice = Z.captureSaved(n);
      renderBody();
    });
  }

  /* ---------------------------------------------------------------- */
  /* 전개 — 바이알                                                      */
  /* ---------------------------------------------------------------- */

  function renderVialMode() {
    const st = store.getState();
    const v = st.vial;
    const p = st.paper;
    const origin = p.originMm ?? ORIGIN_MM;
    const front = currentFrontMm(p);
    const over = frontOverrun(p);

    body.innerHTML = `
      <h2>${esc(Z.vialMode)}</h2>
      <div class="zoom-vessel-stage">${ASSETS.vial.render({
        depth: v.depthMm, capped: v.capped, hasPaper: v.hasPaper,
      })}</div>
      ${zoomTool === 'bottle' ? `
        ${slider('pour', Z.pourAmount, pourMm, {
          min: 1, max: 10, step: 1, readout: UI.units.mm(pourMm),
        })}
        ${act('pour-go', Z.pourLabel)}` : ''}
      <dl class="zoom-readout">
        <div><dt>${esc(Z.depthLabel)}</dt><dd>${esc(UI.units.mm(Math.round(v.depthMm)))}</dd></div>
        <div><dt>${esc(UI.notebook.originLabel)}</dt><dd>${esc(UI.units.mm(Math.round(origin)))}</dd></div>
        <div><dt>${esc(Z.frontLabel)}</dt><dd>${esc(over ? '—' : UI.units.mm(Math.round(front)))}</dd></div>
      </dl>
      ${note(v.depthMm >= origin ? Z.depthWarnDeep : Z.depthOk, v.depthMm >= origin ? 'warn' : 'good')}
      ${over ? note(Z.frontOverrun, 'warn') : note(Z.frontHint)}
      ${act('cap', v.capped ? `${Z.capLabel} — ${Z.capClosed}` : `${Z.capLabel} — ${Z.capOpen}`)}
      ${note(Z.capHint)}
      ${act(p.inVial ? 'remove' : 'insert', p.inVial ? Z.removeLabel : Z.insertLabel)}`;

    const pourEl = body.querySelector(`#${zid('pour')}`);
    if (pourEl) {
      pourEl.addEventListener('pointerdown', () => { busy = true; });
      pourEl.addEventListener('input', (e) => {
        pourMm = Number(e.target.value);
        body.querySelector(`#${zid('pour')}-out`).textContent = UI.units.mm(pourMm);
      });
      pourEl.addEventListener('change', () => { busy = false; });
    }
    body.querySelector(`#${zid('pour-go')}`)?.addEventListener('click', () => {
      store.dispatch('POUR_SOLVENT', { mm: pourMm });
      renderBody();
    });
    body.querySelector(`#${zid('cap')}`)?.addEventListener('click', () => {
      store.dispatch(v.capped ? 'UNCAP_VIAL' : 'CAP_VIAL', {});
      renderBody();
    });
    body.querySelector(`#${zid('insert')}`)?.addEventListener('click', () => {
      store.dispatch('INSERT_PAPER', {});
      renderBody();
    });
    body.querySelector(`#${zid('remove')}`)?.addEventListener('click', () => {
      store.dispatch('REMOVE_PAPER', {});
      renderBody();
    });
  }

  // 전개가 진행되는 동안 화면이 따라 움직여야 한다 — 전선이 오르는 것을 보고 꺼내기 때문이다.
  // 손잡이를 쥐고 있는 동안에는 건너뛴다. 다시 그리면 그 손잡이가 사라진다.
  store.subscribe(() => {
    if (root.hidden || busy) return;
    renderBody();
  });

  return { open, close };
}
