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

import { SLIDE_IDS } from '../sim/state.js';
import { ASSETS } from '../assets/index.js';
import { renderFOV } from '../render/fov.js';
import { observability } from '../sim/quality.js';
import { gradeQuestion, gradeMagnification } from './grading.js';
import { UI } from './strings.js';

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

/** notes 키 '3b' 를 "STEP 3 · 색 변화 관찰" 같은 사람이 읽는 문장으로. */
export function stepNoteLabel(key) {
  const m = /^([1-6])([a-z])?$/.exec(key);
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

export function createNotebook(root, store, { onOpenZoom, onReport }) {
  root.innerHTML = `
    <div class="note-head">
      <h1>${N.heading}</h1>
      <button type="button" id="make-report">${UI.report.button}</button>
    </div>
    <div id="note-tabs" class="note-tabs" role="tablist"></div>
    <div id="note-panel" class="note-panel"></div>`;

  // 보고서는 탐구 노트가 내놓는 것이라 여기 둔다. 여는 일만 넘기고, 만드는 일은 report.js 가 한다.
  root.querySelector('#make-report').addEventListener('click', () => onReport?.());

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
      <h3>${N.safetyHeading}</h3>
      <ul class="safety-list">${N.safetyNotes.map((n) => `<li>${n}</li>`).join('')}</ul>`;
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
    return SLIDE_IDS.map((id) => {
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

  /* ---------------------------------------------------------------- */
  /* 4 탐구 과정 — STEP 1~6. 난이도별로 절차 제시만 달리한다 (docs/06 표). */
  /* ---------------------------------------------------------------- */

  function renderStage4(st) {
    const level = st.session.level;
    const stepsHtml = UI.protocol.map((group) => {
      if (level >= 3) {
        // 3단계 — 목표만, 절차 없음
        const val = st.session.notes[group.id] ?? '';
        return `
          <section class="note-step" data-step-group="${group.id}">
            <h3>STEP ${group.id} · ${group.title}</h3>
            <label class="notes-label" for="note-${group.id}">${N.goalOnlyLabel(group.title)}</label>
            <textarea data-note="${group.id}" id="note-${group.id}">${escapeHtml(val)}</textarea>
          </section>`;
      }
      // 1단계 — 다음(아직 기록이 없는) 세부 단계를 하이라이트. 2단계 — 목록만.
      const nextIdx = level === 1
        ? group.steps.findIndex((_, i) => !st.session.notes[substepId(group, i)])
        : -1;
      const items = group.steps.map((step, i) => {
        const id = substepId(group, i);
        const hi = i === nextIdx ? ' substep--next' : '';
        return `
          <li class="substep${hi}">
            <div class="substep-title">${step.label}</div>
            <label class="notes-label" for="note-${id}">${N.notesLabel}</label>
            <textarea data-note="${id}" id="note-${id}"
              placeholder="${escapeHtml(notePlaceholder(level, step))}">${escapeHtml(st.session.notes[id] ?? '')}</textarea>
          </li>`;
      }).join('');
      return `
        <section class="note-step" data-step-group="${group.id}">
          <h3>STEP ${group.id} · ${group.title}</h3>
          <ul class="substep-list">${items}</ul>
          ${group.id === '4' ? questionA(st) : ''}
        </section>`;
    }).join('');
    return `<div id="note-step-4">${stepsHtml}</div>`;
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
    return `<div class="capture-list">${caps.map((c, i) => {
      const key = `mag.${i}`;
      const domId = `note-mag-${i}`; // id 에는 '.' 을 안 쓴다 — CSS 선택자에서 클래스로 오해된다
      const saved = st.session.notes[key] ?? '';
      const check = saved !== '' ? gradeMagnification(saved, c.objective) : null;
      // 제목에는 짧은 이름을 쓴다. UI.slides 는 이름에 시약까지 담고 있어서 뒤에 시약을
      // 또 붙이면 겹친다 — "(나) 아이오딘–아이오딘화 칼륨 · 아이오딘–아이오딘화 칼륨".
      return `
        <div class="capture-card">
          <h3>${UI.slideShort[c.slide]} · ${c.reagent ? UI.reagents[c.reagent] : UI.noReagent}</h3>
          <!-- 기록한 시야를 그대로 되살린다. 캡처가 fieldParams 한 벌을 통째로 담고 있으므로
               그때 본 것과 같은 그림이 나온다. idPrefix 를 카드마다 달리 주지 않으면
               모든 카드가 첫 카드의 흐림·잘라내기를 쓴다 — 에러 없이 조용히 틀린다. -->
          <div class="capture-fov">${renderFOV(c, { idPrefix: `cap${i}-` })}</div>
          <dl class="capture-readout">
            <!-- 대물렌즈 칸에 총배율(=접안 10 × 대물)을 적고 있었다. 이름과 값이 어긋난 데다,
                 바로 아래 "배율 입력" 이 묻는 답을 화면이 먼저 알려 주고 있었다.
                 여기는 대물렌즈 배율만 보여 준다 — 곱하는 일은 학생 몫이다. -->
            <div><dt>${UI.controls.objective}</dt><dd>${UI.units.mag(c.objective)}</dd></div>
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
      .filter(([k, v]) => /^[1-6][a-z]?$/.test(k) && v && v.trim())
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
      <section class="grade-block">
        <label class="notes-label" for="note-q3">${N.q3Label}</label>
        <textarea data-note="q3" id="note-q3">${escapeHtml(q3)}</textarea>
        ${gradeLine('q3', 'q3', q3)}
      </section>
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

    const violations = st.session.violations;
    const violationItems = violations.length
      ? violations.map((v) => `<li>${escapeHtml(N.violations[v] ?? v)}</li>`).join('')
      : `<li class="no-violations">${N.noViolations}</li>`;
    return `
      <div id="self-eval">
        <h3>${N.likertHeading}</h3>
        ${rows}
        <h3>${N.reflectionHeading}</h3>
        ${reflections}
        <div class="self-eval-item">
          <h3>${N.valuesLabel}</h3>
          <ul id="violations">${violationItems}</ul>
        </div>
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
        store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });
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
      btn.addEventListener('click', () => onOpenZoom('scope', btn.dataset.retry, btn));
    });
  }

  function render() {
    const st = store.getState();
    tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.stage === activeStage));
    });
    panelEl.innerHTML = STAGE_RENDERERS[activeStage](st);
    bindPanel();
  }

  store.subscribe(render);
  render();
}
