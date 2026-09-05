/**
 * 선생님 화면 — **학생용 링크와 QR 을 만든다.** 그것뿐이다.
 *
 * ── 왜 이것뿐인가 (사장님 결정 2026-09-03) ──────────────────────────
 * 제출 서버를 두지 않기로 했다. 학생 정보를 사이트 주인이 들고 있으면, 봉인을 해도
 * 서버가 주인 것이라 개인정보 처리자의 책임(열람 요청·유출 신고·위탁 문서)이 남는다.
 * **받지 않는 것이 가장 확실한 보호**다.
 *
 * 그래서 학생은 활동을 마치고 **보고서를 PDF 로 저장해** 학교 과제방이나 메신저로 내고,
 * 이 화면은 그 활동으로 데려갈 **링크와 QR** 만 만든다. 저장하는 것이 없으므로
 * 수업 코드도, 관리 링크도, 데이터베이스도 없다.
 *
 * ── 실험의 것은 **주입받는다** (`MERGE-AND-DEPLOY.md` §3.3) ───────────
 * 문구와 매니페스트는 실험마다 다르다. 엔진이 직접 갖지 않고 받는다:
 *
 *     UI          이 실험의 문자열 (`UI.teacher.share` · `UI.start`)
 *     manifest    이 실험의 id·제목
 *     escapeHtml  이 실험의 것. 한 줄짜리지만 종이와 같은 것을 써야 한다
 *     links.plain 학생이 여는 주소를 만드는 함수. **사이트의 라우팅**이라 엔진이 알면 안 된다
 */

import { qrSVG } from './ui/qr.js';
import { P } from './practice/strings.js';
import { G } from './group/strings.js';

/*
 * 주입받은 것을 담는 자리. `mountTeacher()` 를 부르기 전에는 비어 있다 —
 * 이 파일은 **어느 실험인지 모르는 채로** 불러도 아무 일이 없어야 한다.
 */
let T = null;
let UI_ALL = null;
let manifest = null;
let escapeHtml = null;
let links = null;

function bind(deps) {
  const missing = ['UI', 'manifest', 'escapeHtml', 'links'].filter((k) => !deps?.[k]);
  /*
   * **앞 조건.** 하나라도 빠지면 화면은 그럴듯한 빈 화면을 그린다. 조용히 비지 말고 여기서 멎는다.
   */
  if (missing.length) {
    throw new Error(`선생님 화면에 넘겨야 할 것이 빠졌습니다: ${missing.join(', ')}`);
  }
  T = deps.UI.teacher;
  UI_ALL = deps.UI;
  ({ manifest, escapeHtml, links } = deps);
  if (!T?.share) throw new Error('이 실험의 UI 에 선생님 화면 문구가 없습니다 (UI.teacher.share)');
  if (typeof links.plain !== 'function') throw new Error('links.plain(…) 이 없습니다');
}

const $ = (sel, root = document) => root.querySelector(sel);

/** 눌러서 복사. 클립보드가 막힌 브라우저에서는 글자를 골라 준다 — 손으로라도 복사되게. */
function copyable(id, label, value) {
  return `
    <div class="tc-copy">
      <span class="tc-copy-label">${label}</span>
      <div class="tc-copy-row">
        <input type="text" id="${id}" value="${escapeHtml(value)}" readonly>
        <button type="button" class="tc-copy-btn" data-copy="${id}">${T.share.copy}</button>
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
      btn.textContent = T.share.copied;
      setTimeout(() => { btn.textContent = was; }, 1400);
    });
  });
}

/* ------------------------------------------------------------------ */
/* 링크·QR 만들기 — 이 화면이 하는 일 전부                               */
/* ------------------------------------------------------------------ */

/**
 * 용도(가상 탐구 실험 / 실험 리허설)와 단계·방식을 골라 학생용 링크와 QR 을 만든다.
 * **아무것도 저장하지 않는다.**
 *
 * ── 왜 용도가 여기에도 있는가 (T37) ─────────────────────────────────
 * 학생 화면은 1쪽에서 용도를 먼저 묻는다(`ui/start.js`). 선생님 화면이 그것을 모르면
 * 여기서 만든 링크는 **늘 가상 탐구 실험**이고, 「실험 리허설로 한 시간 돌려 보자」는 수업은
 * 링크를 못 만든다 — 학생마다 1쪽에서 제대로 골랐기를 바라는 수밖에 없다.
 *
 * 리허설 링크는 `?practice=1` 하나다. 단계·방식을 안 싣는 이유는 **연습이 그 둘을 고정하기
 * 때문**이다(`main.js` 의 `if (practice) { level = 1; mode = SOLO; }`). 링크에 실어 주면
 * 고른 값이 조용히 무시된다 — 그건 거짓말이다.
 */
function renderShare(root) {
  const S = UI_ALL.start;
  const Sh = T.share;
  const Pt = P.teacher;
  let purpose = 'virtual';
  let level = 1;
  // 앱의 기본과 같게 **혼자**다 (T36). 여기만 모둠이면 선생님이 고른 적 없는 값이 링크에 실린다.
  let mode = 'solo';

  /*
   * 이 실험의 실제 실험용 양식 (T39). 주소를 만드는 것은 **사이트**의 일이라 주입받는다 —
   * 없으면(그런 양식이 아직 없는 실험이면) 그 칸을 아예 안 그린다. 죽은 단추를 두지 않는다.
   *
   * ★ **리허설을 골랐을 때만 보인다** (사장님 지시 2026-09-06).
   *   그 종이는 **실험실에 들고 가는 것**이라, 가상으로 끝나는 수업에는 쓸 자리가 없다.
   *   두 모드에 다 두면 「가상 탐구 실험에도 종이가 필요한가」로 읽힌다. 되살리지 말 것.
   */
  const formUrl = typeof links.form === 'function' ? links.form() : null;

  const draw = () => {
    const practice = purpose === 'practice';
    const url = links.plain(practice ? { practice: true } : { level, mode });
    const subtitle = practice
      ? P.practice.name
      : `${S.levels.find((l) => l.id === level)?.name ?? ''} · ${S.modes.find((m) => m.id === mode)?.name ?? ''}`;
    root.innerHTML = `
      <section class="tc-card">
        <h2>${Sh.heading}</h2>
        <div class="tc-field"><span>${P.purposeLabel}</span>
          <div class="tc-purposes" role="radiogroup" aria-label="${P.purposeLabel}">
            ${[['virtual', P.virtual], ['practice', P.practice]].map(([id, m]) => `
              <label class="tc-purpose${id === purpose ? ' is-on' : ''}">
                <input type="radio" name="tc-purpose" value="${id}"${id === purpose ? ' checked' : ''}>
                <span class="tc-purpose-name">${escapeHtml(m.name)}</span>
                <span class="tc-purpose-desc">${escapeHtml(m.desc)}</span>
              </label>`).join('')}
          </div>
          <p class="tc-hint">${Pt.purposeHint}</p>
        </div>
        ${practice ? `<p class="tc-hint tc-locked">${Pt.practiceLocked}</p>` : `
        <div class="tc-field"><span>${S.chooseLabel}</span>
          <div class="tc-choices" role="radiogroup" aria-label="${S.chooseLabel}">
            ${S.levels.map((l) => `<label><input type="radio" name="tc-level" value="${l.id}"${l.id === level ? ' checked' : ''}> <span class="tc-choice">${escapeHtml(l.name)}</span></label>`).join('')}
          </div></div>
        <div class="tc-field"><span>${S.modeLabel}</span>
          <div class="tc-choices" role="radiogroup" aria-label="${S.modeLabel}">
            ${S.modes.map((m) => `<label><input type="radio" name="tc-mode" value="${m.id}"${m.id === mode ? ' checked' : ''}> <span class="tc-choice">${escapeHtml(m.name)}</span></label>`).join('')}
          </div>
          ${mode === 'group' ? `<p class="tc-hint">${G.teacherHint}</p>` : ''}
        </div>`}
        <hr class="tc-rule">
        ${copyable('tc-plain', Sh.linkLabel, url)}
        <div class="tc-qr">
          <span class="tc-copy-label">${Sh.qrLabel}</span>
          <div class="tc-qr-box">${qrSVG(url, { size: 200 })}</div>
          <p class="tc-hint">${practice ? Pt.practiceQrHint : Sh.qrHint}</p>
        </div>
        <button type="button" id="tc-print-qr">${Sh.print}</button>
        <p class="tc-duty">${practice ? Pt.practiceCollect : Sh.howToCollect}</p>
        ${practice && formUrl ? `<hr class="tc-rule">
        <p class="tc-hint">${Pt.formLead}</p>
        <a class="tc-form" id="tc-form-link" href="${escapeHtml(formUrl)}" download>${Pt.formButton} ↓</a>` : ''}
      </section>
      <div id="tc-print-area" class="tc-print-area">
        <div class="tc-print-one tc-print-qr">
          <h1>${escapeHtml(manifest.title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
          ${qrSVG(url, { size: 360 })}
          <p class="tc-print-url">${escapeHtml(url)}</p>
        </div>
      </div>`;
    bindCopy(root);
    root.querySelectorAll('input[name="tc-purpose"]').forEach((el) => el.addEventListener('change', () => { purpose = el.value; draw(); }));
    root.querySelectorAll('input[name="tc-level"]').forEach((el) => el.addEventListener('change', () => { level = Number(el.value); draw(); }));
    root.querySelectorAll('input[name="tc-mode"]').forEach((el) => el.addEventListener('change', () => { mode = el.value; draw(); }));
    $('#tc-print-qr', root).addEventListener('click', () => setTimeout(() => window.print(), 60));
  };
  draw();
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
  $('#tc-title-h').textContent = T.share.title;
  $('#tc-lead').innerHTML = T.share.lead;
  renderShare($('#tc-app'));
}
