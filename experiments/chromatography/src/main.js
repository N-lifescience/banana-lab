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
      // **문구가 있으면 띄운다. outcome 으로 거르지 않는다.**
      //
      // 예전에는 `outcome !== 'ok'` 였다. 그런데 rules.js 의 `ok()` 33곳 중 **28곳이
      // 문구를 들고 있다** — 잎을 넣었다·추출액을 넣었다·원점에 몇 번 찍었다 … .
      // 그 스물여덟 개가 전부 여기서 버려졌고, **잘한 조작에는 아무 말도 안 나왔다.**
      // 화면은 멀쩡히 돌고 콘솔도 조용해서 브라우저로 재기 전에는 안 보인다.
      // `toast.js` 는 처음부터 받을 준비가 돼 있었다 — 문만 닫혀 있었다.
      // (허브 세션이 banana-lab 에서 열여섯 개를 찾아 알려 줬다.)
      //
      // 말할 것이 없으면 `ok(state)` 가 `message: null` 을 주므로 조용히 지나간다.
      if (result.message) onMessage(result.message, result.outcome, result.tag);
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
 * **배포본에서도 연다.** 선생님이 배치를 잡는 자리는 개발 서버가 아니라 실제 주소이고,
 * 거기서 못 쓰면 이 모드는 있으나 마나다.
 *
 * 학생이 그 글자를 칠 일은 없고, 쳤다 해도 **편집 모드에서는 조작이 일어나지 않는다** —
 * 물건을 옮겨 놓을 뿐이고 새로고침하면 제자리로 돌아온다. 저장되는 것이 없다.
 * (`window.__store` 는 그대로 개발 서버에서만 연다. 그쪽은 규칙을 건너뛰는 뒷문이라
 *  성격이 다르다.)
 */
function editMode() {
  return new URLSearchParams(location.search).get('edit') === '1';
}

let store = null;
/** 실험이 시작된 뒤에만 있다. Ctrl+P 가 배치 편집을 껐다 켜는 손잡이. */
let bench = null;

/**
 * 고른 단계로 실험을 시작한다.
 *
 * 상태는 여기서 처음 만들어진다 — `session.level` 은 세션 내내 바뀌지 않는 값이라
 * 시작 화면에서 정해진 뒤에 만들어야 한다. 도중에 단계를 바꾸는 길은 두지 않는다.
 */
function boot(level, mode = MODES.GROUP, groupSetup = null, { practice = false, edit = editMode() } = {}) {

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
  const openZoom = (zoomMode, id, opener, tool) => zoom.open(zoomMode, id, opener, tool);
  const report = createReport($('#report'), store, { group });
  bench = createBench($('#bench'), store, { onOpenZoom: openZoom, edit });
  createNotebook($('#notebook'), store, {
    group,
    practice: feedback ? {
      feedback, host: dialogHost, appTitle: UI.appTitle,
      levelName: UI.start?.levels?.find((l) => l.id === 1)?.name ?? '',
    } : null,
    onOpenZoom: openZoom,
    onReport: () => report.open(),
    // 보고서를 낼 수 있게 된 순간은 탐구 노트 위쪽에서 조용히 일어난다.
    // 그때 학생은 대개 실험대를 보고 있다 — 알려 주지 않으면 한참 뒤에야 안다.
    // 연습 모드에는 보고서 단추가 없다 — 「만들 수 있다」고 말하면 거짓이다 (T36)
    onReady: () => { if (!feedback) toast.push(UI.notebook.reportReadyToast, 'ok', 'report-ready'); },
  });

  startClock();
}

/* ------------------------------------------------------------------ */
/* 시간 경과 — 층 분리 · 전개 · 건조. TICK 의 기본값(seconds=1, speed=10)은  */
/* rules.js 가 이미 데모 속도로 잡아 둔 값이다.                          */
/*                                                                      */
/* **화면에 시계를 띄우지 않는다.** 실제 소요 시간은 [확인 필요] 라 지어낼   */
/* 수 없고, 절차가 보라고 한 것은 시간이 아니라 용매 전선의 높이다        */
/* (src/sim/develop.js).                                                */
/*                                                                      */
/* 아무 일도 일어나지 않는 동안에는 쏘지 않는다. reduce() 는 TICK 을        */
/* 되돌리기 기록에 쌓지 않지만(TRANSIENT_ACTIONS), 가만히 1초마다 새       */
/* 상태를 만들면 화면이 쉬지 않고 다시 그려진다.                          */
/* ------------------------------------------------------------------ */

/** 지금 시간이 흐르면 무언가 달라지는가 */
function timePasses(st) {
  const t = st.tube;
  const p = st.paper;
  const settling = t.leaf > 0 && t.extract > 0 && t.shaken > 0 && t.settleT < 1;
  const developing = p.inVial && st.vial.depthMm > 0;
  const drying = !p.inVial && (p.wetness > 0 || p.spotWet > 0);
  return settling || developing || drying;
}

function startClock() {
  setInterval(() => {
    if (timePasses(store.getState())) store.dispatch('TICK', {});
  }, 1000);
}

/**
 * **Ctrl+P(맥은 Cmd+P)로 배치 편집 모드를 껐다 켠다.**
 *
 * 주소에 `?edit=1` 을 치는 것보다 손이 빠르다 — 배치를 잡는 동안 몇 번이고 껐다 켜게 된다.
 *
 * ★ **모듈 자리에 단다.** 예전에는 `createBench` 안에 있었는데, 그 함수는 `boot()` 안에서만
 *   불린다 — 그래서 **시작 화면에서는 단축키가 아예 안 달렸다.** 선생님이 실제로 여는 것은
 *   맨 주소이고, 거기서 안 먹으면 「단축키가 죽었다」로 읽힌다.
 *
 * ★ **아직 시작 전이면 시작시키고 편집 모드로 들어간다.** 이때 단계를 `1` 로 못박지 않는다 —
 *   시작 화면에서 **이미 고른 것**을 읽어서 그대로 쓴다. 못박으면 고른 것이 조용히 버려진다.
 *
 * ★ **인쇄를 뺏지 않는다.** 보고서 창이 열려 있거나 종이가 만들어져 있으면 그때의 `Ctrl+P`
 *   는 인쇄다 — 학생이 활동지를 뽑는 길이라 가로채면 실험이 거기서 끝난다.
 *   실제로 인쇄하는 화면은 거기뿐이다. 단계를 고르는 화면을 인쇄하는 사람은 없다.
 *
 *   「`#report` 에 자식이 있으면 열린 것」으로 봤다가 **한 번도 안 먹었다.** 그 칸은 창을
 *   만들어 두는 자리라 **처음부터 자식이 둘** 있다. `<dialog>` 의 `open` 과 종이에 내용이
 *   들어갔는지로 본다.
 */
function pickedOnStart() {
  const on = (sel) => $(`#start .start-level[data-${sel}][aria-checked="true"]`);
  return {
    level: Number(on('level')?.dataset.level) || 1,
    mode: on('mode')?.dataset.mode ?? MODES.GROUP,
  };
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'p' && e.key !== 'P') return;
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  if ($('#report-dialog')?.open) return;
  if ($('#report-sheet')?.childElementCount) return;
  e.preventDefault();
  if (bench) { bench.toggleEdit(); return; }
  const { level, mode } = pickedOnStart();
  boot(level, mode, { edit: true });
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
