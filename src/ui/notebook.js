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

import { SLIDE_IDS, MODES } from '../sim/state.js';
import { ASSETS } from '../assets/index.js';
import { renderFOV } from '../render/fov.js';
import { observability } from '../sim/quality.js';
import { gradeQuestion, gradeMagnification } from './grading.js';
import { EYEPIECE } from '../sim/optics.js';
import { UI } from './strings.js';
import { stepDone, groupDone, resultsDone } from '../sim/progress.js';


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
 * 예전에는 시약 이름("아이오딘–아이오딘화 칼륨")을 돌려줬다. 그런데 이 자리는 예상과
 * 견주는 자리다 — 학생이 "청람색 알갱이가 보인다" 고 예상했는데 실제 결과가 시약 이름이면
 * 견줄 것이 없다. (가) 대조군은 아예 "없음" 이라 아무 정보도 아니었다.
 * 눈으로 본 것을 말한다.
 *
 * 보고서(`report.js`)도 같은 문장을 쓴다 — 화면과 종이가 다른 말을 하면 안 된다.
 */
export function actualSummary(st, slideId) {
  const cap = [...st.session.captures].reverse().find((c) => c.slide === slideId);
  const s = st.slides[slideId];
  const stain = cap ? cap.reagent : s.stain;
  const reacted = cap ? (cap.reactionT ?? 0) : s.reactionT;

  let seen;
  if (!stain) seen = N.actualNone;
  else if (reacted < 0.7) seen = N.actualPending;
  else seen = stain === 'IKI' ? N.actualStarch : N.actualLipid;

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
const predictDone = (st) => SLIDE_IDS.every((id) => hasNote(st, `predict.${id}`));

/** 실험대가 아직 잠겨 있는가 — `bench.js` 의 `lockState()` 와 같은 것을 본다. */
const benchLocked = (st) =>
  UI.bench.lock.required.some((id) => !(st.session.readStages ?? []).includes(id));

/**
 * 이 STEP 의 관찰 기록을 **다 적었는가.**
 *
 * 3단계는 STEP 하나에 칸이 하나(목표만 준다), 1·2단계는 세부 단계마다 하나다.
 * 여기서 나오는 값이 **다음 STEP 이 열리는 조건**이다 — 안 적고 지나가면 6단계 복습과
 * 보고서에 빈칸이 남고, 학생은 그것을 제출한 뒤에야 안다.
 *
 * 무엇을 적었는지는 보지 않는다. 채점이 아니다.
 */
export function stepNotesWritten(st, group) {
  if (st.session.level >= 3) return hasNote(st, group.id);
  return group.steps.every((_, i) => hasNote(st, substepId(group, i)));
}
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
      <section class="safety-note">
        <h3>${N.valuesLabel}</h3>
        <p class="stage-text values-lead">${emph(N.valuesLead)}</p>
        <ul class="values-list">${N.valuesList.map((line) => `<li>${emph(line)}</li>`).join('')}</ul>
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
    // 무엇을 할지 모르는 채로 (가)(나)(다) 중 하나를 고르라고 하면 뜬금없다.
    // 할 일은 밝히고, 무엇이 보일지는 밝히지 않는다 — 그게 지금 묻고 있는 것이다.
    const lead = `<div class="predict-lead">${
      N.predictLeadIn.map((p) => `<p>${emph(p)}</p>`).join('')
    }</div>`;
    return lead + SLIDE_IDS.map((id) => {
      const key = `predict.${id}`;
      const val = st.session.notes[key] ?? '';
      const whyKey = `predict.why.${id}`;
      const choices = level >= 3 ? '' : `
        <div class="predict-choices" role="group" aria-label="${N.predictLabel}">
          ${N.predictOptions.map((opt) => `
            <button type="button" class="predict-opt${val === opt ? ' predict-opt--chosen' : ''}"
              data-choice="${key}" data-value="${escapeHtml(opt)}"
              aria-pressed="${val === opt}">${opt}</button>`).join('')}
        </div>`;
      const free = level === 1 ? '' : `
        <label class="notes-label" for="note-${level === 2 ? 'why' : 'predict'}-${id}">${
          level === 2 ? N.predictWhyLabel : N.predictLabel
        }</label>
        <textarea data-note="${level === 2 ? whyKey : key}"
          id="note-${level === 2 ? 'why' : 'predict'}-${id}"
          placeholder="${(level === 2 ? N.predictWhyPlaceholder : N.predictFreePlaceholder)[id]}"
          >${escapeHtml(st.session.notes[level === 2 ? whyKey : key] ?? '')}</textarea>`;
      return `
        <div class="predict-block">
          <h3>${UI.slides[id]}</h3>
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
   * 학생이 **손으로** 여닫은 STEP. 화면을 보는 방식이지 실험 기록이 아니라
   * 상태(store)에 넣지 않는다 — 넣으면 되돌리기에 쌓이고 보고서로 흘러간다.
   */
  const manualOpen = new Map();

  /**
   * 한 번이라도 **열려 본** STEP. 잠금은 여기 없는 것에만 건다.
   *
   * 「앞 STEP 을 다 적어야 뒤가 열린다」 로만 두면, 미리 훑어본 STEP 이 뒤늦게 다시 잠긴다 —
   * 학생 눈에는 **열려 있던 것이 사라진 것**이고, 그건 고장으로 읽힌다.
   */
  const everOpened = new Set();

  /**
   * 「읽었습니다」 관문을 **판을 갈지 않고 제자리에서** 다시 판정한다.
   *
   * 칸의 글은 **손이 칸을 떠날 때**(`change`) 저장된다. 그래서 예상을 다 적어 놓고도
   * 상태에는 아직 없고, 단추는 「예상 결과를 먼저 고르고 나서 누르세요」 인 채로 있다.
   * 학생은 **칸을 한 번 빠져나가야 풀린다는 것을 알 길이 없다** — 다 적었는데 안 열리는
   * 화면을 보고 고장으로 읽는다.
   *
   * 그렇다고 치는 동안 다시 그릴 수는 없다. 치던 칸이 갈려 나가면 글자가 허공으로 간다.
   * 그래서 **단추의 잠금과 까닭 글자만** 손본다.
   * (웨이브 3 의 fermentation 세션이 짚었다 — 미루기만 넣으면 이 자리가 되살아난다)
   */
  function patchGate() {
    const btn = panelEl.querySelector('#mark-read');
    if (!btn) return;
    const st = store.getState();
    const typed = {};
    panelEl.querySelectorAll('[data-note]').forEach((el) => { typed[el.dataset.note] = el.value; });
    const merged = { ...st, session: { ...st.session, notes: { ...st.session.notes, ...typed } } };
    const blocked = activeStage === '3' && !predictDone(merged);
    if (blocked) {
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-describedby', 'read-why');
    } else {
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('aria-describedby');
    }
    const why = panelEl.querySelector('#read-why');
    if (why) why.textContent = blocked ? N.readNeedsPredict : N.readLeadIn;
  }

  /**
   * 잠긴 STEP 의 **말**을 지금 적은 것에 맞춘다.
   *
   * 다 적어 놓았는데 「앞 STEP 을 먼저 적으세요」 라고 하면 **거짓말**이다. 학생은 방금
   * 적은 것이 안 세어진 줄 안다. 글은 손이 칸을 떠나야 저장되므로, 떠나기 전까지
   * 그 거짓말이 화면에 남는다.
   *
   * 잠긴 STEP 은 `<div>` 라 열어 줄 수는 없다 — 여는 것은 **누르는 순간** 일어난다
   * (`pointerdown` 에서 저장하고, 그 덕에 풀렸으면 펼친다). 여기서는 **말만** 바꾼다.
   * 열 수 있다는 것을 알려 주는 것으로 충분하고, 판을 갈지 않으니 치던 칸이 안 사라진다.
   * (웨이브 2 의 chromatography 세션이 잠금 안내도 같이 갈아야 한다고 짚었다)
   */
  function patchStepHints() {
    const st = store.getState();
    const typed = {};
    panelEl.querySelectorAll('[data-note]').forEach((el) => { typed[el.dataset.note] = el.value; });
    const merged = { ...st, session: { ...st.session, notes: { ...st.session.notes, ...typed } } };
    const nowGroup = panelEl.querySelector('details[data-step-group][data-state="now"]');
    const next = nowGroup?.nextElementSibling;
    if (!next?.classList.contains('note-step--locked')) return;
    const idx = UI.protocol.findIndex((g) => g.id === nowGroup.dataset.stepGroup);
    const ready = idx >= 0 && stepNotesWritten(merged, UI.protocol[idx]);
    const hint = next.querySelector('.step-open-hint');
    const why = next.querySelector('.step-locked-why');
    if (hint) hint.textContent = ready ? N.stepReadyHint : N.stepLockedHint;
    if (why) why.textContent = ready ? N.stepReadyWhy : N.stepLockedWhy(nowGroup.dataset.stepGroup);
  }

  /**
   * 탐구 과정 — **한 번에 한 STEP.**
   *
   * 여섯 STEP 을 한꺼번에 펼쳐 놓으면 학생이 그것을 「읽을 글」로 받는다. 주욱 읽고 내려간
   * 다음 실험대로 가서 무엇부터 할지 몰라 멈춘다. 지금 할 것 하나만 펼치면
   * 노트가 글이 아니라 **따라가는 길**이 된다.
   *
   * 「지금 STEP」은 `groupDone` 이 거짓인 **첫 STEP** 이다. **상태에서 나오므로 따로 저장하지
   * 않는다** — 실험대에서 한 일이 그대로 노트를 넘긴다.
   *
   * **접힘은 잠금이 아니다** (AGENTS.md §2.1). `<details>` 라 앞으로 올 STEP 도 눌러서 열리고,
   * 순서를 건너뛰어 실험한 학생은 거기에 적으면 된다. 눌리지 않게 죽이는 속성은 쓰지 않는다.
   *
   * 앞으로 올 STEP 을 **지우지 않는 것**도 같은 값이다 — 몇 칸짜리 여정인지 보여야
   * 학생이 자기가 어디쯤인지 안다.
   */
  function renderStage4(st) {
    const level = st.session.level;
    const groupsDone = UI.protocol.map((g) => groupDone(st, g.id));
    const doneCount = groupsDone.filter(Boolean).length;
    // 지금 STEP 의 관찰 기록이 비면 뒤 STEP 이 잠긴다. **누가 막고 있는지**를 들고 다닌다 —
    // 「열리지 않습니다」 만 띄우면 학생은 어디로 돌아가야 하는지 모른다.
    const unwritten = UI.protocol.map((g) => !stepNotesWritten(st, g));

    /*
     * 「지금 할 차례」 는 **조작을 마쳤고 적기까지 한** 첫 STEP 의 다음이다.
     *
     * 조작만 보고 정하면 이렇게 된다 — STEP 1 의 조작을 끝내는 순간 1 이 접히는데,
     * 적지 않았으니 STEP 2 는 잠겨 있다. **아무것도 펼쳐지지 않은 화면**이 남고 학생은
     * 벽을 본다. 안 적었으면 적을 자리가 계속 펼쳐져 있어야 한다.
     */
    const nowIdx = groupsDone.findIndex((d, i) => !(d && !unwritten[i]));

    const stepsHtml = UI.protocol.map((group, gi) => {
      /*
       * **한 칸씩만 열린다.**
       *
       * 앞서는 「지금 STEP 의 기록이 비었는가」 하나로 뒤를 통째로 잠갔다. 그래서 STEP 1 을
       * 적는 순간 **여섯이 한꺼번에 다 열렸다.** 학생이 STEP 1 을 적으면 열려야 하는 것은
       * **STEP 2 하나**다 — 한 번에 한 STEP 이 이 쪽의 규칙이다.
       *
       * 그래서 「어디까지 열 수 있는가」를 정한다:
       *   지금 STEP 을 아직 안 적었으면  → 지금 STEP 까지
       *   다 적었으면                   → **그 다음 하나까지**
       *
       * 그 너머는 잠근다. 다만 **한 번이라도 열어 본 것은 안 잠근다** — 열려 있던 것이
       * 눈앞에서 사라지면 고장으로 읽힌다.
       */
      const openableUpTo = nowIdx < 0 ? UI.protocol.length : (unwritten[nowIdx] ? nowIdx : nowIdx + 1);
      const lockedBy = gi > openableUpTo && !everOpened.has(group.id)
        ? UI.protocol[Math.min(openableUpTo, UI.protocol.length - 1)].id : null;
      if (lockedBy) return stepShell(group, gi, groupsDone, '', lockedBy, nowIdx);
      if (level >= 3) {
        // 3단계 — 목표만, 절차 없음
        const val = st.session.notes[group.id] ?? '';
        return stepShell(group, gi, groupsDone, `
          <label class="notes-label" for="note-${group.id}">${N.goalOnlyLabel(group.title)}</label>
          <textarea data-note="${group.id}" id="note-${group.id}">${escapeHtml(val)}</textarea>`,
        null, nowIdx);
      }
      // 읽는 순서가 아니라 하는 순서를 따라간다 — 그게 이 쪽에서 하려는 일이다.
      const done = group.steps.map((_, i) => stepDone(st, group.id, i));
      const written = group.steps.map((_, i) => Boolean(st.session.notes[substepId(group, i)]));
      // 앞에서부터 **아직 끝나지 않은 첫 칸**을 짚는다. "했는데 안 적은 칸" 을 먼저 찾으면
      // 아직 손도 안 댄 첫 칸을 건너뛰고 뒤엣것을 짚는 일이 생긴다.
      const nextIdx = group.steps.findIndex((_, i) => !(done[i] && written[i]));
      const items = group.steps.map((step, i) => {
        const id = substepId(group, i);
        // 하이라이트는 1단계에서만. 2단계는 목록만 보여 준다 (docs/06 표).
        const hi = level === 1 && i === nextIdx ? ' substep--next' : '';
        /*
         * 실험대가 아직 잠겨 있으면 **거기로 보내지 않는다.**
         *
         * 4쪽에 막 들어온 학생에게 「실험대에서 먼저 해 보세요」 라고 해 놓고 실험대는
         * 잠가 두면, 눌러 보고 아무 일도 안 일어나는 것을 겪는다. 자물쇠를 여는 단추는
         * 이 쪽 **맨 밑**(1264px 아래)에 있어서 눈에 안 들어온다.
         * 앱이 서로 다른 말을 하는 자리다 — 무엇을 누르면 되는지로 바꾼다.
         */
        const notYet = benchLocked(st) ? N.stepBenchLocked : N.stepNotYet;
        const hint = level === 1 && i === nextIdx
          ? `<p class="substep-hint">${done[i] ? N.stepWriteNow : notYet}</p>` : '';
        return `
          <li class="substep${hi}" data-done="${done[i]}">
            <div class="substep-title">
              <span class="substep-mark" aria-hidden="true">${done[i] ? '✓' : '·'}</span>
              ${step.label}
              <span class="substep-state">${done[i] ? N.stepDoneMark : N.stepTodoMark}</span>
            </div>
            ${hint}
            <label class="notes-label" for="note-${id}">${N.notesLabel}</label>
            <textarea data-note="${id}" id="note-${id}"
              placeholder="${escapeHtml(notePlaceholder(level, step))}">${escapeHtml(st.session.notes[id] ?? '')}</textarea>
          </li>`;
      }).join('');
      return stepShell(group, gi, groupsDone,
        `<ul class="substep-list">${items}</ul>${group.id === '4' ? questionA(st) : ''}`,
        null, nowIdx);
    }).join('');
    const tally = nowIdx === -1
      ? `<p class="step-tally step-tally--done">${N.stepAllDone}</p>`
      : `<p class="step-tally">${N.stepProgress(doneCount, UI.protocol.length)}</p>`;
    return `<p class="stage-text step-lead">${emph(N.stepLeadIn)}</p>
      ${tally}
      <div id="note-step-4">${stepsHtml}</div>`;
  }

  /**
   * STEP 하나를 감싸는 껍데기. 세 단계가 같은 모양이라 한 곳에서 만든다.
   *
   * **학생이 손으로 여닫은 것이 이긴다.** 없으면 지금 할 STEP 만 펼친다.
   */
  function stepShell(group, gi, groupsDone, body, lockedBy, nowIdx) {
    const isDone = groupsDone[gi];
    const isNow = gi === nowIdx;

    /*
     * 앞 STEP 의 관찰 기록이 비어 있으면 이 STEP 은 **열리지 않는다.**
     *
     * `<details>` 를 죽이는 대신 아예 다른 껍데기로 그린다 — 열리는 척하다가 안 열리는 것이
     * 가장 나쁘다. 제목은 그대로 남긴다. 몇 칸짜리 여정인지는 계속 보여야 한다.
     */
    if (lockedBy) {
      return `
        <div class="note-step note-step--locked" data-step-group="${group.id}"
          data-state="locked" data-done="false">
          <div class="step-summary">
            <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
            <span class="step-open-hint">${N.stepLockedHint}</span>
          </div>
          <p class="step-locked-why">${N.stepLockedWhy(lockedBy)}</p>
        </div>`;
    }

    const state = isDone ? 'done' : (isNow ? 'now' : 'later');
    const open = manualOpen.has(group.id) ? manualOpen.get(group.id) : isNow;

    /*
     * **「열어 본 적 있다」 는 실제로 펼쳐졌을 때만 쌓는다.**
     *
     * 잠기지 않은 것을 전부 쌓으면 자물쇠가 조용히 죽는다 — 학생이 STEP 1 의 관찰 기록만
     * 먼저 채우면 그 순간 **아무것도 안 잠기고**, 여섯이 통째로 「열어 본 것」 이 되어
     * 그 뒤로는 영영 안 잠긴다. 화면은 멀쩡하고 검사도 초록불이다.
     * (웨이브 2 의 osmosis 세션이 자기 저장소에서 잡았다. 이쪽은 STEP 1 에 칸이 있어
     *  첫 그림에서 우연히 맞아떨어졌을 뿐, 규칙 자체가 틀렸다.)
     */
    if (open) everOpened.add(group.id);
    // 접힌 STEP 에도 「눌러서 열린다」 를 적는다. 말하지 않으면 잠긴 것으로 읽힌다.
    const hint = isNow ? ''
      : `<span class="step-open-hint">${isDone ? N.stepReopenHint : N.stepPeekHint}</span>`;
    return `
      <details class="note-step" data-step-group="${group.id}"
        data-state="${state}" data-done="${isDone}"${open ? ' open' : ''}>
        <summary class="step-summary">
          <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
          ${isDone ? '<span class="step-done-mark">✓</span>' : ''}
          ${isNow ? `<span class="step-now-badge">${N.stepNowBadge}</span>` : ''}
          ${hint}
        </summary>
        <div class="step-body">${body}</div>
      </details>`;
  }

  /**
   * 질문 ⓐ — STEP 4 직후에 묻는다. **순서가 곧 논증이다** (`docs/06`).
   *
   * (가) 대조군과 (나)(다)의 색 차이를 눈으로 본 **직후**에 물어야 답이 나온다.
   * 6단계까지 미뤄서 물으면 학생은 그때 본 것을 기억으로 더듬어야 하고,
   * "왜 용액을 쓰는가" 가 눈앞의 관찰이 아니라 지식 회상 문제가 된다.
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
        <label class="notes-label" for="note-qa-step4">${N.questionA.label}</label>
        <textarea data-note="q.a" id="note-qa-step4">${escapeHtml(val)}</textarea>
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
      // 가운데 기록을 지우면 인덱스가 밀려, 아래 카드의 배율 답이 통째로 한 칸씩 어긋난다.
      const at = c.at ?? i;
      const key = `mag.${at}`;
      const domId = `note-mag-${at}`; // id 에는 '.' 을 안 쓴다 — CSS 선택자에서 클래스로 오해된다
      const saved = st.session.notes[key] ?? '';
      const check = saved !== '' ? gradeMagnification(saved, c.objective) : null;
      const eyepiece = c.eyepiece ?? EYEPIECE;
      // 제목에는 짧은 이름을 쓴다. UI.slides 는 이름에 시약까지 담고 있어서 뒤에 시약을
      // 또 붙이면 겹친다 — "(나) 아이오딘–아이오딘화 칼륨 · 아이오딘–아이오딘화 칼륨".
      return `
        <div class="capture-card">
          <div class="capture-head">
            <h3>${UI.slideShort[c.slide]} · ${c.reagent ? UI.reagents[c.reagent] : UI.noReagent}</h3>
            <button type="button" class="capture-del" data-del="${at}"
              aria-label="${N.captureDeleteLabel(i + 1)}">${N.captureDelete}</button>
          </div>
          <!-- 기록한 시야를 그대로 되살린다. 캡처가 fieldParams 한 벌을 통째로 담고 있으므로
               그때 본 것과 같은 그림이 나온다. idPrefix 를 카드마다 달리 주지 않으면
               모든 카드가 첫 카드의 흐림·잘라내기를 쓴다 — 에러 없이 조용히 틀린다.
               번호(at)로 붙인다 — 지우고 나서도 남은 카드의 접두사가 바뀌지 않는다. -->
          <div class="capture-fov">${renderFOV(c, { idPrefix: `cap${at}-` })}</div>
          <dl class="capture-readout">
            <!-- 곱할 두 수를 **둘 다** 보여 준다.
                 앞서는 대물렌즈 한 줄뿐이었고, 정작 현미경 화면의 단추에는 총배율이 적혀 있어서
                 두 숫자가 서로 달랐다 — 무엇에 무엇을 곱하라는 건지 알 수가 없었다.
                 곱한 답은 여전히 알려 주지 않는다. 그건 아래 칸이 묻는 것이다. -->
            <div><dt>${N.eyepieceLabel}</dt><dd>${UI.units.mag(eyepiece)}</dd></div>
            <div><dt>${N.objectiveLabel}</dt><dd>${UI.units.mag(c.objective)}</dd></div>
            <div><dt>${UI.observability.label}</dt><dd>${observability(c).score}</dd></div>
          </dl>
          <label class="notes-label" for="${domId}">${N.magInput}</label>
          <input type="text" inputmode="numeric" placeholder="${N.magPlaceholder}"
            data-note="${key}" id="${domId}" value="${escapeHtml(saved)}">
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
    const rows = SLIDE_IDS.map((id) => `
      <div class="predict-compare-row">
        <h4>${UI.slides[id]}</h4>
        <dl class="compare-pair">
          <dt>${N.predictRecapLabel}</dt>
          <dd>${escapeHtml(st.session.notes[`predict.${id}`] || N.predictNone)}</dd>
          <dt>${N.actualLabel}</dt>
          <dd>${actualSummary(st, id)}</dd>
        </dl>
      </div>`).join('');
    return `<section><h3>${N.predictHeading}</h3>${rows}</section>`;
  }

  function blurryCaptures(st) {
    const bySlide = new Map();
    for (const c of st.session.captures) {
      if (observability(c).score < LOW_OBSERVABILITY) bySlide.set(c.slide, c); // 최근 것으로 덮어씀
    }
    return [...bySlide.values()];
  }

  function renderReflect(st) {
    const blurry = blurryCaptures(st);
    if (blurry.length === 0) return '';
    const items = blurry.map((c) => {
      const key = `reflect.${c.slide}`;
      const chosen = st.session.notes[key];
      const options = Object.keys(UI.observability.worst).map((k) => `
        <button type="button" class="reflect-opt${chosen === k ? ' reflect-opt--chosen' : ''}"
          data-reflect="${key}" data-value="${k}">${UI.observability.worst[k]}</button>`).join('');
      const retry = chosen
        ? `<button type="button" class="reflect-retry" data-retry="${c.slide}">${N.reflectRetry}</button>`
        : '';
      return `
        <div class="reflect-item" data-slide="${c.slide}">
          <p>${N.reflectQuestion(UI.slides[c.slide])}</p>
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
  /* 7 자기 평가 — 척도 · 느낀 점 · 실제 실험에서 지킬 것(적어만 둔다). */
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

    return `
      <div id="self-eval">
        <h3>${N.likertHeading}</h3>
        ${rows}
        <h3>${N.reflectionHeading}</h3>
        ${reflections}
        <!--
          가치·태도 안내는 **2 쪽(준비물)** 에 있다. 실험을 시작하기 **전에** 읽어야 하는 것을
          다 끝낸 뒤에 보여 주는 것은 늦다. 두 곳에 두면 어디가 정본인지도 모르게 된다.
        -->
      </div>`;
  }

  const STAGE_RENDERERS = {
    1: renderStage1, 2: renderStage2, 3: renderStage3, 4: renderStage4,
    5: renderStage5, 6: renderStage6, 7: renderStage7,
  };

  /* ---------------------------------------------------------------- */

  function bindPanel() {
    // **`toggle` 이 아니라 summary 의 `click` 을 듣는다.**
    // `<details open>` 을 innerHTML 로 꽂으면 브라우저가 **삽입만으로도 `toggle` 을 한 번 쏜다** —
    // 그러면 「지금 할 차례라서 펼쳐진 것」이 「학생이 손으로 연 것」으로 기록되고,
    // 그 STEP 은 끝난 뒤에도 **영영 접히지 않는다.** micrometer 에서 직접 재현했다:
    //     toggle        STEP1 완료 → 1:done**펼침**  2:now펼침
    //     summary click STEP1 완료 → 1:done접힘     2:now펼침
    // click 은 사람이 눌렀을 때만 온다(summary 는 포커스를 받으므로 Enter·Space 도 click 이다 —
    // 키보드도 같이 산다).
    //
    // **「접어지는가」로 시험하면 두 방식이 다 통과한다** — 사람이 접으면 어느 쪽이든
    // `open=false` 가 기록되기 때문이다. **「끝내면 저절로 접히는가」로 재야** 갈린다.
    panelEl.querySelectorAll('details[data-step-group] > summary').forEach((el) => {
      el.addEventListener('click', () => {
        // 기본 동작이 아직 안 일어났으므로 `open` 은 누르기 **전**의 값이다.
        const id = el.parentElement.dataset.stepGroup;
        const willOpen = !el.parentElement.open;
        manualOpen.set(id, willOpen);

        /*
         * **여기서 담아야 한다.** 누를 때는 다시 그리지 않는다(`<details>` 가 알아서 열린다).
         * 그리는 쪽에만 두면 이렇게 새어 나간다 —
         *   손으로 STEP 4 를 펼침 → 아직 안 담김 → 학생이 기록을 지움 → 다시 그림 →
         *   잠금을 **먼저** 판정하고 잠겼으면 일찍 돌아가므로 **영영 못 담는다** →
         *   **눈앞에서 펼쳐져 있던 STEP 이 사라진다.**
         * 이 규칙이 막으려던 바로 그 모양이다. (웨이브 2 의 catalase 세션이 잡았다)
         */
        if (willOpen) everOpened.add(id);
      });
    });
    panelEl.querySelectorAll('[data-note]').forEach((el) => {
      el.addEventListener('change', () => {
        savingNote = true;
        store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });
        savingNote = false;
        // 포커스가 다음 칸에 자리잡은 **뒤에** 그린다. 지금 그리면 그 칸이 사라진다.
        setTimeout(() => { if (pendingRender && !pressing) { pendingRender = false; render(); } }, 0);
      });
      // 치는 동안에는 판을 갈지 않는다(치던 칸이 사라진다). 관문만 제자리에서 고친다.
      el.addEventListener('input', () => { patchGate(); patchStepHints(); });
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
       * 막힌 단추는 눌려도 아무 일이 없다. `disabled` 를 안 쓰므로 여기서 한 번 더 본다 —
       * 화면에만 표시하고 넘기기를 안 막으면 **표시가 거짓말이 된다.**
       *
       * ★ **DOM 의 표시가 아니라 지금 상태를 본다.** 표시는 낡을 수 있다 — 마지막 칸에
       * 적고 곧장 누르면, 그 순간 단추에 붙어 있는 `aria-disabled` 는 **적기 전의 값**이라
       * 방금 채운 칸을 못 본 채로 그 누름을 삼킨다. (germination 이 짚었다)
       */
      if (activeStage === '3' && !predictDone(store.getState())) return;
      /*
       * 누른 쪽은 끝났다. 학생이 탭을 도로 찾아 누르게 두지 않는다 — 다음 쪽으로 데려간다.
       *
       * **넘길 곳은 「자리」로 고른다. 「아직 안 읽은 쪽」으로 고르면 안 된다.**
       * 그렇게 하면 차례대로 읽는 동안에는 늘 맞고, 뒤쪽을 먼저 읽어 둔 학생이 앞쪽에서
       * 누를 때만 거꾸로 끌려간다 — 차례대로만 재는 검사로는 영영 안 보인다.
       *
       * **마지막 읽기 쪽(4)에서는 그 자리에 머문다.** 그 쪽이 「탐구 과정」이고, 누르는
       * 순간 실험대가 열린다. 다음 할 일은 다음 쪽을 읽는 것이 아니라 실험대로 가는 것이다.
       *
       * **표시할 쪽과 옮겨 갈 쪽을 헷갈리면 엉뚱한 쪽에 ✓ 가 붙는다.** 지금 쪽을 먼저 붙잡고,
       * 그 다음에 옮긴다. dispatch 가 render 를 부르므로 옮기는 것이 먼저여야 한 번만 그린다.
       */
      const stage = activeStage;
      const required = UI.bench.lock.required;
      const next = required[required.indexOf(stage) + 1];
      if (next) activeStage = next;
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
     * 예상 쪽은 예상을 세우기 전에는 넘어가지 못한다.
     *
     * 실험대 조작을 막는 것이 아니라 **노트의 진행 순서**다 (AGENTS.md 의 「막지 마라」 는
     * 조작 이야기다). 다만 막을 때는 반드시 왜 막혔는지 말한다 — 말 없는 회색 단추는
     * 학생 눈에 고장이다. 무엇을 골랐는지는 보지 않는다. 세워 봤다는 사실만 본다.
     */
    /*
     * **`disabled` 를 쓰지 않는다.**
     *
     * 그 속성은 단추에서 포커스를 빼앗는다. 그러면 키보드로 그 단추에 닿을 수가 없고,
     * 낭독기는 그냥 지나친다 — **왜 못 누르는지를 들을 방법이 사라진다.** 막으면서
     * 이유를 말하겠다는 것과 정면으로 부딪힌다 (AGENTS.md §2.1 도 같은 말이다).
     *
     * `aria-disabled` 는 「지금은 못 누른다」 를 알리면서 포커스를 남긴다. 눌러도 안 넘어가는
     * 것은 같다 — 넘기는 쪽에서 한 번 더 본다.
     */
    const blocked = activeStage === '3' && !predictDone(st);
    return `
      <div class="read-mark">
        <p id="read-why">${blocked ? N.readNeedsPredict : N.readLeadIn}</p>
        <button type="button" id="mark-read" class="read-confirm"${
          blocked ? ' aria-disabled="true" aria-describedby="read-why"' : ''}>${N.readConfirm}</button>
      </div>`;
  }

  /*
   * **누르는 동안에는 다시 그리지 않는다.**
   *
   * 학생이 실제로 하는 것은 이것이다 — 마지막 칸에 적고 **곧장** 「읽었습니다」 를 누른다.
   * 그러면 이렇게 된다:
   *
   *     누름 → 칸에서 포커스가 빠짐 → change → 저장 → **다시 그리기** →
   *     단추가 DOM 에서 사라짐 → 누름이 완성되지 못하고 **아무 일도 안 일어난다**
   *
   * `click` 은 누른 자리와 뗀 자리가 같아야 나는데, 그 사이에 단추가 갈려 버린다.
   * **두 번 눌러야 겨우 넘어간다** — 학생 눈에는 고장 난 단추다. 마우스도 손가락도 그렇다.
   * (웨이브 3 의 germination 세션이 플레이하다 찾았다. 검사 이백 개가 초록불이었다)
   *
   * 손을 뗀 **다음 차례**에 따라잡는다. `pointerup` 뒤에 `click` 이 오므로 그 뒤여야 한다.
   */
  let pressing = false;
  let pendingRender = false;
  /**
   * **저장이 부른 다시 그리기인가.**
   *
   * 칸에서 칸으로 **키보드(Tab)로** 옮기면 손가락이 화면을 누르지 않는다 — `pressing` 은
   * 거짓이다. 그리고 `change` 는 **포커스가 아직 `body` 인 동안** 온다. 그래서
   * 「지금 글칸에 손이 있는가(`typing`)」 도 거짓이다. 두 관문이 다 열린 채 판이 갈리고,
   * **막 포커스를 받으려던 다음 칸이 통째로 사라진다.** 그 뒤의 글자는 새로 그려진 판의
   * 첫 칸으로 떨어진다 — 화면 `["예상2예상0","",""]`. 실제로 그랬다.
   *
   * 관문을 「누가 눌렀나」 가 아니라 **「내가 방금 저장시켰나」** 로 옮긴다. 칸이 스스로
   * 말하므로 마우스든 Tab 이든 같은 길을 탄다.
   * (웨이브 3 의 centrifuge 세션이 `change → activeElement=BODY` 로 짚었다)
   */
  let savingNote = false;
  root.addEventListener('pointerdown', (e) => {
    pressing = true;
    /*
     * **손이 칸을 떠나기 전에 적은 것을 먼저 챙긴다.**
     *
     * 마지막 칸에 적고 곧장 다음 STEP 을 누르면, 그 글은 **아직 상태에 없다**(`change` 는
     * 포커스가 빠질 때 난다). 그래서 자물쇠가 「아직 안 적었다」 로 보고 **다음 STEP 이
     * 잠긴 채**다 — 학생은 방금 다 적어 놓고 안 열리는 화면을 본다.
     *
     * 누르는 그 순간 먼저 저장한다. 다시 그리기는 `pressing` 이 막고 있으므로
     * 화면이 갈리지 않는다. (웨이브 2 의 chromatography 세션이 4쪽에서 같은 자리를 찾았다)
     */
    const el = document.activeElement;
    if (el?.matches?.('[data-note]') && el !== e.target) {
      store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });
      /*
       * 방금 저장한 덕분에 **누른 그 STEP 이 열릴 수 있게 됐다면, 그대로 열어 준다.**
       *
       * 잠긴 STEP 은 `<details>` 가 아니라 `<div>` 라서, 누름이 아무것도 펼치지 않는다.
       * 저장만 하고 두면 학생은 **두 번 눌러야** 한다 — 한 번은 자물쇠를 풀고, 한 번은 연다.
       * 그 사이에 화면은 「열렸다」 는 신호를 주지 않으므로 첫 누름은 안 먹은 것으로 보인다.
       */
      const locked = e.target.closest?.('.note-step--locked');
      if (locked) manualOpen.set(locked.dataset.stepGroup, true);
    }
  });
  // 글칸에서 손이 떠나면 미뤄 둔 것을 따라잡는다. 다음 칸으로 옮기는 중이면
  // 그 칸이 포커스를 받은 뒤라 `typing` 이 다시 참이 되어 또 미뤄진다 — 그게 맞다.
  root.addEventListener('focusout', () => {
    setTimeout(() => { if (pendingRender && !pressing && !savingNote) { pendingRender = false; render(); } }, 0);
  });
  window.addEventListener('pointerup', () => {
    setTimeout(() => {
      pressing = false;
      if (pendingRender) { pendingRender = false; render(); }
    }, 0);
  });

  function render() {
    /*
     * **학생이 글을 쓰고 있는 동안에는 노트를 다시 그리지 않는다.**
     *
     * 칸 하나를 채우고 **곧장 다음 칸**을 누르면 이렇게 된다:
     *   앞 칸에서 포커스가 빠짐 → change → 저장 → 다시 그리기 →
     *   방금 누른 칸이 **갈려 나가고**, 학생이 친 글자는 떨어져 나간 옛 칸으로 들어간다.
     *   → **화면에는 빈 칸인데 상태에는 글이 있다.** 학생 눈에는 적은 것이 사라진 것이다.
     *
     * 실제로 그랬다 — `predict.B` 가 화면 `""` · 상태 `"둘째 예상"`.
     * (웨이브 1 의 micrometer 세션이 「두 칸을 잇달아 채우면 더 잘 걸린다」 로 짚었다)
     *
     * 손이 그 칸을 떠날 때(`focusout`) 따라잡는다.
     */
    const typing = panelEl.contains(document.activeElement)
      && document.activeElement.matches?.('[data-note]');
    if (pressing || typing || savingNote) { pendingRender = true; return; }
    const st = store.getState();
    tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.stage === activeStage));
      // 끝낸 쪽에는 표시를 남긴다. 어디가 남았는지 탭만 보고 알 수 있어야 한다 —
      // 앞 네 쪽은 실험대를 여는 조건이고, 뒤 세 쪽은 보고서를 내는 조건이다.
      tab.dataset.read = String(stageDone(st, tab.dataset.stage));
    });
    panelEl.innerHTML = STAGE_RENDERERS[activeStage](st) + readFooter(st);
    bindPanel();
    renderReportSlot(st);
  }

  store.subscribe(render);
  render();
}
