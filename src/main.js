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
      if (result.outcome !== 'ok') onMessage(result.message, result.outcome);
      if (!opts.skipNotify) notify(result);
      return result;
    },
    /** skipNotify 로 조용히 쌓인 변경을 한 번에 구독자에게 알린다. renderFOV 는 부르지 않는다. */
    notify: () => notify({ outcome: 'ok', message: null, tag: null }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

const toast = createToastQueue($('#toast-region'));
const store = createStore(initialState(), (message, outcome) => toast.push(message, outcome));
window.__store = store; // scripts/check-ui.mjs 가 되돌리기 기록 검사에 쓴다.

const zoom = createZoom($('#zoom'), store);
createBench($('#bench'), store, {
  onOpenZoom: (mode, slideId, opener) => zoom.open(mode, slideId, opener),
});
createNotebook($('#notebook'), store, {
  onOpenZoom: (mode, slideId, opener) => zoom.open(mode, slideId, opener),
});

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

setInterval(() => {
  const reacting = Object.values(store.getState().slides)
    .some((s) => s.stain && s.drops > 0 && s.reactionT < 1);
  if (reacting) store.dispatch('TICK', {});
}, 1000);
