/**
 * 앱 진입점.
 *
 * 좌측 실험대 + 우측 탐구 노트 2분할. 상태는 sim/rules.js 의 reduce() 하나로만 바뀐다 —
 * 이 파일과 src/ui/ 의 나머지는 결과를 그리기만 한다.
 */

import { initialState, MODES } from './sim/state.js';
import { reduce } from './sim/rules.js';
import { createToastQueue } from './ui/toast.js';
import { createBench } from './ui/bench.js';
import { createZoom } from './ui/zoom.js';
import { createNotebook } from './ui/notebook.js';
import { createStart } from '../../../packages/lab-kit/ui/start.js';
import { createReport } from './ui/report.js';
import { UI } from './ui/strings.js';
import { createGroupStore } from '../../../packages/lab-kit/group/store.js';
import { createFeedbackLog } from '../../../packages/lab-kit/practice/feedback.js';
import { manifest } from './manifest.js';

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
      // 그런데 `rules.js` 는 잘된 조작에도 문구를 스물넷 달아 둔다
      // (「접안 마이크로미터를 접안렌즈에 끼웠습니다」 같은 것). 그것이 전부 여기서 버려졌다.
      //
      // 화면에 남는 것이 없는 조작은 **한 것인지 아닌지 알 길이 없다.**
      // 콘솔 에러도 안 나므로 아무도 모른다 — 재어 보니 잘된 조작 일곱 건이 문구를
      // 만들었는데 화면에 뜬 것은 **0건**이었다.
      //
      // 가르는 것은 `outcome` 이 아니라 **`message` 가 있는가**다.
      // 말할 것이 없는 조작(슬라이더를 미는 것 같은)은 `rules.js` 가 문구를 안 달고,
      // 그때는 토스트가 알아서 아무것도 안 한다.
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
 * 실험 리허설 — `?practice=1` (T37).
 *
 * 선생님 화면이 만드는 **세 번째 링크**다. 단계·방식은 여기서 안 읽는다 — 연습은
 * `boot()` 에서 1단계·혼자로 고정되므로, 링크에 실려 온 값이 있어도 조용히 무시된다.
 * 실을 수 있는 척하지 않으려고 **아예 안 본다.**
 */
function practiceFromUrl() {
  return new URLSearchParams(location.search).get('practice') === '1';
}

/**
 * 배치 편집 모드 — `?edit=1`. **배포본에서도 열린다.**
 *
 * 앞서는 개발 서버에서만 열었다. 그런데 준비물 자리를 옮겨 보실 선생님이 손에 쥔 것은
 * **배포된 주소**다 — 거기서 안 열리면 그 기능은 없는 것과 같다.
 *
 * 학생이 이 글자를 칠 일은 없고, 편집 모드에서는 **조작이 일어나지 않는다**
 * (`bench.js` 의 `edit` 갈래 — 물건을 끌어 자리만 옮기고 규칙은 부르지 않는다).
 *
 * `window.__store` 는 **그대로 닫아 둔다.** 그쪽은 규칙을 통째로 건너뛰는 뒷문이라
 * 편집 모드와는 이야기가 다르다.
 */
function editMode() {
  return new URLSearchParams(location.search).get('edit') === '1';
}

/**
 * **Ctrl+P 로 편집 모드를 연다.** 선생님이 그렇게 하라고 하셨다 — 「그냥 ctrl+P 키로」.
 *
 * 주소에 `?edit=1` 을 붙이고 다시 연다. 상태는 주소가 갖고 있으므로 새로고침해도 남고,
 * 한 번 더 누르면 빠진다. 켜고 끄는 것이 같은 손짓이라 외울 것이 하나다.
 *
 * ★ **인쇄를 뺏지 않는다.** 보고서 창은 브라우저 인쇄로 PDF 를 만든다 — 거기서 Ctrl+P 를
 *   가로채면 **선생님이 활동지를 못 뽑는다.** 창이 떠 있으면 우리는 비켜서고 브라우저가
 *   원래 하던 일을 한다. (허브를 거쳐 넘어온 지적)
 */
function bindEditModeKey() {
  window.addEventListener('keydown', (e) => {
    if (!(e.key === 'p' || e.key === 'P') || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    /*
     * 보고서 창이 **떠 있을 때만** 비켜선다.
     *
     * ★ 처음에는 `#report` 에 자식이 있는가로 봤다. 그런데 그 칸에는 **닫힌 `<dialog>` 가
     *   늘 들어 있다** (자식 2개). 그래서 조건이 항상 참이 되어 **Ctrl+P 가 영영 안 먹었다.**
     *   단위 검사 220개가 전부 초록불이었고, 배포본을 손으로 눌러 보고서야 알았다.
     *   물어볼 것은 「칸이 비었는가」가 아니라 **「창이 열려 있는가」**다.
     */
    if (document.querySelector('#report dialog')?.open) return;

    e.preventDefault();
    const url = new URL(location.href);
    if (editMode()) {
      url.searchParams.delete('edit');
    } else {
      url.searchParams.set('edit', '1');
      /*
       * ★ **단계가 없으면 붙여 준다.**
       *
       * 선생님이 실제로 여는 것은 **맨 주소**다. 거기서 Ctrl+P 를 누르면 `?edit=1` 만
       * 붙고 **시작 화면이 그대로 뜬다** — 실험대가 아직 안 만들어졌으니 편집할 것이 없다.
       * 학생에게든 선생님에게든 그건 「아무 일도 안 일어남」이다. 재어 보니 그랬다:
       *     맨 주소 → Ctrl+P → 주소 ?edit=1 · 편집 패널 **0개**
       * (허브를 거쳐 넘어온 지적)
       */
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
function boot(level, mode = MODES.GROUP, groupSetup = null, { practice = false } = {}) {

  /*
   * ── 실제 실험 연습 (T36) ────────────────────────────────────────────
   * 연습이면 1단계·혼자로 고정하고, 뜻대로 안 된 조작을 `feedback` 에 모은다 —
   * 토스트로 나가는 것과 **같은 것**을 같은 자리에서 받는다. 막지 않는다. 적어 둘 뿐이다.
   */
  if (practice) { level = 1; mode = MODES.SOLO; groupSetup = null; }
  const feedback = practice
    ? createFeedbackLog({ adviceOf: (tag) => UI.toast?.nextAction?.[tag] ?? null })
    : null;

  /*
   * ── 모둠 (T35) ─────────────────────────────────────────────────────
   * `groupSetup` 은 시작 화면이 받은 모둠명·인원·역할·별명이다. 실험 store 밖에 산다 —
   * 조작이 아니고 되돌릴 것도 아니다. 혼자 하면 null 이라 모둠 부품이 하나도 안 그려진다.
   */
  const groupStore = mode === MODES.GROUP && groupSetup ? createGroupStore(groupSetup) : null;
  let dialogHost = $('#group-dialogs');
  if (!dialogHost) {
    dialogHost = document.createElement('div');
    dialogHost.id = 'group-dialogs';
    document.body.appendChild(dialogHost);
  }
  const group = groupStore ? { groupStore, host: dialogHost, exp: manifest.id } : null;
  $('#start').hidden = true;
  $('#app').hidden = false;

  // getLevel 은 store 를 나중에 참조한다 — 실제로 호출되는 시점(토스트가 뜰 때)에는
  // store 가 이미 만들어져 있으므로 순서상 문제 없다.
  const toast = createToastQueue($('#toast-region'), () => store.getState().session.level);
  store = createStore(
    initialState(level, undefined, mode),
    (message, outcome, tag) => { toast.push(message, outcome, tag); feedback?.add({ message, outcome, tag }); }
  );
  // 검증 스크립트(scripts/check-*.mjs)가 상태를 만들고 되돌리기 기록을 들여다보는 통로다.
  // 개발 서버에서만 연다 — 배포본에 남기면 누구나 상태를 직접 바꿀 수 있고,
  // 그건 "강제하지 말고 결과로 답한다" 와는 다른 이야기다. 규칙을 건너뛰는 뒷문이 된다.
  if (import.meta.env.DEV) window.__store = store;

  const zoom = createZoom($('#zoom'), store);
  const openZoom = (mode, slideId, opener, tool) => zoom.open(mode, slideId, opener, tool);
  const report = createReport($('#report'), store, { group });
  createBench($('#bench'), store, { onOpenZoom: openZoom, edit: editMode() });
  createNotebook($('#notebook'), store, {
    group,
    practice: feedback ? {
      feedback, host: dialogHost, appTitle: UI.appTitle,
      levelName: UI.start?.levels?.find((l) => l.id === 1)?.name ?? '',
    } : null,
    onOpenZoom: openZoom,
    // 보고서를 여는 것이 곧 "실험을 마친다" 는 뜻이다.
    // **정리를 했는지 보지 않는다.** 앞서는 여기서 `CHECK_TIDY` 를 돌려 자기 평가에
    // ✓/✗ 를 적었는데, 그러면 화면 속 단추를 눌렀다는 사실을 평가하게 된다.
    // 지금은 「실제 실험에서는 이런 것들을 해야 합니다」 를 가만히 적어 둘 뿐이다.
    onReport: () => report.open(),
    // 보고서를 낼 수 있게 된 순간은 탐구 노트 위쪽에서 조용히 일어난다.
    // 그때 학생은 대개 실험대를 보고 있다 — 알려 주지 않으면 한참 뒤에야 안다.
    // 연습 모드에는 보고서 단추가 없다 — 「만들 수 있다」고 말하면 거짓이다 (T36)
    onReady: () => { if (!feedback) toast.push(UI.notebook.reportReadyToast, 'ok', 'report-ready'); },
  });

}

/* ------------------------------------------------------------------ */
/* 이 실험에는 시계가 없다.                                             */
/*                                                                      */
/* 바나나랩은 1초마다 TICK 을 돌려 색 변화를 진행시켰다. 여기서는 반응이  */
/* 없으므로 시간이 상태를 바꾸지 않는다. 덤으로 바나나랩에서 TICK 이     */
/* 되돌리기 기록을 밀어내던 문제도 함께 사라졌다.                        */
/* ------------------------------------------------------------------ */

bindEditModeKey();

const fromUrl = levelFromUrl();
const modeUrl = modeFromUrl();
/*
 * 주소로 단계가 정해져 있어도 **모둠으로 하는 링크면 모둠 짜기는 거쳐야 한다** (T35) —
 * 모둠명·역할·별명은 링크에 실을 수 없는 것이다. 단계·방식 고르기는 잠근 채 그 칸만 보인다.
 */
// 리허설 링크는 묻지 않고 바로 연다 — 고를 것이 없기 때문이다 (T37).
if (practiceFromUrl()) boot(1, MODES.SOLO, null, { practice: true });
else if (fromUrl && modeUrl !== MODES.GROUP) boot(fromUrl, modeUrl ?? MODES.GROUP);
else if (fromUrl) createStart($('#start'), boot, fromUrl, MODES.GROUP, UI, { lock: true });
else createStart($('#start'), boot, 1, modeUrl ?? MODES.SOLO, UI);
