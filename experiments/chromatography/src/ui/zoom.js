/**
 * 확대 뷰 — 색소 추출(원심관) / 거름종이 손질 / 전개(바이알) / 물건 화면.
 *
 * **실험대에서는 큰 동작만, 확대 뷰에서는 손끝 동작만** 한다 (PLAYBOOK §4).
 * 여기 있는 것은 전부 **결과를 가르는 값**이다 — 몇 번 찍는가, 한 번에 얼마나 오래 대는가,
 * 원점을 어디에 긋는가, 전개액을 얼마나 붓는가.
 *
 * 이 값들을 실험대에서 가져다 대기만 하면 알아서 정해지게 두면, 이 실험의 변인이
 * 학생 손을 떠나고 세어 볼 일 자체가 없어진다.
 *
 * 덮개·패널·닫기·Esc·포커스·스크롤은 공용 틀(`createZoomShell`)이 한다 (docs/09-uniformity.md §3).
 * 여기는 **무엇을 그릴지**만 갖는다. 물건 화면(잎·병·통·모세관·연필·자·쓰레기통·폐액통·개수대)은
 * 공용 `renderItemView` 로 그린다 — 누르면 본다, 끌면 옮긴다, 단추로 한다.
 */

import { renderStrip } from '../render/strip.js';
import { observability } from '../sim/quality.js';
import {
  stripParams, currentFrontMm, frontOverrun, isSettled, extractStrength, MARKERS,
} from '../sim/state.js';
import { ORIGIN_MM, ORIGIN_RANGE_MM, MAX_DEPTH_MM, PAPER_H_MM } from '../sim/develop.js';
import { createZoomShell } from '../../../../packages/lab-kit/ui/zoom-shell.js';
import { renderItemView, acceptsFrom } from '../../../../packages/lab-kit/ui/item-view.js';
import { dropTable } from './bench.js';
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
const SAFE_POUR_MM = 5;      // 원점(ORIGIN_MM = 25 mm)보다 얕다 — 출처는 develop.js
const NEUTRAL_POUR_MM = 6;   // 손잡이 범위(1~10)의 가운데

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

export function createZoom(root, store) {
  const shell = createZoomShell(root, {
    closeLabel: Z.close,
    // 닫을 때 한 번 전체를 동기화해 실험대(배경) 뷰가 최신 상태를 반영하게 한다.
    onClose: () => store.notify(),
  });
  const { body } = shell;
  /** 놓기 표 — 「여기에 끌어다 놓을 수 있는 것」을 거꾸로 읽는다. 실행하지 않는다. */
  const DROPS = dropTable(store);

  let mode = null;
  /** 물건 화면에 열린 물건 (실험대의 id). */
  let itemId = null;
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

  function close() { shell.close(); }

  /**
   * @param {'tube'|'paper'|'vial'|'item'} openMode
   * @param {string|null} openId  item 이면 실험대 물건 id. 나머지 셋은 물건이 하나라 쓰지 않는다
   * @param {HTMLElement} openerEl
   * @param {'capillary'|'pencil'|'bottle'|null} tool 실험대에서 **들고 온** 도구
   */
  function open(openMode, openId, openerEl, tool = null) {
    mode = openMode;
    itemId = openMode === 'item' ? openId : null;
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
    shell.open(renderBody, openerEl);
  }

  function renderBody() {
    if (mode === 'tube') renderTubeMode();
    else if (mode === 'paper') renderPaperMode();
    else if (mode === 'vial') renderVialMode();
    else if (mode === 'item') renderItemMode();
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
    `<button type="button" class="zoom-action zoom-act" id="${zid(id)}">${esc(label)}</button>`;

  /**
   * 상태 한 줄. 공용 `.zoom-hint` — 잘 됐으면 `data-good="true"`, 조심할 것이면 `"false"`,
   * 그냥 사실이면 표시 없음 (docs/09 §3).
   */
  const hint = (text, good = null) =>
    `<p class="zoom-hint"${good === null ? '' : ` data-good="${good}"`}>${esc(text)}</p>`;

  /** 제목 밑 한 줄 — 이 화면에서 무엇을 하는가. */
  const subtitle = (text) => `<p class="zoom-slide-label">${esc(text)}</p>`;

  /** 실험대 물건 id → 놓기 표의 종류. 병 둘은 한 종류다. */
  const kindOf = (id) => (id.startsWith('bottle') ? 'bottle' : id);
  /** 종류 → 화면에 쓸 이름. 끄는 쪽 이름이라 짧은 것(`UI.assetNames`)을 쓴다. */
  const nameOfKind = (kind) => UI.assetNames[kind] ?? kind;
  /** 「여기에 끌어다 놓을 수 있는 것」 — 놓기 표를 거꾸로 읽는다. 없으면 빈 줄. */
  function acceptsLine(kind) {
    const names = acceptsFrom(DROPS, kind, nameOfKind);
    return names.length
      ? `<p class="zoom-hint zoom-accepts">${esc(Z.acceptsLabel)} ${names.map(esc).join(' · ')}</p>` : '';
  }
  /** 준비물 표의 「하는 일」. 두 곳에 따로 쓰면 반드시 갈린다. */
  const roleOf = (asset, name = null) =>
    UI.notebook.materials.find((m) => m.asset === asset && (!name || m.name === name))?.role ?? null;

  /* ---------------------------------------------------------------- */
  /* 물건 화면 — 누르면 본다 (docs/09 §2·§3)                             */
  /* ---------------------------------------------------------------- */

  /**
   * 물건 하나의 화면. 제목 · 어디에 있나 · 하는 일 · 그림 · 덧붙일 말 · 받는 것 · 단추 —
   * 차례는 공용 `renderItemView` 가 정한다. 여기서는 **이 실험의 사실**만 채운다.
   */
  function renderItemMode() {
    const st = store.getState();
    const id = itemId;
    const kind = kindOf(id);
    const I = Z.item;
    const v = {
      title: UI.bench.items[id] ?? UI.assetNames[kind],
      where: null, role: null, note: null, figure: '', actions: [], extra: '',
    };
    const action = (aid, label, type, payload = {}, quiet = false) =>
      v.actions.push({ id: aid, label, quiet, run: () => store.dispatch(type, payload) });

    if (kind === 'leaf') {
      // 신선한 잎과 시든 잎 중 무엇을 넣을지는 **학생이 정한다** — 이 실험의 변인 하나다.
      // 예전에는 실험대에서 잎을 누르면 말없이 바뀌었다. 이제 여기서 고른다 (`PICK_LEAF`).
      const leafKind = st.tools.leafKind;
      v.where = leafKind === 'fresh' ? I.leafFresh : I.leafWilted;
      v.role = roleOf('leaf');
      v.figure = ASSETS.leaf.render({ fresh: leafKind === 'fresh' ? 1 : 0 });
      v.extra = `
        <div class="zoom-pick ctrl-group" role="group" aria-label="${esc(I.leafPickLabel)}">
          <span>${esc(I.leafPickLabel)}</span>
          ${['fresh', 'wilted'].map((k) => `
            <button type="button" data-leaf="${k}" aria-pressed="${leafKind === k}">${esc(UI.leafKinds[k])}</button>`).join('')}
        </div>`;
    } else if (kind === 'bottle') {
      const liquid = id.replace('bottle', '');
      v.where = I.bottleHolds(UI.liquids[liquid]);
      v.role = roleOf('bottle', UI.liquidsShort[liquid]);
      v.figure = ASSETS.bottle.render({ kind: liquid, level: 0.7 });
    } else if (kind === 'paperbox') {
      v.where = I.paperboxHolds;
      v.role = roleOf('paperbox');
      v.figure = ASSETS.paperbox.render({});
      action('act-take', Z.takeOut, 'NEW_PAPER');
    } else if (kind === 'capillary') {
      const c = st.tools.capillary;
      const loaded = c.strength > 0;
      v.where = loaded ? I.capillaryLoaded : I.capillaryEmpty;
      v.role = roleOf('capillary');
      v.figure = ASSETS.capillary.render({ loaded: c.strength });
      if (loaded && c.grit > 0.2) v.note = I.capillaryGritty;
      if (loaded) action('act-rinse', I.rinse, 'RINSE_CAPILLARY', {}, true);
    } else if (kind === 'pencil') {
      v.where = I.pencilWhere;
      v.role = roleOf('pencil');
      v.figure = ASSETS.pencil.render({});
    } else if (kind === 'ruler') {
      v.where = I.rulerWhere;
      v.role = roleOf('ruler');
      v.figure = ASSETS.ruler.render({});
    } else {
      // 받는 곳 — 폐액통·개수대·쓰레기통. 「무엇을 받는지」가 몸통이다.
      v.role = roleOf(kind);
      v.figure = ASSETS[kind].render(kind === 'waste' ? { level: 0.2 } : kind === 'sink' ? { water: 0 } : { fill: 0 });
    }
    v.accepts = acceptsFrom(DROPS, kind, nameOfKind);
    v.acceptsLabel = Z.acceptsLabel;
    renderItemView(body, v);

    body.querySelectorAll('[data-leaf]').forEach((b) => {
      b.addEventListener('click', () => store.dispatch('PICK_LEAF', { kind: b.dataset.leaf }));
    });
  }

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
    const layerNote = settled ? [Z.tubeSettled, true]
      : (settling ? [Z.tubeSettle, null] : [Z.tubeUnsettled, false]);

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
      <h2>${esc(UI.bench.items.tube)}</h2>
      ${subtitle(Z.tubeMode)}
      <div class="zoom-vessel-stage">${ASSETS.tube.render({
        leaf: t.leaf, extract: t.extract, settleT: t.settleT, capped: true,
      })}</div>
      ${missing ? `${hint(missing)}${acceptsLine('tube')}` : `
        ${hint(layerNote[0], layerNote[1])}
        ${gauge}
        ${hint(Z.tubeShakeHint)}
        ${acceptsLine('tube')}
        ${act('shake', Z.tubeShake)}
        ${zoomTool === 'capillary' ? act('load', UI.protocol[3].steps[0].label) : ''}
      `}`;

    body.querySelector(`#${zid('shake')}`)?.addEventListener('click', () => {
      store.dispatch('SHAKE', { amount: 0.2 });
    });
    body.querySelector(`#${zid('load')}`)?.addEventListener('click', () => {
      store.dispatch('LOAD_CAPILLARY', {});
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
        <h2>${esc(UI.bench.items.paper)}</h2>
        ${subtitle(Z.paperMode)}
        <div class="zoom-strip">${renderStrip(params, { idPrefix: 'zoom-' })}</div>
        ${hint(Z.tornNote, false)}
        ${acceptsLine('paper')}`;
      return;
    }

    body.innerHTML = `
      <h2>${esc(UI.bench.items.paper)}</h2>
      ${subtitle(Z.paperMode)}
      <div class="zoom-strip">${renderStrip(params, { idPrefix: 'zoom-' })}</div>
      ${captureNotice ? hint(captureNotice, true) : ''}
      ${p.runT > 0 ? `
      <div class="zoom-gauge">
        <div class="bar"><div class="fill" style="width:${q.score}%"></div></div>
        <div class="cap"><span>${esc(UI.observability.label)}</span><b>${q.score}</b></div>
        <div class="hint">${esc(q.worst
          ? UI.observability.hint(UI.observability.worst[q.worst], UI.observability.fix[q.worst])
          : UI.observability.allGood)}</div>
      </div>` : hint(Z.notDeveloped)}
      ${acceptsLine('paper')}
      ${zoomTool === 'pencil' ? pencilControls(p) : ''}
      ${zoomTool === 'capillary' ? capillaryControls(st) : ''}
      ${zoomTool === null ? measureControls(p) : ''}`;

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
      ${hint(Z.originHint)}
      <div class="zoom-pick ctrl-group" role="group" aria-label="${esc(Z.markerLabel)}">
        <span>${esc(Z.markerLabel)}</span>
        ${[MARKERS.PENCIL, MARKERS.PEN].map((m) => `
          <button type="button" data-marker="${m}" aria-pressed="${marker === m}">${esc(UI.markers[m])}</button>`).join('')}
      </div>
      ${marker === MARKERS.PEN ? hint(Z.markerPenWarn, false) : ''}
      ${act('draw-origin', UI.protocol[2].steps[0].label)}
      ${act('mark-front', Z.markFrontLabel)}
      ${hint(Z.markFrontHint)}
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
      b.addEventListener('click', () => { marker = b.dataset.marker; shell.repaint(); });
    });
    body.querySelector(`#${zid('draw-origin')}`)?.addEventListener('click', () => {
      store.dispatch('DRAW_ORIGIN', { heightMm: originMm, marker });
    });
    body.querySelector(`#${zid('mark-front')}`)?.addEventListener('click', () => {
      store.dispatch('MARK_FRONT', {});
    });
    body.querySelector(`#${zid('dry-paper')}`)?.addEventListener('click', () => {
      store.dispatch('DRY_PAPER', {});
    });
    body.querySelector(`#${zid('mark-bands')}`)?.addEventListener('click', () => {
      store.dispatch('MARK_BANDS', {});
    });
  }

  function capillaryControls(st) {
    const p = st.paper;
    if (st.tools.capillary.strength <= 0) return hint(Z.capillaryEmpty, false);
    return `
      ${slider('dwell', Z.dwellLabel, Math.round(dwell * 100), {
        min: 0, max: 100, step: 5,
        readout: dwell > 0.3 ? Z.dwellLong : Z.dwellShort,
      })}
      ${dwell > 0.3 ? hint(Z.dwellWarn, false) : ''}
      ${hint(Z.spotHint)}
      ${hint(Z.spotCount(p.spots))}
      ${act('spot', Z.spotLabel)}
      ${act('dry-spot', Z.dryLabel)}`;
  }

  function bindCapillary() {
    const dwellEl = body.querySelector(`#${zid('dwell')}`);
    if (dwellEl) {
      dwellEl.addEventListener('pointerdown', () => { busy = true; });
      dwellEl.addEventListener('input', (e) => {
        dwell = Number(e.target.value) / 100;
        body.querySelector(`#${zid('dwell')}-out`).textContent = dwell > 0.3 ? Z.dwellLong : Z.dwellShort;
      });
      dwellEl.addEventListener('change', () => { busy = false; shell.repaint(); });
    }
    body.querySelector(`#${zid('spot')}`)?.addEventListener('click', () => {
      store.dispatch('SPOT', { dwell });
    });
    body.querySelector(`#${zid('dry-spot')}`)?.addEventListener('click', () => {
      store.dispatch('DRY_SPOT', {});
    });
  }

  function measureControls(p) {
    const wet = p.wetness > 0.6;
    return `
      ${wet ? hint(Z.rulerWet, false) : hint(Z.rulerHint)}
      ${act(p.rulerPlaced ? 'lift-ruler' : 'place-ruler', p.rulerPlaced ? Z.rulerLift : Z.rulerLabel)}
      ${act('capture', Z.capture)}`;
  }

  function bindMeasure() {
    body.querySelector(`#${zid('place-ruler')}`)?.addEventListener('click', () => {
      store.dispatch('MEASURE', {});
    });
    body.querySelector(`#${zid('lift-ruler')}`)?.addEventListener('click', () => {
      store.dispatch('LIFT_RULER', {});
    });
    body.querySelector(`#${zid('capture')}`)?.addEventListener('click', () => {
      const r = store.dispatch('CAPTURE', {});
      const n = r.state.session.captures.length;
      captureNotice = Z.captureSaved(n);
      shell.repaint();
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
      <h2>${esc(UI.bench.items.vial)}</h2>
      ${subtitle(Z.vialMode)}
      <div class="zoom-vessel-stage">${ASSETS.vial.render({
        depth: v.depthMm, capped: v.capped, hasPaper: v.hasPaper,
      })}</div>
      <dl class="zoom-readout">
        <div><dt>${esc(Z.depthLabel)}</dt><dd>${esc(UI.units.mm(Math.round(v.depthMm)))}</dd></div>
        <div><dt>${esc(UI.notebook.originLabel)}</dt><dd>${esc(UI.units.mm(Math.round(origin)))}</dd></div>
        <div><dt>${esc(Z.frontLabel)}</dt><dd>${esc(over ? '—' : UI.units.mm(Math.round(front)))}</dd></div>
      </dl>
      ${hint(v.depthMm >= origin ? Z.depthWarnDeep : Z.depthOk, v.depthMm < origin)}
      ${over ? hint(Z.frontOverrun, false) : hint(Z.frontHint)}
      ${hint(`${Z.capLabel} — ${v.capped ? Z.capClosed : Z.capOpen}. ${Z.capHint}`)}
      ${acceptsLine('vial')}
      ${zoomTool === 'bottle' ? `
        ${slider('pour', Z.pourAmount, pourMm, {
          min: 1, max: 10, step: 1, readout: UI.units.mm(pourMm),
        })}
        ${act('pour-go', Z.pourLabel)}` : ''}
      ${act('cap', v.capped ? Z.item.uncapBtn : Z.item.capBtn)}
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
    });
    // 뚜껑은 열고 닫는 한 쌍이다. 예전에는 실험대에서 바이알을 누르면 말없이 바뀌었다 —
    // 이제 여기 단추다. 열려 있을 때만 종이가 들어가고, 덮여 있어야 용매가 안 날아가고 빛도 안 든다.
    body.querySelector(`#${zid('cap')}`)?.addEventListener('click', () => {
      store.dispatch(v.capped ? 'UNCAP_VIAL' : 'CAP_VIAL', {});
    });
    body.querySelector(`#${zid('insert')}`)?.addEventListener('click', () => {
      store.dispatch('INSERT_PAPER', {});
    });
    body.querySelector(`#${zid('remove')}`)?.addEventListener('click', () => {
      store.dispatch('REMOVE_PAPER', {});
    });
  }

  // 전개가 진행되는 동안 화면이 따라 움직여야 한다 — 전선이 오르는 것을 보고 꺼내기 때문이다.
  // 손잡이를 쥐고 있는 동안에는 건너뛴다. 다시 그리면 그 손잡이가 사라진다.
  store.subscribe(() => { if (!busy) shell.repaint(); });

  return { open, close };
}
