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
import { createStart } from './ui/start.js';
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
      // 그런데 `rules.js` 는 잘된 조작에도 문구를 **열여섯 개** 달아 둔다
      // (「스포이트에 아이오딘 용액을 담았습니다」 같은 것). 그것이 전부 여기서 버려졌다.
      //
      // 화면에 남는 것이 없는 조작은 **한 것인지 아닌지 알 길이 없다.**
      // 콘솔 에러도 안 나므로 아무도 모른다 — `docs/banana-progress.md` 의 T25 는
      // 「토스트가 말을 하게 했다」 고 적어 두었는데 그 문이 열려 있지 않았다.
      // (germination 세션이 자기 저장소에서 먼저 찾아 넘겨 주었다)
      //
      // `message` 가 없으면 토스트가 알아서 아무것도 안 한다.
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
 * ── 배포본에서도 연다 ─────────────────────────────────────────────
 * 예전에는 개발 서버에서만 열었다. 그런데 실험대 배치를 정하는 사람은 **교실에서 쓰는
 * 선생님**이고, 그 사람 손에 있는 것은 배포된 주소다. 개발 서버에서만 열리면
 * 이 기능은 있으나 마나다.
 *
 * 학생이 흐트러뜨릴 걱정은 하지 않는다 — 주소에 `?edit=1` 을 손으로 붙여야 하고,
 * 편집 모드에서는 **조작이 일어나지 않으며**, 옮긴 자리는 저장되지 않는다.
 * 새로고침하면 원래 배치로 돌아온다. 여기서 나오는 것은 `defaultItems()` 에 붙여 넣을
 * **좌표 한 벌**이지 앱의 상태가 아니다.
 *
 * `window.__store` 는 그대로 개발 서버에만 둔다 — 그쪽은 상태를 진짜로 바꿀 수 있다.
 */
function editMode() {
  return new URLSearchParams(location.search).get('edit') === '1';
}

/**
 * **Ctrl+P (⌘P) 로 배치 편집 모드를 켜고 끈다.**
 *
 * 주소에 `?edit=1` 을 손으로 치는 것도 그대로 되지만, 폰에서는 주소창을 열어 글자를 치는
 * 것이 번거롭다. 누르면 주소에 붙였다 떼고 다시 그린다 — **주소가 남으므로 새로고침해도,
 * 남에게 보내도 같은 화면**이다.
 *
 * ── 인쇄를 뺏지 않는다 ────────────────────────────────────────────
 * Ctrl+P 는 원래 브라우저 인쇄다. 보고서 창은 그 인쇄로 PDF 를 만든다 —
 * **보고서가 열려 있을 때는 손대지 않는다.** 안 그러면 활동지를 못 뽑는다.
 */
function bindEditShortcut() {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'p' && e.key !== 'P') return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    /*
     * 보고서(활동지)가 **열려 있을 때만** 인쇄가 우선이다.
     *
     * 앞서는 `#report` 의 자식 수를 봤는데, `createReport()` 가 **열기 전부터** 대화상자
     * 마크업을 넣어 두므로 그 값은 **늘 2** 다 — 가드가 **항상** 걸려서 이 단축키가
     * **한 번도 안 먹었다.** 검사로는 안 보인다. 눌러 봐야 안다.
     * (웨이브 3 의 centrifuge 세션이 자기 저장소에서 잡았고, 여기도 똑같았다)
     *
     * 물어야 할 것은 「마크업이 있는가」가 아니라 **「지금 보고서 흐름에 있는가」**다.
     */
    if (document.querySelector('#report dialog[open]')) return;
    e.preventDefault();
    const url = new URL(location.href);
    if (url.searchParams.get('edit') === '1') url.searchParams.delete('edit');
    else url.searchParams.set('edit', '1');
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
  const openZoom = (mode, slideId, opener, tool) => zoom.open(mode, slideId, opener, tool);
  const report = createReport($('#report'), store);
  createBench($('#bench'), store, { onOpenZoom: openZoom, edit: editMode() });
  bindEditShortcut();
  createNotebook($('#notebook'), store, {
    onOpenZoom: openZoom,
    // 보고서를 여는 것이 곧 "실험을 마친다" 는 뜻이다. 그때 정리를 했는지 한 번 본다
    onReport: () => report.open({ classCode: classCodeFromUrl() }),
    // 보고서를 낼 수 있게 된 순간은 탐구 노트 위쪽에서 조용히 일어난다.
    // 그때 학생은 대개 실험대를 보고 있다 — 알려 주지 않으면 한참 뒤에야 안다.
    onReady: () => toast.push(UI.notebook.reportReadyToast, 'ok', 'report-ready'),
  });

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
const modeUrl = modeFromUrl();
if (fromUrl) boot(fromUrl, modeUrl ?? MODES.GROUP);
else createStart($('#start'), boot, 1, modeUrl ?? MODES.GROUP);
