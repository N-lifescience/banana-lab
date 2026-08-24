/**
 * 탐구 보고서 — 수행 과정과 결과를 종이 한 벌로 내보낸다.
 *
 * PDF 는 **브라우저 인쇄로 만든다.** PDF 생성 라이브러리를 넣으면 번들이 몇 배로 커지고,
 * 한글 글꼴을 통째로 실어 날라야 하며, 학교 컴퓨터에서 글자가 깨지는 날 손쓸 방법이 없다.
 * 인쇄 창의 "PDF로 저장" 은 모든 브라우저에 이미 있고, 글꼴은 그 컴퓨터 것을 쓴다.
 *
 * ── 개인정보에 대하여 ──────────────────────────────────────────────
 * 이름·학번은 **이 화면에서만** 받는다. 실험하는 동안에는 묻지 않는다.
 *   - `store` 에 넣지 않는다. 되돌리기 기록에 남고 상태를 읽는 모든 곳으로 흘러간다.
 *   - localStorage·서버 어디에도 저장하지 않는다.
 *   - 인쇄 창이 닫히면(`afterprint`) 입력칸과 종이 양쪽에서 지운다.
 * 남는 것은 학생이 저장한 PDF 파일 하나뿐이고, 그건 학생 손에 있다.
 * (AGENTS.md §6 — 학생 개인정보는 저장하지 않는다)
 */

import { SLIDE_IDS } from '../sim/state.js';
import { renderFOV } from '../render/fov.js';
import { observability } from '../sim/quality.js';
import { actualSummary, stepNoteLabel, escapeHtml } from './notebook.js';
import { UI } from './strings.js';

const R = UI.report;
const N = UI.notebook;

/** 값이 없으면 줄표. 빈칸을 그냥 두면 종이에서 항목이 사라진 것처럼 보인다. */
const or = (v, fallback = R.blank) => (String(v ?? '').trim() ? escapeHtml(v) : fallback);

/* ------------------------------------------------------------------ */
/* 종이 한 벌 만들기 — 여기서는 상태를 읽기만 한다                       */
/* ------------------------------------------------------------------ */

function head(st, who) {
  const level = UI.start.levels.find((l) => l.id === st.session.level);
  const rows = R.fields
    .filter((f) => String(who[f.key] ?? '').trim())
    .map((f) => `<div><dt>${f.label}</dt><dd>${escapeHtml(who[f.key])}</dd></div>`)
    .join('');
  return `
    <header class="rp-head">
      <h1>${R.sheetTitle}</h1>
      <dl class="rp-who">
        ${rows}
        <div><dt>${R.levelLabel}</dt><dd>${level ? level.name : R.blank}</dd></div>
        <div><dt>${R.dateLabel}</dt><dd>${R.date(new Date())}</dd></div>
      </dl>
    </header>`;
}

function predict(st) {
  const rows = SLIDE_IDS.map((id) => {
    const why = st.session.notes[`predict.why.${id}`];
    return `
      <div class="rp-row">
        <h3>${UI.slides[id]}</h3>
        <p>${or(st.session.notes[`predict.${id}`], R.notWritten)}</p>
        ${String(why ?? '').trim() ? `<p class="rp-sub">${R.predictWhy} — ${escapeHtml(why)}</p>` : ''}
      </div>`;
  }).join('');
  return `<section><h2>${R.sections.predict}</h2>${rows}</section>`;
}

/**
 * 탐구 과정. **빈 칸도 그대로 싣는다.**
 * 적은 것만 실으면 종이만 보고는 어디를 건너뛰었는지 알 수 없다 — 보고서는 그것도 말해야 한다.
 */
function process(st) {
  const groups = UI.protocol.map((g) => {
    const items = g.steps.map((s, i) => {
      const key = `${g.id}${String.fromCharCode(97 + i)}`;
      return `<li><b>${escapeHtml(s.label)}</b><span>${or(st.session.notes[key], R.notWritten)}</span></li>`;
    }).join('');
    return `<div class="rp-row"><h3>STEP ${g.id} · ${escapeHtml(g.title)}</h3><ul class="rp-steps">${items}</ul></div>`;
  }).join('');
  return `<section><h2>${R.sections.process}</h2>${groups}</section>`;
}

function results(st) {
  const caps = st.session.captures;
  if (caps.length === 0) {
    return `<section><h2>${R.sections.result}</h2><p>${R.noCaptures}</p></section>`;
  }
  const cards = caps.map((c, i) => `
    <div class="rp-capture">
      <h3>${UI.slideShort[c.slide]} · ${c.reagent ? UI.reagents[c.reagent] : UI.noReagent}</h3>
      <div class="rp-fov">${renderFOV(c, { idPrefix: `rp${i}-` })}</div>
      <dl class="rp-readout">
        <div><dt>${UI.controls.objective}</dt><dd>${UI.units.mag(c.objective)}</dd></div>
        <div><dt>${UI.observability.label}</dt><dd>${observability(c).score}</dd></div>
        <div><dt>${R.magAnswer}</dt><dd>${or(st.session.notes[`mag.${i}`])}</dd></div>
      </dl>
    </div>`).join('');
  return `<section><h2>${R.sections.result}</h2><div class="rp-captures">${cards}</div></section>`;
}

function wrapup(st) {
  const compare = SLIDE_IDS.map((id) => `
    <div class="rp-row">
      <h3>${UI.slides[id]}</h3>
      <dl class="rp-pair">
        <div><dt>${N.predictRecapLabel}</dt><dd>${or(st.session.notes[`predict.${id}`], N.predictNone)}</dd></div>
        <div><dt>${N.actualLabel}</dt><dd>${actualSummary(st, id)}</dd></div>
      </dl>
    </div>`).join('');

  const answers = [
    [N.qaContinueLabel, st.session.notes['q.a']],
    [N.q2Label, st.session.notes.q2],
    [N.q3Label, st.session.notes.q3],
  ].map(([label, text]) => `
    <div class="rp-row"><h3>${label}</h3><p>${or(text, R.notWritten)}</p></div>`).join('');

  // 세부 단계 기록은 4단계에서 이미 통째로 실었다. 여기서 또 싣지 않는다.
  return `<section><h2>${R.sections.wrapup}</h2>${compare}${answers}</section>`;
}

function selfEval(st) {
  const scale = N.likertScale;
  const rows = N.selfEvalItems.map(({ key, label }) => {
    const v = st.session.notes[`selfeval.${key}`];
    const word = scale.find((s) => s.value === v);
    return `<tr><td>${escapeHtml(label)}</td><td>${word ? `${word.value} · ${word.label}` : R.blank}</td></tr>`;
  }).join('');

  const reflections = N.reflectionItems.map(({ key, label }) => `
    <div class="rp-row"><h3>${escapeHtml(label)}</h3>
      <p>${or(st.session.notes[`feedback.${key}`], R.notWritten)}</p></div>`).join('');

  const v = st.session.violations;
  const violations = v.length
    ? `<ul class="rp-steps">${v.map((k) => `<li><span>${escapeHtml(N.violations[k] ?? k)}</span></li>`).join('')}</ul>`
    : `<p>${N.noViolations}</p>`;

  return `
    <section>
      <h2>${R.sections.selfEval}</h2>
      <table class="rp-likert">
        <thead><tr><th>${R.likertHead[0]}</th><th>${R.likertHead[1]}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${reflections}
      <div class="rp-row"><h3>${N.valuesLabel}</h3>${violations}</div>
    </section>`;
}

export function buildSheet(st, who) {
  return `
    ${head(st, who)}
    <section><h2>${R.sections.problem}</h2><p>${N.problem}</p></section>
    <section><h2>${R.sections.materials}</h2>
      <ul class="rp-steps">${N.materials.map((m) =>
        `<li><b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.role)}</span></li>`).join('')}</ul>
    </section>
    ${predict(st)}
    ${process(st)}
    ${results(st)}
    ${wrapup(st)}
    ${selfEval(st)}`;
}

/* ------------------------------------------------------------------ */
/* 화면 — 이름을 받고, 종이를 채우고, 인쇄 창을 연다                     */
/* ------------------------------------------------------------------ */

export function createReport(root, store) {
  const fields = R.fields.map((f) => `
    <label class="rp-field${f.width === 'wide' ? ' rp-field--wide' : ''}">
      <span>${f.label}</span>
      <input type="text" id="rp-${f.key}" data-field="${f.key}"
        placeholder="${f.placeholder}" autocomplete="off">
    </label>`).join('');

  // <dialog> 를 쓴다. 포커스 가두기·Esc 로 닫기·바깥 비활성화를 브라우저가 이미 해 준다.
  root.innerHTML = `
    <dialog id="report-dialog" class="report-dialog" aria-labelledby="report-title">
      <h2 id="report-title">${R.dialogTitle}</h2>
      <p class="rp-privacy">${R.privacy}</p>
      <div class="rp-fields">${fields}</div>
      <p class="rp-howto">${R.howto}</p>
      <div class="rp-actions">
        <button type="button" id="rp-cancel">${R.cancel}</button>
        <button type="button" id="rp-make">${R.make}</button>
      </div>
    </dialog>
    <div id="report-sheet" class="report-sheet"></div>`;

  const dialog = root.querySelector('#report-dialog');
  const sheet = root.querySelector('#report-sheet');
  const inputs = [...root.querySelectorAll('[data-field]')];

  /** 입력한 것을 남기지 않는다. 인쇄가 끝나거나 취소되면 양쪽을 함께 지운다. */
  function forget() {
    inputs.forEach((el) => { el.value = ''; });
    sheet.innerHTML = '';
  }

  root.querySelector('#rp-cancel').addEventListener('click', () => {
    dialog.close();
    forget();
  });

  root.querySelector('#rp-make').addEventListener('click', () => {
    const who = Object.fromEntries(inputs.map((el) => [el.dataset.field, el.value]));
    sheet.innerHTML = buildSheet(store.getState(), who);
    dialog.close();
    window.print();
  });

  // 인쇄 창이 닫히면(저장했든 취소했든) 이름이 화면에 남아 있을 이유가 없다.
  window.addEventListener('afterprint', forget);

  return {
    open() {
      forget();
      dialog.showModal();
      inputs[0]?.focus();
    },
  };
}
