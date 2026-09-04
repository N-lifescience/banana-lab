/**
 * 탐구 노트 — 7단계 패널.
 *
 * docs/06-lab-notebook.md 의 7단계(문제 인식~자기 평가)를 최상위 탭으로, T04 까지 탭으로
 * 쓰던 6개 조작 절차(바나나 준비~현미경 관찰)는 4단계 「탐구 과정」 안의 STEP 으로 내린다.
 * strings.js 의 UI.protocol 이 이미 그 6개 STEP 의 제목/세부 단계 텍스트를 갖고 있으므로
 * 그대로 재사용하고, 세부 단계 id(1a, 1b, 2a…)는 배열 순서에서 글자를 붙여 만든다.
 *
 * 결과를 바꾸는 조작은 전부 store.dispatch('SAVE_NOTE', …) 를 거쳐 reduce() 로 간다 — 이 파일은
 * session.notes 를 직접 대입하지 않는다.
 */

import { MODES, stripParams, measurableFrontMm } from '../sim/state.js';
import { ASSETS } from '../assets/index.js';
import { renderStrip, visibleBands } from '../render/strip.js';
import { observability } from '../sim/quality.js';
import { gradeQuestion, gradeRf } from './grading.js';
import { PIGMENTS, bandMm, ORIGIN_MM } from '../sim/develop.js';
import { UI } from './strings.js';
import { stepDone, groupDone, resultsDone } from '../sim/progress.js';


const N = UI.notebook;

/**
 * 질문 ⓐ 를 어느 STEP 밑에 붙이는가 — **꺼내기(6)**. 갈라진 띠를 처음 보는 자리다.
 * `docs/06` 의 「질문 ⓐ 의 배치」와 `UI.notebook.qaNotYet` 이 이 번호를 말한다.
 * `tests/playtest-review.test.js` 가 셋이 같은 번호인지 본다.
 */
export const QUESTION_A_AFTER = '6';

/**
 * 기록의 「뚜껑」 칸 — 엽록소가 이만큼 남았으면 「덮음」이다. 세우고 나서 뚜껑을 덮기까지의
 * 몇 초는 실제 절차에도 있어, 빛 노출 0 을 요구하면 절차를 지킨 학생도 「열려 있었음」이 된다.
 * `report.js` 의 종이도 같은 값을 쓴다 (순환 참조를 피하려고 여기 둔다).
 */
export const CAPPED_KEPT = 0.9;

/** 흐림 판정 기준 점수. observability().score 가 이보다 낮으면 성찰 문항이 붙는다. */
// ponytail: 임계값 추정치. docs/06 에 정확한 수치가 없다 — 체감상 어긋나면 이 숫자만 바꾸면 된다.
const LOW_OBSERVABILITY = 60;

/**
 * 화면에 넣기 전에 막는다.
 *
 * **따옴표까지 막는다.** 학생이 쓴 글이 본문에만 들어가는 게 아니라 속성 안에도 들어가기 때문이다
 * (5단계 배율 칸의 `value="…"`). `&<>` 만 막으면 큰따옴표 하나로 속성을 빠져나가
 * 새 속성을 붙일 수 있다. 자기 화면에만 영향을 주는 자리이지만, 그 글은 보고서로 인쇄되고
 * 남에게 건네진다. 막는 값이 셋에서 다섯으로 느는 것뿐이라 굳이 자리를 가리지 않는다.
 */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * 관찰 기록 칸에 흐리게 띄울 예시 문구.
 *
 * "관찰 기록" 이라고만 써 두면 무엇을 어떻게 적어야 할지 감이 안 온다.
 * placeholder 라 칸을 누르는 순간 사라지고, 학생이 쓴 글과 섞이지 않는다 — 브라우저가 하는 일이다.
 *
 * **1단계는 세부 단계마다 다른 예시를 띄운다.** 스무 칸에 같은 문장을 띄우면
 * 무엇을 적으라는 건지 알려 주지 못하고, 그 자리에서 관찰한 것이 아니라 앞 칸을 베끼게 만든다.
 * 2단계는 무엇을 적을지만 알려 주는 한 줄, 3단계는 비운다 —
 * 무엇을 적을지 스스로 정하는 것도 이 실험의 일부다.
 */
function notePlaceholder(level, step) {
  if (level === 1) return step?.eg ?? '';
  return UI.notebook.notePlaceholders[level] ?? '';
}

/**
 * STEP 하나하나가 **접혀 있어야 하는가 펼쳐져 있어야 하는가.**
 *
 * 「지금 할 STEP」은 **아직 마치지 않은 첫 STEP** 이다 — 상태에서 나오므로
 * 따로 저장하지 않는다. 저장하면 되돌리기와 어긋나 화면이 상태보다 뒤처진다.
 *
 * ── 「마쳤다」는 실험대에서 **했고**, 관찰 기록을 **적은** 것이다 ────────────────
 * 앞서는 실험대에서 한 것(`groupsDone`)만 봤다. 그러면 잎을 넣고 추출액을 붓고 흔든
 * 학생이 노트로 돌아왔을 때 STEP 1·2 는 이미 ✓ 로 **접혀 있고** STEP 3 이 펼쳐져 있다 —
 * 「방금 했습니다. 무엇을 보았는지 적어 보세요」는 한 번도 안 뜬다. 관찰 기록칸은 그렇게
 * 끝까지 비고, 보고서에는 「적지 않았습니다」가 열네 줄 찍힌다. 플레이해 보니 그랬다.
 * 이 쪽이 하려는 일은 **하고 나서 적게 하는 것**이다 (`stepLeadIn`). 그러니 적기 전에는
 * 접지 않는다. `groupsFinished` 가 그 판정이고, 없으면 예전처럼 `groupsDone` 을 쓴다.
 *
 * **학생이 손으로 여닫은 것이 있으면 그것이 이긴다.** 앞으로 올 STEP 을 펼쳐 놓고
 * 실험대에서 손을 대는 길을 막지 않기 위해서다 — **접힘은 잠금이 아니다**
 * (AGENTS.md §2.1). `disabled` 도 `pointer-events:none` 도 쓰지 않는다.
 *
 * @param {boolean[]} groupsDone      실험대에서 했는가 (✓ 표시)
 * @param {Map<string,boolean>} manualOpen  손으로 여닫은 기록 (STEP id → 열림)
 * @param {boolean[]} [groupsFinished] 했고 적었는가 (접을지 정한다)
 */
export function stepPanelStates(groups, groupsDone, manualOpen = new Map(), groupsFinished = groupsDone) {
  const nowIdx = groupsFinished.findIndex((d) => !d);   // 다 끝났으면 -1
  return groups.map((group, gi) => {
    const isDone = groupsDone[gi];
    const isNow = gi === nowIdx;
    return {
      state: isNow ? 'now' : (isDone ? 'done' : 'later'),
      open: manualOpen.has(group.id) ? manualOpen.get(group.id) : isNow,
    };
  });
}

/** STEP(UI.protocol 의 한 원소) 안에서 i번째 세부 단계의 저장 키. '3b' 같은 형태. */

function substepId(group, i) {
  return `${group.id}${String.fromCharCode(97 + i)}`;
}

/**
 * 절차 기록 키인가. `'3b'`, `'12'` 처럼 **그룹 id + 선택적 세부 단계 글자**다.
 *
 * 예전에는 `/^[1-6][a-z]?$/` 로 박혀 있었다. 바나나랩 절차가 여섯 그룹이라 맞아떨어졌지만,
 * **그것은 이 실험의 사정이지 엔진의 사정이 아니다.** 일곱 번째 그룹을 둔 실험은
 * 그 그룹의 관찰 기록이 6단계 복습과 보고서에서 **조용히 사라진다** — 화면에 빈칸이
 * 뜨는 것이 아니라 줄 자체가 안 나오므로 아무도 모른다.
 * (micrometer 파일럿에서 잡혔다. PROGRESS T28)
 *
 * 이제 개수를 세지 않고 `UI.protocol` 에 그 id 가 실제로 있는지로 본다.
 */
export function isStepNoteKey(key) {
  const m = /^(\d+)([a-z])?$/.exec(String(key));
  return Boolean(m) && UI.protocol.some((g) => g.id === m[1]);
}

/** notes 키 '3b' 를 "STEP 3 · 색 변화 관찰" 같은 사람이 읽는 문장으로. */
export function stepNoteLabel(key) {
  const m = /^(\d+)([a-z])?$/.exec(String(key));
  if (!m) return key;
  const group = UI.protocol.find((g) => g.id === m[1]);
  if (!group) return key;
  const title = m[2] ? group.steps[m[2].charCodeAt(0) - 97]?.label : group.title;
  return `STEP ${group.id} · ${title ?? group.title}`;
}

/**
 * 실제로 **무엇이 보였는가**.
 *
 * 예상과 **견주는** 자리다. 그래서 색소 이름만 돌려주지 않는다 — 학생이 "카로틴이 가장
 * 높이" 라고 예상했는데 결과가 "카로틴" 이면 맞았는지 알 수 없다. 종이의 어디에 무엇이
 * 있었는지를 말해야 견줄 수 있다.
 *
 * 보고서(`report.js`)도 같은 문장을 쓴다 — 화면과 종이가 다른 말을 하면 안 된다.
 */
export function actualSummary(st) {
  const cap = st.session.captures[st.session.captures.length - 1];
  // 제출 꾸러미에는 실험대의 살아 있는 상태가 들어 있지 않다 (report.js 의 payloadOf).
  // 기록이 하나라도 있으면 그것으로 그리고, 없으면 **지어내지 않는다.**
  const p = cap ?? (st.paper ? stripParams(st) : null);
  if (!p) return N.actualNotCaptured;
  const bands = visibleBands(p);

  let seen;
  if (bands.filter((b) => !b.ink).length === 0) seen = N.actualNoBands;
  else if ((p.load ?? 0) < 0.3) seen = N.actualFaint;
  else if ((p.spotMm ?? 2) > 7) seen = N.actualMerged;
  else seen = N.actualOrder;

  if (!cap) return `${seen} ${N.actualNotCaptured}`;
  return `${seen} (${UI.observability.label} ${observability(cap).score})`;
}

/** 모둠으로 하는 세션인가. 혼자라면 토의·모둠 비교 문항을 아예 내지 않는다. */
export function isGroup(st) {
  return (st.session.mode ?? MODES.GROUP) === MODES.GROUP;
}

/**
 * 보고서를 낼 수 있는가, 아직 무엇이 남았는가.
 *
 * 「보고서 만들기」 를 늘 띄워 두면 첫 화면에서부터 눌러 빈 종이를 뽑는다. 그 종이를 낸
 * 학생은 자기가 무엇을 안 했는지 **종이를 보고서야** 안다.
 * 막는 것이 목적이 아니므로, 감추는 자리에 **무엇이 남았는지**를 대신 적는다.
 *
 * 5~7 단계는 결과가 있어야 채울 수 있어서 여기에 넣고, 1·2 단계(문제 인식·준비물)는
 * 읽기만 하는 쪽이라 넣지 않는다 — 그쪽은 실험대 자물쇠가 이미 챙긴다 (`src/ui/bench.js`).
 *
 * @returns {{ready: boolean, missing: string[]}}
 */
/** 칸이 채워졌는가. 공백만 있는 것은 안 채운 것이다. */
const hasNote = (st, key) => String(st.session.notes[key] ?? '').trim().length > 0;

/*
 * 쪽마다 "다 했는가". 탭의 ✓ 와 보고서 단추가 **같은 함수**를 본다.
 * 따로 세면 언젠가 어긋나고, 그때 학생은 탭이 전부 ✓ 인데 보고서가 안 나오는 화면을 본다.
 */
const predictDone = (st) => hasNote(st, 'predict');
const wrapupDone = (st) =>
  ['q.a', 'q2', ...(isGroup(st) ? ['q3'] : [])].every((k) => hasNote(st, k));
const selfEvalDone = (st) => N.selfEvalItems.every(({ key }) => hasNote(st, `selfeval.${key}`));

/**
 * 탐구 노트의 한 쪽이 끝났는가 — 탭에 ✓ 를 붙일지 정한다.
 *
 * 1~4 쪽은 **읽었는가**로 본다(실험대를 여는 조건이 그것이다).
 * 5~7 쪽은 **채워졌는가**로 본다. 같은 ✓ 를 쓰지만 뜻은 하나다 — "이 쪽은 할 일을 마쳤다".
 */
export function stageDone(st, id) {
  if (UI.bench.lock.required.includes(id)) return (st.session.readStages ?? []).includes(id);
  if (id === '5') return resultsDone(st);
  if (id === '6') return wrapupDone(st);
  if (id === '7') return selfEvalDone(st);
  return false;
}

/**
 * 실험대가 아직 잠겨 있는가.
 *
 * 자물쇠의 주인은 `UI.bench.lock.required` 하나다 — 여기에 쪽 번호를 다시 적으면
 * 나중에 그 목록이 바뀔 때 **노트만 옛말을 한다.**
 */
export function benchLocked(st) {
  const read = st.session.readStages ?? [];
  return UI.bench.lock.required.some((id) => !read.includes(id));
}

export function reportReadiness(st) {
  const missing = [];
  if (!predictDone(st)) missing.push(N.reportTodo.predict);
  // (가)(나)(다)를 한 번씩은 봐야 한다. 이 실험이 하려는 일이 그것이다.
  // 금이 가서 못 본 슬라이드가 있어도 받침 유리 통에서 새로 만들 수 있다.
  if (!resultsDone(st)) missing.push(N.reportTodo.captures);
  if (!wrapupDone(st)) missing.push(N.reportTodo.wrapup);
  if (!selfEvalDone(st)) missing.push(N.reportTodo.selfEval);
  return { ready: missing.length === 0, missing };
}

export function createNotebook(root, store, { onOpenZoom, onReport, onReady }) {
  root.innerHTML = `
    <div class="note-head">
      <h1>${N.heading}</h1>
      <div id="report-slot" class="report-slot"></div>
    </div>
    <div id="note-tabs" class="note-tabs" role="tablist"></div>
    <div id="note-panel" class="note-panel"></div>`;

  const reportSlot = root.querySelector('#report-slot');

  /**
   * 보고서 단추는 **다 마무리했을 때** 나온다. 그 전에는 남은 것을 적어 둔다.
   *
   * 단추를 회색으로 죽여 두지 않는다 — 눌리지 않는 단추는 왜 안 눌리는지 말해 주지 못한다.
   * 그 자리에 남은 것을 적은 목록을 대신 그린다.
   */
  // 방금 열렸는가. 학생이 다른 쪽을 보고 있을 수도 있으니 탭의 변화만으로는 부족하다.
  let wasReady = false;

  function renderReportSlot(st) {
    const { ready, missing } = reportReadiness(st);
    if (ready && !wasReady) onReady?.();
    wasReady = ready;
    if (ready) {
      reportSlot.innerHTML = `<button type="button" id="make-report">${UI.report.button}</button>`;
      // 보고서는 탐구 노트가 내놓는 것이라 여기 둔다. 여는 일만 넘기고, 만드는 일은 report.js 가 한다.
      reportSlot.querySelector('#make-report').addEventListener('click', () => onReport?.());
      return;
    }
    reportSlot.innerHTML = `
      <details class="report-todo">
        <summary>${N.reportLockedHint} (${missing.length})</summary>
        <ul>${missing.map((m) => `<li>${m}</li>`).join('')}</ul>
      </details>`;
  }

  const tabsEl = root.querySelector('#note-tabs');
  const panelEl = root.querySelector('#note-panel');
  let activeStage = N.stages[0].id;
  /**
   * STEP 을 **손으로** 여닫은 기록 (id → 열림). `innerHTML` 로 다시 그려도 그대로 남는다.
   * 상태(store)에 넣지 않는다 — 화면을 어떻게 보고 있는지는 실험의 일부가 아니고,
   * 넣으면 되돌리기 기록에 쌓인다.
   */
  const manualOpen = new Map();
  /**
   * 한 번이라도 펼쳐졌던 STEP. **되돌아가 읽는 것까지 막지는 않는다** —
   * 관문은 「아직 안 본 앞엣것으로 건너뛰지 마라」이지 「지나온 것을 다시 보지 마라」가 아니다.
   */
  const everOpened = new Set();

  for (const stage of N.stages) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'note-tab';
    tab.textContent = `${stage.id}. ${stage.title}`;
    tab.setAttribute('role', 'tab');
    tab.dataset.stage = stage.id;
    tab.addEventListener('click', () => { activeStage = stage.id; render(); });
    tabsEl.appendChild(tab);
  }
  /*
   * STEP 을 손으로 여닫은 것을 기억한다.
   *
   * ★ **`toggle` 이 아니라 `summary` 의 `click` 을 듣는다.**
   *   `<details open>` 을 `innerHTML` 로 꽂으면 브라우저가 **삽입만으로** `toggle` 을 한 번
   *   쏜다. `toggle` 을 들으면 「지금 할 차례라서 펼쳐진 것」이 「학생이 손으로 연 것」으로
   *   기록되고, 그 STEP 은 끝난 뒤에도 **영영 안 접힌다** — 그러면 한 번에 하나만 펼친다는
   *   것이 무너진다. (허브 세션이 micrometer-lab 에서 먼저 밟았다.)
   *
   *   `click` 은 사람이 누를 때만 온다. 누르는 **그 순간**에는 아직 안 바뀌었으므로
   *   `!open` 이 앞으로 될 값이다.
   *
   * 위임으로 단다 — 4단계를 다시 그릴 때마다 새 `<details>` 가 만들어지기 때문이다.
   */
  panelEl.addEventListener('click', (e) => {
    const summary = e.target.closest?.('.step-summary');
    if (!summary) return;
    const details = summary.parentElement;
    // 막힌 STEP 은 열리지 않는다. `<details>` 는 summary 를 누르면 저절로 열리므로
    // 여기서 기본 동작을 막는다. 이유는 이미 그 아래 한 줄로 적혀 있다.
    if (lockedNow(details?.dataset?.stepGroup)) { e.preventDefault(); return; }
    const id = details?.dataset?.stepGroup;
    if (id) {
      manualOpen.set(id, !details.open);
      if (!details.open) everOpened.add(id);   // 지금 열리는 중이다
    }
  });

  // 되돌리기 버튼은 실험대(`bench.js`) 에 있다. 되돌리는 대상이 조작이지 글이 아니기 때문이다.

  /* ---------------------------------------------------------------- */
  /* 1 문제 인식 · 2 준비물                                             */
  /* ---------------------------------------------------------------- */

  function renderStage1() {
    return `<p class="stage-text">${N.problem}</p>`;
  }

  /**
   * 2 준비물 — 이름만 늘어놓으면 실험대에서 그것을 못 찾는다.
   * **그림 · 이름 · 하는 일** 셋을 나란히 둔다. 그림은 실험대에 놓인 것과 같은 애셋이라
   * 노트에서 본 것을 실험대에서 그대로 알아본다.
   */
  /**
   * 안전 안내. **준비물 쪽에 둔다** — 무엇을 쓰는지 보는 자리에서 무엇을 조심할지 함께 읽는다.
   *
   * 예전에는 자기 평가(7쪽)에 있었다. 그런데 그 쪽은 **실험이 끝난 뒤** 여는 곳이라,
   * 조심할 것을 다 끝내고 나서 읽게 된다. 준비물은 시작 전에 보는 쪽이다.
   *
   * **여기서 아무것도 판정하지 않는다.** ✓/✗ 도, 색으로 하는 잘잘못도 없다.
   * 종이(보고서)도 **같은 배열**을 싣는다 — 화면과 종이가 다른 말을 하면 안 된다.
   */
  function safetyNote() {
    const items = N.safetyItems.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
    return `
      <section class="safety-note" id="safety-note">
        <h3>${escapeHtml(N.valuesLabel)}</h3>
        <p class="values-lead">${escapeHtml(N.safetyLead)}</p>
        <ul class="values-list safety-list">${items}</ul>
        <p class="safety-not-checked">${escapeHtml(N.safetyNotChecked)}</p>
      </section>`;
  }

  function renderStage2() {
    const rows = N.materials.map(({ asset, name, role, state = {} }) => `
      <tr>
        <td class="mat-fig">${ASSETS[asset].render(state)}</td>
        <th scope="row">${name}</th>
        <td>${role}</td>
      </tr>`).join('');
    return `
      <h3>${N.materialsHeading}</h3>
      <table class="materials-table">
        <thead><tr><th>${N.matHeadFigure}</th><th>${N.matHeadName}</th><th>${N.matHeadRole}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${safetyNote()}`;
  }

  /* ---------------------------------------------------------------- */
  /* 3 예상 — 채점하지 않는다. 6단계에서 실제 결과와 나란히 보여 줄 뿐이다. */
  /* ---------------------------------------------------------------- */

  /**
   * 예상은 난이도에 따라 **묻는 방식**이 달라진다.
   *
   *   1단계 선택형    — 보기에서 고른다. 무엇을 예상해야 하는지 자체를 배우는 자리다.
   *   2단계 반주관식  — 보기에서 고르고, 왜 그렇게 생각했는지 한 줄 덧붙인다.
   *   3단계 완전 주관식 — 빈칸만 있다.
   *
   * 어느 쪽이든 답은 `notes['predict.X']` 한 곳에 **글로** 남는다.
   * 6단계에서 실제 결과와 나란히 놓고 견주기 때문에, 보기를 골랐어도 문장으로 남아야 한다.
   * 채점하지 않는다 — 예상은 맞히는 것이 아니라 세워 보는 것이다.
   */
  function renderStage3(st) {
    const level = st.session.level;
    // 무엇을 할지 모르는 채로 색소 하나를 고르라고 하면 뜬금없다.
    // 할 일은 밝히고, 무엇이 보일지는 밝히지 않는다 — 그게 지금 묻고 있는 것이다.
    const lead = `<div class="predict-lead">${
      N.predictLeadIn.map((p) => `<p>${emph(p)}</p>`).join('')
    }</div>`;
    // 이 실험은 거름종이가 한 장이라 예상 칸도 하나다.
    const val = st.session.notes.predict ?? '';
    const choices = level >= 3 ? '' : `
      <div class="predict-choices" role="group" aria-label="${N.predictLabel}">
        ${N.predictOptions.map((opt) => `
          <button type="button" class="predict-opt${val === opt ? ' predict-opt--chosen' : ''}"
            data-choice="predict" data-value="${escapeHtml(opt)}"
            aria-pressed="${val === opt}">${opt}</button>`).join('')}
      </div>`;
    const freeKey = level === 2 ? 'predict.why' : 'predict';
    const free = level === 1 ? '' : `
      <label class="notes-label" for="note-predict">${
        level === 2 ? N.predictWhyLabel : N.predictLabel
      }</label>
      <textarea data-note="${freeKey}" id="note-predict"
        placeholder="${level === 2 ? N.predictWhyPlaceholder : N.predictFreePlaceholder}"
        >${escapeHtml(st.session.notes[freeKey] ?? '')}</textarea>`;
    return `${lead}
      <div class="predict-block">
        <h3>${N.predictLabel}</h3>
        ${choices}
        ${free}
      </div>`;
  }

  /** `**굵게**` 만 허용한다. 문구에 강조를 넣으려고 HTML 을 통째로 열어 두지 않는다. */
  function emph(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  /* ---------------------------------------------------------------- */
  /* 4 탐구 과정 — STEP 1~6. 난이도별로 절차 제시만 달리한다 (docs/06 표). */
  /* ---------------------------------------------------------------- */

  /**
   * 어디까지 열 수 있는가 — **그리는 쪽과 누르는 쪽이 같은 함수를 본다.**
   *
   * 둘로 두면 언젠가 어긋나고, 그때는 **화면에는 열린 것으로 보이는데 눌러도 안 열리는**
   * (또는 그 반대의) 자리가 생긴다. 사람이 고칠 수 없는 종류의 어긋남이다.
   */
  /**
   * **아직 저장 안 된 칸까지 본다.**
   *
   * 저장은 `change` — 즉 **칸을 떠날 때** 일어난다. 그래서 마지막 칸을 다 적어 놓고도
   * 손을 거기 둔 동안에는 상태가 비어 있고, 화면은 **「아직 안 적었다」고 말한다.**
   * 학생은 할 일을 다 했는데 잠긴 화면을 본다 — 눌러 보면 넘어가지만, 그 전에 이미
   * 「안 되네」를 겪는다. 그래서 관문을 잴 때는 **화면에 적혀 있는 것**도 함께 센다.
   * (fermentation 세션이 찾고 허브가 전해 줬다.)
   */
  function liveNotes() {
    const extra = {};
    for (const t of panelEl.querySelectorAll('textarea[data-note]')) {
      if (String(t.value ?? '').trim()) extra[t.dataset.note] = t.value;
    }
    return extra;
  }

  const noteAt = (st, extra, key) => String(extra[key] ?? st.session.notes[key] ?? '').trim();

  /** 그 STEP 의 관찰 기록을 다 적었는가. 3단계는 STEP 에 한 칸, 그 밖에는 세부 단계마다. */
  function groupWritten(st, g, extra = {}) {
    return st.session.level >= 3
      ? Boolean(noteAt(st, extra, g.id))
      : g.steps.every((_, i) => Boolean(noteAt(st, extra, substepId(g, i))));
  }

  /** 실험대에서 했고 기록도 적었다 — 그래야 접는다 (`stepPanelStates` 머리말). */
  const groupFinished = (st, g, extra = {}) => groupDone(st, g.id) && groupWritten(st, g, extra);

  function openableUpToNow(st, extra = {}) {
    const groups = UI.protocol;
    const nowIdx = groups.findIndex((g) => !groupFinished(st, g, extra));
    if (nowIdx < 0) return groups.length;
    const filled = groupWritten(st, groups[nowIdx], extra);
    return filled ? nowIdx + 1 : nowIdx;
  }

  /**
   * 지금 이 STEP 이 막혀 있는가. **화면 표시(`data-locked`)를 읽지 않는다** —
   * 그것은 마지막으로 그린 값이라, 기록을 적자마자 누르면 낡은 값이 그 누름을 삼킨다.
   */
  function lockedNow(id) {
    if (!id) return false;
    const st = store.getState();
    const groups = UI.protocol;
    const gi = groups.findIndex((g) => g.id === id);
    if (gi < 0) return false;
    if (groupDone(st, id) || everOpened.has(id)) return false;
    return gi > openableUpToNow(st, liveNotes());
  }

  /**
   * **관문 표시만 제자리에서 고친다.**
   *
   * 글자 하나마다 판을 다시 그리면 커서가 튀고, 누르는 동안 미뤄 두는 것과도 부딪힌다.
   * 그래서 다시 그리지 않고 **잠금과 까닭 글자만** 바꾼다.
   */
  function refreshGates() {
    const st = store.getState();
    const extra = liveNotes();

    const btn = panelEl.querySelector('#mark-read');
    if (btn) {
      const blocked = activeStage === '3' && !noteAt(st, extra, 'predict');
      btn.setAttribute('aria-disabled', String(blocked));
      const why = panelEl.querySelector('.read-why');
      if (why) why.hidden = !blocked;
    }

    const groups = UI.protocol;
    const upTo = openableUpToNow(st, extra);
    for (const [gi, g] of groups.entries()) {
      const el = panelEl.querySelector(`.note-step[data-step-group="${g.id}"]`);
      if (!el) continue;
      const locked = gi > upTo && !groupDone(st, g.id) && !everOpened.has(g.id);
      if (el.dataset.locked === String(locked)) continue;
      el.dataset.locked = String(locked);
      el.querySelector('.step-summary')?.setAttribute('aria-disabled', String(locked));
      const hint = el.querySelector('.step-open-hint');
      if (hint) hint.textContent = locked ? N.stepLockedHint : N.stepPeekHint;
      el.classList.toggle('note-step--locked', locked);
      const why = el.querySelector('.step-locked-why');
      if (why) why.hidden = !locked;
    }
  }

  /**
   * 4단계 — **한 번에 한 STEP 만 펼친다.**
   *
   * 예전에는 STEP 일곱이 한꺼번에 펼쳐져 있었다. 그러면 학생이 이 쪽을 「읽을 글」로
   * 받는다 — 주욱 읽고 내려간 다음 실험대로 가서 무엇부터 할지 몰라 멈춘다.
   * 지금 할 것 하나만 펼치면 노트가 글이 아니라 **따라가는 길**이 된다.
   *
   * **앞으로 올 STEP 을 지우지 않는다.** 접혀 있을 뿐 눌러서 열리고, 열어서 미리 볼 수도
   * 실험대에서 먼저 해 볼 수도 있다. 손으로 여닫은 것은 기억해서 그것이 이긴다.
   */
  function renderStage4(st) {
    const level = st.session.level;
    const groups = UI.protocol;
    const groupsDone = groups.map((g) => groupDone(st, g.id));
    // 접을지는 **했고 적었는가**로 정한다. ✓ 는 실험대에서 했는가다.
    const groupsFinished = groups.map((g) => groupFinished(st, g));
    const nowIdx = groupsFinished.findIndex((d) => !d);
    const doneCount = groupsDone.filter(Boolean).length;
    const panels = stepPanelStates(groups, groupsDone, manualOpen, groupsFinished);

    /*
     * **관찰 기록을 안 적으면 다음 STEP 이 안 열린다.**
     *
     * 실험대 조작은 여전히 아무것도 막지 않는다 (AGENTS.md §2.1) — 여기서 막는 것은
     * **노트를 읽는 순서**다. 한 일을 적고 넘어가야 나중에 무엇을 보고 그렇게 판단했는지
     * 남는다. 적지 않고 끝까지 열어 두면 노트가 실험이 끝난 뒤 한꺼번에 쓰는 글이 된다.
     *
     * 막지 **않는** 것 셋: 끝낸 STEP · 지금 STEP · **한 번이라도 열어 본 STEP.**
     * 마지막 것이 있어야 되돌아가 읽는 길이 열려 있다.
     */
    /*
     * **한 칸씩만 열린다.**
     *
     * 예전에는 「지금 STEP 의 기록이 차면 뒤엣것이 **전부**」 열렸다. STEP 1 을 적었더니
     * 2부터 7까지 한꺼번에 열려서, 한 번에 하나씩 따라가라고 만든 아코디언이 그 순간
     * 그냥 펼쳐진 목록이 됐다. **선생님이 「왜 나머지 step 들까지 다 열려」라고 하신 자리다.**
     *
     * 이제 **지금 것 다음 하나까지만** 연다:
     *   지금 STEP 의 기록이 비어 있으면  → 지금 것까지
     *   다 적었으면                    → 지금 것과 그 다음 하나까지
     */
    const openableUpTo = openableUpToNow(st);

    const stepsHtml = groups.map((group, gi) => {
      const isDone = groupsDone[gi];
      const isNow = gi === nowIdx;
      const locked = gi > openableUpTo && !isDone && !everOpened.has(group.id);

      const { state, open: wantOpen } = panels[gi];
      const open = wantOpen && !locked;
      if (open) everOpened.add(group.id);

      let body;
      if (level >= 3) {
        // 3단계 — 목표만, 절차 없음
        const val = st.session.notes[group.id] ?? '';
        body = `
          <label class="notes-label" for="note-${group.id}">${N.goalOnlyLabel(group.title)}</label>
          <textarea data-note="${group.id}" id="note-${group.id}">${escapeHtml(val)}</textarea>`;
      } else {
        // 짚어 줄 곳은 **했는데 아직 안 적은** 칸이다. 그런 칸이 없으면 아직 안 한 첫 칸이다.
        // 읽는 순서가 아니라 하는 순서를 따라간다 — 그게 이 쪽에서 하려는 일이다.
        const done = group.steps.map((_, i) => stepDone(st, group.id, i));
        const written = group.steps.map((_, i) => Boolean(st.session.notes[substepId(group, i)]));
        // 앞에서부터 **아직 끝나지 않은 첫 칸**을 짚는다. "했는데 안 적은 칸" 을 먼저 찾으면
        // 아직 손도 안 댄 첫 칸을 건너뛰고 뒤엣것을 짚는 일이 생긴다.
        const nextIdx = group.steps.findIndex((_, i) => !(done[i] && written[i]));

        const items = group.steps.map((step, i) => {
          const id = substepId(group, i);
          // 하이라이트는 1단계에서만, 그리고 **지금 할 STEP 안에서만** 짚는다.
          // 접힌 STEP 안에서 짚어 봐야 안 보이고, 열어 보면 「여기도 지금」처럼 읽힌다.
          const point = level === 1 && isNow && i === nextIdx;
          const hi = point ? ' substep--next' : '';
          const hint = point
            ? `<p class="substep-hint">${done[i] ? N.stepWriteNow
                : (benchLocked(st) ? N.stepNotYetLocked : N.stepNotYet)}</p>` : '';
          return `
            <li class="substep${hi}" data-done="${done[i]}">
              <div class="substep-title">
                <span class="substep-mark" aria-hidden="true">${done[i] ? '✓' : '·'}</span>
                ${step.label}
                <span class="substep-state">${done[i] ? N.stepDoneMark : N.stepTodoMark}</span>
              </div>
              <!-- **「어떻게 하는가」한 줄.** 제목(label)은 무엇을 하는가만 말한다 — 그것만 읽고
                   실험대를 보면 무엇을 어디에 끌어다 대라는 건지 알 수 없다. how 는 실험대의 물건
                   이름을 그대로 써서 손이 할 일을 적는다. 없는 조작은 절대 약속하지 않는다 —
                   tests/uniformity.test.js 가 빈 how 와 실험대에 없는 이름을 잡는다. -->
              ${step.how ? `<p class="substep-how">${emph(step.how)}</p>` : ''}
              ${hint}
              <label class="notes-label" for="note-${id}">${N.notesLabel}</label>
              <textarea data-note="${id}" id="note-${id}"
                placeholder="${escapeHtml(notePlaceholder(level, step))}">${escapeHtml(st.session.notes[id] ?? '')}</textarea>
            </li>`;
        }).join('');
        body = `<ul class="substep-list">${items}</ul>`;
      }

      // 접힌 STEP 에도 **「눌러서 열린다」**를 적어 둔다. 말하지 않으면 잠긴 것으로 읽힌다.
      const openHint = isNow ? ''
        : `<span class="step-open-hint">${
          locked ? N.stepLockedHint : (isDone ? N.stepReopenHint : N.stepPeekHint)
        }</span>`;
      // 막힌 STEP 을 눌렀을 때 읽을 한 줄. 낭독기에도 붙인다(`aria-describedby`).
      const whyId = `step-why-${group.id}`;
      const why = locked
        ? `<p class="step-locked-why" id="${whyId}">${N.stepLockedWhy(groups[nowIdx].id)}</p>` : '';

      return `
        <details class="note-step${locked ? ' note-step--locked' : ''}" data-step-group="${group.id}"
          data-state="${state}" data-done="${isDone}"
          data-locked="${locked}"${open ? ' open' : ''}>
          <summary class="step-summary" aria-disabled="${locked}"${
            locked ? ` aria-describedby="${whyId}"` : ''}>
            <!-- 제목은 접혀도 h3 로 남는다. 다른 쪽이 전부 h3 라, 여기만 span 이면
                 제목만 훑어 내려가는 학생에게 4단계가 통째로 사라진다. -->
            <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
            ${isDone ? '<span class="step-done-mark">✓</span>' : ''}
            ${isNow ? `<span class="step-now-badge">${N.stepNowBadge}</span>` : ''}
            ${openHint}
          </summary>
          ${why}
          <div class="step-body">
            ${body}
            ${group.id === QUESTION_A_AFTER ? questionA(st) : ''}
          </div>
        </details>`;
    }).join('');

    const tally = nowIdx === -1
      ? `<p class="step-tally step-tally--done">${N.stepAllDone}</p>`
      : `<p class="step-tally">${N.stepProgress(doneCount, groups.length)}</p>`;

    return `<p class="stage-text step-lead">${emph(N.stepLeadIn)}</p>
      ${tally}
      <div id="note-step-4">${stepsHtml}</div>`;
  }

  /**
   * 질문 ⓐ — STEP 6(꺼내기) 직후에 묻는다. **순서가 곧 논증이다** (`docs/06`).
   *
   * 갈라진 띠를 눈으로 본 **직후**에 물어야 답이 나온다. 정리(6쪽)까지 미루면 학생은 그때 본 것을
   * 기억으로 더듬어야 하고, 「왜 갈라지는가」가 눈앞의 관찰이 아니라 지식 회상 문제가 된다.
   *
   * **STEP 4(점 찍기) 밑에 붙어 있었다** — 바나나랩의 자리(네 번째 STEP 이 현미경 관찰)를
   * 그대로 물려받은 것이다. 이 실험에서 STEP 4 는 아직 전개 전이라 「방금 띠가 여러 개
   * 갈라졌습니다」가 거짓말이 된다. 문서(docs/06)와 `qaNotYet` 문구는 처음부터 STEP 6 이었다.
   *
   * 여기서 받은 답은 `notes['q.a']` 한 곳에 저장되고, 6단계에서는 같은 값을 이어 쓴다 —
   * 다시 묻지 않는다.
   */
  function questionA(st) {
    const val = st.session.notes['q.a'] ?? '';
    const g = val.trim() ? gradeQuestion('qa', val) : null;
    return `
      <div class="grade-block question-a">
        <h4>${N.questionA.heading}</h4>
        <p class="stage-text">${N.questionA.prompt}</p>
        <label class="notes-label" for="note-qa-step">${N.questionA.label}</label>
        <textarea data-note="q.a" id="note-qa-step">${escapeHtml(val)}</textarea>
        ${g ? `<p class="grade-line" id="grade-qa" data-grade="${g.status}">${g.message ?? N.gradeOk}</p>` : ''}
      </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* 5 결과 — 캡처 자동 첨부 + 배율 직접 입력                            */
  /* ---------------------------------------------------------------- */

  function renderStage5(st) {
    const caps = st.session.captures;
    if (caps.length === 0) return `<p class="stage-empty">${N.noCaptures}</p>`;
    return `<p class="stage-empty">${N.captureListHint}</p>
      <div class="capture-list">${caps.map((c, i) => {
      // 저장 키는 배열 인덱스가 아니라 캡처에 붙은 번호(`at`)다.
      // 가운데 기록을 지우면 인덱스가 밀려, 아래 카드의 답이 통째로 한 칸씩 어긋난다.
      const at = c.at ?? i;
      const key = `rf.${at}`;
      const domId = `note-rf-${at}`; // id 에는 '.' 을 안 쓴다 — CSS 선택자에서 클래스로 오해된다
      const saved = st.session.notes[key] ?? '';
      const solventMm = measurableFrontMm(c);
      // **잴 수 있는 것만 보여 준다.** 전선을 표시하지 않았거나 종이 끝을 넘어갔으면
      // 분모가 없다 — 그때 숫자를 지어내 보여 주면 앱이 없는 답을 만들어 주는 셈이 된다.
      const travel = solventMm === null ? null : solventMm - (c.originMm ?? ORIGIN_MM);
      const check = saved !== '' && travel !== null
        ? gradeAnyBand(saved, pickedBandTravel(c), travel)
        : null;
      return `
        <div class="capture-card">
          <div class="capture-head">
            <h3>${UI.units.times(c.spots ?? 0)} · ${(c.marker && UI.markers[c.marker]) ?? ''}</h3>
            <button type="button" class="capture-del" data-del="${at}"
              aria-label="${N.captureDeleteLabel(i + 1)}">${N.captureDelete}</button>
          </div>
          <!-- 기록한 거름종이를 그대로 되살린다. 캡처가 stripParams 한 벌을 통째로 담고 있으므로
               그때 본 것과 같은 그림이 나온다. idPrefix 를 카드마다 달리 주지 않으면
               모든 카드가 첫 카드의 띠 색을 쓴다 — 에러 없이 조용히 틀린다.
               번호(at)로 붙인다 — 지우고 나서도 남은 카드의 접두사가 바뀌지 않는다. -->
          <div class="capture-strip">${renderStrip(c, { idPrefix: `cap${at}-` })}</div>
          <dl class="capture-readout">
            <!-- **잰 값을 적어 주지 않는다.** 자로 읽는 것이 이 실험이 가르치려는 바다.
                 여기 적는 것은 학생이 정한 조건들이다 — 나중에 왜 이런 결과가 나왔는지
                 되짚을 때 필요한 값이다. -->
            <div><dt>${N.spotsLabel}</dt><dd>${UI.units.times(c.spots ?? 0)}</dd></div>
            <div><dt>${N.originLabel}</dt><dd>${UI.units.mm(Math.round(c.originMm ?? ORIGIN_MM))}</dd></div>
            <div><dt>${N.depthLabel}</dt><dd>${UI.units.mm(Math.round(c.runDepthMm ?? c.depthMm ?? 0))}</dd></div>
            <div><dt>${N.cappedLabel}</dt><dd>${(c.chlorophyllKept ?? 1) >= CAPPED_KEPT ? N.cappedKept : N.cappedOpened}</dd></div>
            <div><dt>${UI.observability.label}</dt><dd>${observability(c).score}</dd></div>
          </dl>
          ${travel === null
            ? `<p class="grade-line" data-grade="unavailable">${c.overrun ? N.rfOverrun : N.rfUnmeasurable}</p>`
            : `<label class="notes-label" for="${domId}">${N.rfInput}</label>
               <p class="stage-hint">${N.rfHowTo.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
               <input type="text" inputmode="decimal" placeholder="${N.rfPlaceholder}"
                 data-note="${key}" id="${domId}" value="${escapeHtml(saved)}">
               ${check ? `<p class="grade-line" data-grade="${check.status}">${check.message ?? ''}</p>` : ''}`}
        </div>`;
    }).join('')}</div>`;
  }

  /**
   * 후보 넷 중 **하나라도** 맞으면 통과. 전부 어긋났을 때만 되돌려 준다.
   * 어느 것을 골랐는지 앱이 알 수 없으므로, 가장 관대한 쪽이 맞다 —
   * 맞게 쟀는데 미달로 뜨는 비용이 그 반대보다 훨씬 크다 (grading.js 머리말).
   */
  function gradeAnyBand(saved, travels, solventMm) {
    const results = travels.map((mm) => gradeRf(saved, { pigmentMm: mm, solventMm }));
    return results.find((r) => r.status === 'pass') ?? results[0];
  }

  /**
   * 학생이 어느 색소를 골라 쟀는지는 알 수 없다. 그래서 **가장 관대하게** 본다 —
   * 네 띠 중 하나라도 맞으면 통과다.
   *
   * 앱이 "카로틴을 재세요" 라고 지정하지 않는 이유는, 그러면 앱이 카로틴의 Rf 를 아는
   * 척하게 되기 때문이다. 학생은 아무 띠나 골라 재면 되고, 채점되는 것은 **나눗셈**이다.
   */
  function pickedBandTravel(c) {
    const origin = c.originMm ?? ORIGIN_MM;
    const front = measurableFrontMm(c) ?? 0;
    return PIGMENTS.map((pig) => bandMm(pig.rf, front, origin) - origin);
  }

  /* ---------------------------------------------------------------- */
  /* 6 정리 — 서술형 3문항 + 첨삭, 세부 단계 기록·예상 재복습, 성찰 문항  */
  /* ---------------------------------------------------------------- */

  function renderStepNotesRecap(st) {
    const rows = Object.entries(st.session.notes)
      .filter(([k, v]) => isStepNoteKey(k) && v && v.trim())
      .map(([k, v]) => `<li><b>${stepNoteLabel(k)}</b> — ${escapeHtml(v)}</li>`);
    if (rows.length === 0) return '';
    return `<section><h3>${N.stepNotesHeading}</h3><ul class="step-notes-recap">${rows.join('')}</ul></section>`;
  }

  function renderPredictCompare(st) {
    const row = `
      <div class="predict-compare-row">
        <dl class="compare-pair">
          <dt>${N.predictRecapLabel}</dt>
          <dd>${escapeHtml(st.session.notes.predict || N.predictNone)}</dd>
          <dt>${N.actualLabel}</dt>
          <dd>${actualSummary(st)}</dd>
        </dl>
      </div>`;
    return `<section><h3>${N.predictHeading}</h3>${row}</section>`;
  }

  /** 볼 만하지 않게 나온 기록들. 같은 것을 여러 번 묻지 않도록 최근 한 장만 본다. */
  function blurryCaptures(st) {
    const poor = st.session.captures.filter((c) => observability(c).score < LOW_OBSERVABILITY);
    return poor.length ? [poor[poor.length - 1]] : [];
  }

  function renderReflect(st) {
    const blurry = blurryCaptures(st);
    if (blurry.length === 0) return '';
    const items = blurry.map((c) => {
      const at = c.at ?? 0;
      const key = `reflect.${at}`;
      const chosen = st.session.notes[key];
      const options = Object.keys(UI.observability.worst).map((k) => `
        <button type="button" class="reflect-opt${chosen === k ? ' reflect-opt--chosen' : ''}"
          data-reflect="${key}" data-value="${k}">${UI.observability.worst[k]}</button>`).join('');
      const retry = chosen
        ? `<button type="button" class="reflect-retry" data-retry="${at}">${N.reflectRetry}</button>`
        : '';
      return `
        <div class="reflect-item" data-capture="${at}">
          <p>${N.reflectQuestion()}</p>
          <div class="reflect-options" role="group">${options}</div>
          ${retry}
        </div>`;
    }).join('');
    return `<section id="reflect">${items}</section>`;
  }

  /**
   * 첨삭 줄. **빈칸에는 띄우지 않는다.**
   *
   * 아무것도 안 쓴 칸에 "두 물질의 양과 흩어진 모양을 서로 견주어 써 보세요" 가 먼저 뜨면,
   * 학생은 쓰기도 전에 부족하다는 말부터 듣는다. 쓸 마음이 꺾이는 자리다.
   * 다만 **답할 수 없는 문항**(아직 결과 보드가 없는 3번)은 왜 못 쓰는지 미리 알려 준다 —
   * 그건 지적이 아니라 안내다.
   */
  function gradeLine(id, key, text) {
    const g = gradeQuestion(key, text);
    if (!text.trim() && g.status !== 'unavailable') return '';
    return `<p id="grade-${id}" class="grade-line" data-grade="${g.status}">${g.message ?? N.gradeOk}</p>`;
  }

  /**
   * 모둠 토의 기록 — 모둠으로 하는 세션에만 나온다.
   * 혼자 하는 학생에게 "누가 무엇을 맡았나요" 를 물으면 답할 것이 없고,
   * 빈칸으로 남은 문항은 보고서에서 "안 한 일" 로 읽힌다.
   */
  function renderDiscussion(st) {
    if (!isGroup(st)) return '';
    const items = N.discussionItems.map(({ key, label, eg }) => `
      <div class="self-eval-item">
        <label class="notes-label" for="note-discuss-${key}">${label}</label>
        <textarea data-note="discuss.${key}" id="note-discuss-${key}"
          placeholder="${escapeHtml(eg)}">${escapeHtml(st.session.notes[`discuss.${key}`] ?? '')}</textarea>
      </div>`).join('');
    return `<section class="grade-block"><h3>${N.discussionHeading}</h3>${items}</section>`;
  }

  function renderStage6(st) {
    const qa = st.session.notes['q.a'] ?? '';
    const q2 = st.session.notes.q2 ?? '';
    const q3 = st.session.notes.q3 ?? '';
    return `
      ${renderStepNotesRecap(st)}
      ${renderPredictCompare(st)}
      <section class="grade-block">
        <!-- 질문 ⓐ 는 STEP 4 직후에 이미 물었다 (docs/06 — 순서가 곧 논증이다).
             여기서 다시 묻지 않고, 그때 쓴 답을 그대로 이어 쓰게 한다.
             같은 notes['q.a'] 를 쓰므로 어느 쪽에서 고쳐도 한 벌이다. -->
        <label class="notes-label" for="note-qa">${N.qaContinueLabel}</label>
        <p class="stage-empty">${qa.trim() ? N.qaCarried : N.qaNotYet}</p>
        <textarea data-note="q.a" id="note-qa">${escapeHtml(qa)}</textarea>
        ${gradeLine('qa', 'qa', qa)}
      </section>
      <section class="grade-block">
        <label class="notes-label" for="note-q2">${N.q2Label}</label>
        <textarea data-note="q2" id="note-q2">${escapeHtml(q2)}</textarea>
        ${gradeLine('q2', 'q2', q2)}
      </section>
      ${isGroup(st) ? `
      <section class="grade-block">
        <label class="notes-label" for="note-q3">${N.q3Label}</label>
        <textarea data-note="q3" id="note-q3">${escapeHtml(q3)}</textarea>
        ${gradeLine('q3', 'q3', q3)}
      </section>` : ''}
      ${renderDiscussion(st)}
      ${renderReflect(st)}`;
  }

  /* ---------------------------------------------------------------- */
  /* 7 자기 평가 — session.violations 를 그대로 보여 준다. 감점하지 않는다. */
  /* ---------------------------------------------------------------- */

  /**
   * 7 자기 평가.
   *
   * 척도는 **난이도와 무관하게 세 단계 모두 똑같다.** 자기를 돌아보는 일에 난이도를 매길 이유가 없다.
   * 점수를 합산하지도, 등급을 내지도 않는다 — 학생이 스스로를 어디쯤으로 보는지가 남을 뿐이다.
   *
   * 라디오 버튼을 쓴다. 커스텀 버튼으로 만들면 화살표 이동·그룹 읽기를 직접 구현해야 하는데,
   * 브라우저가 이미 표준으로 해 주는 일이다.
   */
  function renderStage7(st) {
    const scale = N.likertScale;
    const rows = N.selfEvalItems.map(({ key, label }) => {
      const saved = st.session.notes[`selfeval.${key}`] ?? '';
      const cells = scale.map(({ value, label: vLabel }) => `
        <label class="likert-cell">
          <input type="radio" name="selfeval.${key}" value="${value}"
            data-note="selfeval.${key}"${saved === value ? ' checked' : ''}>
          <span class="likert-num">${value}</span>
          <span class="likert-word">${vLabel}</span>
        </label>`).join('');
      return `
        <fieldset class="likert-row">
          <legend>${label}</legend>
          <div class="likert-scale">${cells}</div>
        </fieldset>`;
    }).join('');

    const reflections = N.reflectionItems.map(({ key, label, eg }) => `
      <div class="self-eval-item">
        <label class="notes-label" for="note-reflect-${key}">${label}</label>
        <textarea data-note="feedback.${key}" id="note-feedback-${key}"
          placeholder="${escapeHtml(eg)}">${escapeHtml(st.session.notes[`feedback.${key}`] ?? '')}</textarea>
      </div>`).join('');

    /*
     * **가치·태도 — 여기서 아무것도 판정하지 않는다.**
     *
     * 예전에는 손 씻기·마개 닫기·폐액 버리기를 지켜보고 ✓/✗ 를 매겼다. 그런데 가상 실험에서
     * 그것을 따지면 **화면 속 단추를 눌렀다는 사실**을 평가하게 된다 — 안전 습관이 아니라
     * 조작 순서 외우기다. 진짜 마개는 교실에서 닫는다.
     *
     * 그래서 판정을 걷어내고 **가만히 적힌 안내**만 둔다. 늘 같은 글이 같은 자리에 있고,
     * **종이(보고서)도 글자 그대로 같은 것을 싣는다** — 화면과 종이가 다른 말을 하면 안 된다.
     */
    return `
      <div id="self-eval">
        <h3>${N.likertHeading}</h3>
        ${rows}
        <h3>${N.reflectionHeading}</h3>
        ${reflections}

      </div>`;
  }

  const STAGE_RENDERERS = {
    1: renderStage1, 2: renderStage2, 3: renderStage3, 4: renderStage4,
    5: renderStage5, 6: renderStage6, 7: renderStage7,
  };

  /* ---------------------------------------------------------------- */

  function bindPanel() {
    panelEl.querySelectorAll('[data-note]').forEach((el) => {
      el.addEventListener('change', () => {
        /*
         * **Tab 으로 옮기는 중에 그리면 목적지 칸이 사라진다.**
         *
         * `change` 는 포커스가 **아직 `body` 인 동안** 온다 — 브라우저가 다음 칸으로
         * 옮기는 도중이다. 여기서 곧장 다시 그리면 그 목적지가 새 것으로 갈려,
         * 포커스는 갈 곳을 잃고 `body` 에 떨어진다. **그 뒤에 친 글자는 어디에도
         * 안 들어간다** — 화면에 아무 표시 없이 사라진다.
         *
         * 아래 `holding` 장치로는 못 막는다. 그것은 `pointerdown` 을 보는데
         * **Tab 에는 그 누름이 없다.** 마우스 경로만 살아 있었다.
         * (fermentation 세션이 찾고 허브가 전해 줬다.)
         */
        savingNote = true;
        store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });
        savingNote = false;
        renderSoon();
      });
      // 적는 도중에도 관문은 사실을 말해야 한다. 저장(`change`)은 칸을 떠나야 일어난다.
      el.addEventListener('input', refreshGates);
    });
    // 선택형 예상 — 고른 보기를 **글로** 저장한다. 6단계에서 실제 결과와 나란히 읽히려면
    // 코드가 아니라 문장이어야 한다.
    panelEl.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('SAVE_NOTE', { step: btn.dataset.choice, text: btn.dataset.value });
      });
    });
    panelEl.querySelectorAll('[data-reflect]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('SAVE_NOTE', { step: btn.dataset.reflect, text: btn.dataset.value });
      });
    });
    panelEl.querySelectorAll('[data-retry]').forEach((btn) => {
      btn.addEventListener('click', () => onOpenZoom('scope', btn.dataset.retry, btn));
    });
    panelEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('DELETE_CAPTURE', { at: Number(btn.dataset.del) });
      });
    });
    panelEl.querySelector('#mark-read')?.addEventListener('click', (e) => {
      /*
       * **관문은 화면 표시가 아니라 지금 상태를 본다.**
       *
       * `aria-disabled` 는 마지막으로 그린 값이다. 예상을 고르자마자 누르면 아직 다시
       * 그리기 전이라 낡은 `true` 가 남아 있고, 그 누름이 조용히 삼켜진다.
       * 막을지 말지는 **상태가 정한다.**
       */
      if (activeStage === '3' && !noteAt(store.getState(), liveNotes(), 'predict')) return;
      /*
       * **누른 자리에 그냥 두지 않고 다음 쪽으로 넘긴다.**
       * 예전에는 ✓ 만 남아서 학생이 탭을 직접 눌러 옮겨야 했다 — 읽는 순서가 정해져 있는데
       * 옮기는 일을 학생에게 맡길 이유가 없다.
       *
       * **마지막 읽기 쪽(4쪽)에서는 그 자리에 머문다.** 4쪽이 「탐구 과정」이고,
       * 그 순간 실험대가 열린다 — 학생이 실험하는 내내 보고 있어야 할 쪽이 바로 여기다.
       * 5쪽(결과)으로 밀면 아직 아무 결과도 없는 빈 쪽을 보여 주게 된다.
       */
      const required = UI.bench.lock.required;
      const stage = activeStage;
      const at = required.indexOf(stage);
      if (at >= 0 && at < required.length - 1) activeStage = required[at + 1];
      store.dispatch('MARK_READ', { stage });
    });
  }

  /**
   * 「읽었습니다」 — 실험대의 자물쇠를 여는 단추.
   *
   * 1~4 쪽 아래에만 붙는다. 5~7 쪽은 결과가 있어야 채울 수 있어 "읽는" 쪽이 아니다.
   * 다 읽었는지를 기계가 재는 방법은 없다 — 스크롤 끝까지 내렸는지는 손가락이 움직였다는
   * 증거일 뿐이다. 그래서 학생에게 묻는다. 누르는 것 자체가 약속이 된다.
   */
  function readFooter(st) {
    const required = UI.bench.lock.required;
    if (!required.includes(activeStage)) return '';
    const read = st.session.readStages ?? [];
    const left = required.filter((id) => !read.includes(id));
    if (read.includes(activeStage)) {
      return `<p class="read-mark" data-done="true">${N.readDone}${
        left.length === 0 ? ` ${N.readAllDone}` : ''}</p>`;
    }
    /*
     * **예상 쪽은 예상을 고르기 전에는 못 넘어간다.**
     *
     * 채점이 아니다 — 무엇을 고르든 통과다. 예상 없이 실험하면 결과를 보고
     * 「그럴 줄 알았다」가 되어 버려서, 이 쪽이 하려는 일 자체가 사라진다.
     *
     * **`disabled` 를 쓰지 않는다.** 그 속성은 단추에서 포커스를 빼앗아 화면 낭독기가
     * 읽지 못하게 만들고, 왜 못 누르는지 말할 자리도 없앤다 (AGENTS.md §2.1 ·
     * `tests/ui.contract.test.js`). 대신 `aria-disabled` 로 「지금은 못 누른다」를 알리고,
     * **이유를 옆에 적어 두고**, 눌러도 넘어가지 않게 한다.
     */
    const blocked = activeStage === '3' && !predictDone(st);
    return `
      <div class="read-mark">
        <p>${N.readLeadIn}</p>
        ${blocked ? `<p class="read-why" id="read-why">${st.session.level >= 3 ? N.readNeedPredictFree : N.readNeedPredict}</p>` : ''}
        <button type="button" id="mark-read" class="read-confirm"
          aria-disabled="${blocked}"${blocked ? ' aria-describedby="read-why"' : ''}
          >${N.readConfirm}</button>
      </div>`;
  }

  /*
   * **누르는 동안에는 다시 그리지 않는다.**
   *
   * 마지막 칸에 적고 **곧장** 단추를 누르면 그 누름이 사라졌다:
   *
   *   누름 → 칸에서 포커스가 빠짐 → `change` → 저장 → 다시 그리기 →
   *   누르던 단추가 새 것으로 갈림 → `click` 은 「누른 곳과 뗀 곳이 같아야」 나므로 안 남
   *
   * 학생은 **두 번 눌러야** 넘어간다. 한 번 눌러 아무 일도 없으면 고장으로 읽는다.
   * (germination 세션이 찾고 허브가 여덟에 돌렸다. 여기도 있었다 — 3쪽과 4쪽 둘 다.)
   *
   * 그래서 포인터가 눌려 있는 동안에는 미뤄 두고, **`click` 이 지나간 뒤에** 따라잡는다.
   * `pointerup` 에서 곧바로 그리면 안 된다 — `click` 은 `pointerup` **다음**에 오므로
   * 그때 갈아 끼우면 똑같이 삼켜진다.
   */
  let holding = false;
  let missedRender = false;
  /** 글칸 저장이 도는 동안. 포커스가 옮겨 가는 중이라 그 자리에서 그리면 안 된다. */
  let savingNote = false;
  const flushSoon = () => setTimeout(() => {
    holding = false;
    if (missedRender) { missedRender = false; render(); }
  }, 0);
  /** 저장이 미뤄 둔 그리기를 따라잡는다. **`holding` 은 건드리지 않는다** — 누름은 아직 안 끝났다. */
  const renderSoon = () => setTimeout(() => {
    if (missedRender && !holding) { missedRender = false; render(); }
  }, 0);
  root.addEventListener('pointerdown', () => { holding = true; }, true);
  document.addEventListener('pointerup', flushSoon, true);
  document.addEventListener('pointercancel', flushSoon, true);

  /*
   * **다시 그리면 손을 두고 있던 자리가 사라진다.**
   *
   * `panelEl.innerHTML` 은 칸과 단추를 통째로 새 것으로 간다. 포커스가 그 안에 있었으면
   * 갈 곳이 없어져 `body` 로 떨어지고, **커서 자리도 잃는다.** 키보드로만 다니는 학생에게는
   * 「Tab 을 눌렀더니 처음으로 돌아갔다」로 보인다.
   *
   * 그래서 **무엇에 손이 있었는지를 이름으로** 적어 두고, 새로 그린 뒤 같은 이름을 찾아 되돌린다.
   * 마디 자체를 들고 있어 봐야 소용없다 — 그 마디는 이미 버려진 것이다.
   *
   * ★ **패널 밖에 있던 포커스는 건드리지 않는다.** 되돌린답시고 실험대나 주소창에서
   *   포커스를 뺏어 오면 그게 더 나쁘다.
   */
  const attrQuote = (v) => String(v).replace(/["\\]/g, '\\$&');

  function focusSelector(el) {
    if (!el || !panelEl.contains(el)) return null;
    if (el.id) return `#${el.id}`;
    /*
     * STEP 의 제목줄(`<summary>`)에도 이름을 준다. 한 STEP 의 마지막 칸에서 Tab 을 치면
     * 손이 **다음 STEP 의 제목줄**로 가는데, 그 순간 저장(`change`)이 판을 다시 그린다.
     * 제목줄은 id 도 data-note 도 없어 여기서 `null` 이 되고, 포커스는 `body` 로 떨어졌다 —
     * 키보드로 4쪽을 채우던 학생이 매 STEP 마다 처음부터 Tab 해 돌아와야 했다 (플레이테스트).
     */
    if (el.classList?.contains('step-summary')) {
      const g = el.parentElement?.dataset?.stepGroup;
      if (g) return `.note-step[data-step-group="${attrQuote(g)}"] > .step-summary`;
    }
    const d = el.dataset ?? {};
    if (d.note) return `[data-note="${attrQuote(d.note)}"]`;
    if (d.choice) return `[data-choice="${attrQuote(d.choice)}"][data-value="${attrQuote(d.value ?? '')}"]`;
    if (d.reflect) return `[data-reflect="${attrQuote(d.reflect)}"][data-value="${attrQuote(d.value ?? '')}"]`;
    return null;
  }

  function focusKeep() {
    const el = document.activeElement;
    const sel = focusSelector(el);
    if (!sel) return null;
    // 글칸이 아니면 커서 자리가 없다. `selectionStart` 는 단추에서 예외를 던지지 않지만 null 이다.
    let start = null;
    let end = null;
    try { start = el.selectionStart; end = el.selectionEnd; } catch { /* 커서가 없는 것뿐이다 */ }
    return { sel, start, end };
  }

  function focusRestore(keep) {
    if (!keep) return;
    const el = panelEl.querySelector(keep.sel);
    if (!el) return;   // 쪽이 바뀌었으면 그 칸은 이제 없다 — 그게 맞다
    el.focus();
    if (keep.start != null) {
      try { el.setSelectionRange(keep.start, keep.end); } catch { /* 커서를 못 두는 종류다 */ }
    }
  }

  function render() {
    if (holding || savingNote) { missedRender = true; return; }
    const st = store.getState();
    tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.stage === activeStage));
      // 끝낸 쪽에는 표시를 남긴다. 어디가 남았는지 탭만 보고 알 수 있어야 한다 —
      // 앞 네 쪽은 실험대를 여는 조건이고, 뒤 세 쪽은 보고서를 내는 조건이다.
      tab.dataset.read = String(stageDone(st, tab.dataset.stage));
    });
    const keep = focusKeep();
    panelEl.innerHTML = STAGE_RENDERERS[activeStage](st) + readFooter(st);
    bindPanel();
    focusRestore(keep);
    renderReportSlot(st);
  }

  store.subscribe(render);
  render();
}
