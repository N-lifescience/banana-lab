/**
 * 앱 진입점.
 *
 * ── 지금은 껍데기다 ────────────────────────────────────────────────
 * T01 에서 상태 모델과 규칙 엔진을 이 실험 것으로 갈아 끼웠다. 화면은 카드가 나뉘어 있어
 * 아직 오지 않았다 — 변인 설계는 T04, 실험대는 T05, 탐구 노트는 T07.
 * 바나나랩의 화면 코드는 **이 저장소 안에 살아 있다** — `experiments/banana/src/`.
 * (따로 서 있던 시절에는 `docs/banana-ui/` 에 사본을 두었는데, 합치면서 지웠다.
 *  사본은 낡는다 — 지울 때 이미 report.js 가 58줄, notebook.js 가 374줄 뒤처져 있었다.)
 *
 * **껍데기인 것을 화면에 그대로 적는다.** 「준비 중」을 말하지 않고 빈 화면을 두면
 * 다음에 여는 사람이 앱이 깨진 줄 안다.
 *
 * 규칙 모형만 따로 보려면 `/harness.html` — **개발용이라 앱에서 링크하지 않는다.**
 */

import { UI } from './ui/strings.js';
import { createStart } from '../../../packages/lab-kit/ui/start.js';
import { createDesign, designSentence } from './ui/design.js';
import { createBench, CLOCK_SPEED } from './ui/bench.js';
import { createZoom } from './ui/zoom.js';
import { renderGraph, graphNotes } from './render/graph.js';
import { createNotebook } from './ui/notebook.js';
import { createReport } from './ui/report.js';
import { createToastQueue } from './ui/toast.js';
import { isRunning, OBSERVE_LIMIT_S } from './sim/state.js';
import { initialState, MODES } from './sim/state.js';
import { reduce } from './sim/rules.js';

const $ = (sel) => document.querySelector(sel);

/**
 * 아주 작은 상태 저장소.
 * `dispatch()` 는 항상 `reduce()` 를 거친다 — 화면이 상태를 직접 대입하면
 * 되돌리기·기록·검증이 전부 무너진다.
 */
export function createStore(initial, onMessage = () => {}) {
  let state = initial;
  const listeners = new Set();
  return {
    getState: () => state,
    dispatch(type, payload) {
      const result = reduce(state, { type, payload });
      state = result.state;
      /**
       * **할 말이 있으면 한다.** 잘된 조작도 마찬가지다.
       *
       * 앞서는 `result.outcome !== 'ok'` 였다. 그래서 `rules.js` 가 **잘된 조작에 달아 둔
       * 문구 서른 개가 하나도 화면에 안 나왔다** — 「비커에 3 % 과산화수소수를 부었습니다」,
       * 「원반을 감자즙에 담갔습니다 (농도 100 %)」 같은 것들이다.
       *
       * 그것이 실수라는 증거는 `toast.js` 안에 있었다. 거기 `detail()` 에는
       * **잘된 경우의 갈래가 이미 있고**, 「뜻대로 됐을 때 무엇이 바뀌었는지는 힌트가 아니라
       * 조작의 확인이라, 단계와 무관하게 그대로 보여 준다」고 적혀 있다.
       * 받을 준비는 다 돼 있는데 **보내는 쪽이 버리고 있었다.**
       *
       * 이 실험에서는 더 아팠다. 원반이 떠오른 순간의 문구
       * 「원반이 떠올랐습니다. 8.3 초 걸렸습니다」가 **이 실험의 결과 그 자체**인데,
       * 그것도 같이 버려지고 있었다. 화면에는 `#clock` 에 글자로 나오지만 그 자리는
       * 그냥 `<span>` 이라 **읽어 주는 기기에는 아무 말도 안 갔다.**
       * 토스트 자리는 `aria-live="polite"` 라 거기로 나가면 읽힌다.
       *
       * `message` 가 있는지로 가른다. 아무 일도 안 한 조작과 시계 틱은 문구가 없어서
       * 저절로 조용하다 — 틱마다 토스트가 뜨면 1초에 다섯 번 뜬다.
       */
      if (result.message) onMessage(result.message, result.outcome, result.tag);
      listeners.forEach((fn) => fn(state, result));
      return result;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/**
 * 실험 시계.
 *
 * ── 왜 `src/sim/` 이 아니라 여기 있나 ─────────────────────────────
 * 시간이 흐르는 것은 **바깥에서 밀어 넣는 일**이다. `setInterval` 은 부수효과이고,
 * 규칙 파일에 들어가면 `node --test` 로 규칙을 검증할 수 없게 된다 (AGENTS.md §3.4).
 * 여기서는 일정한 간격으로 `TICK` 을 던지기만 하고, 무슨 일이 일어날지는 규칙이 정한다.
 *
 * 원반이 들어 있고 아직 안 떴을 때만 돈다. 늘 돌게 두면 아무것도 안 하는 화면에서도
 * 1초마다 상태가 새로 만들어져 실험대가 계속 다시 그려진다.
 */
function createClock(store) {
  const STEP_MS = 200;
  let timer = 0;
  function stop() { clearInterval(timer); timer = 0; }
  function sync() {
    const b = store.getState().bench.beaker;
    // 관찰 시간을 넘기면 멈춘다. 넘긴 뒤로는 더 기다려도 달라질 것이 없고,
    // 「뜨지 않음」으로 기록할 수 있게 되는 것이 그 시점의 결과다.
    const shouldRun = isRunning(b) && b.elapsedS < OBSERVE_LIMIT_S;
    if (shouldRun && !timer) {
      timer = setInterval(() => {
        store.dispatch('TICK', { seconds: (STEP_MS / 1000) * CLOCK_SPEED });
        sync();
      }, STEP_MS);
    } else if (!shouldRun && timer) {
      stop();
    }
  }
  store.subscribe(sync);
  sync();
  return { stop };
}


/** 주소로 난이도·방식을 정하는 길은 그대로 둔다 — 교사가 반마다 링크를 나눠 준다. */
function fromQuery() {
  const q = new URLSearchParams(location.search);
  const level = Number(q.get('level'));
  const mode = q.get('mode');
  return {
    level: [1, 2, 3].includes(level) ? level : null,
    mode: Object.values(MODES).includes(mode) ? mode : null,
  };
}

function start(level, mode) {
  // 토스트는 **막힌 이유를 말하는 유일한 통로**다. 결과로 답하는 실험이라 대부분은
  // 그림이 말하지만, 마개·손·폐액처럼 그림에 안 나타나는 것은 여기서만 전해진다.
  //
  // 난이도를 **함수로** 넘긴다. 값으로 넘기면 저장소가 만들어지기 전이라 읽을 수가 없고,
  // 그렇다고 여기서 `level` 을 그대로 넣으면 나중에 난이도가 바뀌는 길이 생겼을 때
  // 말풍선만 옛 단계에 머문다.
  let store;
  const toast = createToastQueue($('#toast-region'), () => store.getState().session.level);
  store = createStore(initialState(level, 20260826, mode),
    (message, outcome, tag) => toast.push(message, outcome, tag));

  // 시작 화면을 걷고 실험 화면을 연다.
  //
  // `#app` 은 HTML 에서 `hidden` 으로 시작한다 — 자바스크립트가 오기 전에 빈 뼈대가
  // 번쩍이지 않게 하기 위해서다. **여기서 벗기지 않으면 화면이 통째로 안 보인다.**
  // 실제로 그렇게 만들어 놓고 한참 몰랐다: 검사가 `textContent` 로 글자를 읽었는데
  // `hidden` 요소의 글자도 그대로 읽히기 때문이다. 눈으로 봐야 알 수 있는 종류다.
  $('#start').hidden = true;
  $('#app').hidden = false;
  $('#graph-title').textContent = UI.graph.title;

  createDesign($('#design-root'), store);
  // 확대 뷰 — 물건을 누르면 열린다. 눌러서 하던 조작은 전부 그 화면의 단추다 (docs/09 §2).
  const zoom = createZoom($('#zoom'), store);
  const openZoom = (mode, id, opener) => zoom.open(mode, id, opener);
  createBench($('#bench'), store, { edit: isEditMode(), onOpenZoom: openZoom });
  redrawBench = () => createBench($('#bench'), store, { edit: isEditMode(), onOpenZoom: openZoom });

  createClock(store);
  const report = createReport($('#report'), store);
  createNotebook($('#notebook'), store, {
    onReport: () => report.open(),
    // 보고서를 낼 수 있게 된 순간을 알린다 — 탭을 안 보고 있어도 알아야 한다.
    onReady: () => toast.push(UI.notebook.reportReadyToast, 'ok', 'report-ready'),
  });

  // 설계 문장은 탐구 노트와 보고서도 같은 함수로 만든다 — 두 곳에서 따로 만들면
  // 학생이 적은 설계와 보고서의 설계가 달라진다.
  const paintSentence = () => { $('#design-sentence').textContent = designSentence(store.getState().design); };

  /**
   * 결과 그래프. **실험대가 막지 않은 것이 여기서 대답한다.**
   * 그래프만으로는 왜 점이 떨어져 나왔는지 알 수 없으므로 설명을 함께 붙인다.
   */
  function paintGraph() {
    const st = store.getState();
    $('#graph').innerHTML = renderGraph(st.trials, st.design, { idPrefix: 'main' });
    $('#graph-notes').innerHTML = graphNotes(st.trials, st.design)
      .map((line) => `<li>${line}</li>`).join('');
  }

  store.subscribe(() => { paintSentence(); paintGraph(); });
  paintSentence();
  paintGraph();

  // 규칙 엔진을 콘솔에서 만져 볼 수 있게 둔다 — **개발 서버에서만.**
  //
  // 배포본에 남으면 누구나 상태를 통째로 바꿀 수 있는 뒷문이 된다. 검사 스크립트가
  // 이 뒷문으로 질러가기 때문에 편한데, 그 편함이 그대로 배포본에 실려 나간다.
  // `scripts/check-build.mjs` 의 「배포본에 window.__store 가 없다」가 지킨다.
  // **`?.` 를 쓰지 않는다.** Vite 는 `import.meta.env.DEV` 라는 글자 그대로를 찾는다.
  // 물음표가 끼면 그 형태를 못 찾고 앞의 `import.meta.env` 를 통째로 바꿔,
  // 환경 변수 전부(선생님 실명이 든 커밋 정보 포함)가 번들에 박힌다.
  if (import.meta.env.DEV) window.__store = store;
}

/**
 * **Ctrl+P 로 배치 편집 모드를 켜고 끈다.**
 *
 * 선생님이 「그냥 ctrl+P 키로 할 수 있게」라고 하셨다 (2026-08-29).
 *
 * ★ **모듈 자리에 단다.** 처음에 `start()` 안에 뒀더니 **단계를 고르기 전에는 아예 안 달렸다** —
 * 그런데 선생님이 실제로 여시는 것은 **맨 주소**다. 「코드 복사」가 터지고 있던 것과
 * 같은 얼굴이다: **편집 모드를 안 열면 안 드러나는 자리.**
 * 시작 화면에서 눌렀으면 단계가 없으므로 `level=1` 을 붙여 실험대까지 열어 준다.
 *
 * ★ **보고서가 열려 있으면 비켜 준다** — 그때 Ctrl+P 는 브라우저 인쇄이고,
 * 학생과 선생님은 그 인쇄로 PDF 를 만든다. 가로채면 종이를 못 뽑는다.
 * 「`#report` 에 자식이 있는가」로 보면 안 된다 — 그 자리는 처음부터 모달 뼈대를 담고 있어
 * **늘 참**이고, 그러면 Ctrl+P 가 영영 안 먹는다. `<dialog>` 가 열려 있는지를 본다.
 */
const isEditMode = () => new URLSearchParams(location.search).get('edit') === '1';
let redrawBench = null;

window.addEventListener('keydown', (e) => {
  if (!(e.key === 'p' || e.key === 'P') || !(e.ctrlKey || e.metaKey) || e.altKey) return;
  if ($('#report-dialog')?.open) return;
  e.preventDefault();
  const url = new URL(location.href);
  if (isEditMode()) url.searchParams.delete('edit');
  else url.searchParams.set('edit', '1');

  if (redrawBench) {
    history.replaceState(null, '', url);
    redrawBench();
    return;
  }
  /*
   * 아직 실험대가 없다(시작 화면). 그 주소로 열어 준다.
   *
   * **단계와 활동 방식을 둘 다 채워야 한다.** 하나만 채우면 시작 화면이 그대로 남아
   * 주소만 바뀐 채 아무 일도 안 일어난다 — 처음에 `level` 만 넣고 그렇게 만들어 놨었다.
   * 여는 쪽(맨 아래 `q.level && q.mode`)이 둘을 다 본다.
   */
  if (!url.searchParams.get('level')) url.searchParams.set('level', '1');
  if (!url.searchParams.get('mode')) url.searchParams.set('mode', MODES.GROUP);
  location.href = url.toString();
});

const q = fromQuery();
/**
 * **`?edit=1` 하나로 배치 편집이 열려야 한다.**
 *
 * 여는 조건이 `level && mode` 둘 다였다. 그래서 `?edit=1` 만, 또는 `?edit=1&level=1` 로
 * 열면 **시작 화면에 그대로 머물렀다** — 실험대에 못 들어가니 `edit=1` 이 닿을 곳이 없다.
 * 주소만 바뀐 채 아무 일도 안 일어나므로 **고장인지 내가 잘못 친 것인지도 알 수 없다.**
 *
 * `CLAUDE.md` 와 `PLAYTEST §8` 이 「`?edit=1` 을 붙여 여세요」라고 적어 두었고,
 * 여덟 랩이 같은 손짓이어야 한다는 것이 선생님 지시다 (2026-08-29).
 * Ctrl+P 쪽은 이미 둘을 채워 넣고 있었는데(그때 같은 것에 물렸다) 주소 쪽만 안 고쳐 뒀다.
 *
 * 편집 모드는 **교사만 쓰는 길**이고 거기서는 조작이 일어나지 않으므로,
 * 빠진 값을 채워 여는 것이 학생 쪽에 영향을 주지 않는다.
 */
const editWanted = isEditMode();
if ((q.level && q.mode) || editWanted) {
  start(q.level ?? 1, q.mode ?? MODES.GROUP);
} else {
  createStart($('#start'), start, q.level ?? 1, q.mode ?? MODES.GROUP, UI);
}
