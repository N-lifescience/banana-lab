/**
 * 확대 뷰 — 물건을 누르면 열리는 「크게 보기」.
 *
 * ── 이 실험에는 확대 뷰가 없었다 ─────────────────────────────────
 * 눌러서 하던 조작(솜마개 빼기·만든 병 비우기·시행 기록·항온기에서 꺼내기)이 실험대 물건과
 * 상단 막대에 붙어 있었고, 시약병·항온기·솜마개·스포이트·휴지·폐액통·쓰레기통은 눌러도
 * 아무 일이 없었다 — 눌러도 아무 일 없는 물건은 고장으로 읽힌다 (docs/09-uniformity.md §2).
 *
 * 이제 **누르면 본다, 끌면 옮긴다, 단추로 한다.** 실험대에서 누르는 것만으로는 아무것도
 * 바뀌지 않고, 여기 열린 화면에 지금 상태·하는 일·그림이 나오며 할 수 있는 일은 단추다.
 *
 * 덮개·패널·닫기·Esc·포커스·스크롤은 공용 틀(`createZoomShell`)이 하고, 화면의 차례
 * (제목 → 어디에 있나 → 하는 일 → 그림 → 덧붙일 말 → 받는 것 → 단추)는 공용
 * `renderItemView` 가 정한다. 여기는 **이 실험의 사실**만 채운다.
 */

import { createZoomShell } from '../../../../packages/lab-kit/ui/zoom-shell.js';
import { renderItemView, acceptsFrom } from '../../../../packages/lab-kit/ui/item-view.js';
import { dropTable, itemById, assetState } from './bench.js';
import { UI } from './strings.js';
import { ASSETS } from '../assets/index.js';
import { renderTube, gasNow, tubeContents } from '../render/tube.js';
import { mixPct, OBSERVE_LIMIT_MIN } from '../sim/state.js';

export function createZoom(root, store) {
  const shell = createZoomShell(root, { closeLabel: UI.zoom.close });
  const { body } = shell;
  /** 놓기 표 — 「여기에 끌어다 놓을 수 있는 것」을 거꾸로 읽는다. 실행하지 않는다. */
  const DROPS = dropTable(store);

  /** 열린 물건 (실험대의 id). */
  let itemId = null;
  /** 결과를 기록한 직후 화면에 남길 확인 문구. 열 때마다 지운다. */
  let captureNotice = null;

  function close() { shell.close(); }

  /**
   * @param {'item'} mode  이 실험의 화면은 물건 화면 하나뿐이다. 다른 실험과 같은 모양의
   *   입구를 두어 `main.js` 가 여덟 실험에서 같은 줄로 잇게 한다.
   * @param {string} id  실험대 물건 id
   * @param {HTMLElement} openerEl  닫을 때 포커스를 돌려줄 물건
   */
  function open(mode, id, openerEl) {
    if (mode !== 'item') return;
    itemId = id;
    captureNotice = null;
    shell.open(renderBody, openerEl);
  }

  /** 종류 → 화면에 쓸 이름. 끄는 쪽 이름이라 짧은 것을 쓴다. 시약병 다섯은 무엇인지로 부른다. */
  const nameOfKind = (kind) => UI.zoom.item.kindNames[kind] ?? UI.assetNames[kind] ?? kind;
  /** 준비물 표의 「하는 일」. 두 곳에 따로 쓰면 반드시 갈린다. */
  const roleOf = (name) => UI.notebook.materials.find((m) => m.name === name)?.role ?? null;
  /** 시약병 종류 → 준비물 표의 이름 */
  const BOTTLE_ROW = {
    bottleGlucose: '10 % 포도당 수용액',
    bottleWater: '증류수',
    bottleMix: '만든 포도당 수용액 (빈 병)',
    bottleYeast: '효모액',
    bottleKoh: '40 % 수산화 칼륨 수용액',
  };

  /** 지금 시행이 어떻게 되고 있는가 — 실험대 막대와 같은 말을 한다. */
  function clockLine(t) {
    const C = UI.bench.clock;
    if (t.runConditions === null) return C.idle;
    if (t.elapsedMin >= OBSERVE_LIMIT_MIN) return C.done(OBSERVE_LIMIT_MIN, gasNow(t));
    return C.running(t.elapsedMin, gasNow(t));
  }
  /** 「결과 기록」이 지금 무언가를 남길 수 있는가 — `rules.js` 의 RECORD_TRIAL 과 같은 조건. */
  const recordable = (t) => t.runConditions !== null && t.elapsedMin >= OBSERVE_LIMIT_MIN;

  function renderBody() {
    const st = store.getState();
    const item = itemById(itemId);
    if (!item) { body.innerHTML = ''; return; }
    const kind = item.kind;
    const t = st.bench.tube;
    const Z = UI.zoom.item;
    const v = {
      title: UI.bench.items[item.id] ?? item.label,
      where: null, role: null, note: null, noteWhy: null, figure: '', actions: [],
    };
    const act = (aid, label, type, payload = {}, quiet = false) =>
      v.actions.push({ id: aid, label, quiet, run: () => store.dispatch(type, payload) });
    const figureOf = () => ASSETS[item.asset].render(assetState(store, item));

    if (kind === 'bottleMix') {
      const pct = mixPct(st.bench.mix);
      const total = st.bench.mix.glucoseMl + st.bench.mix.waterMl;
      v.where = pct === null ? Z.mixEmpty : Z.mixHolds(pct, total);
      v.role = roleOf(BOTTLE_ROW[kind]);
      v.figure = figureOf();
      if (pct !== null) act('act-empty-mix', Z.emptyMix, 'EMPTY_MIX', {}, true);
    } else if (kind.startsWith('bottle')) {
      v.where = Z.bottleHolds(v.title);
      v.role = roleOf(BOTTLE_ROW[kind]);
      v.figure = figureOf();
    } else if (kind === 'fermtube') {
      const parts = tubeContents(t);
      v.where = parts.length ? Z.tubeHolds(parts.join(' · ')) : Z.tubeEmpty;
      v.role = roleOf('발효관');
      // 관찰 창과 같은 그림 — 맹관부에 기체가 고이는 것이 이 실험의 결과라 크게 그린다.
      v.figure = renderTube(t, { idPrefix: 'zoom' });
      if (t.inIncubator) v.note = `${Z.tubeInIncubator(t.tempC)} ${clockLine(t)}`;
      else if (t.runConditions !== null) v.note = clockLine(t);
      else if (t.drained) v.note = Z.tubeDrained;
      else if (t.plugged) v.note = Z.tubePlugged;
      if (t.inIncubator) act('act-take-out', UI.bench.takeOut(t.tempC), 'TAKE_FROM_INCUBATOR');
      if (t.plugged) act('act-unplug', Z.unplug, 'UNPLUG_TUBE');
      if (recordable(t)) act('act-capture', UI.zoom.capture, 'RECORD_TRIAL');
      else if (t.runConditions !== null && !v.note?.includes(UI.bench.clock.idle)) {
        v.note = `${v.note ?? ''} ${Z.recordWait(OBSERVE_LIMIT_MIN)}`.trim();
      }
      if (parts.length || t.runConditions !== null) act('act-empty', Z.empty, 'EMPTY_TUBE', {}, true);
    } else if (kind === 'incubator') {
      const holds = t.inIncubator && t.tempC === item.tempC;
      v.where = Z.incubatorHolds(item.tempC);
      v.role = roleOf('항온기 (10 · 20 · 30 · 40 · 55 ℃)');
      v.figure = figureOf();
      if (holds) v.note = `${Z.incubatorHasTube} ${clockLine(t)}`;
      if (holds) act('act-take-out', UI.bench.takeOut(item.tempC), 'TAKE_FROM_INCUBATOR');
    } else if (kind === 'cotton') {
      v.where = Z.cottonHolds;
      v.role = roleOf('솜마개');
      v.figure = figureOf();
    } else if (kind === 'dropper') {
      v.where = t.drained ? Z.dropperHolds : Z.dropperEmpty;
      v.role = roleOf('스포이트');
      v.figure = figureOf();
    } else if (kind === 'waste') {
      v.role = roleOf('폐액통');
      v.figure = figureOf();
    } else if (kind === 'tissue') {
      v.role = Z.tissueRole;
      v.figure = figureOf();
    } else if (kind === 'bin') {
      v.role = Z.binRole;
      v.figure = figureOf();
    } else {
      v.figure = figureOf();
    }

    // 「결과 기록」은 몇 번째가 남았는지 말한다 — 토스트는 지나가지만 이 줄은 화면에 남는다.
    const capture = v.actions.find((a) => a.id === 'act-capture');
    if (capture) {
      capture.run = () => {
        const before = store.getState().trials.length;
        store.dispatch('RECORD_TRIAL', {});
        const after = store.getState().trials.length;
        captureNotice = after > before ? UI.zoom.captureSaved(after) : null;
        shell.repaint();
      };
    }

    v.accepts = acceptsFrom(DROPS, kind, nameOfKind);
    v.acceptsLabel = UI.zoom.acceptsLabel;
    renderItemView(body, v);
    if (captureNotice) {
      body.insertAdjacentHTML('beforeend', `<p class="capture-note" id="capture-note">${captureNotice}</p>`);
    }
  }

  // 시계가 가는 동안(TICK)에도 열린 화면이 지금을 말하게 한다. 이 화면에는 끌 것이 없어
  // 다시 그려도 손을 잃지 않는다 — 포커스는 공용 틀이 같은 id 로 되돌린다.
  store.subscribe(() => shell.repaint());

  return { open, close };
}
