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

import { renderFOV } from '../render/fov.js';
import { EYEPIECE } from '../sim/optics.js';
import {
  isGroup, actualFor, escapeHtml, captureScore, resultRow, recordTable, RESULT_MAGS,
} from './notebook.js';
import { UI } from './strings.js';
import { manifest } from '../manifest.js';
import { groupHeadRows, memberAppendix } from '../../../../packages/lab-kit/group/report-part.js';

const R = UI.report;
const N = UI.notebook;

/** 값이 없으면 줄표. 빈칸을 그냥 두면 종이에서 항목이 사라진 것처럼 보인다. */
const or = (v, fallback = R.blank) => (String(v ?? '').trim() ? escapeHtml(v) : fallback);

/* ------------------------------------------------------------------ */
/* 종이 한 벌 만들기 — 여기서는 상태를 읽기만 한다                       */
/* ------------------------------------------------------------------ */

function head(st, who, group = false, groupStore = null) {
  const level = UI.start.levels.find((l) => l.id === st.session.level);
  /*
   * **모둠 활동지에는 모둠 이름을 싣는다.**
   *
   * 폼이 묻고(`R.groupFields`) 꾸러미에 담아 보내는데(`payloadOf`) **종이에는 안 나왔다** —
   * `R.fields` 만 돌고 있었다. 선생님이 인쇄물을 쌓아 놓고 보면 **어느 모둠 것인지 알 방법이
   * 없다.** 게다가 아무도 안 읽는 것을 모아 보내는 셈이라, 「종이가 안 읽는 것은 수집하지
   * 않는다」는 규칙을 같은 꾸러미의 다른 층에서 어기고 있었다.
   * (catalase 세션이 잡아 허브를 거쳐 넘겨 주었다)
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
        ${group ? groupHeadRows(groupStore) : ''}
        <div><dt>${R.levelLabel}</dt><dd>${level ? level.name : R.blank}</dd></div>
        <div><dt>${R.dateLabel}</dt><dd>${R.date(new Date())}</dd></div>
      </dl>
    </header>`;
}

function predict(st) {
  const rows = N.predictItems.map(({ key, label }) => {
    const why = st.session.notes[`predict.why.${key}`];
    return `
      <div class="rp-row">
        <h3>${escapeHtml(label)}</h3>
        <p>${or(st.session.notes[`predict.${key}`], R.notWritten)}</p>
        ${String(why ?? '').trim() ? `<p class="rp-sub">${R.predictWhy} — ${escapeHtml(why)}</p>` : ''}
      </div>`;
  }).join('');
  return `<section><h2>${R.sections.predict}</h2>${rows}</section>`;
}

/**
 * 탐구 과정.
 *
 * **적을 칸이 있던 자리만 빈칸을 보인다.**
 * 빈 칸을 그대로 싣는 것은 「어디를 건너뛰었는지」를 말하기 위해서다. 그런데 애초에
 * 적을 칸을 주지 않은 단계까지 「적지 않았습니다」로 찍으면, 학생이 건너뛴 적 없는 일을
 * 건너뛴 것처럼 보이게 만든다 — 선생님이 종이만 보고 그렇게 읽는다.
 *
 * 그래서 `note` 가 붙은 칸만 빈칸을 보인다. 나머지는 한 일로만 적는다.
 * (탐구 노트에서 기록칸을 열일곱에서 일곱으로 줄이면서 생긴 어긋남이다.)
 */
function process(st) {
  /**
   * ★ **난이도에 따라 적는 자리가 다르다. 종이도 같이 갈라져야 한다.**
   *
   * 1·2단계는 세부 단계마다 칸이 있어 `notes['3b']` 처럼 저장된다. 3단계는 절차를
   * 짚어 주지 않으므로 **STEP 하나에 칸 하나**이고 `notes['3']` 에 저장된다
   * (`notebook.js` 의 `renderStage4()` 에 있는 `level >= 3` 갈래).
   *
   * 종이가 세부 단계 키만 읽고 있었다. 그래서 **3단계로 푼 학생은 적고도 한 자도
   * 안 실렸고**, 준 적도 없는 칸에 「적지 않았습니다」가 달렸다 — 재어 보니
   * 적은 칸 6 · 실린 것 **0** · 빈칸 7 이었다. 선생님 눈에는 아무것도 안 한 학생으로 읽힌다.
   *
   * 화면 쪽 갈래만 만들고 종이 쪽을 잊은 자리다. 검사가 전부 `initialState(1)` 로
   * 종이를 만들고 있어서 아무도 못 봤다 — **난이도 축을 안 흔들어 본 것**이다.
   * (germination 세션이 자기 저장소에서 찾아 허브를 거쳐 넘겨 주었다)
   */
  const level = st.session.level;
  const groups = UI.protocol.map((g) => {
    const items = level >= 3
      // 3단계 — STEP 하나에 칸 하나. 세부 단계는 화면에도 없었으므로 종이에도 안 적는다.
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

/**
 * 결과 표 — **이 표가 이 보고서가 실제로 말하는 것이다** (설계도 §7.2).
 *
 * 왼쪽 열(한 칸의 길이)이 두 줄에서 달라야 한다는 것이 이 실험의 결론인데, 카드를 옆으로
 * 늘어놓으면 숫자가 그림에 묻힌다. 세로로 나란히 놓아야 눈에 들어온다.
 * **전부 학생이 적은 값이다.** 빈칸은 채우지 않는다 — 채우면 그 순간 답을 말한 것이 된다.
 */
function resultTable(st) {
  const T = N.resultTable;
  const rows = RESULT_MAGS.map((objective) => {
    const v = resultRow(st, objective);
    const cell = (s) => `<td>${s ? escapeHtml(s) : T.empty}</td>`;
    return `<tr><th scope="row">${T.rows[objective]}</th>
      ${cell(v.umPerDiv)}${cell(v.cellDivs)}${cell(v.cellUm)}</tr>`;
  }).join('');
  return `
    <h3>${T.heading}</h3>
    <table class="rp-likert">
      <thead><tr>${T.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * 눈금값 표 · 측정 표.
 *
 * 화면과 **같은 함수**(`recordTable`)에서 나온다. 난이도가 정한 칸만 실리므로,
 * 화면에 없던 칸이 종이에 빈칸으로 앉는 일이 없다 — 빈칸은 "안 한 일" 로 읽힌다.
 * 여기서는 학생이 적은 글을 그대로 싣기만 한다. 산술 되짚기는 종이에 싣지 않는다 —
 * 그건 고쳐 쓰라고 화면에서 하는 말이고, 다 낸 종이 위에서는 지적이 될 뿐이다.
 */
function recordSection(st, kind, heading) {
  const { fields, labels, rows } = recordTable(st, kind);
  if (rows.length === 0) return '';
  const body = rows.map((row) => `
    <tr>
      <th scope="row">${UI.units.mag(row.objective * EYEPIECE)}</th>
      ${row.values.map((v) => `<td>${or(v, N.resultTable.empty)}</td>`).join('')}
    </tr>
    ${row.used ? `<tr><td colspan="${fields.length + 1}" class="rp-sub">${row.used}</td></tr>` : ''}`).join('');
  return `
    <h3>${heading}</h3>
    <table class="rp-likert">
      <thead><tr><th></th>${fields.map((f) => `<th>${labels[f]}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function results(st) {
  const caps = st.session.captures;
  const cards = caps.map((c, i) => {
    // 화면과 같은 번호를 쓴다 (`at`). 배열 인덱스로 찾으면 중간 기록을 지운 뒤
    // 종이에 실리는 배율 답이 한 칸씩 밀린다 — 화면은 맞고 종이만 틀린다.
    const at = c.at ?? i;
    return `
    <div class="rp-capture">
      <!-- 넉 장 중 둘은 눈금 그림이고 둘은 세포 그림이다. 배율만 적혀 있으면
           종이 위에서 구분되지 않아, 무엇을 올리고 찍은 것인지 제목에 함께 적는다. -->
      <h3>${UI.stageShort[c.on] ?? ''} · ${UI.units.mag(c.objective)}</h3>
      <div class="rp-fov">${renderFOV(c, { idPrefix: `rp${at}-` })}</div>
      <dl class="rp-readout">
        <div><dt>${N.eyepieceLabel}</dt><dd>${UI.units.mag(c.eyepiece ?? EYEPIECE)}</dd></div>
        <div><dt>${N.objectiveLabel}</dt><dd>${UI.units.mag(c.objective)}</dd></div>
        <div><dt>${R.onStageLabel}</dt><dd>${UI.stageItems[c.on] ?? ''}</dd></div>
        <div><dt>${UI.observability.label}</dt><dd>${captureScore(c).score}</dd></div>
        <div><dt>${R.magAnswer}</dt><dd>${or(st.session.notes[`mag.${at}`])}</dd></div>
      </dl>
    </div>`;
  }).join('');
  return `
    <section>
      <h2>${R.sections.result}</h2>
      ${resultTable(st)}
      ${recordSection(st, 'calibration', R.resultParts.calibration)}
      ${recordSection(st, 'measurement', R.resultParts.measurement)}
      ${caps.length === 0 ? `<p>${R.noCaptures}</p>` : `<div class="rp-captures">${cards}</div>`}
    </section>`;
}

function wrapup(st, group) {
  const compare = N.predictItems.map(({ key, label }) => `
    <div class="rp-row">
      <h3>${escapeHtml(label)}</h3>
      <dl class="rp-pair">
        <div><dt>${N.predictRecapLabel}</dt><dd>${or(st.session.notes[`predict.${key}`], N.predictNone)}</dd></div>
        <div><dt>${N.actualLabel}</dt><dd>${actualFor(st, key)}</dd></div>
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

/**
 * 종이에는 `**굵게**` 표시를 쓰지 않는다 — 인쇄물이고, 화면처럼 태그로 바꿔 주는 자리가
 * 없어서 **별표가 그대로 찍힌다.** 강조는 걷어내고 글자만 싣는다.
 */
const stripEmph = (t) => escapeHtml(t.replace(/\*\*(.+?)\*\*/g, '$1'));

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
   * 가치·태도 — **종이도 화면과 같은 안내를 싣는다.**
   *
   * 앞서는 지켜본 결과(`session.violations`)를 찍었다. 그 지켜보기를 걷어냈으므로
   * 종이도 같이 바뀌어야 한다 — **화면과 종이가 다른 말을 하면 안 된다.**
   * 학생이 무엇을 했는지는 싣지 않는다. 판정한 것이 없기 때문이다.
   */
  const values = `<ul class="rp-steps">${
    N.valuesItems.map((t) => `<li><span>${stripEmph(t)}</span></li>`).join('')}</ul>`
    + `<p>${stripEmph(N.valuesLead)}</p>`;

  return `
    <section>
      <h2>${R.sections.selfEval}</h2>
      <table class="rp-likert">
        <thead><tr><th>${R.likertHead[0]}</th><th>${R.likertHead[1]}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${reflections}
      <div class="rp-row"><h3>${N.valuesLabel}</h3>${values}</div>
    </section>`;
}

/**
 * 종이 한 벌.
 *
 * @param {object} st     상태
 * @param {object} who    이 화면에서만 받은 이름·학번. 상태에도 저장소에도 넣지 않는다.
 * @param {'solo'|'group'} [kind]  활동지 종류. 생략하면 세션이 정한 대로.
 */
/** groupStore — 모둠장 기기면 모인 기록(T35). 머리에 별명 줄, 끝에 「모둠원별 기록」 절. 별명뿐이다. */
export function buildSheet(st, who, kind, groupStore = null) {
  const group = kind ? kind === 'group' : isGroup(st);
  const memberItems = [
    { key: 'q.a', label: N.qaContinueLabel },
    { key: 'q2', label: N.q2Label },
    { key: 'q3', label: N.q3Label },
    ...(N.q4Label ? [{ key: 'q4', label: N.q4Label }] : []),
    ...(N.discussionItems ?? []).map(({ key, label }) => ({ key: `discuss.${key}`, label })),
  ];
  return `
    ${head(st, who, group, groupStore)}
    <section><h2>${R.sections.problem}</h2><p>${N.problem}</p></section>
    <!-- 하는 일(role)은 그대로 넣는다. 두 눈금자의 대비(단위가 있다/없다)를 굵은 글씨로
         짚고 있고, 그건 우리가 쓴 문구다 — 학생이 쓴 글이 아니므로 막을 것이 없다.
         감싸면 종이에 태그가 글자로 찍힌다. -->
    <section><h2>${R.sections.materials}</h2>
      <ul class="rp-steps">${N.materials.map((m) =>
        `<li><b>${escapeHtml(m.name)}</b><span>${m.role}</span></li>`).join('')}</ul>
    </section>
    ${predict(st)}
    ${process(st)}
    ${results(st)}
    ${wrapup(st, group)}
    ${group ? discussion(st) : ''}
    ${selfEval(st)}
    ${group ? memberAppendix(groupStore, memberItems) : ''}`;
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
  const svgs = [...sheet.querySelectorAll('.rp-fov svg')];
  if (svgs.length === 0) return;
  const withTimeout = Promise.all(svgs.map(svgToPng));
  const timer = new Promise((r) => setTimeout(() => r(null), BAKE_TIMEOUT_MS));
  const pngs = await Promise.race([withTimeout, timer]);
  if (!pngs) return;
  pngs.forEach((url, i) => {
    if (!url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = UI.zoom.scopeMode;
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
 * 이름·학번은 여기 넣지 않는다. 그 둘은 표의 제 칸으로 따로 간다.
 *
 * ── **「뺄 것을 뺀다」가 아니라 「보낼 것만 적는다」다** ────────────────
 * 앞서 여기는 `{ ...st, session }` 이었다 — 되돌리기 기록(`history`) **하나만** 빼고
 * 상태를 통째로 보냈다. 그래서 실제로 나가고 있던 것이 이랬다:
 *
 *     session.log         조작 기록 — 무엇을 어떤 차례로 눌렀는지
 *     session.undosLeft   남은 되돌리기 횟수
 *     session.readStages  탐구 노트를 읽었다고 표시한 쪽
 *     eyepiece · items · microscope · picks   기구의 마지막 상태
 *
 * **`privacy.html` 제2조는 이 넷을 「기기 안에만 있고 전송하지 않습니다」로 적어 두었다.**
 * 즉 학생이 읽는 고지가 이 실험에 대해 **거짓**이었다. 방침은 사이트에 하나뿐인 문서라
 * banana 것을 그대로 물려받았는데, 이 실험만 꾸러미 만드는 자리가 달랐다.
 * (합치기 4단계, 2026-08-30 — 셋째 실험을 들이며 세 payloadOf 를 나란히 놓고서야 보였다)
 *
 * 빼는 목록은 새 값이 생길 때마다 조용히 새는데, **보낼 목록은 새 값이 생겨도 안 샌다.**
 * banana·osmosis 와 같은 모양으로 맞춘다. `tests/privacy.test.js` 가 이 목록과 방침의
 * `data-sends` 를 맞대므로, 값을 늘리려면 방침을 함께 고쳐야 초록불이 된다.
 */
export const SUBMIT_TOP_KEYS = [];                                 // 종이가 최상위 상태를 안 읽는다
export const SUBMIT_SESSION_KEYS = ['level', 'notes', 'captures']; // 종이가 실제로 읽는 셋

export function payloadOf(st, who, kind) {
  const state = {};
  for (const key of SUBMIT_TOP_KEYS) state[key] = st[key];
  const session = {};
  for (const key of SUBMIT_SESSION_KEYS) session[key] = st.session[key];
  return {
    kind,
    school: String(who.school ?? '').trim(),
    team: String(who.team ?? '').trim(),
    state: { ...state, session },
    app: UI.appTitle,
  };
}

export function createReport(root, store, { group = null } = {}) {
  const groupStore = group?.groupStore ?? null;
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
    sheet.innerHTML = buildSheet(store.getState(), who, kind, groupStore);
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
    open() {
      forget();
      kind = isGroup(store.getState()) ? 'group' : 'solo';
      paintKind();
      dialog.showModal();
      // 모둠명은 시작할 때 이미 적었다 — 채워 둔다. 고칠 수는 있다. (T35)
      const teamEl = inputs.find((el) => el.dataset.field === 'team');
      if (teamEl && groupStore?.me.name) teamEl.value = groupStore.me.name;
      inputs[0]?.focus();
    },
  };
}
