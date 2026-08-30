/**
 * 선생님 화면 — 수업을 열고, 제출된 보고서를 본다. **사이트에 하나뿐이다.**
 *
 * ── 로그인이 없다 ──────────────────────────────────────────────────
 * 계정을 만들면 학교마다 계정 관리가 따라온다. 대신 **관리 링크**를 쓴다 — 주소 안의
 * 긴 난수를 아는 사람이 그 반의 주인이다. 이 방식의 대가는 분명하다: 링크를 잃으면
 * 되찾을 길이 없고, 링크를 흘리면 그 반이 열린다. 화면에서 두 번 말한다.
 *
 * ── 여기서 하지 않는 것 ────────────────────────────────────────────
 * 채점하지 않는다. 통계를 내지 않는다. 학생 정보를 이 화면 밖으로 내보내지 않는다.
 * 하는 일은 셋뿐이다 — 수업 열기 · 제출물 보기 · 지우기.
 *
 * ── 왜 공용으로 올라왔는가 (합치기 4단계, 2026-08-30) ─────────────────
 * 이 파일은 **저장소 여덟에서 바이트까지 같았다** (`cmp` 로 여덟 번 확인).
 * 「세 번 똑같이 생긴 것만 올린다」는 규칙은 **모르는 것을 셋으로 확인하라**는 뜻이지,
 * 이미 여덟 번 확인한 것을 미루라는 뜻이 아니다 — 그래서 4단계에서 가장 먼저 올렸다.
 * `teacher.html` 도 제목 한 줄만 달랐고, 그 제목은 이미 `manifest` 에 있다.
 *
 * ── 실험의 것은 **주입받는다** (`MERGE-AND-DEPLOY.md` §3.3) ───────────
 * 문구·매니페스트·보고서 종이는 실험마다 다르다. 엔진이 직접 갖지 않고 받는다.
 * 받는 것은 다섯뿐이다:
 *
 *     UI          이 실험의 문자열 (`UI.teacher` 를 쓴다)
 *     manifest    이 실험의 id — 어느 실험의 수업인지 표에 적는 값
 *     buildSheet  제출된 것을 **다시 그리는** 함수. 실험마다 종이가 다르다
 *     escapeHtml  이 실험의 것. 한 줄짜리지만 종이와 같은 것을 써야 한다
 *     links       학생용·관리용 주소를 만드는 두 함수. **사이트의 라우팅**이라
 *                 엔진이 알면 안 된다 (아래 `studentUrl` 주석)
 *
 * 다섯 다 **어느 실험인지 정해진 뒤에야** 안다. 그래서 진입점(`src/teacher.js`)이
 * 주소에서 실험을 읽어 그 실험 것을 실어 온다.
 */

import { qrSVG } from './ui/qr.js';
import {
  enabled, createClass, findClassByToken, listReports, deleteReport, closeClass,
} from './net/supabase.js';

/*
 * 주입받은 것을 담는 자리. `mountTeacher()` 를 부르기 전에는 비어 있다 —
 * 이 파일은 **어느 실험인지 모르는 채로** 불러도 아무 일이 없어야 한다.
 */
let T = null;
let manifest = null;
let buildSheet = null;
let escapeHtml = null;
let links = null;

function bind(deps) {
  const missing = ['UI', 'manifest', 'buildSheet', 'escapeHtml', 'links'].filter((k) => !deps?.[k]);
  /*
   * **앞 조건.** 하나라도 빠지면 화면은 「제출물 0건」 같은 **그럴듯한 빈 화면**을 그린다.
   * 선생님은 학생이 안 냈다고 읽는다. 조용히 비지 말고 여기서 멎는다.
   */
  if (missing.length) {
    throw new Error(`선생님 화면에 넘겨야 할 것이 빠졌습니다: ${missing.join(', ')}`);
  }
  T = deps.UI.teacher;
  ({ manifest, buildSheet, escapeHtml, links } = deps);
  if (!T) throw new Error('이 실험의 UI 에 teacher 문구가 없습니다 (UI.teacher)');
  for (const k of ['student', 'admin']) {
    if (typeof links[k] !== 'function') throw new Error(`links.${k}(…) 가 없습니다`);
  }
}

const $ = (sel, root = document) => root.querySelector(sel);

/** 관리 토큰은 주소에만 있다. 브라우저 저장소에 넣지 않는다 — 공용 컴퓨터가 많다. */
const tokenFromUrl = () => new URLSearchParams(location.search).get('t') ?? '';

/*
 * ── 주소 만들기는 **사이트**의 일이다 (합치기 4단계, 2026-08-30) ────────
 * 앞서 이 두 줄은 엔진 안에 있었고, 합친 뒤로 **둘 다 틀린 주소**를 냈다:
 *
 *     학생용   `${origin}/?exp=banana&code=…`   ← 뿌리는 이제 **카탈로그**다.
 *                                                 `exp`·`code` 를 아무도 안 읽는다
 *     관리용   `${origin}/teacher.html?t=…`      ← 그 파일은 실험 폴더 안에 있었다. 404
 *
 * 교사가 그 링크를 학습지에 인쇄해 나눠 준다. **틀린 채로 나가면 되돌릴 수 없다.**
 * 엔진은 어느 주소 밑에 사는지 몰라야 하므로 진입점이 만들어 넘긴다.
 */
const studentUrl = (code) => links.student(code);
const adminUrl = (token) => links.admin(token);

const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};
const fmtWhen = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 눌러서 복사. 클립보드가 막힌 브라우저에서는 글자를 골라 준다 — 손으로라도 복사되게. */
function copyable(id, label, value) {
  return `
    <div class="tc-copy">
      <span class="tc-copy-label">${label}</span>
      <div class="tc-copy-row">
        <input type="text" id="${id}" value="${escapeHtml(value)}" readonly>
        <button type="button" class="tc-copy-btn" data-copy="${id}">${T.made.copy}</button>
      </div>
    </div>`;
}

function bindCopy(root) {
  root.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const input = $(`#${btn.dataset.copy}`, root);
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
      } catch {
        document.execCommand?.('copy');   // 오래된 학교 컴퓨터용
      }
      const was = btn.textContent;
      btn.textContent = T.made.copied;
      setTimeout(() => { btn.textContent = was; }, 1400);
    });
  });
}

/* ------------------------------------------------------------------ */
/* 수업 열기                                                           */
/* ------------------------------------------------------------------ */

function renderCreate(root) {
  root.innerHTML = `
    <section class="tc-card">
      <h2>${T.create.heading}</h2>
      <label class="tc-field">
        <span>${T.create.titleLabel}</span>
        <input type="text" id="tc-title" placeholder="${T.create.titlePlaceholder}" autocomplete="off">
      </label>
      <label class="tc-field">
        <span>${T.create.daysLabel}</span>
        <select id="tc-days">
          ${T.create.dayOptions.map((d) => `
            <option value="${d}"${d === 30 ? ' selected' : ''}>${T.create.dayUnit(d)}</option>`).join('')}
        </select>
      </label>
      <p class="tc-hint">${T.create.daysHint}</p>
      <p class="tc-duty">${T.duty}</p>
      <button type="button" id="tc-go" class="tc-primary">${T.create.go}</button>
      <p class="tc-msg" id="tc-msg" role="status" aria-live="polite"></p>
    </section>`;

  const go = $('#tc-go', root);
  const msg = $('#tc-msg', root);
  let busy = false;

  go.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const label = go.textContent;
    go.textContent = T.create.working;
    go.setAttribute('aria-busy', 'true');
    try {
      const made = await createClass({
        exp: manifest.id,
        title: $('#tc-title', root).value.trim(),
        days: Number($('#tc-days', root).value),
      });
      // 주소를 바꿔 둔다. 새로고침해도 그 반으로 돌아온다.
      history.replaceState(null, '', adminUrl(made.teacherToken));
      renderMade(root, made);
    } catch (e) {
      console.error(e);
      msg.textContent = T.create.failed;
      msg.dataset.kind = 'warn';
    } finally {
      busy = false;
      go.textContent = label;
      go.removeAttribute('aria-busy');
    }
  });
}

function renderMade(root, made) {
  root.innerHTML = `
    <section class="tc-card">
      <h2>${T.made.heading}</h2>
      <p class="tc-code-label">${T.made.codeLabel}</p>
      <p class="tc-code">${made.code}</p>
      ${copyable('tc-link', T.made.linkLabel, studentUrl(made.code))}
      <div class="tc-qr">
        <span class="tc-copy-label">${T.made.qrLabel}</span>
        <div class="tc-qr-box">${qrSVG(studentUrl(made.code), { size: 200 })}</div>
        <p class="tc-hint">${T.made.qrHint}</p>
      </div>
      <hr class="tc-rule">
      ${copyable('tc-admin', T.made.adminLabel, adminUrl(made.teacherToken))}
      <p class="tc-warn">${T.made.adminWarn}</p>
      <button type="button" id="tc-open" class="tc-primary">${T.made.open}</button>
    </section>`;
  bindCopy(root);
  $('#tc-open', root).addEventListener('click', () => renderBoard(root, made.teacherToken));
}

/* ------------------------------------------------------------------ */
/* 제출된 보고서                                                        */
/* ------------------------------------------------------------------ */

/** 명단 CSV. 엑셀이 한글을 깨뜨리지 않도록 BOM 을 붙인다. */
function csvOf(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['학번', '이름', '방식', '단계', '제출 시각'];
  const body = rows.map((r) => [
    r.student_no, r.student_name, r.mode === 'group' ? '모둠' : '개인', r.level,
    new Date(r.created_at).toLocaleString('ko-KR'),
  ]);
  return '﻿' + [head, ...body].map((line) => line.map(esc).join(',')).join('\r\n');
}

function download(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 낸 보고서를 그대로 다시 그린다 — 저장된 것은 그림이 아니라 시드와 파라미터다. */
function sheetOf(row) {
  const p = row.payload ?? {};
  const who = {
    school: p.school ?? '',
    name: row.student_name,
    team: p.team ?? '',
    // 학번은 한 덩어리로 저장돼 있다. 활동지 머리에는 그대로 싣는다.
    grade: '', classNo: '', number: '',
  };
  try {
    return buildSheet(p.state, { ...who, studentNo: row.student_no }, p.kind ?? row.mode);
  } catch (e) {
    console.error(e);
    return `<p class="tc-warn">이 보고서를 다시 그리지 못했습니다 (${escapeHtml(String(e.message))}).</p>`;
  }
}

async function renderBoard(root, token) {
  root.innerHTML = `<section class="tc-card"><p class="tc-msg">불러오는 중…</p></section>`;

  let klass;
  try {
    klass = await findClassByToken(token);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<section class="tc-card"><p class="tc-msg" data-kind="warn">${T.board.loadFailed}</p></section>`;
    return;
  }
  if (!klass) {
    root.innerHTML = `<section class="tc-card"><p class="tc-msg" data-kind="warn">${T.board.notFound}</p></section>`;
    return;
  }

  let rows = [];
  try {
    rows = (await listReports(token, klass.id)) ?? [];
  } catch (e) {
    console.error(e);
  }

  root.innerHTML = `
    <section class="tc-card">
      <div class="tc-board-head">
        <div>
          <h2>${T.board.heading} <span class="tc-count">${T.board.count(rows.length)}</span></h2>
          <p class="tc-hint">
            ${escapeHtml(klass.title || '')} ·
            ${T.made.codeLabel} <b class="tc-code-inline">${klass.code}</b> ·
            ${T.board.expires(fmtDate(klass.expires_at))}
          </p>
        </div>
        <div class="tc-board-tools">
          <button type="button" id="tc-refresh">${T.board.refresh}</button>
          <button type="button" id="tc-csv">${T.board.exportCsv}</button>
          <button type="button" id="tc-print">${T.board.printAll}</button>
        </div>
      </div>
      ${copyable('tc-link2', T.made.linkLabel, studentUrl(klass.code))}
      <div class="tc-qr-box tc-qr-box--small">${qrSVG(studentUrl(klass.code), { size: 132 })}</div>

      ${rows.length === 0 ? `<p class="tc-empty">${T.board.empty}</p>` : `
        <ul class="tc-list">
          ${rows.map((r) => `
            <li class="tc-item" data-id="${r.id}">
              <div class="tc-item-head">
                <b class="tc-no">${escapeHtml(r.student_no)}</b>
                <span class="tc-name">${escapeHtml(r.student_name)}</span>
                <span class="tc-tag">${r.mode === 'group' ? '모둠' : '개인'} · ${r.level}단계</span>
                <span class="tc-when">${fmtWhen(r.created_at)}</span>
                <button type="button" class="tc-toggle" data-open="${r.id}">${T.board.openOne}</button>
                <button type="button" class="tc-remove" data-remove="${r.id}">${T.board.remove}</button>
              </div>
              <div class="tc-item-body" id="body-${r.id}" hidden></div>
            </li>`).join('')}
        </ul>`}

      <hr class="tc-rule">
      <p class="tc-duty">${T.duty}</p>
      <button type="button" id="tc-close" class="tc-danger">${T.board.closeClass}</button>
      <p class="tc-msg" id="tc-msg" role="status" aria-live="polite"></p>
    </section>
    <div id="tc-print-area" class="tc-print-area"></div>`;

  bindCopy(root);

  root.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const body = $(`#body-${CSS.escape(btn.dataset.open)}`, root);
      const row = rows.find((r) => r.id === btn.dataset.open);
      if (body.hidden) {
        if (!body.innerHTML) body.innerHTML = sheetOf(row);
        body.hidden = false;
        btn.textContent = T.board.closeOne;
      } else {
        body.hidden = true;
        btn.textContent = T.board.openOne;
      }
    });
  });

  root.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(T.board.removeConfirm)) return;
      try {
        await deleteReport(token, btn.dataset.remove);
        renderBoard(root, token);
      } catch (e) {
        console.error(e);
        $('#tc-msg', root).textContent = T.board.loadFailed;
      }
    });
  });

  $('#tc-refresh', root).addEventListener('click', () => renderBoard(root, token));
  $('#tc-csv', root).addEventListener('click', () => {
    download(`제출명단_${klass.code}.csv`, csvOf(rows));
  });
  $('#tc-print', root).addEventListener('click', () => {
    // 한 장씩 열어 인쇄하면 서른 번을 눌러야 한다. 전부 이어 붙여 한 번에 낸다.
    $('#tc-print-area', root).innerHTML = rows.map((r) =>
      `<div class="tc-print-one">${sheetOf(r)}</div>`).join('');
    setTimeout(() => window.print(), 60);
  });
  $('#tc-close', root).addEventListener('click', async () => {
    if (!confirm(T.board.closeConfirm)) return;
    try {
      await closeClass(token, klass.id);
      history.replaceState(null, '', location.pathname);
      root.innerHTML = `<section class="tc-card"><p class="tc-msg" data-kind="done">${T.board.closed}</p></section>`;
    } catch (e) {
      console.error(e);
      $('#tc-msg', root).textContent = T.board.loadFailed;
    }
  });
}

/* ------------------------------------------------------------------ */

/**
 * 화면을 붙인다. **실험이 정해진 뒤에** 부른다.
 *
 * `document` 에서 세 자리를 찾는다 — `#tc-title-h` · `#tc-lead` · `#tc-app`.
 * 그 셋은 `teacher.html` 이 갖고 있고, 실험과 무관한 껍데기다.
 */
export function mountTeacher(deps) {
  bind(deps);

  const app = $('#tc-app');
  $('#tc-title-h').textContent = T.title;
  $('#tc-lead').innerHTML = T.lead;

  if (!enabled()) {
    app.innerHTML = `
      <section class="tc-card">
        <h2>${T.offTitle}</h2>
        <p class="tc-hint">${T.offBody}</p>
      </section>`;
  } else if (tokenFromUrl()) {
    renderBoard(app, tokenFromUrl());
  } else {
    renderCreate(app);
  }
}
