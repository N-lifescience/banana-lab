/**
 * 앱 진입점.
 *
 * 좌측 실험대 + 우측 탐구 노트 2분할. 상태는 sim/rules.js 의 reduce() 하나로만 바뀐다 —
 * 이 파일과 src/ui/ 의 나머지는 결과를 그리기만 한다.
 */

import { initialState, MODES, settled } from './sim/state.js';
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
      // **잘된 조작도 말을 한다.**
      // 여기서 `outcome !== 'ok'` 로 걸러 내고 있었다. 그래서 rules.js 가 잘된 조작에 달아 둔
      // **문구 17개가 전부 버려졌다** — 「스포이트에 증류수를 담았습니다」 같은 것들이.
      // 화면에 남는 것이 없는 조작은 **한 것인지 아닌지 알 길이 없다.** 그런데 규칙 검사는
      // reduce() 가 문구를 돌려주는지만 보므로 초록불이고, 콘솔 에러도 안 난다.
      // toast.js 는 처음부터 이걸 받게 지어져 있었다(「'ok' 라도 말할 것이 있으면 띄운다」).
      // **규칙도 그릇도 있는데 문 하나가 닫혀 있었다.** (germination 세션이 찾아 여덟 곳 공통.)
      // 말할 것이 없으면 message 가 비어 있고 toast.push 가 알아서 아무것도 안 한다.
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
 * 배치 편집 모드 — `?edit=1`.
 *
 * **배포본에서도 열린다.** 실험대 배치를 옮기는 것은 가르치는 사람이 하는 일인데,
 * 개발 서버를 띄울 수 있는 사람만 할 수 있으면 실제로는 아무도 못 옮긴다.
 *
 * 티 나지 않게 둔다 — 화면 어디에도 이리로 가는 길이 없고, 주소에 직접 쳐야 한다.
 * 학생이 우연히 올 자리가 아니고, 와도 **편집 모드에서는 조작이 일어나지 않는다.**
 * 옮긴 자리는 결과에 아무 영향을 주지 않으며 저장되지도 않는다 (새로 고치면 되돌아온다).
 *
 * `window.__store` 는 **열지 않는다.** 그건 상태를 통째로 주무르는 훨씬 넓은 뒷문이고
 * 배치를 옮기는 데 필요하지도 않다. 편집에 필요한 `__layoutCode` 만 편집 모드 안에서 난다.
 */
function editMode() {
  return new URLSearchParams(location.search).get('edit') === '1';
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
      /*
       * 실제 실험용 양식 (T39). 주소를 아는 것은 **사이트**라 여기서 만들어 넘긴다 —
       * 부품(`practice/panel.js`)이 `/forms/` 를 알면 다른 곳에 실을 수 없게 된다.
       */
      formUrl: manifest.formFile ? `/forms/${encodeURIComponent(manifest.formFile)}` : null,
      levelName: UI.start?.levels?.find((l) => l.id === 1)?.name ?? '',
    } : null,
    onOpenZoom: openZoom,
    // 보고서를 여는 것이 곧 "실험을 마친다" 는 뜻이다. 그때 정리를 했는지 한 번 본다
    onReport: () => report.open(),
    // 보고서를 낼 수 있게 된 순간은 탐구 노트 위쪽에서 조용히 일어난다.
    // 그때 학생은 대개 실험대를 보고 있다 — 알려 주지 않으면 한참 뒤에야 안다.
    // 연습 모드에는 보고서 단추가 없다 — 「만들 수 있다」고 말하면 거짓이다 (T36)
    onReady: () => { if (!feedback) toast.push(UI.notebook.reportReadyToast, 'ok', 'report-ready'); },
  });

  startClock();
}

/* ------------------------------------------------------------------ */
/* 시간 경과 — 삼투 진행. TICK 의 기본값(seconds=1, speed=10)은          */
/* rules.js 가 이미 데모 속도로 잡아 둔 값이다.                          */
/*                                                                      */
/* 아직 평형에 닿지 않은 슬라이드가 있을 때만 보낸다.                     */
/* 가만히 1초마다 쏘면 아무 일도 없는 동안 로그만 채워지고, 무엇보다       */
/* 확대 뷰가 1초마다 통째로 다시 그려져 조작이 끊긴다.                    */
/* ------------------------------------------------------------------ */

function startClock() {
  setInterval(() => {
    const moving = Object.values(store.getState().slides)
      .some((s) => s.sample && s.medium && !settled(s));
    if (moving) store.dispatch('TICK', {});
  }, 1000);
}

/*
 * **Ctrl/⌘+P 로 배치 편집 모드를 연다.**
 *
 * 주소에 `?edit=1` 을 치는 것보다 손이 덜 간다. 사장님이 실험대 배치를 미세하게
 * 맞추실 자리라 자주 드나든다.
 *
 * ★ **인쇄를 뺏지 않는다.** 보고서 창이 열려 있으면 그대로 브라우저에 넘긴다 —
 * 학생이 활동지를 인쇄하는 것이 이 앱에서 Ctrl+P 의 본래 뜻이고, 그걸 가로채면
 * **낼 방법이 없어진다.** 창이 닫혀 있을 때만 편집 모드로 간다.
 *
 * ★ **`boot()` 안에 두면 안 된다.** 그러면 **단계를 고르기 전에는 아예 안 달려서**
 *   시작 화면에서 눌러도 아무 일이 없다 — 선생님이 실제로 여는 주소가 맨 주소다.
 *   그래서 모듈 자리에 둔다. 단계가 없으면 `level=1` 도 함께 붙인다 — 안 붙이면
 *   편집 모드로 가 놓고도 **시작 화면이 그대로 떠서** 또 「아무 일 없음」이다.
 */
window.addEventListener('keydown', (e) => {
  if (e.key !== 'p' && e.key !== 'P') return;
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  /*
   * **열려 있는가**로 본다. 「`#report` 에 자식이 있는가」로 재면 안 된다 —
   * 보고서 창의 뼈대는 시작할 때 한 번 넣어 두므로 **닫혀 있어도 자식이 둘**이다.
   * 그렇게 짰다가 Ctrl+P 가 아무 데서도 안 먹었다.
   */
  if (document.querySelector('#report-dialog')?.open) return;   // 인쇄를 뺏지 않는다
  e.preventDefault();
  const url = new URL(location.href);
  /*
   * **켜고 끈다.** 앞서는 편집 모드면 그냥 넘겼는데(「인쇄를 뺏지 않는다」), 그러면
   * **나갈 길이 주소를 손으로 고치는 것뿐**이었다 — 편집 패널에는 나가는 단추가 없다.
   * 켤 때 주소를 바꾸니 끌 때도 되돌린다. (허브가 여덟 배포본을 눌러 보고 찾았다.)
   */
  if (editMode()) {
    url.searchParams.delete('edit');
  } else {
    url.searchParams.set('edit', '1');
    if (!url.searchParams.get('level')) url.searchParams.set('level', '1');
  }
  location.href = url.toString();
});

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
