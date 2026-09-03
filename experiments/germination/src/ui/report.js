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
 */

import { renderComparison } from '../render/chamber.js';
import { renderGraph, resultNotes } from '../render/graph.js';
import { isGroup } from './notebook.js';
import { actualSummary, escapeHtml } from './notebook.js';
import { UI } from './strings.js';
import { manifest } from '../manifest.js';

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
   * **모둠 활동지에는 모둠 칸도 함께 돈다.**
   *
   * 앞서는 `R.fields` 만 돌아서 **모둠 이름이 종이에서 통째로 빠졌다.** 화면에서는
   * 받아 놓고 종이에는 안 실었으니, 모둠으로 낸 종이를 받아 든 선생님은 **누가 낸 것인지
   * 알 수가 없다** — 이름은 개인 것이고, 모둠 활동지에서 묶는 단위는 모둠이다.
   *
   * 개별 활동지에서는 **아예 안 낸다.** 빈 칸으로 남기면 「안 한 일」 처럼 보인다
   * (`R.kinds` 가 개별 활동지에서 토의 기록을 빼는 것과 같은 이유다).
   * 비어 있는 칸은 지금처럼 걸러진다.
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
  const rows = N.predictTopics.map(({ id, title }) => {
    const why = st.session.notes[`predict.why.${id}`];
    return `
      <div class="rp-row">
        <h3>${title}</h3>
        <p>${or(st.session.notes[`predict.${id}`], R.notWritten)}</p>
        ${String(why ?? '').trim() ? `<p class="rp-sub">${R.predictWhy} — ${escapeHtml(why)}</p>` : ''}
      </div>`;
  }).join('');
  return `<section><h2>${R.sections.predict}</h2>${rows}</section>`;
}

/**
 * 탐구 과정. **빈 칸도 그대로 싣는다** — 단, **화면이 적을 칸을 준 자리만.**
 *
 * 빈 칸을 싣는 것은 「어디를 건너뛰었는지」를 말하기 위해서다. 그런데 애초에 적을 칸을
 * 주지 않은 단계까지 「적지 않았습니다」로 찍으면, 학생이 **건너뛴 적 없는 일을 건너뛴
 * 것처럼** 보이게 만든다 — 선생님이 종이만 보고 그렇게 읽는다.
 * micrometer 는 기록칸을 열일곱에서 일곱으로 줄이면서 종이를 안 따라오게 두어, 적을 칸을
 * 준 적도 없는 열 칸에 「적지 않았습니다」를 달았다. 여기서는 같은 자리를 함께 고친다.
 *
 * **난이도를 함께 본다.** 1·2단계는 `note` 가 붙은 세부 단계 일곱 칸이고, 3단계는 절차를
 * 안 주므로 **STEP 마다 한 칸**(키가 `'1'`~`'6'`)이다. 난이도를 안 보면 3단계에서 학생이
 * 적은 여섯 칸이 종이에서 통째로 사라지고, 그 자리에 적을 칸을 준 적도 없는 일곱 칸이
 * 「적지 않았습니다」로 찍힌다 — **한 장에 두 가지 거짓말이 함께 난다.**
 *
 * 「탐구 과정 절의 빈칸 수 = 화면의 기록칸 수」는 `tests/notebook-steps.test.js` 가
 * 난이도 셋 모두에서 박아 둔다.
 */
function process(st) {
  const groups = UI.protocol.map((g) => {
    // 3단계 — 화면도 STEP 하나에 칸 하나였다. 종이도 그렇게 적는다.
    if (st.session.level >= 3) {
      const items = g.steps.map((s) => `<li><b>${escapeHtml(s.label)}</b></li>`).join('');
      return `<div class="rp-row"><h3>STEP ${g.id} · ${escapeHtml(g.title)}</h3>`
        + `<ul class="rp-steps">${items}</ul>`
        + `<p>${or(st.session.notes[g.id], R.notWritten)}</p></div>`;
    }
    const items = g.steps.map((s, i) => {
      const key = `${g.id}${String.fromCharCode(97 + i)}`;
      // 적을 칸이 없던 단계는 **한 일로만** 적는다. 빈칸을 달지 않는다.
      if (!s.note) return `<li><b>${escapeHtml(s.label)}</b></li>`;
      return `<li><b>${escapeHtml(s.label)}</b><span>${or(st.session.notes[key], R.notWritten)}</span></li>`;
    }).join('');
    return `<div class="rp-row"><h3>STEP ${g.id} · ${escapeHtml(g.title)}</h3><ul class="rp-steps">${items}</ul></div>`;
  }).join('');
  return `<section><h2>${R.sections.process}</h2>${groups}</section>`;
}

/**
 * 결과 — **두 챔버 그림이 몸통, 그래프가 보조다.**
 *
 * 화면과 같은 번호(`at`)를 쓴다. 배열 인덱스로 찾으면 중간 기록을 지운 뒤
 * 종이에 실리는 글이 한 칸씩 밀린다 — 화면은 맞고 종이만 틀린다.
 * `idPrefix` 도 번호로 붙인다. 안 그러면 종이 한 장에 같은 id 가 여러 벌 생겨
 * 에러 없이 조용히 틀린다.
 */
function results(st) {
  const caps = st.session.captures;
  if (caps.length === 0) {
    return `<section><h2>${R.sections.result}</h2><p>${R.noCaptures}</p></section>`;
  }
  const cards = caps.map((c, i) => {
    const at = c.at ?? i;
    const notes = resultNotes(c.chambers, c.comparison, c.mismatches);
    return `
    <div class="rp-capture">
      <h3>${N.captureOrdinal(i + 1)} · ${c.elapsedMin > 0 ? N.captureAt(c.elapsedMin) : N.captureNotStarted}</h3>
      ${renderComparison(c.chambers, { idPrefix: `rp${at}` })}
      <div class="rp-graph">${renderGraph([c.chambers.L, c.chambers.R], { idPrefix: `rpg${at}` })}</div>
      <ul class="rp-steps">${notes.map((t) => `<li><span>${escapeHtml(t)}</span></li>`).join('')}</ul>
      <dl class="rp-readout">
        <div><dt>${N.recordReadLabel}</dt><dd>${or(st.session.notes[`read.${at}`], R.notWritten)}</dd></div>
      </dl>
    </div>`;
  }).join('');
  return `<section><h2>${R.sections.result}</h2><div class="rp-captures">${cards}</div></section>`;
}

function wrapup(st, group) {
  const compare = N.predictTopics.map(({ id, title }) => `
    <div class="rp-row">
      <h3>${title}</h3>
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

  // **종이도 판정하지 않는다.** 화면이 「지켰는지 세지 않는다」고 해 놓고 종이만 ✓/✗ 를
  // 찍으면 둘이 다른 말을 하는 것이다. 화면과 같은 목록을 같은 뜻으로 싣는다.
  const practice = `<ul class="rp-steps">${
    N.valuesPractice.map((line) => `<li><span>${escapeHtml(line)}</span></li>`).join('')}</ul>`;

  return `
    <section>
      <h2>${R.sections.selfEval}</h2>
      <table class="rp-likert">
        <thead><tr><th>${R.likertHead[0]}</th><th>${R.likertHead[1]}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${reflections}
      <div class="rp-row"><h3>${N.valuesLabel}</h3>${practice}</div>
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

/**
 * 결과 그림을 인쇄 전에 **PNG 로 굽는다.**
 *
 * ── 왜 굽는가 ──────────────────────────────────────────────────────
 * 바나나랩에서 스마트폰·태블릿으로 「PDF로 저장」을 누르면 그림 자리가 **까맣게** 나왔다.
 * 그 SVG 가 인쇄 직전까지 `display:none` 안에 들어 있는데, 모바일 브라우저는 이 조합에서
 * 칠하지 못하고 검은 사각형을 남긴다 — 화면에서는 멀쩡해서 눈치채기 어렵다.
 *
 * 그래서 인쇄를 걸기 전에 **화면에 그릴 수 있는 것을 그대로 캔버스에 구워** `<img>` 로 바꾼다.
 * 이미지가 되고 나면 인쇄는 그냥 그림 한 장을 얹는 일이라 어느 기기에서도 같다.
 * 굽는 데 실패하면 원래 SVG 를 그대로 둔다 — 데스크톱에서는 그쪽이 더 선명하다.
 *
 * ── 가로세로 비를 `viewBox` 에서 가져온다 ──────────────────────────
 * 정사각형으로 박아 두면 챔버(400×300)와 그래프(460×340)가 눌려 그려진다.
 * **온도계 기둥 높이를 견주는 그림에서 세로가 눌리면 견줄 것이 없어진다.**
 */
const PNG_LONG_PX = 720;

function svgToPng(svgEl) {
  return new Promise((resolve) => {
    let src;
    const w = PNG_LONG_PX;
    let h = PNG_LONG_PX;
    try {
      const vb = (svgEl.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
      if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
        h = Math.round((PNG_LONG_PX * vb[3]) / vb[2]);
      }
      const clone = svgEl.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(w));
      clone.setAttribute('height', String(h));
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
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // 흰 바탕을 먼저 깐다. 그림 바깥은 투명이라, 그대로 구우면 종이에서
        // 프린터가 알아서 칠하는 색에 맡기게 된다.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
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

async function bakeResultImages(sheet) {
  const svgs = [...sheet.querySelectorAll('.rp-capture svg')];
  if (svgs.length === 0) return;
  const alts = svgs.map((el) => (el.dataset.render === 'graph' ? UI.graph.co2Label : UI.chamber.btb));
  const all = Promise.all(svgs.map(svgToPng));
  const timer = new Promise((r) => setTimeout(() => r(null), BAKE_TIMEOUT_MS));
  const pngs = await Promise.race([all, timer]);
  if (!pngs) return;
  pngs.forEach((url, i) => {
    if (!url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = alts[i];
    svgs[i].replaceWith(img);
  });
}

/* ------------------------------------------------------------------ */
/* 화면 — 이름을 받고, 종이를 채우고, 인쇄 창을 연다                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 시야 그림을 그림 파일로 굽기 — 작은 기기의 인쇄를 위해                 */
/* ------------------------------------------------------------------ */


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
 * 제출용 꾸러미 — **보낼 것만 적는 허용 목록**이다.
 *
 * ── 왜 「뺄 것을 빼는」 방식이 아닌가 ──────────────────────────────
 * 상태를 통째로 담고 `history` 만 빼는 방식이었다. 그러면 **상태에 칸이 하나 생길 때마다
 * 조용히 새어 나간다** — 바나나랩에서 `session.log`(학생이 무엇을 어떤 차례로 눌렀는지)와
 * `session.violations` 가 그렇게 나가고 있었고, 방침에는 적혀 있지도 않았다.
 * (`violations` 는 이제 아예 없다 — 안전 수칙을 세는 것을 걷어내면서 함께 빠졌고,
 *  `privacy.html` 제2조의 그 줄도 같이 지웠다. **보내는 것이 하나 줄었다.**)
 * 활동지에 실리지도 않는 것을 보내 놓고 방침에 적는 것은 고지가 아니라 **수집**이다.
 *
 * 그래서 여기 적힌 것만 나간다. 새 칸을 보내려면 **여기에 손으로 적어야** 하고,
 * 그때 `privacy.html` 제2조도 함께 고치게 된다 (`tests/privacy.test.js` 가 맞대 본다).
 *
 * ── 줄여도 되는 근거는 기계로 확인한다 ────────────────────────────
 * `buildSheet(payloadOf(st,…).state, …)` 가 `buildSheet(st, …)` 와 **같은 종이**를 내면
 * 빠진 것이 없다. 그것만으로는 반쪽이다 — 쓸데없는 키를 더 넣어도 그 등식은 그대로
 * 성립한다. **키를 하나씩 빼 보며 종이가 달라지는지**까지 봐야 군더더기가 없다는
 * 근거가 된다. `tests/privacy.test.js` 가 양쪽을 다 본다.
 */

/**
 * 세션에서 보내는 칸. **보고서가 읽는 것만** 있다.
 *
 * `mode`(혼자/모둠)는 여기 **없다.** 표의 제 칸으로 따로 갔고,
 * 종이 종류는 `kind` 가 정한다 — 꾸러미 안에 또 담으면 같은 값이 두 벌이 된다.
 * 키를 하나씩 빼 보다가 **`mode` 만 빼도 종이가 그대로**여서 잡았다.
 */
export const SUBMIT_SESSION_KEYS = ['level', 'notes', 'captures'];

/** 상태에서 보내는 칸. 보고서는 챔버의 **지금 상태**를 읽지 않는다 — 기록만 읽는다. */
export const SUBMIT_STATE_KEYS = [];

export function payloadOf(st, who, kind) {
  const session = {};
  for (const key of SUBMIT_SESSION_KEYS) session[key] = st.session[key];
  const state = { session };
  for (const key of SUBMIT_STATE_KEYS) state[key] = st[key];
  return {
    kind,
    school: String(who.school ?? '').trim(),
    team: String(who.team ?? '').trim(),
    state,
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
  const groupFieldsEl = root.querySelector('#rp-group-fields');
  const kindNote = root.querySelector('#rp-kind-note');

  /** 어떤 활동지를 뽑는가. 열 때 세션이 정한 대로 맞춰 두고, 여기서 바꿀 수 있다. */
  let kind = 'group';

  const privacyEl = root.querySelector('#rp-privacy');
  /** 개인정보 안내. 받은 것을 보내지 않으므로 할 말은 하나뿐이다. */
  function paintPrivacy() {
    if (privacyEl) privacyEl.innerHTML = R.privacy;
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
    paintPrivacy();
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
    // 결과 그림을 구운 **뒤에** 인쇄를 연다 (svgToPng 머리말 참조).
    await bakeResultImages(sheet);
    window.print();
  });

  // 인쇄 창이 닫히면(저장했든 취소했든) 이름이 화면에 남아 있을 이유가 없다.
  window.addEventListener('afterprint', forget);

  return {
    open() {
      forget();
      kind = isGroup(store.getState()) ? 'group' : 'solo';
      paintKind();
      dialog.showModal();
      inputs[0]?.focus();
    },
  };
}
