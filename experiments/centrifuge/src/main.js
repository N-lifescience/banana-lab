/**
 * 앱 진입점.
 *
 * 좌측 실험대 + 우측 탐구 노트 2분할. 상태는 sim/rules.js 의 reduce() 하나로만 바뀐다 —
 * 이 파일과 src/ui/ 의 나머지는 결과를 그리기만 한다.
 */

import { initialState, MODES } from './sim/state.js';
import { SIM_PER_SECOND } from './sim/spin.js';
import { reduce } from './sim/rules.js';
import { createToastQueue } from './ui/toast.js';
import { createBench } from './ui/bench.js';
import { createZoom } from './ui/zoom.js';
import { createNotebook } from './ui/notebook.js';
import { createStart } from '../../../packages/lab-kit/ui/start.js';
import { createReport } from './ui/report.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);

/**
 * 아주 작은 상태 저장소.
 * dispatch() 는 항상 reduce() 를 거치고, opts.skipNotify 가 아니면 구독자에게 알린다.
 * 재물대 이동·초점·조리개처럼 드래그 중 매 프레임 값이 바뀌는 조작은 skipNotify 로 보내
 * (zoom.js 가 필요한 속성만 직접 갱신한다) renderFOV 를 다시 부르지 않게 한다.
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
      // **잘된 조작도 말한다.** 앞서는 `outcome !== 'ok'` 일 때만 내보냈다.
      // 그런데 `rules.js` 는 잘된 조작에도 문구를 달아 둔다 —
      // 「소독솜으로 손끝을 닦았습니다」 「손끝에 선홍색 핏방울이 맺혔습니다」
      // 「모세관에 자를 댔습니다. 바깥쪽 끝에서 적혈구층 경계까지 …」. 전부 버려지고 있었다.
      //
      // 이 실험에서 가장 아팠던 자리가 **자**다. 눈금은 실험대가 아니라 모세관 **그림** 안에
      // 그려지므로, 확대 뷰를 열기 전에는 눈에 보이는 변화도 없다 — 화면이 말까지 안 하면
      // **한 것인지 아닌지 알 길이 없다.** PLAYTEST 를 따라 하다 실제로 그렇게 막혔다.
      //
      // 규칙 검사는 `reduce()` 가 문구를 **돌려주는지**만 보므로 초록불이었고 콘솔 에러도
      // 안 났다. 브라우저를 열어야만 보이는 자리였다.
      // (germination 세션이 먼저 찾고, banana-lab 이 큐까지 함께 손봐 두었다)
      //
      // `message` 가 없으면 토스트가 알아서 아무것도 안 한다 — 조건이 필요 없다.
      onMessage(result.message, result.outcome, result.tag);
      if (!opts.skipNotify) notify(result);
      return result;
    },
    /** skipNotify 로 조용히 쌓인 변경을 한 번에 구독자에게 알린다. renderFOV 는 부르지 않는다. */
    notify: () => notify({ outcome: 'ok', message: null, tag: null }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/**
 * 난이도는 주소로 정한다 — `?level=2`. 없으면 1단계다.
 *
 * 교사가 반이나 모둠에 따라 다른 링크를 나눠 주는 것이 교실에서 가장 간단하다.
 * 화면에 선택기를 두면 학생이 어려운 단계를 슬쩍 낮출 수 있고, 그건 이 앱이 볼 일이 아니다.
 * 이 통로가 없으면 `docs/06` 의 난이도 3단계가 구현돼 있어도 아무도 2·3단계에 닿지 못한다.
 */
/**
 * 선생님이 나눠 준 수업 코드. `?code=482013` 또는 QR 로 들어온다.
 *
 * 상태(store)에 넣지 않는다. 실험의 일부가 아니라 **보고서를 낼 곳**일 뿐이고,
 * 상태에 넣으면 되돌리기 기록에 쌓이고 화면 곳곳으로 흘러 다닌다.
 */
function classCodeFromUrl() {
  const raw = new URLSearchParams(location.search).get('code') ?? '';
  return raw.replace(/\D/g, '').slice(0, 6);
}

function levelFromUrl() {
  const raw = Number(new URLSearchParams(location.search).get('level'));
  return raw === 1 || raw === 2 || raw === 3 ? raw : null;
}

/**
 * 혼자 하는가, 모둠으로 하는가 — `?mode=solo`.
 * 난이도와 같은 통로다. 교사가 반마다 다른 링크를 나눠 주는 길을 여기에도 둔다.
 */
function modeFromUrl() {
  const raw = new URLSearchParams(location.search).get('mode');
  return raw === MODES.SOLO || raw === MODES.GROUP ? raw : null;
}

/**
 * 배치 편집 모드 — `?edit=1`.
 *
 * 개발 서버에서만 연다. `window.__store` 와 같은 이유다 — 배포본에 남기면 학생이
 * 실험대를 흐트러뜨릴 수 있고, 그건 이 앱이 답해야 할 조작이 아니다.
 */
function editMode() {
  // **배포본에서도 열린다.** 선생님이 배치를 옮기는 곳은 개발 서버가 아니라 실제 주소다.
  // 학생이 이 글자를 칠 일은 없고, 편집 모드에서는 **조작이 일어나지 않는다** —
  // 물건을 끌어 옮겨도 소독·채혈이 되지 않고, 말풍선에 놓을 곳 단추도 나오지 않는다
  // (`src/ui/bench.js` 의 `edit`). 옮긴 자리는 저장되지 않으므로 학생 화면에 남지도 않는다.
  return new URLSearchParams(location.search).get('edit') === '1';
}

/**
 * **Ctrl+P (⌘P) 로 배치 편집 모드를 켜고 끈다.**
 *
 * 주소에 `?edit=1` 을 손으로 치는 것도 그대로 되지만, **폰에서는 주소창을 열어 글자를
 * 치는 것이 번거롭다.** 배치를 잡는 자리가 폰이라 그 번거로움이 그대로 걸림돌이 된다.
 * 누르면 주소에 붙였다 떼고 다시 그린다 — 주소가 남으므로 새로고침해도, 남에게 보내도
 * 같은 화면이다.
 *
 * ── 인쇄를 뺏지 않는다 ────────────────────────────────────────────
 * Ctrl+P 는 원래 브라우저 인쇄다. **보고서 창은 그 인쇄로 활동지 PDF 를 만든다.**
 * 보고서가 열려 있을 때 가로채면 학생이 활동지를 못 뽑는다 — 그건 이 단축키가
 * 편해지자고 뺏을 만한 것이 아니다. 열려 있으면 손대지 않고 넘긴다.
 */
function bindEditShortcut() {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'p' && e.key !== 'P') return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    /*
     * **「#report 에 자식이 있는가」로 보면 안 된다.** `createReport` 가 열리기 전부터
     * 대화상자 마크업을 넣어 두므로 그 값은 **늘 2**다 — 그렇게 두었더니 Ctrl+P 가
     * 한 번도 안 먹었다. 기능이 죽은 채로 나갈 뻔했고, 검사로는 안 보였다.
     * 브라우저에서 눌러 보고 알았다.
     *
     * 물어야 할 것은 **「지금 보고서 흐름에 있는가」** 다 —
     * 대화상자가 열려 있거나(`dialog[open]`), 활동지가 이미 그려져 있으면 인쇄가 우선이다.
     */
    if (document.querySelector('#report dialog[open]')) return;
    if (document.querySelector('#report-sheet')?.childElementCount) return;
    e.preventDefault();
    const url = new URL(location.href);
    if (url.searchParams.get('edit') === '1') url.searchParams.delete('edit');
    else {
      url.searchParams.set('edit', '1');
      // **시작 화면에서 눌렀으면 단계도 정해 준다.** 편집 모드는 실험대를 봐야 뜻이 있는데
      // 단계가 없으면 시작 화면이 그대로 뜬다 — 누르고도 아무 일이 없는 것으로 보인다.
      if (!url.searchParams.get('level')) url.searchParams.set('level', '1');
    }
    location.href = url.toString();
  });
}

let store = null;

/**
 * 고른 단계로 실험을 시작한다.
 *
 * 상태는 여기서 처음 만들어진다 — `session.level` 은 세션 내내 바뀌지 않는 값이라
 * 시작 화면에서 정해진 뒤에 만들어야 한다. 도중에 단계를 바꾸는 길은 두지 않는다.
 */
function boot(level, mode = MODES.GROUP) {
  $('#start').hidden = true;
  $('#app').hidden = false;

  // getLevel 은 store 를 나중에 참조한다 — 실제로 호출되는 시점(토스트가 뜰 때)에는
  // store 가 이미 만들어져 있으므로 순서상 문제 없다.
  const toast = createToastQueue($('#toast-region'), () => store.getState().session.level);
  store = createStore(
    initialState(level, undefined, mode),
    (message, outcome, tag) => toast.push(message, outcome, tag)
  );
  // 검증 스크립트(scripts/check-*.mjs)가 상태를 만들고 되돌리기 기록을 들여다보는 통로다.
  // 개발 서버에서만 연다 — 배포본에 남기면 누구나 상태를 직접 바꿀 수 있고,
  // 그건 "강제하지 말고 결과로 답한다" 와는 다른 이야기다. 규칙을 건너뛰는 뒷문이 된다.
  if (import.meta.env.DEV) window.__store = store;

  const zoom = createZoom($('#zoom'), store);
  const openZoom = (mode, opener) => zoom.open(mode, opener);
  const report = createReport($('#report'), store);
  createBench($('#bench'), store, { onOpenZoom: openZoom, edit: editMode() });
  createNotebook($('#notebook'), store, {
    onOpenZoom: openZoom,
    // 보고서를 연다. **정리를 했는지 보지 않는다** — 안전 수칙은 2쪽에 적어 두기만 하고
    // 앱이 확인하지 않는다. 앞서는 여기서 CHECK_TIDY 를 쏘았는데, 그 액션을 걷어내면서
    // 이 줄을 안 지웠더니 reduce 가 「알 수 없는 액션」으로 던져 **보고서 창이 아예 안 열렸다.**
    onReport: () => report.open({ classCode: classCodeFromUrl() }),
    // 보고서를 낼 수 있게 된 순간은 탐구 노트 위쪽에서 조용히 일어난다.
    // 그때 학생은 대개 실험대를 보고 있다 — 알려 주지 않으면 한참 뒤에야 안다.
    onReady: () => toast.push(UI.notebook.reportReadyToast, 'ok', 'report-ready'),
  });

  startClock(zoom);
}

/* ------------------------------------------------------------------ */
/* 시간 경과                                                            */
/*                                                                      */
/* **화면에 시계를 띄우지 않는다.** 실제 회전 시간은 [확인 필요] 라       */
/* 지어낼 수 없고, 절차가 보라고 한 것은 시간이 아니라 층이다             */
/* (AGENTS.md §2.4). 여기서 흐르는 것은 시뮬레이션 단위일 뿐이다.        */
/* ------------------------------------------------------------------ */

/** 회전은 60 분의 1 초 단위로 봐야 박자가 손에 잡힌다. */
const TICK_MS = 60;
/** 화면 전체를 다시 그리는 주기. 매 틱마다 그리면 실험대가 통째로 새로 만들어진다. */
const NOTIFY_EVERY = 5;

function startClock(zoom) {
  let last = performance.now();
  let n = 0;
  setInterval(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    const st = store.getState();
    // **아무 일도 안 일어나는 동안에는 쏘지 않는다.** 가만히 있는데 TICK 이 계속 들어오면
    // 되돌리기 기록이 채워지고(rules.js 가 TRANSIENT 로 걸러 주긴 하지만), 화면도 쉬지 않는다.
    const spinning = st.rotor.speed > 0 || Boolean(st.rotor.slots.A || st.rotor.slots.B);
    const aging = st.finger.drop > 0 || (st.tube.fill > 0 && st.tube.kind === 'plain');
    if (!spinning && !aging) return;

    n += 1;
    // 확대 뷰가 열려 있으면 그쪽이 자기 화면만 칠한다 — 통째로 다시 그리면
    // 끌고 있던 링이 새 요소로 바뀌어 손짓이 끊긴다.
    const quiet = zoom.isOpen() || n % NOTIFY_EVERY !== 0;
    store.dispatch('TICK', { seconds: dt, speed: SIM_PER_SECOND }, { skipNotify: quiet });
    if (zoom.isOpen()) zoom.paint();
  }, TICK_MS);
}

/*
 * **단계를 고르기 전에도 달아 둔다.**
 *
 * 앞서 `boot()` 안에서 불렀더니 **시작 화면에서는 아예 안 달렸다** — 눌러도 아무 일이
 * 없고, 화면은 멀쩡해 보인다. 선생님이 폰에서 앱을 열자마자 누르는 자리가 바로 거기다.
 * (허브가 정본에서 같은 것을 찾았고, 여기도 같았다)
 */
bindEditShortcut();

const fromUrl = levelFromUrl();
const modeUrl = modeFromUrl();
if (fromUrl) boot(fromUrl, modeUrl ?? MODES.GROUP);
else createStart($('#start'), boot, 1, modeUrl ?? MODES.GROUP, UI);
