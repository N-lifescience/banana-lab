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

import { renderTube } from '../render/tube.js';
import { observability } from '../sim/quality.js';
import { isGroup } from './notebook.js';
import { actualSummary, escapeHtml, stepNoteKeys } from './notebook.js';
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
  /*
   * **모둠 활동지에는 모둠 이름도 싣는다.** 화면에서는 모둠을 고르면 「모둠 이름」 칸이
   * 나오고 학생이 거기 적는데, 여기서 `R.fields` 만 돌아 **적은 것이 종이에 안 실렸다.**
   * 모둠 활동지를 여러 장 걷어 놓으면 어느 모둠 것인지 알 수 없다.
   * 혼자 활동지에는 그 칸이 화면에 안 나오므로 싣지 않는다 —
   * 안 물어본 것을 빈칸으로 찍으면 「안 한 일」 로 읽힌다.
   * (허브가 여덟에 돌린 것이고 여기서도 같았다)
   */
  const rows = (group ? [...R.fields, ...R.groupFields] : R.fields)
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
  const rows = N.predictItems.map(({ id, label }) => {
    const why = st.session.notes[`predict.why.${id}`];
    return `
      <div class="rp-row">
        <h3>${escapeHtml(label.replace(/\*\*/g, ''))}</h3>
        <p>${or(st.session.notes[`predict.${id}`], R.notWritten)}</p>
        ${String(why ?? '').trim() ? `<p class="rp-sub">${R.predictWhy} — ${escapeHtml(why)}</p>` : ''}
      </div>`;
  }).join('');
  return `<section><h2>${R.sections.predict}</h2>${rows}</section>`;
}

/**
 * 탐구 과정. **빈 칸도 그대로 싣는다 — 단, 적을 칸이 있던 자리만.**
 *
 * 빈칸을 그대로 싣는 것은 「어디를 건너뛰었는지」를 말하기 위해서다. 그런데 애초에 적을
 * 칸을 준 적도 없는 단계까지 「적지 않았습니다」로 찍으면, 학생이 건너뛴 적 없는 일을
 * 건너뛴 것처럼 보이게 만든다 — 선생님은 종이만 보고 그렇게 읽는다.
 * micrometer 가 기록칸을 줄이면서 실제로 그렇게 어긋났다.
 *
 * 그래서 `note` 가 붙은 칸만 빈칸을 보인다. 나머지는 **한 일로만** 적는다.
 * 「탐구 과정 절의 빈칸 수 = 화면의 기록칸 수」는 `tests/report.test.js` 가 못 박는다.
 *
 * ── 난이도마다 **읽는 키가 다르다** ──────────────────────────────
 * 3단계는 절차를 짚어 주지 않아 화면이 **STEP 하나에 칸 하나**를 낸다(`notes['1']`).
 * 여기서 늘 세부 단계 키(`notes['1a']`)만 읽었더니 **3단계 학생의 글이 한 자도 안 실렸고**,
 * 준 적도 없는 여덟 칸에 「적지 않았습니다」가 달렸다. 선생님 눈에는 아무것도 안 한 학생이다.
 * 어느 키를 내주는지는 `stepNoteKeys()` **한 곳**이 안다 — 화면과 종이가 갈라지지 않게.
 */
function process(st) {
  const level = st.session.level;
  const groups = UI.protocol.map((g) => {
    // 3단계 — 목표만 있었으므로 종이에도 STEP 하나에 한 줄이다. 화면에 없던 세부 단계
    // 제목을 종이에만 늘어놓으면, 학생이 받지도 않은 절차를 건너뛴 것처럼 보인다.
    const items = level >= 3
      ? `<li><span>${or(st.session.notes[g.id], R.notWritten)}</span></li>`
      : g.steps.map((s, i) => {
        const key = `${g.id}${String.fromCharCode(97 + i)}`;
        if (!s.note) return `<li><b>${escapeHtml(s.label)}</b></li>`;
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
  const cards = caps.map((c, i) => {
    // 화면과 같은 번호를 쓴다 (`at`). 배열 인덱스로 찾으면 중간 기록을 지운 뒤
    // 종이에 실리는 배율 답이 한 칸씩 밀린다 — 화면은 맞고 종이만 틀린다.
    const at = c.at ?? i;
    return `
    <div class="rp-capture">
      <h3>${i + 1}번째 · ${escapeHtml(UI.tubeKindsShort[c.kind] ?? '')}</h3>
      <div class="rp-tube">${renderTube(c, { idPrefix: `rp${at}-`, labels: true })}</div>
      <dl class="rp-readout">
        <div><dt>${N.capturePulls(c.pulls ?? 0)}</dt>
          <dd>${escapeHtml(c.clotted ? UI.layers.serum : UI.layers.plasma)}</dd></div>
        <div><dt>${UI.observability.label}</dt><dd>${observability(c).score}</dd></div>
        <div><dt>${R.hctAnswer}</dt><dd>${or(st.session.notes[`hct.${at}`])}</dd></div>
      </dl>
    </div>`;
  }).join('');
  return `<section><h2>${R.sections.result}</h2><div class="rp-captures">${cards}</div></section>`;
}

function wrapup(st, group) {
  const compare = N.predictItems.map(({ id, label }) => `
    <div class="rp-row">
      <h3>${escapeHtml(label.replace(/\*\*/g, ''))}</h3>
      <dl class="rp-pair">
        <div><dt>${N.predictRecapLabel}</dt><dd>${or(st.session.notes[`predict.${id}`], N.predictNone)}</dd></div>
        <div><dt>${N.actualLabel}</dt><dd>${actualSummary(st, id)}</dd></div>
      </dl>
    </div>`).join('');

  // 3번(다른 모둠과 비교)은 모둠 활동지에만 싣는다. 혼자 한 학생의 종이에 빈칸으로 남으면
  // 답할 수 없었던 문항이 "안 한 일" 로 읽힌다.
  const answers = [
    [N.qaContinueLabel, st.session.notes['q.a']],
    [N.q2Label, st.session.notes.q2],
    ...(group ? [[N.q3Label, st.session.notes.q3]] : []),
  ].map(([label, text]) => `
    <div class="rp-row"><h3>${label}</h3><p>${or(text, R.notWritten)}</p></div>`).join('');

  // 세부 단계 기록은 4단계에서 이미 통째로 실었다. 여기서 또 싣지 않는다.
  return `<section><h2>${R.sections.wrapup}</h2>${compare}${answers}</section>`;
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

  return `
    <section>
      <h2>${R.sections.selfEval}</h2>
      <table class="rp-likert">
        <thead><tr><th>${R.likertHead[0]}</th><th>${R.likertHead[1]}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${reflections}
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
  const group = kind ? kind === 'group' : isGroup(st);
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
/* 시야 그림을 그림 파일로 굽기 — 작은 기기의 인쇄를 위해                 */
/* ------------------------------------------------------------------ */

/**
 * 시야 SVG 를 PNG 로 바꿔 끼운다.
 *
 * 스마트폰·태블릿에서 「PDF로 저장」 을 누르면 시야 자리가 **까맣게** 나왔다.
 * 시야는 `<filter>`(흐림) · `<clipPath>` · `<pattern>` 을 id 로 참조하는 SVG 인데,
 * 그 SVG 가 인쇄 직전까지 `display:none` 안에 들어 있다. 모바일 브라우저는 이 조합에서
 * 필터 영역을 칠하지 못하고 검은 사각형을 남긴다 — 화면에서는 멀쩡해서 눈치채기 어렵다.
 *
 * 그래서 인쇄를 걸기 전에 **화면에 그릴 수 있는 것을 그대로 캔버스에 구워** `<img>` 로 바꾼다.
 * 이미지가 되고 나면 인쇄는 그냥 그림 한 장을 얹는 일이라 어느 기기에서도 같다.
 * 굽는 데 실패하면 원래 SVG 를 그대로 둔다 — 데스크톱에서는 그쪽이 더 선명하다.
 */
const FOV_PNG_PX = 720;

function svgToPng(svgEl) {
  return new Promise((resolve) => {
    let src;
    try {
      const clone = svgEl.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(FOV_PNG_PX));
      clone.setAttribute('height', String(FOV_PNG_PX));
      src = `data:image/svg+xml;charset=utf-8,${
        encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    } catch {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = FOV_PNG_PX;
        canvas.height = FOV_PNG_PX;
        const ctx = canvas.getContext('2d');
        // 흰 바탕을 먼저 깐다. 시야 원 바깥은 투명이라, 그대로 구우면 종이에서
        // 프린터가 알아서 칠하는 색에 맡기게 된다.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, FOV_PNG_PX, FOV_PNG_PX);
        ctx.drawImage(img, 0, 0, FOV_PNG_PX, FOV_PNG_PX);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 굽는 데 오래 걸려도 인쇄는 열려야 한다. 이 시간을 넘기면 있는 그대로 인쇄한다. */
const BAKE_TIMEOUT_MS = 4000;

async function bakeFovImages(sheet) {
  const svgs = [...sheet.querySelectorAll('.rp-tube svg')];
  if (svgs.length === 0) return;
  const withTimeout = Promise.all(svgs.map(svgToPng));
  const timer = new Promise((r) => setTimeout(() => r(null), BAKE_TIMEOUT_MS));
  const pngs = await Promise.race([withTimeout, timer]);
  if (!pngs) return;
  pngs.forEach((url, i) => {
    if (!url) return;
    const img = document.createElement('img');
    img.src = url;
    // `UI.zoom.scopeMode` 는 바나나(현미경)의 열쇠라 여기에는 없었다 — alt 가 undefined 로 나갔다.
    img.alt = UI.zoom.resultAlt;
    svgs[i].replaceWith(img);
  });
}

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
export function payloadOf(st, who, kind) {
  const { level, notes, captures } = st.session;
  return {
    kind,
    school: String(who.school ?? '').trim(),
    team: String(who.team ?? '').trim(),
    // **허용 목록이다 — 「빼야 할 것을 빼는」 방식이 아니다.**
    // `const { history, ...session } = st.session` 처럼 빼는 방식은 상태에 칸이 하나
    // 생길 때마다 조용히 새어 나간다. 바나나랩에서 `session.log`(학생이 무엇을 어떤
    // 차례로 눌렀는지)가 그렇게 나갔다 — 방침에 적혀 있지도 않았다.
    //
    // 여기 다섯 말고는 **선생님 화면이 쓰지 않는다.** 그 근거는 눈이 아니라 기계가
    // 확인한다: `tests/privacy.test.js` 가 (가) 이 다섯만으로 `buildSheet()` 이 같은
    // 종이를 내는지와 (나) 하나라도 빼면 종이가 달라지는지를 **양쪽 다** 본다.
    // (가)만 보면 「빠진 것이 없다」는 말이지 「군더더기가 없다」는 말이 아니다.
    // `mode`(혼자/모둠)는 여기 없다. 선생님 화면은 그것을 보고서 행의 칸에서 읽고
    // `buildSheet()` 에 인자로 넘긴다 — 두 벌로 보내면 한쪽이 언젠가 어긋난다.
    // 실제로 이 검사가 그 군더더기를 잡아냈다 (tests/privacy.test.js).
    state: { session: { level, notes, captures } },
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
          pubkey: klass.pubkey,   // 봉인용 자물쇠 — 선생님 브라우저만 열 수 있게 잠근다 (seal.js)
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
    // 시야를 그림으로 구운 **뒤에** 인쇄를 연다 (svgToPng 머리말 참조).
    await bakeFovImages(sheet);
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
