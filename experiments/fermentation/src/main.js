/**
 * 앱 진입점.
 *
 * 변인 설계 → 실험대에서 시행 → 결과 그래프 → 탐구 노트 → 보고서.
 * 상태는 `dispatch()` 하나로만 바뀐다 — 화면이 상태를 직접 대입하면
 * 되돌리기·기록·검증이 전부 무너진다.
 */

import { UI } from './ui/strings.js';
import { createGroupStore } from '../../../packages/lab-kit/group/store.js';
import { createFeedbackLog } from '../../../packages/lab-kit/practice/feedback.js';
import { manifest } from './manifest.js';
import { createStart } from '../../../packages/lab-kit/ui/start.js';
import { createDesign, designSentence } from './ui/design.js';
import { createBench, CLOCK_SPEED } from './ui/bench.js';
import { createZoom } from './ui/zoom.js';
import { createNotebook } from './ui/notebook.js';
import { createReport } from './ui/report.js';
import { createToastQueue } from './ui/toast.js';
import { isRunning, OBSERVE_LIMIT_MIN } from './sim/state.js';
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
      // **`ok` 라도 할 말이 있으면 전한다.**
      //
      // 앞서는 `outcome !== 'ok'` 로 걸렀다. 그래서 `rules.js` 가 `ok(next, '…')` 에 담아
      // 보낸 문장 열넷이 **화면에 한 번도 뜬 적이 없다.** 「10 mL 를 더했습니다. 병에 든 것은
      // 5 % 포도당 수용액입니다」·「솜마개를 뺐습니다」·「맹관부의 기체가 11.0 mL 에서
      // 0.7 mL 로 줄었습니다」 — 잘된 조작이 무엇을 바꿨는지 말해 주는 문장이 전부 그랬다.
      //
      // 바나나랩에서 **일부러** 성공한 조작을 `happened` 에서 `ok` 로 옮겼다
      // (`docs/banana-progress.md` — 「잘된 일이 경고색으로 뜨면 안 된다」). 색만 갈리는 줄
      // 알았는데, 이 줄이 그 문장들을 **경고색이 아니라 아예 없는 것**으로 만들었다.
      // `toast.js` 의 `detail()` 에 있는 `if (good) return message` 는 그동안 닿지 않는 가지였다.
      //
      // 거르는 기준은 이제 **할 말이 있는가**다. 말이 없는 `ok`(TICK·SET_INDEPENDENT 처럼
      // 조용히 지나가는 것)는 `toast.push` 가 첫 줄에서 그대로 돌려보낸다.
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
    const t = store.getState().bench.tube;
    // 관찰 시간을 다 채우면 멈춘다. 그 뒤로는 더 기다려도 달라질 것이 없고,
    // 기록할 수 있게 되는 것이 그 시점의 결과다.
    const shouldRun = isRunning(t) && t.elapsedMin < OBSERVE_LIMIT_MIN;
    if (shouldRun && !timer) {
      // 시계는 **분**으로 흐른다. 초로 두었다가 규칙 쪽 단위와 어긋나면
      // 화면의 시간과 기록된 시간이 조용히 달라진다.
      timer = setInterval(() => {
        store.dispatch('TICK', { minutes: (STEP_MS / 1000) * (CLOCK_SPEED / 60) });
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
    /*
     * 실험 리허설 (T37) — 선생님 화면이 만드는 세 번째 링크. 단계·방식과 **함께 쓰지 않는다.**
     * 연습은 `start()` 에서 1단계·혼자로 고정되므로, 같이 실어 주면 고른 값이 조용히 무시된다.
     */
    practice: q.get('practice') === '1',
    edit: q.get('edit') === '1',
  };
}

function start(level, mode, groupSetup = null, { practice = false } = {}) {

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
  // 토스트는 **막힌 이유를 말하는 유일한 통로**다. 결과로 답하는 실험이라 대부분은
  // 그림이 말하지만, 마개·손·폐액처럼 그림에 안 나타나는 것은 여기서만 전해진다.
  //
  // 난이도를 **함수로** 넘긴다. 값으로 넘기면 저장소가 만들어지기 전이라 읽을 수가 없고,
  // 그렇다고 여기서 `level` 을 그대로 넣으면 나중에 난이도가 바뀌는 길이 생겼을 때
  // 말풍선만 옛 단계에 머문다.
  let store;
  const toast = createToastQueue($('#toast-region'), () => store.getState().session.level);
  store = createStore(initialState(level, 20260826, mode),
    (message, outcome, tag) => { toast.push(message, outcome, tag); feedback?.add({ message, outcome, tag }); });

  // 시작 화면을 걷고 실험 화면을 연다.
  //
  // `#app` 은 HTML 에서 `hidden` 으로 시작한다 — 자바스크립트가 오기 전에 빈 뼈대가
  // 번쩍이지 않게 하기 위해서다. **여기서 벗기지 않으면 화면이 통째로 안 보인다.**
  // 실제로 그렇게 만들어 놓고 한참 몰랐다: 검사가 `textContent` 로 글자를 읽었는데
  // `hidden` 요소의 글자도 그대로 읽히기 때문이다. 눈으로 봐야 알 수 있는 종류다.
  $('#start').hidden = true;
  $('#app').hidden = false;
  $('#app').classList.add('shell');

  createDesign($('#design-root'), store);
  // 확대 뷰 — 물건을 누르면 열린다. 눌러서 하던 조작은 전부 그 화면의 단추다 (docs/09 §2).
  const zoom = createZoom($('#zoom'), store);
  const openZoom = (mode, id, opener) => zoom.open(mode, id, opener);
  createBench($('#bench'), store, { edit: fromQuery().edit, onOpenZoom: openZoom });
  createClock(store);
  const report = createReport($('#report'), store, { group });
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
    onReport: () => report.open(),
    // 보고서를 낼 수 있게 된 순간을 알린다 — 탭을 안 보고 있어도 알아야 한다.
    // 연습 모드에는 보고서 단추가 없다 — 「만들 수 있다」고 말하면 거짓이다 (T36)
    onReady: () => { if (!feedback) toast.push(UI.notebook.reportReadyToast, 'ok', 'report-ready'); },
  });

  // 설계 문장은 탐구 노트와 보고서도 같은 함수로 만든다 — 두 곳에서 따로 만들면
  // 학생이 적은 설계와 보고서의 설계가 달라진다.
  const paintSentence = () => { $('#design-sentence').textContent = designSentence(store.getState().design); };

  /*
   * **결과 그래프는 탐구 노트의 「결과」 쪽에만 있다.**
   *
   * 여기 노트 밖에도 같은 그래프를 그리는 판이 하나 더 있었다 (`idPrefix: 'main'`).
   * 노트가 결과 쪽을 갖기 전에 만든 것인데, 그 뒤로 **어느 탭을 열어 놓든 늘 떠 있었다** —
   * 문제 인식을 읽는 학생 눈앞에 아직 아무것도 없는 빈 그래프가 붙어 있는 셈이다.
   * (사장님 지시, 2026-09-05: 「결과 그래프가 모든 탐구노트 탭에 떠있다. 왜지?」)
   * 노트 쪽이 같은 함수로 그리므로 사본만 걷었다.
   */

  store.subscribe(paintSentence);
  paintSentence();

  // 규칙 엔진을 콘솔에서 만져 볼 수 있게 둔다 — **개발 서버에서만.**
  //
  // 배포본에 남으면 누구나 상태를 통째로 바꿀 수 있는 뒷문이 된다. 검사 스크립트가
  // 이 뒷문으로 질러가기 때문에 편한데, 그 편함이 그대로 배포본에 실려 나간다.
  // `scripts/check-build.mjs` 의 「배포본에 window.__store 가 없다」가 지킨다.
  // **`?.` 를 쓰지 않는다.** vite 는 `import.meta.env.DEV` 라는 **글자 그대로**를 찾아
  // 바꾼다 — 물음표가 끼면 못 찾고 `import.meta.env` 를 **객체째** 박아 넣는데, 그러면
  // Vercel 이 자동 노출하는 `VITE_VERCEL_*`(커밋한 사람의 실명 포함)이 번들에 실린다.
  // 지금 쓰는 vite 는 이 형태도 잘 지워 주지만, 그건 버전이 지켜 주는 것이지 우리가
  // 지키는 것이 아니다. `tests/privacy.test.js` 가 이 형태를 막는다.
  if (import.meta.env.DEV) window.__store = store;
}

const q = fromQuery();
/*
 * **배치 편집 모드(`?edit=1`)는 시작 화면을 건너뛴다.**
 *
 * 편집 모드는 실험대 위 물건의 자리를 옮겨 보는 화면이라 난이도·모둠을 고를 이유가 없다.
 * 그런데 시작 화면을 건너뛰는 조건이 `level` 과 `mode` 둘 다였던 탓에, `?edit=1` 만 붙이면
 * **시작 화면에 걸려 실험대가 아예 안 그려졌다.** 화면에는 아무 오류도 안 나고 그냥
 * 시작 화면이 떠 있어서, 「편집 모드가 배포본에서 안 된다」로 읽혔다.
 *
 * 배포본에서도 열어 둔다. 학생이 주소창에 `?edit=1` 을 칠 일은 없고, 편집 모드에서는
 * **조작이 아예 일어나지 않는다**(`bench.js` 의 `if (edit) return`). 콘솔 뒷문
 * (`window.__store`)과는 다른 이야기다 — 그쪽은 상태를 통째로 바꿀 수 있어 배포본에서 막는다.
 */
/*
 * 모둠으로 하는 링크면 모둠 짜기는 거쳐야 한다 (T35) — 모둠명·역할·별명은 링크에 못 싣는다.
 * 단계·방식 고르기는 잠근 채 그 칸만 보인다. 편집 모드는 그대로 건너뛴다.
 */
const groupLink = q.mode === MODES.GROUP && Boolean(q.level) && !q.edit;
// 리허설 링크는 묻지 않고 바로 연다 — 고를 것이 없기 때문이다 (T37).
if (q.practice && !q.edit) {
  start(1, MODES.SOLO, null, { practice: true });
} else if ((q.edit || (q.level && q.mode)) && !groupLink) {
  start(q.level ?? 1, q.mode ?? MODES.GROUP);
} else if (groupLink) {
  createStart($('#start'), start, q.level, MODES.GROUP, UI, { lock: true });
} else {
  createStart($('#start'), start, q.level ?? 1, q.mode ?? MODES.SOLO, UI);
}

/**
 * **Ctrl+P 로 배치 편집 모드를 켜고 끈다.**
 *
 * 주소에 `?edit=1` 을 치는 것보다 손이 덜 간다 — 배치를 잡을 때는 켰다 껐다를 자주 한다.
 * 주소만 바꿔 다시 여는 것이라 상태를 따로 나르지 않는다.
 *
 * **보고서가 열려 있으면 아무것도 하지 않는다.** 그 인쇄 창으로 PDF 를 만들기 때문이다 —
 * 여기서 가로채면 학생이 보고서를 못 뽑는다. 그게 이 단축키보다 훨씬 중요하다.
 */
window.addEventListener('keydown', (e) => {
  if (e.key !== 'p' && e.key !== 'P') return;
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  // 보고서(인쇄) 창이 떠 있으면 브라우저의 인쇄를 그대로 둔다.
  if (document.querySelector('#report-dialog[open]')) return;

  e.preventDefault();
  const url = new URL(location.href);
  if (url.searchParams.get('edit') === '1') url.searchParams.delete('edit');
  else url.searchParams.set('edit', '1');
  location.href = url.toString();
});
