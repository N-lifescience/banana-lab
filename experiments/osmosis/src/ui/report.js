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

import { CONDITIONS } from '../sim/progress.js';
import { renderFOV } from '../render/fov.js';
import { observability } from '../sim/quality.js';
import { EYEPIECE } from '../sim/optics.js';
import { isGroup } from './notebook.js';
import { actualSummary, escapeHtml } from './notebook.js';
import { UI, emphasize } from './strings.js';
import { manifest } from '../manifest.js';
import { enabled as submitEnabled, findClass, submitReport } from '../../../../packages/lab-kit/net/supabase.js';

const R = UI.report;
const N = UI.notebook;

/** 값이 없으면 줄표. 빈칸을 그냥 두면 종이에서 항목이 사라진 것처럼 보인다. */
const or = (v, fallback = R.blank) => (String(v ?? '').trim() ? escapeHtml(v) : fallback);

/* ------------------------------------------------------------------ */
/* 종이 한 벌 만들기 — 여기서는 상태를 읽기만 한다                       */
/* ------------------------------------------------------------------ */

function head(st, who) {
  const level = UI.start.levels.find((l) => l.id === st.session.level);
  /*
   * **`groupFields` 도 함께 돈다.** `R.fields` 만 돌고 있어서, 모둠 활동지를 뽑아도
   * **모둠 이름이 종이 어디에도 안 실렸다.** 창에서 물어보고, 제출 꾸러미에도 담기고,
   * 선생님 화면도 읽는데 **정작 종이만 몰랐다** — 선생님은 모둠 이름 없는 활동지를 받는다.
   *
   * 빈 값은 걸러지므로 개별 활동지에서는 그대로 안 나온다
   * (「비워 두는 것이 아니라 아예 싣지 않는다」 — `strings.js` 의 그 규칙).
   */
  const rows = [...R.fields, ...R.groupFields]
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
  const rows = CONDITIONS.map((id) => {
    const why = st.session.notes[`predict.why.${id}`];
    return `
      <div class="rp-row">
        <h3>${N.conditions[id].title}</h3>
        <p>${or(st.session.notes[`predict.${id}`], R.notWritten)}</p>
        ${String(why ?? '').trim() ? `<p class="rp-sub">${R.predictWhy} — ${escapeHtml(why)}</p>` : ''}
      </div>`;
  }).join('');
  return `<section><h2>${R.sections.predict}</h2>${rows}</section>`;
}

/**
 * 탐구 과정. **적을 칸을 준 곳은 빈 칸도 그대로 싣는다.**
 * 적은 것만 실으면 종이만 보고는 어디를 건너뛰었는지 알 수 없다 — 보고서는 그것도 말해야 한다.
 *
 * **다만 칸을 준 적 없는 단계에는 「적지 않았습니다」를 달지 않는다.**
 * 기록칸은 일곱 곳뿐이다(`UI.protocol` 의 `note: true` — 조작의 결과가 시야에 나타나는 자리).
 * 나머지 열두 곳은 준비 동작이라 화면에도 칸이 없다. 그런데 종이가 열아홉 줄을 찍으면서
 * 그 열두 곳에 「적지 않았습니다」를 달면, **선생님 눈에는 학생이 건너뛴 것으로 읽힌다.**
 * 절차는 그대로 싣되(무엇을 했는지 보여야 하므로) 안 준 칸을 나무라지 않는다.
 * `tests/report.test.js` 가 화면의 칸 수와 종이의 빈칸 수를 맞대 본다.
 */
function process(st) {
  /*
   * **3단계는 STEP 마다 칸 하나다** (`notes['3']`, 세부 단계 칸이 아니다 — notebook.js renderStage4).
   * 앞서는 세부 단계 키(`3d`)만 읽어서 3단계 학생의 글이 종이에 **한 자도 안 실리고**, 그 자리
   * 일곱 곳에 「적지 않았습니다」가 붙었다 — 다 적은 학생이 선생님 눈에는 건너뛴 학생으로 보인다.
   * PLAYTEST.md 가 「한때 여기서 한 자도 안 실렸다」고 적어 둔 바로 그 자리가 되살아나 있었다.
   * osmosis 플레이테스트(2026-09-02) 3단계 종이에서 잡았다. `tests/report.test.js` 가 지킨다.
   */
  const goalOnly = st.session.level >= 3;
  const groups = UI.protocol.map((g) => {
    const items = g.steps.map((s, i) => {
      const key = `${g.id}${String.fromCharCode(97 + i)}`;
      if (!s.note || goalOnly) return `<li><b>${escapeHtml(s.label)}</b></li>`;
      return `<li><b>${escapeHtml(s.label)}</b><span>${or(st.session.notes[key], R.notWritten)}</span></li>`;
    }).join('');
    const goalNote = goalOnly
      ? `<li><b>${escapeHtml(N.notesLabel)}</b><span>${or(st.session.notes[g.id], R.notWritten)}</span></li>` : '';
    return `<div class="rp-row"><h3>STEP ${g.id} · ${escapeHtml(g.title)}</h3><ul class="rp-steps">${items}${goalNote}</ul></div>`;
  }).join('');
  return `<section><h2>${R.sections.process}</h2>${groups}</section>`;
}

/**
 * 농도별 표. **이 실험의 결과는 시야 한 장이 아니라 농도열이다.**
 *
 * 비율 칸은 학생이 적은 것을 그대로 싣는다 — 종이가 세어 주지 않는다.
 * 안 적은 칸도 빈칸으로 남긴다. 어디를 건너뛰었는지 종이가 말해야 한다.
 */
function concentrationTable(st) {
  const rows = ['WATER', 'S05', 'S10', 'S15', 'S20'].map((sol) => `
    <tr>
      <th scope="row">${UI.solutions[sol]}</th>
      <td>${or(st.session.notes[`ratio.${sol}`], R.notWritten)}</td>
    </tr>`).join('');
  return `
    <table class="rp-conc">
      <thead><tr><th>${N.concHeadSolution}</th><th>${N.concHeadRatio}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function results(st) {
  const caps = st.session.captures;
  if (caps.length === 0) {
    return `<section><h2>${R.sections.result}</h2>${concentrationTable(st)}<p>${R.noCaptures}</p></section>`;
  }
  const cards = caps.map((c, i) => {
    // 화면과 같은 번호를 쓴다 (`at`). 배열 인덱스로 찾으면 중간 기록을 지운 뒤
    // 종이에 실리는 배율 답이 한 칸씩 밀린다 — 화면은 맞고 종이만 틀린다.
    const at = c.at ?? i;
    return `
    <div class="rp-capture">
      <h3>${UI.slideShort[c.slide]} · ${c.solution ? UI.solutions[c.solution] : UI.noSolution}</h3>
      <div class="rp-fov">${renderFOV(c, { idPrefix: `rp${at}-` })}</div>
      <dl class="rp-readout">
        <div><dt>${N.eyepieceLabel}</dt><dd>${UI.units.mag(c.eyepiece ?? EYEPIECE)}</dd></div>
        <div><dt>${N.objectiveLabel}</dt><dd>${UI.units.mag(c.objective)}</dd></div>
        <div><dt>${UI.observability.label}</dt><dd>${observability(c).score}</dd></div>
        <div><dt>${R.magAnswer}</dt><dd>${or(st.session.notes[`mag.${at}`])}</dd></div>
      </dl>
    </div>`;
  }).join('');
  return `<section><h2>${R.sections.result}</h2>${concentrationTable(st)}<div class="rp-captures">${cards}</div></section>`;
}

function wrapup(st, group) {
  const compare = CONDITIONS.map((id) => `
    <div class="rp-row">
      <h3>${N.conditions[id].title}</h3>
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
    [N.q3Label, st.session.notes.q3],
    ...(group ? [[N.q4Label, st.session.notes.q4]] : []),
  ].map(([label, text]) => `
    <div class="rp-row"><h3>${emphasize(label)}</h3><p>${or(text, R.notWritten)}</p></div>`).join('');

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

  /*
   * **안전은 판정하지 않는다. 적어 두기만 한다.**
   * 화면(자기 평가 쪽)과 **같은 문장**을 싣는다 — 종이와 화면이 다른 말을 하면 안 된다.
   * 예전에는 「지켰다/놓쳤다」를 실었는데, 가상 실험에서 그걸 따지면 화면 속 단추를
   * 눌렀다는 사실을 평가하게 된다. 진짜 마개는 교실에서 닫는다.
   */
  // 우리가 쓴 문장이라 `emphasize` 로 굵게 살린다 (학생이 쓴 글이 아니므로 escapeHtml 대상이 아니다).
  // 화면(준비물 2쪽)과 **같은 문장**을 싣는다 — 종이와 화면이 다른 말을 하면 안 된다.
  const safety = `<p>${emphasize(N.valuesLead)}</p>`
    + `<ul class="rp-steps">${N.valuesList.map((s) => `<li><span>${emphasize(s)}</span></li>`).join('')}</ul>`;

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
  const group = kind ? kind === 'group' : isGroup(st);
  /*
   * 문제와 준비물 설명은 **우리가 쓴 문장**이라 「**굵게**」 표기가 들어 있다.
   * 화면(notebook.js)은 emphasize 로 풀어 쓰는데 종이만 날것으로 실어서, 인쇄된 활동지의
   * 1절이 「**어느 농도에서 세포의 절반이 변할까?**」 로 별표째 나왔다.
   * osmosis 플레이테스트(2026-09-02)에서 종이를 찍어 보고 잡았다. tests/report.test.js 가 지킨다.
   * (템플릿 문자열 안이라 주석에 백틱을 쓰면 그 자리에서 끊긴다 — 실제로 끊겼다.)
   */
  return `
    ${head(st, who)}
    <section><h2>${R.sections.problem}</h2><p>${emphasize(N.problem)}</p></section>
    <section><h2>${R.sections.materials}</h2>
      <ul class="rp-steps">${N.materials.map((m) =>
        `<li><b>${escapeHtml(m.name)}</b><span>${emphasize(m.role)}</span></li>`).join('')}</ul>
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
 *
 * 되돌리기 기록(history)은 뺀다 — 세션 안에서만 쓰는 값이고, 통째로 보내면 꾸러미가
 * 몇 배로 커진다. 이름·학번은 여기 넣지 않는다. 그 둘은 표의 제 칸으로 따로 간다.
 */
/**
 * 「선생님께 제출」 이 보내는 것 전부. **보낼 것만 적는다.**
 *
 * ── 왜 목록으로 적는가 ─────────────────────────────────────────────
 * 앞서는 `const { history, ...session } = st.session` 으로 **뺄 것만 빼고 나머지를 통째로**
 * 보냈다. 그러면 상태에 값이 하나 늘 때마다 **조용히 함께 새어 나간다.**
 * 실제로 이렇게 나가고 있었다 — 어느 것도 보고서에 실리지 않는데도:
 *
 *   session.log        학생이 무엇을 **어떤 차례로** 눌렀는지 전부
 *   session.tidy · step · readStages · undosLeft · seed
 *   slides · microscope · tools   기구 상태 전부
 *
 * 「빼야 할 것을 뺀다」 를 「보낼 것만 적는다」 로 뒤집었다. 크기는 2833자 → 609자다.
 * (catalase-lab 세션이 짚어 준 것. 바나나랩에서 복제한 저장소가 다 같았다.)
 *
 * ── 줄여도 되는 근거 ───────────────────────────────────────────────
 * 선생님 화면은 받은 값으로 **같은 종이를 다시 그린다** (`src/teacher.js` 의 `sheetOf`).
 * 그러니 「보낸 것만으로 같은 종이가 나오는가」가 곧 「충분한가」이고,
 * 「하나 빼면 종이가 달라지는가」가 곧 「군더더기가 없는가」다.
 * `tests/privacy.test.js` 가 난이도 3 × 활동방식 2 × 활동지 2 = 12가지에서 둘 다 본다.
 *
 * **이 목록과 `privacy.html` 제2조가 같아야 한다.** 받는 것을 안 적어 두는 것도,
 * 안 받는 것을 적어 두는 것도 똑같이 틀린 고지다.
 */
/*
 * 제출하는 것. **읽지도 않는 것을 수집하지 않는다.**
 * `violations` 가 여기 있었는데, 안전 판정을 걷어내면서 그 값 자체가 사라졌다.
 * 종이도 화면도 안 읽는 값을 계속 보내면 그냥 남의 정보를 모으는 것이다.
 * 개인정보처리방침의 「보내는 것」 목록도 같이 줄였다 — `tests/privacy.test.js` 가 양쪽을 맞댄다.
 */
export const SUBMIT_SESSION_KEYS = ['level', 'notes', 'captures'];

export function payloadOf(st, who, kind) {
  const session = {};
  for (const k of SUBMIT_SESSION_KEYS) session[k] = st.session[k];
  return {
    kind,
    school: String(who.school ?? '').trim(),
    team: String(who.team ?? '').trim(),
    state: { session },
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
