/**
 * 탐구 노트 — 7단계 패널.
 *
 * `docs/06-lab-notebook.md` 의 7단계(문제 인식~자기 평가)를 최상위 탭으로 두고,
 * 손으로 하는 절차는 4단계 「탐구 과정」 안의 STEP 으로 내린다.
 *
 * **7단계 구조를 조작 절차로 납작하게 만들지 않는다.** 탐구 노트는 「다음에 무엇을 누를까」가
 * 아니라 「무엇을 왜 하려는가」다. 바나나랩에서 납작하게 만들었다가 되돌렸다.
 *
 * 상태는 전부 `store.dispatch('SAVE_NOTE', …)` 를 거쳐 `reduce()` 로 간다 —
 * 이 파일은 `session.notes` 를 직접 대입하지 않는다.
 */

import { MODES, VARIABLE_KEY, offDesign } from '../sim/state.js';
import { OBSERVE_LIMIT_S } from '../sim/kinetics.js';
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
  const time = trial.floated ? UI.units.seconds(trial.seconds) : UI.units.noFloat(OBSERVE_LIMIT_S);
  // 저장된 판정이 아니라 **지금 설계**로 다시 잰다 (`render/graph.js` 의 classify 주석 참조).
  const wrong = offDesign(st.design, trial.conditions);
  const off = wrong.length
    ? ` · ${N.trialOffDesign(wrong.map((k) => UI.conditions[k]).join(', '))}`
    : '';
  return `${changed} → ${time}${off}`;
}

/** 칸이 채워졌는가. 공백만 있는 것은 안 채운 것이다. */
const hasNote = (st, key) => String(st.session.notes[key] ?? '').trim().length > 0;

/*
 * 쪽마다 「다 했는가」. 탭의 ✓ 와 보고서 단추가 **같은 함수**를 본다.
 * 따로 세면 언젠가 어긋나고, 그때 학생은 탭이 전부 ✓ 인데 보고서가 안 나오는 화면을 본다.
 */
const predictDone = (st) => hasNote(st, 'predict') && hasNote(st, 'predict.why');

/**
 * 3쪽에서 왜 못 넘어가는가 — **지금 비어 있는 것**을 가리킨다.
 *
 * 세 자리가 다르고, 말도 달라야 한다:
 *   ① 조작변인을 안 골랐다 → 예상할 칸이 화면에 **아예 없다**
 *   ② 예상을 안 정했다     → 1단계는 **고르고**, 2·3단계는 **적는다** (`stage3` 참조)
 *   ③ 예상은 정했다        → 비어 있는 것은 **이유 칸**이다
 *
 * 하나로 두었을 때 ②의 2·3단계와 ③이 거짓말을 했다. 3단계로 끝까지 해 보다 나왔다 —
 * 「예상 결과를 고르세요」라고 하는데 **고를 것이 화면에 없었다.**
 */
function predictWhyBlocked(st) {
  if (!st.design.independent) return N.readNeedsVariable;
  if (!hasNote(st, 'predict')) {
    return st.session.level === 1 ? N.readNeedsPredict : N.readNeedsPredictWrite;
  }
  return N.readNeedsPredictWhy;
}
const wrapupKeys = (st) => ['qa', 'q2', 'q3', 'q4', ...(isGroup(st) ? ['q5'] : [])];
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
  /**
   * 학생이 **손으로** 여닫은 STEP. 열었으면 true, 접었으면 false.
   *
   * 없으면 「지금 할 STEP」 하나만 펼친다. 있으면 **그것이 이긴다** — 학생이 일부러 연 것을
   * 다시 그릴 때마다 도로 접으면, 앞 STEP 을 보며 적으려던 사람은 손이 계속 튕겨 나간다.
   *
   * 상태(store)에 넣지 않는다. 이것은 실험에 대한 기록이 아니라 **지금 이 화면을 어떻게
   * 보고 있는가**라서, 보고서에도 되돌리기에도 들어갈 것이 아니다.
   */
  const manualOpen = new Map();

  /**
   * **한 번이라도 열려 있던 STEP.** 다시 잠그지 않는다.
   *
   * 「앞 STEP 을 다 적어야 뒤가 열린다」로만 두면 미리 훑어본 STEP 이 뒤늦게 다시 잠긴다 —
   * 학생 눈에는 **열려 있던 것이 사라진 것**이고, 그건 고장으로 읽힌다.
   */
  const everOpened = new Set();
  root.innerHTML = `
    <div class="note-head">
      <h1>${N.heading}</h1>
      <div id="report-slot" class="report-slot"></div>
    </div>
    <div class="note-tabs" role="tablist"></div>
    <div class="note-body" id="note-body"></div>`;

  const tabsEl = root.querySelector('.note-tabs');
  const bodyEl = root.querySelector('#note-body');
  let activeStage = N.stages[0].id;
  let wasReady = false;

  /* ---------------- 조각들 ---------------- */

  const field = (key, value, placeholder, rows = 2) =>
    `<textarea class="note-input" data-note="${key}" rows="${rows}"
      placeholder="${escapeHtml(placeholder)}">${escapeHtml(value ?? '')}</textarea>`;

  /** 첨삭 한 줄. **빈칸에는 아무 말도 하지 않는다** — 쓰기도 전에 부족하다는 말부터 들으면 안 쓴다. */
  function gradeLine(id, text) {
    if (!String(text ?? '').trim()) return '';
    const r = gradeQuestion(id, text);
    const cls = r.status === STATUS.PASS ? 'ok' : r.status === STATUS.UNAVAILABLE ? 'na' : 'more';
    const msg = r.status === STATUS.PASS ? (r.message ?? N.gradeOk) : r.message;
    return msg ? `<p class="grade grade--${cls}">${escapeHtml(msg)}</p>` : '';
  }

  function question(st, id, label, rows = 3) {
    const text = st.session.notes[id] ?? '';
    return `<div class="note-q">
      <label class="note-q-label" for="q-${id}">${label}</label>
      ${field(id, text, N.notePlaceholders[3] ?? '', rows)}
      ${gradeLine(id, text)}
    </div>`;
  }

  /* ---------------- 1. 문제 인식 ---------------- */

  function stage1() {
    return `<h2>${N.problem}</h2><p class="note-lead">${N.problemLead}</p>`;
  }

  /* ---------------- 2. 준비물 ---------------- */

  function stage2() {
    const rows = N.materials.map((m) => `
      <tr>
        <td class="mat-fig">${ASSETS[m.asset].render(m.state ?? {})}</td>
        <td class="mat-name">${m.name}</td>
        <td class="mat-role">${m.role}</td>
      </tr>`).join('');
    /**
     * 안전 안내는 **준비물 쪽(2쪽)에 둔다.**
     *
     * 앞서는 자기 평가(7쪽) 맨 아래에 있었다. 그런데 그건 **실험을 다 하고 나서 읽는 자리**다 —
     * 「실제 실험에서는 이런 것을 지켜야 한다」를 다 끝난 뒤에 알려 주는 셈이었다.
     * 준비물을 보는 자리가 맞다. 여덟 랩이 자리도 UI 도 같아야 학생이 실험을 옮겨 다녀도
     * 같은 곳에서 찾는다 (선생님 지시, 2026-08-29).
     */
    return `<h2>${N.materialsHeading}</h2>
      <table class="mat-table">
        <thead><tr><th>${N.matHeadFigure}</th><th>${N.matHeadName}</th><th>${N.matHeadRole}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="safety-note">
        <h3>${N.valuesLabel}</h3>
        <p class="note-lead values-lead">${N.valuesLead}</p>
        <ul class="values-list">${N.valuesList.map((t) => `<li>${t}</li>`).join('')}</ul>
      </section>`;
  }

  /* ---------------- 3. 예상 ---------------- */

  function stage3(st) {
    const v = st.design.independent;
    const lead = N.predictLeadIn.map((t) => `<p class="note-lead">${t}</p>`).join('');
    if (!v) return `${lead}<p class="note-empty">${N.predictNoVariable}</p>`;

    const spec = N.predictByVariable[v];
    const chosen = st.session.notes.predict ?? '';
    // 1단계는 보기에서 고르고, 2·3단계는 직접 쓴다. **조작은 세 단계가 모두 같다** —
    // 예상을 「할 수 있는가」가 아니라 「얼마나 거들어 주는가」만 다르다.
    const body = st.session.level === 1
      ? `<div class="predict-options" role="radiogroup" aria-label="${N.predictLabel}">
          ${spec.options.map((o) => `<button type="button" class="predict-opt" role="radio"
            data-predict="${escapeHtml(o)}" aria-checked="${chosen === o}">${o}</button>`).join('')}
        </div>`
      : field('predict', chosen, spec.free, 2);

    return `${lead}
      <div class="note-q">
        <span class="note-q-label">${N.predictLabel}</span>
        ${body}
      </div>
      <div class="note-q">
        <label class="note-q-label">${N.predictWhyLabel}</label>
        ${field('predict.why', st.session.notes['predict.why'], spec.why, 2)}
      </div>`;
  }

  /* ---------------- 4. 탐구 과정 ---------------- */

  /**
   * 탐구 과정 — **한 번에 한 STEP.**
   *
   * 앞서는 다섯 STEP 이 한꺼번에 펼쳐진 목록이었다. 그러면 학생이 그것을 「읽을 글」로 받는다 —
   * 주욱 읽고 내려간 다음 실험대로 가서 무엇부터 할지 몰라 멈춘다.
   * 지금 할 것 하나만 펼치면 「할 일」로 읽힌다. 여덟 실험이 같은 손짓이라 학생이 실험
   * 사이를 오갈 때 다시 배우지 않아도 된다.
   *
   * 「지금 STEP」은 **`groupDone` 이 거짓인 첫 STEP** 이다. 상태에서 나오므로 따로 저장하지 않는다 —
   * 저장하면 실험대에서 한 일과 노트가 어긋나는 순간이 생긴다.
   *
   * **접는 것은 잠그는 것이 아니다.** `disabled` 도 `pointer-events:none` 도 쓰지 않는다.
   * 순서를 건너뛴 학생은 접힌 칸을 열어 적으면 된다 (AGENTS.md §2.1).
   * 앞으로 올 STEP 도 지우지 않는다 — 몇 칸짜리 여정인지 보여야 자기가 어디쯤인지 안다.
   */
  /** 그 STEP 의 관찰 기록이 다 찼는가. 3단계는 목표 한 칸만 본다. */
  function stepNotesWritten(st, group) {
    if (st.session.level >= 3) return hasNote(st, group.id);
    return group.steps.every((_, i) => hasNote(st, substepId(group, i)));
  }

  function stage4(st) {
    // **1단계만 다음에 할 일을 짚어 준다.** 2단계는 목록만, 3단계는 그것도 없다.
    // 짚어 주는 것은 안내이지 잠금이 아니다 — 어느 칸이든 언제든 쓸 수 있다.
    const nextKey = st.session.level === 1 ? nextUndone(st) : null;
    const doneFlags = UI.protocol.map((g) => groupDone(st, g.id));
    const unwritten = UI.protocol.map((g) => !stepNotesWritten(st, g));
    /*
     * 「지금 할 차례」는 **조작을 마쳤고 적기까지 한** 첫 STEP 의 다음이다.
     *
     * 조작만 보고 정하면 이렇게 된다 — STEP 1 의 조작을 끝내는 순간 1 이 접히는데,
     * 적지 않았으니 STEP 2 는 잠겨 있다. **아무것도 펼쳐지지 않은 화면**이 남고 학생은
     * 벽을 본다. 안 적었으면 적을 자리가 계속 펼쳐져 있어야 한다.
     */
    const nowIdx = doneFlags.findIndex((d, i) => !(d && !unwritten[i]));
    const doneCount = doneFlags.filter(Boolean).length;

    const groups = UI.protocol.map((group, gi) => {
      /*
       * **잠그는 자리는 셋을 다 지나야 한다:**
       *   ① 지금 STEP 보다 **뒤**여야 한다 — 지나온 것과 지금 것은 안 잠근다.
       *   ② 지금 STEP 의 관찰 기록이 **비어** 있어야 한다.
       *   ③ 그 STEP 을 **한 번도 열어 본 적이 없어야** 한다 — 열려 있던 것이 사라지면 고장이다.
       *
       * `<details>` 로 그리지 않는다. **열리는 척하다 안 열리는 것이 가장 나쁘다.**
       * `disabled` 도 `pointer-events` 도 안 쓴다 — 제목은 그대로 남기고, 왜 잠겼는지를 적는다.
       * 몇 칸짜리 여정인지는 계속 보여야 한다.
       */
      /**
       * **한 칸씩만 열린다.**
       *
       * 앞서는 「지금 STEP 의 기록이 비었으면 그 뒤가 전부 잠긴다」였다. 그래서 기록을
       * 채우는 순간 **뒤가 통째로 열렸다.** 선생님이 「step1의 관찰 기록을 작성하면
       * step2가 열리도록 해야지;; 왜 나머지 step들 까지도 다 열려」라고 하셨다.
       *
       * 열 수 있는 데까지를 먼저 정한다 — 지금 STEP 을 안 적었으면 거기까지,
       * 적었으면 **딱 한 칸 더.** 그 너머는 잠근다.
       */
      const openableUpTo = nowIdx < 0 ? UI.protocol.length
        : (unwritten[nowIdx] ? nowIdx : nowIdx + 1);
      const lockedBy = gi > openableUpTo && !everOpened.has(group.id)
        ? UI.protocol[Math.min(openableUpTo, UI.protocol.length - 1)].id : null;
      if (lockedBy) {
        return `<div class="note-step note-step--locked" data-step-group="${group.id}"
          data-state="locked">
          <div class="step-summary">
            <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
            <span class="step-open-hint">${N.stepLockedHint}</span>
          </div>
          <p class="step-locked-why">${N.stepLockedWhy(lockedBy)}</p>
        </div>`;
      }
      const isDone = doneFlags[gi];
      const isNow = gi === nowIdx;
      const state = isDone ? 'done' : (isNow ? 'now' : 'later');
      // 손으로 여닫은 것이 있으면 그것이 이긴다. 없으면 지금 할 STEP 만 펼친다.
      const open = manualOpen.has(group.id) ? manualOpen.get(group.id) : isNow;
      /**
       * **실제로 펼쳐졌을 때만** 「열어 본 것」으로 담는다.
       *
       * 앞서는 `if (!lockedBy) everOpened.add(...)` 였다 — **잠기지 않은 것을 전부** 담았다.
       * 그러면 자물쇠가 죽는다: 조작은 안 하고 지금 STEP 의 기록만 먼저 채우면 잠글 조건이
       * 사라져 다섯이 통째로 「열어 본 것」이 되고, **그 뒤로 무엇을 해도 영영 안 잠긴다.**
       * 재 봤다 — 기록을 도로 지워도 잠긴 개수가 0 이었다. 화면은 멀쩡하고 검사도 초록불이었다.
       * (osmosis 가 찾고 허브가 여덟에 돌렸다.)
       *
       * 「열려 있던 것이 사라지면 고장」을 막자는 것이지 **「한 번 안 잠겼으면 영영 안 잠긴다」가
       * 아니다.** 담는 기준이 「안 잠겼다」가 아니라 **「펼쳐졌다」**여야 하는 이유다.
       */
      if (open) everOpened.add(group.id);

      const steps = group.steps.map((step, i) => {
        const key = substepId(group, i);
        const done = stepDone(st, group.id, i);
        const isNext = key === nextKey;
        return `<li class="step ${done ? 'step--done' : ''} ${isNext ? 'step--next' : ''}">
          ${isNext ? `<span class="step-next">${N.stepNext}</span>` : ''}
          <span class="step-mark" aria-hidden="true">${done ? '✓' : '·'}</span>
          <span class="step-label">${step.label}</span>
          <span class="sr-only">${done ? N.stepDone : N.stepTodo}</span>
          ${field(key, st.session.notes[key], notePlaceholder(st.session.level, step), 2)}
        </li>`;
      }).join('');

      // 접힌 STEP 에도 「눌러서 열린다」를 적는다. 말하지 않으면 잠긴 것으로 읽힌다.
      const hint = isNow ? ''
        : `<span class="step-open-hint">${isDone ? N.stepReopenHint : N.stepPeekHint}</span>`;


      return `<details class="note-step" data-step-group="${group.id}"
        data-state="${state}"${open ? ' open' : ''}>
        <summary class="step-summary">
          <!-- 제목은 접혀도 h3 로 남는다. 다른 절이 전부 h3 라, 여기만 span 이면
               제목만 훑어 내려가는 학생에게 4절이 통째로 사라진다. -->
          <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
          ${isDone ? '<span class="step-done-mark" aria-hidden="true">✓</span>' : ''}
          ${isNow ? `<span class="step-now-badge">${N.stepNowBadge}</span>` : ''}
          ${hint}
        </summary>
        <div class="step-body"><ol class="steps">${steps}</ol></div>
      </details>`;
    }).join('');

    const tally = nowIdx === -1
      ? `<p class="step-tally step-tally--done">${N.stepAllDone}</p>`
      : `<p class="step-tally">${N.stepProgress(doneCount, UI.protocol.length)}</p>`;

    // 질문 ⓐ 는 원반이 떠오르는 것을 **본 직후**에 묻는다. 6단계까지 미루면
    // 기억을 더듬는 문제가 된다. 아직 안 봤으면 묻지 않는다 — 답할 수 없는 것을 묻지 않는다.
    const seenIt = st.trials.length > 0 || st.bench.beaker.floated;
    const qa = seenIt ? `<section class="note-aside">
        <h3>${N.questionA.heading}</h3>
        <p class="note-lead">${N.questionA.prompt}</p>
        ${question(st, 'qa', N.questionA.label)}
      </section>` : '';

    return `<p class="note-lead">${designSentence(st.design)}</p>
      <p class="note-lead step-lead">${N.stepLeadIn}</p>
      ${tally}
      <div id="note-step-4">${groups}</div>${qa}`;
  }

  /* ---------------- 5. 결과 ---------------- */

  function stage5(st) {
    if (st.trials.length === 0) {
      return `<h2>${UI.graph.title}</h2><p class="note-empty">${UI.graph.empty}</p>`;
    }
    const rows = st.trials.map((t) => `<tr class="${t.offDesign.length ? 'trial--off' : ''}">
      <td>${t.at + 1}</td><td>${escapeHtml(trialSummary(st, t))}</td>
    </tr>`).join('');
    return `<h2>${UI.graph.title}</h2>
      <div class="note-graph">${renderGraph(st.trials, st.design, { idPrefix: 'nb' })}</div>
      <ul class="graph-notes">${graphNotes(st.trials, st.design).map((l) => `<li>${l}</li>`).join('')}</ul>
      <table class="trial-table">
        <thead><tr><th>${N.trialNo}</th><th>${N.trialWhat}</th></tr></thead>
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
      ${N.discussionItems.map((d) => `<div class="note-q">
        <label class="note-q-label">${d.label}</label>
        ${field(`discuss.${d.key}`, st.session.notes[`discuss.${d.key}`], d.eg, 2)}
      </div>`).join('')}
    </section>` : '';

    return `${compare}${reflect}
      ${recap ? `<section class="note-aside"><h3>${N.stepNotesHeading}</h3><ul class="recap">${recap}</ul></section>` : ''}
      ${qaLine}
      ${question(st, 'q2', N.q2Label)}
      ${question(st, 'q3', N.q3Label)}
      ${question(st, 'q4', N.q4Label)}
      ${isGroup(st) ? question(st, 'q5', N.q5Label) : ''}
      ${discussion}`;
  }

  /* ---------------- 7. 자기 평가 ---------------- */

  function stage7(st) {
    const likert = N.selfEvalItems.map((item) => {
      const key = `selfeval.${item.key}`;
      const cur = st.session.notes[key];
      return `<div class="likert">
        <span class="likert-label">${item.label}</span>
        <div class="likert-scale" role="radiogroup" aria-label="${item.label}">
          ${N.likertScale.map((o) => `<button type="button" role="radio" class="likert-opt"
            data-note-set="${key}" data-value="${o.value}" aria-checked="${cur === o.value}"
            title="${o.label}">${o.value}</button>`).join('')}
        </div>
      </div>`;
    }).join('');

    const reflection = N.reflectionItems.map((item) => `<div class="note-q">
      <label class="note-q-label">${item.label}</label>
      ${field(`feedback.${item.key}`, st.session.notes[`feedback.${item.key}`], item.eg, 2)}
    </div>`).join('');


    return `<h3>${N.likertHeading}</h3>${likert}
      <h3>${N.reflectionHeading}</h3>${reflection}
      `;   // 안전 안내는 준비물 쪽(2쪽)으로 옮겼다 — 다 끝난 뒤에 읽을 것이 아니다.
  }

  const STAGE_BODY = { 1: stage1, 2: stage2, 3: stage3, 4: stage4, 5: stage5, 6: stage6, 7: stage7 };

  /* ---------------- 읽음 표시 · 보고서 ---------------- */

  function readFooter(st) {
    if (!UI.bench.lock.required.includes(activeStage)) return '';
    const read = (st.session.readStages ?? []).includes(activeStage);
    const left = UI.bench.lock.required.filter((id) => !(st.session.readStages ?? []).includes(id));
    /**
     * 예상을 세우기 전에는 3쪽에서 못 넘어간다. **`disabled` 를 쓰지 않는다.**
     *
     * 그 속성은 단추에서 포커스를 빼앗는다. 그러면 키보드로 그 단추에 닿을 수가 없고
     * 낭독기는 그냥 지나친다 — **왜 못 누르는지를 들을 방법이 사라진다.**
     * 막으면서 이유를 말하겠다는 것과 정면으로 부딪힌다.
     *
     * `aria-disabled` 는 「지금은 못 누른다」를 알리면서 포커스를 남기고,
     * `aria-describedby` 로 까닭을 함께 읽게 한다. 눌러도 안 넘어가는 것은 같다 —
     * **넘기는 쪽에서 한 번 더 본다.** 표시만 하고 안 막으면 표시가 거짓말이 된다.
     */
    const blocked = activeStage === '3' && !predictDone(st);
    /**
     * **막을 때는 지금 할 일을 말한다.** 조작변인을 안 골랐으면 예상할 칸이 화면에
     * 아예 없으므로, 「예상을 고르세요」는 없는 것을 고르라는 말이 된다.
     */
    const why = !blocked ? (left.length ? N.readLeadIn : N.readAllDone)
      : predictWhyBlocked(st);
    return `<div class="read-foot">
      <p class="note-lead" id="read-why">${why}</p>
      <button type="button" id="read-confirm" ${read ? 'data-read="true"' : ''}${
        blocked ? ' aria-disabled="true" aria-describedby="read-why"' : ''}>
        ${read ? N.readDone : N.readConfirm}</button>
    </div>`;
  }

  function renderReportSlot(st) {
    const { ready, missing } = reportReadiness(st);
    root.querySelector('#report-slot').innerHTML = ready
      ? `<button type="button" id="make-report">${N.reportButton}</button>`
      : `<details class="report-todo"><summary>${N.reportTodoHeading}</summary>
          <ul>${missing.map((m) => `<li>${m}</li>`).join('')}</ul></details>`;
    if (ready) {
      root.querySelector('#make-report').addEventListener('click', () => onReport());
      if (!wasReady) { wasReady = true; onReady(); }
    }
  }

  /* ---------------- 그리기 ---------------- */

  function render() {
    const st = store.getState();
    tabsEl.innerHTML = N.stages.map((s) => `<button type="button" role="tab"
      class="note-tab ${s.id === activeStage ? 'note-tab--on' : ''}"
      data-stage="${s.id}" aria-selected="${s.id === activeStage}">
      ${s.id}. ${s.title}${stageDone(st, s.id) ? ' ✓' : ''}</button>`).join('');
    bodyEl.innerHTML = STAGE_BODY[activeStage](st) + readFooter(st);
    renderReportSlot(st);
  }

  /**
   * 클릭은 위임으로 받는다. 다시 그릴 때마다 붙잡아 둔 노드가 문서에서 떨어져 나가는데,
   * 떨어져 나간 노드에 건 리스너는 **조용히 아무 일도 안 한다.**
   */
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-stage]');
    if (tab) { activeStage = tab.dataset.stage; render(); return; }
    const opt = e.target.closest('[data-predict]');
    if (opt) { store.dispatch('SAVE_NOTE', { step: 'predict', text: opt.dataset.predict }); return; }
    const set = e.target.closest('[data-note-set]');
    if (set) { store.dispatch('SAVE_NOTE', { step: set.dataset.noteSet, text: set.dataset.value }); return; }
    /**
     * STEP 을 손으로 여닫았다. **`toggle` 이 아니라 `summary` 의 `click` 을 듣는다.**
     *
     * `<details open>` 을 `innerHTML` 로 꽂으면 **삽입만으로 `toggle` 이 한 번 쏘인다.**
     * 그것을 들으면 「지금 할 차례라서 펼쳐진 것」이 「학생이 손으로 연 것」으로 기록되고,
     * 그 뒤로는 그 기록이 이기므로 **영영 안 접힌다.** 사람이 누른 것만 세야 한다.
     *
     * 누르는 시점에는 아직 안 열렸다(기본 동작이 그 뒤에 일어난다). 그래서 **뒤집은 값**을 적는다.
     */
    const summary = e.target.closest('.step-summary');
    if (summary) {
      const box = summary.closest('[data-step-group]');
      /**
       * **잠긴 STEP 은 여기서 아무것도 기록하지 않는다.**
       *
       * 잠긴 것은 `<div>` 라 `box.open` 이 `undefined` 이고, 그러면 `!box.open` 이 참이 되어
       * 「손으로 열었다」로 기록됐다. 그 기록은 `everOpened` 에 들어가 **다음에 그릴 때
       * 잠금을 면제**해 준다 — 아무것도 안 적고 잠긴 칸을 한 번 누르기만 하면 열렸다.
       * **관문을 통째로 지나가는 길**이었다. 재 보고 알았다:
       *
       *     처음                   1:now 2:locked 3:locked 4:locked 5:locked
       *     잠긴 3 을 눌러 봄       (그 자리에선 아무 일 없음)
       *     다시 그린 뒤            1:now 2:locked **3:later** 4:locked 5:locked
       *
       * 면제는 **실제로 펼쳐졌던 것**에만 준다. 잠긴 것은 펼쳐진 적이 없다.
       */
      if (box && box.tagName !== 'DETAILS') {
        /*
         * **잠긴 STEP 을 눌렀다.** 「열어 준 것」으로 기록하지는 않는다(그러면 관문이 없는
         * 것과 같다). 대신 **다시 그린다** — 그 사이에 기록을 다 적었으면 그 누름에 열린다.
         *
         * 이게 없으면 다 적고도 「칸에서 손을 떼야 열립니다」라고 안내해야 했다.
         * 학생이 자연스럽게 하는 일(다음 칸을 누른다)로 열리는 쪽이 낫다.
         * 자격이 안 되면 아무 일도 안 일어나고, 잠긴 까닭은 그대로 보인다.
         */
        pendingRender = false;
        render();
        return;
      }
      if (box) {
        // 누르는 시점에는 아직 안 열렸다(기본 동작이 그 뒤에 일어난다). 뒤집은 값이 새 상태다.
        const willOpen = !box.open;
        manualOpen.set(box.dataset.stepGroup, willOpen);
        /**
         * **손으로 펼친 것은 그 자리에서 「본 것」으로 담는다.**
         *
         * 펼치는 순간에는 다시 그리지 않으므로(`render()` 를 안 부른다) 그리는 쪽의
         * `if (open) everOpened.add(...)` 까지 못 간다. 그러면 그 뒤에 기록을 지웠을 때
         * **방금 손으로 펼쳐 본 STEP 이 도로 잠긴다** — 열려 있던 것이 눈앞에서 사라진다.
         * 그리는 쪽은 잠금을 먼저 판정하고 잠겼으면 일찍 돌아가므로, 거기서는 영영 못 담는다.
         */
        if (willOpen) everOpened.add(box.dataset.stepGroup);
      }
      return;
    }
    /**
     * 「이 쪽을 읽었습니다」 — 누르면 **다음 쪽으로 넘긴다.**
     *
     * 앞서는 그 자리에 ✓ 만 남고 학생이 탭을 직접 눌러 옮겨야 했다. 네 쪽을 차례로 읽는
     * 동안 매번 그래야 하니, 읽고 나서 「그래서 다음은?」 하고 멈추는 자리가 넷 생긴다.
     *
     * **넘길 곳은 자리로 고른다. 읽음 여부로 고르지 않는다.**
     * 「아직 안 읽은 쪽」으로 고르면 차례대로 읽는 동안에는 늘 맞고,
     * **4쪽을 먼저 읽어 둔 학생이 3쪽에서 누를 때만** 거꾸로 끌려간다 —
     * 차례대로만 재면 절대 안 나타나는 종류다 (허브가 다른 저장소에서 겪었다).
     *
     * 마지막 읽기 쪽(4쪽)에서는 넘길 데가 없다. **그 자리에 그대로 둔다.**
     * 4쪽은 탐구 과정이라 실험대에서 따라 하며 보는 쪽이고, 마침 그때 실험대가 열린다 —
     * 5쪽(결과)으로 보내면 아직 아무 시행도 없는 빈 쪽이 나온다.
     */
    const readBtn = e.target.closest('#read-confirm');
    if (readBtn) {
      // 막힌 단추는 눌려도 아무 일이 없다. `disabled` 를 안 쓰므로 여기서 한 번 더 본다 —
      // 화면에만 표시하고 넘기기를 안 막으면 **표시가 거짓말이 된다.**
      if (readBtn.getAttribute('aria-disabled') === 'true') return;
      store.dispatch('MARK_READ', { stage: activeStage });
      const order = UI.bench.lock.required;
      const next = order[order.indexOf(activeStage) + 1];
      if (next) { activeStage = next; render(); }
      return;
    }
  });

  /**
   * 글자를 칠 때마다 다시 그리면 커서가 튄다. `input` 으로 상태만 저장하고 화면은 그대로 두었다가,
   * 칸을 떠날 때(`change`) 한 번 다시 그린다 — 그때 첨삭이 붙는다.
   */
  /**
   * **판은 그대로 두고 단추만 제자리에서 고친다.**
   *
   * 치는 동안에는 다시 그리지 않는다(그러면 치던 칸이 갈려 나간다). 그런데 그러면
   * **다 적어 놓고도 단추가 잠긴 채** 「예상 결과를 먼저 고르고 나서 누르세요」라고 말한다.
   * 칸을 한 번 빠져나가야 풀린다는 것을 **학생이 알 길이 없다** — 다 적었는데 안 열리는
   * 화면 앞에서 멈춘다. 눌러 보면 넘어가지만, 그 전에 이미 막힌 것으로 읽는다.
   *
   * 그래서 그리지 않고 **단추의 잠금과 까닭 글자만** 바꾼다. 치던 칸은 건드리지 않는다.
   */
  function patchGate() {
    const btn = root.querySelector('#read-confirm');
    if (!btn) return;
    const st = store.getState();
    const blocked = activeStage === '3' && !predictDone(st);
    if (blocked) {
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-describedby', 'read-why');
    } else {
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('aria-describedby');
    }
    const why = root.querySelector('#read-why');
    if (why) {
      const left = UI.bench.lock.required.filter((id) => !(st.session.readStages ?? []).includes(id));
      why.textContent = blocked
        ? predictWhyBlocked(st)
        : (left.length ? N.readLeadIn : N.readAllDone);
    }
  }

  /**
   * **잠긴 STEP 의 말도 제자리에서 간다.**
   *
   * 단추만 고치면 반쪽이다 — 다 적어 놓고도 잠긴 STEP 이 「STEP 1 의 관찰 기록을 적어야
   * 여기가 열립니다」라고 말한다. **방금 적은 학생에게 거짓말을 하는 것이다.**
   *
   * 판은 안 그린다(치던 칸이 갈려 나간다). 아직 `<div>` 인 채로 남지만, **말은 지금을**
   * 말하게 한다 — 「곧 열립니다 · 칸에서 손을 떼 보세요」. 손을 떼면 그때 판이 그려지며
   * 실제로 열린다.
   */
  function patchLocks() {
    const st = store.getState();
    for (const el of root.querySelectorAll('.note-step--locked')) {
      const why = el.querySelector('.step-locked-why');
      const blockerId = why?.textContent?.match(/STEP\s*(\S+)/)?.[1];
      const blocker = UI.protocol.find((g) => g.id === blockerId);
      if (!blocker) continue;
      const ready = stepNotesWritten(st, blocker);
      const hint = el.querySelector('.step-open-hint');
      if (hint) hint.textContent = ready ? N.stepAboutToOpen : N.stepLockedHint;
      if (why) why.textContent = ready ? N.stepAboutToOpenWhy : N.stepLockedWhy(blocker.id);
    }
  }

  root.addEventListener('input', (e) => {
    const box = e.target.closest('[data-note]');
    if (!box) return;
    store.dispatch('SAVE_NOTE', { step: box.dataset.note, text: box.value });
    patchGate();          // 치는 동안에도 단추는 지금 상태를 말한다
    patchLocks();         // 잠긴 STEP 의 말도 함께
  });
  /**
   * **다시 그리기를 미루는 자리 셋.**
   *
   * 칸 하나를 채우고 **곧장 다음 칸을 누르면** 앞 칸의 `change` 가 판을 다시 그린다.
   * 그러면 방금 누른 칸이 갈려 나가고, 학생이 친 글자는 **문서에서 떨어져 나간 옛 칸**으로
   * 들어간다. 재 봤더니 그 글은 화면에도 상태에도 안 남았다 —
   * **학생 눈에는 적은 것이 그냥 사라진다.**
   *
   * 3단계에서만 드러난다. 1단계는 예상이 보기 단추라 「칸에서 칸으로」가 아예 없어서
   * **1단계로 재면 잘못된 코드도 통과한다.**
   *
   * 셋을 함께 해야 막힌다 — 누르는 동안 미루고, 쓰는 동안 미루고, **손이 떠나면 따라잡는다.**
   * 앞의 둘만 하면 미룬 그림이 영영 안 그려져 첨삭이 안 붙는다.
   */
  let pressing = false;
  let pendingRender = false;
  const typingNow = () => root.contains(document.activeElement)
    && document.activeElement.matches?.('[data-note]');
  const catchUp = () => {
    if (pendingRender && !pressing && !typingNow()) { pendingRender = false; render(); }
  };

  root.addEventListener('pointerdown', () => { pressing = true; }, true);
  root.addEventListener('pointerup', () => {
    pressing = false;
    setTimeout(catchUp, 0);          // 새 칸에 포커스가 간 뒤에 본다
  }, true);

  /**
   * **칸을 떠날 때는 한 박자 미뤄서 본다.**
   *
   * `change` 는 **포커스가 아직 정해지기 전에** 온다 — 그때 `document.activeElement` 는
   * `body` 다. 그래서 「지금 글칸에 손이 있는가」가 거짓이 되어 **곧바로 판을 그렸고**,
   * 방금 Tab 으로 들어간 칸이 갈려 나갔다. 마우스로 옮길 때는 `pointerdown` 이 먼저 와서
   * 막아 주는데 **Tab 에는 그 누름이 없다.**
   *
   * 재 봤더니 Tab 으로만 옮기면 **둘째 칸에 글이 아예 안 들어갔다**:
   *
   *     화면 ["predict 글", ""]      상태 {"predict":"predict 글"}
   *
   * 한 박자 미루면 그때는 포커스가 다음 칸에 앉아 있어 「아직 쓰는 중」으로 제대로 읽힌다.
   * 미룬 것은 손이 칸을 다 떠났을 때 `focusout` 이 따라잡는다.
   */
  root.addEventListener('change', (e) => {
    if (!e.target.closest('[data-note]')) return;
    pendingRender = true;
    setTimeout(catchUp, 0);
  });

  /**
   * 손이 칸을 떠나면 미뤄 둔 그림을 그린다. `focusout` 은 새 포커스가 정해지기 **전**에 오므로
   * 한 박자 미뤄서 본다 — 바로 보면 아직 「칸 안」으로 읽혀 영영 안 그린다.
   *
   * ── 이 줄은 **여벌이다** ────────────────────────────────────────
   * 되돌려 재 봤더니 **이것을 빼도 검사가 전부 초록불**이다. 이 저장소 구조에서는
   * 위 `change` 가 이미 따라잡기 때문이다 — 칸을 떠날 때 값이 바뀌었으면 `change` 가 오고,
   * 그때는 포커스가 이미 칸 밖이라 곧바로 그린다.
   *
   * 그런데도 지우지 않는다. 잘못 짚으면 **학생이 친 글이 사라지는** 자리라, 여벌 값이
   * 남겨 두는 값보다 훨씬 크다. 내가 「없어도 된다」고 말할 수 있는 근거는 「내가 만들어 본
   * 경로에서는 안 났다」뿐이고, 그건 **없다는 증명이 아니다.**
   * (허브는 여덟에 셋을 다 넣으라고 돌렸다. 여기서 여벌인 것은 알려 뒀다.)
   */
  root.addEventListener('focusout', () => setTimeout(catchUp, 0));

  // 글자를 치는 동안에는 다시 그리지 않는다 — 커서가 칸 끝으로 튄다.
  store.subscribe(() => {
    if (pressing || typingNow()) {
      renderReportSlot(store.getState());
      pendingRender = true;
      return;
    }
    render();
  });
  render();
  return { render, goTo(id) { activeStage = id; render(); } };
}
