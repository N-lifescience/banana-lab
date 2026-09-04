/**
 * 탐구 노트 — 7단계 패널.
 *
 * `docs/06-lab-notebook.md` 의 7단계(문제 인식~자기 평가)를 최상위 탭으로 두고,
 * 손으로 하는 절차는 4단계 「탐구 과정」 안의 STEP 으로 내린다.
 *
 * **7단계 구조를 조작 절차로 납작하게 만들지 않는다.** 탐구 노트는 「다음에 무엇을 누를까」가
 * 아니라 「무엇을 왜 하려는가」다. 바나나랩에서 납작하게 만들었다가 되돌렸다.
 *
 * 뼈대(class 이름)는 정본 banana 와 같다 (docs/09-uniformity.md §4) — `note-tabs`·`note-panel`·
 * `materials-table`·`note-step`/`step-summary`/`step-body`·`substep-list`/`substep`·`likert-row`/
 * `likert-cell`·`read-mark`/`read-confirm`. 화면 CSS 는 `packages/lab-kit/style/shell.css` 하나다.
 *
 * 상태는 전부 `store.dispatch('SAVE_NOTE', …)` 를 거쳐 `reduce()` 로 간다 —
 * 이 파일은 `session.notes` 를 직접 대입하지 않는다.
 */

import { MODES, VARIABLE_KEY, offDesign } from '../sim/state.js';

import { ASSETS } from '../assets/index.js';
import { renderGraph, graphNotes } from '../render/graph.js';
import { designSentence } from './design.js';
import { gradeQuestion, STATUS } from './grading.js';
import { stepDone, groupDone, resultsDone, distinctConditions } from '../sim/progress.js';
import { UI } from './strings.js';

const N = UI.notebook;

/**
 * 화면에 넣기 전에 막는다.
 *
 * **따옴표까지 막는다.** 학생이 쓴 글은 본문뿐 아니라 속성 안에도 들어간다.
 * `&<>` 만 막으면 큰따옴표 하나로 속성을 빠져나가 새 속성을 붙일 수 있다.
 * 자기 화면에만 영향을 주는 자리이지만, 그 글은 **보고서로 인쇄돼 남에게 건네진다.**
 */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** `**굵게**` 만 허용한다. 문구에 강조를 넣으려고 HTML 을 통째로 열어 두지 않는다. */
const emph = (text) => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

/**
 * 관찰 기록 칸에 흐리게 띄울 예시 문구.
 *
 * **1단계는 세부 단계마다 다른 예시를 띄운다.** 여러 칸에 같은 문장을 띄우면
 * 무엇을 적으라는 건지 알려 주지 못하고, 그 자리에서 관찰한 것이 아니라 앞 칸을 베끼게 만든다.
 * 3단계는 비운다 — 무엇을 적을지 스스로 정하는 것도 이 실험의 일부다.
 */
function notePlaceholder(level, step) {
  if (level === 1) return step?.eg ?? '';
  return N.notePlaceholders[level] ?? '';
}

/**
 * 이 STEP 의 관찰 기록 칸이 **다 채워졌는가.** 칸이 없는 STEP 은 채울 것이 없으니 참이다.
 * (`note: true` 인 세부 단계에만 칸이 있다 — `UI.protocol` 머리말)
 */
function groupNotesFilled(st, group) {
  return group.steps.every((step, i) =>
    !step.note || String(st.session.notes[substepId(group, i)] ?? '').trim().length > 0);
}

/**
 * 4단계를 그릴 때 STEP 마다 「어떤 상태이고 펼쳐져 있는가」.
 *
 * **DOM 을 모르는 순수 함수다.** 어느 STEP 이 펼쳐지는가는 이 실험에서 가장 조용히 깨지는
 * 자리라(아래 `manualOpen` 주석 참조) 브라우저 없이 검사할 수 있어야 한다.
 *
 * 「지금 STEP」은 `groupDone` 이 거짓인 **첫 STEP** 이다. 상태에서 나오므로 따로 저장하지
 * 않는다 — 실험대에서 한 일이 그대로 노트를 넘긴다.
 *
 * `manualOpen` 은 학생이 **손으로** 여닫은 것이고, 있으면 그것이 이긴다.
 * 순서를 건너뛰어 실험한 학생은 앞으로 올 STEP 을 열어 놓고 거기에 적으면 된다.
 */
export function stepPanels(st, manualOpen = new Map(), opened = new Set()) {
  const dones = UI.protocol.map((g) => groupDone(st, g.id));
  const nowIdx = dones.indexOf(false);          // 다 끝났으면 -1
  // 지금 STEP 의 관찰 기록이 아직 비어 있는가. 비었으면 **아직 안 가 본 다음 STEP** 이 잠긴다.
  /*
   * **한 칸씩만 열린다.**
   *
   * 예전에는 지금 STEP 의 기록을 적으면 **뒤가 통째로** 풀렸다. 선생님이 플레이하시다
   * 짚으셨다 — 「step1 의 관찰 기록을 작성하면 step2 가 열리도록 해야지. 왜 나머지
   * step 들까지도 다 열려.」 한꺼번에 열리면 「한 번에 한 STEP」이라고 해 놓고
   * 실제로는 다시 목록이 된다.
   *
   * 그래서 **어디까지 열 수 있는지**를 한 칸으로 셈한다.
   *   지금 STEP 의 기록이 비었으면 → 지금 STEP 까지 (다음은 아직)
   *   다 적었으면                → 그 **다음 한 칸**까지
   *   다 끝났으면                → 전부
   */
  const written = nowIdx >= 0 && groupNotesFilled(st, UI.protocol[nowIdx]);
  const openableUpTo = nowIdx < 0 ? UI.protocol.length - 1 : (written ? nowIdx + 1 : nowIdx);
  return UI.protocol.map((g, i) => {
    const state = dones[i] ? 'done' : (i === nowIdx ? 'now' : 'later');
    // 한 번이라도 열어 본 STEP 은 계속 열린다 — 되돌아가 읽는 것까지 막지 않는다.
    const seen = opened.has(g.id) || manualOpen.has(g.id);
    const locked = i > openableUpTo && !seen;
    return {
      id: g.id,
      state,
      locked,
      open: locked ? false : (manualOpen.has(g.id) ? manualOpen.get(g.id) : state === 'now'),
    };
  });
}

/**
 * 아직 안 한 첫 세부 단계의 키. **1단계에서만 쓴다.**
 *
 * 「다음에 할 일을 짚어 준다」가 1단계의 약속이다 (`UI.start.levels`).
 * 짚어 주는 것뿐이고 다른 칸을 막지 않는다 — 막으면 설명을 줄인 게 아니라 길을 막은 것이다.
 */
function nextUndone(st) {
  for (const group of UI.protocol) {
    for (let i = 0; i < group.steps.length; i++) {
      if (!stepDone(st, group.id, i)) return substepId(group, i);
    }
  }
  return null;
}

/** STEP 안에서 i번째 세부 단계의 저장 키. `'3b'` 같은 형태. */
function substepId(group, i) {
  return `${group.id}${String.fromCharCode(97 + i)}`;
}

/**
 * 절차 기록 키인가. **그룹 개수를 세지 않는다** — `UI.protocol` 에 그 id 가 실제로 있는지로 본다.
 * 개수를 박아 두면 그룹을 하나 늘렸을 때 그 기록이 복습과 보고서에서 **조용히 사라진다.**
 */
export function isStepNoteKey(key) {
  const m = /^(\d+)([a-z])?$/.exec(String(key));
  return Boolean(m) && UI.protocol.some((g) => g.id === m[1]);
}

/** notes 키 `'3b'` 를 「STEP 3 · pH 맞추기」 같은 사람이 읽는 문장으로. */
export function stepNoteLabel(key) {
  const m = /^(\d+)([a-z])?$/.exec(String(key));
  if (!m) return key;
  const group = UI.protocol.find((g) => g.id === m[1]);
  if (!group) return key;
  const title = m[2] ? group.steps[m[2].charCodeAt(0) - 97]?.label : group.title;
  return `STEP ${group.id} · ${title ?? group.title}`;
}

/** 모둠으로 하는 세션인가. 혼자라면 토의·모둠 비교 문항을 아예 내지 않는다. */
export function isGroup(st) {
  return (st.session.mode ?? MODES.GROUP) === MODES.GROUP;
}

/** 시행 하나를 사람이 읽는 한 줄로. 보고서도 같은 함수를 쓴다 — 화면과 종이가 달라지면 안 된다. */
export function trialSummary(st, trial) {
  const key = VARIABLE_KEY[trial.independent];
  const changed = key ? `${UI.conditions[key]} ${UI.units[key](trial.conditions[key])}` : N.trialNoVariable;
  const result = UI.units.gasMl(trial.gasMl);
  // 저장된 판정이 아니라 **지금 설계**로 다시 잰다 (`render/graph.js` 의 classify 주석 참조).
  const wrong = offDesign(st.design, trial.conditions);
  const off = wrong.length
    ? ` · ${N.trialOffDesign(wrong.map((k) => UI.conditions[k]).join(', '))}`
    : '';
  return `${changed} → ${result}${off}`;
}

/**
 * 실험대가 아직 잠겨 있는가. **탐구 노트가 실험대로 보내기 전에 이걸 봐야 한다** —
 * 잠긴 실험대로 보내면 학생은 물건을 눌러도 아무 일이 없는 화면을 만난다.
 */
export const benchLocked = (st) =>
  UI.bench.lock.required.some((id) => !(st.session.readStages ?? []).includes(id));

/** 칸이 채워졌는가. 공백만 있는 것은 안 채운 것이다. */
const hasNote = (st, key) => String(st.session.notes[key] ?? '').trim().length > 0;

/*
 * 쪽마다 「다 했는가」. 탭의 ✓ 와 보고서 단추가 **같은 함수**를 본다.
 * 따로 세면 언젠가 어긋나고, 그때 학생은 탭이 전부 ✓ 인데 보고서가 안 나오는 화면을 본다.
 */
const predictDone = (st) => hasNote(st, 'predict') && hasNote(st, 'predict.why');
const wrapupKeys = (st) => ['qa', 'q2', 'q3', 'q4', 'q5', ...(isGroup(st) ? ['q6'] : [])];
const wrapupDone = (st) => wrapupKeys(st).every((k) => hasNote(st, k));
const selfEvalDone = (st) => N.selfEvalItems.every(({ key }) => hasNote(st, `selfeval.${key}`));

/**
 * 탐구 노트의 한 쪽이 끝났는가 — 탭에 ✓ 를 붙일지 정한다.
 *
 * 1~4 쪽은 **읽었는가**로 본다(실험대를 여는 조건이 그것이다).
 * 5~7 쪽은 **채워졌는가**로 본다. 같은 ✓ 를 쓰지만 뜻은 하나다 — 「이 쪽은 할 일을 마쳤다」.
 */
export function stageDone(st, id) {
  if (UI.bench.lock.required.includes(id)) return (st.session.readStages ?? []).includes(id);
  if (id === '3') return predictDone(st);
  if (id === '5') return resultsDone(st);
  if (id === '6') return wrapupDone(st);
  if (id === '7') return selfEvalDone(st);
  return false;
}

/**
 * 보고서를 낼 수 있는가, 아직 무엇이 남았는가.
 *
 * 「보고서 만들기」를 늘 띄워 두면 첫 화면에서부터 눌러 빈 종이를 뽑는다. 그 종이를 낸
 * 학생은 자기가 무엇을 안 했는지 **종이를 보고서야** 안다.
 * 막는 것이 목적이 아니므로, 감추는 자리에 **무엇이 남았는지**를 대신 적는다.
 */
export function reportReadiness(st) {
  const missing = [];
  if (!predictDone(st)) missing.push(N.reportTodo.predict);
  if (!resultsDone(st)) missing.push(N.reportTodo.captures);
  if (!wrapupDone(st)) missing.push(N.reportTodo.wrapup);
  if (!selfEvalDone(st)) missing.push(N.reportTodo.selfEval);
  return { ready: missing.length === 0, missing };
}

/* ================================================================== */

export function createNotebook(root, store, { onReport = () => {}, onReady = () => {} } = {}) {
  root.innerHTML = `
    <div class="note-head">
      <h1>${N.heading}</h1>
      <div id="report-slot" class="report-slot"></div>
    </div>
    <div id="note-tabs" class="note-tabs" role="tablist"></div>
    <div id="note-panel" class="note-panel"></div>`;

  const tabsEl = root.querySelector('#note-tabs');
  const panelEl = root.querySelector('#note-panel');
  let activeStage = N.stages[0].id;
  let wasReady = false;

  // 탭은 한 번만 만든다. 다시 그릴 때는 `aria-selected` 와 `data-read` 만 바꾼다 —
  // ✓ 는 CSS(`.note-tab[data-read="true"]::after`)가 붙인다.
  for (const stage of N.stages) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'note-tab';
    tab.textContent = `${stage.id}. ${stage.title}`;
    tab.setAttribute('role', 'tab');
    tab.dataset.stage = stage.id;
    tabsEl.appendChild(tab);
  }

  /**
   * 4단계 STEP 을 학생이 **손으로** 여닫은 것. `innerHTML` 로 다시 그려도 남아야
   * 앞으로 올 STEP 을 펼쳐 놓고 실험대에서 손을 댈 수 있다. 키는 그룹 id, 값은 열림 여부.
   */
  const manualOpen = new Map();

  /**
   * **한 번이라도 펼쳐진 적 있는 STEP.** 잠금은 「아직 안 가 본 앞 STEP」에만 걸린다 —
   * 한 번 열어 본 것은 계속 열린다. 되돌아가 읽는 것까지 막으면 노트가 아니라 시험지가 된다.
   */
  const openedSteps = new Set();

  /* ---------------- 조각들 ---------------- */

  const field = (key, value, placeholder, rows = 2) =>
    `<textarea data-note="${key}" id="note-${key.replace(/\./g, '-')}" rows="${rows}"
      placeholder="${escapeHtml(placeholder)}">${escapeHtml(value ?? '')}</textarea>`;

  /** 첨삭 한 줄. **빈칸에는 아무 말도 하지 않는다** — 쓰기도 전에 부족하다는 말부터 들으면 안 쓴다. */
  function gradeLine(id, text) {
    if (!String(text ?? '').trim()) return '';
    const r = gradeQuestion(id, text);
    const status = r.status === STATUS.PASS ? 'pass' : r.status === STATUS.UNAVAILABLE ? 'unavailable' : 'more';
    const msg = r.status === STATUS.PASS ? (r.message ?? N.gradeOk) : r.message;
    return msg ? `<p class="grade-line" id="grade-${id}" data-grade="${status}">${escapeHtml(msg)}</p>` : '';
  }

  function question(st, id, label, rows = 3) {
    const text = st.session.notes[id] ?? '';
    return `<div class="grade-block">
      <label class="notes-label" for="note-${id}">${label}</label>
      ${field(id, text, N.notePlaceholders[3] ?? '', rows)}
      ${gradeLine(id, text)}
    </div>`;
  }

  /* ---------------- 1. 문제 인식 ---------------- */

  function stage1() {
    return `<h2>${N.problem}</h2><p class="stage-text">${N.problemLead}</p>`;
  }

  /* ---------------- 2. 준비물 ---------------- */

  function stage2() {
    const rows = N.materials.map((m) => `
      <tr>
        <td class="mat-fig">${ASSETS[m.asset].render(m.state ?? {})}</td>
        <th scope="row">${m.name}</th>
        <td>${m.role}</td>
      </tr>`).join('');
    /*
     * **안전 안내는 준비물 쪽에 둔다.**
     *
     * 예전에는 7쪽(자기 평가)에 있었다. 그런데 자기 평가는 **실험이 끝난 뒤** 여는 쪽이라,
     * 지켜야 할 것을 다 하고 나서야 읽게 된다. 준비물을 보는 때가 기구를 만지기 직전이므로
     * 여기가 맞는 자리다. 앱이 재지 않는다는 것은 여기서도 그대로 밝힌다.
     */
    return `<h3>${N.materialsHeading}</h3>
      <table class="materials-table">
        <thead><tr><th>${N.matHeadFigure}</th><th>${N.matHeadName}</th><th>${N.matHeadRole}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="safety-note">
        <h3>${N.valuesLabel}</h3>
        <p class="stage-text values-lead">${emph(N.valuesLead)}</p>
        <ul class="values-list">${N.valuesWatched.map((line) => `<li>${emph(line)}</li>`).join('')}</ul>
        <p class="stage-text values-lead">${emph(N.valuesNotChecked)}</p>
      </section>`;
  }

  /* ---------------- 3. 예상 ---------------- */

  function stage3(st) {
    const v = st.design.independent;
    const lead = `<div class="predict-lead">${N.predictLeadIn.map((t) => `<p>${emph(t)}</p>`).join('')}</div>`;
    if (!v) return `${lead}<p class="stage-empty">${N.predictNoVariable}</p>`;

    const spec = N.predictByVariable[v];
    const chosen = st.session.notes.predict ?? '';
    // 1단계는 보기에서 고르고, 2·3단계는 직접 쓴다. **조작은 세 단계가 모두 같다** —
    // 예상을 「할 수 있는가」가 아니라 「얼마나 거들어 주는가」만 다르다.
    const body = st.session.level === 1
      ? `<div class="predict-choices" role="group" aria-label="${N.predictLabel}">
          ${spec.options.map((o) => `<button type="button" class="predict-opt" role="radio"
            data-predict="${escapeHtml(o)}" aria-checked="${chosen === o}">${o}</button>`).join('')}
        </div>`
      : field('predict', chosen, spec.free, 2);

    return `${lead}
      <div class="predict-block">
        <label class="notes-label">${N.predictLabel}</label>
        ${body}
      </div>
      <div class="predict-block">
        <label class="notes-label" for="note-predict-why">${N.predictWhyLabel}</label>
        ${field('predict.why', st.session.notes['predict.why'], spec.why, 2)}
      </div>`;
  }

  /* ---------------- 4. 탐구 과정 ---------------- */

  function stage4(st) {
    // **1단계만 다음에 할 일을 짚어 준다.** 2단계는 목록만, 3단계는 그것도 없다.
    // 짚어 주는 것은 안내이지 잠금이 아니다 — 어느 칸이든 언제든 쓸 수 있다.
    const nextKey = st.session.level === 1 ? nextUndone(st) : null;
    const panels = stepPanels(st, manualOpen, openedSteps);
    // 펼쳐진 것은 「가 본 것」으로 남긴다. 다음에 다시 그릴 때 잠기지 않게.
    panels.forEach((p) => { if (p.open) openedSteps.add(p.id); });
    const doneCount = panels.filter((p) => p.state === 'done').length;

    const groups = UI.protocol.map((group, gi) => {
      const panel = panels[gi];
      const steps = group.steps.map((step, i) => {
        const key = substepId(group, i);
        const done = stepDone(st, group.id, i);
        // 끝난 STEP 이나 앞으로 올 STEP 을 펼쳐 봤을 때 거기서도 「다음에 이걸」을 외치면,
        // 화면이 두 곳에서 서로 다른 다음을 가리킨다.
        const isNext = panel.state === 'now' && key === nextKey;
        // 관찰 기록 칸은 **조작의 결과가 화면에 나타나는 칸에만** 낸다 (`UI.protocol` 머리말).
        // 준비 동작에까지 칸을 내면 빈칸이 줄줄이 남아 안 한 일처럼 읽히고,
        // 학생은 적을 것이 없는 칸을 채우느라 진짜 관찰을 대충 적는다.
        const box = step.note
          ? field(key, st.session.notes[key], notePlaceholder(st.session.level, step), 2)
          : '';
        return `<li class="substep${isNext ? ' substep--next' : ''}"
          data-done="${done}" data-has-note="${Boolean(step.note)}">
          <div class="substep-title">
            <span class="substep-mark" aria-hidden="true">${done ? '✓' : '·'}</span>
            ${step.label}
            <span class="substep-state">${done ? N.stepDoneMark : N.stepTodoMark}</span>
          </div>
          ${isNext ? `<p class="substep-hint">${emph(N.stepNext)}</p>` : ''}
          ${step.note ? `<label class="notes-label" for="note-${key}">${N.notesLabel}</label>` : ''}
          ${box}
        </li>`;
      }).join('');

      /*
       * 접힌 STEP 에도 **무슨 일이 일어나는지** 적어 둔다.
       * 잠긴 것에는 「왜 잠겼는지」와 **무엇을 하면 열리는지**를 적는다 — 말 없이 안 열리면
       * 학생은 고장이라고 읽는다. 이 글은 `summary` 안에 있어서 읽어 주는 기기에도 함께 나간다.
       */
      const openHint = panel.locked
        ? `<span class="step-open-hint">${N.stepLockedHint}</span>`
        : (panel.state === 'now' ? ''
          : `<span class="step-open-hint">${panel.state === 'done' ? N.stepReopenHint : N.stepPeekHint}</span>`);
      // 잠긴 STEP 은 **왜 잠겼는지를 카드 안에** 적는다 (docs/09 §4). 앞 STEP 번호를 그대로 말한다 —
      // 「앞 STEP」이라고만 하면 어느 것인지 세어 봐야 한다.
      const lockedWhy = panel.locked
        ? `<p class="step-locked-why">${N.stepLockedWhy(UI.protocol[gi - 1]?.id ?? group.id)}</p>` : '';

      return `<details class="note-step${panel.locked ? ' note-step--locked' : ''}" data-step-group="${group.id}"
        data-state="${panel.state}" data-done="${panel.state === 'done'}"
        data-locked="${Boolean(panel.locked)}"${panel.open ? ' open' : ''}>
        <summary class="step-summary">
          <!-- 제목은 접혀도 h3 로 남는다. 다른 쪽이 전부 h3 라, 여기만 span 이면
               제목만 훑어 내려가는 학생에게 4단계가 통째로 사라진다. -->
          <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
          ${panel.state === 'done' ? `<span class="step-done-mark"><span aria-hidden="true">✓</span><span class="sr-only">${N.stepDone}</span></span>` : ''}
          ${panel.state === 'now' ? `<span class="step-now-badge">${N.stepNowBadge}</span>` : ''}
          ${openHint}
          ${lockedWhy}
        </summary>
        <div class="step-body"><ul class="substep-list">${steps}</ul></div>
      </details>`;
    }).join('');

    const tally = doneCount === UI.protocol.length
      ? `<p class="step-tally step-tally--done">${N.stepAllDone}</p>`
      : `<p class="step-tally">${N.stepProgress(doneCount, UI.protocol.length)}</p>`;

    // 질문 ⓐ 는 기체가 모이는 것을 **본 직후**에 묻는다. 6단계까지 미루면
    // 기억을 더듬는 문제가 된다. 아직 안 봤으면 묻지 않는다 — 답할 수 없는 것을 묻지 않는다.
    const seenIt = st.trials.length > 0 || st.bench.tube.elapsedMin > 0;
    const qa = seenIt ? `<section class="note-aside">
        <h3>${N.questionA.heading}</h3>
        <p class="stage-text">${N.questionA.prompt}</p>
        ${question(st, 'qa', N.questionA.label)}
      </section>` : '';

    // 질문 ⓐ 는 **아코디언 밖**에 둔다. 이 칸은 6단계 「정리」가 다 됐는지를 가르는 칸인데
    // (`wrapupKeys`), 6단계는 비어 있으면 칸을 내주지 않고 「아직」만 적는다. STEP 안에
    // 넣었다가 그 STEP 이 끝나 접히면, 답할 칸이 화면 어디에도 없는 채로 보고서만 막힌다.
    return `<p class="stage-empty">${designSentence(st.design)}</p>
      <p class="stage-text step-lead">${emph(benchLocked(st) ? N.stepLeadInLocked : N.stepLeadIn)}</p>
      ${tally}${groups}${qa}`;
  }

  /* ---------------- 5. 결과 ---------------- */

  function stage5(st) {
    if (st.trials.length === 0) {
      return `<h2>${UI.graph.title}</h2><p class="note-empty">${UI.graph.empty}</p>`;
    }
    // 시행마다 「지우기」를 붙인다. 규칙(`DELETE_TRIAL`)은 처음부터 있었는데 화면에 단추가
    // 없어서, 잘못 기록한 시행을 지울 길이 되돌리기(3단계는 1회)뿐이었다 — 막다른 길이다.
    const rows = st.trials.map((t) => `<tr class="${t.offDesign.length ? 'trial--off' : ''}">
      <td>${t.at + 1}</td><td>${escapeHtml(trialSummary(st, t))}</td>
      <td><button type="button" class="trial-delete" data-delete-trial="${t.at}"
        aria-label="${N.trialDeleteLabel(t.at + 1)}">${N.trialDelete}</button></td>
    </tr>`).join('');
    return `<h2>${UI.graph.title}</h2>
      <div class="note-graph">${renderGraph(st.trials, st.design, { idPrefix: 'nb' })}</div>
      <ul class="graph-notes">${graphNotes(st.trials, st.design).map((l) => `<li>${l}</li>`).join('')}</ul>
      <table class="trial-table">
        <thead><tr><th>${N.trialNo}</th><th>${N.trialWhat}</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note-lead">${N.repeatCount(distinctConditions(st))}</p>`;
  }

  /* ---------------- 6. 정리 ---------------- */

  function stage6(st) {
    const predict = st.session.notes.predict;
    const compare = `<section class="note-aside">
      <h3>${N.predictHeading}</h3>
      <p><b>${N.predictRecapLabel}</b> — ${predict ? escapeHtml(predict) : N.predictNone}</p>
      <p><b>${N.actualLabel}</b> — ${st.trials.length ? escapeHtml(N.actualLead(st.trials.length)) : N.actualNotYet}</p>
    </section>`;

    // 설계와 어긋난 시행을 스스로 돌아보게 한다. **나무라지 않는다.**
    const off = st.trials.filter((t) => offDesign(st.design, t.conditions).length > 0);
    const reflect = off.length ? `<section class="note-aside">
      <p class="note-lead">${N.reflectQuestion(off.map((t) => t.at + 1).join(', '))}</p>
      ${field('reflect.off', st.session.notes['reflect.off'], N.notePlaceholders[2], 2)}
    </section>` : '';

    const recap = Object.keys(st.session.notes).filter(isStepNoteKey)
      .filter((k) => String(st.session.notes[k]).trim())
      .map((k) => `<li><b>${stepNoteLabel(k)}</b> — ${escapeHtml(st.session.notes[k])}</li>`).join('');

    const qaLine = hasNote(st, 'qa')
      ? `<p class="note-carried">${N.qaCarried}</p>${question(st, 'qa', N.qaContinueLabel)}`
      : `<p class="note-empty">${N.qaNotYet}</p>`;

    const discussion = isGroup(st) ? `<section class="note-aside">
      <h3>${N.discussionHeading}</h3>
      ${N.discussionItems.map((d) => `<div class="grade-block">
        <label class="notes-label" for="note-discuss-${d.key}">${d.label}</label>
        ${field(`discuss.${d.key}`, st.session.notes[`discuss.${d.key}`], d.eg, 2)}
      </div>`).join('')}
    </section>` : '';

    return `${compare}${reflect}
      ${recap ? `<section class="note-aside"><h3>${N.stepNotesHeading}</h3><ul class="recap">${recap}</ul></section>` : ''}
      ${qaLine}
      ${question(st, 'q2', N.q2Label)}
      ${question(st, 'q3', N.q3Label)}
      ${question(st, 'q4', N.q4Label)}
      ${question(st, 'q5', N.q5Label)}
      ${isGroup(st) ? question(st, 'q6', N.q6Label) : ''}
      ${discussion}`;
  }

  /* ---------------- 7. 자기 평가 ---------------- */

  function stage7(st) {
    const likert = N.selfEvalItems.map((item) => {
      const key = `selfeval.${item.key}`;
      const cur = st.session.notes[key] ?? '';
      const cells = N.likertScale.map((o) => `
        <label class="likert-cell">
          <input type="radio" name="${key}" value="${o.value}"
            data-note="${key}"${cur === o.value ? ' checked' : ''}>
          <span class="likert-num">${o.value}</span>
          <span class="likert-word">${o.label}</span>
        </label>`).join('');
      return `
        <fieldset class="likert-row">
          <legend>${item.label}</legend>
          <div class="likert-scale">${cells}</div>
        </fieldset>`;
    }).join('');

    const reflection = N.reflectionItems.map((item) => `<div class="grade-block">
      <label class="notes-label" for="note-feedback-${item.key}">${item.label}</label>
      ${field(`feedback.${item.key}`, st.session.notes[`feedback.${item.key}`], item.eg, 2)}
    </div>`).join('');

    // 안전 안내는 준비물 쪽(2쪽)에 있다 — 다 끝난 뒤에 읽을 것이 아니다.
    return `<div id="self-eval">
        <h3>${N.likertHeading}</h3>
        ${likert}
        <h3>${N.reflectionHeading}</h3>
        ${reflection}
      </div>`;
  }

  const STAGE_BODY = { 1: stage1, 2: stage2, 3: stage3, 4: stage4, 5: stage5, 6: stage6, 7: stage7 };

  /* ---------------- 읽음 표시 · 보고서 ---------------- */

  /**
   * 「이 쪽을 읽었습니다」를 누른 다음 어디로 가나.
   *
   * 읽을 쪽이 더 남았으면 **그 다음 읽을 쪽**으로 넘긴다. 예전에는 그 자리에 ✓ 만 남아서
   * 학생이 탭을 직접 눌러 옮겨야 했다 — 「눌렀는데 아무 일도 안 일어난다」로 읽힌다.
   *
   * **마지막 읽을 쪽(4. 탐구 과정)에서는 넘기지 않고 그대로 둔다.** 여기서 실험대가 열리고,
   * 4 쪽은 **실험하는 내내 보면서 따라가는 쪽**이기 때문이다. 5. 결과로 넘기면 아직 아무
   * 시행도 없어 빈 그래프가 뜨고, 학생은 방금 열린 실험대를 등지고 빈 쪽을 본다.
   */
  function nextReadStage() {
    /*
     * **바로 다음 쪽이다. 읽었는지는 보지 않는다.**
     *
     * 처음에는 「아직 안 읽은 첫 쪽」으로 골랐는데, 그러면 4 쪽에서 읽었다고 눌렀을 때
     * 아직 안 읽은 3 쪽으로 **거꾸로** 끌려갔다 — 앞으로 가려고 누른 단추가 뒤로 보낸다.
     * 「안 읽은 것 중 뒤쪽만」으로 고쳐도 반쪽이었다: 4 쪽을 먼저 읽어 둔 학생은 3 쪽에서
     * 눌러도 **아무 데도 안 간다**(뒤에 안 읽은 쪽이 없으므로). 눌렀는데 아무 일도 안
     * 일어나는 것은 처음 고치려던 그 증상이다. 넘길 곳을 **읽음 여부로 고르는 것 자체가 틀렸다.**
     *
     * 마지막 읽을 쪽(4)에서는 넘기지 않는다. 거기서 실험대가 열리고, 4 쪽은 실험하는 내내
     * 보면서 따라가는 쪽이다. 5. 결과로 넘기면 아직 시행이 없어 빈 그래프가 뜨고,
     * 학생은 방금 열린 실험대를 등지고 빈 쪽을 본다.
     */
    const required = UI.bench.lock.required;
    return required[required.indexOf(activeStage) + 1] ?? null;
  }

  /**
   * 예상 관문 — **막혔는가, 그리고 무엇이 아직 없는가.**
   *
   * 세 가지가 다르고 갈 곳도 다르다.
   *   조작변인이 없다 → 이 쪽에 예상할 것이 **아예 안 나온다**. 실험 설계로 보낸다
   *   예상이 없다     → 위에서 고르거나 적으라고 한다
   *   까닭이 없다     → **바로 아래 칸**을 짚는다
   *
   * 마지막 것이 없어서 실제로 막혔다. 예상을 고른 학생에게 계속 「고르거나 적으세요」라고
   * 말했으니, 방금 한 일을 또 하라는 말이었다. 다시 누르고 또 눌러 보다 그만둔다.
   */
  function gateOf(st) {
    const gated = activeStage === '3' && !predictDone(st);
    // 예상을 **고르는** 화면(1단계)과 **적는** 화면(2·3단계)이 다르다 — `stage3` 와 같은 조건.
    const pick = (chose, wrote) => (st.session.level === 1 ? chose : wrote);
    const needPredict = pick(N.readNeedsPredict, N.readNeedsPredictWrite);
    // 「예상은 골랐습니다」도 1단계에서만 참이다 — 2·3단계는 **적었다.**
    const needWhy = pick(N.readNeedsWhy, N.readNeedsWhyWrite);
    const whyText = !st.design.independent ? N.readNeedsVariable
      : (!hasNote(st, 'predict') ? needPredict : needWhy);
    return { gated, whyText };
  }

  /**
   * 글을 치는 **동안에도** 관문을 풀어 준다.
   *
   * 다시 그리기를 미루는 동안 이 단추만 제자리에서 고친다. 안 그러면 학생이
   * 「이제 까닭을 적으면 넘어갑니다」를 읽고 적었는데도 **단추가 계속 잠겨 있다** —
   * 칸을 한 번 빠져나가야 풀리는 것을 학생이 알 길이 없다.
   *
   * **판을 갈지 않고 속성과 글자만 고친다.** 갈아 치우면 치던 칸이 문서에서 사라진다.
   */
  function patchGate(st) {
    const btn = root.querySelector('#read-confirm');
    if (!btn) return;
    const { gated, whyText } = gateOf(st);
    if (gated) {
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-describedby', 'read-why');
    } else {
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('aria-describedby');
    }
    const why = root.querySelector('#read-why');
    if (why) {
      why.textContent = gated ? whyText : '';
      why.hidden = !gated;
    }
  }

  /**
   * 글을 치는 **동안에도** STEP 자물쇠와 그 안내를 제자리에서 고친다.
   *
   * `patchGate` 와 같은 까닭이다. 관찰 기록을 다 적었는데도 다음 STEP 이
   * 「지금 STEP 의 관찰 기록을 적으면 열립니다」라고 계속 말하면, **방금 한 일을 또 하라는
   * 말**이 된다 — 학생은 칸을 한 번 빠져나가야 풀린다는 것을 알 길이 없다.
   *
   * 판을 갈지 않고 `data-locked` 와 안내 글자만 고친다. 갈면 치던 칸이 사라진다.
   */
  function patchSteps(st) {
    const heads = root.querySelectorAll('details[data-step-group]');
    if (!heads.length) return;
    const panels = stepPanels(st, manualOpen, openedSteps);
    for (const panel of panels) {
      const el = root.querySelector(`details[data-step-group="${panel.id}"]`);
      if (!el) continue;
      el.dataset.locked = String(Boolean(panel.locked));
      const hint = el.querySelector('.step-open-hint');
      if (!hint) continue;
      hint.classList.toggle('step-open-hint--locked', Boolean(panel.locked));
      hint.textContent = panel.locked ? N.stepLockedHint
        : (panel.state === 'done' ? N.stepReopenHint : N.stepPeekHint);
    }
  }

  function readFooter(st) {
    if (!UI.bench.lock.required.includes(activeStage)) return '';
    const read = (st.session.readStages ?? []).includes(activeStage);
    const left = UI.bench.lock.required.filter((id) => !(st.session.readStages ?? []).includes(id));

    /*
     * 예상 쪽은 **예상을 적어야** 넘어간다.
     *
     * ── `disabled` 가 아니라 `aria-disabled` 인 까닭 ──────────────────
     * `disabled` 를 달았더니 단추가 **탭 순서에서 통째로 빠졌다.** 진짜 Tab 을 60번 쳐도
     * 닿지 않았고, 그래서 옆에 붙여 둔 까닭(`aria-describedby`)이 **한 번도 읽히지 않았다.**
     * 이유가 **눈으로 보는 사람에게만** 있는 것이 된다 — 낭독기를 쓰는 학생은 눌리지 않는
     * 단추만 만나고 왜인지 영영 모른다.
     *
     * `aria-disabled` 는 「지금은 눌러도 안 된다」를 말하면서 **포커스는 그대로 둔다.**
     * 낭독기가 단추를 읽을 때 까닭까지 함께 읽는다. 막는 것은 아래 클릭 처리가 한다.
     *
     * 이 저장소는 조작을 막지 않는다 (AGENTS.md §2.1). 그것은 **실험대** 이야기다 —
     * 노트를 읽어 나가는 차례는 막아도 된다. 예상을 안 하고 결과를 본 다음 예상을 적으면
     * 그건 예상이 아니라 베껴 쓴 것이고, 이 쪽이 있는 이유가 통째로 사라진다.
     *
     * **채점이 아니다.** 고르거나 한 줄 쓰기만 하면 통과다 — 내용은 보지 않는다.
     * 그리고 **왜 못 누르는지 반드시 말한다.** 말 없는 회색 단추는 고장으로 읽힌다.
     */
    const { gated, whyText: gateWhy } = gateOf(st);
    if (read) {
      return `<p class="read-mark" data-done="true">${N.readDone}${
        left.length === 0 ? ` ${N.readAllDone}` : ''}</p>`;
    }
    // **막을 때는 지금 할 일을 말한다.** 까닭 없는 회색 단추는 고장으로 읽힌다.
    return `
      <div class="read-mark">
        <p id="read-why">${gated ? gateWhy : N.readLeadIn}</p>
        <button type="button" id="read-confirm" class="read-confirm"${
          gated ? ' aria-disabled="true" aria-describedby="read-why"' : ''}>${N.readConfirm}</button>
      </div>`;
  }

  function renderReportSlot(st) {
    const { ready, missing } = reportReadiness(st);
    root.querySelector('#report-slot').innerHTML = ready
      ? `<button type="button" id="make-report">${N.reportButton}</button>`
      : `<details class="report-todo"><summary>${N.reportLockedHint} (${missing.length})</summary>
          <ul>${missing.map((m) => `<li>${m}</li>`).join('')}</ul></details>`;
    if (ready) {
      root.querySelector('#make-report').addEventListener('click', () => onReport());
      if (!wasReady) { wasReady = true; onReady(); }
    }
  }

  /* ---------------- 그리기 ---------------- */

  function render() {
    const st = store.getState();
    tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.stage === activeStage));
      // 끝낸 쪽에는 표시를 남긴다. 어디가 남았는지 탭만 보고 알 수 있어야 한다.
      tab.dataset.read = String(stageDone(st, tab.dataset.stage));
    });
    panelEl.innerHTML = STAGE_BODY[activeStage](st) + readFooter(st);
    renderReportSlot(st);
  }

  /**
   * 클릭은 위임으로 받는다. 다시 그릴 때마다 붙잡아 둔 노드가 문서에서 떨어져 나가는데,
   * 떨어져 나간 노드에 건 리스너는 **조용히 아무 일도 안 한다.**
   */
  root.addEventListener('click', (e) => {
    /*
     * **`toggle` 이 아니라 summary 의 `click` 을 듣는다.** `<details open>` 을 `innerHTML` 로
     * 꽂으면 브라우저가 **삽입만으로도 `toggle` 을 한 번 쏜다** — 그러면 「지금 할 차례라서
     * 펼쳐진 것」이 「학생이 손으로 연 것」으로 기록되고, 그 STEP 은 끝난 뒤에도 **영영 안 접힌다.**
     * `click` 은 사람이 눌렀을 때만 온다 (summary 는 포커스를 받으므로 Enter·Space 도
     * click 으로 온다 — 키보드도 같이 산다).
     *
     * 기본 동작을 막지 않는다. 여기서 `open` 을 읽는 시점은 아직 뒤집히기 **전**이라
     * 뒤집은 값을 적어 둔다.
     */
    const summary = e.target.closest('details[data-step-group] > summary');
    if (summary) {
      const details = summary.parentElement;
      /*
       * 잠긴 STEP 은 **기본 동작만** 막는다. `disabled` 도 `pointer-events:none` 도 쓰지 않는다 —
       * 그러면 포커스도 못 받아 키보드로는 이런 STEP 이 있다는 것조차 알 수 없다.
       * 왜 안 열리는지는 머리에 적혀 있고, 그 글이 읽어 주는 기기에도 함께 나간다.
       */
      if (details.dataset.locked === 'true') { e.preventDefault(); return; }
      manualOpen.set(details.dataset.stepGroup, !details.open);
      return;
    }
    const tab = e.target.closest('[data-stage]');
    if (tab) { activeStage = tab.dataset.stage; render(); return; }
    const del = e.target.closest('[data-delete-trial]');
    if (del) { store.dispatch('DELETE_TRIAL', { at: Number(del.dataset.deleteTrial) }); return; }
    const opt = e.target.closest('[data-predict]');
    if (opt) { store.dispatch('SAVE_NOTE', { step: 'predict', text: opt.dataset.predict }); return; }
    const confirm = e.target.closest('#read-confirm');
    // `aria-disabled` 는 브라우저가 막아 주지 않는다 — 여기서 막는다. 대신 포커스는 살아 있고
    // 까닭이 낭독기에 함께 읽힌다.
    if (confirm?.getAttribute('aria-disabled') === 'true') return;
    if (confirm) {
      // 넘길 쪽을 **먼저** 정한다. dispatch 하면 구독이 곧바로 다시 그리는데,
      // 그때 activeStage 가 아직 이 쪽이면 학생은 같은 쪽을 다시 본다.
      const to = nextReadStage();
      store.dispatch('MARK_READ', { stage: activeStage });
      if (to) { activeStage = to; render(); }
    }
  });

  /**
   * 글자를 칠 때마다 다시 그리면 커서가 튄다. `input` 으로 상태만 저장하고 화면은 그대로 둔다.
   *
   * ── 다시 그리기를 **미룬다** ────────────────────────────────────────
   * 예전에는 칸을 떠날 때(`change`) 곧바로 다시 그렸다. 그런데 학생은 **한 칸을 적고
   * 곧장 다음 칸을 누른다.** 그 누름이 앞 칸의 `change` 를 쏘고, 다시 그리기가 방금 포커스를
   * 받은 칸을 **문서에서 갈아 치운다.** 그 뒤에 친 글자는 **떨어져 나간 칸**으로 들어가서
   * 화면에도 상태에도 남지 않는다 — 학생이 적은 글이 그냥 사라진다. 실제로 재현했다:
   *
   *     첫 칸에 적고 → 둘째 칸을 눌러 적으면
   *     화면 {"predict":"첫째…","predict.why":""}   상태에 predict.why 없음
   *
   * 단추도 같은 일을 당한다. 마지막 칸에 적고 **곧장 「읽었습니다」를 누르면**, 그 누름이
   * 쏜 `change` 가 단추를 갈아 치워서 **누름이 삼켜진다.**
   *
   * 그래서 **글을 치는 동안에도, 무언가를 누르는 동안에도 다시 그리지 않는다.**
   * 미뤄 둔 것은 포커스가 노트 칸을 **진짜로 떠났을 때** 한 번에 그린다 — 그때 첨삭이 붙는다.
   */
  let pendingRender = false;
  let pressing = false;

  /** 지금 노트 칸에 글을 치고 있는가. */
  const typing = () => root.contains(document.activeElement)
    && document.activeElement.matches?.('[data-note]');

  function renderOrDefer() {
    if (typing() || pressing) {
      pendingRender = true;
      // 미루는 동안에도 **관문과 보고서 단추**는 제자리에서 고친다 — 학생이 방금 적은 것이
      // 곧바로 반영돼야 「적었는데 왜 안 되지」가 안 생긴다.
      const st = store.getState();
      renderReportSlot(st);
      patchGate(st);
      patchSteps(st);
      return;
    }
    pendingRender = false;
    render();
  }

  root.addEventListener('input', (e) => {
    const box = e.target.closest('[data-note]');
    if (box) store.dispatch('SAVE_NOTE', { step: box.dataset.note, text: box.value });
  });
  /*
   * **`change` 에서는 절대 그 자리에서 그리지 않는다.**
   *
   * `change` 는 포커스가 **옮겨 가는 도중**에 온다 — 그 순간 `document.activeElement` 는
   * 아직 `body` 이거나 옛 칸이라, 「지금 치고 있는가」를 물어도 거짓이 나온다.
   * 그래서 미루기 관문이 통과돼 버리고, 다시 그리기가 **Tab 이 방금 옮겨 간 칸**을
   * 갈아 치운다. 마우스로는 `pointerdown` 이 막아 주는데 **Tab 에는 그 누름이 없다.**
   *
   *     Tab 으로 옮겨 적음 → 화면 ["예상0",""]  상태 ["예상0",""]   ← 둘째 글이 통째로 없다
   *
   * 그래서 여기서는 **표시만 하고**, 한 틱 뒤에 본다. 그때는 다음 칸이 포커스를 잡았거나
   * (그러면 또 미룬다) 정말로 떠난 것이다.
   */
  root.addEventListener('change', (e) => {
    if (!e.target.closest('[data-note]')) return;
    pendingRender = true;
    const st = store.getState();
    renderReportSlot(st);
    patchGate(st);
    patchSteps(st);
    setTimeout(() => { if (pendingRender && !pressing && !typing()) renderOrDefer(); }, 0);
  });

  /*
   * 누르는 동안에는 판을 갈지 않는다. `pointerdown` 과 `click` 사이에 다시 그리면
   * 눌린 단추가 문서에서 사라져 **그 누름이 아무 데도 도착하지 않는다.**
   */
  root.addEventListener('pointerdown', (e) => {
    pressing = true;
    /*
     * **치던 글을 그 자리에서 저장한다.**
     *
     * `change` 는 칸에서 손이 떠나야 온다. 그런데 학생은 마지막 기록을 적고 **곧장 다음
     * STEP 머리를 누른다.** 그 순간 상태에는 방금 친 글이 아직 없어서 자물쇠가 안 풀려 있고,
     * 잠긴 머리는 눌러도 안 열린다. 그 뒤에야 `change` 가 와서 풀린다 —
     * 학생 눈에는 **첫 누름이 그냥 안 먹은 것**이고, 두 번 눌러야 열린다. 실제로 그랬다.
     */
    const el = document.activeElement;
    if (!el?.matches?.('[data-note]') || el === e.target) return;
    store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });

    // 방금 적은 것 **덕분에 풀렸으면** 그대로 펼친다. 아직 잠겨 있으면 건드리지 않는다 —
    // 여기서 무턱대고 열면 적지 않고도 잠긴 STEP 을 여는 뒷문이 된다.
    const head = e.target.closest?.('details[data-step-group]');
    if (head?.dataset.locked !== 'true') return;
    const panel = stepPanels(store.getState(), manualOpen, openedSteps)
      .find((p) => p.id === head.dataset.stepGroup);
    if (panel && !panel.locked) manualOpen.set(panel.id, true);
  });
  window.addEventListener('pointerup', () => {
    pressing = false;
    // 누름 처리가 끝난 다음에 그린다. 여기서 바로 그리면 click 이 아직 안 왔다.
    setTimeout(() => { if (pendingRender && !typing()) renderOrDefer(); }, 0);
  });

  /*
   * 포커스가 노트 칸을 떠났을 때 미뤄 둔 것을 그린다.
   * **한 틱 미룬다** — `focusout` 은 다음 칸이 포커스를 받기 **전에** 오므로,
   * 그 자리에서 그리면 방금 누른 칸을 또 갈아 치운다.
   */
  root.addEventListener('focusout', () => {
    setTimeout(() => { if (pendingRender && !pressing && !typing()) renderOrDefer(); }, 0);
  });

  store.subscribe(renderOrDefer);
  render();
  return { render, goTo(id) { activeStage = id; render(); } };
}
