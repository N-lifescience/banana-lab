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
 * ── 이름·학번을 다루는 규칙 ────────────────────────────────────────
 * 기본은 그대로다: 이 화면에서만 받고, 상태에도 브라우저 저장소에도 넣지 않으며,
 * 인쇄가 끝나면 지운다 (tests/report.test.js 가 소스에서 막고 있다).
 *
 * 예외는 하나뿐이다 — 학생이 **수업 코드를 넣고 「선생님께 제출」을 누를 때.** 그때만
 * 이름·학번이 담당 선생님의 수업으로 간다. 그 경우 화면의 안내 문구도 함께 바뀐다
 * (`R.privacySubmit`) — "저장하지 않습니다" 를 띄워 놓고 저장하지 않기 위해서다.
 */

import { renderGraph, graphNotes } from '../render/graph.js';
import { designSentence } from './design.js';
import { isGroup, escapeHtml, trialSummary } from './notebook.js';
import { UI } from './strings.js';
import { manifest } from '../manifest.js';
import { enabled as submitEnabled, findClass, submitReport } from '../../../../packages/lab-kit/net/supabase.js';

const R = UI.report;
const N = UI.notebook;

/** 값이 없으면 줄표. 빈칸을 그냥 두면 종이에서 항목이 사라진 것처럼 보인다. */
const or = (v, fallback = R.blank) => (String(v ?? '').trim() ? escapeHtml(v) : fallback);

/* ------------------------------------------------------------------ */
/* 종이 한 벌 만들기 — 여기서는 상태를 읽기만 한다                       */
/* ------------------------------------------------------------------ */

function head(st, who, group) {
  const level = UI.start.levels.find((l) => l.id === st.session.level);
  /**
   * **모둠 이름은 모둠 활동지에만, 그리고 실제로 싣는다.**
   *
   * 앞서는 `R.fields`(학교·학년·반·번호·이름)만 돌았다. 그런데 `team` 은
   * 폼에서 받고(`R.groupFields`), 제출 꾸러미에 담기고(`payloadOf`), 선생님 화면이
   * `buildSheet` 로 넘겨 주기까지 하는데 **여기서 버려지고 있었다.**
   * 모둠 활동지에 모둠 이름이 없었던 것이다 — 선생님이 인쇄물을 쌓아 놓고 보시면
   * 어느 모둠 것인지 알 방법이 없다.
   *
   * 그리고 아무도 안 읽는 것을 모아 보내고 있던 셈이라, 방금 `violations` 를 뺀 것과
   * 같은 잘못이었다. **읽거나, 안 받거나 둘 중 하나여야 한다.** 여기서는 읽는 쪽이 맞다 —
   * 모둠 활동지가 모둠 이름을 묻는 데는 이유가 있다.
   */
  const fields = group ? [...R.fields, ...R.groupFields] : R.fields;
  const rows = fields
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
  const why = st.session.notes['predict.why'];
  return `<section><h2>${R.sections.predict}</h2>
    <div class="rp-row">
      <h3>${N.predictLabel}</h3>
      <p>${or(st.session.notes.predict, R.notWritten)}</p>
      ${String(why ?? '').trim() ? `<p class="rp-sub">${R.predictWhy} — ${escapeHtml(why)}</p>` : ''}
    </div>
    <div class="rp-row"><h3>${R.designLabel}</h3><p>${escapeHtml(designSentence(st.design))}</p></div>
  </section>`;
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

/**
 * 결과 — 그래프 한 장과 시행 표.
 *
 * **어긋난 시행과 안 뜬 시행도 그대로 싣는다.** 종이에서 지우면 학생은 자기가 무엇을
 * 잘못했는지 모른 채 깨끗한 그래프만 낸다. 떨어져 나온 점을 보는 것이 배울 것이다.
 */
function results(st) {
  if (st.trials.length === 0) {
    return `<section><h2>${R.sections.result}</h2><p>${R.noTrials}</p></section>`;
  }
  const rows = st.trials.map((t) => `<tr>
    <td>${t.at + 1}</td><td>${escapeHtml(trialSummary(st, t))}</td>
  </tr>`).join('');
  return `<section><h2>${R.sections.result}</h2>
    <div class="rp-graph">${renderGraph(st.trials, st.design, { idPrefix: 'rp' })}</div>
    <ul class="rp-steps">${graphNotes(st.trials, st.design)
      .map((l) => `<li><span>${escapeHtml(l)}</span></li>`).join('')}</ul>
    <table class="rp-likert">
      <thead><tr><th>${N.trialNo}</th><th>${N.trialWhat}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function wrapup(st, group) {
  const compare = `<div class="rp-row">
    <h3>${N.predictHeading}</h3>
    <dl class="rp-pair">
      <div><dt>${N.predictRecapLabel}</dt><dd>${or(st.session.notes.predict, N.predictNone)}</dd></div>
      <div><dt>${N.actualLabel}</dt><dd>${st.trials.length
        ? escapeHtml(N.actualLead(st.trials.length)) : N.actualNotYet}</dd></div>
    </dl>
  </div>`;

  // 모둠 비교 문항은 **모둠 활동지에만** 싣는다. 혼자 한 학생의 종이에 빈칸으로 남으면
  // 답할 수 없었던 문항이 「안 한 일」로 읽힌다.
  const answers = [
    [N.qaContinueLabel, st.session.notes.qa],
    [N.q2Label, st.session.notes.q2],
    [N.q3Label, st.session.notes.q3],
    [N.q4Label, st.session.notes.q4],
    ...(group ? [[N.q5Label, st.session.notes.q5]] : []),
  ].map(([label, text]) => `
    <div class="rp-row"><h3>${label}</h3><p>${or(text, R.notWritten)}</p></div>`).join('');

  // 설계와 어긋난 시행을 스스로 돌아본 기록. 없으면 아예 싣지 않는다.
  const reflect = String(st.session.notes['reflect.off'] ?? '').trim()
    ? `<div class="rp-row"><h3>${R.reflectLabel}</h3><p>${escapeHtml(st.session.notes['reflect.off'])}</p></div>`
    : '';

  return `<section><h2>${R.sections.wrapup}</h2>${compare}${answers}${reflect}</section>`;
}

/**
 * 모둠 토의 활동 기록 — 모둠 활동지에만 실린다.
 *
 * 혼자 한 세션에서 모둠 활동지를 뽑으면 칸은 비어 있다. 그건 잘못이 아니라 쓰임새다 —
 * 모둠이 모여 손으로 채우는 종이가 된다.
 */
function discussion(st) {
  const rows = N.discussionItems.map(({ key, label }) => `
    <div class="rp-row"><h3>${escapeHtml(label)}</h3>
      <p>${or(st.session.notes[`discuss.${key}`], R.notWritten)}</p></div>`).join('');
  return `<section><h2>${R.sections.discussion}</h2>${rows}</section>`;
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

  /**
   * **종이와 화면이 같은 말을 한다.** 둘 다 판정하지 않고 같은 안내를 싣는다.
   *
   * 앞서는 `session.violations` 를 읽어 「지켰다/놓쳤다」를 찍었다. 그 기록은
   * 한 번도 채워지지 않았으므로 종이에는 늘 「세 가지를 모두 지켰습니다」가 실렸다 —
   * **학생이 무엇을 했든.** 종이가 하지도 않은 확인을 한 척했다.
   */
  const safety = `<p>${N.valuesLead}</p>`
    + `<ul class="rp-steps">${N.valuesList.map((t) => `<li><span>${escapeHtml(t)}</span></li>`).join('')}</ul>`;

  return `
    <section>
      <h2>${R.sections.selfEval}</h2>
      <table class="rp-likert">
        <thead><tr><th>${R.likertHead[0]}</th><th>${R.likertHead[1]}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${reflections}
      <div class="rp-row"><h3>${N.valuesLabel}</h3>${safety}</div>
    </section>`;
}

/**
 * 종이 한 벌.
 *
 * @param {object} st     상태
 * @param {object} who    이 화면에서만 받은 이름·학번. 상태에도 저장소에도 넣지 않는다.
 * @param {'solo'|'group'} [kind]  활동지 종류. 생략하면 세션이 정한 대로.
 */
export function buildSheet(st, who, kind) {
  /*
   * 활동지 종류는 **반드시 받는다.**
   *
   * 예전에는 없으면 `isGroup(st)` 로 떨어졌다. 그런데 제출물에는 `session.mode` 가 없으므로
   * (필요 없어서 뺐다), 선생님 화면에서 그 길로 떨어지면 **혼자 한 학생의 종이가 모둠
   * 활동지로 만들어진다** — `mode` 가 없으면 모둠이 기본값이기 때문이다.
   * 빈칸이 「안 한 일」로 읽히는 바로 그 상황이다.
   *
   * 조용히 기본값을 쓰는 대신 **여기서 멈춘다.** 부르는 쪽이 정하지 않았다면
   * 그것은 부르는 쪽의 버그이지, 종이가 대신 정해 줄 일이 아니다.
   */
  if (kind !== 'solo' && kind !== 'group') {
    throw new Error(`buildSheet: 활동지 종류가 필요합니다 (solo | group). 받은 값: ${kind}`);
  }
  const group = kind === 'group';
  return `
    ${head(st, who, group)}
    <section><h2>${R.sections.problem}</h2><p>${N.problem}</p></section>
    <section><h2>${R.sections.materials}</h2>
      <ul class="rp-steps">${N.materials.map((m) =>
        `<li><b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.role)}</span></li>`).join('')}</ul>
    </section>
    ${predict(st)}
    ${process(st)}
    ${results(st)}
    ${wrapup(st, group)}
    ${group ? discussion(st) : ''}
    ${selfEval(st)}`;
}

/* ------------------------------------------------------------------ */
/* 화면 — 이름을 받고, 종이를 채우고, 인쇄 창을 연다                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 그림을 그림 파일로 굽는 일은 하지 않는다                              */
/* ------------------------------------------------------------------ */

/**
 * 바나나랩에는 시야 SVG 를 PNG 로 구워 끼우는 단계가 있었다.
 * 스마트폰에서 「PDF로 저장」 을 누르면 시야 자리가 **까맣게** 나왔기 때문이다 —
 * 시야가 `<filter>`(흐림) · `<clipPath>` · `<pattern>` 을 id 로 참조하는 SVG 인데,
 * 인쇄 직전까지 `display:none` 안에 있으면 모바일 브라우저가 필터 영역을 못 칠했다.
 *
 * **이 실험의 그래프에는 그 셋이 하나도 없다.** 선·동그라미·네모·글자뿐이라
 * 어느 기기에서든 그대로 인쇄된다. 그래서 굽는 단계를 들어냈다 —
 * 있지도 않은 문제를 막는 코드를 남겨 두면, 다음 사람이 그것을 필요한 것으로 읽는다.
 *
 * 결과 렌더러(`src/render/beaker.js`)에 언젠가 필터가 들어가면 그때 되살린다.
 * 되살릴 코드는 `experiments/banana/src/ui/report.js` 에 **살아 있는 채로** 있다.
 */

/* ------------------------------------------------------------------ */
/* 화면 — 이름을 받고, 종이를 채우고, 인쇄 창을 연다                     */
/* ------------------------------------------------------------------ */

/** 학번 · 이름을 파일 이름 꼬리표로. 둘 다 비었으면 붙이지 않는다. */
function fileTag(who) {
  const no = R.studentNo(who.grade, who.classNo, who.number);
  const name = String(who.name ?? '').trim();
  return [no, name].filter(Boolean).join(' ');
}

/**
 * 제출용 꾸러미.
 *
 * 보고서를 **그대로 다시 그릴 수 있는 값 한 벌**이다. 그림이 아니라 시드와 파라미터라
 * 몇 KB 밖에 안 되고, 선생님 화면이 같은 그림을 다시 그린다.
 *
 * 되돌리기 기록(history)은 뺀다 — 세션 안에서만 쓰는 값이고, 통째로 보내면 꾸러미가
 * 몇 배로 커진다. 이름·학번은 여기 넣지 않는다. 그 둘은 표의 제 칸으로 따로 간다.
 */
/**
 * 제출할 때 실제로 나가는 것.
 *
 * ── 상태를 통째로 보내지 않는다 ────────────────────────────────────
 * 예전에는 `{ ...st }` 에서 되돌리기 기록만 빼서 보냈다. 그러자 **보고서가 한 번도 안 읽는
 * 것들이 함께 나갔다** — 학생이 무엇을 어떤 차례로 눌렀는지(`session.log`), 실험대에
 * 마지막으로 놓여 있던 것(`bench`), 남은 되돌리기 횟수 같은 것들이다.
 *
 * 「빼야 할 것을 뺀다」는 새 칸이 생길 때마다 조용히 새어 나간다.
 * **「보내야 할 것만 적는다」로 뒤집었다** — 목록에 없는 것은 새로 생겨도 안 나간다.
 *
 * ── 무엇이 필요한가 ────────────────────────────────────────────────
 * 선생님 화면은 이 값으로 `buildSheet()` 를 돌려 같은 종이를 다시 만든다.
 * 그러므로 **종이가 읽는 것**이 곧 보낼 것의 전부다:
 *
 *   design                  무엇을 바꾸고 무엇을 붙들어 두기로 했는가
 *   trials                  시행마다의 조건 한 벌과 걸린 시간
 *   session.level           난이도 (종이 머리말에 실린다)
 *   session.notes           학생이 적은 글 전부
 *   (session.violations 는 뺐다 — 안전을 판정하지 않게 되면서 종이가 안 읽는다.
 *    읽지도 않는 것을 모아 보내면 안 된다.)
 *
 * **`session.mode` 는 넣지 않는다.** 혼자/모둠은 이미 두 번 나간다 — 꾸러미 맨 위의
 * `kind` 와 제출 표의 `mode` 칸이다. 선생님 화면은 `p.kind ?? row.mode` 로 그쪽을 읽으므로
 * 상태 안의 `mode` 는 아무도 안 본다. 처음에는 남겨 두었는데, **아무도 안 부르는 호출 모양
 * (`kind` 없이 부르기)을 검사가 재고 있어서** 필요한 것처럼 보였다.
 * 실제로 그렇게 부르는 곳은 없다 — `tests/report.test.js` 가 그것도 확인한다.
 *
 * `tests/report.test.js` 가 **줄인 것만으로 같은 종이가 나오는지** 확인한다 —
 * 목록에서 하나라도 빠지면 종이가 달라져 빨간불이 난다.
 * `tests/privacy.test.js` 는 이 목록과 개인정보처리방침이 같은지 본다.
 */
export const SUBMIT_SESSION_KEYS = ['level', 'notes'];

export function payloadOf(st, who, kind) {
  const session = {};
  for (const key of SUBMIT_SESSION_KEYS) session[key] = st.session[key];
  return {
    kind,
    school: String(who.school ?? '').trim(),
    team: String(who.team ?? '').trim(),
    state: { design: st.design, trials: st.trials, session },
    app: UI.appTitle,
  };
}

export function createReport(root, store) {
  const fieldHtml = (f) => `
    <label class="rp-field${f.width === 'wide' ? ' rp-field--wide' : ''}">
      <span>${f.label}</span>
      <input type="text" id="rp-${f.key}" data-field="${f.key}"
        placeholder="${f.placeholder}" autocomplete="off">
    </label>`;

  const kindTabs = R.kinds.map((k) => `
    <button type="button" class="rp-kind" role="tab" data-kind="${k.id}">${k.label}</button>`).join('');

  // 제출 서버가 설정돼 있을 때만 제출 칸이 생긴다. 설정 안 한 학교에서는 화면이 지금 그대로다.
  const canSubmit = submitEnabled();
  const submitHtml = canSubmit ? `
    <label class="rp-field rp-field--wide rp-code">
      <span>${R.submit.codeLabel}</span>
      <input type="text" id="rp-code" inputmode="numeric" maxlength="6"
        placeholder="${R.submit.codePlaceholder}" autocomplete="off">
    </label>
    <p class="rp-code-hint">${R.submit.codeHint}</p>
    <p class="rp-submit-msg" id="rp-submit-msg" role="status" aria-live="polite"></p>` : '';

  // <dialog> 를 쓴다. 포커스 가두기·Esc 로 닫기·바깥 비활성화를 브라우저가 이미 해 준다.
  root.innerHTML = `
    <dialog id="report-dialog" class="report-dialog" aria-labelledby="report-title">
      <h2 id="report-title">${R.dialogTitle}</h2>
      <div class="rp-kinds" role="tablist" aria-label="${R.kindLabel}">${kindTabs}</div>
      <p class="rp-kind-note" id="rp-kind-note"></p>
      <p class="rp-privacy" id="rp-privacy">${R.privacy}</p>
      <div class="rp-fields">${R.fields.map(fieldHtml).join('')}</div>
      <div class="rp-fields rp-fields--group" id="rp-group-fields">
        ${R.groupFields.map(fieldHtml).join('')}
      </div>
      ${submitHtml}
      <p class="rp-howto">${R.howto}</p>
      <div class="rp-actions">
        <button type="button" id="rp-cancel">${R.cancel}</button>
        ${canSubmit ? `<button type="button" id="rp-submit">${R.submit.button}</button>` : ''}
        <button type="button" id="rp-make">${R.make}</button>
      </div>
    </dialog>
    <div id="report-sheet" class="report-sheet"></div>`;

  const dialog = root.querySelector('#report-dialog');
  const sheet = root.querySelector('#report-sheet');
  const inputs = [...root.querySelectorAll('[data-field]')];
  const groupFieldsEl = root.querySelector('#rp-group-fields');
  const kindNote = root.querySelector('#rp-kind-note');

  /** 어떤 활동지를 뽑는가. 열 때 세션이 정한 대로 맞춰 두고, 여기서 바꿀 수 있다. */
  let kind = 'group';

  const codeInput = root.querySelector('#rp-code');
  const submitBtn = root.querySelector('#rp-submit');
  const submitMsg = root.querySelector('#rp-submit-msg');
  const privacyEl = root.querySelector('#rp-privacy');
  /** 확인해 둔 수업. 코드를 고칠 때마다 지운다 — 옛 수업에 내는 일이 없어야 한다. */
  let klass = null;
  let sentOnce = false;
  /**
   * 보내는 중인가.
   *
   * 단추를 죽여 두지 않는다 (AGENTS.md §2.1 · tests/ui.contract.test.js). 회색 단추는
   * 왜 안 눌리는지 말해 주지 못한다. 대신 글자를 「보내는 중…」 으로 바꾸고 aria-busy 를
   * 세워 두며, 그 사이에 다시 눌린 것은 조용히 넘긴다 — 두 장이 가는 것보다 낫다.
   */
  let sending = false;

  const say = (text, kindName = '') => {
    if (!submitMsg) return;
    submitMsg.textContent = text;
    submitMsg.dataset.kind = kindName;
  };

  /**
   * 개인정보 안내는 **지금 무슨 일이 일어나는지**를 말해야 한다.
   * 제출할 수 있는 상태에서 "어디에도 저장하지 않습니다" 를 띄우면 화면이 거짓말을 한다.
   */
  function paintPrivacy() {
    if (!privacyEl) return;
    const days = klass
      ? Math.max(1, Math.ceil((new Date(klass.expires_at) - Date.now()) / 86400000))
      : null;
    privacyEl.innerHTML = days ? R.privacySubmit(days) : R.privacy;
  }

  function paintKind() {
    root.querySelectorAll('.rp-kind').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.kind === kind));
    });
    kindNote.textContent = R.kinds.find((k) => k.id === kind)?.note ?? '';
    groupFieldsEl.hidden = kind !== 'group';
  }

  root.querySelectorAll('.rp-kind').forEach((b) => {
    b.addEventListener('click', () => { kind = b.dataset.kind; paintKind(); });
  });

  /**
   * 입력한 것을 남기지 않는다. 인쇄가 끝나거나 취소되면 양쪽을 함께 지운다.
   * 문서 제목도 되돌린다 — 파일 이름에 쓰려고 잠시 바꿔 두었을 뿐이다.
   */
  const pageTitle = document.title;
  function forget() {
    inputs.forEach((el) => { el.value = ''; });
    sheet.innerHTML = '';
    document.title = pageTitle;
    // 수업 코드는 **지우지 않는다.** 개인정보가 아니고, 한 반이 30명씩 내는 동안
    // 매번 다시 치게 하면 그것만으로 수업이 멈춘다. 이름·학번은 위에서 지워진다.
    klass = null;
    sentOnce = false;
    say('');
    paintPrivacy();
  }

  if (codeInput) {
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
      klass = null;
      sentOnce = false;
      say('');
      paintPrivacy();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const who = Object.fromEntries(inputs.map((el) => [el.dataset.field, el.value]));
      const name = String(who.name ?? '').trim();
      const studentNo = R.studentNo(who.grade, who.classNo, who.number);
      const code = String(codeInput.value ?? '').trim();

      if (!name || !studentNo) return say(R.submit.needName, 'warn');
      if (code.length !== 6) return say(R.submit.needCode, 'warn');
      if (sentOnce) say(R.submit.again, 'warn');

      if (sending) return;
      sending = true;
      const label = submitBtn.textContent;
      submitBtn.textContent = R.submit.sending;
      submitBtn.setAttribute('aria-busy', 'true');
      try {
        if (!klass || klass.code !== code) klass = await findClass(code);
        if (!klass) { say(R.submit.badCode, 'warn'); return; }
        paintPrivacy();
        const st = store.getState();
        await submitReport({
          classCode: code,
          classId: klass.id,
          exp: manifest.id,
          studentNo,
          studentName: name,
          mode: isGroup(st) ? 'group' : 'solo',
          level: st.session.level,
          payload: payloadOf(st, who, kind),
        });
        sentOnce = true;
        say(R.submit.done(name), 'done');
      } catch (e) {
        console.error(e);
        say(R.submit.failed, 'warn');
      } finally {
        sending = false;
        submitBtn.textContent = label;
        submitBtn.removeAttribute('aria-busy');
      }
    });
  }

  root.querySelector('#rp-cancel').addEventListener('click', () => {
    dialog.close();
    forget();
  });

  root.querySelector('#rp-make').addEventListener('click', async () => {
    const who = Object.fromEntries(inputs.map((el) => [el.dataset.field, el.value]));
    sheet.innerHTML = buildSheet(store.getState(), who, kind);
    // 브라우저 인쇄는 문서 제목을 파일 이름의 기본값으로 쓴다.
    // 서른 명이 낸 파일 이름이 전부 같으면 받는 쪽에서 누구 것인지 알 수 없다.
    document.title = R.fileName(UI.appTitle, fileTag(who));
    dialog.close();
    // 굽는 단계가 없다 — 이 실험의 그래프에는 필터가 없다 (위 머리말 참조).
    window.print();
  });

  // 인쇄 창이 닫히면(저장했든 취소했든) 이름이 화면에 남아 있을 이유가 없다.
  window.addEventListener('afterprint', forget);

  return {
    /** @param {{classCode?: string}} [opts]  주소(?code=)로 들어온 수업 코드 */
    open(opts = {}) {
      forget();
      if (codeInput && opts.classCode && !codeInput.value) {
        codeInput.value = String(opts.classCode).replace(/\D/g, '').slice(0, 6);
      }
      kind = isGroup(store.getState()) ? 'group' : 'solo';
      paintKind();
      dialog.showModal();
      inputs[0]?.focus();
    },
  };
}
