/**
 * 선생님 화면의 **진입점** — 어느 실험의 수업인지 정하고, 그 실험 것을 실어 준다.
 *
 * ── 왜 이 층이 따로 있는가 (합치기 4단계, 2026-08-30) ────────────────
 * 화면 자체는 `packages/lab-kit/teacher.js` 에 있고 **여덟 실험이 함께 쓴다.**
 * 그런데 그 화면이 그리려면 이 실험의 문구·매니페스트·보고서 종이가 필요하고,
 * 그 셋은 **어느 실험인지 정해진 뒤에야** 안다.
 *
 * 그래서 이 파일이 주소에서 실험을 읽어(`?exp=`) 그 실험 것만 골라 싣는다.
 * 안 실은 실험의 코드는 **내려받지도 않는다** — 동적 import 라 그렇다.
 *
 * ── 주소 ────────────────────────────────────────────────────────────
 *     /teacher                  실험 고르기 (아래 목록)
 *     /teacher?exp=banana       그 실험의 수업 열기
 *     /teacher?exp=banana&t=…   그 반의 제출물 보기
 *
 * `exp` 가 **관리 링크에도** 실려야 한다. 없으면 링크를 다시 열었을 때
 * 어느 실험의 종이로 그려야 할지 알 수 없다.
 */

import { mountTeacher } from '../packages/lab-kit/teacher.js';

/*
 * 이 사이트에서 실험이 사는 주소의 앞자리. `vercel.json` 의 되쓰기가 이 값을
 * `/experiments/:exp` 로 바꾼다. **`.html` 을 붙이지 않는다** — `cleanUrls` 가 308 로
 * 되돌려 404 를 낸다 (`MERGE-AND-DEPLOY.md` §4).
 * `tests/site.test.js` 가 이 값과 되쓰기·카탈로그의 링크가 같은지 본다.
 */
const EXP_BASE = '/cell-metabolism';

/**
 * 이 사이트에 있는 실험들. **여기 한 곳에만 적는다.**
 * 실험을 늘리면 이 줄과 `vite.config.js` 의 진입점 한 줄이 는다.
 */
const EXPERIMENTS = ['banana', 'micrometer', 'osmosis'];

const params = new URLSearchParams(location.search);
const exp = params.get('exp') ?? '';

const $ = (sel) => document.querySelector(sel);

/** 실험을 아직 안 골랐을 때. 골라야 화면이 무엇을 그릴지 정해진다. */
async function renderPicker() {
  $('#tc-title-h').textContent = '선생님 화면';
  $('#tc-lead').innerHTML = '수업을 열 <b>실험</b>을 먼저 고르세요. '
    + '반마다 다른 실험으로 여러 수업을 열 수 있습니다.';

  const cards = await Promise.all(EXPERIMENTS.map(async (id) => {
    const { manifest } = await import(`../experiments/${id}/src/manifest.js`);
    return `
      <li class="tc-item">
        <div class="tc-item-head">
          <span class="tc-name">${manifest.title}</span>
          <a class="tc-when" href="?exp=${encodeURIComponent(id)}">수업 열기 →</a>
        </div>
      </li>`;
  }));

  $('#tc-app').innerHTML = `
    <section class="tc-card">
      <h2>어느 실험의 수업인가요?</h2>
      <ul class="tc-list">${cards.join('')}</ul>
    </section>`;
}

/** 고른 실험이 이 사이트에 없을 때. 조용히 빈 화면을 그리지 않는다. */
function renderUnknown() {
  $('#tc-title-h').textContent = '선생님 화면';
  $('#tc-lead').textContent = '';
  $('#tc-app').innerHTML = `
    <section class="tc-card">
      <h2>그런 실험이 없습니다</h2>
      <p class="tc-hint">주소의 <code>exp=${exp.replace(/[<>&"]/g, '')}</code> 가 이 사이트에 없는 실험입니다.
        링크가 오래된 것일 수 있습니다.</p>
      <p class="tc-hint"><a href="?">실험 고르기로 →</a></p>
    </section>`;
}

if (!exp) {
  renderPicker();
} else if (!EXPERIMENTS.includes(exp)) {
  renderUnknown();
} else {
  const [{ UI }, { manifest }, { buildSheet }, { escapeHtml }] = await Promise.all([
    import(`../experiments/${exp}/src/ui/strings.js`),
    import(`../experiments/${exp}/src/manifest.js`),
    import(`../experiments/${exp}/src/ui/report.js`),
    import(`../experiments/${exp}/src/ui/notebook.js`),
  ]);

  mountTeacher({
    UI,
    manifest,
    buildSheet,
    escapeHtml,
    links: {
      /** 학생이 여는 곳 — 그 실험의 교과 주소. 반 코드를 달아 준다. */
      student: (code) =>
        `${location.origin}${EXP_BASE}/${encodeURIComponent(manifest.id)}`
        + `?code=${encodeURIComponent(code)}`,
      /**
       * 선생님만 갖는 곳. **`exp` 를 함께 싣는다** — 이 링크를 다시 열었을 때
       * 어느 실험의 종이로 그려야 할지가 여기서만 나온다.
       */
      admin: (token) =>
        `${location.origin}/teacher`
        + `?exp=${encodeURIComponent(manifest.id)}&t=${encodeURIComponent(token)}`,
    },
  });
}
