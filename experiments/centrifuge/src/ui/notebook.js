/**
 * 탐구 노트 — 7단계 패널.
 *
 * docs/06-lab-notebook.md 의 7단계(문제 인식~자기 평가)를 최상위 탭으로, 조작 절차는
 * 4단계 「탐구 과정」 안의 STEP 으로 내린다.
 * strings.js 의 UI.protocol 이 그 STEP 의 제목/세부 단계 텍스트를 갖고 있으므로 그대로
 * 재사용하고, 세부 단계 id(1a, 1b, 2a…)는 배열 순서에서 글자를 붙여 만든다.
 *
 * 결과를 바꾸는 조작은 전부 store.dispatch('SAVE_NOTE', …) 를 거쳐 reduce() 로 간다 — 이 파일은
 * session.notes 를 직접 대입하지 않는다.
 */

import { MODES, isClotted } from '../sim/state.js';
import { ASSETS } from '../assets/index.js';
import { renderTube } from '../render/tube.js';
import { observability } from '../sim/quality.js';
import { gradeQuestion, gradeHematocrit } from './grading.js';
import { UI } from './strings.js';
import { stepDone, groupDone, resultsDone } from '../sim/progress.js';
import { BENCH_KINDS, benchLocked } from './bench.js';


const N = UI.notebook;

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

/**
 * **이 난이도에서 4단계가 실제로 내주는 기록칸의 키.**
 *
 * ── 왜 한 곳에 두는가 ──────────────────────────────────────────────
 * 난이도가 바뀌면 **저장되는 키 자체가 바뀐다.** 1·2단계는 절차를 짚어 주므로 세부 단계마다
 * 칸이 있고(`notes['1a']`), 3단계는 짚어 주지 않으므로 **STEP 하나에 칸 하나**다(`notes['1']`).
 *
 * 화면·종이·검사가 이 규칙을 **따로따로** 갖고 있었다. 종이는 늘 세부 단계 키만 읽어서,
 * 3단계로 푼 학생이 적은 글이 **한 자도 안 실리고** 준 적도 없는 칸에
 * 「적지 않았습니다」가 달렸다 — 재어 보니 **적은 7칸이 0칸 실리고 8칸이 빈칸**이었다.
 * 「적지 않았습니다」보다 나쁘다: 적은 것을 지우고 그 자리에 안 적었다고 쓰는 것이다.
 *
 * 아무도 못 본 이유는 **검사가 전부 `initialState(1)` 로만 종이를 만들었기** 때문이다.
 * 난이도가 축인 줄을 몰라 그 축을 흔들어 보지 않았다.
 * (germination 세션이 찾아 바나나랩에서 재현했고, 허브가 넘겨 주었다)
 */
/**
 * 이 STEP 의 관찰 기록이 **다 찼는가.**
 *
 * 난이도마다 칸이 다르다 — 3단계는 STEP 하나에 칸 하나, 1·2단계는 `note` 가 붙은
 * 세부 단계마다다. `stepNoteKeys` 와 **같은 규칙**을 써야 화면이 갈라지지 않는다.
 * 적을 칸이 아예 없는 STEP 은 「다 찼다」로 본다 — 없는 칸을 기다리면 영영 안 열린다.
 */
export function groupNotesWritten(st, group, level) {
  const keys = level >= 3
    ? [group.id]
    : group.steps.map((step, i) => (step.note ? substepId(group, i) : null)).filter(Boolean);
  return keys.every((k) => String(st.session.notes[k] ?? '').trim().length > 0);
}

export function stepNoteKeys(level) {
  if (level >= 3) return UI.protocol.map((g) => g.id);
  return UI.protocol.flatMap((g) => g.steps
    .map((step, i) => (step.note ? substepId(g, i) : null))
    .filter(Boolean));
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
 * 이 자리는 예상과 견주는 자리다 — 학생이 "세 부분으로 갈린다" 고 예상했는데 실제 결과가
 * 「분리도 0.83」이면 견줄 것이 없다. **눈으로 본 것**을 말한다.
 *
 * 보고서(`report.js`)도 같은 문장을 쓴다 — 화면과 종이가 다른 말을 하면 안 된다.
 *
 * @param {object} st
 * @param {'split'|'outer'|'balance'} itemId  예상 문항 셋과 짝을 이룬다
 */
export function actualSummary(st, itemId) {
  // 가장 나중에 기록한 것을 본다. 여러 번 돌려 본 학생에게는 마지막 것이 그의 결과다.
  const cap = st.session.captures[st.session.captures.length - 1];
  if (!cap) return N.actualNotCaptured;
  const A = N.actual;
  let seen;
  if (itemId === 'split') {
    if (cap.clotted) seen = A.split.clotted;
    else if (cap.separation < 0.25) seen = A.split.none;
    else if (cap.buffyOfColumn > 0.004) seen = A.split.three;
    else seen = A.split.two;
  } else if (itemId === 'outer') {
    seen = cap.separation >= 0.25 ? A.outer.packed : A.outer.none;
  } else {
    seen = cap.mixed > 0.2 ? A.balance.wobbly : A.balance.steady;
  }
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
const predictDone = (st) => N.predictItems.every(({ id }) => hasNote(st, `predict.${id}`));
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

export function reportReadiness(st) {
  const missing = [];
  if (!predictDone(st)) missing.push(N.reportTodo.predict);
  // 한 번은 돌려서 결과를 남겨야 한다. 이 실험이 하려는 일이 그것이다.
  // 잘 안 나온 것도 기록이다 — 왜 그랬는지를 6단계에서 적게 한다.
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
    /*
     * **펼쳐 둔 것은 다시 그려도 펼쳐 둔다.** 이 자리는 상태가 바뀔 때마다 `innerHTML` 로
     * 새로 만들어지는데, 회전판이 잦아드는 동안·핏방울이 굳는 동안은 0.3초마다 그린다.
     * 펼친 목록이 0.3초 뒤에 도로 접히면 학생은 무엇이 남았는지 끝내 못 읽는다
     * (플레이테스트에서 실제로 그랬다 — PLAYTEST-REVIEW #2). STEP 의 `manualOpen` 과 같은 이유다.
     */
    const wasOpen = reportSlot.querySelector('.report-todo')?.open ?? false;
    reportSlot.innerHTML = `
      <details class="report-todo"${wasOpen ? ' open' : ''}>
        <summary>${N.reportLockedHint} (${missing.length})</summary>
        <ul>${missing.map((m) => `<li>${m}</li>`).join('')}</ul>
      </details>`;
  }

  const tabsEl = root.querySelector('#note-tabs');
  const panelEl = root.querySelector('#note-panel');
  let activeStage = N.stages[0].id;

  /**
   * 학생이 **손으로** 여닫은 STEP. 그룹 id → 열렸는가.
   *
   * `innerHTML` 로 4단계를 다시 그려도 그대로 남아야 한다 — 앞으로 올 STEP 을 펼쳐 놓고
   * 실험대에서 손을 대면 노트가 다시 그려지는데, 그때마다 도로 접히면 열어 둘 수가 없다.
   * 상태(store)에 넣지 않는 것은 이것이 **관찰도 조작도 아니어서**다.
   * 되돌리기 기록에 「STEP 3 을 펼쳤다」 가 쌓이면 무를 것을 찾을 수 없게 된다.
   */
  const manualOpen = new Map();

  /**
   * **한 번이라도 펼쳐진 적이 있는 STEP.**
   *
   * 관찰 기록을 안 적으면 다음 STEP 이 안 열리는데, 그 잠금이 **뒤를 돌아보는 것까지**
   * 막으면 안 된다. 실험대에서 죽 하고 온 학생은 그동안 STEP 이 차례로 펼쳐졌고,
   * 그 STEP 들은 이미 자기가 지나온 곳이다. 지나온 곳은 계속 열린다.
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
  function renderStage2() {
    /*
     * **표에 있는데 실험대에 없는 물건이 셋 있다** — 손상성 폐기물 통·개수대·휴지.
     * 안전 조작을 걷어내면서 뺐고, 「실제 실험에서는 이렇게 한다」를 알리려고 표에는 남겼다.
     * 그런데 **아무 표시가 없었다.** 학생이 「실험이 끝나면 손을 씻습니다」를 읽고
     * 실험대에서 개수대를 찾으면 없고, 왜 없는지 화면이 한 마디도 안 한다.
     * 배포본을 폰으로 플레이하다 걸렸다.
     *
     * **목록을 손으로 적지 않는다.** `BENCH_KINDS` 에서 빠졌는가로 본다 — 물건을
     * 실험대에 도로 넣거나 더 빼도 표가 저절로 따라온다. 적어 두면 어긋난다.
     */
    const rows = N.materials.map(({ asset, name, role, state = {} }) => {
      const offBench = !BENCH_KINDS.includes(asset);
      return `
      <tr${offBench ? ' class="mat-off"' : ''}>
        <td class="mat-fig">${ASSETS[asset].render(state)}</td>
        <th scope="row">${name}${offBench ? ` <span class="mat-off-tag">${N.matOffBench}</span>` : ''}</th>
        <td>${role}</td>
      </tr>`;
    }).join('');
    return `
      <h3>${N.materialsHeading}</h3>
      <table class="materials-table">
        <thead><tr><th>${N.matHeadFigure}</th><th>${N.matHeadName}</th><th>${N.matHeadRole}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="safety-note">
        <h3>${N.safetyHeading}</h3>
        <ul class="safety-list">${N.safetyNotes.map((n) => `<li>${n}</li>`).join('')}</ul>
        <p class="safety-disclaimer">${N.safetyDisclaimer}</p>
      </section>`;
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
    // 무엇을 할지 모르는 채로 고르라고 하면 뜬금없다.
    // 할 일은 밝히고, 무엇이 보일지는 밝히지 않는다 — 그게 지금 묻고 있는 것이다.
    const lead = `<div class="predict-lead">${
      N.predictLeadIn.map((p) => `<p>${emph(p)}</p>`).join('')
    }</div>`;
    return lead + N.predictItems.map((item) => {
      const key = `predict.${item.id}`;
      const val = st.session.notes[key] ?? '';
      const whyKey = `predict.why.${item.id}`;
      const choices = level >= 3 ? '' : `
        <div class="predict-choices" role="group" aria-label="${escapeHtml(item.label)}">
          ${item.options.map((opt) => `
            <button type="button" class="predict-opt${val === opt ? ' predict-opt--chosen' : ''}"
              data-choice="${key}" data-value="${escapeHtml(opt)}"
              aria-pressed="${val === opt}">${escapeHtml(opt)}</button>`).join('')}
        </div>`;
      // 1단계는 보기만, 2단계는 보기 + 까닭, 3단계는 빈칸만.
      // **예시 문구가 칸마다 다르다** — 같은 예시를 세 번 걸면 그 한 문장을 세 번 베낀다.
      const free = level === 1 ? '' : `
        <label class="notes-label" for="note-${level === 2 ? 'why' : 'predict'}-${item.id}">${
  level === 2 ? N.predictWhyLabel : escapeHtml(item.label)
}</label>
        <textarea data-note="${level === 2 ? whyKey : key}"
          id="note-${level === 2 ? 'why' : 'predict'}-${item.id}"
          placeholder="${escapeHtml(level === 2 ? item.why : item.free)}"
          >${escapeHtml(st.session.notes[level === 2 ? whyKey : key] ?? '')}</textarea>`;
      return `
        <div class="predict-block">
          <h3>${emph(item.label)}</h3>
          ${choices}
          ${free}
        </div>`;
    }).join('');
  }

  /** `**굵게**` 만 허용한다. 문구에 강조를 넣으려고 HTML 을 통째로 열어 두지 않는다. */
  function emph(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  /* ---------------------------------------------------------------- */
  /* 4 탐구 과정 — STEP 1~6. 난이도별로 절차 제시만 달리한다 (docs/06 표). */
  /* ---------------------------------------------------------------- */

  /**
   * 4단계 탐구 과정 — **한 번에 한 STEP.**
   *
   * 일곱 STEP 을 한꺼번에 펼쳐 놓으면 학생이 그것을 **읽을 글**로 받는다. 주욱 읽고
   * 내려간 다음 실험대로 가서 무엇부터 할지 몰라 멈춘다. 지금 할 것 하나만 펼치면
   * 노트가 글이 아니라 **따라가는 길**이 된다.
   *
   * ── 「지금 STEP」 은 어디서 오는가 ──────────────────────────────
   * `groupDone` 이 거짓인 **첫 STEP** 이다. **상태에서 나오므로 따로 저장하지 않는다** —
   * 실험대에서 한 일이 그대로 노트를 넘긴다. 노트가 자기 나름의 「지금」 을 들고 있으면
   * 실험대와 어긋나고, 어긋난 쪽을 학생이 고칠 방법이 없다.
   *
   * ── 접힘은 **잠금이 아니다** (AGENTS.md §2.1) ────────────────────
   * `disabled` 도 `pointer-events:none` 도 쓰지 않는다. **앞으로 올 STEP 도
   * 눌러서 열리고**, 순서를 건너뛰어 실험한 학생은 거기에 적으면 된다. 앞으로 올 STEP 을
   * 지우지도 않는다 — 몇 칸짜리 여정인지 보여야 자기가 어디쯤인지 안다.
   * 접힌 STEP 에는 **「눌러서 열립니다」를 적어 둔다**. 말하지 않으면 잠긴 것으로 읽힌다.
   *
   * 학생이 손으로 여닫은 것은 `manualOpen` 이 기억하고 **그것이 이긴다.**
   */
  function renderStage4(st) {
    const level = st.session.level;
    const groups = UI.protocol;
    const groupsDone = groups.map((g) => groupDone(st, g.id));
    const nowIdx = groupsDone.findIndex((d) => !d);   // 다 끝났으면 -1
    const doneCount = groupsDone.filter(Boolean).length;

    /*
     * **관찰 기록을 적으면 다음 STEP 이 「하나만」 열린다.**
     *
     * 앞서 「지금 STEP 의 기록이 비었는가」 하나로만 잠갔다. 그러면 적는 순간 그 조건이
     * 통째로 풀려 **뒤 STEP 이 한꺼번에 다 열렸다.** 사장님이 플레이하시고 바로 짚으셨다 —
     * 「STEP 1 을 적으면 STEP 2 가 열려야지, 왜 나머지까지 다 열리느냐」.
     *
     * 그 전에 갈라졌던 것과 헷갈리기 쉬운데 **다른 이야기다.**
     *   그때 — 지금 할 것을 다 적었는데도 **하나도** 안 열렸다 (뒤엣것을 보고 잠갔으므로)
     *   지금 — 다 적으면 **정확히 한 칸**이 열린다
     * 물음이 「어디까지 열어 줄 것인가」로 바뀐 것이지, 옛 규칙으로 돌아간 것이 아니다.
     *
     * `openableUpTo` = 지금 열려 있어도 되는 마지막 자리.
     *   지금 STEP 을 아직 안 적었으면 거기까지, 다 적었으면 한 칸 더.
     *   다 끝냈으면(`nowIdx < 0`) 전부.
     */
    const nowUnwritten = nowIdx >= 0 && !groupNotesWritten(st, groups[nowIdx], level);
    const openableUpTo = nowIdx < 0 ? groups.length : (nowUnwritten ? nowIdx : nowIdx + 1);
    // 잠긴 STEP 에게 「무엇을 적어야 열리는지」 알려 줄 STEP.
    const blockingIdx = Math.min(openableUpTo, groups.length - 1);
    const blockingId = groups[blockingIdx].id;
    /*
     * **적으라는 칸이 이미 적혀 있으면 그 말은 거짓말이다.**
     * 지금 STEP 을 적으면 다음 STEP 「하나만」 열린다. 그 다음 STEP 의 기록까지 적어도
     * 지금 STEP 을 **실험대에서** 마치기 전에는 그 뒤가 안 열리는데, 안내는 여전히
     * 「STEP n 의 관찰 기록을 적으면 열립니다」였다 — 적었는데도. 플레이테스트에서 실험대를
     * 먼저 다 하고 온 학생이 여기서 막혔다 (PLAYTEST-REVIEW #3). 그때는 **무엇을 실험대에서
     * 해야 하는지**를 말한다.
     */
    const blockingWritten = groupNotesWritten(st, groups[blockingIdx], level);
    const lockedWhy = blockingWritten && nowIdx >= 0
      ? N.stepLockedNeedBench(groups[nowIdx].id)
      : N.stepLockedWhy(blockingId);
    const stepsHtml = groups.map((group, gi) => {
      const isDone = groupsDone[gi];
      const isNow = gi === nowIdx;
      const state = isDone ? 'done' : (isNow ? 'now' : 'later');
      const locked = gi > openableUpTo && !everOpened.has(group.id);
      // 손으로 여닫은 것이 있으면 그것이 이긴다. 없으면 지금 할 STEP 만 펼친다.
      // 잠긴 STEP 은 펼치지 않는다.
      const open = locked ? false
        : (manualOpen.has(group.id) ? manualOpen.get(group.id) : isNow);
      /*
       * **이 줄과 누르는 쪽의 `if (willOpen)` 은 서로 다른 경우를 지킨다. 하나가 남았다고
       * 다른 하나를 지우면 안 된다.**
       *   누르는 쪽 — 학생이 **손으로 편** STEP
       *   여기       — 「지금 할 차례」라 **저절로 열린** STEP. 학생은 누른 적이 없다
       *
       * 이 실험에서 저절로 열린 것이 잠길 자리가 되는 길은 **새 모세관**이다. 잘못 채운
       * 관을 폐기물 통에 대면 `NEW_CAPILLARY` 가 기둥·밀봉·회전판을 되돌리므로 지금 자리가
       * 뒤로 밀린다. 이 줄이 없으면 보고 있던 STEP 이 그때 잠긴다 — 재서 확인했다.
       * (germination 세션이 두 줄이 다른 것을 지킨다는 것을 짚었다)
       */
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
        // 적을 칸이 없는 단계(준비 동작)는 **하기만 하면 끝난 것**이다. 적었는지 묻지 않는다 —
        // 물으면 영영 안 채워지는 칸을 기다리느라 짚어 주는 손가락이 거기서 멈춘다.
        const written = group.steps.map((step, i) =>
          !step.note || Boolean(st.session.notes[substepId(group, i)]));
        // 앞에서부터 **아직 끝나지 않은 첫 칸**을 짚는다. "했는데 안 적은 칸" 을 먼저 찾으면
        // 아직 손도 안 댄 첫 칸을 건너뛰고 뒤엣것을 짚는 일이 생긴다.
        const nextIdx = group.steps.findIndex((_, i) => !(done[i] && written[i]));

        const items = group.steps.map((step, i) => {
          const id = substepId(group, i);
          // 하이라이트는 1단계에서만. 2단계는 목록만 보여 준다 (docs/06 표).
          const hi = level === 1 && i === nextIdx ? ' substep--next' : '';
          const hint = level === 1 && i === nextIdx
            /*
             * **실험대로 보내면서 실험대를 잠가 두지 않는다.**
             * 4쪽에 막 들어오면 아직 이 쪽을 안 읽은 상태라 실험대가 잠겨 있다. 그런데
             * 「실험대에서 먼저 해 보세요」라고만 해서, 학생은 물건을 눌러 보고 아무 일이
             * 없는 것을 겪는다 — 여는 단추는 이 쪽 한참 아래(화면 720 에서 y 1134)에 있다.
             * 잠긴 동안에는 **무엇을 눌러야 열리는지**를 대신 적는다.
             */
            ? `<p class="substep-hint">${done[i] ? N.stepWriteNow
              : (benchLocked(st) ? N.stepBenchLocked : N.stepNotYet)}</p>` : '';
          // **적을 칸은 `note` 가 붙은 자리에만 낸다** — 조작의 결과가 화면에 나타나는 자리다.
          // 열세 칸 전부에 내면 노트가 관찰 기록이 아니라 받아쓰기가 되고,
          // 채워지지 않은 칸은 보고서에서 「안 한 일」로 읽힌다.
          const noteBox = step.note ? `
            <label class="notes-label" for="note-${id}">${N.notesLabel}</label>
            <textarea data-note="${id}" id="note-${id}"
              placeholder="${escapeHtml(notePlaceholder(level, step))}">${escapeHtml(st.session.notes[id] ?? '')}</textarea>` : '';
          return `
            <li class="substep${hi}" data-done="${done[i]}" data-has-note="${Boolean(step.note)}">
              <div class="substep-title">
                <span class="substep-mark" aria-hidden="true">${done[i] ? '✓' : '·'}</span>
                ${step.label}
                <span class="substep-state">${done[i] ? N.stepDoneMark : N.stepTodoMark}</span>
              </div>
              ${hint}${noteBox}
            </li>`;
        }).join('');
        body = `<ul class="substep-list">${items}</ul>`;
      }

      /*
       * 잠긴 STEP 은 `<details>` 가 아니라 다른 껍데기로 그린다 — 열리는 척하다가 안 열리는
       * 것이 가장 나쁘다. 제목은 그대로 남긴다 (몇 칸짜리 여정인지는 계속 보여야 한다).
       * **왜 안 열리는지는 카드 안에** 적는다 (docs/09 §4) — 말 없는 회색 제목은 고장으로 읽힌다.
       */
      if (locked) {
        return `
        <div class="note-step note-step--locked" data-step-group="${group.id}"
          data-state="locked" data-done="false" data-locked="true" data-locked-by="${blockingId}">
          <div class="step-summary">
            <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
            <span class="step-open-hint">${N.stepLockedHint}</span>
          </div>
          <p class="step-locked-why">${lockedWhy}</p>
        </div>`;
      }

      // 접힌 STEP 에도 **「눌러서 열립니다」**를 적어 둔다. 말하지 않으면 잠긴 것으로 읽힌다.
      const openHint = isNow ? ''
        : `<span class="step-open-hint">${isDone ? N.stepReopenHint : N.stepPeekHint}</span>`;

      return `
        <details class="note-step" data-step-group="${group.id}"
          data-state="${state}" data-done="${isDone}" data-locked="${locked}"${open ? ' open' : ''}>
          <summary class="step-summary">
            <!-- 제목은 접혀도 h3 로 남는다. 다른 쪽이 전부 h3 라, 여기만 span 이면
                 제목만 훑어 내려가는 학생에게 4단계가 통째로 사라진다. -->
            <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
            ${isDone ? '<span class="step-done-mark">✓</span>' : ''}
            ${isNow ? `<span class="step-now-badge">${N.stepNowBadge}</span>` : ''}
            ${openHint}
          </summary>
          <div class="step-body">
            ${body}
            ${group.id === QUESTION_A_STEP ? questionA(st) : ''}
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
   * 질문 ⓐ — 끈을 당겨 본 **직후**에 묻는다. **순서가 곧 논증이다** (`docs/06`).
   *
   * 흔들리는 것을 눈으로 본 직후여야 답이 나온다. 6단계까지 미뤄서 물으면 학생은
   * 그때 본 것을 기억으로 더듬어야 하고, "왜 균형을 맞추는가" 가 눈앞의 관찰이 아니라
   * 지식 회상 문제가 된다.
   *
   * 여기서 받은 답은 `notes['q.a']` 한 곳에 저장되고, 6단계에서는 같은 값을 이어 쓴다 —
   * 다시 묻지 않는다.
   *
   * ── 왜 STEP 번호를 여기 상수로 두는가 ────────────────────────────
   * **STEP 4(밀봉)에 붙어 있었다.** 「방금 회전판을 돌려 보았습니다」 라고 묻는 물음이
   * 돌려 보기도 전에 나왔고, 6단계는 「STEP 6 을 마치면 답이 옮겨집니다」 라고 적어
   * 화면끼리 서로 다른 말을 하고 있었다.
   *
   * STEP 이 한꺼번에 펼쳐져 있을 때는 눈에 안 띄었다 — 어차피 아래로 스크롤하면
   * 보였으니까. **한 번에 한 STEP 이 되자 진짜 버그가 됐다**: 밀봉이 끝나는 순간
   * 그 STEP 이 접히면서 물음이 통째로 사라지고, 학생은 회전판을 돌리고 나서
   * 그것을 다시는 못 만난다. `tests/ui.contract.test.js` 가 못 박는다.
   */
  const QUESTION_A_STEP = '6';

  function questionA(st) {
    const val = st.session.notes['q.a'] ?? '';
    const g = val.trim() ? gradeQuestion('qa', val) : null;
    return `
      <div class="grade-block question-a">
        <h4>${N.questionA.heading}</h4>
        <p class="stage-text">${N.questionA.prompt}</p>
        <label class="notes-label" for="note-qa-step6">${N.questionA.label}</label>
        <textarea data-note="q.a" id="note-qa-step6">${escapeHtml(val)}</textarea>
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
      const key = `hct.${at}`;
      const domId = `note-hct-${at}`; // id 에는 '.' 을 안 쓴다 — CSS 선택자에서 클래스로 오해된다
      const saved = st.session.notes[key] ?? '';
      const check = saved !== '' ? gradeHematocrit(saved, c.packedOfColumn) : null;
      const layerName = c.clotted ? UI.layers.serum : UI.layers.plasma;
      return `
        <div class="capture-card">
          <div class="capture-head">
            <h3>${i + 1}번째 · ${escapeHtml(UI.tubeKindsShort[c.kind] ?? '')}</h3>
            <button type="button" class="capture-del" data-del="${at}"
              aria-label="${N.captureDeleteLabel(i + 1)}">${N.captureDelete}</button>
          </div>
          <!-- 기록한 모세관을 그대로 되살린다. 캡처가 tubeParams 한 벌을 통째로 담고 있으므로
               그때 본 것과 같은 그림이 나온다. idPrefix 를 카드마다 달리 주지 않으면
               모든 카드가 첫 카드의 그라데이션을 쓴다 — 에러 없이 조용히 틀린다.
               번호(at)로 붙인다 — 지우고 나서도 남은 카드의 접두사가 바뀌지 않는다. -->
          <div class="capture-tube">${renderTube(c, { idPrefix: `cap${at}-`, labels: true })}</div>
          <dl class="capture-readout">
            <!-- **헤마토크릿을 여기 적지 않는다.** 아래 칸이 묻는 것이 그것이다.
                 채점하는 답을 그 칸 바로 위에 적어 두면 잴 이유가 없어진다. -->
            <div><dt>${N.capturePulls(c.pulls ?? 0)}</dt><dd>${escapeHtml(layerName)}</dd></div>
            <div><dt>${UI.observability.label}</dt><dd>${observability(c).score}</dd></div>
          </dl>
          <label class="notes-label" for="${domId}">${N.hctInput}</label>
          <input type="text" inputmode="numeric" placeholder="${N.hctPlaceholder}"
            data-note="${key}" id="${domId}" value="${escapeHtml(saved)}">
          <p class="stage-empty">${N.hctHelp}</p>
          ${check ? `<p class="grade-line" data-grade="${check.status}">${check.message ?? ''}</p>` : ''}
        </div>`;
    }).join('')}</div>`;
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
    const rows = N.predictItems.map(({ id, label }) => `
      <div class="predict-compare-row">
        <h4>${emph(label)}</h4>
        <dl class="compare-pair">
          <dt>${N.predictRecapLabel}</dt>
          <dd>${escapeHtml(st.session.notes[`predict.${id}`] || N.predictNone)}</dd>
          <dt>${N.actualLabel}</dt>
          <dd>${actualSummary(st, id)}</dd>
        </dl>
      </div>`).join('');
    return `<section><h3>${N.predictHeading}</h3>${rows}</section>`;
  }

  /**
   * 잘 안 나온 기록들. **가장 나중 것 하나만** 묻는다 —
   * 여러 번 실패한 학생에게 실패 목록을 나열하면 그건 성찰이 아니라 성적표다.
   */
  function blurryCaptures(st) {
    const bad = st.session.captures.filter((c) => observability(c).score < LOW_OBSERVABILITY);
    return bad.length ? [bad[bad.length - 1]] : [];
  }

  function renderReflect(st) {
    const blurry = blurryCaptures(st);
    if (blurry.length === 0) return '';
    const items = blurry.map((c) => {
      const key = `reflect.${c.at ?? 0}`;
      const chosen = st.session.notes[key];
      const options = Object.keys(UI.observability.worst).map((k) => `
        <button type="button" class="reflect-opt${chosen === k ? ' reflect-opt--chosen' : ''}"
          data-reflect="${key}" data-value="${k}">${UI.observability.worst[k]}</button>`).join('');
      const retry = chosen
        ? `<button type="button" class="reflect-retry" data-retry="spin">${N.reflectRetry}</button>`
        : '';
      return `
        <div class="reflect-item" data-at="${c.at ?? 0}">
          <p>${N.reflectQuestion}</p>
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
  /* 7 자기 평가 — 리커트와 느낀 점. **안전 수칙을 세지 않는다** (2쪽 안내로만 둔다). */
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

    // 이 칸은 학생이 채우는 곳이 아니다. 실험하는 동안 지켜본 것을 그대로 보여 준다.
    // 지킨 것도 함께 적는다 — 빈 목록에 "위반 없음" 한 줄만 뜨면 무엇을 보고 하는 말인지
    // 알 수 없고, 아무것도 안 해도 늘 그렇게 뜨는 줄 알게 된다.
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
    // STEP 을 손으로 여닫은 것을 기억한다.
    //
    // **`toggle` 이 아니라 summary 의 `click` 을 듣는다.** `<details open>` 을 `innerHTML`
    // 로 꽂으면 브라우저가 **삽입만으로 `toggle` 을 한 번 쏜다** — 그러면 「지금 할 차례라서
    // 펼쳐진 것」이 「학생이 손으로 펼친 것」으로 기록되고, 그 STEP 은 끝난 뒤에도
    // **영영 접히지 않는다.** `click` 은 사람이 눌렀을 때만 온다
    // (summary 는 포커스를 받으므로 Enter·Space 도 click 으로 온다 — 키보드도 같이 산다).
    panelEl.querySelectorAll('details[data-step-group] > summary').forEach((el) => {
      el.addEventListener('click', () => {
        // 잠긴 STEP 은 <details> 가 아니라 여기 안 걸린다 — 카드 안에 왜 잠겼는지 적혀 있다.
        // 기본 동작이 아직 일어나기 전이라 `open` 은 누르기 **전**의 값이다.
        const id = el.parentElement.dataset.stepGroup;
        const willOpen = !el.parentElement.open;
        manualOpen.set(id, willOpen);

        /*
         * **여기서도 담아야 한다.** 누를 때는 다시 그리지 않는다 — `<details>` 가 알아서 열린다.
         * 그리는 쪽(`if (open) everOpened.add`)에만 두면 이렇게 샌다:
         *   손으로 STEP 7 을 펼침 → 아직 안 담김 → 학생이 앞 기록을 지움 → 다시 그림 →
         *   잠금을 **먼저** 판정해 잠겼으면 `open` 이 false 라 담는 데까지 못 간다 →
         *   **펼쳐 놓았던 STEP 이 눈앞에서 닫히고 잠긴다.** 이 규칙이 막으려던 바로 그 모양이다.
         *
         * 직접 재 봤다 — 이 줄이 없으면 「펼친 뒤 기록을 지우기」 로 STEP 7 이 잠긴다
         * (0·250·1200 ms 어느 간격에서도 같았다). catalase·micrometer 세션이 정본에서 잡았다.
         */
        if (willOpen) everOpened.add(id);
      });
    });
    panelEl.querySelectorAll('[data-note]').forEach((el) => {
      el.addEventListener('change', () => {
        // **저장은 곧바로, 다시 그리기는 나중에.** 상태는 바로 맞아야 한다 —
        // 「읽었습니다」 관문이 `store.getState()` 를 보기 때문에, 마지막 칸에 적고
        // 곧장 눌러도 그 글이 이미 들어가 있어야 한다.
        // 라디오·선택은 미룰 것이 없다 — 고른 순간이 곧 끝난 순간이다.
        savingNote = stillTyping(el);
        store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });
        savingNote = false;
        setTimeout(flushRender, 0);   // 포커스가 자리잡은 뒤에 그린다
      });
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
      btn.addEventListener('click', () => onOpenZoom(btn.dataset.retry, btn));
    });
    panelEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('DELETE_CAPTURE', { at: Number(btn.dataset.del) });
      });
    });
    panelEl.querySelector('#mark-read')?.addEventListener('click', () => {
      // 아직 못 누르는 쪽이면 **이유로 데려가고** 넘기지 않는다.
      // 아무 일도 안 일어나면 학생은 화면이 고장 난 줄 안다.
      if (readBlockedWhy(store.getState(), activeStage)) {
        panelEl.querySelector('#read-blocked')?.focus();
        return;
      }
      // **표시할 쪽을 먼저 붙잡아 둔다** — 아래에서 activeStage 를 옮기기 때문이다.
      const from = activeStage;
      const to = nextReadStage(from);
      // 눌렀으면 다음 쪽으로 데려다준다. dispatch 가 render 를 부르므로 먼저 옮겨 둔다.
      if (to) activeStage = to;
      store.dispatch('MARK_READ', { stage: from });
    });
  }

  /**
   * 「읽었습니다」 — 실험대의 자물쇠를 여는 단추.
   *
   * 1~4 쪽 아래에만 붙는다. 5~7 쪽은 결과가 있어야 채울 수 있어 "읽는" 쪽이 아니다.
   * 다 읽었는지를 기계가 재는 방법은 없다 — 스크롤 끝까지 내렸는지는 손가락이 움직였다는
   * 증거일 뿐이다. 그래서 학생에게 묻는다. 누르는 것 자체가 약속이 된다.
   */
  /**
   * 「이 쪽을 읽었습니다」 를 누른 뒤 갈 곳.
   *
   * 누르고도 그 자리에 남으면 학생이 탭을 손으로 찾아 눌러야 한다 — 읽는 순서가
   * 정해져 있는데 그 순서를 학생에게 다시 시키는 셈이다. 눌렀으면 데려다준다.
   *
   * **마지막 읽기 쪽(4쪽)에서는 넘기지 않는다.** 5쪽(결과)은 실험을 하고 와야 채우는
   * 곳이라 지금 데려가면 빈 표만 보여 주게 되고, 4쪽은 **실험하는 내내 보면서 따라가는
   * 쪽**이다. 대신 그 순간 실험대가 열리므로 「실험대가 열렸습니다」 가 그 자리에 뜬다 —
   * 다음으로 갈 곳은 다른 탭이 아니라 실험대다.
   */
  function nextReadStage(stage) {
    const required = UI.bench.lock.required;
    const at = required.indexOf(stage);
    return at >= 0 && at < required.length - 1 ? required[at + 1] : null;
  }

  /**
   * 이 쪽의 「읽었습니다」 를 누를 수 있는가. 못 누르면 **그 이유**를 돌려준다.
   *
   * 예상 쪽은 **예상을 고른 뒤에만** 넘어간다. 예상을 안 쓰고 결과를 먼저 보면 그 뒤로는
   * 예상을 쓸 수가 없다 — 이미 답을 본 뒤라 그건 예상이 아니다.
   * **채점이 아니다.** 무엇을 골랐는지는 보지 않는다.
   */
  function readBlockedWhy(st, stage) {
    // 3단계는 보기 단추가 없다 — 직접 쓴다. 화면에 없는 조작을 가리키면 안 된다.
    if (stage === '3' && !predictDone(st)) return N.readNeedPredict(st.session.level >= 3);
    return null;
  }

  function readFooter(st) {
    const required = UI.bench.lock.required;
    if (!required.includes(activeStage)) return '';
    const read = st.session.readStages ?? [];
    const left = required.filter((id) => !read.includes(id));
    if (read.includes(activeStage)) {
      return `<p class="read-mark" data-done="true">${N.readDone}${
        left.length === 0 ? ` ${N.readAllDone}` : ''}</p>`;
    }
    // 못 누를 때도 **단추는 살려 둔다.** 죽은 단추는 포커스를 못 받아, 키보드로 오는
    // 학생은 왜 안 넘어가는지 들을 길조차 없다. `aria-disabled` 로 「지금은 안 된다」 를
    // 알리고 이유를 옆에 적는다 — 눌러 보면 그 이유로 포커스가 옮겨 가 읽힌다.
    const why = readBlockedWhy(st, activeStage);
    return `
      <div class="read-mark">
        <p>${N.readLeadIn}</p>
        <button type="button" id="mark-read" class="read-confirm"
          aria-disabled="${why ? 'true' : 'false'}"
          aria-describedby="${why ? 'read-blocked' : ''}">${N.readConfirm}</button>
        ${why ? `<p class="read-blocked" id="read-blocked" role="status" tabindex="-1">${why}</p>` : ''}
      </div>`;
  }

  /**
   * **치고 있던 글을 다시 그리기 너머로 나른다.**
   *
   * 이 패널은 상태가 바뀔 때마다 `innerHTML` 로 통째로 다시 그려진다. 그런데 이 앱은
   * `change` 에서만 저장하므로, **아직 칸을 떠나지 않은 글은 상태에 없다** — 다시 그리는
   * 순간 치고 있던 `<textarea>` 가 통째로 갈려 나가고 그 글도 함께 사라진다.
   * 포커스는 `<body>` 로 떨어져서, 학생은 **아무 데도 안 들어가는 글자를 계속 친다.**
   *
   * 재어 보니 스물여섯 자를 사람 속도(90ms/자)로 치는 동안 **세 자만 남았다.**
   * 그 세 자는 갈려 나갈 때 blur 가 나면서 `change` 로 저장된 **문장 앞토막**이라,
   * 종이에는 빈칸이 아니라 「층이 」 같은 토막이 실린다 — 학생 눈에는 자기가 적은 글이고
   * 선생님 눈에는 하다 만 글이다. **빈칸보다 나쁘다.**
   *
   * 돌아가는 중(회전이 잦아드는 동안 TICK 이 계속 상태를 바꾼다)에는 **한 자도 안 남았다.**
   * 멈춘 채로도 났다 — 「끈을 당기는 동안만」이 아니다.
   *
   * 저장을 `input` 으로 옮기지 않는 것은 그러면 되돌리기 기록이 글자마다 쌓이기 때문이다.
   * 여기서는 **다시 그린 뒤 그 칸에 값과 커서를 도로 넣어 준다.**
   * (germination 세션이 자기 저장소에서 찾아 허브가 넘겨 주었다)
   */
  function keepTyping() {
    const el = document.activeElement;
    if (!el || !panelEl.contains(el) || !el.dataset?.note) return null;
    return {
      key: el.dataset.note,
      value: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    };
  }

  function restoreTyping(keep) {
    if (!keep) return;
    const el = panelEl.querySelector(`[data-note="${keep.key}"]`);
    if (!el) return;
    // 치는 사이에 그 STEP 이 끝나 접혔을 수 있다. **적고 있던 칸은 열어 준다** —
    // 접힌 칸에 포커스를 주면 아무 데도 안 들어가는 글자를 계속 치게 된다.
    el.closest('details[data-step-group]')?.setAttribute('open', '');
    el.value = keep.value;
    el.focus();
    if (typeof el.setSelectionRange === 'function' && keep.start != null) {
      try { el.setSelectionRange(keep.start, keep.end); } catch { /* range 를 안 받는 칸도 있다 */ }
    }
  }

  /**
   * **적는 동안에는 다시 그리지 않는다.**
   *
   * 앞 칸에서 옮겨 갈 때 그 칸의 `change` 가 판을 통째로 다시 그린다. 그러면 방금 클릭해
   * 들어간 칸이 **갈려 나가고**, 거기 친 글은 새 칸에 없다. 재 보니 예상 세 칸 가운데
   * 첫 칸만 남았다 —
   *     predict.split   화면 ✓ 상태 ✓
   *     predict.outer   화면 ✗ 상태 ✗     ← 통째로 사라짐
   *     predict.balance 화면 ✓ 상태 ✗     ← 화면엔 있는데 저장이 안 됨
   * 예상 셋을 다 채워야 넘어가는 자리라, 학생은 셋을 다 적고도 막힌다.
   *
   * `keepTyping`/`restoreTyping` 은 **치던 칸 하나**만 되살린다. 여기서 잃는 것은
   * 「막 들어간 칸」이라 그것으로는 안 잡힌다. 아예 **미뤘다가 손을 뗄 때** 그린다.
   * (허브가 정본에서 재현해 넘겨 주었고, 여기서도 같았다)
   */
  let pendingRender = false;
  let savingNote = false;

  /**
   * **`activeElement` 로는 못 잡는다.** 그렇게 두었다가 한 번 헛디뎠다 — 직접 찍어 봤다:
   *
   *     focusin  predict.split
   *     change predict.split → activeElement=BODY     ← 포커스가 아직 BODY 다
   *     focusin  predict.balance                      ← outer 를 건너뛰고 balance 로 갔다
   *
   * 칸에서 칸으로 옮겨 갈 때 `change` 는 **포커스가 body 인 동안** 온다. 그래서 「지금
   * 칸에 있는가」로 물으면 늘 아니라고 답하고, 판을 그대로 다시 그린다. 그리는 순간
   * 누르던 칸이 사라지므로 **`focusout` 조차 안 온다**(위 기록에 없다) — 미뤄 둔 것을
   * 풀어 줄 자리도 함께 사라진다. 그리고 클릭은 새로 그려진 판의 **엉뚱한 칸**에 앉는다.
   *
   * 그래서 묻는 자리를 옮긴다 — **칸이 스스로 「내가 저장시켰다」고 말한다.**
   */
  function scheduleRender() {
    if (savingNote) { pendingRender = true; return; }
    render();
  }

  /** 미뤄 둔 것을 푼다. 아직 다른 칸에 손이 가 있으면 그 칸이 끝낼 때까지 더 기다린다. */
  /**
   * **치고 있는 칸만 미룬다.** 라디오·선택은 미루면 안 된다.
   *
   * 처음에는 `[data-note]` 이면 무조건 미뤘다. 그런데 자기 평가는 **라디오**이고,
   * 고르고 나면 그 라디오가 포커스를 쥔다 — 그러면 여기서 늘 일찍 돌아가 **판이 영영
   * 다시 안 그려진다.** 다섯을 다 골라도 「남은 것」이 안 줄고 **보고서 단추가 안 나온다.**
   * 배포본 연기 검사가 그 자리에서 물었다.
   *
   * 글을 치는 중이라 미루는 것이지 **고르는 것은 이미 끝난 일**이다. 칸의 종류로 가른다.
   */
  const stillTyping = (el) => Boolean(el) && panelEl.contains(el)
    && (el.tagName === 'TEXTAREA'
      || (el.tagName === 'INPUT' && ['text', 'number', 'search', ''].includes(el.type)));

  function flushRender() {
    if (!pendingRender) return;
    if (stillTyping(document.activeElement)) return;
    pendingRender = false;
    render();
  }

  // 칸 밖으로 나가면 그때 그린다. 칸에서 칸으로 옮길 때는 위에서 걸러진다.
  root.addEventListener('focusout', () => setTimeout(flushRender, 0));

  function render() {
    pendingRender = false;
    const st = store.getState();
    // 다시 그리기 **전에** 치고 있던 것을 챙긴다.
    const keep = keepTyping();
    tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.stage === activeStage));
      // 끝낸 쪽에는 표시를 남긴다. 어디가 남았는지 탭만 보고 알 수 있어야 한다 —
      // 앞 네 쪽은 실험대를 여는 조건이고, 뒤 세 쪽은 보고서를 내는 조건이다.
      tab.dataset.read = String(stageDone(st, tab.dataset.stage));
    });
    panelEl.innerHTML = STAGE_RENDERERS[activeStage](st) + readFooter(st);
    bindPanel();
    restoreTyping(keep);
    renderReportSlot(st);
  }

  store.subscribe(scheduleRender);
  render();
}
