/**
 * 앱 진입점.
 *
 * 좌측 실험대 + 우측 탐구 노트 2분할. 상태는 `sim/rules.js` 의 `reduce()` 하나로만 바뀐다 —
 * 이 파일과 `src/ui/` 의 나머지는 결과를 그리기만 한다.
 *
 * T01 에서 상태 모델을 갈아 끼우면서 바나나랩 화면 코드를 `docs/banana-ui/` 로 옮겼고,
 * T04~T06 에서 하나씩 이 실험 것으로 고쳐 되돌렸다. 지금은 다 돌아와 있다.
 */

import { initialState, MODES } from './sim/state.js';
import { reduce } from './sim/rules.js';
import { createToastQueue } from './ui/toast.js';
import { createBench } from './ui/bench.js';
import { createZoom } from './ui/zoom.js';
import { createNotebook } from './ui/notebook.js';
import { createReport } from './ui/report.js';
import { createStart } from '../../../packages/lab-kit/ui/start.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);

/**
 * 아주 작은 상태 저장소.
 * `dispatch()` 는 항상 `reduce()` 를 거치고, `opts.skipNotify` 가 아니면 구독자에게 알린다.
 * 센서 깊이처럼 끄는 동안 매 프레임 값이 바뀌는 조작은 `skipNotify` 로 보낸다.
 */
function createStore(initial, onMessage) {
  let state = initial;
  const listeners = new Set();
  function notify(result) { listeners.forEach((fn) => fn(state, result)); }
  return {
    getState: () => state,
    dispatch(type, payload, opts = {}) {
      const result = reduce(state, { type, payload });
      state = result.state;
      // **뜻대로 된 조작도 말을 한다.**
      // 앞서는 `outcome !== 'ok'` 일 때만 문구를 내보냈다. 그런데 `rules.js` 는 잘된 조작에도
      // 문구를 달아 둔다 — 「왼쪽 챔버에 발아 콩을 넣었습니다. 지금까지 1숟갈입니다.」 처럼
      // **얼마나 들어갔는지**를 말하는 것이 그 문구다. 그것이 통째로 버려지고 있었다.
      // 화면에는 숟갈 수가 어디에도 안 적히므로, 학생은 두 챔버를 같은 양으로 맞췄는지
      // 확인할 길이 없었다 — 그런데 그 「같게 두기」가 이 실험에서 배우는 전부다.
      // 초록 토스트(`toast--done`)도 함께 죽어 있었다.
      // 문구가 있으면 내보낸다. 끄는 동안 매 프레임 들어오는 것들(센서 깊이·시간 진행)은
      // 원래 문구 없는 `ok(state)` 라 여기서 걸러지고, 같은 말은 toast 가 태그로 막는다.
      if (result.message) onMessage(result.message, result.outcome, result.tag);
      if (!opts.skipNotify) notify(result);
      return result;
    },
    /** skipNotify 로 조용히 쌓인 변경을 한 번에 구독자에게 알린다. */
    notify: () => notify({ outcome: 'ok', message: null, tag: null }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/**
 * 난이도는 주소로 정한다 — `?level=2`.
 *
 * 교사가 반이나 모둠에 따라 다른 링크를 나눠 주는 것이 교실에서 가장 간단하다.
 * 이 통로가 없으면 난이도 3단계가 구현돼 있어도 아무도 2·3단계에 닿지 못한다.
 */
function levelFromUrl() {
  const raw = Number(new URLSearchParams(location.search).get('level'));
  return raw === 1 || raw === 2 || raw === 3 ? raw : null;
}

/** 혼자 하는가, 모둠으로 하는가 — `?mode=solo`. 난이도와 같은 통로다. */
function modeFromUrl() {
  const raw = new URLSearchParams(location.search).get('mode');
  return raw === MODES.SOLO || raw === MODES.GROUP ? raw : null;
}

/**
 * 배치 편집 모드 — `?edit=1`.
 * 개발 서버에서만 연다. 배포본에 남기면 학생이 실험대를 흐트러뜨릴 수 있다.
 */
function editMode() {
  // **배포본에서도 열린다.** 앞서는 개발 서버에서만 열었는데, 배치를 옮기는 사람은
  // 배포된 주소에서 보고 옮긴다. 학생이 주소에 `?edit=1` 을 칠 일은 없고, 편집 모드에서는
  // **조작이 일어나지 않는다** — 물건을 끌어 자리만 옮긴다.
  // (뒷문은 그대로 닫혀 있다. `window.__store` 와 하네스는 배포본에 없다 —
  //  `scripts/check-build.mjs` 가 셋을 따로 본다.)
  return new URLSearchParams(location.search).get('edit') === '1';
}

/**
 * **Ctrl+P 로 배치 편집 모드를 켠다/끈다.**
 *
 * 주소에 `?edit=1` 을 치는 것보다 손이 덜 간다 — 배치를 옮기는 사람은 화면을 보면서
 * 켰다 껐다 한다.
 *
 * ── 인쇄를 뺏지 않는다 ────────────────────────────────────────────
 * Ctrl+P 는 원래 브라우저 인쇄다. 보고서 창은 **그 인쇄로 PDF 를 만든다** —
 * **보고서가 열려 있을 때는 손대지 않는다.** 안 그러면 활동지를 못 뽑는다.
 */
function bindEditShortcut() {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'p' && e.key !== 'P') return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    /*
     * 보고서(활동지)가 **열려 있으면** 인쇄가 우선이다.
     *
     * **「자식이 있는가」로 보면 안 된다.** `#report` 는 부팅할 때부터 `<dialog>` 를
     * 품고 있어서 그 조건은 **늘 참**이고, 그러면 Ctrl+P 가 영영 안 먹는다.
     * 실제로 그랬다 — 눌러도 주소가 그대로였다. **열려 있는가**를 봐야 한다.
     */
    if (document.querySelector('#report-dialog[open]')) return;
    e.preventDefault();
    const url = new URL(location.href);
    if (url.searchParams.get('edit') === '1') {
      url.searchParams.delete('edit');
    } else {
      url.searchParams.set('edit', '1');
      /*
       * **단계가 없으면 붙여 준다.**
       *
       * 배치를 옮기는 사람이 실제로 여는 것은 **맨 주소**다. 거기서 누르면 `?edit=1`
       * 만 붙고 **시작 화면이 그대로 떠서** 또 「아무 일도 안 일어남」이 된다.
       * 실험대가 있어야 옮길 수 있으므로 단계를 하나 정해 준다.
       */
      if (!url.searchParams.get('level')) url.searchParams.set('level', '1');
    }
    location.href = url.toString();
  });
}

let store = null;

/** 아직 안 만든 자리에 무엇이 없는지 적어 둔다. 빈 화면은 고장과 구별되지 않는다. */
/**
 * 고른 단계로 실험을 시작한다.
 *
 * 상태는 여기서 처음 만들어진다 — `session.level` 은 세션 내내 바뀌지 않는 값이라
 * 시작 화면에서 정해진 뒤에 만들어야 한다.
 */
function boot(level, mode = MODES.GROUP) {
  $('#start').hidden = true;
  $('#app').hidden = false;

  const toast = createToastQueue($('#toast-region'), () => store.getState().session.level);
  store = createStore(
    initialState(level, undefined, mode),
    (message, outcome, tag) => toast.push(message, outcome, tag)
  );
  // 검증 스크립트가 상태를 만들고 되돌리기 기록을 들여다보는 통로다.
  // 개발 서버에서만 연다 — 배포본에 남기면 규칙을 건너뛰는 뒷문이 된다.
  if (import.meta.env.DEV) window.__store = store;

  const zoom = createZoom($('#zoom'), store);
  // `mode` 는 'chamber'(id 는 L·R) 또는 'item'(실험대 물건 id). 실험대·노트가 같은 통로를 쓴다.
  const openZoom = (mode, id, from) => zoom.open(mode, id, from);
  const report = createReport($('#report'), store);
  createBench($('#bench'), store, { onOpenZoom: openZoom, edit: editMode() });
  createNotebook($('#notebook'), store, {
    onOpenZoom: openZoom,
    onReport: () => report.open(),
    // 보고서를 낼 수 있게 된 순간은 탐구 노트 위쪽에서 조용히 일어난다.
    // 그때 학생은 대개 실험대를 보고 있다 — 알려 주지 않으면 한참 뒤에야 안다.
    onReady: () => toast.push(UI.notebook.reportReadyToast, 'ok', 'report-ready'),
  });

  startClock();
}

/* ------------------------------------------------------------------ */
/* 시간 경과                                                            */
/*                                                                      */
/* 재고 있는 챔버가 있을 때만 TICK 을 보낸다. 아무 일도 없는 동안 1초마다  */
/* 쏘면 되돌리기 기록만 채워진다 — 2·3단계처럼 횟수가 유한할 때 특히      */
/* 문제다. TICK 은 TRANSIENT_ACTIONS 이기도 하지만, 없는 일에 상태를      */
/* 새로 만들 이유도 없다.                                                */
/* ------------------------------------------------------------------ */

/** 실제보다 빠르게 흐른다 — 1초에 1분. 그 사실은 화면 문구가 밝힌다. */
export const MINUTES_PER_SECOND = 1;

function startClock() {
  setInterval(() => {
    const running = Object.values(store.getState().chambers).some((c) => c.running);
    if (running) store.dispatch('TICK', { minutes: MINUTES_PER_SECOND });
  }, 1000);
}

// 시작 화면에서도 듣는다 — 배치를 옮기는 사람은 난이도를 고르기 전에도 켤 수 있어야 한다.
bindEditShortcut();

const fromUrl = levelFromUrl();
const modeUrl = modeFromUrl();
if (fromUrl) boot(fromUrl, modeUrl ?? MODES.GROUP);
else createStart($('#start'), boot, 1, modeUrl ?? MODES.GROUP, UI);
