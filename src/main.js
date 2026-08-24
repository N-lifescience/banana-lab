/**
 * 앱 진입점.
 *
 * 좌측 실험대 + 우측 탐구 노트 2분할. 상태는 sim/rules.js 의 reduce() 하나로만 바뀐다 —
 * 이 파일과 src/ui/ 의 나머지는 결과를 그리기만 한다.
 */

import { initialState } from './sim/state.js';
import { reduce } from './sim/rules.js';
import { createToastQueue } from './ui/toast.js';
import { createBench } from './ui/bench.js';
import { createZoom } from './ui/zoom.js';
import { createNotebook } from './ui/notebook.js';
import { createStart } from './ui/start.js';
import { createReport } from './ui/report.js';

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
      if (result.outcome !== 'ok') onMessage(result.message, result.outcome, result.tag);
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
 * 배치 편집 모드 — `?edit=1`.
 *
 * 개발 서버에서만 연다. `window.__store` 와 같은 이유다 — 배포본에 남기면 학생이
 * 실험대를 흐트러뜨릴 수 있고, 그건 이 앱이 답해야 할 조작이 아니다.
 */
function editMode() {
  return import.meta.env.DEV && new URLSearchParams(location.search).get('edit') === '1';
}

let store = null;

/**
 * 고른 단계로 실험을 시작한다.
 *
 * 상태는 여기서 처음 만들어진다 — `session.level` 은 세션 내내 바뀌지 않는 값이라
 * 시작 화면에서 정해진 뒤에 만들어야 한다. 도중에 단계를 바꾸는 길은 두지 않는다.
 */
function boot(level) {
  $('#start').hidden = true;
  $('#app').hidden = false;

  // getLevel 은 store 를 나중에 참조한다 — 실제로 호출되는 시점(토스트가 뜰 때)에는
  // store 가 이미 만들어져 있으므로 순서상 문제 없다.
  const toast = createToastQueue($('#toast-region'), () => store.getState().session.level);
  store = createStore(
    initialState(level),
    (message, outcome, tag) => toast.push(message, outcome, tag)
  );
  // 검증 스크립트(scripts/check-*.mjs)가 상태를 만들고 되돌리기 기록을 들여다보는 통로다.
  // 개발 서버에서만 연다 — 배포본에 남기면 누구나 상태를 직접 바꿀 수 있고,
  // 그건 "강제하지 말고 결과로 답한다" 와는 다른 이야기다. 규칙을 건너뛰는 뒷문이 된다.
  if (import.meta.env.DEV) window.__store = store;

  const zoom = createZoom($('#zoom'), store);
  const openZoom = (mode, slideId, opener, tool) => zoom.open(mode, slideId, opener, tool);
  const report = createReport($('#report'), store);
  createBench($('#bench'), store, { onOpenZoom: openZoom, edit: editMode() });
  createNotebook($('#notebook'), store, { onOpenZoom: openZoom, onReport: report.open });

  startClock();
}

/* ------------------------------------------------------------------ */
/* 시간 경과 — 반응 진행도. TICK 의 기본값(seconds=1, speed=10)은        */
/* rules.js 가 이미 데모 속도로 잡아 둔 값이다.                          */
/*                                                                      */
/* reduce() 는 TICK 도 매번 "바뀐 상태"로 보고 되돌리기 기록에 쌓는다     */
/* (rules.js 는 수정 금지 대상이라 여기서 막는다). 진행 중인 반응이 없는데도 */
/* 가만히 1초마다 쏘면 아무 일도 없는 동안 되돌리기 기록만 채워진다 —      */
/* 2·3단계처럼 되돌리기 횟수가 유한할 때 특히 문제다. 그래서 실제로 색이   */
/* 오르는 중인 슬라이드가 있을 때만 보낸다.                               */
/* ------------------------------------------------------------------ */

function startClock() {
  setInterval(() => {
    const reacting = Object.values(store.getState().slides)
      .some((s) => s.stain && s.drops > 0 && s.reactionT < 1);
    if (reacting) store.dispatch('TICK', {});
  }, 1000);
}

const fromUrl = levelFromUrl();
if (fromUrl) boot(fromUrl);
else createStart($('#start'), boot);
