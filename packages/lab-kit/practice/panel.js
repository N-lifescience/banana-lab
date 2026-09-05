/**
 * 「실제 실험 연습」 모드가 탐구 노트에 붙이는 것 — 여덟 실험이 같은 것을 쓴다.
 *
 *   mountPracticeHead(noteRoot, ctx)   노트 머리 밑의 연습 칸: 잘 안 된 것 목록 + 「피드백 노트 PDF」
 *
 * 보고서 단추(`#report-slot`)는 숨긴다 — 연습 모드의 결과물은 보고서가 아니라 피드백 노트다.
 * 노트 자체(7쪽)는 그대로 둔다. 적고 싶은 학생은 적는다.
 *
 * ── 피드백 노트는 보고서와 같은 길로 종이가 된다 ────────────────────
 * 브라우저 인쇄 → 「PDF로 저장」. 이름·학번은 **이 창에서만** 받고, 상태에도 저장소에도 넣지 않으며,
 * 인쇄가 끝나면(`afterprint`) 지운다 — `report.js` 의 규칙 그대로 (`tests/practice.test.js` 가 소스를 본다).
 */

import { P } from './strings.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SHOW_MAX = 5;

/**
 * @typedef {object} PracticeCtx
 * @property {ReturnType<import('./feedback.js').createFeedbackLog>} feedback
 * @property {HTMLElement} host      대화상자를 붙일 빈 상자
 * @property {string} appTitle       실험 이름 (종이 제목)
 * @property {string} [levelName]    단계 이름 (종이 머리)
 */

export function mountPracticeHead(noteRoot, ctx) {
  const { feedback } = ctx;
  const reportSlot = noteRoot.querySelector('#report-slot');
  if (reportSlot) reportSlot.hidden = true;

  let slot = noteRoot.querySelector('#practice-head');
  if (!slot) {
    slot = document.createElement('section');
    slot.id = 'practice-head';
    slot.className = 'group-head practice-head';
    const head = noteRoot.querySelector('.note-head');
    if (head) head.insertAdjacentElement('afterend', slot);
    else noteRoot.prepend(slot);
  }

  function paint() {
    const items = feedback.entries().slice().reverse();   // 최근 것이 위
    const shown = items.slice(0, SHOW_MAX);
    slot.innerHTML = `
      <div class="group-head-row">
        <span class="group-badge" data-role="practice">${P.badge}</span>
        <span class="group-count">${items.length ? P.count(items.length) : P.none}</span>
      </div>
      <p class="group-hint">${P.hint}</p>
      ${shown.length ? `<ul class="fb-list">${shown.map((i) => `
        <li><span class="fb-msg">${esc(i.message)} <b>${P.times(i.count)}</b></span>
          ${i.advice ? `<span class="fb-next">→ ${esc(i.advice)}</span>` : ''}</li>`).join('')}
        ${items.length > SHOW_MAX ? `<li class="fb-more">${P.more(items.length - SHOW_MAX)}</li>` : ''}
      </ul>` : ''}
      <div class="group-actions">
        <button type="button" id="practice-note-btn">${P.noteButton}</button>
        ${ctx.formUrl ? `<a class="fb-form" id="practice-form-link" href="${esc(ctx.formUrl)}"
          download title="${P.formLinkTitle}">${P.formLink} ↓</a>` : ''}
      </div>`;
    slot.querySelector('#practice-note-btn').addEventListener('click', () => openFeedbackNote(ctx));
  }

  paint();
  feedback.subscribe(paint);
  return slot;
}

/* ------------------------------------------------------------------ */
/* 피드백 노트 — 대화상자 + 종이                                        */
/* ------------------------------------------------------------------ */

function studentNo(who) {
  const parts = [who.grade, who.classNo, who.number].map((v) => String(v ?? '').trim());
  if (parts.some((p) => !p)) return '';
  return `${parts[0]}${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}`;
}

/** 종이 한 벌. 상태를 읽기만 한다 — 순수해서 검사가 만든다. */
export function buildFeedbackSheet({ feedback, appTitle, levelName = '' }, who = {}, own = '') {
  const items = feedback.entries();
  const rows = P.fields
    .filter((f) => String(who[f.key] ?? '').trim())
    .map((f) => `<div><dt>${f.label}</dt><dd>${esc(who[f.key])}</dd></div>`).join('');
  const events = items.length
    ? `<table class="rp-likert practice-table">
        <thead><tr><th>${P.headWhat}</th><th>${P.headTimes}</th><th>${P.headNext}</th></tr></thead>
        <tbody>${items.map((i) => `<tr><td>${esc(i.message)}</td><td>${i.count}</td><td>${esc(i.advice ?? '')}</td></tr>`).join('')}</tbody>
      </table>`
    : `<p>${P.eventsNone}</p>`;
  const checklist = feedback.checklist();
  const ownLines = String(own ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const date = new Date();
  const dateText = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
  return `
    <header class="rp-head">
      <h1>${esc(P.sheetTitle(appTitle))}</h1>
      <dl class="rp-who">
        ${rows}
        ${levelName ? `<div><dt>단계</dt><dd>${esc(levelName)}</dd></div>` : ''}
        <div><dt>${P.dateLabel}</dt><dd>${dateText}</dd></div>
      </dl>
    </header>
    <section><h2>${P.sectionEvents}</h2>${events}</section>
    ${checklist.length ? `<section><h2>${P.sectionChecklist}</h2>
      <ul class="rp-steps practice-check">${checklist.map((l) => `<li><span>☐ ${esc(l)}</span></li>`).join('')}</ul></section>` : ''}
    <section><h2>${P.sectionOwn}</h2>
      ${ownLines.length ? `<ul class="rp-steps practice-check">${ownLines.map((l) => `<li><span>☐ ${esc(l)}</span></li>`).join('')}</ul>`
        : `<p>${P.ownNone}</p>`}
    </section>`;
}

export function openFeedbackNote(ctx) {
  const { host } = ctx;
  host.querySelector('#practice-dialog')?.remove();
  let sheet = document.querySelector('#practice-sheet');
  if (!sheet) {
    // 인쇄 CSS 는 `.report-sheet` 만 남기고 다 숨긴다. 대화상자 상자(#group-dialogs) 밖에 둔다.
    sheet = document.createElement('div');
    sheet.id = 'practice-sheet';
    sheet.className = 'report-sheet';
    document.body.appendChild(sheet);
  }

  const dialog = document.createElement('dialog');
  dialog.id = 'practice-dialog';
  dialog.className = 'report-dialog';
  dialog.setAttribute('aria-labelledby', 'practice-title');
  const fieldHtml = (f) => `
    <label class="rp-field${f.width === 'wide' ? ' rp-field--wide' : ''}">
      <span>${f.label}</span>
      <input type="text" id="pn-${f.key}" data-field="${f.key}" placeholder="${esc(f.placeholder)}" autocomplete="off">
    </label>`;
  dialog.innerHTML = `
    <h2 id="practice-title">${P.dialogTitle}</h2>
    <p class="rp-privacy">${P.dialogLead}</p>
    <div class="rp-fields">${P.fields.map(fieldHtml).join('')}</div>
    <label class="notes-label practice-own-label" for="pn-own">${P.ownLabel}</label>
    <textarea id="pn-own" class="note-input" rows="4" placeholder="${esc(P.ownPlaceholder)}"></textarea>
    <div class="rp-actions">
      <button type="button" id="pn-cancel">${P.cancel}</button>
      <button type="button" id="pn-make">${P.make}</button>
    </div>`;
  host.appendChild(dialog);

  const inputs = [...dialog.querySelectorAll('[data-field]')];
  const own = dialog.querySelector('#pn-own');
  const pageTitle = document.title;

  function forget() {
    inputs.forEach((el) => { el.value = ''; });
    sheet.innerHTML = '';
    document.title = pageTitle;
  }
  function close() {
    forget();
    if (dialog.open) dialog.close();
    dialog.remove();
  }

  dialog.querySelector('#pn-cancel').addEventListener('click', close);
  dialog.querySelector('#pn-make').addEventListener('click', () => {
    const who = Object.fromEntries(inputs.map((el) => [el.dataset.field, el.value]));
    sheet.innerHTML = buildFeedbackSheet(ctx, who, own.value);
    const tag = [studentNo(who), String(who.name ?? '').trim()].filter(Boolean).join(' ');
    document.title = P.fileName(ctx.appTitle, tag);
    dialog.close();
    window.print();
  });
  // 인쇄 창이 닫히면 입력칸과 종이 양쪽에서 지운다. 남는 것은 학생이 저장한 PDF 뿐이다.
  window.addEventListener('afterprint', forget, { once: true });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
  inputs[0]?.focus();
  return { close };
}
